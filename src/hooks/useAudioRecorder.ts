import { useState, useRef, useCallback, useEffect } from 'react';

export interface StoredRecording {
  blob: Blob;
  url: string;
  durationMs: number;
}

// Session-persistent recording store so recordings survive screen switches & sentence navigation
const recordingStore = new Map<number, StoredRecording>();

export interface UseAudioRecorderOptions {
  onRecordingSaved?: (savedSentenceId: number, recording: StoredRecording) => void;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingDuration: number; // elapsed whole seconds during active recording
  recordingElapsedMs: number;
  recordedDurationMs: number; // saved recording duration in ms
  hasRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isPlayingVoice: boolean;
  micPermissionDenied: boolean;
  recordingError: string | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<StoredRecording | null>;
  playRecordedVoice: () => void;
  stopVoicePlayback: () => void;
  clearRecording: () => void;
  clearError: () => void;
}

function formatMicErrorMessage(err: unknown): { denied: boolean; message: string } {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      denied: true,
      message:
        '마이크 권한이 거부되었습니다. 브라우저 주소창 왼쪽의 사이트 설정(🔒)에서 마이크 권한을 허용해 주세요.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      denied: false,
      message:
        '연결된 마이크 장치를 찾을 수 없습니다. 마이크 연결 상태를 확인한 후 다시 시도해 주세요.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      denied: false,
      message:
        '다른 앱 또는 브라우저 탭에서 마이크를 사용 중이어서 녹음을 시작할 수 없습니다.',
    };
  }
  return {
    denied: false,
    message:
      '녹음을 시작하는 중 오류가 발생했습니다. 브라우저의 마이크 설정과 HTTPS 연결 상태를 확인해 주세요.',
  };
}

