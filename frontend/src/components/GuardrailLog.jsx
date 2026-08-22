import React from 'react';

export default function GuardrailLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="telemetry-card">
        <div className="telemetry-card-title">LIVE GUARDRAIL TRACE</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No guardrail decisions logged yet</div>
      </div>
    );
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="telemetry-card">
      <div className="telemetry-card-title">LIVE GUARDRAIL TRACE</div>
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span className={`log-status-tag ${typeClass}`}>{label}</span>
              {log.top_retrieval_score != null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-cyan)' }}>
                  SCORE: {Math.round(log.top_retrieval_score * 100)}%
                </span>
              )}
              {log.refusal_reason && (
                <span style={{ color: 'var(--accent-rose)', fontSize: 10 }}>
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
