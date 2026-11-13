export interface Sentence {
  id: number;
  speaker: string;
  text: string;
  korean: string;
  stress: string[];
  start: number;
  end: number;
}

export type SelfCheckScore = 'great' | 'good' | 'needs_practice' | null;

export interface SentenceProgress {
  id: number;
  plays: number;
  recordings: number;
  selfCheck: [SelfCheckScore, SelfCheckScore, SelfCheckScore];
  status: 'new' | 'practiced' | 'done';
}

export type AppScreen = 'start' | 'list' | 'practice' | 'edit' | 'finish';

export type StepNumber = 1 | 2 | 3 | 4;

export interface SpeechWordMatch {
  word: string;
  cleanWord: string;
  matched: boolean;
}

export interface SpeechCheckResult {
  totalWords: number;
  matchedWords: number;
  transcript: string;
  details: SpeechWordMatch[];
}
