import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface EventCarRow {
  symbol: string;
  event_ts: string;
  min_car: number;
  max_car: number;
}

const EventStudyPage: React.FC = () => {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [startTs, setStartTs] = useState("2024-01-01T00:00:00Z");
  const [endTs, setEndTs] = useState("2024-01-31T23:59:59Z");
  const [data, setData] = useState<EventCarRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<EventCarRow[]>(`${API_BASE}/api/event_car`, {
        params: { symbol, start_ts: startTs, end_ts: endTs },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch event CAR data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Event Study Explorer</h2>
      <p>View min/max cumulative return around funding events.</p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Symbol:{" "}
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ width: "120px" }}
          />
        </label>
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
          {loading ? "Loading..." : "Run"}
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              Event TS
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              Min CAR
            </th>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "right" }}>
              Max CAR
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={`${row.symbol}-${row.event_ts}`}>
              <td>{row.event_ts}</td>
              <td style={{ textAlign: "right" }}>
                {row.min_car.toFixed(4)}
              </td>
              <td style={{ textAlign: "right" }}>
                {row.max_car.toFixed(4)}
              </td>
            </tr>
          ))}
          {data.length === 0 && !loading && (
            <tr>
              <td colSpan={3} style={{ paddingTop: "0.5rem" }}>
                No data yet. Adjust parameters and click Run.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EventStudyPage;
