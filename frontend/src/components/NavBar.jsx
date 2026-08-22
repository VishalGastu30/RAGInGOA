import React from 'react';
import { Shield, ShieldAlert, Sun, Moon, Activity, Trash2 } from 'lucide-react';

export default function NavBar({
  theme,
  onToggleTheme,
  strictMode,
  setStrictMode,
  activeStrategy,
  setActiveStrategy,
  onToggleTelemetry,
  telemetryOpen,
  onClearHistory,
  hasMessages,
}) {
  const handleThemeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    onToggleTheme(coords);
  };

  return (
    <nav className="top-nav">
      <div className="nav-brand">
        <div className="hh-logo-group">
          <img src="/hh_logo.png" alt="Hacker House" className="hh-logo-img" />
          <img src="/goa_hindi.svg" alt="गोवा" className="goa-hindi-img" />
        </div>
        <span className="nav-title">RAGInGOA</span>
        <span className="nav-badge">TASK 2</span>
      </div>

      {/* Tech Status Pills */}
      <div className="nav-status-pills">
        <span className="pill-tech">FAISS · 384d</span>
        <span className="pill-tech">Sarvam Saaras v3</span>
        <span className="pill-tech">BM25 Hybrid</span>
        <span className="pill-tech live-indicator">
          <span className="live-dot-pulse" />
          Backend Live
        </span>
      </div>

      <div className="nav-actions">
        {/* Strategy Selector */}
        <div className="strategy-segmented" title="Chunking & Retrieval Strategy">
          {['hybrid', 'semantic', 'small'].map((strat) => (
            <button
              key={strat}
              type="button"
              className={`strat-tab ${activeStrategy === strat ? 'active' : ''}`}
              onClick={() => setActiveStrategy(strat)}
            >
              {strat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Guardrail Toggle */}
        <button
          type="button"
          className={`icon-btn ${strictMode ? 'active' : ''}`}
          onClick={() => setStrictMode(!strictMode)}
          title={strictMode ? 'Cross-Lingual Guardrails: STRICT ON' : 'Cross-Lingual Guardrails: OFF'}
        >
          {strictMode ? <Shield size={18} /> : <ShieldAlert size={18} color="var(--accent-amber)" />}
        </button>

        {/* Telemetry Drawer Toggle */}
        <button
          type="button"
          className={`icon-btn ${telemetryOpen ? 'active' : ''}`}
          onClick={onToggleTelemetry}
          title="Telemetry & Stage Latencies"
        >
          <Activity size={18} />
        </button>

        {/* Clear Chat Button (if messages exist) */}
        {hasMessages && (
          <button
            type="button"
            className="icon-btn"
            onClick={onClearHistory}
            title="Clear Chat History"
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          className="icon-btn"
          onClick={handleThemeClick}
          title={theme === 'theme-cyberpunk' ? 'Switch to Light Sunrise' : 'Switch to Cyberpunk Dark'}
        >
          {theme === 'theme-cyberpunk' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </nav>
  );
}
