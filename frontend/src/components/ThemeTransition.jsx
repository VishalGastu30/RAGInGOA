import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ThemeTransition({ isTransitioning, clickCoords, newTheme }) {
  if (!isTransitioning) return null;

  const { x = window.innerWidth / 2, y = 30 } = clickCoords || {};
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const isLight = newTheme === 'theme-sunrise';

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999,
          background: isLight ? '#FFF9F5' : '#050508',
          clipPath: `circle(0px at ${x}px ${y}px)`,
        }}
        animate={{
          clipPath: `circle(${maxRadius * 1.2}px at ${x}px ${y}px)`,
        }}
        transition={{
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
        }}
      />
    </AnimatePresence>
  );
}
