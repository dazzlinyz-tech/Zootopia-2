import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Repeat,
  Copy,
  Upload,
  RotateCcw,
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Sentence } from '../types';
import { YouTubePlayer, YouTubePlayerRef } from '../components/YouTubePlayer';
import { MOVIE_SETTINGS, DEFAULT_SENTENCES } from '../constants/initialData';
import { getSpeakerTheme, roundToMillis, formatTimeMMSS } from '../utils/helpers';

interface EditSentencesScreenProps {
  sentences: Sentence[];
  onSaveSentences: (newSentences: Sentence[]) => void;
  onBack: () => void;
  playerRef: React.RefObject<YouTubePlayerRef | null>;
}

/**
 * Clean numeric input for 3-decimal second values without fighting cursor during typing.
 */
const PreciseSecondInput: React.FC<{
  value: number;
  onCommit: (val: number) => void;
  borderClass?: string;
  ariaLabel: string;
}> = ({ value, onCommit, borderClass = 'border-slate-800', ariaLabel }) => {
  const [draft, setDraft] = useState<string>(value.toFixed(3));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(roundToMillis(value).toFixed(3));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      onCommit(roundToMillis(parsed));
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(
        MOVIE_SETTINGS.practiceRangeStart,
        Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(parsed))
      );
      onCommit(clamped);
      setDraft(clamped.toFixed(3));
    } else {
      setDraft(roundToMillis(value).toFixed(3));
    }
  };

  return (
    <input
      type="number"
      step="0.001"
      min={MOVIE_SETTINGS.practiceRangeStart}
      max={MOVIE_SETTINGS.practiceRangeEnd}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full bg-slate-950 border ${borderClass} rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-400`}
    />
  );
};

export const EditSentencesScreen: React.FC<EditSentencesScreenProps> = ({
  sentences,
  onSaveSentences,
  onBack,
  playerRef,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form fields (3-decimal millisecond precision)
  const [speaker, setSpeaker] = useState('Judy');
  const [text, setText] = useState('');
  const [korean, setKorean] = useState('');
  const [stressInput, setStressInput] = useState('');
  const [startTime, setStartTime] = useState<number>(45.0);
  const [endTime, setEndTime] = useState<number>(48.0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [copiedJson, setCopiedJson] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Live YouTube playback time & test playback state
  const [videoCurrentTime, setVideoCurrentTime] = useState(45.0);
  const [testingSentenceId, setTestingSentenceId] = useState<number | 'form' | null>(null);
  const [isLoopTest, setIsLoopTest] = useState(false);

  const latestLoopRef = useRef({
    testingSentenceId,
    isLoopTest,
    startTime,
    endTime,
    sentences,
  });
  latestLoopRef.current = {
    testingSentenceId,
    isLoopTest,
    startTime,
    endTime,
    sentences,
  };

  const loopTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  const flashSaved = (msg = '저장됨') => {
    setSaveNotice(msg);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = window.setTimeout(() => {
      setSaveNotice(null);
    }, 1800);
  };

  const readLivePlayerTime = (): number => {
    const raw = playerRef.current?.getCurrentTime() ?? videoCurrentTime;
    const precise = roundToMillis(raw);
    setVideoCurrentTime(precise);
    return Math.max(
      MOVIE_SETTINGS.practiceRangeStart,
      Math.min(MOVIE_SETTINGS.practiceRangeEnd, precise)
    );
  };

  // --- Card-level direct timing actions (immediate save, no cross-sentence interference) ---

  const updateSentenceTiming = (
    sentenceId: number,
    patch: { start?: number; end?: number },
    noticeText: string
  ) => {
    const updated = sentences.map((item) => {
      if (item.id !== sentenceId) return item;
      const nextStart =
        patch.start !== undefined
          ? Math.max(
              MOVIE_SETTINGS.practiceRangeStart,
              Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(patch.start))
            )
          : item.start;
      const nextEnd =
        patch.end !== undefined
          ? Math.max(
              MOVIE_SETTINGS.practiceRangeStart,
              Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(patch.end))
            )
          : item.end;

      if (editingId === sentenceId) {
        setStartTime(nextStart);
        setEndTime(nextEnd);
      }

      return {
        ...item,
        start: nextStart,
        end: nextEnd,
      };
    });

    onSaveSentences(updated);
    flashSaved(noticeText);
  };

  const handleCardSetStart = (sentenceId: number) => {
    const t = readLivePlayerTime();
    updateSentenceTiming(sentenceId, { start: t }, `Start → ${t.toFixed(3)}s 저장됨`);
  };

  const handleCardSetEnd = (sentenceId: number) => {
    const t = readLivePlayerTime();
    updateSentenceTiming(sentenceId, { end: t }, `End → ${t.toFixed(3)}s 저장됨`);
  };

  const handleCardNudge = (sentenceId: number, field: 'start' | 'end', delta: number) => {
    const target = sentences.find((s) => s.id === sentenceId);
    if (!target) return;
    const nextVal = Math.max(
      MOVIE_SETTINGS.practiceRangeStart,
      Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(target[field] + delta))
    );
    updateSentenceTiming(
      sentenceId,
      field === 'start' ? { start: nextVal } : { end: nextVal },
      `${field === 'start' ? 'Start' : 'End'} → ${nextVal.toFixed(3)}s 저장됨`
    );
  };

  // --- Form-level timing actions ---

  const commitFormTimingIfEditing = (nextStart: number, nextEnd: number) => {
    if (editingId === null) return;
    updateSentenceTiming(editingId, { start: nextStart, end: nextEnd }, '즉시 저장됨');
  };

  const handleFormSetStart = () => {
    const t = readLivePlayerTime();
    setStartTime(t);
    setValidationError(null);
    commitFormTimingIfEditing(t, endTime);
  };

  const handleFormSetEnd = () => {
    const t = readLivePlayerTime();
    setEndTime(t);
    setValidationError(null);
    commitFormTimingIfEditing(startTime, t);
  };

  const handleFormNudge = (field: 'start' | 'end', delta: number) => {
    if (field === 'start') {
      const next = Math.max(
        MOVIE_SETTINGS.practiceRangeStart,
        Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(startTime + delta))
      );
      setStartTime(next);
      setValidationError(null);
      commitFormTimingIfEditing(next, endTime);
    } else {
      const next = Math.max(
        MOVIE_SETTINGS.practiceRangeStart,
        Math.min(MOVIE_SETTINGS.practiceRangeEnd, roundToMillis(endTime + delta))
      );
      setEndTime(next);
      setValidationError(null);
      commitFormTimingIfEditing(startTime, next);
    }
  };

  // --- Test playback (plays strictly [start, end]) ---

  const handleTestRange = (targetId: number | 'form', start: number, end: number) => {
    if (!playerRef.current) return;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (testingSentenceId === targetId) {
      setTestingSentenceId(null);
      setIsLoopTest(false);
      playerRef.current.pause();
      return;
    }

    if (end <= start) {
      setValidationError('종료 시간은 시작 시간보다 커야 테스트 재생이 가능합니다.');
      return;
    }

    setValidationError(null);
    setTestingSentenceId(targetId);
    playerRef.current.playSegment(start, end);
  };

  const handleSegmentEnd = () => {
    const {
      testingSentenceId: activeId,
      isLoopTest: loopOn,
      startTime: formStart,
      endTime: formEnd,
      sentences: list,
    } = latestLoopRef.current;

    if (loopOn && activeId !== null) {
      let s = formStart;
      let e = formEnd;
      if (activeId !== 'form') {
        const found = list.find((item) => item.id === activeId);
        if (found) {
          s = found.start;
          e = found.end;
        }
      }
      if (e > s && playerRef.current) {
        loopTimeoutRef.current = window.setTimeout(() => {
          if (latestLoopRef.current.isLoopTest && latestLoopRef.current.testingSentenceId === activeId) {
            playerRef.current?.playSegment(s, e);
          }
        }, 450);
        return;
      }
    }

    setTestingSentenceId(null);
  };

  // --- Edit / Add / Delete / Reorder ---

  const handleStartEdit = (sentence: Sentence) => {
    setEditingId(sentence.id);
    setSpeaker(sentence.speaker);
    setText(sentence.text);
    setKorean(sentence.korean);
    setStressInput(sentence.stress.join(', '));
    setStartTime(roundToMillis(sentence.start));
    setEndTime(roundToMillis(sentence.end));
    setValidationError(null);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSpeaker('Judy');
    setText('');
    setKorean('');
    setStressInput('');
    setStartTime(45.0);
    setEndTime(48.0);
    setValidationError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedText = text.trim();
    if (!trimmedText) {
      setValidationError('Please enter the English sentence / 영어 문장을 입력하세요.');
      return;
    }

    const rStart = roundToMillis(startTime);
    const rEnd = roundToMillis(endTime);

    if (
      rStart < MOVIE_SETTINGS.practiceRangeStart ||
      rStart > MOVIE_SETTINGS.practiceRangeEnd ||
      rEnd < MOVIE_SETTINGS.practiceRangeStart ||
      rEnd > MOVIE_SETTINGS.practiceRangeEnd
    ) {
      setValidationError(
        `Start and End must be between ${MOVIE_SETTINGS.practiceRangeStart}s and ${MOVIE_SETTINGS.practiceRangeEnd}s (00:45 – 02:10).`
      );
      return;
    }

    if (rEnd <= rStart) {
      setValidationError('End time must be greater than Start time / 종료 시간이 시작 시간보다 커야 합니다.');
      return;
    }

    const stressList = stressInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingId !== null) {
      const updated = sentences.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            speaker: speaker.trim() || 'Speaker',
            text: trimmedText,
            korean: korean.trim(),
            stress: stressList,
            start: rStart,
            end: rEnd,
          };
        }
        return item;
      });
      onSaveSentences(updated);
      flashSaved('문장 저장됨');
      handleCancelEdit();
    } else {
      const nextId = sentences.length > 0 ? Math.max(...sentences.map((s) => s.id)) + 1 : 1;
      const newSentence: Sentence = {
        id: nextId,
        speaker: speaker.trim() || 'Speaker',
        text: trimmedText,
        korean: korean.trim(),
        stress: stressList,
        start: rStart,
        end: rEnd,
      };
      onSaveSentences([...sentences, newSentence]);
      flashSaved('새 문장 추가됨');
      handleCancelEdit();
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this sentence? / 이 문장을 삭제하시겠습니까?')) {
      const updated = sentences.filter((s) => s.id !== id);
      onSaveSentences(updated);
      if (editingId === id) handleCancelEdit();
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sentences.length) return;

    const list = [...sentences];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);
    onSaveSentences(list);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(sentences, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    });
  };

  const handleConfirmImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Imported data must be an array of sentences.');
      }
      for (const item of parsed) {
        if (!item.text || typeof item.start !== 'number' || typeof item.end !== 'number') {
          throw new Error('Each sentence requires "text", "start", and "end" fields.');
        }
      }
      const normalized = parsed.map((item: Sentence) => ({
        ...item,
        start: roundToMillis(item.start),
        end: roundToMillis(item.end),
      }));
      onSaveSentences(normalized);
      setImportModalOpen(false);
      setImportJsonText('');
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON syntax.');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset to initial Zootopia 2 sentences? / 기본 문장으로 초기화하시겠습니까?')) {
      onSaveSentences(DEFAULT_SENTENCES);
      handleCancelEdit();
    }
  };

  const duration = roundToMillis(endTime - startTime);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const showDurationWarning = duration > 4;
  const showWordCountWarning = wordCount > 12;

  return (
    <div className="w-full flex flex-col gap-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back / 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            title="Export JSON"
          >
            {copiedJson ? (
              <Check className="w-3.5 h-3.5 text-teal-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedJson ? 'Copied!' : 'Export'}</span>
          </button>

          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            title="Import JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1 py-1.5 px-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Player + Real-time Current Time Bar */}
      <div className="px-3 space-y-2">
        <YouTubePlayer
          ref={playerRef}
          onTimeUpdate={(t) => setVideoCurrentTime(roundToMillis(t))}
          onSegmentEnd={handleSegmentEnd}
        />

        {/* Real-time playback position indicator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-slate-300">현재 재생 시간</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-sm font-black text-teal-300">
              {videoCurrentTime.toFixed(3)}s
            </span>
            <span className="text-[11px] text-slate-400">
              ({formatTimeMMSS(videoCurrentTime)})
            </span>
          </div>
        </div>
      </div>

      {/* Sentence Timing Cards (Direct Set Start / Set End / -0.05 / +0.05 / Numeric Edit / Test) */}
      <div className="px-3 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              문장별 직접 타이밍 설정 ({sentences.length})
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              영상을 일시정지한 뒤 Set Start / Set End를 누르면 즉시 저장됩니다.
            </p>
          </div>
          {saveNotice && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              ✓ {saveNotice}
            </span>
          )}
        </div>

        {sentences.map((item, idx) => {
          const theme = getSpeakerTheme(item.speaker);
          const isTestingThis = testingSentenceId === item.id;
          const isRangeInvalid = item.end <= item.start;
          const prev = idx > 0 ? sentences[idx - 1] : null;
          const gapFromPrev = prev ? roundToMillis(item.start - prev.end) : null;

          return (
            <div key={item.id} className="space-y-1.5">
              {/* Informational boundary badge (never forces changes) */}
              {gapFromPrev !== null && (
                <div className="flex items-center justify-center">
                  {Math.abs(gapFromPrev) < 0.001 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">
                      이전 문장과 연속 연결 (0.000s)
                    </span>
                  ) : gapFromPrev < 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/25 font-mono">
                      구간 겹침 {gapFromPrev.toFixed(3)}s
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                      문장 간격 +{gapFromPrev.toFixed(3)}s
                    </span>
                  )}
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl bg-slate-900 border transition-all space-y-2.5 ${
                  editingId === item.id
                    ? 'border-teal-500 ring-1 ring-teal-500'
                    : 'border-slate-800'
                }`}
              >
                {/* Top Row: # + Speaker + Test + Move/Edit/Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${theme.bg}`}>
                      {item.speaker}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      길이: {roundToMillis(item.end - item.start).toFixed(3)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isRangeInvalid}
                      onClick={() => handleTestRange(item.id, item.start, item.end)}
                      className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                        isTestingThis
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-teal-600 hover:bg-teal-500 text-white'
                      }`}
                      title="설정된 구간 테스트 재생"
                    >
                      {isTestingThis ? (
                        <>
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Test</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sentences.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="p-1 rounded text-teal-400 hover:text-teal-300 hover:bg-slate-800 cursor-pointer"
                      title="Edit text & details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-slate-800 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sentence text & meaning */}
                <div>
                  <p className="text-sm font-semibold text-slate-100 leading-relaxed">{item.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.korean}</p>
                </div>

                {isRangeInvalid && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    종료 시간이 시작 시간보다 작거나 같습니다. Set End로 종료 시간을 설정해주세요.
                  </p>
                )}

                {/* Direct Start & End Timing Controls per Card */}
                <div className="bg-slate-950/75 border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                  {/* Start row */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-teal-300 w-10 shrink-0">Start</span>
                    <div className="w-24 shrink-0">
                      <PreciseSecondInput
                        value={item.start}
                        borderClass="border-teal-500/30"
                        ariaLabel={`Sentence ${idx + 1} start time`}
                        onCommit={(val) =>
                          updateSentenceTiming(item.id, { start: val }, `Start → ${val.toFixed(3)}s`)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCardNudge(item.id, 'start', -0.05)}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      -0.05
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCardNudge(item.id, 'start', 0.05)}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      +0.05
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCardSetStart(item.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                    >
                      Set Start
                    </button>
                  </div>

                  {/* End row */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-orange-300 w-10 shrink-0">End</span>
                    <div className="w-24 shrink-0">
                      <PreciseSecondInput
                        value={item.end}
                        borderClass="border-orange-500/30"
                        ariaLabel={`Sentence ${idx + 1} end time`}
                        onCommit={(val) =>
                          updateSentenceTiming(item.id, { end: val }, `End → ${val.toFixed(3)}s`)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCardNudge(item.id, 'end', -0.05)}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      -0.05
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCardNudge(item.id, 'end', 0.05)}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      +0.05
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCardSetEnd(item.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                    >
                      Set End
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Sentence Form */}
      <div className="px-3">
        <form
          onSubmit={handleSubmitForm}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-orange-400" />
              <span>
                {editingId !== null ? `Edit Sentence #${editingId}` : 'Add Sentence / 문장 추가'}
              </span>
            </h3>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Cancel / 취소
              </button>
            )}
          </div>

          {validationError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Speaker & Start/End Inputs (3-decimal precision) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Speaker (캐릭터)</label>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
              >
                <option value="Judy">🐰 Judy</option>
                <option value="Nick">🦊 Nick</option>
                <option value="Antony Snootley">🦨 Antony Snootley</option>
                <option value="Other">🎭 Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-teal-300 mb-1">Start (초)</label>
              <PreciseSecondInput
                value={startTime}
                borderClass="border-teal-500/30"
                ariaLabel="Form start time"
                onCommit={(val) => {
                  setStartTime(val);
                  commitFormTimingIfEditing(val, endTime);
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] text-orange-300 mb-1">End (초)</label>
              <PreciseSecondInput
                value={endTime}
                borderClass="border-orange-500/30"
                ariaLabel="Form end time"
                onCommit={(val) => {
                  setEndTime(val);
                  commitFormTimingIfEditing(startTime, val);
                }}
              />
            </div>
          </div>

          {/* Form Set Start / Set End + -0.05 / +0.05 + Test & Loop Test */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold text-teal-300 w-10">Start</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => handleFormNudge('start', -0.05)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                >
                  -0.05s
                </button>
                <button
                  type="button"
                  onClick={() => handleFormNudge('start', 0.05)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                >
                  +0.05s
                </button>
                <button
                  type="button"
                  onClick={handleFormSetStart}
                  className="py-1.5 px-3 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 text-[11px] font-bold cursor-pointer"
                >
                  Set Start
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold text-orange-300 w-10">End</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => handleFormNudge('end', -0.05)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                >
                  -0.05s
                </button>
                <button
                  type="button"
                  onClick={() => handleFormNudge('end', 0.05)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold cursor-pointer"
                >
                  +0.05s
                </button>
                <button
                  type="button"
                  onClick={handleFormSetEnd}
                  className="py-1.5 px-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 text-[11px] font-bold cursor-pointer"
                >
                  Set End
                </button>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestRange('form', startTime, endTime)}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  testingSentenceId === 'form'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                }`}
              >
                {testingSentenceId === 'form' ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Stop / 정지</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-teal-400" />
                    <span>Test ({duration.toFixed(3)}s) / 테스트</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isLoopTest;
                  setIsLoopTest(next);
                  if (next && testingSentenceId === null) {
                    handleTestRange('form', startTime, endTime);
                  } else if (!next && loopTimeoutRef.current) {
                    clearTimeout(loopTimeoutRef.current);
                    loopTimeoutRef.current = null;
                  }
                }}
                className={`py-2 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 border cursor-pointer ${
                  isLoopTest
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Loop {isLoopTest ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* English Text */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              English Sentence (영어 문장)
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Are you sure this will work?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Korean Meaning */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Korean Meaning (한국어 뜻)
            </label>
            <input
              type="text"
              value={korean}
              onChange={(e) => setKorean(e.target.value)}
              placeholder="e.g. 이 일이 잘 될 거라고 확신해?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Stress Words */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Stress Words / 강조 단어{' '}
              <span className="text-slate-500">(comma-separated: work, needed)</span>
            </label>
            <input
              type="text"
              value={stressInput}
              onChange={(e) => setStressInput(e.target.value)}
              placeholder="e.g. needed, bust"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {(showDurationWarning || showWordCountWarning) && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 space-y-0.5">
              <p className="font-semibold flex items-center gap-1 text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Shadowing Tip / 쉐도잉 팁:</span>
              </p>
              {showDurationWarning && (
                <p className="text-[11px] text-amber-200/90">
                  Current duration is {duration.toFixed(3)}s. Short sentences under 4s are best for learners.
                </p>
              )}
              {showWordCountWarning && (
                <p className="text-[11px] text-amber-200/90">
                  Sentence has {wordCount} words. Under 12 words makes synchronized shadowing much easier!
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {editingId !== null ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>
              {editingId !== null ? 'Save Changes / 변경사항 저장' : 'Add Sentence / 문장 추가하기'}
            </span>
          </button>
        </form>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-teal-400" />
              <span>Import Sentences (JSON)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Paste the JSON array of sentences below to replace the practice list.
            </p>

            {importError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {importError}
              </p>
            )}

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='[ { "id": 1, "speaker": "Judy", "text": "Are you sure this will work?", "korean": "...", "stress": ["work"], "start": 51.0, "end": 52.0 } ]'
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md"
              >
                Apply Import / 적용하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
