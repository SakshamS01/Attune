import { useEffect, useRef, useState } from 'react';
import { classifyExpression, initialMonitor, observe, type Expression, type Suggestion } from '@/lib/expression';

const VERSION = '1.0.1'; // must match the installed @mediapipe/tasks-vision
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Landmarker = { detectForVideo: (v: HTMLVideoElement, t: number) => { faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] }; close: () => void };

/**
 * Analyses the camera feed on the student's device once per second.
 * Frames never leave the browser and are never stored.
 */
export function useExpressionMonitor(video: React.RefObject<HTMLVideoElement | null>, enabled: boolean, onSuggestion: (s: Suggestion) => void, onMinute: (mood: Expression) => void) {
  const [status, setStatus] = useState<'off' | 'loading' | 'watching' | 'no-face' | 'error'>('off');
  const [mood, setMood] = useState<Expression | null>(null);
  const handlers = useRef({ onSuggestion, onMinute }); handlers.current = { onSuggestion, onMinute };
  useEffect(() => {
    if (!enabled) { setStatus('off'); setMood(null); return; }
    let cancelled = false; let landmarker: Landmarker | null = null; let timer: ReturnType<typeof setInterval> | undefined;
    let state = initialMonitor(); let tick = 0;
    setStatus('loading');
    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const files = await vision.FilesetResolver.forVisionTasks(WASM);
        landmarker = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true }) as unknown as Landmarker;
        if (cancelled) { landmarker.close(); return; }
        setStatus('watching');
        timer = setInterval(() => {
          const el = video.current;
          if (!el || !landmarker || el.readyState < 2) return;
          const result = landmarker.detectForVideo(el, performance.now());
          const cats = result.faceBlendshapes?.[0]?.categories;
          if (!cats?.length) { setStatus('no-face'); return; }
          setStatus('watching');
          const scores = Object.fromEntries(cats.map(c => [c.categoryName, c.score]));
          const out = observe(state, classifyExpression(scores), Date.now());
          state = out.state; setMood(out.mood);
          if (out.suggestion) handlers.current.onSuggestion(out.suggestion);
          if (++tick % 60 === 0 && out.mood) handlers.current.onMinute(out.mood);
        }, 1000);
      } catch { if (!cancelled) setStatus('error'); }
    })();
    return () => { cancelled = true; if (timer) clearInterval(timer); landmarker?.close(); };
  }, [enabled]);
  return { status, mood };
}
