const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export async function ask({ text, audio_base64, language_hint } = {}) {
  const res = await fetch(`${BACKEND_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, audio_base64, language_hint }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function fetchGuardrailLog(limit = 10) {
  const res = await fetch(`${BACKEND_URL}/api/guardrail-log?limit=${limit}`);
  if (!res.ok) return { logs: [] };
  return res.json();
}

export async function fetchLatencyStats() {
  const res = await fetch(`${BACKEND_URL}/api/latency-stats`);
  if (!res.ok) return null;
  return res.json();
}
