import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface RegimeRow {
  symbol: string;
  avg_markout_60m: number;
  n_events: number;
}

const RegimeScreenerPage: React.FC = () => {
  const [startTs, setStartTs] = useState("2024-01-01T00:00:00Z");
  const [endTs, setEndTs] = useState("2024-01-31T23:59:59Z");
  const [minEvents, setMinEvents] = useState(5);
  const [topK, setTopK] = useState(10);
  const [data, setData] = useState<RegimeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<RegimeRow[]>(`${API_BASE}/api/regime_stress`, {
        params: {
          start_ts: startTs,
          end_ts: endTs,
          min_events: minEvents,
          top_k: topK,
        },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch regime screener data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Regime Screener</h2>
      <p>Find symbols with extreme funding × OI regimes and their average 60m markouts.</p>
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
        <label>
          Min regime events:{" "}
          <input
            type="number"
            value={minEvents}
            onChange={(e) => setMinEvents(Number(e.target.value))}
            style={{ width: "80px" }}
          />
        </label>
        <label>
          Top K:{" "}
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{ width: "80px" }}
          />
        </label>
        <button onClick={fetchData} disabled={loading}>
          {loading ? "Loading..." : "Run"}
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              Symbol
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              Avg Markout 60m
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              # Regime Events
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td style={{ textAlign: "right" }}>{row.avg_markout_60m.toFixed(4)}</td>
              <td style={{ textAlign: "right" }}>{row.n_events}</td>
            </tr>
          ))}
          {data.length === 0 && !loading && (
            <tr>
              <td colSpan={3} style={{ paddingTop: "0.5rem" }}>
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RegimeScreenerPage;
