import React from 'react';
import { Play, List, Edit3, Sparkles, Volume2, Mic, Headphones } from 'lucide-react';
import { EducationalNoticeCard } from '../components/EducationalNoticeCard';
import { MOVIE_SETTINGS } from '../constants/initialData';

interface StartScreenProps {
  onStartPractice: () => void;
  onOpenList: () => void;
  onOpenEdit: () => void;
  sentenceCount: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStartPractice,
  onOpenList,
  onOpenEdit,
  sentenceCount,
}) => {
  return (
    <div className="w-full flex flex-col gap-6 py-4 px-4 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950/60 to-slate-900 border border-teal-500/20 p-6 text-center shadow-xl">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Character badges */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
            🐰 Judy Hopps
          </span>
          <span className="text-slate-500 text-xs">✕</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
            🦊 Nick Wilde
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Scene Shadow
          <span className="block text-2xl font-black bg-gradient-to-r from-teal-400 via-emerald-300 to-orange-400 bg-clip-text text-transparent mt-0.5">
            Zootopia 2 (2025)
          </span>
        </h1>

        <p className="text-base font-medium text-slate-200 mt-2">
          &ldquo;Listen. Copy. Speak at the same time.&rdquo;
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          듣고, 따라하고, 배우와 동시에 말해보세요!
        </p>

        {/* Scene info pill */}
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>잠입수사 장면 · {sentenceCount}개 핵심 문장 연습</span>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onStartPractice}
          className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 active:scale-[0.98] text-white font-extrabold text-lg shadow-lg shadow-teal-900/40 flex items-center justify-center gap-3 transition-all cursor-pointer border border-teal-400/30"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
          <div className="text-left">
            <div className="leading-tight text-lg">Start Practice</div>
            <div className="text-xs font-normal text-teal-100/90 leading-tight">연습 시작하기</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenList}
          className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-slate-800/90 hover:bg-slate-750 active:scale-[0.98] text-slate-200 font-bold text-sm border border-slate-700/80 shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
        >
          <List className="w-4 h-4 text-teal-400" />
          <span>Sentence List / 전체 문장 목록 보기</span>
        </button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-orange-300 transition-colors py-1 px-3 rounded-lg hover:bg-slate-800/50"
          >
            <Edit3 className="w-3.5 h-3.5 text-orange-400" />
            <span>Edit Sentences / 문장 편집</span>
          </button>
        </div>
      </div>

      {/* What is Shadowing? Card */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white">
            What is shadowing? <span className="text-xs font-normal text-slate-400">/ 쉐도잉이란?</span>
          </h2>
        </div>

        <div className="space-y-3 pt-1 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              1
            </div>
            <div>
              <p className="font-semibold text-slate-200">Listen & Absorb / 귀로 먼저 듣기</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                영화 속 원어민 배우의 생생한 목소리와 억양을 집중해서 듣습니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              2
            </div>
            <div>
              <p className="font-semibold text-slate-200">Shadow Simultaneously / 그림자처럼 따라하기</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                배우의 대사를 들으며 거의 동시에 반 박자 뒤에서 소리 내어 말합니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              3
            </div>
            <div>
              <p className="font-semibold text-slate-200">Master Rhythm & Stress / 리듬과 강세 체화</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                핵심 강세 단어와 자연스러운 억양을 복사하듯 몸에 익혀 말하기 자신감을 키웁니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Use Notice Card (Section 0-3 item 1) */}
      <EducationalNoticeCard initiallyExpanded={true} />
    </div>
  );
};
