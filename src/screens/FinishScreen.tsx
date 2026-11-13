import React from 'react';
import { Sparkles, Trophy, RotateCcw, List, ArrowRight, CheckCircle2, Heart } from 'lucide-react';
import { Sentence, SentenceProgress } from '../types';
import { ONE_LINE_CREDIT } from '../constants/initialData';
import { getSpeakerTheme } from '../utils/helpers';

interface FinishScreenProps {
  sentences: Sentence[];
  progress: Record<number, SentenceProgress>;
  onPracticeSentence: (index: number) => void;
  onRestartPractice: () => void;
  onOpenList: () => void;
}

export const FinishScreen: React.FC<FinishScreenProps> = ({
  sentences,
  progress,
  onPracticeSentence,
  onRestartPractice,
  onOpenList,
}) => {
  const completedSentences = sentences.filter((s) => progress[s.id]?.status === 'done');
  const practicedSentences = sentences.filter((s) => progress[s.id]?.status === 'practiced');

  const totalRecordings = Object.values(progress).reduce(
    (acc, curr) => acc + (curr.recordings || 0),
    0
  );

  // Sentences where user marked 😐 (needs_practice) in any of the 3 self-check criteria
  const needsPracticeList = sentences
    .map((sentence, idx) => ({ sentence, idx, prog: progress[sentence.id] }))
    .filter(({ prog }) => prog && prog.selfCheck && prog.selfCheck.includes('needs_practice'));

  return (
    <div className="w-full flex flex-col gap-6 py-6 px-4 pb-16">
      {/* Celebration Header */}
      <div className="text-center bg-gradient-to-br from-slate-900 via-teal-950/70 to-slate-900 border border-teal-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg shadow-orange-900/40 mb-3 animate-bounce">
          🏆
        </div>

        <h1 className="text-3xl font-black text-white tracking-tight">
          Great Job!
        </h1>
        <p className="text-base font-bold text-teal-300 mt-1">
          수고하셨습니다! 멋지게 쉐도잉을 마쳤어요.
        </p>
        <p className="text-xs text-slate-300 mt-2 max-w-xs mx-auto leading-relaxed">
          배우들의 대사를 직접 소리 내어 따라하면서 영어 리듬과 자신감이 쑥 자라났습니다!
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <div className="text-2xl font-black text-teal-400">
              {completedSentences.length}
              <span className="text-xs font-normal text-slate-400">/{sentences.length}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Completed (완료)</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <div className="text-2xl font-black text-orange-400">{totalRecordings}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Total Recordings (녹음)</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <div className="text-2xl font-black text-emerald-400">
              {practicedSentences.length + completedSentences.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Practiced (연습)</div>
          </div>
        </div>
      </div>

      {/* Review List of sentences marked 😐 */}
      {needsPracticeList.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span className="text-base">😐</span>
              <span>Needs Practice / 다시 연습해볼 문장들</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {needsPracticeList.length} sentence(s)
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            자기 점검에서 😐를 선택했던 문장들입니다. 한 번 더 연습해보면 완벽해져요!
          </p>

          <div className="space-y-2 pt-1">
            {needsPracticeList.map(({ sentence, idx }) => {
              const theme = getSpeakerTheme(sentence.speaker);
              return (
                <div
                  key={sentence.id}
                  className="p-3 bg-slate-950/70 rounded-xl border border-slate-850 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="text-xs pr-1 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${theme.bg}`}>
                        {sentence.speaker}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-200 line-clamp-1">{sentence.text}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{sentence.korean}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPracticeSentence(idx)}
                    className="py-2 px-3 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <span>Practice again</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-sm space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-white">No challenging sentences remaining!</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
            모든 문장을 자신감 있게 소화했습니다! 꾸준히 반복할수록 실력이 깊어집니다.
          </p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onRestartPractice}
          className="w-full min-h-[50px] py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 active:scale-[0.98] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Practice from Beginning / 처음부터 다시 연습</span>
        </button>

        <button
          type="button"
          onClick={onOpenList}
          className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <List className="w-4 h-4 text-teal-400" />
          <span>Sentence List / 문장 목록으로 가기</span>
        </button>
      </div>

      {/* Required One-line Credit at the Bottom of Finish Screen (PRD Section 0-3 Item 3) */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
        <p className="text-[13px] leading-snug text-slate-400 font-normal">
          {ONE_LINE_CREDIT}
        </p>
      </div>
    </div>
  );
};
