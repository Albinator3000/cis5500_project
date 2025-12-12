import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface QueryResult {
  name: string;
  slowTime: number | null;
  fastTime: number | null;
  improvement: number | null;
  status: 'idle' | 'running-slow' | 'running-fast' | 'complete' | 'error';
}

const QueryPerformancePage: React.FC = () => {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [results, setResults] = useState<QueryResult[]>([
    { name: 'Event CAR', slowTime: null, fastTime: null, improvement: null, status: 'idle' },
    { name: 'Funding Deciles', slowTime: null, fastTime: null, improvement: null, status: 'idle' },
    { name: 'Hourly Markouts', slowTime: null, fastTime: null, improvement: null, status: 'idle' },
    { name: 'Volatility Regimes', slowTime: null, fastTime: null, improvement: null, status: 'idle' },
    { name: 'Symbol Overview', slowTime: null, fastTime: null, improvement: null, status: 'idle' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const runBenchmark = async (index: number) => {
    const query = results[index];
    const params = {
      start_ts: `${startDate}T00:00:00Z`,
      end_ts: `${endDate}T23:59:59Z`,
    };

    // Update status to running-slow
    setResults(prev => prev.map((r, i) => i === index ? { ...r, status: 'running-slow' as const } : r));

    try {
      // Run SLOW query
      let slowRes;
      switch (query.name) {
        case 'Event CAR':
          slowRes = await axios.get(`${API_BASE}/api/slow/event_car`, { params: { ...params, symbol } });
          break;
        case 'Funding Deciles':
          slowRes = await axios.get(`${API_BASE}/api/slow/funding_deciles`, { params });
          break;
        case 'Hourly Markouts':
          slowRes = await axios.get(`${API_BASE}/api/slow/hourly_markouts`, { params });
          break;
        case 'Volatility Regimes':
          slowRes = await axios.get(`${API_BASE}/api/slow/vol_regime_markouts`, { params });
          break;
        case 'Symbol Overview':
          slowRes = await axios.get(`${API_BASE}/api/slow/symbol_overview`, { params });
          break;
        default:
          throw new Error('Unknown query');
      }
      const slowTime = slowRes.data.execution_time_ms;

      // Update with slow time and status to running-fast
      setResults(prev => prev.map((r, i) => i === index ? { ...r, slowTime, status: 'running-fast' as const } : r));

      // Run FAST query
      let fastRes;
      switch (query.name) {
        case 'Event CAR':
          fastRes = await axios.get(`${API_BASE}/api/fast/event_car`, { params: { ...params, symbol } });
          break;
        case 'Funding Deciles':
          fastRes = await axios.get(`${API_BASE}/api/fast/funding_deciles`, { params });
          break;
        case 'Hourly Markouts':
          fastRes = await axios.get(`${API_BASE}/api/fast/hourly_markouts`, { params });
          break;
        case 'Volatility Regimes':
          fastRes = await axios.get(`${API_BASE}/api/fast/vol_regime_markouts`, { params });
          break;
        case 'Symbol Overview':
          fastRes = await axios.get(`${API_BASE}/api/fast/symbol_overview`, { params });
          break;
        default:
          throw new Error('Unknown query');
      }
      const fastTime = fastRes.data.execution_time_ms;

      // Calculate improvement
      const improvement = ((slowTime - fastTime) / slowTime) * 100;

      // Update with final results
      setResults(prev => prev.map((r, i) => i === index ? { 
        ...r, 
        fastTime, 
        improvement,
        status: 'complete' as const 
      } : r));

    } catch (error) {
      console.error(error);
      setResults(prev => prev.map((r, i) => i === index ? { ...r, status: 'error' as const } : r));
    }
  };

  const runAllBenchmarks = async () => {
    setIsRunning(true);
    // Reset all results
    setResults(prev => prev.map(r => ({ ...r, slowTime: null, fastTime: null, improvement: null, status: 'idle' as const })));

    for (let i = 0; i < results.length; i++) {
      await runBenchmark(i);
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    setIsRunning(false);
  };

  // Calculate summary stats
  const completedResults = results.filter(r => r.status === 'complete');
  const avgImprovement = completedResults.length > 0
    ? completedResults.reduce((sum, r) => sum + (r.improvement || 0), 0) / completedResults.length
    : 0;
  const totalSlowTime = completedResults.reduce((sum, r) => sum + (r.slowTime || 0), 0);
  const totalFastTime = completedResults.reduce((sum, r) => sum + (r.fastTime || 0), 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Query Performance Benchmark
        </h1>
        <p className="page-description">
          Live comparison of SLOW (unoptimized) vs FAST (materialized view) queries.
          Run benchmarks to see real execution times from your database.
        </p>
      </div>

      {/* Summary Stats */}
      {completedResults.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Queries Tested</div>
            <div className="stat-value">{completedResults.length}/{results.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Improvement</div>
            <div className="stat-value positive">{avgImprovement.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Slow Time</div>
            <div className="stat-value negative">{(totalSlowTime / 1000).toFixed(2)}s</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Fast Time</div>
            <div className="stat-value positive">{(totalFastTime / 1000).toFixed(2)}s</div>
          </div>
        </div>
      )}

      {/* Benchmark Controls */}
      <div className="card mb-xl">
        <div className="card-header">
          <h3 className="card-title">Benchmark Parameters</h3>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Symbol (for CAR)</label>
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
            <button 
              className="btn btn-primary" 
              onClick={runAllBenchmarks} 
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <div className="loading-spinner" />
                  Running...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  Run All Benchmarks
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Benchmark Results */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-xl)'
      }}>
        {results.map((result, index) => (
          <div 
            key={result.name}
            className="card"
            style={{
              borderColor: result.status === 'complete' ? 'var(--accent-success)' : 
                           result.status === 'error' ? 'var(--accent-danger)' : undefined
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--space-lg)'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{result.name}</h3>
              {result.status === 'complete' && result.improvement && (
                <span className="badge badge-success">
                  ⚡ {result.improvement.toFixed(0)}% faster
                </span>
              )}
              {(result.status === 'running-slow' || result.status === 'running-fast') && (
                <div className="loading-spinner" style={{ width: 20, height: 20 }} />
              )}
              {result.status === 'error' && (
                <span className="badge badge-danger">Error</span>
              )}
            </div>

            {/* SLOW Query Bar */}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: 'var(--space-xs)',
                fontSize: '0.8rem'
              }}>
                <span className="text-muted">
                  SLOW (Unoptimized)
                  {result.status === 'running-slow' && ' ⏳'}
                </span>
                <span className={`font-mono ${result.slowTime ? 'value-negative' : 'text-muted'}`}>
                  {result.slowTime ? `${result.slowTime.toFixed(0)}ms` : '—'}
                </span>
              </div>
              <div style={{
                height: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}>
                {result.slowTime && (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--accent-danger)',
                    borderRadius: 'var(--radius-full)',
                    animation: 'slideIn 0.5s ease'
                  }} />
                )}
              </div>
            </div>

            {/* FAST Query Bar */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: 'var(--space-xs)',
                fontSize: '0.8rem'
              }}>
                <span className="text-muted">
                  FAST (Materialized Views)
                  {result.status === 'running-fast' && ' ⏳'}
                </span>
                <span className={`font-mono ${result.fastTime ? 'value-positive' : 'text-muted'}`}>
                  {result.fastTime ? `${result.fastTime.toFixed(0)}ms` : '—'}
                </span>
              </div>
              <div style={{
                height: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}>
                {result.fastTime && result.slowTime && (
                  <div style={{
                    width: `${(result.fastTime / result.slowTime) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s ease'
                  }} />
                )}
              </div>
            </div>

            {/* Speedup Factor */}
            {result.status === 'complete' && result.slowTime && result.fastTime && (
              <div style={{
                padding: 'var(--space-md)',
                background: 'var(--accent-success-dim)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center'
              }}>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                  {(result.slowTime / result.fastTime).toFixed(1)}x
                </span>
                <span className="text-muted" style={{ fontSize: '0.8rem', marginLeft: '8px' }}>
                  speedup
                </span>
              </div>
            )}

            {result.status === 'idle' && (
              <div style={{
                padding: 'var(--space-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                Click "Run All Benchmarks" to test
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Optimization Info */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, var(--accent-primary-dim), var(--accent-success-dim))',
        border: '1px solid var(--accent-primary)'
      }}>
        <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h3 className="card-title">Optimization Strategies</h3>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-md)'
        }}>
          <div style={{ padding: 'var(--space-md)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
              📊 Materialized Views
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Pre-compute expensive joins and aggregations once, reuse instantly.
            </p>
          </div>
          <div style={{ padding: 'var(--space-md)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
              🎯 Early Filtering
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Apply date/symbol filters immediately on indexed columns.
            </p>
          </div>
          <div style={{ padding: 'var(--space-md)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
              🔗 Strategic Indexes
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Composite indexes on (symbol, ts) for optimal temporal queries.
            </p>
          </div>
          <div style={{ padding: 'var(--space-md)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
              ⚡ Window Functions
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Replace correlated subqueries with O(n log n) window operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryPerformancePage;

