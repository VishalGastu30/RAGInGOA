import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import LatencyDashboard from './LatencyDashboard';
import GuardrailLog from './GuardrailLog';

export default function TelemetryDrawer({ isOpen, onClose, timings, stats, logs }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="telemetry-drawer-overlay" onClick={onClose}>
        <motion.div
          className="telemetry-drawer-content"
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="drawer-header">
            <span className="drawer-title">PIPELINE TELEMETRY & AUDIT TRACE</span>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close Drawer (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          <div className="drawer-grid">
            <LatencyDashboard timings={timings} stats={stats} />
            <GuardrailLog logs={logs} />
          </div>

          <button
            type="button"
            className="mobile-close-drawer-btn d-md-none" /* Hidden on desktop via generic utility or media query */
            onClick={onClose}
          >
            CLOSE TELEMETRY
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
