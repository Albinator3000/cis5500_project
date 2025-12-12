import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HourlyRow {
  funding_hour: number;
  avg_markout_60m: number;
  n_events: number;
}

const HourlyAnalysisPage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [data, setData] = useState<HourlyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<HourlyRow[]>(`${API_BASE}/api/hourly_markouts`, {
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

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
  };

  // Calculate stats
  const totalEvents = data.reduce((sum, row) => sum + row.n_events, 0);
  const bestHour = data.length > 0 ? data.reduce((best, row) => row.avg_markout_60m > best.avg_markout_60m ? row : best) : null;
  const worstHour = data.length > 0 ? data.reduce((worst, row) => row.avg_markout_60m < worst.avg_markout_60m ? row : worst) : null;
  const maxAbs = data.length > 0 ? Math.max(...data.map(d => Math.abs(d.avg_markout_60m))) : 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Hour-of-Day Analysis
        </h1>
        <p className="page-description">
          Discover optimal trading hours by analyzing 60-minute markouts by funding event hour.
          Uses pre-computed <code>mv_event_markouts</code> for sub-second queries.
        </p>
      </div>

      {/* Stats Cards */}
      {data.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Hours Analyzed</div>
            <div className="stat-value">{data.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{totalEvents.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best Hour</div>
            <div className="stat-value positive">
              {bestHour ? formatHour(bestHour.funding_hour) : '-'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Worst Hour</div>
            <div className="stat-value negative">
              {worstHour ? formatHour(worstHour.funding_hour) : '-'}
            </div>
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
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Analyze Hours
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 24-Hour Clock Visualization */}
      {data.length > 0 && (
        <div className="card mb-xl">
          <div className="card-header">
            <h3 className="card-title">24-Hour Markout Heatmap</h3>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(12, 1fr)', 
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-lg)'
          }}>
            {data.slice(0, 12).map((row) => {
              const intensity = Math.abs(row.avg_markout_60m) / maxAbs;
              const isPositive = row.avg_markout_60m >= 0;
              return (
                <div key={row.funding_hour} style={{
                  background: isPositive 
                    ? `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`
                    : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {formatHour(row.funding_hour)}
                  </div>
                  <div className={`font-mono ${isPositive ? 'value-positive' : 'value-negative'}`} style={{ fontSize: '0.75rem' }}>
                    {formatMarkout(row.avg_markout_60m)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(12, 1fr)', 
            gap: 'var(--space-sm)'
          }}>
            {data.slice(12, 24).map((row) => {
              const intensity = Math.abs(row.avg_markout_60m) / maxAbs;
              const isPositive = row.avg_markout_60m >= 0;
              return (
                <div key={row.funding_hour} style={{
                  background: isPositive 
                    ? `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`
                    : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {formatHour(row.funding_hour)}
                  </div>
                  <div className={`font-mono ${isPositive ? 'value-positive' : 'value-negative'}`} style={{ fontSize: '0.75rem' }}>
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
          <h3 className="card-title">Hourly Analysis</h3>
          {data.length > 0 && (
            <span className="badge badge-info">{data.length} hours</span>
          )}
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour (UTC)</th>
                <th>Time</th>
                <th className="text-right">Avg 60m Markout</th>
                <th className="text-right"># Events</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const barWidth = Math.abs(row.avg_markout_60m) / maxAbs * 100;
                const isPositive = row.avg_markout_60m >= 0;
                const isBest = bestHour && row.funding_hour === bestHour.funding_hour;
                const isWorst = worstHour && row.funding_hour === worstHour.funding_hour;
                
                return (
                  <tr key={row.funding_hour} style={{ 
                    background: isBest ? 'var(--accent-success-dim)' : isWorst ? 'var(--accent-danger-dim)' : undefined 
                  }}>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600 }}>
                        {String(row.funding_hour).padStart(2, '0')}:00
                      </span>
                      {isBest && <span className="badge badge-success" style={{ marginLeft: '8px' }}>Best</span>}
                      {isWorst && <span className="badge badge-danger" style={{ marginLeft: '8px' }}>Worst</span>}
                    </td>
                    <td>
                      <span className="text-muted">{formatHour(row.funding_hour)}</span>
                    </td>
                    <td className={`text-right font-mono ${isPositive ? 'value-positive' : 'value-negative'}`}>
                      {formatMarkout(row.avg_markout_60m)}
                    </td>
                    <td className="text-right font-mono">
                      {row.n_events.toLocaleString()}
                    </td>
                    <td style={{ width: '150px' }}>
                      <div style={{
                        height: '8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          background: isPositive 
                            ? 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))'
                            : 'linear-gradient(90deg, var(--accent-danger), #ff6b6b)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <p>Select date range and click Analyze Hours.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Analyzing hourly patterns...</p>
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

export default HourlyAnalysisPage;

