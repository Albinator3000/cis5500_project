------------------------------------------------------------
-- Milestone 3 Queries
-- Assumes:
--   symbols, klines, funding, open_interest tables
--   minute_returns view (symbol, ts, r1m, rv_30m)
-- Data range: 2024-01-01 to 2024-01-31 UTC
------------------------------------------------------------

------------------------------------------------------------
-- Query 1 (Complex):
-- Cumulative return around each funding event in [-60, +180] minutes,
-- with CAR starting at event_ts (pre-event returns don't accumulate).
------------------------------------------------------------
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

------------------------------------------------------------
-- Query 2 (Complex):
-- Funding rate deciles by day vs 60-minute post-event return
------------------------------------------------------------
WITH funding_with_decile AS (
    SELECT
        symbol,
        ts,
        rate,
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
