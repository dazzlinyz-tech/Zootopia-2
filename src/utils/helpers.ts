import { Sentence, SentenceProgress, SpeechCheckResult } from '../types';
import { DEFAULT_SENTENCES } from '../constants/initialData';

const SENTENCES_STORAGE_KEY = 'scene_shadow_zootopia2_sentences_v2';
const PROGRESS_STORAGE_KEY = 'scene_shadow_zootopia2_progress';

export function roundToMillis(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.round(seconds * 1000) / 1000;
}

export function roundToCentisecond(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.round(seconds * 100) / 100;
}

export function loadStoredSentences(): Sentence[] {
  try {
    // Check v2 first, fallback to v1 migration
    const raw =
      localStorage.getItem(SENTENCES_STORAGE_KEY) ||
      localStorage.getItem('scene_shadow_zootopia2_sentences');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Compatible with integer, 1-decimal, 2-decimal, and 3-decimal values
        return parsed.map((s) => {
          const start = roundToMillis(Number(s.start) || 0);
          let end = roundToMillis(Number(s.end) || 0);
          if (s.id === 1 && s.text === 'Are you sure this will work?' && end === 53.0) {
            end = 52.0;
          }
          return {
            ...s,
            start,
            end,
          };
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load sentences from localStorage, using defaults', e);
  }
  return DEFAULT_SENTENCES;
}

export function saveStoredSentences(sentences: Sentence[]): void {
  try {
    const normalized = sentences.map((s) => ({
      ...s,
      start: roundToMillis(s.start),
      end: roundToMillis(s.end),
    }));
    localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Failed to save sentences to localStorage', e);
  }
}

export function loadStoredProgress(): Record<number, SentenceProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load progress from localStorage', e);
  }
  return {};
}

export function saveStoredProgress(progress: Record<number, SentenceProgress>): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save progress to localStorage', e);
  }
}

export function formatTimeMMSS(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const rounded = roundToMillis(totalSeconds);
  const mins = Math.floor(rounded / 60);
  const secs = Math.floor(rounded % 60);
  const millis = Math.round((rounded - Math.floor(rounded)) * 1000);
  if (millis === 0) {
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  const fracStr = String(millis).padStart(3, '0').replace(/0+$/, '');
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${fracStr}`;
}

export function formatSecondsPrecise(seconds: number, fixedDecimals = 3): string {
  if (!Number.isFinite(seconds)) return '0.000s';
  return `${roundToMillis(seconds).toFixed(fixedDecimals)}s`;
}

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return roundToMillis(mins * 60 + secs);
  }
  return roundToMillis(parseFloat(timeStr) || 0);
}

export function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9']/g, '');
}

export function compareSentenceWords(targetText: string, recognizedText: string): SpeechCheckResult {
  const targetTokens = targetText.trim().split(/\s+/);
  const recognizedWords = recognizedText
    .trim()
    .split(/\s+/)
    .map(cleanWord)
    .filter(Boolean);

  const matchedIndices = new Set<number>();
  let lastFoundIndex = -1;

  // Order-aware fuzzy alignment
  const details = targetTokens.map((rawToken, idx) => {
    const cleaned = cleanWord(rawToken);
    let matched = false;

    // Search forward from lastFoundIndex first
    for (let i = lastFoundIndex + 1; i < recognizedWords.length; i++) {
      if (recognizedWords[i] === cleaned) {
        matched = true;
        lastFoundIndex = i;
        matchedIndices.add(idx);
        break;
      }
    }

    // Fallback: search anywhere if not found forward
    if (!matched) {
      for (let i = 0; i < recognizedWords.length; i++) {
        if (recognizedWords[i] === cleaned) {
          matched = true;
          matchedIndices.add(idx);
          break;
        }
      }
    }

    return {
      word: rawToken,
      cleanWord: cleaned,
      matched,
    };
  });

  const matchedWords = details.filter((d) => d.matched).length;

  return {
    totalWords: targetTokens.length,
    matchedWords,
    transcript: recognizedText,
    details,
  };
}

export function getSpeakerTheme(speaker: string) {
  const s = speaker.toLowerCase().trim();
  if (s.includes('judy')) {
    return {
      bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
      badge: 'bg-teal-600 text-white',
      accent: 'border-teal-500 text-teal-600',
      icon: '🐰',
      name: 'Judy Hopps',
    };
  }
  if (s.includes('nick')) {
    return {
      bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
      badge: 'bg-orange-600 text-white',
      accent: 'border-orange-500 text-orange-600',
      icon: '🦊',
      name: 'Nick Wilde',
    };
  }
  if (s.includes('antony') || s.includes('snootley')) {
    return {
      bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
      badge: 'bg-purple-600 text-white',
      accent: 'border-purple-500 text-purple-600',
      icon: '🦨',
      name: 'Antony Snootley',
    };
  }
  return {
    bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    badge: 'bg-slate-600 text-white',
    accent: 'border-slate-500 text-slate-600',
    icon: '🎭',
    name: speaker,
  };
}
