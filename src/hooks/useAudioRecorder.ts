import { useState, useRef, useCallback, useEffect } from 'react';

export interface StoredRecording {
  blob: Blob;
  url: string;
  durationMs: number;
}

// Session-persistent recording store so completed recordings survive screen switches & sentence navigation
const recordingStore = new Map<number, StoredRecording>();

interface ActiveRecordingSession {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAtMs: number;
  tickerId: number | null;
  saveSentenceId: number | null;
  onStopResolvers: Array<(rec: StoredRecording | null) => void>;
}

// Module-level active recording controller:
// Ensures MediaRecorder NEVER stops automatically on sentence change, video pause, segment end, loop end, or screen unmount.
// Recording ONLY stops when the user explicitly triggers stopRecording() (Stop Recording button).
let activeSession: ActiveRecordingSession | null = null;
let isStartingRecording = false;
let globalIsRecording = false;
let globalElapsedMs = 0;
let globalError: string | null = null;
let globalMicDenied = false;

type SessionListener = () => void;
const listeners = new Set<SessionListener>();
let latestOnRecordingSaved: ((savedSentenceId: number, recording: StoredRecording) => void) | undefined;
let latestActiveSentenceId = 1;

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function stopSessionTicker(session: ActiveRecordingSession | null) {
  if (session && session.tickerId !== null) {
    window.clearInterval(session.tickerId);
    session.tickerId = null;
  }
}

function releaseSessionStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

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
  const [, setRenderTick] = useState(0);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const activeSentenceIdRef = useRef<number>(sentenceId);
  activeSentenceIdRef.current = sentenceId;
  latestActiveSentenceId = sentenceId;
  latestOnRecordingSaved = options?.onRecordingSaved;

  // Subscribe to global recording session updates so state stays synced across sentence/screen transitions
  useEffect(() => {
    const listener = () => {
      setRenderTick((t) => t + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // On sentence switch: stop only voice playback preview; NEVER stop an active microphone recording
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
    }
    if (globalError !== null) {
      globalError = null;
      notifyListeners();
    }
  }, [sentenceId]);

  // On unmount: stop only voice playback preview (do NOT stop active recording or revoke stored URLs)
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (
      isStartingRecording ||
      (activeSession && activeSession.recorder.state === 'recording')
    ) {
      return false;
    }

    isStartingRecording = true;
    globalError = null;
    notifyListeners();
    let localStream: MediaStream | null = null;

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        globalMicDenied = true;
        globalError =
          '이 브라우저는 오디오 녹음을 지원하지 않거나 보안 연결(HTTPS)이 필요합니다.';
        notifyListeners();
        return false;
      }

      // Stop playback preview if currently playing
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

      globalMicDenied = false;

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

      const recorder = new MediaRecorder(localStream, optionsObj);
      const recordingStartMs = Date.now();
      const session: ActiveRecordingSession = {
        recorder,
        stream: localStream,
        chunks: [],
        startedAtMs: recordingStartMs,
        tickerId: null,
        saveSentenceId: null,
        onStopResolvers: [],
      };
      activeSession = session;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          session.chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopSessionTicker(session);
        releaseSessionStream(session.stream);
        if (activeSession === session) {
          activeSession = null;
          globalIsRecording = false;
          globalElapsedMs = 0;
          globalError =
            '녹음 중 예기치 않은 오류가 발생했습니다. 기존 녹음 데이터는 유지됩니다.';
          notifyListeners();
        }
        const resolvers = session.onStopResolvers.splice(0);
        resolvers.forEach((r) => r(null));
      };

      recorder.onstop = () => {
        stopSessionTicker(session);
        releaseSessionStream(session.stream);

        if (activeSession === session) {
          activeSession = null;
          globalIsRecording = false;
          globalElapsedMs = 0;
        }

        const durationMs = Math.max(100, Date.now() - session.startedAtMs);
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(session.chunks, { type: mimeType });

        // Guard against empty recording overwriting valid prior recording
        if (blob.size === 0) {
          globalError =
            '녹음된 소리가 저장되지 않았습니다. 마이크 입력을 확인한 후 다시 시도해 주세요.';
          notifyListeners();
          const resolvers = session.onStopResolvers.splice(0);
          resolvers.forEach((r) => r(null));
          return;
        }

        const targetSentenceId = session.saveSentenceId ?? latestActiveSentenceId;
        const url = URL.createObjectURL(blob);
        const prev = recordingStore.get(targetSentenceId);
        if (prev) {
          URL.revokeObjectURL(prev.url);
        }

        const saved: StoredRecording = { blob, url, durationMs };
        recordingStore.set(targetSentenceId, saved);
        notifyListeners();

        latestOnRecordingSaved?.(targetSentenceId, saved);

        const resolvers = session.onStopResolvers.splice(0);
        resolvers.forEach((r) => r(saved));
      };

      recorder.start(100);
      globalIsRecording = true;
      globalElapsedMs = 0;

      session.tickerId = window.setInterval(() => {
        if (activeSession === session && globalIsRecording) {
          globalElapsedMs = Date.now() - session.startedAtMs;
          notifyListeners();
        }
      }, 100);

      notifyListeners();
      return true;
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      releaseSessionStream(localStream);
      activeSession = null;
      globalIsRecording = false;
      globalElapsedMs = 0;
      const formatted = formatMicErrorMessage(err);
      globalMicDenied = formatted.denied;
      globalError = formatted.message;
      notifyListeners();
      return false;
    } finally {
      isStartingRecording = false;
    }
  }, []);

  // Manual Stop Recording: the ONLY place in the app that calls recorder.stop()
  const stopRecording = useCallback((): Promise<StoredRecording | null> => {
    return new Promise((resolve) => {
      const session = activeSession;
      if (!session || session.recorder.state === 'inactive') {
        if (session) {
          stopSessionTicker(session);
          releaseSessionStream(session.stream);
          activeSession = null;
        }
        globalIsRecording = false;
        globalElapsedMs = 0;
        notifyListeners();
        resolve(null);
        return;
      }

      session.saveSentenceId = activeSentenceIdRef.current;
      session.onStopResolvers.push(resolve);
      stopSessionTicker(session);

      try {
        session.recorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        releaseSessionStream(session.stream);
        activeSession = null;
        globalIsRecording = false;
        globalElapsedMs = 0;
        globalError = '녹음을 종료하는 중 오류가 발생했습니다. 다시 시도해 주세요.';
        notifyListeners();
        const resolvers = session.onStopResolvers.splice(0);
        resolvers.forEach((r) => r(null));
      }
    });
  }, []);

  const currentSaved = recordingStore.get(sentenceId);
  const audioBlob = currentSaved?.blob ?? null;
  const audioUrl = currentSaved?.url ?? null;
  const recordedDurationMs = currentSaved?.durationMs ?? 0;

  const playRecordedVoice = useCallback(() => {
    const saved = recordingStore.get(activeSentenceIdRef.current);
    const targetUrl = saved?.url;
    if (!targetUrl) return;

    globalError = null;
    notifyListeners();

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsPlayingVoice(false);
      return;
    }

    const audio = new Audio(targetUrl);
    audioElementRef.current = audio;

    audio.onended = () => {
      setIsPlayingVoice(false);
      audioElementRef.current = null;
    };

    audio.onerror = () => {
      setIsPlayingVoice(false);
      audioElementRef.current = null;
      globalError = '녹음된 오디오를 재생할 수 없습니다.';
      notifyListeners();
    };

    setIsPlayingVoice(true);
    audio.play().catch((err) => {
      console.warn('Voice playback failed:', err);
      setIsPlayingVoice(false);
      audioElementRef.current = null;
      globalError = '브라우저에서 오디오 재생이 차단되었거나 실패했습니다.';
      notifyListeners();
    });
  }, []);

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
      notifyListeners();
    }
  }, [stopVoicePlayback]);

  const clearError = useCallback(() => {
    globalError = null;
    notifyListeners();
  }, []);

  return {
    isRecording: globalIsRecording,
    recordingDuration: Math.floor(globalElapsedMs / 1000),
    recordingElapsedMs: globalElapsedMs,
    recordedDurationMs,
    hasRecording: Boolean(audioUrl),
    audioBlob,
    audioUrl,
    isPlayingVoice,
    micPermissionDenied: globalMicDenied,
    recordingError: globalError,
    startRecording,
    stopRecording,
    playRecordedVoice,
    stopVoicePlayback,
    clearRecording,
    clearError,
  };
}
