import React, { useState, useEffect, useRef } from 'react';
import MicButton from './components/MicButton';
import LatencyDashboard from './components/LatencyDashboard';
import GuardrailLog from './components/GuardrailLog';
import { ask, fetchGuardrailLog, fetchLatencyStats } from './api/client';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTimings, setLastTimings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeStage, setActiveStage] = useState('');

  const chatEndRef = useRef(null);

  useEffect(() => {
    loadSidebars();
    const interval = setInterval(loadSidebars, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadSidebars = async () => {
    try {
      const [logData, statsData] = await Promise.all([
        fetchGuardrailLog(10),
        fetchLatencyStats(),
      ]);
      if (logData?.logs) setLogs(logData.logs);
      if (statsData) setStats(statsData);
    } catch (e) {
      // quiet fail on background polls
    }
  };

  const handleSendText = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    setInputText('');
    const userMsg = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setActiveStage('Transcribing & Cleaning...');

    try {
      setActiveStage('Retrieving (Vector + BM25)...');
      setTimeout(() => setActiveStage('Reranking & Checking Guardrails...'), 200);

      const res = await ask({ text: query });

      setLastTimings(res.timings_ms);

      const assistantMsg = {
        role: 'assistant',
        content: res.answer,
        answered: res.answered,
        refusalReason: res.refusal_reason,
        sources: res.sources || [],
        cacheHit: res.cache_hit,
        timings: res.timings_ms,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      loadSidebars();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, an error occurred while processing your request.',
          answered: false,
          refusalReason: err.message,
        },
      ]);
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleAudioRecorded = async (base64Audio) => {
    if (loading) return;

    const userMsg = { role: 'user', content: '🎤 [Voice Recording Sent]' };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setActiveStage('Sarvam STT (Transcribing Voice)...');

    try {
      const res = await ask({ audio_base64: base64Audio });

      // Update user message with transcribed text if available
      if (res.transcript) {
        setMessages((prev) =>
          prev.map((msg, i) =>
            i === prev.length - 1 ? { role: 'user', content: res.transcript } : msg
          )
        );
      }

      setLastTimings(res.timings_ms);

      const assistantMsg = {
        role: 'assistant',
        content: res.answer,
        answered: res.answered,
        refusalReason: res.refusal_reason,
        sources: res.sources || [],
        cacheHit: res.cache_hit,
        timings: res.timings_ms,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      loadSidebars();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, voice transcription or processing failed.',
          answered: false,
          refusalReason: err.message,
        },
      ]);
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const sampleQueries = [
    'What is a corporation?',
    'निगम क्या है?',
    'Who won the cricket world cup?',
  ];

  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🎤</div>
          <span>Voice RAG</span>
          <span className="header-badge">MSMARCO-XI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span className="status-dot" />
          <span>Backend Live</span>
        </div>
      </header>

      <main className="main-area">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <div className="empty-title">Voice-First RAG Assistant</div>
              <div className="empty-subtitle">
                Ask a question using your microphone or text. Powered by Sarvam STT, FAISS, BM25, and Groq LLM with dataset guardrails.
              </div>
              <div className="example-chips">
                {sampleQueries.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="example-chip"
                    onClick={() => handleSendText(q)}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`msg ${msg.role}`}>
                <div
                  className={`msg-bubble ${
                    msg.role === 'assistant' && !msg.answered ? 'refused' : ''
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="msg-meta">
                    {msg.cacheHit && <span className="cache-badge">⚡ Cache Hit</span>}
                    {!msg.answered && <span className="refused-badge">🛡️ Refused</span>}
                    {msg.timings?.total && (
                      <span>{msg.timings.total}ms total</span>
                    )}
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="msg-sources">
                    <div className="sources-label">Sources:</div>
                    {msg.sources.map((src, sIdx) => (
                      <span key={sIdx} className="source-chip">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="msg assistant">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              {activeStage && (
                <div className="stage-indicator">
                  <span className="stage-pill">{activeStage}</span>
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="input-row">
          <textarea
            className="text-input"
            placeholder="Type your question or record voice..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <MicButton onAudioRecorded={handleAudioRecorded} disabled={loading} />
          <button
            type="button"
            className="send-btn"
            onClick={() => handleSendText()}
            disabled={loading || !inputText.trim()}
            title="Send query"
          >
            ➔
          </button>
        </div>
      </main>

      <aside className="sidebar">
        <LatencyDashboard timings={lastTimings} stats={stats} />
        <GuardrailLog logs={logs} />
      </aside>
    </div>
  );
}
