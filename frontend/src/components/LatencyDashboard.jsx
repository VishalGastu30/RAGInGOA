import React from 'react';

export default function LatencyDashboard({ timings, stats }) {
  if (!timings && !stats) {
    return (
      <div className="card">
        <div className="card-title">⚡ Latency Breakdown</div>
        <div className="no-timings">Ask a question to see real-time stage timings</div>
      </div>
    );
  }

  const getTimingClass = (ms) => {
    if (ms < 100) return 'timing-fast';
    if (ms < 500) return 'timing-mid';
    return 'timing-slow';
  };

  return (
    <div className="card">
      <div className="card-title">⚡ Stage Latencies (Last Query)</div>
      {timings ? (
        <>
          <div className="timing-row">
            <span className="timing-label"><span className="icon">🎙️</span> Speech-to-Text (Sarvam)</span>
            <span className={`timing-value ${getTimingClass(timings.stt || 0)}`}>{timings.stt || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label"><span className="icon">🔍</span> Vector + BM25 Retrieval</span>
            <span className={`timing-value ${getTimingClass(timings.retrieval || 0)}`}>{timings.retrieval || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label"><span className="icon">🎯</span> Cross-Encoder Rerank</span>
            <span className={`timing-value ${getTimingClass(timings.rerank || 0)}`}>{timings.rerank || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label"><span className="icon">🛡️</span> Guardrail Checks</span>
            <span className={`timing-value ${getTimingClass(timings.guardrails || 0)}`}>{timings.guardrails || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label"><span className="icon">🤖</span> LLM Generation (Groq)</span>
            <span className={`timing-value ${getTimingClass(timings.generation || 0)}`}>{timings.generation || 0} ms</span>
          </div>

          <div className="timing-total-row">
            <span className="timing-total-label">Total Latency</span>
            <span className="timing-total-value">{timings.total || 0} ms</span>
          </div>
        </>
      ) : (
        <div className="no-timings">No query run yet</div>
      )}

      {stats && stats.retrieval_plus_rerank_ms && (
        <>
          <div className="timing-divider" />
          <div className="card-title" style={{ marginTop: '8px' }}>📊 Aggregate Retrieval Target (&lt;200ms)</div>
          <div className="timing-row">
            <span className="timing-label">P50 (Median)</span>
            <span className="timing-value timing-fast">{stats.retrieval_plus_rerank_ms.p50} ms</span>
          </div>
          <div className="timing-row">
            <span className="timing-label">P70 Percentile</span>
            <span className="timing-value timing-fast">{stats.retrieval_plus_rerank_ms.p70} ms</span>
          </div>
          <div className="timing-row">
            <span className="timing-label">P100 (Max)</span>
            <span className="timing-value timing-mid">{stats.retrieval_plus_rerank_ms.p100} ms</span>
          </div>
        </>
      )}
    </div>
  );
}
