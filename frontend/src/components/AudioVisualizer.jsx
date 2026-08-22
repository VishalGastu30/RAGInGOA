import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ isRecording, stream }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isRecording || !stream) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Clear canvas when not recording
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    
    // Smoothness and frequency bins
    analyserRef.current.smoothingTimeConstant = 0.8;
    analyserRef.current.fftSize = 256;

    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Clear canvas with slight fade for motion blur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Draw the glowing orb/ring based on volume
      const baseRadius = 70;
      const dynamicRadius = baseRadius + (average * 0.4);
      
      // Use CSS variable colors if possible, but canvas needs hardcoded or computed. 
      // We'll use a dynamic gradient based on volume
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, dynamicRadius + 20);
      gradient.addColorStop(0, `rgba(225, 29, 72, 0)`); // inner transparent
      gradient.addColorStop(0.5, `rgba(225, 29, 72, ${0.4 + average/500})`); // accent primary
      gradient.addColorStop(1, `rgba(0, 229, 255, 0)`); // accent secondary

      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw a sharp inner ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius * 0.9, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + average/200})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording, stream]);

  return (
    <canvas 
      ref={canvasRef} 
      width={250} 
      height={250} 
      className="visualizer-canvas"
    />
  );
}
