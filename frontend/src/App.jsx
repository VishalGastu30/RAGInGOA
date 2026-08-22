import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ArrowRight, Settings2 } from 'lucide-react';
import MicButton from './components/MicButton';
import KnowledgeCard from './components/KnowledgeCard';
import LatencyDashboard from './components/LatencyDashboard';
import GuardrailLog from './components/GuardrailLog';
import { ask, fetchGuardrailLog, fetchLatencyStats } from './api/client';

export default function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('rag_goa_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTimings, setLastTimings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeStage, setActiveStage] = useState('');
  const [strictMode, setStrictMode] = useState(true);
  const [activeStrategy, setActiveStrategy] = useState('hybrid');
  const [inspectedSources, setInspectedSources] = useState(null);
  const [theme, setTheme] = useState('theme-cyberpunk');
  const [isRecording, setIsRecording] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);

  const ignoreNextAudioRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('rag_goa_messages', JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    loadSidebars();
    const interval = setInterval(loadSidebars, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setIsRecording((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const loadSidebars = async () => {
    try {
      const [logData, statsData] = await Promise.all([
        fetchGuardrailLog(10),
        fetchLatencyStats(),
      ]);
      if (logData?.logs) setLogs(logData.logs);
      if (statsData) setStats(statsData);
    } catch (e) {
      // silent fail for polling
    }
  };

  const askPipeline = async ({ text, audio_base64 }) => {
    setLoading(true);
    let userMsgIndex = -1;

    if (audio_base64) {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: '🎤 [Voice Query]' }];
      });
      setActiveStage('Transcribing audio...');
    } else {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: text }];
      });
      setActiveStage('Retrieving knowledge...');
    }

    try {
      if (strictMode) {
        const res = await ask({
          text,
          audio_base64,
          strategy: activeStrategy === 'hybrid' ? null : activeStrategy,
        });

        if (res.transcript && audio_base64) {
          setMessages((prev) =>
            prev.map((msg, i) => i === userMsgIndex ? { ...msg, content: res.transcript } : msg)
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
            timestamp: Date.now(),
          }
        ]);
        loadSidebars();
      } else {
        // Stream Mode (Skipped full implementation for brevity here, acts same as old App.jsx stream)
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

        if (!response.ok) throw new Error(`HTTP error!`);
        
        // standard stream reading loop
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let assistantAnswer = '';
        let assistantSources = [];
        let finalTimings = null;
        let refusalReason = null;

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '', answered: true, sources: [], timings: null, timestamp: Date.now() }
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
                  setMessages(prev => prev.map((msg, i) => i === userMsgIndex ? { ...msg, content: chunk.transcript } : msg));
                }
                if (chunk.token || chunk.answer_chunk) {
                  assistantAnswer += chunk.token || chunk.answer_chunk;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content = assistantAnswer;
                    return newMsgs;
                  });
                }
                if (chunk.sources) assistantSources = chunk.sources;
                if (chunk.timings_ms) finalTimings = chunk.timings_ms;
                if (chunk.refusal_reason) refusalReason = chunk.refusal_reason;
                if (chunk.answered !== undefined) {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].answered = chunk.answered;
                    if (!chunk.answered && refusalReason) newMsgs[newMsgs.length - 1].content = refusalReason;
                    return newMsgs;
                  });
                }
              } catch (e) {}
            }
          }
        }

        if (finalTimings) setLastTimings(finalTimings);
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].sources = assistantSources;
          newMsgs[newMsgs.length - 1].timings = finalTimings;
          return newMsgs;
        });
        loadSidebars();
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}`, answered: false }]);
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

  const sampleQueries = [
    'What is a corporation?',
    'निगम क्या होता है?',
    'Who won the 2024 ICC T20 World Cup?'
  ];

  return (
    <div className={`app-layout ${theme}`}>
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="nav-title">RAGInGOA</div>
          <div className="nav-subtitle glass-btn" style={{ cursor: 'default' }}>HH Goa 2026</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="glass-btn" onClick={() => setStrictMode(!strictMode)} title="Toggle Guardrails">
            <Settings2 size={18} color={strictMode ? 'var(--accent-primary)' : 'var(--text-muted)'} />
          </button>
          <button 
            className="glass-btn" 
            onClick={() => setTheme(theme === 'theme-cyberpunk' ? 'theme-sunrise' : 'theme-cyberpunk')}
          >
            {theme === 'theme-cyberpunk' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content-area">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              key="hero"
              className="hero-wrapper"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.4 }}
            >
              <MicButton
                onAudioRecorded={(audio) => askPipeline({ audio_base64: audio })}
                onDictationUpdate={setInputText}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                disabled={loading}
              />
              
              <div className="chat-input-wrapper">
                <input 
                  type="text"
                  className="pro-input"
                  placeholder="Ask me anything, in English or Hindi..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                />
                <button 
                  className="send-icon-btn" 
                  onClick={() => handleSendText()} 
                  disabled={!inputText.trim() || loading}
                >
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="chips-row">
                {sampleQueries.map((q, i) => (
                  <div key={i} className="chip-pro" onClick={() => handleSendText(q)}>
                    {q}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="stream"
              className="conversation-stream"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Sticky Mic for subsequent queries */}
              <div className="hero-wrapper" style={{ marginBottom: '32px' }}>
                <div style={{ transform: 'scale(0.8)' }}>
                  <MicButton
                    onAudioRecorded={(audio) => askPipeline({ audio_base64: audio })}
                    onDictationUpdate={setInputText}
                    isRecording={isRecording}
                    setIsRecording={setIsRecording}
                    disabled={loading}
                  />
                </div>
                <div className="chat-input-wrapper">
                  <input 
                    type="text"
                    className="pro-input"
                    placeholder="Ask a follow up..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  />
                  <button 
                    className="send-icon-btn" 
                    onClick={() => handleSendText()} 
                    disabled={!inputText.trim() || loading}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>

              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}
                >
                  {msg.role === 'assistant' && msg.cacheHit && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginBottom: '8px', fontWeight: '700' }}>
                      ⚡ FAST CACHE HIT
                    </div>
                  )}
                  {msg.content}
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="sources-grid">
                      {msg.sources.map((src, sIdx) => (
                        <KnowledgeCard 
                          key={sIdx}
                          source={src}
                          index={sIdx}
                          isInspected={inspectedSources?.chunk_id === src.chunk_id}
                          onClick={() => setInspectedSources(src)}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="message-bubble message-assistant">
                  <span style={{ opacity: 0.5 }}>{activeStage || 'Processing...'}</span>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Telemetry Footer */}
      <footer className="telemetry-footer">
        <div className="nav-left">
          <div className="telemetry-pill">
            <div className="live-dot" /> LIVE
          </div>
          <button className="glass-btn" onClick={() => setMessages([])} style={{ fontSize: '11px' }}>
            CLEAR CHAT
          </button>
        </div>
        <button className="glass-btn" onClick={() => setFooterOpen(!footerOpen)} style={{ fontSize: '11px' }}>
          {footerOpen ? 'CLOSE TELEMETRY' : 'VIEW TELEMETRY'}
        </button>
      </footer>
      
      {footerOpen && (
        <div className="glass-panel" style={{ position: 'absolute', bottom: '80px', left: '20px', right: '20px', height: '400px', display: 'flex', gap: '20px', padding: '20px', zIndex: 90 }}>
          <div style={{ flex: 1, overflowY: 'auto' }}><LatencyDashboard timings={lastTimings} stats={stats} /></div>
          <div style={{ flex: 1, overflowY: 'auto' }}><GuardrailLog logs={logs} /></div>
        </div>
      )}
    </div>
  );
}
