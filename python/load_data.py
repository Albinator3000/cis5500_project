import os
import csv
from datetime import datetime
from dateutil import parser as dateparser

import psycopg2

# ==============================
# 1. DB CONFIG
# ==============================

DB_HOST = "cis550-project-db.c1am6gascgf2.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "cis550_project"
DB_USER = "postgres"
DB_PASSWORD = "m2wurbpn"

# Base dir for synthetic CSVs
SYN_DIR = os.path.join("data", "synthetic")


# ==============================
# 2. SMALL PARSING HELPERS
# ==============================

def _safe_parse_ts(raw_ts, context):
    """
    Safely parse timestamps. Returns None on failure so callers can skip the row.
    """
    try:
        if isinstance(raw_ts, datetime):
            return raw_ts
        # dateparser is robust to many formats and time zones
        return dateparser.parse(str(raw_ts))
    except Exception:
        print(f"[WARN] Skipping row with bad timestamp '{raw_ts}' in {context}")
        return None


def _safe_float(raw_val, context, field_name):
    """
    Safely parse floats. Returns None on failure so callers can skip the row.
    """
    try:
        return float(raw_val)
    except Exception:
        print(f"[WARN] Skipping row with bad float '{raw_val}' for {field_name} in {context}")
        return None


def _safe_int(raw_val, context, field_name):
    """
    Safely parse ints. Returns None on failure so callers can skip the row.
    """
    try:
        return int(raw_val)
    except Exception:
        print(f"[WARN] Skipping row with bad int '{raw_val}' for {field_name} in {context}")
        return None


# ==============================
# 3. DB CONNECTION HELPER
# ==============================

def get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


# ==============================
# 4. INSERT SYMBOLS
# ==============================

def init_symbols(symbols):
    """
    Insert the symbols we care about into the symbols table.
    We also normalize them to upper case and derive base/quote.
    """
    conn = get_conn()
    cur = conn.cursor()

    cleaned = []
    for sym in symbols:
        if not sym:
            continue
        sym = sym.upper().strip()
        base = sym[:-4]   # crude but works for typical *USDT pairs
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


# ==============================
# 5. KLINES LOADER
# ==============================

def load_klines_from_folder(folder_path, symbols):
    """
    Iterate over .zip files in data/klines, read CSV contents, and insert into klines table.
    Basic cleaning:
      - Skip header rows
      - Skip rows with non-numeric timestamps/prices/volume/trade counts
      - Enforce non-negative volume and trade counts
    """
    import zipfile  # only needed if you ever re-enable this

    conn = get_conn()
    cur = conn.cursor()

    all_files = [f for f in os.listdir(folder_path) if f.endswith(".zip")]
    print("[KLINES] All kline files in folder:", all_files)

    # Normalize symbols to upper-case once
    symbol_set = {s.upper().strip() for s in symbols}

    files = all_files
    BATCH_SIZE = 5000

    total_good = 0
    total_bad = 0

    for fname in files:
        path = os.path.join(folder_path, fname)

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

                    # Skip header row if present
                    if first:
                        first = False
                        if row[0].lower().strip() in ("open_time", "open time"):
                            continue

                    # 0: open time (ms)
                    # 1: open, 2: high, 3: low, 4: close, 5: volume, 8: #trades
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

                    # Skip rows where any key field failed to parse
                    if None in (open_price, high_price, low_price, close_price, volume, num_trades):
                        file_bad += 1
                        continue

                    # Very light sanity checks
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


# ==============================
# 6. LOAD SYNTHETIC FUNDING FROM CSV
# ==============================

def load_synthetic_funding(csv_path):
    """
    Load synthetic funding data from CSV into the funding table.
    CSV headers: symbol, ts, rate
    Cleaning:
      - Normalize symbol to upper-case
      - Skip rows with bad timestamp or non-numeric rate
    """
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


# ==============================
# 7. LOAD SYNTHETIC OPEN INTEREST FROM CSV
# ==============================

def load_synthetic_open_interest(csv_path):
    """
    Load synthetic open interest data from CSV into the open_interest table.
    CSV headers: symbol, ts, oi
    Cleaning:
      - Normalize symbol
      - Skip rows with bad timestamp / oi
    """
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


# ==============================
# 8. LOAD SYNTHETIC PREMIUM INDEX
# ==============================

def load_synthetic_premium_index(csv_path):
    """
    Load synthetic premium index data from CSV into the premium_index table.
    CSV headers: symbol, ts, open_val, high_val, low_val, close_val
    Cleaning:
      - Normalize symbol
      - Skip rows with bad timestamp / price fields
    """
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


# ==============================
# 9. MAIN DRIVER
# ==============================

def main():
    # Only the two symbols we actually have klines for
    symbols = ["BTCUSDT", "ETHUSDT"]

    # 1) Ensure symbols exist in the symbols table
    init_symbols(symbols)

    # 2) Load klines from your downloaded ZIPs
    klines_folder = os.path.join("data", "klines")
    load_klines_from_folder(klines_folder, symbols)

    # 3) Paths to synthetic CSVs
    funding_csv = os.path.join(SYN_DIR, "funding_synth.csv")
    oi_csv = os.path.join(SYN_DIR, "open_interest_synth.csv")
    prem_csv = os.path.join(SYN_DIR, "premium_index_synth.csv")

    # 4) Load synthetic tables
    load_synthetic_funding(funding_csv)
    load_synthetic_open_interest(oi_csv)
    load_synthetic_premium_index(prem_csv)

    print("[MAIN] All synthetic data loaded. You can now run Milestone 3 SQL queries.")


if __name__ == "__main__":
    main()
