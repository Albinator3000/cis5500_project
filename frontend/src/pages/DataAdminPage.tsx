import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

interface SymbolOverviewRow {
  symbol: string;
  n_klines: number;
  n_funding_events: number;
  avg_kline_volume: number;
}

const DatabaseIcon = () => (
  <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
);

const PlayIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const EmptyIcon = () => (
  <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
  </svg>
);

const DataAdminPage: React.FC = () => {
  const [startTs, setStartTs] = useState('2024-01-01T00:00:00Z');
  const [endTs, setEndTs] = useState('2024-01-31T23:59:59Z');
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
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value?.toFixed(2) || '-';
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
          <DatabaseIcon />
          Data Administration
        </h1>
        <p className="page-description">
          Monitor data quality and coverage across all symbols. View row counts, funding events, 
          and liquidity metrics for your selected date range.
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
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner" />
                  Loading...
                </>
              ) : (
                <>
                  <PlayIcon />
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
                      <EmptyIcon />
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
            <h3 className="card-title">Database Information</h3>
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
                Database
              </div>
              <div className="font-mono" style={{ color: 'var(--accent-primary)' }}>
                PostgreSQL (AWS RDS)
              </div>
            </div>
            <div style={{
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Tables
              </div>
              <div className="font-mono">
                symbols, klines, funding, minute_returns
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
                {new Date(startTs).toLocaleDateString()} - {new Date(endTs).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataAdminPage;
