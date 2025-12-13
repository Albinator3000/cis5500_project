-- Query 1: Cumulative Abnormal Returns (CAR) around funding events
-- Analyzes price movements in a [-60, +180] minute window around each funding event
-- CAR accumulates only post-event returns to measure market reaction
WITH funding_events AS (
    SELECT
        symbol,
        ts AS event_ts
    FROM funding
    WHERE symbol = 'BTCUSDT'
      AND ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
),
returns_window AS (
    SELECT
        f.symbol,
        f.event_ts,
        mr.ts,
        mr.r1m,
        -- Only accumulate returns after the event
        CASE
            WHEN mr.ts >= f.event_ts THEN mr.r1m
            ELSE 0
        END AS post_ret
    FROM funding_events f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.event_ts - INTERVAL '60 minutes'
                   AND f.event_ts + INTERVAL '180 minutes'
),
car_series AS (
    SELECT
        symbol,
        event_ts,
        ts,
        -- Cumulative sum of post-event returns
        SUM(post_ret) OVER (
            PARTITION BY symbol, event_ts
            ORDER BY ts
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS car
    FROM returns_window
)
SELECT
    symbol,
    event_ts,
    MIN(car) AS min_car,
    MAX(car) AS max_car
FROM car_series
GROUP BY symbol, event_ts
ORDER BY event_ts;

-- Query 2: Funding rate deciles vs 60-minute price drift
-- Tests if higher funding rates predict stronger price movements
-- Divides funding rates into 10 buckets per day and measures subsequent returns
WITH funding_with_decile AS (
    SELECT
        symbol,
        ts,
        rate,
        -- Classify each funding rate into deciles within its day
        NTILE(10) OVER (
            PARTITION BY DATE(ts)
            ORDER BY rate
        ) AS rate_decile
    FROM funding
    WHERE ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
),
event_markouts AS (
    SELECT
        f.symbol,
        f.ts,
        f.rate_decile,
        -- Sum returns in the 60 minutes following the funding event
        SUM(mr.r1m) AS markout_60m
    FROM funding_with_decile f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts > f.ts
     AND mr.ts <= f.ts + INTERVAL '60 minutes'
    GROUP BY f.symbol, f.ts, f.rate_decile
)
SELECT
    rate_decile,
    AVG(markout_60m) AS avg_markout_60m,
    COUNT(*)         AS n_events
FROM event_markouts
GROUP BY rate_decile
ORDER BY rate_decile;

-- Query 3: Extreme regime detection
-- Identifies periods of high funding pressure AND high open interest
-- These "extreme regimes" may signal major market turning points
WITH daily_rate_stats AS (
    SELECT
        symbol,
        DATE(ts) AS d,
        -- Calculate 90th percentile of absolute funding rate per day
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ABS(rate)) AS p90_abs_rate
    FROM funding
    WHERE ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY symbol, DATE(ts)
),
rolling_oi_stats AS (
    SELECT
        oi1.symbol,
        oi1.ts,
        oi1.oi,
        -- Calculate rolling 14-day 90th percentile of OI
        (
            SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY oi2.oi)
            FROM open_interest oi2
            WHERE oi2.symbol = oi1.symbol
              AND oi2.ts BETWEEN oi1.ts - INTERVAL '14 days' AND oi1.ts
        ) AS p90_oi_14d
    FROM open_interest oi1
    WHERE oi1.ts BETWEEN '2023-12-18 00:00:00' AND '2024-01-31 23:59:59'
),
regime_events AS (
    -- Find events where BOTH metrics exceed their 90th percentiles
    SELECT
        f.symbol,
        f.ts
    FROM funding f
    JOIN daily_rate_stats dr
      ON dr.symbol = f.symbol
     AND dr.d = DATE(f.ts)
    JOIN rolling_oi_stats oi
      ON oi.symbol = f.symbol
     AND oi.ts = f.ts
    WHERE ABS(f.rate) > dr.p90_abs_rate
      AND oi.oi > oi.p90_oi_14d
),
event_markouts AS (
    SELECT
        r.symbol,
        r.ts,
        SUM(mr.r1m) AS markout_60m
    FROM regime_events r
    JOIN minute_returns mr
      ON mr.symbol = r.symbol
     AND mr.ts > r.ts
     AND mr.ts <= r.ts + INTERVAL '60 minutes'
    GROUP BY r.symbol, r.ts
)
SELECT
    symbol,
    AVG(markout_60m) AS avg_markout_60m,
    COUNT(*)         AS n_events
