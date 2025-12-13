SET search_path TO public;

DROP VIEW IF EXISTS minute_returns;

CREATE OR REPLACE VIEW minute_returns AS
WITH returns AS (
    SELECT
        symbol,
        open_time AS ts,
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
    stddev_samp(r1m) OVER (
        PARTITION BY symbol
        ORDER BY ts
        ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
    ) AS rv_30m
FROM returns;

