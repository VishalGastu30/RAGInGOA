import React, { useEffect, useRef, useState } from 'react';

export default function WaveformCanvas({ isRecording, stream }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Timer for recording duration badge
  useEffect(() => {
    let timer;
    if (isRecording) {
      setRecordingSeconds(0);
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      // Clear canvas when idle
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Set up Web Audio API
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      if (stream) {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.85;

          // Gradient color: Retro yellow -> Emerald -> Rose
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, '#FFE600');
          grad.addColorStop(0.5, '#22C55E');
          grad.addColorStop(1, '#EF4444');

          ctx.fillStyle = grad;
          ctx.fillRect(x, height - Math.max(barHeight, 4), barWidth - 2, Math.max(barHeight, 4));

          x += barWidth + 2;
        }
      };

      draw();
    } catch (e) {
      console.warn("Web Audio API error:", e);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, stream]);

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) return null;

  return (
    <div className="waveform-container">
      <div className="waveform-badge">
        <span className="rec-dot"></span>
        <span className="rec-text">REC</span>
        <span className="rec-timer">{formatTime(recordingSeconds)}</span>
      </div>
      <canvas ref={canvasRef} width={220} height={40} className="waveform-canvas" />
    </div>
  );
}