export function useAudioRecorder(
  sentenceId: number,
  options?: UseAudioRecorderOptions
): UseAudioRecorderReturn {
  const initialCached = recordingStore.get(sentenceId);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordedDurationMs, setRecordedDurationMs] = useState(initialCached?.durationMs ?? 0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(initialCached?.blob ?? null);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialCached?.url ?? null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const activeSentenceIdRef = useRef<number>(sentenceId);
  activeSentenceIdRef.current = sentenceId;

  const recordingTargetIdRef = useRef<number>(sentenceId);
  const onRecordingSavedRef = useRef(options?.onRecordingSaved);
  onRecordingSavedRef.current = options?.onRecordingSaved;

  const pendingStopResolversRef = useRef<Array<(rec: StoredRecording | null) => void>>([]);

  const isStartingRef = useRef<boolean>(false);

  const stopDurationTicker = () => {
    if (durationIntervalRef.current !== null) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const releaseStream = (targetStream?: MediaStream | null) => {
    const streamToStop = targetStream ?? streamRef.current;
    if (streamToStop) {
      streamToStop.getTracks().forEach((track) => track.stop());
      if (!targetStream || streamRef.current === targetStream) {
        streamRef.current = null;
      }
    }
  };

  // Switch sentence: finalize any active recording safely for its original sentenceId, then load target sentence cache
  useEffect(() => {
    // Stop ongoing voice playback
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
    }

    const cached = recordingStore.get(sentenceId);
    if (cached) {
      setAudioBlob(cached.blob);
      setAudioUrl(cached.url);
      setRecordedDurationMs(cached.durationMs);
    } else {
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordedDurationMs(0);
    }
    setRecordingElapsedMs(0);
    setRecordingError(null);

    return () => {
      // If user moves to another sentence or leaves Practice screen while actively recording,
      // stop & flush the recording cleanly to its original target sentenceId so data isn't lost.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        stopDurationTicker();
        try {
          recorder.stop();
        } catch {
          releaseStream();
        }
        setIsRecording(false);
      }
    };
  }, [sentenceId]);

  // Cleanup active playback/timers on unmount (do NOT revoke recordingStore URLs so recordings survive screen switches)
  useEffect(() => {
    return () => {
      stopDurationTicker();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (
      isStartingRef.current ||
      (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording')
    ) {
      return false;
    }

    isStartingRef.current = true;
    setRecordingError(null);
    let localStream: MediaStream | null = null;

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        setMicPermissionDenied(true);
        setRecordingError(
          '이 브라우저는 오디오 녹음을 지원하지 않거나 보안 연결(HTTPS)이 필요합니다.'
        );
        return false;
      }

      // Stop playback if playing
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
        setIsPlayingVoice(false);
      }

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = localStream;
      setMicPermissionDenied(false);

      // Determine mimeType supported by browser
      let optionsObj: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          optionsObj = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          optionsObj = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          optionsObj = { mimeType: 'audio/mp4' };
        }
      }

      const targetSentenceId = activeSentenceIdRef.current;
      recordingTargetIdRef.current = targetSentenceId;

      const recorder = new MediaRecorder(localStream, optionsObj);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      audioChunksRef.current = chunks;
      const recordingStartMs = Date.now();
      startedAtRef.current = recordingStartMs;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        if (mediaRecorderRef.current === recorder) {
          stopDurationTicker();
          setIsRecording(false);
        }
        releaseStream(localStream);
        setRecordingError('녹음 중 예기치 않은 오류가 발생했습니다. 기존 녹음 데이터는 유지됩니다.');
        const resolvers = pendingStopResolversRef.current.splice(0);
        resolvers.forEach((r) => r(null));
      };

      recorder.onstop = () => {
        if (mediaRecorderRef.current === recorder) {
          stopDurationTicker();
          mediaRecorderRef.current = null;
          setIsRecording(false);
        }
        releaseStream(localStream);

        const durationMs = Math.max(100, Date.now() - recordingStartMs);
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });

        // Guard against empty recording overwriting valid prior recording
        if (blob.size === 0) {
          setRecordingError(
            '녹음된 소리가 저장되지 않았습니다. 마이크 입력을 확인한 후 다시 시도해 주세요.'
          );
          const resolvers = pendingStopResolversRef.current.splice(0);
          resolvers.forEach((r) => r(null));
          return;
        }

        const url = URL.createObjectURL(blob);
        const prev = recordingStore.get(targetSentenceId);
        if (prev) {
          URL.revokeObjectURL(prev.url);
        }

        const saved: StoredRecording = { blob, url, durationMs };
        recordingStore.set(targetSentenceId, saved);

        if (activeSentenceIdRef.current === targetSentenceId) {
          setAudioBlob(blob);
          setAudioUrl(url);
          setRecordedDurationMs(durationMs);
        }

        onRecordingSavedRef.current?.(targetSentenceId, saved);

        const resolvers = pendingStopResolversRef.current.splice(0);
        resolvers.forEach((r) => r(saved));
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingElapsedMs(0);

      stopDurationTicker();
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingElapsedMs(Date.now() - recordingStartMs);
      }, 100);

      return true;
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      releaseStream(localStream);
      setIsRecording(false);
      const formatted = formatMicErrorMessage(err);
      setMicPermissionDenied(formatted.denied);
      setRecordingError(formatted.message);
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<StoredRecording | null> => {
    return new Promise((resolve) => {
      stopDurationTicker();
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === 'inactive') {
        releaseStream();
        setIsRecording(false);
        resolve(null);
        return;
      }

      pendingStopResolversRef.current.push(resolve);

      try {
        recorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        releaseStream();
        setIsRecording(false);
        setRecordingError('녹음을 종료하는 중 오류가 발생했습니다. 다시 시도해 주세요.');
        const resolvers = pendingStopResolversRef.current.splice(0);
        resolvers.forEach((r) => r(null));
      }
    });
  }, []);

  const playRecordedVoice = useCallback(() => {
    if (!audioUrl) return;
    setRecordingError(null);

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
      return;
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
      setRecordingError('녹음된 오디오를 재생할 수 없습니다.');
    };

    setIsPlayingVoice(true);
    audio.play().catch((err) => {
      console.warn('Voice playback failed:', err);
      setIsPlayingVoice(false);
      audioElementRef.current = null;
      setRecordingError('브라우저에서 오디오 재생이 차단되었거나 실패했습니다.');
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
    const prev = recordingStore.get(activeSentenceIdRef.current);
    if (prev) {
      URL.revokeObjectURL(prev.url);
      recordingStore.delete(activeSentenceIdRef.current);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordedDurationMs(0);
    setRecordingElapsedMs(0);
  }, [stopVoicePlayback]);

  const clearError = useCallback(() => {
    setRecordingError(null);
  }, []);

  return {
    isRecording,
    recordingDuration: Math.floor(recordingElapsedMs / 1000),
    recordingElapsedMs,
    recordedDurationMs,
    hasRecording: Boolean(audioUrl),
    audioBlob,
    audioUrl,
    isPlayingVoice,
    micPermissionDenied,
    recordingError,
    startRecording,
    stopRecording,
    playRecordedVoice,
    stopVoicePlayback,
    clearRecording,
    clearError,
  };
}
