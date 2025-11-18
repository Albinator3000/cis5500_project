import os
import csv
from datetime import datetime, timedelta
import random

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------

SYMBOLS = ["BTCUSDT", "ETHUSDT"]

# Time Range
START = datetime(2024, 1, 1, 0, 0, 0)
END   = datetime(2024, 3, 31, 23, 59, 0)

# Funding every 8 hours
FUNDING_INTERVAL_HOURS = 8

# Open interest snapshot interval
OI_INTERVAL_MINUTES = 5

# Premium index
PREMIUM_INTERVAL_MINUTES = 5

# Save CSVs here
HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, "synthetic")
os.makedirs(OUT_DIR, exist_ok=True)


# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------

def drange(start, end, delta):
    """Yield datetimes from start to end (inclusive) with step delta."""
    t = start
    while t <= end:
        yield t
        t += delta


def generate_funding_rows():
    """
    Generate synthetic funding data:
      funding(symbol, ts, rate)
    - ts: every 8 hours from START to END
    - rate: small random values around 0 (e.g. -0.05% to +0.05%)
    """
    rows = []
    for sym in SYMBOLS:
        bias = random.uniform(-0.00002, 0.00002)  # +/- 2 bps
        for ts in drange(START, END, timedelta(hours=FUNDING_INTERVAL_HOURS)):
            rate = bias + random.gauss(0.0, 0.00015)  # ~ N(0, 1.5 bps)
            rows.append((sym, ts, rate))
    return rows


def generate_open_interest_rows(funding_rows):
    """
    Generate synthetic open interest data:
      open_interest(symbol, ts, oi)

    To make your complex query (Funding x OI regimes) easy to satisfy,
    we ensure **there is an OI row exactly at each funding timestamp**.

    We also add extra 5-minute snapshots in between to make rolling
    14d distributions non-degenerate.
    """
    rows = []

    base_levels = {
        "BTCUSDT": 100_000.0,
        "ETHUSDT": 60_000.0,
    }

    for sym in SYMBOLS:
        level = base_levels.get(sym, 50_000.0)
        for ts in drange(START, END, timedelta(minutes=OI_INTERVAL_MINUTES)):
            # small random walk
            level += random.gauss(0.0, level * 0.0005)
            # keep it positive and not absurd
            level = max(1_000.0, min(level, 2_000_000.0))
            rows.append((sym, ts, level))

    # 2) Ensure exact matches at funding timestamps
    #    (by slightly boosting OI at those times)
    funding_ts_by_symbol = {}
    for sym, ts, _rate in funding_rows:
        funding_ts_by_symbol.setdefault(sym, set()).add(ts)

    boosted_rows = []
    for (sym, ts, oi) in rows:
        if ts in funding_ts_by_symbol.get(sym, set()):
            # boost a bit to create "high OI during funding"
            oi *= random.uniform(1.05, 1.20)
        boosted_rows.append((sym, ts, oi))

    return boosted_rows


def generate_premium_index_rows():
    """
    Generate synthetic premium index data:
      premium_index(symbol, ts, open_val, high_val, low_val, close_val)

    We'll make a toy time series roughly around 0 with small movements,
    sampled every 5 minutes.
    """
    rows = []
    for sym in SYMBOLS:
        level = random.uniform(-0.005, 0.005)  # around 0
        for ts in drange(START, END, timedelta(minutes=PREMIUM_INTERVAL_MINUTES)):
            # OHLC bars constructed around a "close" level
            close_val = level + random.gauss(0.0, 0.0005)
            high_val = close_val + abs(random.gauss(0.0, 0.0003))
            low_val  = close_val - abs(random.gauss(0.0, 0.0003))
            open_val = (high_val + low_val) / 2.0

            for_val = lambda x: max(-0.05, min(0.05, x))  # -5% to +5%
            open_val  = for_val(open_val)
            high_val  = for_val(high_val)
            low_val   = for_val(low_val)
            close_val = for_val(close_val)

            rows.append((sym, ts, open_val, high_val, low_val, close_val))

            # small drift
            level = close_val

    return rows


def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for r in rows:
            out = []
            for v in r:
                if isinstance(v, datetime):
                    out.append(v.isoformat(sep=" "))
                else:
                    out.append(v)
            writer.writerow(out)


# -------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------

def main():
    print("Generating synthetic funding/open_interest/premium_index data...")
    print(f"Symbols: {SYMBOLS}")
    print(f"Date range: {START} to {END}")
    print(f"Output directory: {OUT_DIR}")

    # 1) Funding
    funding_rows = generate_funding_rows()
    funding_path = os.path.join(OUT_DIR, "funding_synth.csv")
    write_csv(
        funding_path,
        header=["symbol", "ts", "rate"],
        rows=funding_rows,
    )
    print(f"Wrote funding CSV: {funding_path} (rows: {len(funding_rows)})")

    # 2) Open interest
    oi_rows = generate_open_interest_rows(funding_rows)
    oi_path = os.path.join(OUT_DIR, "open_interest_synth.csv")
    write_csv(
        oi_path,
        header=["symbol", "ts", "oi"],
        rows=oi_rows,
    )
    print(f"Wrote open_interest CSV: {oi_path} (rows: {len(oi_rows)})")

    # 3) Premium index
    premium_rows = generate_premium_index_rows()
    prem_path = os.path.join(OUT_DIR, "premium_index_synth.csv")
    write_csv(
        prem_path,
        header=["symbol", "ts", "open_val", "high_val", "low_val", "close_val"],
        rows=premium_rows,
    )
    print(f"Wrote premium_index CSV: {prem_path} (rows: {len(premium_rows)})")


if __name__ == "__main__":
    main()

