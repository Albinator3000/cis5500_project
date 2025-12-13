SET search_path TO public;

-- View that calculates 1-minute log returns and rolling volatility
-- This is used extensively throughout the analysis queries
DROP VIEW IF EXISTS minute_returns;

CREATE OR REPLACE VIEW minute_returns AS
WITH returns AS (
    SELECT
        symbol,
        open_time AS ts,
        -- Log return: ln(P_t / P_{t-1})
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
    -- Rolling 30-minute realized volatility (standard deviation of returns)
    stddev_samp(r1m) OVER (
        PARTITION BY symbol
        ORDER BY ts
        ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
    ) AS rv_30m
FROM returns;

