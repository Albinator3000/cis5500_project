import os
import csv
from datetime import datetime
from dateutil import parser as dateparser

import psycopg2

# ==============================
# 1. DB CONFIG
# ==============================

DB_HOST = "cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "cis550_project"
DB_USER = "postgres"
DB_PASSWORD = "m2wurbpn"

# Base dir for synthetic CSVs
SYN_DIR = os.path.join("data", "synthetic")


# ==============================
# 2. DB CONNECTION HELPER
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
# 3. INSERT SYMBOLS
# ==============================

def init_symbols(symbols):
    """
    Insert the symbols we care about into the symbols table.
    For now, we just fill base/quote by splitting 'BTCUSDT' -> BTC / USDT.
    """
    conn = get_conn()
    cur = conn.cursor()

    for sym in symbols:
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

    conn.commit()
    cur.close()
    conn.close()
    print(f"Inserted/kept {len(symbols)} symbols.")


# ==============================
# 4. KLINES LOADER
# ==============================

def load_klines_from_folder(folder_path, symbols):
    """
    Iterate over .zip files in data/klines, read CSV contents, and insert into klines table.
    """
    import zipfile  # only needed if you ever re-enable this

    conn = get_conn()
    cur = conn.cursor()

    all_files = [f for f in os.listdir(folder_path) if f.endswith(".zip")]
    print("All kline files in folder: ", all_files)

    files = all_files
    BATCH_SIZE = 5000

    for fname in files:
        path = os.path.join(folder_path, fname)

        symbol = fname.split("-")[0]
        if symbol not in symbols:
            print(f"Skipping {fname} (symbol {symbol} not in our list)")
            continue

        print(f"Loading klines from {fname} for symbol {symbol}...")

        with zipfile.ZipFile(path, "r") as zf:
            inner_name = zf.namelist()[0]
            with zf.open(inner_name, "r") as f:
                reader = csv.reader(line.decode("utf-8") for line in f)
                batch = []
                first = True

                for row in reader:
                    if not row:
                        continue

                    if first:
                        first = False
                        if row[0].lower().strip() in ("open_time", "open time"):
                            continue

                    try:
                        open_time_ms = int(float(row[0]))
                    except ValueError:
                        continue

                    open_time = datetime.utcfromtimestamp(open_time_ms / 1000.0)

                    open_price = float(row[1])
                    high_price = float(row[2])
                    low_price = float(row[3])
                    close_price = float(row[4])
                    volume = float(row[5])
                    num_trades = int(row[8])

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

                    if len(batch) >= BATCH_SIZE:
                        _insert_klines_batch(cur, batch)
                        batch = []

                if batch:
                    _insert_klines_batch(cur, batch)

                conn.commit()
                print(f"Finished {fname}")

    cur.close()
    conn.close()
    print("Finished loading klines.")


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
# 5. LOAD SYNTHETIC FUNDING FROM CSV
# ==============================

def load_synthetic_funding(csv_path):
    """
    Load synthetic funding data from CSV into the funding table.
    CSV headers: symbol, ts, rate
    """
    conn = get_conn()
    cur = conn.cursor()

    print(f"Loading synthetic funding from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000

        for row in reader:
            sym = row["symbol"]
            ts = dateparser.parse(row["ts"])
            rate = float(row["rate"])

            batch.append((sym, ts, rate))

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
    print("Finished loading synthetic funding.")


# ==============================
# 6. LOAD SYNTHETIC OPEN INTEREST FROM CSV
# ==============================

def load_synthetic_open_interest(csv_path):
    """
    Load synthetic open interest data from CSV into the open_interest table.
    CSV headers: symbol, ts, oi
    """
    conn = get_conn()
    cur = conn.cursor()

    print(f"Loading synthetic open interest from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000

        for row in reader:
            sym = row["symbol"]
            ts = dateparser.parse(row["ts"])
            oi = float(row["oi"])

            batch.append((sym, ts, oi))

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
    print("Finished loading synthetic open interest.")


# ==============================
# 7. LOAD SYNTHETIC PREMIUM INDEX
# ==============================

def load_synthetic_premium_index(csv_path):
    """
    Load synthetic premium index data from CSV into the premium_index table.
    CSV headers: symbol, ts, open_val, high_val, low_val, close_val
    """
    conn = get_conn()
    cur = conn.cursor()

    print(f"Loading synthetic premium index from: {csv_path}")
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        batch = []
        BATCH_SIZE = 2000

        for row in reader:
            sym = row["symbol"]
            ts = dateparser.parse(row["ts"])
            open_v = float(row["open_val"])
            high_v = float(row["high_val"])
            low_v = float(row["low_val"])
            close_v = float(row["close_val"])

            batch.append((sym, ts, open_v, high_v, low_v, close_v))

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
    print("Finished loading synthetic premium index.")


# ==============================
# 8. MAIN DRIVER
# ==============================

def main():
    # Only the two symbols we actually have klines for
    symbols = ["BTCUSDT", "ETHUSDT"]

    # 1) Ensure symbols exist in the symbols table
    init_symbols(symbols)

    # 2) KLINES LOADING DISABLED
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

    print("All synthetic data loaded. You can now run Milestone 3 SQL queries.")


if __name__ == "__main__":
    main()

