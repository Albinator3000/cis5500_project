import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface VolRegimeRow {
  vol_regime: number;
  avg_markout_60m: number;
  n_events: number;
}

const VolatilityRegimesPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [data, setData] = useState<VolRegimeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<VolRegimeRow[]>(`${API_BASE}/api/vol_regime_markouts`, {
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

  const getRegimeLabel = (regime: number) => {
    switch (regime) {
      case 1: return 'Low Volatility';
      case 2: return 'Medium Volatility';
      case 3: return 'High Volatility';
      default: return `Regime ${regime}`;
    }
  };

  const getRegimeIcon = (regime: number) => {
    switch (regime) {
      case 1: return '🌊'; // Calm
      case 2: return '⚡'; // Medium
      case 3: return '🔥'; // High
      default: return '📊';
    }
  };

  // Calculate stats
  const totalEvents = data.reduce((sum, row) => sum + row.n_events, 0);
  const bestRegime = data.length > 0 ? data.reduce((best, row) => row.avg_markout_60m > best.avg_markout_60m ? row : best) : null;
  const maxAbs = data.length > 0 ? Math.max(...data.map(d => Math.abs(d.avg_markout_60m))) : 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          Volatility Regime Analysis
        </h1>
        <p className="page-description">
          Analyze how pre-event volatility conditions affect 60-minute markouts.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Regimes Analyzed</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{totalEvents.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best Regime</div>
            <div className="stat-value positive">
              {bestRegime ? getRegimeLabel(bestRegime.vol_regime) : '-'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best Markout</div>
            <div className="stat-value positive">
              {bestRegime ? formatMarkout(bestRegime.avg_markout_60m) : '-'}
            </div>
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
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                  Analyze Regimes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Regime Cards */}
      {data.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)'
        }}>
          {data.map((row) => {
            const isPositive = row.avg_markout_60m >= 0;
            const isBest = bestRegime && row.vol_regime === bestRegime.vol_regime;
            
            return (
              <div 
                key={row.vol_regime}
                className="card"
                style={{
                  borderColor: isBest ? 'var(--accent-success)' : undefined,
                  background: isBest ? 'var(--accent-success-dim)' : undefined
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-lg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <span style={{ fontSize: '2rem' }}>{getRegimeIcon(row.vol_regime)}</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>
                        {getRegimeLabel(row.vol_regime)}
                      </h3>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Tercile {row.vol_regime} of 3
                      </span>
                    </div>
                  </div>
                  {isBest && (
                    <span className="badge badge-success">Best</span>
                  )}
                </div>

                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: 'var(--space-sm)',
                    fontSize: '0.8rem'
                  }}>
                    <span className="text-muted">Avg 60m Markout</span>
                    <span className={`font-mono ${isPositive ? 'value-positive' : 'value-negative'}`} style={{ fontWeight: 600 }}>
                      {formatMarkout(row.avg_markout_60m)}
                    </span>
                  </div>
                  <div style={{
                    height: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.abs(row.avg_markout_60m) / maxAbs * 100}%`,
                      height: '100%',
                      background: isPositive 
                        ? 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))'
                        : 'linear-gradient(90deg, var(--accent-danger), #ff6b6b)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Events</span>
                  <span className="font-mono" style={{ fontWeight: 600 }}>
                    {row.n_events.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Volatility Regime Comparison</h3>
          {data.length > 0 && (
            <span className="badge badge-info">{data.length} regimes</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Regime</th>
                <th>Description</th>
                <th className="text-right">Avg 60m Markout</th>
                <th className="text-right"># Events</th>
                <th className="text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.vol_regime}>
                  <td>
                    <span style={{ fontSize: '1.25rem', marginRight: '8px' }}>{getRegimeIcon(row.vol_regime)}</span>
                    <span className="font-mono" style={{ fontWeight: 600 }}>R{row.vol_regime}</span>
                  </td>
                  <td>
                    <span className={`badge ${row.vol_regime === 1 ? 'badge-info' : row.vol_regime === 2 ? 'badge-warning' : 'badge-danger'}`}>
                      {getRegimeLabel(row.vol_regime)}
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
                      <span className="badge badge-success">Trade</span>
                    ) : row.avg_markout_60m < -0.0005 ? (
                      <span className="badge badge-danger">Avoid</span>
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
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                      <p>Select date range and click Analyze Regimes.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Analyzing volatility regimes...</p>
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

export default VolatilityRegimesPage;

