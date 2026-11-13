import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { MOVIE_SETTINGS } from '../constants/initialData';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface SequenceSegment {
  id: number;
  start: number;
  end: number;
}

export interface YouTubePlayerRef {
  playSegment: (start: number, end: number) => void;
  playSequence: (segments: SequenceSegment[], startIndex: number) => void;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
  isReady: () => boolean;
}

interface YouTubePlayerProps {
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentEnd?: () => void;
  onSequenceSentenceChange?: (index: number) => void;
  onSequenceEnd?: () => void;
  playbackRate?: number;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  (
    {
      onTimeUpdate,
      onSegmentEnd,
      onSequenceSentenceChange,
      onSequenceEnd,
      playbackRate = 1.0,
    },
    ref
  ) => {
    const playerInstanceRef = useRef<any>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [hasEmbedError, setHasEmbedError] = useState(false);

    // Keep latest callbacks in refs to avoid stale closures inside timers/RAF
    const callbacksRef = useRef({
      onTimeUpdate,
      onSegmentEnd,
      onSequenceSentenceChange,
      onSequenceEnd,
    });
    callbacksRef.current = {
      onTimeUpdate,
      onSegmentEnd,
      onSequenceSentenceChange,
      onSequenceEnd,
    };

    const playbackRateRef = useRef(playbackRate);
    playbackRateRef.current = playbackRate;

    // Single-segment playback state
    const segmentRef = useRef<{
      start: number;
      end: number;
      active: boolean;
      seekSettled: boolean;
      issuedAtPerf: number;
    }>({
      start: MOVIE_SETTINGS.practiceRangeStart,
      end: MOVIE_SETTINGS.practiceRangeEnd,
      active: false,
      seekSettled: false,
      issuedAtPerf: 0,
    });

    // Continuous sequence playback state
    const sequenceRef = useRef<{
      segments: SequenceSegment[];
      index: number;
      active: boolean;
      seekSettled: boolean;
      issuedAtPerf: number;
    }>({
      segments: [],
      index: 0,
      active: false,
      seekSettled: false,
      issuedAtPerf: 0,
    });

    // Clock-anchored interpolation state to reduce 100ms YouTube polling overshoot
    const clockAnchorRef = useRef<{
      lastReportedMediaTime: number;
      anchorMediaTime: number;
      anchorPerfNow: number;
      isPlaying: boolean;
    }>({
      lastReportedMediaTime: -1,
      anchorMediaTime: 0,
      anchorPerfNow: 0,
      isPlaying: false,
    });

    const rafIdRef = useRef<number | null>(null);
    const fallbackIntervalRef = useRef<number | null>(null);
    const stopTimeoutRef = useRef<number | null>(null);

    const clearStopTimeout = () => {
      if (stopTimeoutRef.current !== null) {
        window.clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    };

    const stopMonitor = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (fallbackIntervalRef.current !== null) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      clearStopTimeout();
    };

    const finishSingleSegment = () => {
      if (!segmentRef.current.active) return;
      segmentRef.current.active = false;
      clearStopTimeout();
      try {
        playerInstanceRef.current?.pauseVideo();
      } catch {
        // ignore
      }
      callbacksRef.current.onSegmentEnd?.();
    };

    const advanceOrFinishSequence = () => {
      const seq = sequenceRef.current;
      if (!seq.active) return;
      const currentSeg = seq.segments[seq.index];
      const nextIdx = seq.index + 1;
      const nextSeg = seq.segments[nextIdx];

      if (!nextSeg) {
        seq.active = false;
        clearStopTimeout();
        try {
          playerInstanceRef.current?.pauseVideo();
        } catch {
          // ignore
        }
        callbacksRef.current.onSequenceEnd?.();
        return;
      }

      const gap = nextSeg.start - currentSeg.end;
      seq.index = nextIdx;
      clearStopTimeout();

      // Seamless handoff when consecutive turns have no gap, tiny gap (<= 0.30s), or true overlap
      if (gap <= 0.3 && nextSeg.start >= currentSeg.start) {
        callbacksRef.current.onSequenceSentenceChange?.(nextIdx);
      } else {
        // Larger gap: seek cleanly to next sentence's start without lingering on silence
        seq.seekSettled = false;
        seq.issuedAtPerf = performance.now();
        clockAnchorRef.current.lastReportedMediaTime = -1;
        clockAnchorRef.current.anchorMediaTime = nextSeg.start;
        clockAnchorRef.current.anchorPerfNow = performance.now();
        try {
          playerInstanceRef.current?.seekTo(nextSeg.start, true);
        } catch {
          // ignore
        }
        callbacksRef.current.onSequenceSentenceChange?.(nextIdx);
      }
    };

    const tickMonitor = () => {
      const player = playerInstanceRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      let reportedTime = 0;
      let playerState = -1;
      try {
        reportedTime = player.getCurrentTime();
        playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : 1;
      } catch {
        return;
      }

      const nowPerf = performance.now();
      const rate = playbackRateRef.current || 1.0;
      const anchor = clockAnchorRef.current;
      const isPlaying = playerState === 1;
      anchor.isPlaying = isPlaying;

      // Update anchor whenever YouTube's internal clock ticks forward
      if (Math.abs(reportedTime - anchor.lastReportedMediaTime) > 0.001) {
        anchor.lastReportedMediaTime = reportedTime;
        anchor.anchorMediaTime = reportedTime;
        anchor.anchorPerfNow = nowPerf;
      } else if (!isPlaying) {
        anchor.anchorMediaTime = reportedTime;
        anchor.anchorPerfNow = nowPerf;
      }

      // Interpolate sub-frame position while playing to avoid ~100ms YouTube clock step lag
      const elapsedSinceAnchorSec = isPlaying
        ? Math.min(0.25, Math.max(0, (nowPerf - anchor.anchorPerfNow) / 1000) * rate)
        : 0;
      const estimatedTime = reportedTime + elapsedSinceAnchorSec;

      callbacksRef.current.onTimeUpdate?.(estimatedTime);

      // 1. Single-segment precision boundary check
      if (segmentRef.current.active && isPlaying) {
        const seg = segmentRef.current;
        if (!seg.seekSettled) {
          // Wait until reportedTime reflects the seek target before checking end
          const elapsedSinceSeek = nowPerf - seg.issuedAtPerf;
          if (
            (reportedTime >= seg.start - 0.35 && reportedTime < seg.end + 0.05) ||
            elapsedSinceSeek > 450
          ) {
            seg.seekSettled = true;
          }
        }

        if (seg.seekSettled) {
          const remainingMediaSec = seg.end - estimatedTime;
          if (remainingMediaSec <= 0.005) {
            finishSingleSegment();
            return;
          }
          // Predictive one-shot timeout when within 180ms of boundary
          if (remainingMediaSec <= 0.18 && stopTimeoutRef.current === null) {
            const waitMs = Math.max(0, (remainingMediaSec / rate) * 1000 - 4);
            stopTimeoutRef.current = window.setTimeout(() => {
              stopTimeoutRef.current = null;
              finishSingleSegment();
            }, waitMs);
          }
        }
      }

      // 2. Continuous sequence boundary check
      if (sequenceRef.current.active && isPlaying) {
        const seq = sequenceRef.current;
        const activeSeg = seq.segments[seq.index];
        if (!activeSeg) {
          seq.active = false;
          return;
        }

        if (!seq.seekSettled) {
          const elapsedSinceSeek = nowPerf - seq.issuedAtPerf;
          if (
            (reportedTime >= activeSeg.start - 0.35 && reportedTime < activeSeg.end + 0.05) ||
            elapsedSinceSeek > 450
          ) {
            seq.seekSettled = true;
          }
        }

        if (seq.seekSettled) {
          const remainingMediaSec = activeSeg.end - estimatedTime;
          if (remainingMediaSec <= 0.005) {
            advanceOrFinishSequence();
            return;
          }
          if (remainingMediaSec <= 0.18 && stopTimeoutRef.current === null) {
            const waitMs = Math.max(0, (remainingMediaSec / rate) * 1000 - 4);
            stopTimeoutRef.current = window.setTimeout(() => {
              stopTimeoutRef.current = null;
              advanceOrFinishSequence();
            }, waitMs);
          }
        }
      }
    };

    const startMonitor = () => {
      if (rafIdRef.current !== null || fallbackIntervalRef.current !== null) return;

      const loop = () => {
        tickMonitor();
        if (
          segmentRef.current.active ||
          sequenceRef.current.active ||
          clockAnchorRef.current.isPlaying
        ) {
          rafIdRef.current = window.requestAnimationFrame(loop);
        } else {
          rafIdRef.current = null;
        }
      };

      rafIdRef.current = window.requestAnimationFrame(loop);
      // 16ms interval backup in case RAF is throttled
      fallbackIntervalRef.current = window.setInterval(() => {
        tickMonitor();
      }, 16);
    };

    // Load YouTube API script
    useEffect(() => {
      let isMounted = true;

      const initPlayer = () => {
        if (!isMounted || !window.YT || !window.YT.Player) return;

        const playerDivId = 'yt-player-target';
        if (playerInstanceRef.current) {
          try {
            playerInstanceRef.current.destroy();
          } catch {
            // ignore
          }
        }

        try {
          playerInstanceRef.current = new window.YT.Player(playerDivId, {
            videoId: MOVIE_SETTINGS.videoId,
            playerVars: {
              start: MOVIE_SETTINGS.practiceRangeStart,
              end: MOVIE_SETTINGS.practiceRangeEnd,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
              cc_load_policy: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: (event: any) => {
                if (!isMounted) return;
                setIsPlayerReady(true);
                try {
                  event.target.setPlaybackRate(playbackRateRef.current);
                } catch {
                  // ignore
                }
              },
              onStateChange: (event: any) => {
                // YT.PlayerState.PLAYING = 1
                if (event.data === 1) {
                  clockAnchorRef.current.isPlaying = true;
                  clockAnchorRef.current.anchorPerfNow = performance.now();
                  startMonitor();
                } else {
                  clockAnchorRef.current.isPlaying = false;
                  try {
                    const t = event.target?.getCurrentTime?.();
                    if (typeof t === 'number') {
                      callbacksRef.current.onTimeUpdate?.(t);
                    }
                  } catch {
                    // ignore
                  }
                  if (!segmentRef.current.active && !sequenceRef.current.active) {
                    stopMonitor();
                  }
                }
              },
              onError: (event: any) => {
                const errorCode = event.data;
                console.warn('YouTube Player error code:', errorCode);
                if (errorCode === 101 || errorCode === 150 || errorCode === 2 || errorCode === 5) {
                  setHasEmbedError(true);
                }
              },
            },
          });
        } catch (err) {
          console.error('Failed to instantiate YouTube player:', err);
          setHasEmbedError(true);
        }
      };

      if (!window.YT || !window.YT.Player) {
        const existingScript = document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          initPlayer();
        };

        const checkTimer = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkTimer);
            initPlayer();
          }
        }, 300);

        return () => {
          isMounted = false;
          clearInterval(checkTimer);
          stopMonitor();
        };
      } else {
        initPlayer();
      }

      return () => {
        isMounted = false;
        stopMonitor();
        if (playerInstanceRef.current) {
          try {
            playerInstanceRef.current.destroy();
          } catch {
            // ignore
          }
        }
      };
    }, []);

    // Sync playback rate when prop changes
    useEffect(() => {
      if (
        playerInstanceRef.current &&
        typeof playerInstanceRef.current.setPlaybackRate === 'function'
      ) {
        try {
          playerInstanceRef.current.setPlaybackRate(playbackRate);
        } catch {
          // ignore
        }
      }
    }, [playbackRate]);

    // Idle time sync when paused/scrubbed so UI always shows current video time
    useEffect(() => {
      if (!isPlayerReady || !onTimeUpdate) return;
      const id = window.setInterval(() => {
        if (clockAnchorRef.current.isPlaying) return;
        const player = playerInstanceRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          try {
            const t = player.getCurrentTime();
            if (typeof t === 'number' && !Number.isNaN(t)) {
              callbacksRef.current.onTimeUpdate?.(t);
            }
          } catch {
            // ignore
          }
        }
      }, 150);
      return () => window.clearInterval(id);
    }, [isPlayerReady, Boolean(onTimeUpdate)]);

    useImperativeHandle(ref, () => ({
      playSegment: (start: number, end: number) => {
        if (!playerInstanceRef.current) return;
        try {
          clearStopTimeout();
          sequenceRef.current.active = false;
          segmentRef.current = {
            start,
            end,
            active: true,
            seekSettled: false,
            issuedAtPerf: performance.now(),
          };
          clockAnchorRef.current = {
            lastReportedMediaTime: -1,
            anchorMediaTime: start,
            anchorPerfNow: performance.now(),
            isPlaying: true,
          };
          playerInstanceRef.current.seekTo(start, true);
          playerInstanceRef.current.playVideo();
          startMonitor();
        } catch (e) {
          console.error('playSegment error:', e);
        }
      },
      playSequence: (segments: SequenceSegment[], startIndex: number) => {
        if (!playerInstanceRef.current || segments.length === 0) return;
        const safeIdx = Math.max(0, Math.min(segments.length - 1, startIndex));
        const firstSeg = segments[safeIdx];
        try {
          clearStopTimeout();
          segmentRef.current.active = false;
          sequenceRef.current = {
            segments,
            index: safeIdx,
            active: true,
            seekSettled: false,
            issuedAtPerf: performance.now(),
          };
          clockAnchorRef.current = {
            lastReportedMediaTime: -1,
            anchorMediaTime: firstSeg.start,
            anchorPerfNow: performance.now(),
            isPlaying: true,
          };
          playerInstanceRef.current.seekTo(firstSeg.start, true);
          playerInstanceRef.current.playVideo();
          startMonitor();
        } catch (e) {
          console.error('playSequence error:', e);
        }
      },
      seekTo: (seconds: number) => {
        if (!playerInstanceRef.current) return;
        try {
          playerInstanceRef.current.seekTo(seconds, true);
        } catch (e) {
          console.error('seekTo error:', e);
        }
      },
      play: () => {
        if (!playerInstanceRef.current) return;
        try {
          playerInstanceRef.current.playVideo();
          startMonitor();
        } catch (e) {
          console.error('play error:', e);
        }
      },
      pause: () => {
        if (!playerInstanceRef.current) return;
        try {
          segmentRef.current.active = false;
          sequenceRef.current.active = false;
          clearStopTimeout();
          playerInstanceRef.current.pauseVideo();
          stopMonitor();
        } catch (e) {
          console.error('pause error:', e);
        }
      },
      getCurrentTime: () => {
        if (
          playerInstanceRef.current &&
          typeof playerInstanceRef.current.getCurrentTime === 'function'
        ) {
          try {
            return playerInstanceRef.current.getCurrentTime();
          } catch {
            return 0;
          }
        }
        return 0;
      },
      setPlaybackRate: (rate: number) => {
        if (
          playerInstanceRef.current &&
          typeof playerInstanceRef.current.setPlaybackRate === 'function'
        ) {
          try {
            playerInstanceRef.current.setPlaybackRate(rate);
          } catch (e) {
            console.error('setPlaybackRate error:', e);
          }
        }
      },
      isReady: () => isPlayerReady,
    }));

    const youtubeDirectUrl = `https://www.youtube.com/watch?v=${MOVIE_SETTINGS.videoId}&t=${MOVIE_SETTINGS.practiceRangeStart}s`;

    return (
      <div className="w-full flex flex-col items-center bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
        {/* 16:9 Video container */}
        <div className="w-full relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <div id="yt-player-target" className="w-full h-full" />

          {!isPlayerReady && !hasEmbedError && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center pointer-events-none">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-2" />
              <p className="text-sm font-medium text-slate-200">Loading Zootopia 2 scene player...</p>
              <p className="text-xs text-slate-400 mt-1">Readying 00:45 – 02:10</p>
            </div>
          )}

          {hasEmbedError && (
            <div className="absolute inset-0 bg-slate-900 p-4 flex flex-col items-center justify-center text-center z-20">
              <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-sm font-bold text-amber-200 mb-1">
                This video can't play inside the app.
              </p>
              <p className="text-xs text-slate-300 mb-4 max-w-xs">
                YouTube restricted in-app playback for this clip. All sentence text, voice recording, and self-checks continue working normally.
              </p>
              <a
                href={youtubeDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md"
              >
                <span>Open on YouTube (00:45)</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>

        {/* Required One-line Credit Under the Video Player on every screen (at least 13px, gray) */}
        <div className="w-full bg-slate-950/90 px-3 py-2 text-center border-t border-slate-800/80">
          <p className="text-[13px] leading-snug text-slate-400 font-normal">
            Clip: <span className="italic text-slate-300">{MOVIE_SETTINGS.movieTitleEn}</span> ({MOVIE_SETTINGS.releaseYear}), {MOVIE_SETTINGS.distributionCompany} / {MOVIE_SETTINGS.productionCompany} · via YouTube · For educational use only
          </p>
        </div>
      </div>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
