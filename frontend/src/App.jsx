import React, { useState, useEffect, useRef } from 'react';
import MicButton from './components/MicButton';
import LatencyDashboard from './components/LatencyDashboard';
import GuardrailLog from './components/GuardrailLog';
import { ask, fetchGuardrailLog, fetchLatencyStats, transcribe } from './api/client';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTimings, setLastTimings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeStage, setActiveStage] = useState('');
  const [strictMode, setStrictMode] = useState(true);
  const [activeStrategy, setActiveStrategy] = useState('hybrid');
  const [inspectedSources, setInspectedSources] = useState(null);
  const [inspectedMessageIndex, setInspectedMessageIndex] = useState(null);
  
  // Theme state: defaults to retro-light as requested
  const [theme, setTheme] = useState('retro-light');
  
  const [isRecording, setIsRecording] = useState(false);
  const [showGoaModal, setShowGoaModal] = useState(false);
  const ignoreNextAudioRef = useRef(false);
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

  const askPipeline = async ({ text, audio_base64 }) => {
    setLoading(true);
    let userMsgIndex = -1;
    
    // Add User Message
    if (audio_base64) {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: '🎤 [Voice Recording Sent]' }];
      });
      setActiveStage('Sarvam STT (Transcribing)...');
    } else {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: text }];
      });
      setActiveStage('Retrieving (Vector + BM25)...');
    }

    try {
      if (strictMode) {
        // Strict Mode
        const res = await ask({
          text,
          audio_base64,
          strategy: activeStrategy === 'hybrid' ? null : activeStrategy,
        });
        
        if (res.transcript && audio_base64) {
          setMessages((prev) =>
            prev.map((msg, i) =>
              i === userMsgIndex ? { ...msg, content: res.transcript } : msg
            )
          );
        }
        
        setLastTimings(res.timings_ms);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.answer,
            answered: res.answered,
            refusalReason: res.refusal_reason,
            sources: res.sources || [],
            cacheHit: res.cache_hit,
            timings: res.timings_ms,
          }
        ]);
        loadSidebars();
      } else {
        // Non-strict / Streaming Mode
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${BACKEND_URL}/api/ask-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            audio_base64,
            strategy: activeStrategy === 'hybrid' ? null : activeStrategy,
          }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let assistantAnswer = '';
        let assistantSources = [];
        let finalTimings = null;
        let refusalReason = null;
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '',
            answered: true,
            sources: [],
            timings: null,
          }
        ]);
        
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data: ')) {
              const dataStr = cleanLine.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const chunk = JSON.parse(dataStr);
                if (chunk.transcript && audio_base64) {
                  setMessages((prev) =>
                    prev.map((msg, i) =>
                      i === userMsgIndex ? { ...msg, content: chunk.transcript } : msg
                    )
                  );
                }
                if (chunk.answer_chunk) {
                  assistantAnswer += chunk.answer_chunk;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    last.content = assistantAnswer;
                    return newMsgs;
                  });
                }
                if (chunk.sources) {
                  assistantSources = chunk.sources;
                }
                if (chunk.timings_ms) {
                  finalTimings = chunk.timings_ms;
                }
                if (chunk.refusal_reason) {
                  refusalReason = chunk.refusal_reason;
                }
                if (chunk.answered !== undefined) {
                  const answeredVal = chunk.answered;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    last.answered = answeredVal;
                    if (!answeredVal && refusalReason) {
                      last.content = refusalReason;
                    }
                    return newMsgs;
                  });
                }
              } catch (e) {
                // parse error
              }
            }
          }
        }
        
        if (finalTimings) setLastTimings(finalTimings);
        setMessages((prev) => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.sources = assistantSources;
          last.timings = finalTimings;
          return newMsgs;
        });
        loadSidebars();
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error connecting to pipeline: ${err.message}`,
          answered: false,
        }
      ]);
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleSendText = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    if (isRecording) {
      ignoreNextAudioRef.current = true;
      setIsRecording(false);
    }

    setInputText('');
    await askPipeline({ text: query });
  };

  const handleAudioRecorded = async (base64Audio) => {
    if (ignoreNextAudioRef.current) {
      ignoreNextAudioRef.current = false;
      return;
    }
    if (loading) return;

    setLoading(true);
    setActiveStage('Transcribing Voice...');

    try {
      const res = await transcribe({ audio_base64: base64Audio });
      if (res.transcript) {
        setInputText(res.transcript);
        setLastTimings({ stt: res.stt_ms || 0 });
      }
    } catch (err) {
      console.error(err);
      alert('Error transcribing audio: ' + err.message);
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleTranslateMessage = async (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg || !msg.content || loading) return;

    setLoading(true);
    setActiveStage('Translating...');

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content }),
      });
      if (!response.ok) throw new Error('Translation API failed');
      const data = await response.json();

      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                ...m,
                originalContent: m.originalContent || m.content,
                content: data.translated_text,
                isTranslated: true,
              }
            : m
        )
      );
    } catch (err) {
      console.error(err);
      alert('Translation failed');
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setLastTimings(null);
    setInspectedSources(null);
    setInspectedMessageIndex(null);
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
    <div className={`app-layout ${theme}`}>
      <header className="retro-header">
        <div className="header-left">
          <div className="hh-logo-lockup">
            <img src="/hh_logo.png" alt="Hacker House" className="hh-wordmark" />
            <img src="/goa_hindi.svg" alt="गोवा" className="goa-devanagari" />
          </div>
          <span className="header-badge">TASK 2</span>
          <span className="header-subtitle">VOICE-ENABLED MULTILINGUAL RAG</span>
        </div>
        <div className="header-right">
          <div className="status-pill">FAISS FlatIP 384-d</div>
          <div className="status-pill">Sarvam Saaras v3</div>
          <div className="status-pill">BM25 Hybrid Fusion</div>
          <div className="status-pill live-indicator">
            <span className="status-dot green" />
            Backend Live
          </div>
          <button 
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'retro-light' ? 'dark' : 'retro-light')}
          >
            {theme === 'retro-light' ? 'DARK THEME' : 'LIGHT THEME'}
          </button>
        </div>
      </header>

      {/* Main retro controls bar */}
      <div className="retro-controls-bar">
        <div className="controls-left">
          <label className="checkbox-container">
            <input 
              type="checkbox" 
              checked={strictMode} 
              onChange={(e) => setStrictMode(e.target.checked)} 
            />
            <span className="checkmark"></span>
            Cross-Lingual Guardrails
          </label>
        </div>
        
        <div className="controls-right">
          <span className="control-label">CHUNKING STRATEGY:</span>
          <div className="strategy-selector-retro">
            {['hybrid', 'semantic', 'medium', 'small'].map((strat) => (
              <button
                key={strat}
                type="button"
                className={`strat-btn-retro ${activeStrategy === strat ? 'active' : ''}`}
                onClick={() => setActiveStrategy(strat)}
              >
                {strat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="retro-main-grid">
        {/* Left Column: THE TERMINAL */}
        <section className="retro-panel terminal-panel">
          <div className="panel-header-retro">
            <span className="panel-title-retro">THE TERMINAL</span>
            <span className="panel-badge-retro">VOICE INTERFACE</span>
          </div>

          <div className="panel-content-retro">
            {/* Recording Interface Card */}
            <div className="mic-interface-card">
              <div className="voice-dial-wrapper">
                <MicButton 
                  onAudioRecorded={handleAudioRecorded} 
                  onDictationUpdate={(text) => setInputText(text)} 
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  disabled={loading} 
                />
              </div>
              <div className={`status-badge-retro ${isRecording ? 'recording' : ''}`}>
                {isRecording ? '>>> RECORDING ACTIVE' : '>>> READY FOR VOICE INPUT'}
              </div>
            </div>

            {/* Input Row */}
            <div className="retro-input-wrapper">
              <textarea
                className="retro-textarea"
                placeholder="Ask in English, Hindi, or Marathi..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                type="button"
                className="retro-send-btn"
                onClick={() => handleSendText()}
                disabled={loading || !inputText.trim()}
              >
                RUN ➔
              </button>
            </div>

            {/* Quick Prompts */}
            <div className="quick-prompts-retro">
              <span className="quick-label">QUICK PROMPTS (EN + HI + MR):</span>
              <div className="chips-row">
                {sampleQueries.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chip-btn-retro"
                    onClick={() => handleSendText(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Hacker House Goa Venue Info Component */}
            <div className="hacker-house-badge-card">
              <div className="badge-header-row">
                <span className="badge-header">NETOPS</span>
                <div className="badge-logo-pair">
                  <img src="/hh_logo.png" alt="Hacker House" className="badge-hh-wm" />
                  <img src="/goa_hindi.svg" alt="गोवा" className="badge-goa-deva" />
                </div>
              </div>
              <div className="badge-grid">
                <div className="badge-item">
                  <span className="b-label">VENUE:</span>
                  <span className="b-val">Arambol Beach, Goa</span>
                </div>
                <div className="badge-item">
                  <span className="b-label">COORDS:</span>
                  <span className="b-val">15.6888 N, 73.7042 E</span>
                </div>
                <div className="badge-item">
                  <span className="b-label">SSID:</span>
                  <span className="b-val highlight">HackerHouse_Goa_5G</span>
                </div>
                <div className="badge-item">
                  <span className="b-label">TASK:</span>
                  <span className="b-val">Task 2 - Indic Voice RAG</span>
                </div>
              </div>
            </div>

            {/* Transcribed Feed */}
            <div className="terminal-feed-card">
              <div className="feed-header-retro">
                <span>TRANSCRIBED SESSION LOGS</span>
                <button className="clear-btn-retro" onClick={handleClearHistory}>
                  Clear History
                </button>
              </div>
              <div className="feed-body-retro">
                {messages.length === 0 ? (
                  <div className="feed-empty">No active session. Speak or type above to begin.</div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`feed-msg-row ${msg.role}`}>
                      <span className="msg-tag">[{msg.role.toUpperCase()}]</span>
                      <span className="msg-text">{msg.content}</span>
                      {msg.role === 'assistant' && msg.content && (
                        <div className="translate-wrapper-retro">
                          <button
                            type="button"
                            className="btn-translate-retro"
                            onClick={() => {
                              if (msg.isTranslated) {
                                  setMessages((prev) =>
                                    prev.map((m, i) =>
                                      i === index ? { ...m, content: m.originalContent, isTranslated: false } : m
                                    )
                                  );
                              } else {
                                handleTranslateMessage(index);
                              }
                            }}
                          >
                            {msg.isTranslated ? '[SHOW ORIGINAL]' : '[TRANSLATE TO ENGLISH]'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="feed-msg-row assistant loading">
                    <span className="msg-tag">[SYSTEM]</span>
                    <span className="msg-text loader-pulse">Processing Stage: {activeStage || 'Thinking'}...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: THE KNOWLEDGE SEA */}
        <section className="retro-panel knowledge-panel">
          <div className="panel-header-retro">
            <span className="panel-title-retro">THE KNOWLEDGE SEA</span>
            <span className={`panel-badge-retro ${messages.length > 0 ? 'active' : ''}`}>
              {messages.length > 0 ? 'RESULT READY' : 'AWAITING QUERY'}
            </span>
          </div>

          <div className="panel-content-retro">
            <div className="knowledge-screen">
              <div className="screen-grid-lines" />
              {messages.length === 0 ? (
                <div className="screen-fallback">
                  <div className="fallback-logo-container">
                    <img src="/hacker_house_goa_logo.png" alt="Hacker House Goa" className="fallback-logo-img" />
                  </div>
                  <div className="fallback-title">AWAITING QUERY INPUT</div>
                  <div className="fallback-subtitle">
                    Speak into the Terminal microphone or type a query in the textbox to retrieval-augment MSMARCO-XI.
                  </div>
                  <div className="fallback-help-box">
                    Click the floating [EXPLORE GOA] button on the side to watch popular local travel videos!
                  </div>
                </div>
              ) : (
                <div className="screen-results">
                  {(() => {
                    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                    if (!lastAssistant) return null;
                    return (
                      <div className="results-wrapper">
                        <div className="response-box">
                          <div className="response-header">[FUSED RESPONSE]</div>
                          <div className="response-body">{lastAssistant.content}</div>
                        </div>

                        {lastAssistant.sources && lastAssistant.sources.length > 0 && (
                          <div className="sources-section-retro">
                            <div className="sources-header-retro">RETRIEVED DATA CHUNKS</div>
                            <div className="sources-list-retro">
                              {lastAssistant.sources.map((src, idx) => (
                                <div 
                                  key={idx} 
                                  className={`source-item-retro ${inspectedSources?.chunk_id === src.chunk_id ? 'inspected' : ''}`}
                                  onClick={() => {
                                    if (inspectedSources?.chunk_id === src.chunk_id) {
                                      setInspectedSources(null);
                                    } else {
                                      setInspectedSources(src);
                                    }
                                  }}
                                >
                                  <div className="source-item-header">
                                    <span>MATCH {idx + 1} ({src.strategy.toUpperCase()})</span>
                                    <span>SCORE: {Math.round(src.score * 100)}%</span>
                                  </div>
                                  <div className="source-item-body">{src.text}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer: Telemetry & Audit */}
      <footer className="retro-footer">
        <div className="footer-header">
          <span className="footer-title">TELEMETRY & GUARDRAIL AUDIT</span>
          <span className="footer-subtitle">STAGE LATENCIES & LOGS</span>
        </div>
        <div className="footer-content">
          <div className="telemetry-col">
            <LatencyDashboard timings={lastTimings} stats={stats} />
          </div>
          <div className="audit-col">
            <GuardrailLog logs={logs} />
          </div>
        </div>
      </footer>

      {/* Floating Goa Explorer Button */}
      <button 
        type="button" 
        className="goa-floating-btn"
        onClick={() => setShowGoaModal(true)}
      >
        <img src="/hacker_house_goa_logo.png" alt="Goa Logo" className="btn-logo-thumb" />
        <span>EXPLORE GOA</span>
      </button>

      {/* Floating Goa Explorer Modal Overlay */}
      {showGoaModal && (
        <div className="goa-modal-overlay" onClick={() => setShowGoaModal(false)}>
          <div className="goa-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-retro">
              <span className="modal-title-retro">GOA KNOWLEDGE NAVIGATOR</span>
              <button className="modal-close-retro" onClick={() => setShowGoaModal(false)}>✕</button>
            </div>
            <div className="modal-body-retro">
              <div className="hero-banner-container">
                <img src="/goa_beach_tech_sunset.jpg" alt="Goa Tech Sunset" className="hero-banner-img" />
              </div>
              <p className="modal-desc-retro">
                Select a Goa hotspot below to watch popular travel vlogs and explore the local culture.
              </p>
              <div className="explorer-grid">
                {[
                  { name: 'Fontainhas Quarter', url: 'https://www.youtube.com/watch?v=3I2VqP726yU', desc: 'Latin quarter, historic colorful houses' },
                  { name: 'Vagator Cliffs', url: 'https://youtu.be/jNSHoKCid6Y?si=osAsXLJtzcLcKyEj', desc: 'Red clay cliffs, party vibes & scenic sunsets' },
                  { name: 'Palolem Beach Grove', url: 'https://youtu.be/sdD-pAK8nBM?si=zo3RAps3GkZ-8Ga7', desc: 'Scenic South Goa crescent bay' },
                  { name: 'Dudhsagar Falls', url: 'https://youtu.be/fx3rZ9seX7s?si=s010WKpp8yabb4av', desc: 'Four-tiered mountain forest waterfall' }
                ].map((spot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="explorer-card"
                    onClick={() => {
                      window.open(spot.url, '_blank');
                    }}
                  >
                    <div className="spot-name">{spot.name}</div>
                    <div className="spot-desc">{spot.desc}</div>
                    <div className="spot-action">WATCH VIDEO ➔</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
