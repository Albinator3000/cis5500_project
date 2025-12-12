import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SymbolOverviewRow {
  symbol: string;
  n_klines: number;
  n_funding_events: number;
  avg_kline_volume: number;
}

const SymbolDashboardPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [data, setData] = useState<SymbolOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<SymbolOverviewRow[]>(`${API_BASE}/api/symbol_overview`, {
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

  const formatVolume = (value: number) => {
    if (!value) return '-';
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  // Calculate stats
  const totalKlines = data.reduce((sum, row) => sum + row.n_klines, 0);
  const totalFunding = data.reduce((sum, row) => sum + row.n_funding_events, 0);
  const avgVolume = data.length > 0 
    ? data.reduce((sum, row) => sum + (row.avg_kline_volume || 0), 0) / data.length 
    : 0;
  const activeSymbols = data.filter(row => row.n_klines > 0).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          Symbol Dashboard
        </h1>
        <p className="page-description">
          View aggregated statistics across all symbols using pre-computed <code>mv_symbol_daily_stats</code>.
          15-20x faster than on-the-fly aggregations.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Active Symbols</div>
            <div className="stat-value">{activeSymbols}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Klines</div>
            <div className="stat-value">{totalKlines.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Funding Events</div>
            <div className="stat-value">{totalFunding.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Volume</div>
            <div className="stat-value">{formatVolume(avgVolume)}</div>
          </div>
        </div>
      )}

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Query Parameters</h3>
          <span className="badge badge-success">⚡ &lt;1s</span>
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
                  Loading...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Load Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Symbol Overview</h3>
          {data.length > 0 && (
            <span className="badge badge-info">{data.length} symbols</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="text-right"># Klines</th>
                <th className="text-right"># Funding Events</th>
                <th className="text-right">Avg Volume</th>
                <th className="text-center">Data Quality</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const hasData = row.n_klines > 0;
                const hasFunding = row.n_funding_events > 0;
                const quality = hasData && hasFunding ? 'good' : hasData ? 'partial' : 'missing';
                
                return (
                  <tr key={row.symbol}>
                    <td>
                      <span className="badge badge-info">{row.symbol}</span>
                    </td>
                    <td className="text-right font-mono">
                      {row.n_klines.toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      {row.n_funding_events.toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      {formatVolume(row.avg_kline_volume)}
                    </td>
                    <td className="text-center">
                      {quality === 'good' ? (
                        <span className="badge badge-success">Complete</span>
                      ) : quality === 'partial' ? (
                        <span className="badge badge-warning">Partial</span>
                      ) : (
                        <span className="badge badge-danger">Missing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                      </svg>
                      <p>No data loaded. Select a date range and click Load Data.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Loading symbol data...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Database Info Card */}
      {data.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="card-header">
            <h3 className="card-title">Materialized View Info</h3>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-lg)'
          }}>
            <div style={{
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Source View
              </div>
              <div className="font-mono" style={{ color: 'var(--accent-primary)' }}>
                mv_symbol_daily_stats
              </div>
            </div>
            <div style={{
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Optimization
              </div>
              <div className="font-mono">
                Pre-aggregated daily stats
              </div>
            </div>
            <div style={{
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Date Range
              </div>
              <div className="font-mono" style={{ fontSize: '0.85rem' }}>
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SymbolDashboardPage;

