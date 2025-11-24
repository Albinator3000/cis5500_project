import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface PositiveMovesRow {
  symbol: string;
  n_positive_moves: number;
}

const RulesLabPage: React.FC = () => {
  const [startTs, setStartTs] = useState("2024-01-01T00:00:00Z");
  const [endTs, setEndTs] = useState("2024-01-31T23:59:59Z");
  const [threshold, setThreshold] = useState(0.01);
  const [data, setData] = useState<PositiveMovesRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<PositiveMovesRow[]>(`${API_BASE}/api/positive_moves`, {
        params: {
          start_ts: startTs,
          end_ts: endTs,
          car_threshold: threshold,
        },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch rules lab data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Rules Lab</h2>
      <p>Count how often 30m CAR exceeds a threshold after funding events.</p>
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
          CAR threshold:{" "}
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: "100px" }}
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
              # Positive Moves
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td style={{ textAlign: "right" }}>{row.n_positive_moves}</td>
            </tr>
          ))}
          {data.length === 0 && !loading && (
            <tr>
              <td colSpan={2} style={{ paddingTop: "0.5rem" }}>
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RulesLabPage;
