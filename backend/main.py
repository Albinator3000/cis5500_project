from datetime import datetime
from typing import Any, Dict, List

import os

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# -------------------------------------------------------------------
# DB CONFIG – update these to match your RDS instance
# (you can also pull them from a .env file or your environment)
# -------------------------------------------------------------------
DB_HOST = os.getenv("DB_HOST", "cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "cis550_project")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "m2wurbpn")


def get_conn():
    try:
        return psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")


def run_query(sql: str, params: tuple) -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
    finally:
        conn.close()


app = FastAPI(title="Funding-Aware Market Maker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}


# -------------------------------------------------------------------
# Helper: list symbols (for dropdowns etc.)
# -------------------------------------------------------------------
@app.get("/api/symbols")
def list_symbols() -> List[Dict[str, Any]]:
    sql = """
        SELECT symbol
        FROM symbols
        ORDER BY symbol;
    """
    return run_query(sql, ())


# -------------------------------------------------------------------
# Query 1 – Event CAR around funding events (Event Study Explorer)
# -------------------------------------------------------------------
@app.get("/api/event_car")
def get_event_car(
    symbol: str,
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """
    For each funding event of `symbol` in [start_ts, end_ts],
    return the min/max cumulative return in [-60, +180] minutes.
    """
    sql = """
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
    return run_query(sql, (symbol, start_ts, end_ts))


# -------------------------------------------------------------------
# Query 2 – Funding rate deciles vs 60m post-event drift
# (nice for Regime Screener)
# -------------------------------------------------------------------
@app.get("/api/funding_deciles")
def get_funding_deciles(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts))


# -------------------------------------------------------------------
# Query 3 – Stress regimes: high |funding| and high OI
# -------------------------------------------------------------------
@app.get("/api/regime_stress")
def get_regime_stress(
    start_ts: datetime,
    end_ts: datetime,
    min_events: int = 10,
    top_k: int = 20,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts, start_ts, end_ts, min_events, top_k))


# -------------------------------------------------------------------
# Query 4 – Symbols that never have negative 30m CAR in low-vol regimes
# -------------------------------------------------------------------
@app.get("/api/never_negative_lowvol")
def get_never_negative_lowvol(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts))


# -------------------------------------------------------------------
# Query 5 – Hour-of-day markouts
# -------------------------------------------------------------------
@app.get("/api/hourly_markouts")
def get_hourly_markouts(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts))


# -------------------------------------------------------------------
# Query 6 – Markouts by short-term volatility regime (1h pre)
# -------------------------------------------------------------------
@app.get("/api/vol_regime_markouts")
def get_vol_regime_markouts(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
              ON evr.symbol = f.symbol AND evr.ts = f.ts
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
    return run_query(sql, (start_ts, end_ts, start_ts, end_ts))


# -------------------------------------------------------------------
# Query 7 – Symbol overview (for Data Admin page)
# -------------------------------------------------------------------
@app.get("/api/symbol_overview")
def get_symbol_overview(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts))


# -------------------------------------------------------------------
# Query 8 – Top symbols by average |funding rate|
# -------------------------------------------------------------------
@app.get("/api/top_funding_pressure")
def get_top_funding_pressure(
    start_ts: datetime,
    end_ts: datetime,
    min_events: int = 50,
    top_k: int = 20,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts, min_events, top_k))


# -------------------------------------------------------------------
# Query 9 – Average 30m realized volatility after funding
# -------------------------------------------------------------------
@app.get("/api/post_event_volatility")
def get_post_event_volatility(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts))


# -------------------------------------------------------------------
# Query 10 – Count events where 30m CAR exceeds a threshold
# -------------------------------------------------------------------
@app.get("/api/positive_moves")
def get_positive_moves(
    start_ts: datetime,
    end_ts: datetime,
    car_threshold: float = 0.01,
) -> List[Dict[str, Any]]:
    sql = """
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
    return run_query(sql, (start_ts, end_ts, car_threshold))
