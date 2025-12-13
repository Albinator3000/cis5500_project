import os
import csv
from datetime import datetime
from dateutil import parser as dateparser

import psycopg2

# Database connection configuration
DB_HOST = "cis550-project-db.c1am6gascgf2.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "cis550_project"
DB_USER = "postgres"
DB_PASSWORD = "m2wurbpn"
SYN_DIR = os.path.join("data", "synthetic")


def _safe_parse_ts(raw_ts, context):
    """Parse timestamp, returning None on failure to allow graceful skipping."""
    try:
        if isinstance(raw_ts, datetime):
            return raw_ts
        return dateparser.parse(str(raw_ts))
    except Exception:
        print(f"[WARN] Skipping row with bad timestamp '{raw_ts}' in {context}")
        return None


def _safe_float(raw_val, context, field_name):
    """Parse float, returning None on failure."""
    try:
        return float(raw_val)
    except Exception:
        print(f"[WARN] Skipping row with bad float '{raw_val}' for {field_name} in {context}")
        return None


def _safe_int(raw_val, context, field_name):
    """Parse integer, returning None on failure."""
    try:
        return int(raw_val)
    except Exception:
        print(f"[WARN] Skipping row with bad int '{raw_val}' for {field_name} in {context}")
        return None


def get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def init_symbols(symbols):
    """Insert symbols into database with normalized names."""
    conn = get_conn()
    cur = conn.cursor()

    cleaned = []
    for sym in symbols:
        if not sym:
            continue
        sym = sym.upper().strip()
        # Extract base and quote from symbol (e.g., BTCUSDT -> BTC, USDT)
        base = sym[:-4]
        quote = sym[-4:]
        cur.execute(
            """
            INSERT INTO symbols(symbol, base_asset, quote_asset)
            VALUES (%s, %s, %s)
            ON CONFLICT (symbol) DO NOTHING;
            """,
            (sym, base, quote),
        )
        cleaned.append(sym)

    conn.commit()
    cur.close()
    conn.close()
    print(f"[SYMBOLS] Inserted/kept {len(cleaned)} symbols: {cleaned}")


def load_klines_from_folder(folder_path, symbols):
    """Load klines from ZIP files with data validation."""
    import zipfile

    conn = get_conn()
    cur = conn.cursor()

    all_files = [f for f in os.listdir(folder_path) if f.endswith(".zip")]
    print("[KLINES] All kline files in folder:", all_files)

    symbol_set = {s.upper().strip() for s in symbols}

    files = all_files
    BATCH_SIZE = 5000  # Insert in batches for performance

    total_good = 0
    total_bad = 0

    for fname in files:
        path = os.path.join(folder_path, fname)

        # Extract symbol from filename (e.g., BTCUSDT-1m-2024-01.zip)
        symbol = fname.split("-")[0].upper().strip()
        if symbol not in symbol_set:
            print(f"[KLINES] Skipping {fname} (symbol {symbol} not in our list)")
            continue

        print(f"[KLINES] Loading from {fname} for symbol {symbol}...")

        file_good = 0
        file_bad = 0

        with zipfile.ZipFile(path, "r") as zf:
            inner_name = zf.namelist()[0]
            with zf.open(inner_name, "r") as f:
                reader = csv.reader(line.decode("utf-8") for line in f)
                batch = []
                first = True

                for row in reader:
                    if not row:
                        file_bad += 1
                        continue

                    if first:
                        first = False
                        if row[0].lower().strip() in ("open_time", "open time"):
                            continue

                    try:
                        open_time_ms = float(row[0])
                    except Exception:
                        file_bad += 1
                        continue

                    open_time = datetime.utcfromtimestamp(open_time_ms / 1000.0)

                    open_price = _safe_float(row[1], fname, "open_price")
                    high_price = _safe_float(row[2], fname, "high_price")
                    low_price = _safe_float(row[3], fname, "low_price")
                    close_price = _safe_float(row[4], fname, "close_price")
                    volume = _safe_float(row[5], fname, "volume")
                    num_trades = _safe_int(row[8], fname, "number_of_trades")

                    if None in (open_price, high_price, low_price, close_price, volume, num_trades):
                        file_bad += 1
                        continue

                    if volume < 0 or num_trades < 0:
                        file_bad += 1
                        continue

                    batch.append(
                        (
                            symbol,
                            open_time,
                            open_price,
                            high_price,
                            low_price,
                            close_price,
                            volume,
                            num_trades,
                        )
                    )
                    file_good += 1

                    if len(batch) >= BATCH_SIZE:
                        _insert_klines_batch(cur, batch)
                        batch = []

                if batch:
                    _insert_klines_batch(cur, batch)

                conn.commit()
                print(f"[KLINES] Finished {fname} "
                      f"(good rows: {file_good}, skipped rows: {file_bad})")

        total_good += file_good
        total_bad += file_bad

    cur.close()
    conn.close()
    print(f"[KLINES] Completed. Total good rows: {total_good}, total skipped rows: {total_bad}")


def _insert_klines_batch(cur, batch):
    cur.executemany(
        """
        INSERT INTO klines(
            symbol, open_time, open_price, high_price,
            low_price, close_price, volume, number_of_trades
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (symbol, open_time) DO NOTHING;
        """,
        batch,
    )


