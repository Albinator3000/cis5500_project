import os
import csv
from datetime import datetime, timedelta
import random

# Configuration for synthetic data generation
SYMBOLS = ["BTCUSDT", "ETHUSDT"]
START = datetime(2024, 1, 1, 0, 0, 0)
END = datetime(2024, 3, 31, 23, 59, 0)
FUNDING_INTERVAL_HOURS = 8  # Typical funding rate interval for perpetual futures
OI_INTERVAL_MINUTES = 5
PREMIUM_INTERVAL_MINUTES = 5

HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, "synthetic")
os.makedirs(OUT_DIR, exist_ok=True)


def drange(start, end, delta):
    """Generate datetimes from start to end with step delta."""
    t = start
    while t <= end:
        yield t
        t += delta


def generate_funding_rows():
    """Generate synthetic funding rates for all symbols."""
    rows = []
    for sym in SYMBOLS:
        # Add small bias to simulate directional funding pressure
        bias = random.uniform(-0.00002, 0.00002)
        for ts in drange(START, END, timedelta(hours=FUNDING_INTERVAL_HOURS)):
            # Generate rates with realistic variance (~1.5 basis points)
            rate = bias + random.gauss(0.0, 0.00015)
            rows.append((sym, ts, rate))
    return rows


def generate_open_interest_rows(funding_rows):
    """Generate synthetic open interest with boosted values at funding timestamps."""
    rows = []

    # Realistic base OI levels for each symbol
    base_levels = {
        "BTCUSDT": 100_000.0,
        "ETHUSDT": 60_000.0,
    }

    # Generate OI time series with random walk
    for sym in SYMBOLS:
        level = base_levels.get(sym, 50_000.0)
        for ts in drange(START, END, timedelta(minutes=OI_INTERVAL_MINUTES)):
            # Random walk with small volatility
            level += random.gauss(0.0, level * 0.0005)
            # Keep OI within reasonable bounds
            level = max(1_000.0, min(level, 2_000_000.0))
            rows.append((sym, ts, level))

    # Boost OI at funding timestamps to create regime events
    funding_ts_by_symbol = {}
    for sym, ts, _rate in funding_rows:
        funding_ts_by_symbol.setdefault(sym, set()).add(ts)

    boosted_rows = []
    for (sym, ts, oi) in rows:
        # Increase OI by 5-20% during funding events
        if ts in funding_ts_by_symbol.get(sym, set()):
            oi *= random.uniform(1.05, 1.20)
        boosted_rows.append((sym, ts, oi))

    return boosted_rows


def generate_premium_index_rows():
    """Generate synthetic premium index OHLC data."""
    rows = []
    for sym in SYMBOLS:
        level = random.uniform(-0.005, 0.005)
        for ts in drange(START, END, timedelta(minutes=PREMIUM_INTERVAL_MINUTES)):
            # Generate OHLC bars with realistic spread
            close_val = level + random.gauss(0.0, 0.0005)
            high_val = close_val + abs(random.gauss(0.0, 0.0003))
            low_val = close_val - abs(random.gauss(0.0, 0.0003))
            open_val = (high_val + low_val) / 2.0

            # Clamp values to [-5%, +5%] range
            for_val = lambda x: max(-0.05, min(0.05, x))
            open_val = for_val(open_val)
            high_val = for_val(high_val)
            low_val = for_val(low_val)
            close_val = for_val(close_val)

            rows.append((sym, ts, open_val, high_val, low_val, close_val))
            # Carry close as next level for drift
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


def main():
    print("Generating synthetic funding/open_interest/premium_index data...")
    print(f"Symbols: {SYMBOLS}")
    print(f"Date range: {START} to {END}")
    print(f"Output directory: {OUT_DIR}")

    funding_rows = generate_funding_rows()
    funding_path = os.path.join(OUT_DIR, "funding_synth.csv")
    write_csv(
        funding_path,
        header=["symbol", "ts", "rate"],
        rows=funding_rows,
    )
    print(f"Wrote funding CSV: {funding_path} (rows: {len(funding_rows)})")

    oi_rows = generate_open_interest_rows(funding_rows)
    oi_path = os.path.join(OUT_DIR, "open_interest_synth.csv")
    write_csv(
        oi_path,
        header=["symbol", "ts", "oi"],
        rows=oi_rows,
    )
    print(f"Wrote open_interest CSV: {oi_path} (rows: {len(oi_rows)})")

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

