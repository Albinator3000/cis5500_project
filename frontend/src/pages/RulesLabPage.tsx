import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PositiveMovesRow {
  symbol: string;
  n_positive_moves: number;
}

const BeakerIcon = () => (
  <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 3h15"></path>
    <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"></path>
    <path d="M6 14h12"></path>
  </svg>
);

const PlayIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const EmptyIcon = () => (
  <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
  </svg>
);

const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
  </svg>
);

const RulesLabPage: React.FC = () => {
  const [startTs, setStartTs] = useState('2024-01-01T00:00:00Z');
  const [endTs, setEndTs] = useState('2024-01-31T23:59:59Z');
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
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalMoves = data.reduce((sum, row) => sum + row.n_positive_moves, 0);
  const avgMoves = data.length > 0 ? totalMoves / data.length : 0;
  const topPerformer = data.length > 0 ? data[0] : null;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <BeakerIcon />
          Rules Lab
        </h1>
        <p className="page-description">
          Backtest trading rules by counting how often the 30-minute CAR exceeds your threshold 
          after funding events. Discover consistent momentum patterns.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Symbols Analyzed</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Positive Moves</div>
            <div className="stat-value positive">{totalMoves.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg per Symbol</div>
            <div className="stat-value">{avgMoves.toFixed(1)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Top Performer</div>
            <div className="stat-value text-accent" style={{ fontSize: '1.2rem' }}>
              {topPerformer ? topPerformer.symbol : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Backtest Parameters</h3>
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
            <label className="form-label">CAR Threshold</label>
            <input
              className="form-input"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              step={0.001}
              min={0}
            />
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner" />
                  Testing...
                </>
              ) : (
                <>
                  <PlayIcon />
                  Run Backtest
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Backtest Results</h3>
          {data.length > 0 && (
            <span className="badge badge-success">{data.length} symbols</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Rank</th>
                <th>Symbol</th>
                <th className="text-right"># Positive Moves</th>
                <th className="text-center">Performance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => {
                const maxMoves = data[0]?.n_positive_moves || 1;
                const percentage = (row.n_positive_moves / maxMoves) * 100;
                
                return (
                  <tr key={row.symbol}>
                    <td>
                      {index < 3 ? (
                        <span style={{ 
                          color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f32',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <TrophyIcon />
                        </span>
                      ) : (
                        <span className="text-muted">#{index + 1}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info">{row.symbol}</span>
                    </td>
                    <td className="text-right font-mono value-positive">
                      {row.n_positive_moves.toLocaleString()}
                    </td>
                    <td style={{ width: '200px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)'
                      }}>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-full)',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, var(--accent-primary), var(--accent-success))`,
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <span className="font-mono text-muted" style={{ fontSize: '0.75rem', minWidth: '40px' }}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <EmptyIcon />
                      <p>No results yet. Set your parameters and run the backtest.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Running backtest...</p>
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

export default RulesLabPage;