def load_synthetic_funding(csv_path):
    """Load synthetic funding data from CSV with validation."""
    conn = get_conn()
    cur = conn.cursor()

    print(f"[FUNDING] Loading synthetic funding from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000
        good = 0
        bad = 0

        for row in reader:
            sym = (row.get("symbol") or "").upper().strip()
            ts_raw = row.get("ts")
            rate_raw = row.get("rate")

            ts = _safe_parse_ts(ts_raw, "funding")
            rate = _safe_float(rate_raw, "funding", "rate")
            if sym == "" or ts is None or rate is None:
                bad += 1
                continue

            batch.append((sym, ts, rate))
            good += 1

            if len(batch) >= BATCH_SIZE:
                cur.executemany(
                    """
                    INSERT INTO funding(symbol, ts, rate)
                    VALUES (%s,%s,%s)
                    ON CONFLICT (symbol, ts) DO NOTHING;
                    """,
                    batch,
                )
                conn.commit()
                batch = []

        if batch:
            cur.executemany(
                """
                INSERT INTO funding(symbol, ts, rate)
                VALUES (%s,%s,%s)
                ON CONFLICT (symbol, ts) DO NOTHING;
                """,
                batch,
            )
            conn.commit()

    cur.close()
    conn.close()
    print(f"[FUNDING] Finished. Good rows: {good}, skipped rows: {bad}")


def load_synthetic_open_interest(csv_path):
    """Load synthetic open interest data from CSV with validation."""
    conn = get_conn()
    cur = conn.cursor()

    print(f"[OI] Loading synthetic open interest from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000
        good = 0
        bad = 0

        for row in reader:
            sym = (row.get("symbol") or "").upper().strip()
            ts_raw = row.get("ts")
            oi_raw = row.get("oi")

            ts = _safe_parse_ts(ts_raw, "open_interest")
            oi = _safe_float(oi_raw, "open_interest", "oi")
            if sym == "" or ts is None or oi is None:
                bad += 1
                continue

            batch.append((sym, ts, oi))
            good += 1

            if len(batch) >= BATCH_SIZE:
                cur.executemany(
                    """
                    INSERT INTO open_interest(symbol, ts, oi)
                    VALUES (%s,%s,%s)
                    ON CONFLICT (symbol, ts) DO NOTHING;
                    """,
                    batch,
                )
                conn.commit()
                batch = []

        if batch:
            cur.executemany(
                """
                INSERT INTO open_interest(symbol, ts, oi)
                VALUES (%s,%s,%s)
                ON CONFLICT (symbol, ts) DO NOTHING;
                """,
                batch,
            )
            conn.commit()

    cur.close()
    conn.close()
    print(f"[OI] Finished. Good rows: {good}, skipped rows: {bad}")


def load_synthetic_premium_index(csv_path):
    """Load synthetic premium index data from CSV with validation."""
    conn = get_conn()
    cur = conn.cursor()

    print(f"[PREMIUM] Loading synthetic premium index from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000
        good = 0
        bad = 0

        for row in reader:
            sym = (row.get("symbol") or "").upper().strip()
            ts_raw = row.get("ts")

            ts = _safe_parse_ts(ts_raw, "premium_index")
            open_v = _safe_float(row.get("open_val"), "premium_index", "open_val")
            high_v = _safe_float(row.get("high_val"), "premium_index", "high_val")
            low_v = _safe_float(row.get("low_val"), "premium_index", "low_val")
            close_v = _safe_float(row.get("close_val"), "premium_index", "close_val")

            if sym == "" or ts is None or None in (open_v, high_v, low_v, close_v):
                bad += 1
                continue

            batch.append((sym, ts, open_v, high_v, low_v, close_v))
            good += 1

            if len(batch) >= BATCH_SIZE:
                cur.executemany(
                    """
                    INSERT INTO premium_index(symbol, ts, open_val, high_val, low_val, close_val)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (symbol, ts) DO NOTHING;
                    """,
                    batch,
                )
                conn.commit()
                batch = []

        if batch:
            cur.executemany(
                """
                INSERT INTO premium_index(symbol, ts, open_val, high_val, low_val, close_val)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (symbol, ts) DO NOTHING;
                """,
                batch,
            )
            conn.commit()

    cur.close()
    conn.close()
    print(f"[PREMIUM] Finished. Good rows: {good}, skipped rows: {bad}")


def main():
    symbols = ["BTCUSDT", "ETHUSDT"]

    init_symbols(symbols)

    klines_folder = os.path.join("data", "klines")
    load_klines_from_folder(klines_folder, symbols)

    funding_csv = os.path.join(SYN_DIR, "funding_synth.csv")
    oi_csv = os.path.join(SYN_DIR, "open_interest_synth.csv")
    prem_csv = os.path.join(SYN_DIR, "premium_index_synth.csv")

    load_synthetic_funding(funding_csv)
    load_synthetic_open_interest(oi_csv)
    load_synthetic_premium_index(prem_csv)

    print("[MAIN] All synthetic data loaded. You can now run Milestone 3 SQL queries.")


if __name__ == "__main__":
    main()
