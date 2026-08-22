import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function KnowledgeCard({ source, index, isSelected, onClick }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 18 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 18 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7deg', '-7deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7deg', '7deg']);

  const updateCoordinates = (clientX, clientY, currentTarget) => {
    const rect = currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const posX = clientX - rect.left;
    const posY = clientY - rect.top;
    x.set(posX / width - 0.5);
    y.set(posY / height - 0.5);
  };

  const handleMouseMove = (e) => {
    updateCoordinates(e.clientX, e.clientY, e.currentTarget);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      updateCoordinates(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget);
    }
  };

  const handleResetTilt = () => {
    x.set(0);
    y.set(0);
  };

  const scorePct = Math.round((source.score || 0) * 100);

  return (
    <motion.div
      className={`knowledge-card-3d ${isSelected ? 'selected' : ''}`}
      style={{ rotateX, rotateY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleResetTilt}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleResetTilt}
      onClick={onClick}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="card-header-meta">
        <span>SOURCE #{index + 1} ({source.strategy?.toUpperCase() || 'HYBRID'})</span>
        <span>{scorePct}% SCORE</span>
      </div>
      <p className="card-snippet">{source.text}</p>
      <div className="card-score-bar-track">
        <div className="card-score-bar-fill" style={{ width: `${scorePct}%` }} />
      </div>
    </motion.div>
  );
}
