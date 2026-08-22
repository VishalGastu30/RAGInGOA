import React, { useRef, useEffect, useState } from 'react';
import AudioVisualizer from './AudioVisualizer';
import { Mic, Square } from 'lucide-react';

export default function MicButton({ onAudioRecorded, onDictationUpdate, isRecording, setIsRecording, disabled }) {
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
        recognition.lang = 'hi-IN'; // Default to Indic/Hindi for RAGInGOA

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

  return (
    <div className="mic-core-wrapper">
      {/* Background Visualizer */}
      <AudioVisualizer isRecording={isRecording} stream={activeStream} />
      
      {/* Foreground Button */}
      <button
        type="button"
        className={`mic-btn-pro ${isRecording ? 'recording' : ''}`}
        onClick={toggleRecording}
        disabled={disabled}
        title={isRecording ? 'Click to stop recording' : 'Click to record voice query'}
      >
        {isRecording ? <Square size={32} fill="white" /> : <Mic size={36} />}
      </button>
    </div>
  );
}
