import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface EventCarRow {
  symbol: string;
  event_ts: string;
  min_car: number;
  max_car: number;
}

const EventStudyPage: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [data, setData] = useState<EventCarRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<EventCarRow[]>(`${API_BASE}/api/event_car`, {
        params: { 
          symbol, 
          start_ts: `${startDate}T00:00:00Z`, 
          end_ts: `${endDate}T23:59:59Z` 
        },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format decimal returns as percentage with sign
  const formatValue = (value: number) => {
    const formatted = (value * 100).toFixed(3);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  // Calculate summary statistics across all events
  const avgMinCar = data.length > 0 
    ? data.reduce((sum, row) => sum + row.min_car, 0) / data.length 
    : 0;
  const avgMaxCar = data.length > 0 
    ? data.reduce((sum, row) => sum + row.max_car, 0) / data.length 
    : 0;
  const avgRange = avgMaxCar - avgMinCar;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          Event Study · CAR Analysis
        </h1>
        <p className="page-description">
          Analyze cumulative abnormal returns (CAR) around funding rate events.
          View min/max price movements within the event window.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Min CAR</div>
            <div className={`stat-value ${avgMinCar < 0 ? 'negative' : 'positive'}`}>
              {formatValue(avgMinCar)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Max CAR</div>
            <div className={`stat-value ${avgMaxCar >= 0 ? 'positive' : 'negative'}`}>
              {formatValue(avgMaxCar)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Range</div>
            <div className="stat-value">{formatValue(avgRange)}</div>
          </div>
        </div>
      )}

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Query Parameters</h3>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Symbol</label>
            <select
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="ETHUSDT">ETHUSDT</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner" />
                  Running...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Run Query
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Event Results</h3>
          {data.length > 0 && (
            <span className="badge badge-info">{data.length} events</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Timestamp</th>
                <th>Symbol</th>
                <th className="text-right">Min CAR</th>
                <th className="text-right">Max CAR</th>
                <th className="text-right">Range</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const range = row.max_car - row.min_car;
                return (
                  <tr key={`${row.symbol}-${row.event_ts}`}>
                    <td>
                      <span className="font-mono">{formatDate(row.event_ts)}</span>
                    </td>
                    <td>
                      <span className="badge badge-info">{row.symbol}</span>
                    </td>
                    <td className={`text-right font-mono ${row.min_car < 0 ? 'value-negative' : 'value-positive'}`}>
                      {formatValue(row.min_car)}
                    </td>
                    <td className={`text-right font-mono ${row.max_car >= 0 ? 'value-positive' : 'value-negative'}`}>
                      {formatValue(row.max_car)}
                    </td>
                    <td className="text-right font-mono value-neutral">
                      {formatValue(range)}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                      </svg>
                      <p>No data yet. Select parameters and click Run Query.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Fetching event data...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EventStudyPage;
