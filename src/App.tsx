import React, { useState, useRef, useEffect } from 'react';
import {
  Sentence,
  SentenceProgress,
  AppScreen,
} from './types';
import {
  loadStoredSentences,
  saveStoredSentences,
  loadStoredProgress,
  saveStoredProgress,
} from './utils/helpers';
import { YouTubePlayerRef } from './components/YouTubePlayer';
import { StartScreen } from './screens/StartScreen';
import { SentenceListScreen } from './screens/SentenceListScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { EditSentencesScreen } from './screens/EditSentencesScreen';
import { FinishScreen } from './screens/FinishScreen';
import { Film, Sparkles, BookOpen } from 'lucide-react';
import { MOVIE_SETTINGS } from './constants/initialData';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('start');
  const [sentences, setSentences] = useState<Sentence[]>(loadStoredSentences);
  const [progress, setProgress] = useState<Record<number, SentenceProgress>>(loadStoredProgress);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const playerRef = useRef<YouTubePlayerRef | null>(null);

  // Sync state to local storage
  const handleSaveSentences = (newSentences: Sentence[]) => {
    setSentences(newSentences);
    saveStoredSentences(newSentences);
    if (currentIndex >= newSentences.length) {
      setCurrentIndex(Math.max(0, newSentences.length - 1));
    }
  };

  const handleUpdateProgress = (updated: SentenceProgress) => {
    setProgress((prev) => {
      const next = { ...prev, [updated.id]: updated };
      saveStoredProgress(next);
      return next;
    });
  };

  const handleSelectSentence = (idx: number) => {
    setCurrentIndex(idx);
    setScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevSentence = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setScreen('finish');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRestartPractice = () => {
    setCurrentIndex(0);
    setScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeSentence = sentences[currentIndex] || sentences[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start antialiased selection:bg-teal-500/30 selection:text-teal-200">
      {/* Mobile-First Portrait Frame: max-width 480px, centered on larger screens */}
      <main className="w-full max-w-[480px] min-h-screen bg-slate-950 flex flex-col shadow-2xl relative border-x border-slate-900">
        {/* App Top Brand Header Bar */}
        <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between">
          <div
            onClick={() => setScreen('start')}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-orange-500 flex items-center justify-center shadow-md shadow-teal-900/40 text-base font-bold">
              🐰
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-white group-hover:text-teal-300 transition-colors">
                Scene Shadow
              </span>
              <span className="ml-1.5 text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/20">
                Zootopia 2
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {screen !== 'start' && (
              <button
                type="button"
                onClick={() => setScreen('start')}
                className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Home
              </button>
            )}
            {screen !== 'list' && (
              <button
                type="button"
                onClick={() => setScreen('list')}
                className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                List
              </button>
            )}
            {screen !== 'edit' && (
              <button
                type="button"
                onClick={() => setScreen('edit')}
                className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </header>

        {/* Screen Routing */}
        <div className="flex-1 w-full flex flex-col">
          {screen === 'start' && (
            <StartScreen
              sentenceCount={sentences.length}
              onStartPractice={() => {
                if (sentences.length === 0) {
                  setScreen('edit');
                } else {
                  setCurrentIndex(0);
                  setScreen('practice');
                }
              }}
              onOpenList={() => setScreen('list')}
              onOpenEdit={() => setScreen('edit')}
            />
          )}

          {screen === 'list' && (
            <SentenceListScreen
              sentences={sentences}
              progress={progress}
              onSelectSentence={handleSelectSentence}
              onBackToStart={() => setScreen('start')}
              onOpenEdit={() => setScreen('edit')}
              playerRef={playerRef}
            />
          )}

          {screen === 'practice' && (
            activeSentence ? (
              <PracticeScreen
                sentence={activeSentence}
                sentences={sentences}
                sentenceIndex={currentIndex}
                totalSentences={sentences.length}
                progress={progress}
                onUpdateProgress={handleUpdateProgress}
                onPrevSentence={handlePrevSentence}
                onNextSentence={handleNextSentence}
                onJumpToSentenceIndex={(idx) => setCurrentIndex(idx)}
                onOpenList={() => setScreen('list')}
                onFinishApp={() => setScreen('finish')}
                playerRef={playerRef}
              />
            ) : (
              <div className="p-8 text-center text-slate-400">
                <p>No sentences found.</p>
                <button
                  type="button"
                  onClick={() => setScreen('edit')}
                  className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm"
                >
                  Edit Sentences
                </button>
              </div>
            )
          )}

          {screen === 'edit' && (
            <EditSentencesScreen
              sentences={sentences}
              onSaveSentences={handleSaveSentences}
              onBack={() => setScreen('list')}
              playerRef={playerRef}
            />
          )}

          {screen === 'finish' && (
            <FinishScreen
              sentences={sentences}
              progress={progress}
              onPracticeSentence={handleSelectSentence}
              onRestartPractice={handleRestartPractice}
              onOpenList={() => setScreen('list')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
