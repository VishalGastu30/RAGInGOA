import React from 'react';

export default function GuardrailLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="card">
        <div className="card-title">🛡️ Live Guardrail Trace</div>
        <div className="no-logs">No decisions logged yet</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxHeight: '280px', overflowY: 'auto' }}>
      <div className="card-title">🛡️ Live Guardrail Trace</div>
      {logs.map((log) => {
        const typeClass = log.cache_hit
          ? 'cached'
          : log.answered
          ? 'answered'
          : 'refused';
        const label = log.cache_hit
          ? '⚡ CACHED'
          : log.answered
          ? '✅ ANSWERED'
          : '⛔ REFUSED';

        return (
          <div key={log.id || Math.random()} className={`log-entry ${typeClass}`}>
            <div className="log-query" title={log.query_text}>
              "{log.query_text}"
            </div>
            <div className="log-meta">
              <span className={`log-status ${typeClass}`}>{label}</span>
              {log.refusal_reason && (
                <span style={{ color: 'var(--accent-rose)' }}>{log.refusal_reason}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
