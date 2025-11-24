import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
from dateutil import parser as date_parser

# -----------------------------
# DB CONFIG (use env variables)
# -----------------------------

PGHOST = os.getenv("PGHOST", "cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com")
PGPORT = int(os.getenv("PGPORT", "5432"))
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "m2wurbpn")  # or override in env
PGDATABASE = os.getenv("PGDATABASE", "cis550_project")  # note the space

def get_connection():
    try:
        conn = psycopg2.connect(
            host=PGHOST,
            port=PGPORT,
            user=PGUSER,
            password=PGPASSWORD,
            dbname=PGDATABASE,
            cursor_factory=RealDictCursor,
        )
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")

# -----------------------------
# FASTAPI APP
# -----------------------------

app = FastAPI(title="Funding-Aware Market Maker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if desired
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_ts(s: str) -> datetime:
    try:
        return date_parser.isoparse(s)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid timestamp format: {s}")


def run_query(sql: str, params: tuple) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    finally:
        conn.close()

# -----------------------------
# HEALTHCHECK
# -----------------------------

@app.get("/health")
def health():
    return {"status": "ok"}

# =====================================================
# QUERY 1 (Complex): Cumulative return around funding
# =====================================================

QUERY_1 = """
WITH funding_events AS (
    SELECT
        symbol,
        ts AS event_ts
    FROM funding
    WHERE symbol = %s
      AND ts BETWEEN %s AND %s
),
window_returns AS (
    SELECT
        f.symbol,
        f.event_ts,
        mr.ts,
        SUM(mr.r1m) OVER (
            PARTITION BY f.symbol, f.event_ts
            ORDER BY mr.ts
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cum_return
    FROM funding_events f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.event_ts - INTERVAL '60 minutes'
                  AND f.event_ts + INTERVAL '180 minutes'
)
SELECT
    symbol,
    event_ts,
    MIN(cum_return) AS min_car,
    MAX(cum_return) AS max_car
FROM window_returns
GROUP BY symbol, event_ts
ORDER BY event_ts;
"""

@app.get("/api/event_car")
def get_event_car(
    symbol: str = Query(..., description="Symbol, e.g. BTCUSDT"),
    start_ts: str = Query(..., description="ISO-8601 start timestamp"),
    end_ts: str = Query(..., description="ISO-8601 end timestamp"),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_1, (symbol, start, end))
    return rows

# =====================================================
# QUERY 2 (Complex): Funding deciles vs 60m markout
# =====================================================

QUERY_2 = """
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
    WHERE ts BETWEEN %s AND %s
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
    COUNT(*) AS n_events
FROM event_markouts
GROUP BY rate_decile
ORDER BY rate_decile;
"""

@app.get("/api/funding_deciles")
def get_funding_deciles(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_2, (start, end))
    return rows

# =====================================================
# QUERY 3 (Complex): Extreme regime (funding > p90 & OI > 14d p90)
# =====================================================

QUERY_3 = """
WITH daily_rate_stats AS (
    SELECT
        symbol,
        DATE(ts) AS d,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ABS(rate)) AS p90_abs_rate
    FROM funding
    WHERE ts BETWEEN %s AND %s
    GROUP BY symbol, DATE(ts)
),
rolling_oi_stats AS (
    SELECT
        symbol,
        ts,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY oi) OVER (
            PARTITION BY symbol
            ORDER BY ts
            RANGE BETWEEN INTERVAL '14 days' PRECEDING AND CURRENT ROW
        ) AS p90_oi_14d
    FROM open_interest
    WHERE ts BETWEEN %s - INTERVAL '14 days' AND %s
),
regime_events AS (
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
    COUNT(*) AS n_events
FROM event_markouts
GROUP BY symbol
HAVING COUNT(*) >= %s
ORDER BY avg_markout_60m DESC
LIMIT %s;
"""

@app.get("/api/extreme_regimes")
def get_extreme_regimes(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
    min_regime_events: int = Query(5, ge=1),
    top_k: int = Query(10, ge=1),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    params = (start, end, start, end, min_regime_events, top_k)
    rows = run_query(QUERY_3, params)
    return rows

# =====================================================
# QUERY 4 (Complex): Symbols never negative in low-vol regimes
# =====================================================

QUERY_4 = """
WITH funding_rv AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_1d
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts - INTERVAL '1 day' AND f.ts
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts
),
median_rv AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rv_1d) AS med_rv
    FROM funding_rv
)
SELECT DISTINCT fr.symbol
FROM funding_rv fr, median_rv m
WHERE NOT EXISTS (
    SELECT 1
    FROM minute_returns mr
    WHERE mr.symbol = fr.symbol
      AND mr.ts > fr.ts
      AND mr.ts <= fr.ts + INTERVAL '30 minutes'
      AND mr.r1m < 0
      AND fr.rv_1d < m.med_rv
)
ORDER BY fr.symbol;
"""

@app.get("/api/never_negative_lowvol")
def get_never_negative_lowvol(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_4, (start, end))
    return rows

# =====================================================
# QUERY 5: Avg 60m markout by hour-of-day
# =====================================================

QUERY_5 = """
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
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts
)
SELECT
    EXTRACT(HOUR FROM ts) AS funding_hour,
    AVG(markout_60m) AS avg_markout_60m,
    COUNT(*) AS n_events
FROM event_markouts
GROUP BY funding_hour
ORDER BY funding_hour;
"""

@app.get("/api/hourly_markouts")
def get_hourly_markouts(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_5, (start, end))
    return rows

# =====================================================
# QUERY 6: Markouts by short-term vol regime
# =====================================================

QUERY_6 = """
WITH event_vol AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_1h
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts - INTERVAL '1 hour' AND f.ts
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts
),
event_vol_regimes AS (
    SELECT
        symbol,
        ts,
        rv_1h,
        NTILE(3) OVER (ORDER BY rv_1h) AS vol_regime
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
      ON evr.symbol = f.symbol
     AND evr.ts = f.ts
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts > f.ts
     AND mr.ts <= f.ts + INTERVAL '60 minutes'
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts, evr.vol_regime
)
SELECT
    vol_regime,
    AVG(markout_60m) AS avg_markout_60m,
    COUNT(*) AS n_events
FROM event_markouts
GROUP BY vol_regime
ORDER BY vol_regime;
"""

@app.get("/api/vol_regimes")
def get_vol_regimes(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    params = (start, end, start, end)
    rows = run_query(QUERY_6, params)
    return rows

# =====================================================
# QUERY 7: Symbol overview
# =====================================================

QUERY_7 = """
SELECT
    s.symbol,
    COUNT(DISTINCT k.open_time) AS n_klines,
    COUNT(DISTINCT f.ts) AS n_funding_events,
    AVG(k.volume) AS avg_kline_volume
FROM symbols s
LEFT JOIN klines k
  ON k.symbol = s.symbol
LEFT JOIN funding f
  ON f.symbol = s.symbol
WHERE k.open_time BETWEEN %s AND %s
GROUP BY s.symbol
ORDER BY s.symbol;
"""

@app.get("/api/symbol_overview")
def get_symbol_overview(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_7, (start, end))
    return rows

# =====================================================
# QUERY 8: Rank symbols by avg |funding|
# =====================================================

QUERY_8 = """
SELECT
    symbol,
    AVG(ABS(rate)) AS avg_abs_rate,
    COUNT(*) AS n_events
FROM funding
WHERE ts BETWEEN %s AND %s
GROUP BY symbol
HAVING COUNT(*) >= %s
ORDER BY avg_abs_rate DESC
LIMIT %s;
"""

@app.get("/api/avg_abs_funding")
def get_avg_abs_funding(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
    min_events: int = Query(10, ge=1),
    top_k: int = Query(10, ge=1),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_8, (start, end, min_events, top_k))
    return rows

# =====================================================
# QUERY 9: Avg 30m RV after funding
# =====================================================

QUERY_9 = """
WITH event_rv AS (
    SELECT
        f.symbol,
        f.ts,
        STDDEV_SAMP(mr.r1m) AS rv_30m
    FROM funding f
    JOIN minute_returns mr
      ON mr.symbol = f.symbol
     AND mr.ts BETWEEN f.ts AND f.ts + INTERVAL '30 minutes'
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts
)
SELECT
    symbol,
    AVG(rv_30m) AS avg_rv_30m,
    COUNT(*) AS n_events
FROM event_rv
GROUP BY symbol
ORDER BY avg_rv_30m DESC;
"""

@app.get("/api/avg_rv_30m")
def get_avg_rv_30m(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_9, (start, end))
    return rows

# =====================================================
# QUERY 10: Count events with CAR_30m > threshold
# =====================================================

QUERY_10 = """
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
    WHERE f.ts BETWEEN %s AND %s
    GROUP BY f.symbol, f.ts
)
SELECT
    symbol,
    COUNT(*) AS n_positive_moves
FROM event_car
WHERE car_30m > %s
GROUP BY symbol
ORDER BY n_positive_moves DESC;
"""

@app.get("/api/positive_moves")
def get_positive_moves(
    start_ts: str = Query(...),
    end_ts: str = Query(...),
    car_threshold: float = Query(0.0),
):
    start = parse_ts(start_ts)
    end = parse_ts(end_ts)
    rows = run_query(QUERY_10, (start, end, car_threshold))
    return rows
