import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Globe, Layers, Zap, AlertTriangle } from 'lucide-react';
import KnowledgeCard from './KnowledgeCard';

export default function ChatStream({
  messages,
  loading,
  activeStage,
  onTranslateMessage,
}) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const toggleSources = (msgIdx) => {
    setExpandedSources((prev) => ({ ...prev, [msgIdx]: !prev[msgIdx] }));
  };

  const detectDevanagari = (text) => {
    return /[\u0900-\u097F]/.test(text || '');
  };

  return (
    <div className="chat-stream-container">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isDevanagari = detectDevanagari(msg.content);
          const showSources = expandedSources[index] !== false; // Default expanded

          return (
            <motion.div
              key={index}
              className="chat-bubble-row"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {isUser ? (
                <div className="chat-bubble-user">
                  {msg.content}
                </div>
              ) : (
                <div className="chat-bubble-assistant">
                  <div className="assistant-meta-header">
                    <span>SYSTEM ASSISTANT</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {msg.cacheHit && (
                        <span className="badge-cache-hit">
                          <Zap size={11} /> CACHE HIT (&lt;10ms)
                        </span>
                      )}
                      {!msg.answered && (
                        <span style={{ color: 'var(--accent-rose)', display: 'flex', gap: 4, alignItems: 'center' }}>
                          <AlertTriangle size={12} /> REFUSED
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                  {/* Actions Bar */}
                  <div className="assistant-actions">
                    <button
                      type="button"
                      className="action-btn-text"
                      onClick={() => handleCopy(msg.content, index)}
                    >
                      {copiedIdx === index ? <Check size={12} /> : <Copy size={12} />}
                      {copiedIdx === index ? 'COPIED' : 'COPY'}
                    </button>

                    {isDevanagari && (
                      <button
                        type="button"
                        className="action-btn-text"
                        onClick={() => onTranslateMessage(index)}
                      >
                        <Globe size={12} />
                        {msg.isTranslated ? 'SHOW HINDI' : 'TRANSLATE TO ENGLISH'}
                      </button>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <button
                        type="button"
                        className="action-btn-text"
                        onClick={() => toggleSources(index)}
                      >
                        <Layers size={12} />
                        {showSources ? 'HIDE SOURCES' : `VIEW SOURCES (${msg.sources.length})`}
                      </button>
                    )}
                  </div>

                  {/* Knowledge Cards Grid */}
                  {msg.sources && msg.sources.length > 0 && showSources && (
                    <div>
                      <div className="sources-section-title">
                        <Layers size={13} />
                        RETRIEVED DATA CHUNKS ({msg.sources.length})
                      </div>
                      <div className="knowledge-grid">
                        {msg.sources.map((src, sIdx) => (
                          <KnowledgeCard
                            key={sIdx}
                            source={src}
                            index={sIdx}
                            isSelected={selectedSource?.chunk_id === src.chunk_id}
                            onClick={() => setSelectedSource(selectedSource?.chunk_id === src.chunk_id ? null : src)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Typing Indicator Loading State */}
      {loading && (
        <motion.div
          className="chat-bubble-assistant"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="assistant-meta-header">
            <span>PROCESSING STAGE</span>
            <span style={{ color: 'var(--accent-cyan)' }}>{activeStage || 'Thinking...'}</span>
          </div>
          <div className="typing-dots">
            <span className="dot-pulse" />
            <span className="dot-pulse" />
            <span className="dot-pulse" />
          </div>
        </motion.div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
