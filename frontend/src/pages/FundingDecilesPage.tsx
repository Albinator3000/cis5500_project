import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DecileRow {
  rate_decile: number;
  avg_markout_60m: number;
  n_events: number;
}

const FundingDecilesPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [data, setData] = useState<DecileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<DecileRow[]>(`${API_BASE}/api/funding_deciles`, {
        params: { 
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

  const formatMarkout = (value: number) => {
    const formatted = (value * 100).toFixed(4);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  const totalEvents = data.reduce((sum, row) => sum + row.n_events, 0);
  const maxMarkout = data.length > 0 ? Math.max(...data.map(d => d.avg_markout_60m)) : 0;
  const minMarkout = data.length > 0 ? Math.min(...data.map(d => d.avg_markout_60m)) : 0;
  const spread = maxMarkout - minMarkout;

  const getDecileLabel = (decile: number) => {
    if (decile <= 2) return 'Very Low';
    if (decile <= 4) return 'Low';
    if (decile <= 6) return 'Medium';
    if (decile <= 8) return 'High';
    return 'Very High';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"></path>
            <path d="M18 17V9"></path>
            <path d="M13 17V5"></path>
            <path d="M8 17v-3"></path>
          </svg>
          Funding Rate Deciles
        </h1>
        <p className="page-description">
          Analyze how funding rate deciles relate to subsequent 60-minute markouts.
          Identify which funding rate levels lead to the best post-event performance.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Deciles Analyzed</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{totalEvents.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best Decile Markout</div>
            <div className="stat-value positive">{formatMarkout(maxMarkout)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Decile Spread</div>
            <div className="stat-value">{formatMarkout(spread)}</div>
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
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Analyze Deciles
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Bar Chart */}
      {data.length > 0 && (
        <div className="card mb-xl">
          <div className="card-header">
            <h3 className="card-title">Markout by Decile</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {data.map((row) => {
              const maxAbs = Math.max(Math.abs(maxMarkout), Math.abs(minMarkout));
              const barWidth = Math.abs(row.avg_markout_60m) / maxAbs * 50;
              const isPositive = row.avg_markout_60m >= 0;
              
              return (
                <div key={row.rate_decile} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                  <div style={{ width: '80px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    D{row.rate_decile}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', height: '32px' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '50%', 
                      width: '1px', 
                      height: '100%', 
                      background: 'var(--border-default)' 
                    }} />
                    <div style={{
                      position: 'absolute',
                      [isPositive ? 'left' : 'right']: '50%',
                      width: `${barWidth}%`,
                      height: '24px',
                      background: isPositive 
                        ? 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))'
                        : 'linear-gradient(90deg, var(--accent-danger), #ff6b6b)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ width: '100px', textAlign: 'right' }} className={`font-mono ${isPositive ? 'value-positive' : 'value-negative'}`}>
                    {formatMarkout(row.avg_markout_60m)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Decile Analysis</h3>
          {data.length > 0 && (
            <span className="badge badge-info">{data.length} deciles</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Decile</th>
                <th>Rate Level</th>
                <th className="text-right">Avg 60m Markout</th>
                <th className="text-right"># Events</th>
                <th className="text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.rate_decile}>
                  <td>
                    <span style={{ fontWeight: 600 }}>D{row.rate_decile}</span>
                  </td>
                  <td>
                    <span className={`badge ${row.rate_decile <= 3 ? 'badge-danger' : row.rate_decile >= 8 ? 'badge-success' : 'badge-warning'}`}>
                      {getDecileLabel(row.rate_decile)}
                    </span>
                  </td>
                  <td className={`text-right font-mono ${row.avg_markout_60m >= 0 ? 'value-positive' : 'value-negative'}`}>
                    {formatMarkout(row.avg_markout_60m)}
                  </td>
                  <td className="text-right font-mono">
                    {row.n_events.toLocaleString()}
                  </td>
                  <td className="text-center">
                    {row.avg_markout_60m > 0.0005 ? (
                      <span className="badge badge-success">Long</span>
                    ) : row.avg_markout_60m < -0.0005 ? (
                      <span className="badge badge-danger">Short</span>
                    ) : (
                      <span className="badge badge-warning">Neutral</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3v18h18"></path>
                        <path d="M18 17V9"></path>
                        <path d="M13 17V5"></path>
                        <path d="M8 17v-3"></path>
                      </svg>
                      <p>Select date range and click Analyze Deciles.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Analyzing funding deciles...</p>
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

export default FundingDecilesPage;

