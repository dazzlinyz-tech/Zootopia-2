import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import {
  MOVIE_SETTINGS,
  EDUCATIONAL_NOTICE_EN,
  EDUCATIONAL_NOTICE_KO,
} from '../constants/initialData';

interface EducationalNoticeCardProps {
  initiallyExpanded?: boolean;
}

export const EducationalNoticeCard: React.FC<EducationalNoticeCardProps> = ({
  initiallyExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-slate-300 shadow-sm backdrop-blur-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <span>Educational Use & Source</span>
              <span className="text-xs font-normal text-slate-400">/ 교육용 고지 및 출처</span>
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          aria-label={expanded ? 'Collapse notice' : 'Expand notice'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 space-y-3 pt-3 border-t border-slate-800 text-xs">
          {/* Official Educational Notice */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-teal-400 font-semibold text-[11px] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Educational Use Only / 교육 목적 전용</span>
            </div>
            <p className="leading-relaxed text-slate-300">{EDUCATIONAL_NOTICE_EN}</p>
            <p className="leading-relaxed text-slate-400">{EDUCATIONAL_NOTICE_KO}</p>
          </div>

          {/* Source Metadata Table */}
          <div className="grid grid-cols-1 gap-1.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 text-[11px]">
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Movie Title / 영화 제목:</span>
              <span className="font-semibold text-slate-200 text-right">
                {MOVIE_SETTINGS.movieTitleEn} ({MOVIE_SETTINGS.movieTitleKo})
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Release Year / 개봉연도:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.releaseYear}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Director / 감독:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.director}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Screenplay / 각본:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.screenplay}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Production / 제작사:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.productionCompany}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Distribution / 배급사:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.distributionCompany}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Scene / 장면 설명:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.sceneDescription}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">YouTube Video Title:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.youtubeTitle}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">YouTube Channel:</span>
              <span className="font-medium text-slate-200 text-right">{MOVIE_SETTINGS.youtubeChannel}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Practice Range / 연습 구간:</span>
              <span className="font-semibold text-teal-400 text-right">00:45 – 02:10 (45s – 130s)</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-850">
              <span className="text-slate-400">Made by / 제작자:</span>
              <span className="font-semibold text-orange-400 text-right">
                {MOVIE_SETTINGS.authorName} ({MOVIE_SETTINGS.studentId})
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Course / 강좌:</span>
              <span className="font-medium text-slate-300 text-right">
                {MOVIE_SETTINGS.university} {MOVIE_SETTINGS.courseName}
              </span>
            </div>
          </div>

          {/* YouTube Link */}
          <div className="pt-1 flex items-center justify-end">
            <a
              href={MOVIE_SETTINGS.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 underline font-medium transition-colors"
            >
              <span>Watch on YouTube ({MOVIE_SETTINGS.youtubeChannel})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
