import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RegimeRow {
  symbol: string;
  avg_markout_60m: number;
  n_events: number;
}

const ExtremeRegimesPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [minEvents, setMinEvents] = useState(5);
  const [topK, setTopK] = useState(10);
  const [data, setData] = useState<RegimeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<RegimeRow[]>(`${API_BASE}/api/extreme_regimes`, {
        params: {
          start_ts: `${startDate}T00:00:00Z`,
          end_ts: `${endDate}T23:59:59Z`,
          min_events: minEvents,
          top_k: topK,
        },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatMarkout = (value: number) => {
    const formatted = (value * 100).toFixed(4);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  // Calculate stats
  const avgMarkout = data.length > 0 
    ? data.reduce((sum, row) => sum + row.avg_markout_60m, 0) / data.length 
    : 0;
  const totalEvents = data.reduce((sum, row) => sum + row.n_events, 0);
  const positiveRegimes = data.filter(row => row.avg_markout_60m > 0).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
          Extreme Regime Detection
        </h1>
        <p className="page-description">
          Identify symbols experiencing extreme market conditions with high funding rates and elevated open interest.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Symbols Found</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Extreme Events</div>
            <div className="stat-value">{totalEvents.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Markout</div>
            <div className={`stat-value ${avgMarkout >= 0 ? 'positive' : 'negative'}`}>
              {formatMarkout(avgMarkout)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Positive/Negative</div>
            <div className="stat-value">
              <span className="positive">{positiveRegimes}</span>
              <span style={{ color: 'var(--text-muted)' }}> / </span>
              <span className="negative">{data.length - positiveRegimes}</span>
            </div>
          </div>
        </div>
      )}

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Detection Parameters</h3>
        </div>
        <div className="form-grid">
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
          <div className="form-group">
            <label className="form-label">Min Events</label>
            <input
              className="form-input"
              type="number"
              value={minEvents}
              onChange={(e) => setMinEvents(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Top K Symbols</label>
            <input
              className="form-input"
              type="number"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              min={1}
              max={50}
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner" />
                Detecting...
              </>
            ) : (
              <>
                <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
                Detect Extreme Regimes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Extreme Regime Results</h3>
          {data.length > 0 && (
            <span className="badge badge-warning">Top {data.length}</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Rank</th>
                <th>Symbol</th>
                <th className="text-right">Avg 60m Markout</th>
                <th className="text-right"># Events</th>
                <th className="text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={row.symbol}>
                  <td>
                    {index < 3 ? (
                      <span style={{ 
                        color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f32',
                        fontWeight: 700
                      }}>
                        #{index + 1}
                      </span>
                    ) : (
                      <span className="text-muted">#{index + 1}</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">{row.symbol}</span>
                  </td>
                  <td className={`text-right font-mono ${row.avg_markout_60m >= 0 ? 'value-positive' : 'value-negative'}`}>
                    {formatMarkout(row.avg_markout_60m)}
                  </td>
                  <td className="text-right font-mono">
                    {row.n_events.toLocaleString()}
                  </td>
                  <td className="text-center">
                    {row.avg_markout_60m > 0.001 ? (
                      <span className="badge badge-success">Strong Long</span>
                    ) : row.avg_markout_60m > 0 ? (
                      <span className="badge badge-info">Long</span>
                    ) : row.avg_markout_60m < -0.001 ? (
                      <span className="badge badge-danger">Strong Short</span>
                    ) : (
                      <span className="badge badge-warning">Short</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                      </svg>
                      <p>No extreme regimes found. Adjust parameters and detect.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Detecting extreme regimes...</p>
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

export default ExtremeRegimesPage;

