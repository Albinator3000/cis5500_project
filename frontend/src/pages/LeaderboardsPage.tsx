import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FundingPressureRow {
  symbol: string;
  avg_abs_rate: number;
  n_events: number;
}

interface PostEventVolRow {
  symbol: string;
  avg_rv_30m: number;
  n_events: number;
}

interface PositiveMovesRow {
  symbol: string;
  n_positive_moves: number;
}

type TabType = 'pressure' | 'volatility' | 'momentum';

const LeaderboardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('pressure');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [minEvents, setMinEvents] = useState(10);
  const [topK, setTopK] = useState(15);
  
  const [pressureData, setPressureData] = useState<FundingPressureRow[]>([]);
  const [volData, setVolData] = useState<PostEventVolRow[]>([]);
  const [momentumData, setMomentumData] = useState<PositiveMovesRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPressure = async () => {
    setLoading(true);
    try {
      const res = await axios.get<FundingPressureRow[]>(`${API_BASE}/api/funding_pressure`, {
        params: { 
          start_ts: `${startDate}T00:00:00Z`, 
          end_ts: `${endDate}T23:59:59Z`,
          min_events: minEvents,
          top_k: topK
        },
      });
      setPressureData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVolatility = async () => {
    setLoading(true);
    try {
      const res = await axios.get<PostEventVolRow[]>(`${API_BASE}/api/post_event_volatility`, {
        params: { 
          start_ts: `${startDate}T00:00:00Z`, 
          end_ts: `${endDate}T23:59:59Z`
        },
      });
      setVolData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMomentum = async () => {
    setLoading(true);
    try {
      const res = await axios.get<PositiveMovesRow[]>(`${API_BASE}/api/positive_moves`, {
        params: { 
          start_ts: `${startDate}T00:00:00Z`, 
          end_ts: `${endDate}T23:59:59Z`,
          threshold: 0.0
        },
      });
      setMomentumData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = () => {
    if (activeTab === 'pressure') fetchPressure();
    else if (activeTab === 'volatility') fetchVolatility();
    else fetchMomentum();
  };

  const formatRate = (value: number) => {
    return `${(value * 100).toFixed(4)}%`;
  };

  const formatVol = (value: number) => {
    return `${(value * 100).toFixed(4)}%`;
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return '#ffd700';
    if (index === 1) return '#c0c0c0';
    if (index === 2) return '#cd7f32';
    return 'var(--text-muted)';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
          </svg>
          Leaderboards
        </h1>
        <p className="page-description">
          Rank symbols by funding pressure, post-event volatility, and momentum patterns.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-sm)', 
        marginBottom: 'var(--space-xl)',
        background: 'var(--bg-card)',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)'
      }}>
        <button 
          className={`btn ${activeTab === 'pressure' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pressure')}
          style={{ flex: 1 }}
        >
          💰 Funding Pressure
        </button>
        <button 
          className={`btn ${activeTab === 'volatility' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('volatility')}
          style={{ flex: 1 }}
        >
          📈 Post-Event Vol
        </button>
        <button 
          className={`btn ${activeTab === 'momentum' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('momentum')}
          style={{ flex: 1 }}
        >
          🚀 Momentum
        </button>
      </div>

      {/* Query Form */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">
            {activeTab === 'pressure' && 'Funding Pressure Rankings'}
            {activeTab === 'volatility' && 'Post-Event Volatility Rankings'}
            {activeTab === 'momentum' && 'Positive Momentum Rankings'}
          </h3>
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
          {activeTab === 'pressure' && (
            <>
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
                  max={50}
                />
              </div>
            </>
          )}
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleFetch} disabled={loading}>
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
                  Load Rankings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Funding Pressure Results */}
      {activeTab === 'pressure' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Highest Funding Pressure</h3>
            {pressureData.length > 0 && (
              <span className="badge badge-warning">{pressureData.length} symbols</span>
            )}
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Symbol</th>
                  <th className="text-right">Avg |Rate|</th>
                  <th className="text-right"># Events</th>
                </tr>
              </thead>
              <tbody>
                {pressureData.map((row, index) => (
                  <tr key={row.symbol}>
                    <td>
                      <span style={{ color: getMedalColor(index), fontWeight: 700 }}>
                        #{index + 1}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">{row.symbol}</span>
                    </td>
                    <td className="text-right font-mono value-warning">
                      {formatRate(row.avg_abs_rate)}
                    </td>
                    <td className="text-right font-mono">
                      {row.n_events.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {pressureData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <p>Click Load Rankings to see results.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Post-Event Volatility Results */}
      {activeTab === 'volatility' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Highest Post-Event Volatility</h3>
            {volData.length > 0 && (
              <span className="badge badge-danger">{volData.length} symbols</span>
            )}
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Symbol</th>
                  <th className="text-right">Avg 30m Vol</th>
                  <th className="text-right"># Events</th>
                </tr>
              </thead>
              <tbody>
                {volData.slice(0, 20).map((row, index) => (
                  <tr key={row.symbol}>
                    <td>
                      <span style={{ color: getMedalColor(index), fontWeight: 700 }}>
                        #{index + 1}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">{row.symbol}</span>
                    </td>
                    <td className="text-right font-mono value-negative">
                      {formatVol(row.avg_rv_30m)}
                    </td>
                    <td className="text-right font-mono">
                      {row.n_events.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {volData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <p>Click Load Rankings to see results.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positive Momentum Results */}
      {activeTab === 'momentum' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Most Positive Momentum Events</h3>
            {momentumData.length > 0 && (
              <span className="badge badge-success">{momentumData.length} symbols</span>
            )}
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Symbol</th>
                  <th className="text-right"># Positive Moves</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {momentumData.slice(0, 20).map((row, index) => {
                  const maxMoves = momentumData[0]?.n_positive_moves || 1;
                  const percentage = (row.n_positive_moves / maxMoves) * 100;
                  
                  return (
                    <tr key={row.symbol}>
                      <td>
                        <span style={{ color: getMedalColor(index), fontWeight: 700 }}>
                          #{index + 1}
                        </span>
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
                              background: 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))',
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
                {momentumData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <p>Click Load Rankings to see results.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardsPage;

