import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Sparkles } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

export default function HeroOrb({
  onAudioRecorded,
  onDictationUpdate,
  isRecording,
  setIsRecording,
  disabled,
  onSelectPrompt,
}) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const [activeStream, setActiveStream] = useState(null);

  useEffect(() => {
    if (!isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isRecording]);

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result.split(',')[1];
          onAudioRecorded(base64Audio);
        };
        stream.getTracks().forEach((track) => track.stop());
        setActiveStream(null);
      };

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN';

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (onDictationUpdate && transcript) {
            onDictationUpdate(transcript);
          }
        };

        recognition.onerror = (e) => {
          console.error("Speech recognition error:", e);
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const samplePrompts = [
    'What is a corporation?',
    'निगम क्या होता है?',
    'Kya Corporation legal entity hai?',
    'Who won the ICC World Cup?',
  ];

  return (
    <motion.div
      className="hero-idle-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="orb-wrapper">
        <AudioVisualizer isRecording={isRecording} stream={activeStream} width={220} height={220} />
        
        <button
          type="button"
          className={`orb-core ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={disabled}
          title={isRecording ? 'Click to stop recording' : 'Click to speak or press M'}
        >
          {isRecording ? <Square size={38} fill="#FFFFFF" /> : <Mic size={48} />}
        </button>
      </div>

      <div>
        <h1 className="hero-tagline">Voice-Enabled Indic RAG</h1>
        <p className="hero-subtext">
          Ask questions in English, Hindi, or Hinglish. Powered by FAISS Vector Retrieval, Sarvam Voice STT, and Groq LLM.
        </p>
      </div>

      <div className="hero-prompt-chips">
        {samplePrompts.map((q, idx) => (
          <button
            key={idx}
            type="button"
            className="prompt-chip"
            onClick={() => onSelectPrompt(q)}
          >
            <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
            {q}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