FROM event_markouts
GROUP BY symbol
HAVING COUNT(*) >= 5          -- minimum number of regime events
ORDER BY avg_markout_60m DESC
LIMIT 10;

-- Query 4: Low-volatility safe symbols
WITH funding_rv AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_1d
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts - INTERVAL '1 day'
                   AND f.ts
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts
),
median_rv AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rv_1d) AS med_rv
    FROM funding_rv
)
SELECT DISTINCT fr.symbol
FROM funding_rv fr,
     median_rv m
WHERE NOT EXISTS (
    SELECT 1
    FROM minute_returns mr
    WHERE mr.symbol = fr.symbol
      AND mr.ts > fr.ts
      AND mr.ts <= fr.ts + INTERVAL '30 minutes'
      AND mr.r1m < 0                -- negative markout
      AND fr.rv_1d < m.med_rv       -- low-vol regime
)
ORDER BY fr.symbol;

-- Query 5: Hour-of-day markout analysis
WITH event_markouts AS (
    SELECT
        f.symbol,
        f.ts,
        SUM(mr.r1m) AS markout_60m
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts > f.ts
     AND mr.ts <= f.ts + INTERVAL '60 minutes'
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts
)
SELECT
    EXTRACT(HOUR FROM ts) AS funding_hour,
    AVG(markout_60m)      AS avg_markout_60m,
    COUNT(*)              AS n_events
FROM event_markouts
GROUP BY funding_hour
ORDER BY funding_hour;

-- Query 6: Volatility regime conditioning
WITH event_vol AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_1h
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts - INTERVAL '1 hour' AND f.ts
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts
),
event_vol_regimes AS (
    SELECT
        symbol,
        ts,
        rv_1h,
        NTILE(3) OVER (ORDER BY rv_1h) AS vol_regime   -- 1=low, 3=high
    FROM event_vol
),
event_markouts AS (
    SELECT
        f.symbol,
        f.ts,
        evr.vol_regime,
        SUM(mr.r1m) AS markout_60m
    FROM funding f
    JOIN event_vol_regimes evr
      ON evr.symbol = f.symbol AND evr.ts = f.ts
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts > f.ts
     AND mr.ts <= f.ts + INTERVAL '60 minutes'
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts, evr.vol_regime
)
SELECT
    vol_regime,
    AVG(markout_60m) AS avg_markout_60m,
    COUNT(*)         AS n_events
FROM event_markouts
GROUP BY vol_regime
ORDER BY vol_regime;

-- Query 7: Symbol overview and liquidity stats
SELECT
    s.symbol,
    COUNT(DISTINCT k.open_time) AS n_klines,
    COUNT(DISTINCT f.ts)        AS n_funding_events,
    AVG(k.volume)               AS avg_kline_volume
FROM symbols s
LEFT JOIN klines k
  ON k.symbol = s.symbol
LEFT JOIN funding f
  ON f.symbol = s.symbol
WHERE k.open_time BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
GROUP BY s.symbol
ORDER BY s.symbol;

-- Query 8: Rank symbols by funding pressure
SELECT
    symbol,
    AVG(ABS(rate)) AS avg_abs_rate,
    COUNT(*)       AS n_events
FROM funding
WHERE ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
GROUP BY symbol
HAVING COUNT(*) >= 10           -- minimum # of funding prints
ORDER BY avg_abs_rate DESC
LIMIT 10;

-- Query 9: Average post-event volatility by symbol
WITH event_rv AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_30m
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts AND f.ts + INTERVAL '30 minutes'
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts
)
SELECT
    symbol,
    AVG(rv_30m) AS avg_rv_30m,
    COUNT(*)    AS n_events
FROM event_rv
GROUP BY symbol
ORDER BY avg_rv_30m DESC;

-- Query 10: Positive price moves by symbol
WITH event_car AS (
    SELECT
        f.symbol,
        f.ts,
        SUM(mr.r1m) AS car_30m
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts > f.ts
     AND mr.ts <= f.ts + INTERVAL '30 minutes'
    WHERE f.ts BETWEEN '2024-01-01 00:00:00' AND '2024-01-31 23:59:59'
    GROUP BY f.symbol, f.ts
)
SELECT
    symbol,
    COUNT(*) AS n_positive_moves
FROM event_car
WHERE car_30m > 0.0
GROUP BY symbol
ORDER BY n_positive_moves DESC;
