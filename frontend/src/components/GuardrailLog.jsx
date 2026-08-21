import React from 'react';

export default function GuardrailLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="card">
        <div className="card-title">[LIVE GUARDRAIL TRACE]</div>
        <div className="no-logs">No decisions logged yet</div>
      </div>
    );
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="card" style={{ maxHeight: '280px', overflowY: 'auto' }}>
      <div className="card-title">[LIVE GUARDRAIL TRACE]</div>
      {logs.map((log) => {
        const typeClass = log.cache_hit
          ? 'cached'
          : log.answered
          ? 'answered'
          : 'refused';
        const label = log.cache_hit
          ? 'CACHED'
          : log.answered
          ? 'ANSWERED'
          : 'REFUSED';

        return (
          <div key={log.id || Math.random()} className={`log-entry ${typeClass}`}>
            <div className="log-header-row">
              <span className="log-query" title={log.query_text}>
                "{log.query_text}"
              </span>
              {log.timestamp && (
                <span className="log-time">{formatTimestamp(log.timestamp)}</span>
              )}
            </div>
            <div className="log-meta">
              <span className={`log-status ${typeClass}`}>{label}</span>
              {log.top_retrieval_score != null && (
                <span className="log-score-badge">
                  SCORE: {Math.round(log.top_retrieval_score * 100)}%
                </span>
              )}
              {log.refusal_reason && (
                <span style={{ color: 'var(--accent-rose)', fontSize: '11px' }}>
                  {log.refusal_reason}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
