import React, { useState } from 'react';
import { ArrowLeft, Play, Edit3, Eye, EyeOff, CheckCircle2, Circle, Clock, Check } from 'lucide-react';
import { Sentence, SentenceProgress } from '../types';
import { YouTubePlayer, YouTubePlayerRef } from '../components/YouTubePlayer';
import { getSpeakerTheme, formatTimeMMSS } from '../utils/helpers';

interface SentenceListScreenProps {
  sentences: Sentence[];
  progress: Record<number, SentenceProgress>;
  onSelectSentence: (index: number) => void;
  onBackToStart: () => void;
  onOpenEdit: () => void;
  playerRef: React.RefObject<YouTubePlayerRef | null>;
}

export const SentenceListScreen: React.FC<SentenceListScreenProps> = ({
  sentences,
  progress,
  onSelectSentence,
  onBackToStart,
  onOpenEdit,
  playerRef,
}) => {
  const [hideAllText, setHideAllText] = useState(false);

  const completedCount = sentences.filter((s) => progress[s.id]?.status === 'done').length;
  const practicedCount = sentences.filter(
    (s) => progress[s.id]?.status === 'practiced' || progress[s.id]?.status === 'done'
  ).length;

  return (
    <div className="w-full flex flex-col gap-4 pb-12">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={onBackToStart}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home / 홈</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideAllText(!hideAllText)}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            {hideAllText ? <Eye className="w-3.5 h-3.5 text-teal-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>{hideAllText ? 'Show All / 전체 보기' : 'Hide All / 전체 숨기기'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex items-center gap-1 py-1.5 px-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 text-xs font-medium transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit / 편집</span>
          </button>
        </div>
      </div>

      {/* Video Player at the Top */}
      <div className="px-3">
        <YouTubePlayer ref={playerRef} />
      </div>

      {/* Overview Status Bar */}
      <div className="px-4 flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl mx-3 p-3.5 shadow-xs">
        <div>
          <div className="text-xs text-slate-400 font-medium">Practice Progress / 연습 진행률</div>
          <div className="text-base font-extrabold text-white mt-0.5">
            {completedCount} <span className="text-xs font-normal text-slate-400">/ {sentences.length} Done (완료)</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <span>☆</span> {sentences.length - practicedCount} New
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <span>◐</span> {practicedCount - completedCount} In Progress
          </span>
          <span className="flex items-center gap-1 text-teal-400 font-bold">
            <span>★</span> {completedCount} Done
          </span>
        </div>
      </div>

      {/* Sentence Cards List */}
      <div className="px-3 flex flex-col gap-2.5">
        {sentences.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-900/60 rounded-2xl border border-dashed border-slate-700">
            <p className="text-slate-300 font-medium mb-2">No sentences yet. Tap Edit Sentences to add some.</p>
            <p className="text-xs text-slate-400 mb-4">등록된 문장이 없습니다. 문장 편집 메뉴에서 추가해주세요.</p>
            <button
              type="button"
              onClick={onOpenEdit}
              className="py-2.5 px-5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
            >
              Add Sentence / 문장 추가하기
            </button>
          </div>
        ) : (
          sentences.map((sentence, idx) => {
            const prog = progress[sentence.id];
            const theme = getSpeakerTheme(sentence.speaker);
            const status = prog?.status || 'new';

            // Status symbol according to PRD:
            // ☆ not started, ◐ practiced, ★ done
            let statusBadge = (
              <span className="text-slate-500 font-normal text-sm" title="Not started">
                ☆
              </span>
            );
            if (status === 'practiced') {
              statusBadge = (
                <span className="text-amber-400 font-bold text-sm" title="Practiced">
                  ◐
                </span>
              );
            } else if (status === 'done') {
              statusBadge = (
                <span className="text-teal-400 font-black text-sm" title="Done">
                  ★
                </span>
              );
            }

            return (
              <div
                key={sentence.id}
                onClick={() => onSelectSentence(idx)}
                className="group relative bg-slate-900/90 hover:bg-slate-850 active:scale-[0.99] border border-slate-800 hover:border-teal-500/40 rounded-2xl p-4 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                      #{idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${theme.bg}`}
                    >
                      <span>{theme.icon}</span>
                      <span>{sentence.speaker}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatTimeMMSS(sentence.start)} – {formatTimeMMSS(sentence.end)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-800">
                    {statusBadge}
                    <span className="text-[11px] capitalize text-slate-300 font-medium">{status}</span>
                  </div>
                </div>

                {/* Sentence English text */}
                <div className="my-2">
                  {hideAllText ? (
                    <div className="py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500 italic">
                      [Text hidden for listening / 문장 숨김]
                    </div>
                  ) : (
                    <p className="text-base font-semibold text-slate-100 group-hover:text-teal-300 transition-colors leading-relaxed">
                      {sentence.text}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 leading-normal">{sentence.korean}</p>
                </div>

                {/* Play action indicator */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px]">
                    {prog?.recordings ? `🎙 ${prog.recordings} recording(s)` : 'No recordings yet'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-teal-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>Practice / 연습하기</span>
                    <Play className="w-3 h-3 fill-teal-400" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
