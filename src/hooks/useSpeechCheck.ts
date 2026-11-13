import { useState, useCallback, useEffect, useRef } from 'react';
import { compareSentenceWords } from '../utils/helpers';
import { SpeechCheckResult } from '../types';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechCheck() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<SpeechCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechRecognitionAPI));
  }, []);

  const checkSentence = useCallback((targetSentence: string) => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setErrorMessage(null);
    setResult(null);

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const evaluation = compareSentenceWords(targetSentence, transcript);
        setResult(evaluation);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          setErrorMessage('No speech detected. Try speaking closer to the mic.');
        } else if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was not permitted.');
        } else {
          setErrorMessage('Could not recognize speech. Please try again.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error('Speech recognition start failed:', e);
      setIsListening(false);
      setErrorMessage('Could not initialize speech recognition.');
    }
  }, []);

  const stopChecking = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
  }, []);

  return {
    isSupported,
    isListening,
    result,
    errorMessage,
    checkSentence,
    stopChecking,
    clearResult,
  };
}
