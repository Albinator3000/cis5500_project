from datetime import datetime
from typing import Any, Dict, List

import os

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time

from auth import (
    create_access_token,
    verify_token,
    verify_google_token,
    get_github_user
)

DB_HOST = os.getenv("DB_HOST", "cis550-project-db.c1am6gascgf2.us-east-1.rds.amazonaws.com")
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


def run_query_timed(sql: str, params: tuple) -> tuple[List[Dict[str, Any]], float]:
    """Run query and return results with execution time in ms."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            start = time.time()
            cur.execute(sql, params)
            rows = cur.fetchall()
            elapsed_ms = (time.time() - start) * 1000
        return [dict(r) for r in rows], elapsed_ms
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
    finally:
        conn.close()


app = FastAPI(title="Funding-Aware Market Maker API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)
    if FRONTEND_URL.endswith("/"):
        allowed_origins.append(FRONTEND_URL.rstrip("/"))
    else:
        allowed_origins.append(FRONTEND_URL + "/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


class GoogleAuthRequest(BaseModel):
    token: str


class GitHubAuthRequest(BaseModel):
    code: str
    redirect_uri: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]


@app.post("/api/auth/google", response_model=AuthResponse)
async def auth_google(request: GoogleAuthRequest):
    """Authenticate with Google OAuth using ID token."""
    user_info = await verify_google_token(request.token)

    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google token"
        )

    access_token = create_access_token(data={"sub": user_info["email"], **user_info})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }


@app.post("/api/auth/github", response_model=AuthResponse)
async def auth_github(request: GitHubAuthRequest):
    """Authenticate with GitHub OAuth using authorization code."""
    user_info = await get_github_user(request.code, request.redirect_uri)

    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Failed to authenticate with GitHub"
        )

    access_token = create_access_token(data={"sub": user_info["email"], **user_info})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }


@app.get("/api/auth/me")
async def get_current_user(user_data: Dict = Depends(verify_token)):
    """Get current user information from JWT token."""
    return {"user": user_data}


@app.get("/api/symbols")
def list_symbols() -> List[Dict[str, Any]]:
    sql = """
        SELECT symbol
        FROM symbols
        ORDER BY symbol;
    """
    return run_query(sql, ())


@app.get("/api/event_car")
def get_event_car(
    symbol: str,
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Return min/max CAR for each funding event using pre-computed view."""
    sql = """
        SELECT
            symbol,
            event_ts,
            MIN(car) AS min_car,
            MAX(car) AS max_car
        FROM mv_event_car
        WHERE symbol = %s
          AND event_ts BETWEEN %s AND %s
        GROUP BY symbol, event_ts
        ORDER BY event_ts;
    """
    return run_query(sql, (symbol, start_ts, end_ts))


