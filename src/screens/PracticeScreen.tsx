import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Repeat,
  Mic,
  MicOff,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  List,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  AudioLines,
  FastForward,
} from 'lucide-react';
import { Sentence, SentenceProgress, StepNumber, SelfCheckScore } from '../types';
import { YouTubePlayer, YouTubePlayerRef } from '../components/YouTubePlayer';
import { SHADOWING_STEPS_INFO } from '../constants/initialData';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSpeechCheck } from '../hooks/useSpeechCheck';
import { getSpeakerTheme, cleanWord } from '../utils/helpers';

interface PracticeScreenProps {
  sentence: Sentence;
  sentences: Sentence[];
  sentenceIndex: number;
  totalSentences: number;
  progress: Record<number, SentenceProgress>;
  onUpdateProgress: (updated: SentenceProgress) => void;
  onPrevSentence: () => void;
  onNextSentence: () => void;
  onJumpToSentenceIndex: (index: number) => void;
  onOpenList: () => void;
  onFinishApp: () => void;
  playerRef: React.RefObject<YouTubePlayerRef | null>;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  sentence,
  sentences,
  sentenceIndex,
  totalSentences,
  progress,
  onUpdateProgress,
  onPrevSentence,
  onNextSentence,
  onJumpToSentenceIndex,
  onOpenList,
  onFinishApp,
  playerRef,
}) => {
  // Shadowing step: 1 (Listen), 2 (Mumble), 3 (Read & Shadow), 4 (Shadow)
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [hideText, setHideText] = useState(true);
  const [hideKorean, setHideKorean] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isPlayingSegment, setIsPlayingSegment] = useState<boolean>(false);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);
  const isPlayingSequenceRef = useRef(false);
  isPlayingSequenceRef.current = isPlayingSequence;

  // Audio recording hook
  const {
    isRecording,
    recordingDuration,
    hasRecording,
    isPlayingVoice,
    micPermissionDenied,
    startRecording,
    stopRecording,
    playRecordedVoice,
    stopVoicePlayback,
  } = useAudioRecorder(sentence.id);

  // Speech check hook (Web Speech API)
  const {
    isSupported: isSpeechCheckSupported,
    isListening: isCheckingSpeech,
    result: speechResult,
    errorMessage: speechError,
    checkSentence,
    stopChecking,
    clearResult,
  } = useSpeechCheck();

  const currentProgress: SentenceProgress = progress[sentence.id] || {
    id: sentence.id,
    plays: 0,
    recordings: 0,
    selfCheck: [null, null, null],
    status: 'new',
  };

  // Step change updates text visibility according to PRD section 5 item 6
  const handleSelectStep = (step: StepNumber) => {
    setCurrentStep(step);
    const stepInfo = SHADOWING_STEPS_INFO.find((s) => s.step === step);
    if (stepInfo) {
      setHideText(stepInfo.defaultHideText);
    }
  };

  // Reset speech check and voice playback on sentence change
  useEffect(() => {
    clearResult();
    if (!isPlayingSequenceRef.current) {
      setIsPlayingSegment(false);
    }
    stopVoicePlayback();
  }, [sentence.id, clearResult, stopVoicePlayback]);

  // Speed changes
  const handleSetSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(speed);
    }
  };

  // Play single segment
  const handlePlayOnce = () => {
    if (!playerRef.current) return;
    setIsPlayingSequence(false);
    setIsPlayingSegment(true);
    playerRef.current.playSegment(sentence.start, sentence.end);

    // Track play count
    onUpdateProgress({
      ...currentProgress,
      plays: currentProgress.plays + 1,
    });
  };

  // Play continuous dialogue from current sentence onward
  const handleToggleSequencePlay = () => {
    if (!playerRef.current) return;
    if (isPlayingSequence) {
      playerRef.current.pause();
      setIsPlayingSequence(false);
      setIsPlayingSegment(false);
      return;
    }
    setIsLooping(false);
    setIsPlayingSegment(false);
    setIsPlayingSequence(true);
    playerRef.current.playSequence(
      sentences.map((s) => ({ id: s.id, start: s.start, end: s.end })),
      sentenceIndex
    );
  };

  // Stop playback
  const handleStopPlayback = () => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setIsPlayingSegment(false);
    setIsPlayingSequence(false);
  };

  // Handle when video reaches sentence.end
  const loopTimerRef = useRef<number | null>(null);
  const recordingStopTimerRef = useRef<number | null>(null);

  const handleSegmentEnd = () => {
    setIsPlayingSegment(false);

    // If recording was active, stop recording 1 second after sentence ends (PRD section 5 item 7)
    if (isRecording) {
      recordingStopTimerRef.current = window.setTimeout(async () => {
        await stopRecording();
        // Update status and recordings count
        const newStatus = currentStep === 4 ? 'done' : 'practiced';
        onUpdateProgress({
          ...currentProgress,
          recordings: currentProgress.recordings + 1,
          status: currentProgress.status === 'done' ? 'done' : newStatus,
        });
      }, 1000);
      return;
    }

    // If loop is on (and not recording), wait 1.5 seconds then replay
    if (isLooping) {
      loopTimerRef.current = window.setTimeout(() => {
        if (playerRef.current) {
          setIsPlayingSegment(true);
          playerRef.current.playSegment(sentence.start, sentence.end);
        }
      }, 1500);
    }
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      if (recordingStopTimerRef.current) clearTimeout(recordingStopTimerRef.current);
    };
  }, []);

  // Record Button: plays sentence once and records voice simultaneously
  const handleStartRecordAndPlay = async () => {
    setIsPlayingSequence(false);
    if (isRecording) {
      // Force manual stop
      if (recordingStopTimerRef.current) clearTimeout(recordingStopTimerRef.current);
      await stopRecording();
      if (playerRef.current) playerRef.current.pause();
      setIsPlayingSegment(false);
      return;
    }

    const started = await startRecording();
    if (!started) return;

    // Start playing sentence once (loop is ignored while recording)
    if (playerRef.current) {
      setIsPlayingSegment(true);
      playerRef.current.playSegment(sentence.start, sentence.end);
    }
  };

  // Self check rating handler
  const handleRateSelfCheck = (index: 0 | 1 | 2, score: SelfCheckScore) => {
    const updatedChecks = [...currentProgress.selfCheck] as [
      SelfCheckScore,
      SelfCheckScore,
      SelfCheckScore,
    ];
    updatedChecks[index] = score;

    onUpdateProgress({
      ...currentProgress,
      selfCheck: updatedChecks,
    });
  };

  // Play Original segment then Learner Voice, or vice-versa
  const handlePlayOriginal = () => {
    setIsPlayingSequence(false);
    if (playerRef.current) {
      setIsPlayingSegment(true);
      playerRef.current.playSegment(sentence.start, sentence.end);
    }
  };

  // Render text with stressed words in bold accent
  const renderFormattedSentence = (text: string, stressWords: string[]) => {
    const tokens = text.split(/(\s+)/);
    const cleanedStress = stressWords.map((s) => cleanWord(s).toLowerCase());

    return (
      <span>
        {tokens.map((token, i) => {
          const cleaned = cleanWord(token).toLowerCase();
          const isStressed = cleanedStress.includes(cleaned);

          if (isStressed) {
            return (
              <span
                key={i}
                className="font-black text-amber-300 underline decoration-amber-400 decoration-[3px] underline-offset-4"
              >
                {token}
              </span>
            );
          }
          return <span key={i}>{token}</span>;
        })}
      </span>
    );
  };

  const speakerTheme = getSpeakerTheme(sentence.speaker);
  const activeStepInfo = SHADOWING_STEPS_INFO.find((s) => s.step === currentStep);

  return (
    <div className="w-full flex flex-col gap-3 pb-16">
      {/* Top Header / Navigation */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          <List className="w-4 h-4 text-teal-400" />
          <span>List / 목록</span>
        </button>

        {/* Sentence Counter with Arrow navigation */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl shadow-xs">
          <button
            type="button"
            onClick={onPrevSentence}
            disabled={sentenceIndex === 0}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous sentence"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-200">
            Sentence {sentenceIndex + 1} / {totalSentences}
          </span>
          <button
            type="button"
            onClick={onNextSentence}
            disabled={sentenceIndex === totalSentences - 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next sentence"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Finish button if on last sentence */}
        {sentenceIndex === totalSentences - 1 ? (
          <button
            type="button"
            onClick={onFinishApp}
            className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Finish / 완료
          </button>
        ) : (
          <button
            type="button"
            onClick={onNextSentence}
            className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Next ▶
          </button>
        )}
      </div>

      {/* 1. Video Player (16:9) with the one-line credit underneath */}
      <div className="px-3">
        <YouTubePlayer
          ref={playerRef}
          playbackRate={playbackSpeed}
          onSegmentEnd={handleSegmentEnd}
          onSequenceSentenceChange={(nextIdx) => {
            onJumpToSentenceIndex(nextIdx);
          }}
          onSequenceEnd={() => {
            setIsPlayingSequence(false);
            setIsPlayingSegment(false);
          }}
        />
      </div>

      {/* 6. Step Guide (4 tabs) */}
      <div className="px-3">
        <div className="grid grid-cols-4 gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          {SHADOWING_STEPS_INFO.map((s) => {
            const isActive = currentStep === s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => handleSelectStep(s.step as StepNumber)}
                className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isActive
                    ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                  Step {s.step}
                </span>
                <span className="text-xs font-semibold leading-tight mt-0.5">{s.title}</span>
                <span className="text-[10px] opacity-75">{s.titleKo}</span>
              </button>
            );
          })}
        </div>

        {/* Step instruction card */}
        {activeStepInfo && (
          <div className="mt-2 py-2 px-3.5 rounded-xl bg-teal-950/30 border border-teal-500/20 text-xs flex items-center justify-between">
            <div>
              <p className="text-teal-200 font-medium">{activeStepInfo.descEn}</p>
              <p className="text-teal-300/80 text-[11px] mt-0.5">{activeStepInfo.descKo}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 shrink-0 ml-2">
              {activeStepInfo.defaultHideText ? 'Text Hidden' : 'Text Shown'}
            </span>
          </div>
        )}
      </div>

      {/* 3 & 4. Sentence Display Card with large text (>= 22px), stress words, and toggles */}
      <div className="px-3">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          {/* Top metadata of card */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${speakerTheme.bg}`}>
                <span>{speakerTheme.icon}</span>
                <span>{sentence.speaker}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {sentence.start.toFixed(3)}s – {sentence.end.toFixed(3)}s
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHideText(!hideText)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  hideText
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {hideText ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{hideText ? 'Show Text / 보기' : 'Hide Text / 숨기기'}</span>
              </button>
            </div>
          </div>

          {/* Large Sentence Text */}
          <div className="min-h-[72px] flex items-center justify-center text-center px-1">
            {hideText ? (
              <div className="py-4 px-6 rounded-xl bg-slate-950/80 border border-dashed border-slate-800 w-full text-center">
                <p className="text-slate-400 text-sm font-medium">
                  🙈 Text is hidden for active listening & shadowing!
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  자막이 숨겨져 있습니다. 소리에 집중해 연습해보세요.
                </p>
              </div>
            ) : (
              <div className="text-[23px] font-bold text-white tracking-wide leading-relaxed">
                {renderFormattedSentence(sentence.text, sentence.stress)}
              </div>
            )}
          </div>

          {/* Korean meaning */}
          {!hideKorean && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-center">
              <p className="text-sm text-slate-400 font-normal leading-normal">{sentence.korean}</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Control Row: ▶ Play, 🔁 Loop, Speed (0.5x / 0.75x / 1.0x) */}
      <div className="px-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          {/* Play / Pause Segment */}
          <button
            type="button"
            onClick={isPlayingSegment ? handleStopPlayback : handlePlayOnce}
            className={`min-h-[48px] px-5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              isPlayingSegment
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-900/30'
                : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/30'
            }`}
          >
            {isPlayingSegment ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause / 일시정지</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play / 재생</span>
              </>
            )}
          </button>

          {/* Loop toggle */}
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={`min-h-[48px] px-3.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all border cursor-pointer ${
              isLooping
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700'
            }`}
          >
            <Repeat className={`w-4 h-4 ${isLooping ? 'text-orange-400 animate-pulse' : ''}`} />
            <span>Loop / {isLooping ? 'ON (1.5s 대기)' : 'OFF'}</span>
          </button>

          {/* Speed Selector (0.5x / 0.75x / 1.0x) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[0.5, 0.75, 1.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSetSpeed(rate)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  playbackSpeed === rate
                    ? 'bg-teal-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}×
              </button>
            ))}
          </div>

          {/* Continuous Dialogue Play (연속 대사 흐름 재생) */}
          {totalSentences > 1 && (
            <button
              type="button"
              onClick={handleToggleSequencePlay}
              className={`w-full min-h-[44px] py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                isPlayingSequence
                  ? 'bg-teal-500/20 text-teal-200 border-teal-400/50 animate-pulse'
                  : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <FastForward className="w-4 h-4 text-teal-400" />
              <span>
                {isPlayingSequence
                  ? 'Playing Continuous Dialogue... / 연속 대사 재생 중 (클릭 시 정지)'
                  : 'Continuous Dialogue Play / 이후 연속 대사 이어서 듣기'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 7. Record Area: 🎙 Record, ▶ My Voice, ▶ Original */}
      <div className="px-3">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-orange-400" />
              <span>Voice Shadowing & Review</span>
              <span className="text-xs font-normal text-slate-400">/ 녹음 및 비교</span>
            </h3>
            {hasRecording && (
              <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                Recorded ✓
              </span>
            )}
          </div>

          {/* Record button (48px+ tall) */}
          <button
            type="button"
            onClick={handleStartRecordAndPlay}
            className={`w-full min-h-[52px] py-3.5 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all cursor-pointer ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-900/50'
                : 'bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white shadow-lg shadow-orange-900/40 border border-orange-400/30'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <div className="text-left">
                  <div className="leading-tight">Recording Voice... ({recordingDuration}s)</div>
                  <div className="text-xs font-normal text-rose-100">동시 재생 중 · 끝난 후 1초 뒤 자동 중지</div>
                </div>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <div className="text-left">
                  <div className="leading-tight">🎙 Record / 녹음하며 쉐도잉</div>
                  <div className="text-xs font-normal text-orange-100">영상이 재생되며 내 목소리를 동시에 녹음합니다</div>
                </div>
              </>
            )}
          </button>

          {/* Permission denied warning */}
          {micPermissionDenied && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200">
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <MicOff className="w-4 h-4 text-amber-400" />
                <span>Mic is off. You can still listen and shadow out loud.</span>
              </div>
              <p className="text-amber-300/80">
                마이크 권한이 꺼져 있습니다. 브라우저 설정에서 마이크를 켜거나 소리 내어 쉐도잉을 계속할 수 있습니다.
              </p>
            </div>
          )}

          {/* Replay Buttons: My Voice & Original */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={!hasRecording || isPlayingVoice}
              onClick={playRecordedVoice}
              className="min-h-[48px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Volume2 className={`w-4 h-4 text-teal-400 ${isPlayingVoice ? 'animate-bounce' : ''}`} />
              <div className="text-left">
                <div className="leading-tight">{isPlayingVoice ? 'Playing...' : '▶ My Voice'}</div>
                <div className="text-[10px] text-slate-400">내 목소리 듣기</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handlePlayOriginal}
              className="min-h-[48px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <AudioLines className="w-4 h-4 text-orange-400" />
              <div className="text-left">
                <div className="leading-tight">▶ Original</div>
                <div className="text-[10px] text-slate-400">원본 클립 듣기</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 8. Self-Check (after recording or practicing) */}
      <div className="px-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>Self-Check</span>
              <span className="text-xs font-normal text-slate-400">/ 자기 점검</span>
            </h3>
            <span className="text-[11px] text-slate-400">정직하게 체크해보세요</span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                idx: 0 as const,
                en: 'Did I keep up with the speed?',
                ko: '속도를 잘 따라갔나요?',
              },
              {
                idx: 1 as const,
                en: 'Did I stress the bold words?',
                ko: '강조 단어에 힘을 주었나요?',
              },
              {
                idx: 2 as const,
                en: 'Did my voice go up and down like the actor?',
                ko: '억양(인토네이션)을 살렸나요?',
              },
            ].map((criterion) => {
              const currentScore = currentProgress.selfCheck[criterion.idx];
              return (
                <div
                  key={criterion.idx}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 flex items-center justify-between gap-2"
                >
                  <div className="text-xs pr-1">
                    <p className="font-semibold text-slate-200 leading-tight">{criterion.en}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{criterion.ko}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRateSelfCheck(criterion.idx, 'great')}
                      className={`p-2 rounded-xl text-lg transition-all cursor-pointer ${
                        currentScore === 'great'
                          ? 'bg-teal-500/20 text-teal-300 ring-2 ring-teal-500'
                          : 'opacity-50 hover:opacity-100 hover:bg-slate-800'
                      }`}
                      title="Great / 아주 좋아요"
                    >
                      😀
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateSelfCheck(criterion.idx, 'good')}
                      className={`p-2 rounded-xl text-lg transition-all cursor-pointer ${
                        currentScore === 'good'
                          ? 'bg-amber-500/20 text-amber-300 ring-2 ring-amber-500'
                          : 'opacity-50 hover:opacity-100 hover:bg-slate-800'
                      }`}
                      title="Good / 괜찮아요"
                    >
                      🙂
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateSelfCheck(criterion.idx, 'needs_practice')}
                      className={`p-2 rounded-xl text-lg transition-all cursor-pointer ${
                        currentScore === 'needs_practice'
                          ? 'bg-rose-500/20 text-rose-300 ring-2 ring-rose-500'
                          : 'opacity-50 hover:opacity-100 hover:bg-slate-800'
                      }`}
                      title="Needs practice / 더 연습할래요"
                    >
                      😐
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 9. Word Check (Optional Web Speech API) */}
      {isSpeechCheckSupported && (
        <div className="px-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Check My Words</span>
                <span className="text-xs font-normal text-slate-400">/ 발음 단어 체크</span>
              </h3>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                en-US Speech Recognition
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-normal">
              마이크에 문장을 읽으면 브라우저 AI가 인식한 단어를 색상으로 확인해줍니다.
            </p>

            <button
              type="button"
              onClick={isCheckingSpeech ? stopChecking : () => checkSentence(sentence.text)}
              className={`w-full min-h-[48px] py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isCheckingSpeech
                  ? 'bg-emerald-600 text-white animate-pulse shadow-md shadow-emerald-900/40'
                  : 'bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>
                {isCheckingSpeech ? 'Listening... 말하는 중...' : 'Check My Words / 발음 단어 체크'}
              </span>
            </button>

            {speechError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {speechError}
              </p>
            )}

            {speechResult && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    You said {speechResult.matchedWords} of {speechResult.totalWords} words.
                  </span>
                  <span className="text-teal-400">Great effort! 멋진 도전이에요! 🎉</span>
                </div>

                {/* Colored word display: matched words green, missed words gray with underline */}
                <div className="flex flex-wrap gap-1.5 pt-1 text-base font-semibold leading-relaxed">
                  {speechResult.details.map((detail, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 rounded ${
                        detail.matched
                          ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                          : 'text-slate-400 underline decoration-slate-500 decoration-2 underline-offset-4 opacity-75'
                      }`}
                    >
                      {detail.word}
                    </span>
                  ))}
                </div>

                <div className="pt-1 text-[11px] text-slate-500">
                  <span>Recognized: &ldquo;{speechResult.transcript}&rdquo;</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. Next Button */}
      <div className="px-3 pt-2">
        {sentenceIndex < totalSentences - 1 ? (
          <button
            type="button"
            onClick={onNextSentence}
            className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-500 active:scale-[0.98] text-white font-extrabold text-base shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Next Sentence / 다음 문장으로</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onFinishApp}
            className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 active:scale-[0.98] text-white font-extrabold text-base shadow-lg shadow-teal-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Finish Practice / 연습 완료 및 결과 보기</span>
          </button>
        )}
      </div>
    </div>
  );
};
