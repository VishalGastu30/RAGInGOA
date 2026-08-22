import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ isRecording, stream, width = 220, height = 220 }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

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
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.smoothingTimeConstant = 0.75;
      analyserRef.current.fftSize = 128; // 64 frequency bins

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cWidth = canvas.width;
        const cHeight = canvas.height;
        const centerX = cWidth / 2;
        const centerY = cHeight / 2;
        const innerRadius = 70; // Radius of central mic orb

        ctx.clearRect(0, 0, cWidth, cHeight);
        analyserRef.current.getByteFrequencyData(dataArray);

        const numBars = 64;
        const angleStep = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
          const value = dataArray[i % bufferLength] || 0;
          const barHeight = (value / 255) * 35; // Max 35px extension

          const angle = i * angleStep - Math.PI / 2;

          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

          // Dynamic Gradient per bar (Cyan base -> Pink tip)
          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
          grad.addColorStop(1, 'rgba(255, 45, 120, 0.9)');

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
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
  }, [isRecording, stream]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
