import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from './components/NavBar';
import HeroOrb from './components/HeroOrb';
import ChatStream from './components/ChatStream';
import InputDock from './components/InputDock';
import TelemetryDrawer from './components/TelemetryDrawer';
import ThemeTransition from './components/ThemeTransition';
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

  const [theme, setTheme] = useState('theme-cyberpunk');
  const [isTransitioningTheme, setIsTransitioningTheme] = useState(false);
  const [themeClickCoords, setThemeClickCoords] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  const ignoreNextAudioRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('rag_goa_messages', JSON.stringify(messages));
    } catch (e) {
      // quota exceeded fallback
    }
  }, [messages]);

  useEffect(() => {
    loadSidebars();
    const interval = setInterval(loadSidebars, 4000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts
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
      // background poll fail
    }
  };

  const handleToggleTheme = (coords) => {
    const nextTheme = theme === 'theme-cyberpunk' ? 'theme-sunrise' : 'theme-cyberpunk';
    setThemeClickCoords(coords);
    setIsTransitioningTheme(true);

    setTimeout(() => {
      setTheme(nextTheme);
    }, 200);

    setTimeout(() => {
      setIsTransitioningTheme(false);
    }, 650);
  };

  const askPipeline = async ({ text, audio_base64 }) => {
    setLoading(true);
    let userMsgIndex = -1;

    if (audio_base64) {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: '🎤 [Voice Query]' }];
      });
      setActiveStage('Transcribing Voice (Sarvam)...');
    } else {
      setMessages((prev) => {
        userMsgIndex = prev.length;
        return [...prev, { role: 'user', content: text }];
      });
      setActiveStage('Retrieving Passages (Vector + BM25)...');
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
            prev.map((msg, i) => (i === userMsgIndex ? { ...msg, content: res.transcript } : msg))
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
          },
        ]);
        loadSidebars();
      } else {
        // Stream Mode
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
            timestamp: Date.now(),
          },
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
                if (chunk.token || chunk.answer_chunk) {
                  assistantAnswer += chunk.token || chunk.answer_chunk;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    last.content = assistantAnswer;
                    return newMsgs;
                  });
                }
                if (chunk.sources) assistantSources = chunk.sources;
                if (chunk.timings_ms) finalTimings = chunk.timings_ms;
                if (chunk.refusal_reason) refusalReason = chunk.refusal_reason;
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
                // chunk parse error
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
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setActiveStage('');
    }
  };

  const handleSendText = async (textOverride) => {
    const query = textOverride || inputText;
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

    await askPipeline({ audio_base64: base64Audio });
  };

  const handleTranslateMessage = async (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg || !msg.content || loading) return;

    setLoading(true);
    setActiveStage('Translating Hindi/Marathi to English...');

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
                content: data.translated,
                isTranslated: !m.isTranslated,
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
    localStorage.removeItem('rag_goa_messages');
    setLastTimings(null);
  };

  return (
    <div className={`app-layout ${theme}`}>
      {/* Ambient Decorative Blob */}
      <div className="ambient-blob-secondary" />

      {/* Radial Wipe Theme Transition Portal */}
      <ThemeTransition
        isTransitioning={isTransitioningTheme}
        clickCoords={themeClickCoords}
        newTheme={theme}
      />

      {/* Top Navigation Bar */}
      <NavBar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        strictMode={strictMode}
        setStrictMode={setStrictMode}
        activeStrategy={activeStrategy}
        setActiveStrategy={setActiveStrategy}
        onToggleTelemetry={() => setTelemetryOpen(!telemetryOpen)}
        telemetryOpen={telemetryOpen}
        onClearHistory={handleClearHistory}
        hasMessages={messages.length > 0}
      />

      {/* Scrollable Center Area */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <HeroOrb
              key="hero-orb"
              onAudioRecorded={handleAudioRecorded}
              onDictationUpdate={(text) => setInputText(text)}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              disabled={loading}
              onSelectPrompt={(text) => handleSendText(text)}
            />
          ) : (
            <motion.div
              key="chat-stream"
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <ChatStream
                messages={messages}
                loading={loading}
                activeStage={activeStage}
                onTranslateMessage={handleTranslateMessage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Command Center Fixed Bottom Input Dock */}
      <InputDock
        inputText={inputText}
        setInputText={setInputText}
        onSendText={handleSendText}
        onAudioRecorded={handleAudioRecorded}
        onDictationUpdate={(text) => setInputText(text)}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        loading={loading}
      />

      {/* Telemetry Slide-Up Modal Drawer */}
      <TelemetryDrawer
        isOpen={telemetryOpen}
        onClose={() => setTelemetryOpen(false)}
        timings={lastTimings}
        stats={stats}
        logs={logs}
      />
    </div>
  );
}
