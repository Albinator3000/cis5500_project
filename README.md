# CIS 5500 Project – Funding-Aware Market Maker
**University of Pennsylvania – Fall 2025**  
**Author:** Albert Opher, Ishaan Shah, Gaurav Malhotra, and Madhav Sharma  

---

## Project Overview

This project investigates short-term price dynamics surrounding funding rate events in crypto perpetual futures.  
Funding rates are periodic payments exchanged between long and short perpetual futures traders to keep the contract price anchored to the spot market. Because they reflect leverage imbalance, they often correlate with price drift, liquidations, and market stress regimes.

We study six major instruments (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, DOGEUSDT), but the primary dataset for Milestone 3 uses **minute-level klines** for BTC and ETH plus synthetic supporting datasets for funding, open interest, and premium index.

This repository contains:

- Data ingestion scripts (Python)  
- PostgreSQL schema and analytical views  
- Milestone 3 analytical SQL queries 

---

## Data Loading Pipeline (ETL)

### **1. Kline Data (Real Market Data)**  
We downloaded **Binance Futures 1-minute klines** in `.zip` format:  
- `BTCUSDT-1m-2024-01.zip`  
- `BTCUSDT-1m-2024-02.zip`  
- `BTCUSDT-1m-2024-03.zip`  
- Same for `ETHUSDT`.

These files contain tens of thousands of rows each (Total ~300k).  
We load them using the optimized `load_data.py` script.

### **2. Funding Rate / Open Interest / Premium (Synthetic)**  
Binance restricted access to public REST endpoints (HTTP 451), so the real API could not be queried.  
To satisfy Milestone 3 requirements and preserve realistic analytical structure, we generated **synthetic but statistically reasonable datasets**:

- **funding.csv**  
- **open_interest.csv**  
- **premium_index.csv**

These match the schema and statistical distribution needed for the analytics and provide:
- realistic magnitudes  
- realistic timestamp spacing
  
We load these synthetic datasets using the same `load_data.py` pipeline.

---

## SQL Schema (CREATE TABLES)

All project tables are defined in:

sql/create_tables.sql

This includes:

### **symbols**
- base/quote  
- onboarding date  
- PK: symbol  

### **klines**
- 1-minute OHLCV data  
- number of trades  
- PK (symbol, open_time)  
- auto-generated `open_time_ym` for partition-like grouping  

### **funding**
- funding rate per event  
- PK (symbol, ts)

### **open_interest**
- total open interest per timestamp  
- PK (symbol, ts)

### **premium_index**
- synthetic index with OHLC values  
- PK (symbol, ts)

### **events** (ENUM)
- ENUM type `event_kind`  
- stores pseudo & real market events, useful for event studies  

---

## Views

Defined in:

sql/create_views.sql


### **minute_returns**  
Contains:
- 1-minute log returns  
- 30-minute rolling realized volatility (`rv_30m`)

Used heavily across all analytics for markout computations.

---

## Analytical SQL (Milestone 3)

All Milestone 3 analytical queries live in:

sql/milestone3_queries.sql


Queries include:

### **1. CAR around funding events ([-60, +180] minutes)**  
Computes cumulative abnormal returns (CAR) and extracts min/max CAR.

### **2. Funding rate deciles vs 60-minute drift**  
Groups events into daily deciles → evaluates predictive drift.

### **3. Extreme regime detection**  
Events where:
- |funding| > daily 90th percentile  
- OI > 14-day rolling 90th percentile  
Returns top symbols by 60-minute drift (fixed for PostgreSQL).

### **4. Symbols with no negative CAR in low-vol regimes**  
Volatility-filtered event outcomes.

### **5. Hour-of-day analysis**  
Market microstructure pattern by funding timestamp.

### **6. Volatility regime conditioning**  
Partition events into NTILE(3) buckets and compute average drift.

### **7. Liquidity overview**  
Row counts + avg kline volume + funding frequency.

### **8. Symbols ranked by average |funding|**  

### **9. Post-event 30-minute realized volatility**

### **10. Positive CAR event counts**

These queries collectively reproduce a realistic market microstructure analysis pipeline used in quant trading and derivatives research.

---

## Summary of What We Accomplished so far

- Built a clean, normalized **PostgreSQL schema** on AWS RDS  
- Wrote a full **Python ETL pipeline** to ingest real klines + synthetic supporting datasets  
- Loaded hundreds of thousands of rows into RDS  
- Created reusable views for returns & volatility  
- Delivered **10 high-level analytical SQL queries** that:
  - measure funding-driven price drift  
  - detect extreme leverage/positioning regimes  
  - analyze volatility structure  
  - build event-driven crypto market insights  

---

