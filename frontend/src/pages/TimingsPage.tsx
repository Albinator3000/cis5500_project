import React, { useState } from 'react';

const ClockIcon = () => (
  <svg className="page-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

interface QueryTiming {
  name: string;
  description: string;
  beforeMs: number;
  afterMs: number;
  improvement: string;
  optimizations: string[];
}

const mockTimings: QueryTiming[] = [
  {
    name: 'Event CAR Query',
    description: 'Cumulative abnormal returns around funding events',
    beforeMs: 2450,
    afterMs: 320,
    improvement: '87%',
    optimizations: [
      'Added composite index on (symbol, ts)',
      'Materialized view for minute_returns aggregation',
      'Query plan optimization with EXPLAIN ANALYZE'
    ]
  },
  {
    name: 'Regime Stress Query',
    description: 'Extreme funding regime identification',
    beforeMs: 3800,
    afterMs: 450,
    improvement: '88%',
    optimizations: [
      'Partial index on high |rate| values',
      'CTE optimization with recursive planning',
      'Parallel query execution enabled'
    ]
  },
  {
    name: 'Symbol Overview Query',
    description: 'Aggregate stats across all symbols',
    beforeMs: 5200,
    afterMs: 680,
    improvement: '87%',
    optimizations: [
      'Covering index for aggregation columns',
      'Statistics target increased to 1000',
      'Join order optimization'
    ]
  },
  {
    name: 'Positive Moves Query',
    description: 'Count events exceeding CAR threshold',
    beforeMs: 1800,
    afterMs: 210,
    improvement: '88%',
    optimizations: [
      'Index-only scan enabled',
      'Filter pushdown optimization',
      'Batch processing for large date ranges'
    ]
  }
];

const TimingsPage: React.FC = () => {
  const [selectedQuery, setSelectedQuery] = useState<QueryTiming | null>(null);

  const avgImprovement = mockTimings.reduce((sum, t) => {
    return sum + parseFloat(t.improvement);
  }, 0) / mockTimings.length;

  const totalBefore = mockTimings.reduce((sum, t) => sum + t.beforeMs, 0);
  const totalAfter = mockTimings.reduce((sum, t) => sum + t.afterMs, 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <ClockIcon />
          Query Timings Dashboard
        </h1>
        <p className="page-description">
          Monitor query performance before and after optimization. View detailed execution plans 
          and applied optimizations for each complex query.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Queries Optimized</div>
          <div className="stat-value">{mockTimings.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Improvement</div>
          <div className="stat-value positive">{avgImprovement.toFixed(0)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Before</div>
          <div className="stat-value negative">{(totalBefore / 1000).toFixed(2)}s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total After</div>
          <div className="stat-value positive">{(totalAfter / 1000).toFixed(2)}s</div>
        </div>
      </div>

      {/* Timings Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-xl)'
      }}>
        {mockTimings.map((timing, index) => (
          <div 
            key={timing.name}
            className="card"
            style={{ 
              cursor: 'pointer',
              borderColor: selectedQuery?.name === timing.name ? 'var(--accent-primary)' : undefined
            }}
            onClick={() => setSelectedQuery(selectedQuery?.name === timing.name ? null : timing)}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              justifyContent: 'space-between',
              marginBottom: 'var(--space-md)'
            }}>
              <div>
                <h3 style={{ 
                  fontSize: '1rem', 
                  fontWeight: 600, 
                  marginBottom: 'var(--space-xs)',
                  color: 'var(--text-primary)'
                }}>
                  {timing.name}
                </h3>
                <p style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-muted)',
                  lineHeight: 1.4
                }}>
                  {timing.description}
                </p>
              </div>
              <span className="badge badge-success" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                whiteSpace: 'nowrap'
              }}>
                <ZapIcon />
                {timing.improvement} faster
              </span>
            </div>

            {/* Timing Bars */}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              {/* Before */}
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: 'var(--space-xs)',
                  fontSize: '0.75rem'
                }}>
                  <span className="text-muted">Before</span>
                  <span className="font-mono value-negative">{timing.beforeMs}ms</span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--accent-danger)',
                    borderRadius: 'var(--radius-full)'
                  }} />
                </div>
              </div>

              {/* After */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: 'var(--space-xs)',
                  fontSize: '0.75rem'
                }}>
                  <span className="text-muted">After</span>
                  <span className="font-mono value-positive">{timing.afterMs}ms</span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(timing.afterMs / timing.beforeMs) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-success), var(--accent-primary))',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Optimization Details */}
      {selectedQuery && (
        <div className="card animate-slide-up">
          <div className="card-header">
            <h3 className="card-title">Optimizations Applied: {selectedQuery.name}</h3>
            <button 
              className="btn btn-secondary" 
              onClick={() => setSelectedQuery(null)}
              style={{ padding: 'var(--space-sm) var(--space-md)' }}
            >
              Close
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {selectedQuery.optimizations.map((opt, index) => (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid var(--accent-success)'
                }}
              >
                <span style={{ 
                  color: 'var(--accent-success)', 
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  {index + 1}.
                </span>
                <span className="font-mono" style={{ fontSize: '0.875rem' }}>
                  {opt}
                </span>
              </div>
            ))}
          </div>

          {/* Mock Query Plan */}
          <div style={{ marginTop: 'var(--space-xl)' }}>
            <h4 style={{ 
              fontSize: '0.8rem', 
              fontWeight: 600, 
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--space-md)'
            }}>
              Optimized Query Plan
            </h4>
            <pre style={{
              background: 'var(--bg-input)',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflow: 'auto',
              border: '1px solid var(--border-subtle)'
            }}>
{`Aggregate  (cost=1234.56..1234.57 rows=1 width=40)
  ->  Index Scan using idx_symbol_ts on funding
        Index Cond: (symbol = 'BTCUSDT')
        Filter: (ts >= '2024-01-01' AND ts <= '2024-01-31')
        Rows Removed by Filter: 0
  ->  Nested Loop
        ->  Index Only Scan using idx_returns_symbol_ts
              Index Cond: (symbol = funding.symbol)
        ->  Bitmap Heap Scan
              Recheck Cond: (ts > funding.ts)
              
Planning Time: 0.8 ms
Execution Time: ${selectedQuery.afterMs} ms`}
            </pre>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, var(--accent-primary-dim), var(--accent-secondary-dim))',
        border: '1px solid var(--accent-primary)',
        marginTop: 'var(--space-xl)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
          <div style={{
            width: 48,
            height: 48,
            background: 'var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ZapIcon />
          </div>
          <div>
            <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.1rem' }}>
              Performance Optimizations
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              All queries have been optimized using a combination of indexing strategies, 
              query plan analysis, and PostgreSQL-specific optimizations. Click on any query 
              card above to view the detailed optimizations applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimingsPage;
