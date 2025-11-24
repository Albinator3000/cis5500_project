// DataAdminPage.tsx
import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface SymbolOverviewRow {
  symbol: string;
  n_klines: number;
  n_funding_events: number;
  avg_kline_volume: number;
}

const DataAdminPage: React.FC = () => {
  const [startTs, setStartTs] = useState("2024-01-01T00:00:00Z");
  const [endTs, setEndTs] = useState("2024-01-31T23:59:59Z");
  const [data, setData] = useState<SymbolOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<SymbolOverviewRow[]>(`${API_BASE}/api/symbol_overview`, {
        params: { start_ts: startTs, end_ts: endTs },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch symbol overview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Data Admin</h2>
      <p>Check row counts and liquidity stats per symbol for a date range.</p>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Start TS:{" "}
          <input
            value={startTs}
            onChange={(e) => setStartTs(e.target.value)}
            style={{ width: "220px" }}
          />
        </label>
        <label>
          End TS:{" "}
          <input
            value={endTs}
            onChange={(e) => setEndTs(e.target.value)}
            style={{ width: "220px" }}
          />
        </label>
        <button onClick={fetchData} disabled={loading}>
          {loading ? "Loading..." : "Run" }
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              Symbol
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              # Klines
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              # Funding Events
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              Avg Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td style={{ textAlign: "right" }}>{row.n_klines}</td>
              <td style={{ textAlign: "right" }}>{row.n_funding_events}</td>
              <td style={{ textAlign: "right" }}>
                {row.avg_kline_volume?.toFixed(2)}
              </td>
            </tr>
          ))}
          {data.length === 0 && !loading && (
            <tr>
              <td colSpan={4} style={{ paddingTop: "0.5rem" }}>
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataAdminPage;
