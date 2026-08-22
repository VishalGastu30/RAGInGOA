import React, { useRef, useEffect, useState } from 'react';
import { Mic, Square, ArrowUp } from 'lucide-react';
import SponsorMarquee from './SponsorMarquee';

export default function InputDock({
  inputText,
  setInputText,
  onSendText,
  onAudioRecorded,
  onDictationUpdate,
  isRecording,
  setIsRecording,
  loading,
}) {
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isRecording]);

  const startRecording = async () => {
    if (loading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        recognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing mic:', err);
      alert('Could not access microphone');
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendText();
    }
  };

  return (
    <div className="input-dock-fixed">
      {/* Sponsor Marquee Strip */}
      <SponsorMarquee />

      {isRecording && (
        <div className="dock-rec-badge">
          <span className="live-dot-pulse" style={{ backgroundColor: '#FF0055' }} />
          REC ● Voice Query Dictation Active
        </div>
      )}

      <div className="dock-inner">
        {/* Compact Mic Orb Button */}
        <button
          type="button"
          className={`dock-mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={loading}
          title={isRecording ? 'Stop Recording' : 'Click to Speak (Press M)'}
        >
          {isRecording ? <Square size={20} fill="#FFFFFF" /> : <Mic size={22} />}
        </button>

        {/* Text Input Area */}
        <div className="dock-textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="dock-textarea"
            placeholder="Ask anything in English, Hindi, or Marathi... (Press Enter to send)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          <button
            type="button"
            className="dock-send-btn"
            onClick={() => onSendText()}
            disabled={!inputText.trim() || loading}
            title="Send Query"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
