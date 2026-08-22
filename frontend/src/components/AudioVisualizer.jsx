import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ isRecording, stream, theme, width = 280, height = 280 }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef(0);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isRecording || !stream) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = [];
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Faster transient voice response
      analyserRef.current.smoothingTimeConstant = 0.55;
      analyserRef.current.fftSize = 128; // 64 frequency bins

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const isLight = theme === 'theme-sunrise';

      const draw = () => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cWidth = canvas.width;
        const cHeight = canvas.height;
        const centerX = cWidth / 2;
        const centerY = cHeight / 2;
        const baseRadius = cWidth * 0.28; // Dynamic base radius based on canvas size

        ctx.clearRect(0, 0, cWidth, cHeight);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average loudness (sensitivity gain)
        let totalVol = 0;
        for (let i = 0; i < bufferLength; i++) {
          totalVol += dataArray[i];
        }
        const avgVol = totalVol / bufferLength; // 0..255
        const volRatio = Math.min(avgVol / 120, 1); // Normalized volume ratio

        phaseRef.current += 0.015 + volRatio * 0.02; // Dynamic rotation speed

        // 1. Draw Central Pulsing Core Halo
        const glowRadius = baseRadius + volRatio * 20;
        const coreGlow = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.7, centerX, centerY, glowRadius + 15);
        if (isLight) {
          coreGlow.addColorStop(0, 'rgba(255, 94, 54, 0.0)');
          coreGlow.addColorStop(0.6, `rgba(255, 94, 54, ${0.15 + volRatio * 0.25})`);
          coreGlow.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
        } else {
          coreGlow.addColorStop(0, 'rgba(0, 229, 255, 0.0)');
          coreGlow.addColorStop(0.6, `rgba(0, 229, 255, ${0.15 + volRatio * 0.3})`);
          coreGlow.addColorStop(1, 'rgba(255, 45, 120, 0.0)');
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius + 15, 0, Math.PI * 2);
        ctx.fillStyle = coreGlow;
        ctx.fill();

        // 2. Draw Deformed Undulating Inner Orbital Ring
        const numRingPoints = 72;
        ctx.beginPath();
        for (let i = 0; i <= numRingPoints; i++) {
          const angle = (i / numRingPoints) * Math.PI * 2 + phaseRef.current;
          const sampleIdx = Math.floor((i / numRingPoints) * bufferLength);
          const rawVal = dataArray[sampleIdx % bufferLength] || 0;
          const amp = Math.pow(rawVal / 255, 0.7) * 16;
          const r = baseRadius + amp;

          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = isLight ? 'rgba(255, 94, 54, 0.6)' : 'rgba(0, 229, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Draw 64 Radial Bars with Vocal Frequency Boost
        const numBars = 64;
        const angleStep = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
          const rawVal = dataArray[i % bufferLength] || 0;
          // Non-linear gain scaling for higher vocal sensitivity
          const boostedVal = Math.pow(rawVal / 255, 0.65) * 45;
          const barHeight = Math.max(boostedVal, 4);

          const angle = i * angleStep + phaseRef.current;

          const x1 = centerX + Math.cos(angle) * (baseRadius + 2);
          const y1 = centerY + Math.sin(angle) * (baseRadius + 2);
          const x2 = centerX + Math.cos(angle) * (baseRadius + 2 + barHeight);
          const y2 = centerY + Math.sin(angle) * (baseRadius + 2 + barHeight);

          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          if (isLight) {
            grad.addColorStop(0, 'rgba(255, 94, 54, 0.95)');
            grad.addColorStop(0.5, 'rgba(255, 45, 120, 0.9)');
            grad.addColorStop(1, 'rgba(225, 29, 72, 1.0)');
          } else {
            grad.addColorStop(0, 'rgba(0, 229, 255, 0.9)');
            grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.9)');
            grad.addColorStop(1, 'rgba(255, 45, 120, 1.0)');
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.5 + volRatio * 1.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // 4. Emit & Render Peak Audio Sparks/Particles
        if (avgVol > 70 && Math.random() < 0.4) {
          const pAngle = Math.random() * Math.PI * 2;
          particlesRef.current.push({
            x: centerX + Math.cos(pAngle) * baseRadius,
            y: centerY + Math.sin(pAngle) * baseRadius,
            vx: Math.cos(pAngle) * (1.5 + Math.random() * 2),
            vy: Math.sin(pAngle) * (1.5 + Math.random() * 2),
            life: 1,
            size: 2 + Math.random() * 2.5,
            color: isLight ? 'rgba(255, 94, 54, ' : 'rgba(0, 229, 255, ',
          });
        }

        // Render Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.04;

          if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.life})`;
          ctx.fill();
        }

        animationRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (e) {
      console.error('AudioVisualizer setup error:', e);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording, stream, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
