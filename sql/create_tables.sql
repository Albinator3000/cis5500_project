SET search_path TO public;

CREATE TABLE IF NOT EXISTS symbols (
    symbol      TEXT PRIMARY KEY,
    base_asset  TEXT,
    quote_asset TEXT
);

CREATE TABLE IF NOT EXISTS klines (
    symbol           TEXT NOT NULL REFERENCES symbols(symbol),
    open_time        TIMESTAMP NOT NULL,
    open_price       DOUBLE PRECISION NOT NULL,
    high_price       DOUBLE PRECISION NOT NULL,
    low_price        DOUBLE PRECISION NOT NULL,
    close_price      DOUBLE PRECISION NOT NULL,
    volume           DOUBLE PRECISION NOT NULL,
    number_of_trades INTEGER NOT NULL,
    CONSTRAINT pk_klines PRIMARY KEY (symbol, open_time)
);

CREATE INDEX IF NOT EXISTS idx_klines_sym_time
    ON klines(symbol, open_time);

CREATE TABLE IF NOT EXISTS funding (
    symbol TEXT NOT NULL REFERENCES symbols(symbol),
    ts     TIMESTAMP NOT NULL,
    rate   DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_funding PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_funding_sym_ts
    ON funding(symbol, ts);

CREATE TABLE IF NOT EXISTS open_interest (
    symbol TEXT NOT NULL REFERENCES symbols(symbol),
    ts     TIMESTAMP NOT NULL,
    oi     DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_open_interest PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_oi_sym_ts
    ON open_interest(symbol, ts);

CREATE TABLE IF NOT EXISTS premium_index (
    symbol    TEXT NOT NULL REFERENCES symbols(symbol),
    ts        TIMESTAMP NOT NULL,
    open_val  DOUBLE PRECISION NOT NULL,
    high_val  DOUBLE PRECISION NOT NULL,
    low_val   DOUBLE PRECISION NOT NULL,
    close_val DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_premium_index PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_premium_sym_ts
    ON premium_index(symbol, ts);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_kind') THEN
        CREATE TYPE event_kind AS ENUM ('funding', 'pseudo');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS events (
    symbol   TEXT NOT NULL REFERENCES symbols(symbol),
    event_ts TIMESTAMP NOT NULL,
    kind     event_kind NOT NULL,
    CONSTRAINT pk_events PRIMARY KEY (symbol, event_ts)
);

CREATE INDEX IF NOT EXISTS idx_events_sym_ts
    ON events(symbol, event_ts);

