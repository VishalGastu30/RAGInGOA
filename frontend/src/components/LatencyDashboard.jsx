import React from 'react';

export default function LatencyDashboard({ timings, stats }) {
  if (!timings && !stats) {
    return (
      <div className="telemetry-card">
        <div className="telemetry-card-title">STAGE LATENCIES (LAST QUERY)</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Run a query to inspect live pipeline timings</div>
      </div>
    );
  }

  const getTimingClass = (ms) => {
    if (ms < 100) return 'timing-fast';
    if (ms < 500) return 'timing-mid';
    return 'timing-slow';
  };

  const total = timings?.total || 1;
  const sttPct = Math.round(((timings?.stt || 0) / total) * 100);
  const retPct = Math.round(((timings?.retrieval || 0) / total) * 100);
  const rrkPct = Math.round(((timings?.rerank || 0) / total) * 100);
  const grdPct = Math.round(((timings?.guardrails || 0) / total) * 100);
  const genPct = Math.round(((timings?.generation || 0) / total) * 100);

  return (
    <div className="telemetry-card">
      <div className="telemetry-card-title">STAGE LATENCIES (LAST QUERY)</div>
      {timings ? (
        <>
          <div className="proportional-bar-wrapper" title="Proportional Time Breakdown">
            <div className="proportional-bar">
              {timings.stt > 0 && (
                <div className="p-segment stt-seg" style={{ width: `${sttPct}%` }} title={`STT: ${timings.stt}ms (${sttPct}%)`} />
              )}
              <div className="p-segment ret-seg" style={{ width: `${Math.max(retPct, 2)}%` }} title={`Retrieval: ${timings.retrieval}ms (${retPct}%)`} />
              <div className="p-segment rrk-seg" style={{ width: `${Math.max(rrkPct, 2)}%` }} title={`Rerank: ${timings.rerank}ms (${rrkPct}%)`} />
              <div className="p-segment grd-seg" style={{ width: `${Math.max(grdPct, 2)}%` }} title={`Guardrails: ${timings.guardrails}ms (${grdPct}%)`} />
              {timings.generation > 0 && (
                <div className="p-segment gen-seg" style={{ width: `${genPct}%` }} title={`LLM Gen: ${timings.generation}ms (${genPct}%)`} />
              )}
            </div>
          </div>

          <div className="timing-row">
            <span className="timing-label">Speech-to-Text (Sarvam)</span>
            <span className={`timing-value ${getTimingClass(timings.stt || 0)}`}>{timings.stt || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label">Vector + BM25 Retrieval</span>
            <span className={`timing-value ${getTimingClass(timings.retrieval || 0)}`}>{timings.retrieval || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label">Cross-Encoder Rerank</span>
            <span className={`timing-value ${getTimingClass(timings.rerank || 0)}`}>{timings.rerank || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label">Guardrail Checks</span>
            <span className={`timing-value ${getTimingClass(timings.guardrails || 0)}`}>{timings.guardrails || 0} ms</span>
          </div>

          <div className="timing-row">
            <span className="timing-label">LLM Generation (Groq)</span>
            <span className={`timing-value ${getTimingClass(timings.generation || 0)}`}>{timings.generation || 0} ms</span>
          </div>

          <div className="timing-row" style={{ fontWeight: 'bold', color: 'var(--text-primary)', borderBottom: 'none' }}>
            <span>Total End-to-End Latency</span>
            <span className="timing-value" style={{ color: 'var(--accent-cyan)' }}>{timings.total || 0} ms</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No timings available</div>
      )}

      {stats && stats.retrieval_plus_rerank_ms && (
        <>
          <div className="telemetry-card-title" style={{ marginTop: 16 }}>AGGREGATE RETRIEVAL TARGET (&lt;200ms)</div>
          <div className="timing-row">
            <span className="timing-label">P50 (Median)</span>
            <span className="timing-value timing-fast">{stats.retrieval_plus_rerank_ms.p50} ms</span>
          </div>
          <div className="timing-row">
            <span className="timing-label">P70 Percentile</span>
            <span className="timing-value timing-fast">{stats.retrieval_plus_rerank_ms.p70} ms</span>
          </div>
          <div className="timing-row" style={{ borderBottom: 'none' }}>
            <span className="timing-label">P100 (Max)</span>
            <span className="timing-value timing-mid">{stats.retrieval_plus_rerank_ms.p100} ms</span>
          </div>
        </>
      )}
    </div>
  );
}
