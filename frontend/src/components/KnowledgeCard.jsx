import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function KnowledgeCard({ source, index, isInspected, onClick }) {
  // CSS 3D parallax effect logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for the rotation
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Map mouse position to rotation degrees (-8 to 8 degrees)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Normalize coordinates between -0.5 and 0.5
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="scene-3d">
      <motion.div
        className="knowledge-card"
        style={{
          rotateX,
          rotateY,
          borderColor: isInspected ? 'var(--accent-primary)' : undefined,
          boxShadow: isInspected ? '0 0 20px var(--accent-glow)' : undefined
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        layout
      >
        <div className="knowledge-card-header">
          <span>MATCH {index + 1} ({source.strategy?.toUpperCase() || 'HYBRID'})</span>
          <span>SCORE: {Math.round((source.score || 0) * 100)}%</span>
        </div>
        <div className="knowledge-card-body">
          {source.text}
        </div>
      </motion.div>
    </div>
  );
}
