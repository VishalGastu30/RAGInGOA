import React, { useState } from 'react';
import { Shield, ShieldAlert, Sun, Moon, Activity, Trash2, Menu, X, Layers } from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      {/* Desktop Tech Status Pills */}
      <div className="nav-status-pills">
        <span className="pill-tech">FAISS · 384d</span>
        <span className="pill-tech">Sarvam Saaras v3</span>
        <span className="pill-tech">BM25 Hybrid</span>
        <span className="pill-tech live-indicator">
          <span className="live-dot-pulse" />
          Backend Live
        </span>
      </div>

      {/* Persistent Right Actions */}
      <div className="nav-actions">
        {/* Desktop-Only Actions */}
        <div className="nav-actions desktop-only-actions">
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
        </div>

        <div className="mobile-persistent-actions">
          {/* Theme Toggle (Visible on Desktop & Mobile) */}
          <button
            type="button"
            className="icon-btn theme-toggle-btn"
            onClick={handleThemeClick}
            title={theme === 'theme-cyberpunk' ? 'Switch to Light Sunrise' : 'Switch to Cyberpunk Dark'}
          >
            {theme === 'theme-cyberpunk' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Panel */}
      {mobileMenuOpen && (
        <div className="mobile-dropdown-menu">
          {/* Strategy Selection */}
          <div className="mobile-menu-section">
            <div className="mobile-section-label">
              <Layers size={13} />
              <span>RETRIEVAL STRATEGY</span>
            </div>
            <div className="mobile-strategy-group">
              {['hybrid', 'semantic', 'small'].map((strat) => (
                <button
                  key={strat}
                  type="button"
                  className={`mobile-strat-btn ${activeStrategy === strat ? 'active' : ''}`}
                  onClick={() => {
                    setActiveStrategy(strat);
                  }}
                >
                  {strat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions List */}
          <div className="mobile-menu-actions">
            <button
              type="button"
              className={`mobile-action-row ${strictMode ? 'active' : ''}`}
              onClick={() => setStrictMode(!strictMode)}
            >
              <div className="mobile-action-icon">
                {strictMode ? <Shield size={18} /> : <ShieldAlert size={18} color="var(--accent-amber)" />}
              </div>
              <div className="mobile-action-text">
                <span className="mobile-action-title">Cross-Lingual Guardrails</span>
                <span className="mobile-action-sub">{strictMode ? 'STRICT GUARDRAILS ON' : 'OFF'}</span>
              </div>
            </button>

            <button
              type="button"
              className={`mobile-action-row ${telemetryOpen ? 'active' : ''}`}
              onClick={() => {
                onToggleTelemetry();
                setMobileMenuOpen(false);
              }}
            >
              <div className="mobile-action-icon">
                <Activity size={18} />
              </div>
              <div className="mobile-action-text">
                <span className="mobile-action-title">Pipeline Telemetry</span>
                <span className="mobile-action-sub">View live latencies & stats</span>
              </div>
            </button>

            {hasMessages && (
              <button
                type="button"
                className="mobile-action-row"
                onClick={() => {
                  onClearHistory();
                  setMobileMenuOpen(false);
                }}
              >
                <div className="mobile-action-icon">
                  <Trash2 size={18} />
                </div>
                <div className="mobile-action-text">
                  <span className="mobile-action-title">Clear Chat History</span>
                  <span className="mobile-action-sub">Reset conversation</span>
                </div>
              </button>
            )}

          </div>

          {/* Tech Pills Footer */}
          <div className="mobile-tech-footer">
            <span className="pill-tech">FAISS · 384d</span>
            <span className="pill-tech">Sarvam Saaras v3</span>
            <span className="pill-tech">BM25 Hybrid</span>
            <span className="pill-tech live-indicator">
              <span className="live-dot-pulse" />
              Backend Live
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
