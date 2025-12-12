import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RegimeRow {
  symbol: string;
  avg_markout_60m: number;
  n_events: number;
}

const FilterIcon = () => (
  <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const PlayIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const EmptyIcon = () => (
  <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
  </svg>
);

const RegimeScreenerPage: React.FC = () => {
  const [startTs, setStartTs] = useState('2024-01-01T00:00:00Z');
  const [endTs, setEndTs] = useState('2024-01-31T23:59:59Z');
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
    } finally {
      setLoading(false);
    }
  };

  const formatMarkout = (value: number) => {
    const formatted = (value * 100).toFixed(3);
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
          <FilterIcon />
          Regime Screener
        </h1>
        <p className="page-description">
          Identify symbols with extreme funding rate regimes and analyze their average 60-minute markouts.
          Filter by minimum event count to find statistically significant patterns.
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
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{totalEvents.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Markout</div>
            <div className={`stat-value ${avgMarkout >= 0 ? 'positive' : 'negative'}`}>
              {formatMarkout(avgMarkout)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Positive Regimes</div>
            <div className="stat-value positive">{positiveRegimes}/{data.length}</div>
          </div>
        </div>
      )}

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Screen Parameters</h3>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Start Timestamp</label>
            <input
              className="form-input"
              value={startTs}
              onChange={(e) => setStartTs(e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Timestamp</label>
            <input
              className="form-input"
              value={endTs}
              onChange={(e) => setEndTs(e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
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
            <label className="form-label">Top K</label>
            <input
              className="form-input"
              type="number"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              min={1}
              max={100}
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner" />
                Screening...
              </>
            ) : (
              <>
                <PlayIcon />
                Run Screen
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Regime Results</h3>
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
                <th className="text-right">Avg Markout 60m</th>
                <th className="text-right"># Events</th>
                <th className="text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={row.symbol}>
                  <td>
                    <span className="text-muted">#{index + 1}</span>
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
                      <span className="badge badge-success">Strong Buy</span>
                    ) : row.avg_markout_60m > 0 ? (
                      <span className="badge badge-info">Buy</span>
                    ) : row.avg_markout_60m < -0.001 ? (
                      <span className="badge badge-danger">Strong Sell</span>
                    ) : (
                      <span className="badge badge-warning">Sell</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <EmptyIcon />
                      <p>No regimes found. Adjust parameters and run the screen.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Screening regimes...</p>
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

export default RegimeScreenerPage;
