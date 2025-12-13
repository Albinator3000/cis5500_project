SET search_path TO public;

-- Trading symbols table (e.g., BTCUSDT, ETHUSDT)
CREATE TABLE IF NOT EXISTS symbols (
    symbol      TEXT PRIMARY KEY,
    base_asset  TEXT,           -- e.g., BTC
    quote_asset TEXT            -- e.g., USDT
);

-- 1-minute candlestick data from Binance
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

-- Index for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_klines_sym_time
    ON klines(symbol, open_time);

-- Perpetual futures funding rates (collected every 8 hours)
CREATE TABLE IF NOT EXISTS funding (
    symbol TEXT NOT NULL REFERENCES symbols(symbol),
    ts     TIMESTAMP NOT NULL,
    rate   DOUBLE PRECISION NOT NULL,  -- Annualized funding rate
    CONSTRAINT pk_funding PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_funding_sym_ts
    ON funding(symbol, ts);

-- Open interest snapshots (total outstanding contracts)
CREATE TABLE IF NOT EXISTS open_interest (
    symbol TEXT NOT NULL REFERENCES symbols(symbol),
    ts     TIMESTAMP NOT NULL,
    oi     DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_open_interest PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_oi_sym_ts
    ON open_interest(symbol, ts);

-- Premium index (difference between perpetual and spot prices)
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

-- Create enum type for event classification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_kind') THEN
        CREATE TYPE event_kind AS ENUM ('funding', 'pseudo');
    END IF;
END$$;

-- Events table for marking important timestamps (funding events, etc.)
CREATE TABLE IF NOT EXISTS events (
    symbol   TEXT NOT NULL REFERENCES symbols(symbol),
    event_ts TIMESTAMP NOT NULL,
    kind     event_kind NOT NULL,
    CONSTRAINT pk_events PRIMARY KEY (symbol, event_ts)
);

CREATE INDEX IF NOT EXISTS idx_events_sym_ts
    ON events(symbol, event_ts);