@app.get("/api/funding_deciles")
def get_funding_deciles(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Analyze funding rate deciles vs 60-minute markouts."""
    sql = """
        SELECT
            fd.rate_decile,
            AVG(em.markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_funding_deciles fd
        JOIN mv_event_markouts em
          ON em.symbol = fd.symbol
         AND em.event_ts = fd.ts
        WHERE fd.ts BETWEEN %s AND %s
        GROUP BY fd.rate_decile
        ORDER BY fd.rate_decile;
    """
    return run_query(sql, (start_ts, end_ts))


@app.get("/api/extreme_regimes")
def get_extreme_regimes(
    start_ts: datetime,
    end_ts: datetime,
    min_events: int = 5,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Identify symbols with extreme funding regimes."""
    sql = """
        WITH regime_events AS (
            SELECT
                f.symbol,
                f.ts
            FROM funding f
            JOIN mv_daily_rate_stats dr
              ON dr.symbol = f.symbol
             AND dr.d = DATE(f.ts)
            JOIN mv_rolling_oi_stats oi
              ON oi.symbol = f.symbol
             AND oi.ts = f.ts
            WHERE f.ts BETWEEN %s AND %s
              AND ABS(f.rate) > dr.p90_abs_rate
              AND oi.oi > oi.p90_oi_14d
        )
        SELECT
            r.symbol,
            AVG(em.markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM regime_events r
        JOIN mv_event_markouts em
          ON em.symbol = r.symbol
         AND em.event_ts = r.ts
        GROUP BY r.symbol
        HAVING COUNT(*) >= %s
        ORDER BY avg_markout_60m DESC
        LIMIT %s;
    """
    return run_query(sql, (start_ts, end_ts, min_events, top_k))


@app.get("/api/low_vol_safe_symbols")
def get_low_vol_safe_symbols(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Find symbols with no negative CAR during low volatility."""
    sql = """
        WITH median_rv AS (
            SELECT
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rv_1d) AS med_rv
            FROM mv_event_volatility
            WHERE ts BETWEEN %s AND %s
        )
        SELECT DISTINCT ev.symbol
        FROM mv_event_volatility ev,
             median_rv m
        WHERE ev.ts BETWEEN %s AND %s
          AND NOT EXISTS (
            SELECT 1
            FROM minute_returns mr
            WHERE mr.symbol = ev.symbol
              AND mr.ts > ev.ts
              AND mr.ts <= ev.ts + INTERVAL '30 minutes'
              AND mr.r1m < 0
              AND ev.rv_1d < m.med_rv
        )
        ORDER BY ev.symbol;
    """
    return run_query(sql, (start_ts, end_ts, start_ts, end_ts))


@app.get("/api/hourly_markouts")
def get_hourly_markouts(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Analyze average 60-minute markouts by hour of day."""
    sql = """
        SELECT
            EXTRACT(HOUR FROM event_ts) AS funding_hour,
            AVG(markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_event_markouts
        WHERE event_ts BETWEEN %s AND %s
        GROUP BY funding_hour
        ORDER BY funding_hour;
    """
    return run_query(sql, (start_ts, end_ts))


@app.get("/api/vol_regime_markouts")
def get_vol_regime_markouts(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Analyze markouts by volatility regime."""
    sql = """
        SELECT
            ev.vol_regime,
            AVG(em.markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_event_volatility ev
        JOIN mv_event_markouts em
          ON em.symbol = ev.symbol
         AND em.event_ts = ev.ts
        WHERE ev.ts BETWEEN %s AND %s
        GROUP BY ev.vol_regime
        ORDER BY ev.vol_regime;
    """
    return run_query(sql, (start_ts, end_ts))


@app.get("/api/symbol_overview")
def get_symbol_overview(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Get aggregated statistics for all symbols."""
    sql = """
        SELECT
            symbol,
            SUM(n_klines) AS n_klines,
            SUM(n_funding_events) AS n_funding_events,
            AVG(avg_volume) AS avg_kline_volume
        FROM mv_symbol_daily_stats
        WHERE d BETWEEN %s AND %s
        GROUP BY symbol
        ORDER BY symbol;
    """
    return run_query(sql, (start_ts, end_ts))


@app.get("/api/funding_pressure")
def get_funding_pressure(
    start_ts: datetime,
    end_ts: datetime,
    min_events: int = 10,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Rank symbols by average absolute funding rate."""
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


@app.get("/api/post_event_volatility")
def get_post_event_volatility(
    start_ts: datetime,
    end_ts: datetime,
) -> List[Dict[str, Any]]:
    """Average pre-event volatility by symbol."""
    sql = """
        SELECT
            symbol,
            AVG(rv_1h) AS avg_rv_30m,
            COUNT(*) AS n_events
        FROM mv_event_volatility
        WHERE ts BETWEEN %s AND %s
        GROUP BY symbol
        ORDER BY avg_rv_30m DESC;
    """
    return run_query(sql, (start_ts, end_ts))


@app.get("/api/positive_moves")
def get_positive_moves(
    start_ts: datetime,
    end_ts: datetime,
    threshold: float = 0.0,
) -> List[Dict[str, Any]]:
    """Count events where 60-minute markout exceeds threshold."""
    sql = """
        SELECT
            symbol,
            COUNT(*) AS n_positive_moves
        FROM mv_event_markouts
        WHERE event_ts BETWEEN %s AND %s
          AND markout_60m > %s
        GROUP BY symbol
        ORDER BY n_positive_moves DESC;
    """
    return run_query(sql, (start_ts, end_ts, threshold))


@app.get("/api/slow/event_car")
def get_event_car_slow(
    symbol: str,
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Unoptimized event CAR query for performance comparison."""
    sql = """
        WITH all_funding AS (
            SELECT
                symbol,
                ts AS event_ts
            FROM funding
        ),
        all_returns_window AS (
            SELECT
                f.symbol,
                f.event_ts,
                mr.ts,
                mr.r1m,
                CASE
                    WHEN mr.ts >= f.event_ts THEN mr.r1m
                    ELSE 0
                END AS post_ret
            FROM all_funding f
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
            FROM all_returns_window
        )
        SELECT
            symbol,
            event_ts,
            MIN(car) AS min_car,
            MAX(car) AS max_car
        FROM car_series
        WHERE symbol = %s
          AND event_ts BETWEEN %s AND %s
        GROUP BY symbol, event_ts
        ORDER BY event_ts;
    """
    results, elapsed_ms = run_query_timed(sql, (symbol, start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/slow/funding_deciles")
def get_funding_deciles_slow(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Unoptimized funding deciles query for performance comparison."""
    sql = """
        WITH all_funding_with_decile AS (
            SELECT
                symbol,
                ts,
                rate,
                NTILE(10) OVER (
                    PARTITION BY DATE(ts)
                    ORDER BY rate
                ) AS rate_decile
            FROM funding
        ),
        all_event_markouts AS (
            SELECT
                f.symbol,
                f.ts,
                f.rate_decile,
                SUM(mr.r1m) AS markout_60m
            FROM all_funding_with_decile f
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
        FROM all_event_markouts
        WHERE ts BETWEEN %s AND %s
        GROUP BY rate_decile
        ORDER BY rate_decile;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/slow/hourly_markouts")
def get_hourly_markouts_slow(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Unoptimized hourly markouts query for performance comparison."""
    sql = """
        WITH all_event_markouts AS (
            SELECT
                f.symbol,
                f.ts,
                SUM(mr.r1m) AS markout_60m
            FROM funding f
            JOIN minute_returns mr
              ON mr.symbol = f.symbol
             AND mr.ts > f.ts
             AND mr.ts <= f.ts + INTERVAL '60 minutes'
            GROUP BY f.symbol, f.ts
        )
        SELECT
            EXTRACT(HOUR FROM ts) AS funding_hour,
            AVG(markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM all_event_markouts
        WHERE ts BETWEEN %s AND %s
        GROUP BY funding_hour
        ORDER BY funding_hour;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/slow/vol_regime_markouts")
def get_vol_regime_markouts_slow(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Unoptimized volatility regime query for performance comparison."""
    sql = """
        WITH all_event_vol AS (
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
            FROM all_event_vol
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
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts, start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/slow/symbol_overview")
def get_symbol_overview_slow(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Unoptimized symbol overview query for performance comparison."""
    sql = """
        WITH all_klines AS (
            SELECT
                symbol,
                open_time,
                volume
            FROM klines
        ),
        all_funding AS (
            SELECT
                symbol,
                ts
            FROM funding
        )
        SELECT
            s.symbol,
            COUNT(DISTINCT k.open_time) AS n_klines,
            COUNT(DISTINCT f.ts) AS n_funding_events,
            AVG(k.volume) AS avg_kline_volume
        FROM symbols s
        LEFT JOIN all_klines k
          ON k.symbol = s.symbol
        LEFT JOIN all_funding f
          ON f.symbol = s.symbol
        WHERE k.open_time BETWEEN %s AND %s
        GROUP BY s.symbol
        ORDER BY s.symbol;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/fast/event_car")
def get_event_car_fast_timed(
    symbol: str,
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Fast event CAR with timing."""
    sql = """
        SELECT
            symbol,
            event_ts,
            MIN(car) AS min_car,
            MAX(car) AS max_car
        FROM mv_event_car
        WHERE symbol = %s
          AND event_ts BETWEEN %s AND %s
        GROUP BY symbol, event_ts
        ORDER BY event_ts;
    """
    results, elapsed_ms = run_query_timed(sql, (symbol, start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/fast/funding_deciles")
def get_funding_deciles_fast_timed(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Fast funding deciles with timing."""
    sql = """
        SELECT
            fd.rate_decile,
            AVG(em.markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_funding_deciles fd
        JOIN mv_event_markouts em
          ON em.symbol = fd.symbol
         AND em.event_ts = fd.ts
        WHERE fd.ts BETWEEN %s AND %s
        GROUP BY fd.rate_decile
        ORDER BY fd.rate_decile;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/fast/hourly_markouts")
def get_hourly_markouts_fast_timed(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Fast hourly markouts with timing."""
    sql = """
        SELECT
            EXTRACT(HOUR FROM event_ts) AS funding_hour,
            AVG(markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_event_markouts
        WHERE event_ts BETWEEN %s AND %s
        GROUP BY funding_hour
        ORDER BY funding_hour;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/fast/vol_regime_markouts")
def get_vol_regime_markouts_fast_timed(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Fast volatility regime markouts with timing."""
    sql = """
        SELECT
            ev.vol_regime,
            AVG(em.markout_60m) AS avg_markout_60m,
            COUNT(*) AS n_events
        FROM mv_event_volatility ev
        JOIN mv_event_markouts em
          ON em.symbol = ev.symbol
         AND em.event_ts = ev.ts
        WHERE ev.ts BETWEEN %s AND %s
        GROUP BY ev.vol_regime
        ORDER BY ev.vol_regime;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}


@app.get("/api/fast/symbol_overview")
def get_symbol_overview_fast_timed(
    start_ts: datetime,
    end_ts: datetime,
) -> Dict[str, Any]:
    """Fast symbol overview with timing."""
    sql = """
        SELECT
            symbol,
            SUM(n_klines) AS n_klines,
            SUM(n_funding_events) AS n_funding_events,
            AVG(avg_volume) AS avg_kline_volume
        FROM mv_symbol_daily_stats
        WHERE d BETWEEN %s AND %s
        GROUP BY symbol
        ORDER BY symbol;
    """
    results, elapsed_ms = run_query_timed(sql, (start_ts, end_ts))
    return {"results": results, "execution_time_ms": elapsed_ms}
