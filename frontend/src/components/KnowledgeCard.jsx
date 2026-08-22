import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function KnowledgeCard({ source, index, isSelected, onClick }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 18 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 18 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7deg', '-7deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7deg', '7deg']);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const scorePct = Math.round((source.score || 0) * 100);

  return (
    <motion.div
      className={`knowledge-card-3d ${isSelected ? 'selected' : ''}`}
      style={{ rotateX, rotateY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
