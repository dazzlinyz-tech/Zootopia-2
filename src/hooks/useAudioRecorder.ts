import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingDuration: number;
  hasRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isPlayingVoice: boolean;
  micPermissionDenied: boolean;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  playRecordedVoice: () => void;
  stopVoicePlayback: () => void;
  clearRecording: () => void;
}

export function useAudioRecorder(sentenceId: number): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // In-memory cache for recorded audio per sentence ID
  const cacheRef = useRef<Map<number, { blob: Blob; url: string }>>(new Map());

  // Switch sentence: load previous recording from cache if available
  useEffect(() => {
    // Stop any ongoing playback
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
    }

    const cached = cacheRef.current.get(sentenceId);
    if (cached) {
      setAudioBlob(cached.blob);
      setAudioUrl(cached.url);
    } else {
      setAudioBlob(null);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    setIsRecording(false);
  }, [sentenceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Revoke created object URLs
      cacheRef.current.forEach((val) => {
        URL.revokeObjectURL(val.url);
      });
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionDenied(true);
        return false;
      }

      // If already playing audio, stop it
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        setIsPlayingVoice(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setMicPermissionDenied(false);

      // Determine mimeType supported by browser
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration ticker
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      const startTime = Date.now();
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 200);

      return true;
    } catch (err: any) {
      console.warn('Microphone access denied or error:', err);
      setMicPermissionDenied(true);
      setIsRecording(false);
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Update cache
        const prev = cacheRef.current.get(sentenceId);
        if (prev) {
          URL.revokeObjectURL(prev.url);
        }
        cacheRef.current.set(sentenceId, { blob, url });

        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);

        // Stop stream tracks to turn off mic indicator
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [sentenceId]);

  const playRecordedVoice = useCallback(() => {
    if (!audioUrl) return;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;

    audio.onended = () => {
      setIsPlayingVoice(false);
      audioElementRef.current = null;
    };

    audio.onerror = () => {
      setIsPlayingVoice(false);
      audioElementRef.current = null;
    };

    setIsPlayingVoice(true);
    audio.play().catch((err) => {
      console.warn('Voice playback failed:', err);
      setIsPlayingVoice(false);
    });
  }, [audioUrl]);

  const stopVoicePlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
    }
  }, []);

  const clearRecording = useCallback(() => {
    stopVoicePlayback();
    const prev = cacheRef.current.get(sentenceId);
    if (prev) {
      URL.revokeObjectURL(prev.url);
      cacheRef.current.delete(sentenceId);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
  }, [sentenceId, stopVoicePlayback]);

  return {
    isRecording,
    recordingDuration,
    hasRecording: Boolean(audioUrl),
    audioBlob,
    audioUrl,
    isPlayingVoice,
    micPermissionDenied,
    startRecording,
    stopRecording,
    playRecordedVoice,
    stopVoicePlayback,
    clearRecording,
  };
}
