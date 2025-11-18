SET search_path TO public;

------------------------------------------------------------
-- minute_returns: 1m log returns + 30m rolling RV
------------------------------------------------------------

DROP VIEW IF EXISTS minute_returns;

CREATE OR REPLACE VIEW minute_returns AS
WITH returns AS (
    SELECT
        symbol,
        open_time AS ts,
        -- 1-minute log return
        ln(close_price) - ln(
            lag(close_price) OVER (
                PARTITION BY symbol
                ORDER BY open_time
            )
        ) AS r1m
    FROM klines
)
SELECT
    symbol,
    ts,
    r1m,
    -- rolling 30-minute realized volatility of 1m log returns
    stddev_samp(r1m) OVER (
        PARTITION BY symbol
        ORDER BY ts
        ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
    ) AS rv_30m
FROM returns;

