SELECT symbol, COUNT(*) FROM klines GROUP BY symbol;
SELECT symbol, COUNT(*) FROM funding GROUP BY symbol;
SELECT symbol, COUNT(*) FROM open_interest GROUP BY symbol;
SELECT symbol, COUNT(*) FROM premium_index GROUP BY symbol;
