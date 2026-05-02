// @ts-ignore
// @ts-nocheck
import styles from './HandTrackingExperience.module.css';

import { useEffect, useRef, useState, useCallback } from 'react';
import StartOverlay from './start-overlay';
import Hud from './Hud';
import ThemeSwitcher from './theme-switcher';
import GameOverScreen from './game-over-screen';
import { useMutation } from '@tanstack/react-query';
import { appTrpc } from '@/trpc';
import { appPaths } from '@/routes/paths';
import loadScript from '@/utils/load-script';
import { MEDIAPIPE_SCRIPTS } from '@/utils/constant';
import LogoutButton from './logout-button';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    HAND_CONNECTIONS: any;
    webkitAudioContext: typeof AudioContext;
  }
}

async function ensureMediaPipeLoaded() {
  for (const src of MEDIAPIPE_SCRIPTS) {
    // eslint-disable-next-line no-await-in-loop
    await loadScript(src);
  }
}

/* --------------------------------------------------------------------------
 * Constants
 * -------------------------------------------------------------------------- */
const FINGER_TIPS = [4, 8, 12, 16, 20];
const FONT_SIZE = 16;

const FN_INDEX = 8;
const FN_TRAIL_LEN = 26;
const FN_BLADE = 42;
const FN_MAX_HANDS = 2;
const FN_KINDS = ['apple', 'orange', 'watermelon', 'kiwi', 'grape'];

const themes = {
  Rainbow: (t : any, index : any, total : any) =>
    `hsl(${(t * 100 + index * (360 / total)) % 360}, 100%, 60%)`,
};

/* --------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */
export default function HandTrackingExperience() {
  // React state — only for things that should trigger re-render
  const [started, setStarted] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<"Rainbow" | "FruitNinja">('Rainbow');
  const [gameOverVisible, setGameOverVisible] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(0);

  // DOM refs
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const mainCanvasRef = useRef(null);

  // HUD text refs (avoid re-rendering on every animation frame)
  const uiHandsRef = useRef(null);
  const uiFpsRef = useRef(null);
  const uiGestureRef = useRef(null);
  const uiSpreadRef = useRef(null);
  const uiScoreRef = useRef(null);
  const uiLivesRef = useRef(null);
  // const fnFinalScoreRef = useRef(null);
  

  // Engine refs — all mutable, frame-by-frame state lives here
  const engineRef = useRef({
    width: 0,
    height: 0,
    time: 0,
    lastTime: 0,
    framesThisSecond: 0,
    lastFpsTime: 0,
    rafId: 0,
    currentHands: [],
    handVelocities: 0,
    particles: [],
    ripples: [],
    matrixColumns: [],
    maxColumns: 0,
    lastPinchState: [false, false],
    // Fruit Ninja
    fnTrails: [[], []],
    fnFruits: [],
    fnParticles: [],
    fnSplats: [],
    fnScore: 0,
    fnLives: 3,
    fnSpawnAcc: 0,
    fnSpawnEvery: 1.65,
    fnGameState: 'off', // 'off' | 'playing' | 'over'
    // Audio
    audioCtx: null,
    humOsc: null,
    humGain: null,
    // MediaPipe
    hands: null,
    camera: null,
    // Theme is read from a ref so the render loop sees the latest value
    // without being recreated.
    currentTheme: 'Rainbow',
  });

  /* ------------------------------------------------------------------
   * Audio
   * ------------------------------------------------------------------ */
  const initAudio = useCallback(() => {
    const eng = engineRef.current;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctor();
      const humOsc = audioCtx.createOscillator();
      const humGain = audioCtx.createGain();
      humOsc.type = 'sine';
      humOsc.frequency.value = 100;
      humGain.gain.value = 0;
      humOsc.connect(humGain);
      humGain.connect(audioCtx.destination);
      humOsc.start();
      eng.audioCtx = audioCtx;
      eng.humOsc = humOsc;
      eng.humGain = humGain;
    } catch (e) {
      console.error('Web Audio API failed', e);
    }
  }, []);

  const triggerZap = useCallback(() => {
    const { audioCtx } = engineRef.current;
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }, []);

  const fnPlaySlice = useCallback(() => {
    const { audioCtx } = engineRef.current;
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(720, audioCtx.currentTime);
    g.gain.setValueAtTime(0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.11);
  }, []);

  /* ------------------------------------------------------------------
   * Sizing — uses container size (ResizeObserver), NOT viewport
   * ------------------------------------------------------------------ */
  const resize = useCallback(() => {
    const eng = engineRef.current;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    eng.width = w;
    eng.height = h;
    if (bgCanvasRef.current) {
      bgCanvasRef.current.width = w;
      bgCanvasRef.current.height = h;
    }
    if (mainCanvasRef.current) {
      mainCanvasRef.current.width = w;
      mainCanvasRef.current.height = h;
    }
    eng.maxColumns = Math.floor(w / FONT_SIZE);
    eng.matrixColumns = new Array(eng.maxColumns)
      .fill(1)
      .map(() => (Math.random() * h) / FONT_SIZE);
  }, []);

  /* ------------------------------------------------------------------
   * Game lifecycle
   * ------------------------------------------------------------------ */
  const resetFruitNinja = useCallback(() => {
    const eng = engineRef.current;
    eng.fnScore = 0;
    eng.fnLives = 3;
    eng.fnSpawnAcc = 0;
    eng.fnSpawnEvery = 1.65;
    eng.fnFruits = [];
    eng.fnParticles = [];
    eng.fnSplats = [];
    eng.fnTrails[0].length = 0;
    eng.fnTrails[1].length = 0;
    eng.fnGameState = 'playing';
    if (uiScoreRef.current) uiScoreRef.current.textContent = '0';
    if (uiLivesRef.current) uiLivesRef.current.textContent = '3';
    setGameOverVisible(false);
    setFinalScore(0);
  }, []);

  const endFruitNinja = useCallback(() => {
    const eng = engineRef.current;
    eng.fnGameState = 'over';
    eng.fnFruits = [];
    eng.fnSpawnAcc = 0;

    setFinalScore(Number(eng.fnScore));
    setGameOverVisible(true);
    triggerZap();

  }, [triggerZap]);

  const handleRestart = useCallback(() => {
    const { audioCtx } = engineRef.current;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    resetFruitNinja();
  }, [resetFruitNinja]);

  /* ------------------------------------------------------------------
   * Theme switching
   * ------------------------------------------------------------------ */
  const handleThemeChange = useCallback(
    nextTheme => {
      const eng = engineRef.current;
      setCurrentTheme(nextTheme);
      eng.currentTheme = nextTheme;
      if (nextTheme === 'FruitNinja') {
        // accent var is purely cosmetic for HUD numbers; scoped to root only
        rootRef.current?.style.setProperty('--hte-accent', '#7cff6a');
        resetFruitNinja();
      } else {
        eng.fnGameState = 'off';
        eng.fnFruits = [];
        eng.fnParticles = [];
        eng.fnSplats = [];
        eng.fnTrails[0].length = 0;
        eng.fnTrails[1].length = 0;
        setGameOverVisible(false);
        if (themes[nextTheme]) {
          rootRef.current?.style.setProperty(
            '--hte-accent',
            themes[nextTheme](0, 1, 1)
          );
        }
      }
    },
    [resetFruitNinja]
  );

  /* ------------------------------------------------------------------
   * Start handler — kicks off audio + MediaPipe + render loop
   * ------------------------------------------------------------------ */
  const handleStart = useCallback(async () => {
    setStarted(true);
    initAudio();
    try {
      await ensureMediaPipeLoaded();
    } catch (e) {
      console.error(e);
      return;
    }
    initMediaPipe();
    engineRef.current.lastTime = performance.now();
    engineRef.current.lastFpsTime = performance.now();
    engineRef.current.rafId = requestAnimationFrame(renderLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAudio]);

  /* ------------------------------------------------------------------
   * Render loop and helpers — kept inside the component so they close
   * over the refs. Wrapped in useCallback only where worth it; most are
   * just defined once below.
   * ------------------------------------------------------------------ */

  const isFruitNinjaMode = () => engineRef.current.currentTheme === 'FruitNinja';

  const getDist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  const mapToCanvas = point => {
    const { width, height } = engineRef.current;
    return { x: point.x * width, y: point.y * height };
  };

  const updateHum = activeHands => {
    const eng = engineRef.current;
    if (!eng.audioCtx || !eng.humGain) return;
    if (activeHands.length < 2) {
      eng.humGain.gain.setTargetAtTime(0, eng.audioCtx.currentTime, 0.1);
      return;
    }
    const p1 = activeHands[0][8];
    const p2 = activeHands[1][8];
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetFreq = 100 + (1 - Math.min(dist, 1)) * 300;
    const targetVolume = 0.05 + (1 - Math.min(dist, 1)) * 0.15;
    eng.humOsc.frequency.setTargetAtTime(targetFreq, eng.audioCtx.currentTime, 0.1);
    eng.humGain.gain.setTargetAtTime(targetVolume, eng.audioCtx.currentTime, 0.1);
  };

  const createParticles = (pos, color, count = 3) => {
    const { particles } = engineRef.current;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color,
        size: Math.random() * 3 + 1,
      });
    }
  };

  const createShockwave = (pos, color) => {
    engineRef.current.ripples.push({
      x: pos.x,
      y: pos.y,
      radius: 0,
      maxRadius: 150 + Math.random() * 100,
      life: 1.0,
      color,
    });
  };

  const detectGestures = () => {
    const eng = engineRef.current;
    if (!eng.currentHands.length) return;
    eng.currentHands.forEach((hand, idx) => {
      const thumb = hand[4];
      const index = hand[8];
      const dist = getDist(thumb, index);
      const isPinching = dist < 0.05;
      if (isPinching && !eng.lastPinchState[idx]) {
        const midpoint = {
          x: (thumb.x + index.x) / 2,
          y: (thumb.y + index.y) / 2,
        };
        createShockwave(
          mapToCanvas(midpoint),
          themes[eng.currentTheme](eng.time, 1, 1)
        );
        triggerZap();
        if (uiGestureRef.current) uiGestureRef.current.textContent = 'PINCH !';
      }
      eng.lastPinchState[idx] = isPinching;
    });

    if (eng.currentHands[0]) {
      const spread = getDist(eng.currentHands[0][8], eng.currentHands[0][20]);
      const spreadPct = Math.min(Math.round(spread * 300), 100);
      if (uiSpreadRef.current) uiSpreadRef.current.textContent = `${spreadPct}%`;
      if (!eng.lastPinchState.includes(true) && uiGestureRef.current) {
        uiGestureRef.current.textContent =
          spreadPct > 50 ? 'Open Hand' : 'Fist';
      }
    }
  };

  /* ---------- Fruit Ninja drawing primitives ---------- */
  const fnDistPointToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  };

  const fnTrailHitsCircle = (cx, cy, r, trail) => {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      if (fnDistPointToSegment(cx, cy, a.x, a.y, b.x, b.y) < r + FN_BLADE) {
        return true;
      }
    }
    return false;
  };

  const fnAnyBladeHits = (cx, cy, r) => {
    const { fnTrails } = engineRef.current;
    for (let h = 0; h < FN_MAX_HANDS; h++) {
      if (fnTrailHitsCircle(cx, cy, r, fnTrails[h])) return true;
    }
    return false;
  };

  const fnUpdateTrails = () => {
    const eng = engineRef.current;
    for (let h = 0; h < FN_MAX_HANDS; h++) {
      const tr = eng.fnTrails[h];
      if (h < eng.currentHands.length && eng.currentHands[h] && eng.currentHands[h][FN_INDEX]) {
        const pt = mapToCanvas(eng.currentHands[h][FN_INDEX]);
        tr.push({ x: pt.x, y: pt.y });
        while (tr.length > FN_TRAIL_LEN) tr.shift();
      } else if (tr.length > 0) {
        tr.shift();
      }
    }
  };

  const fnSpawnFruit = () => {
    const eng = engineRef.current;
    const fromLeft = Math.random() < 0.5;
    const bomb = Math.random() < 0.1;
    const r = bomb ? 42 : 40 + Math.random() * 20;
    const kind = bomb ? 'bomb' : FN_KINDS[(Math.random() * FN_KINDS.length) | 0];
    eng.fnFruits.push({
      x: fromLeft ? -r * 2 : eng.width + r * 2,
      y: eng.height * (0.4 + Math.random() * 0.34),
      vx: fromLeft ? 5 + Math.random() * 6 : -(5 + Math.random() * 6),
      vy: -(8 + Math.random() * 5),
      ay: 0.22,
      r,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.06,
      bomb,
      kind,
    });
  };

  const fnBurst = (x, y, colors, n) => {
    const { fnParticles } = engineRef.current;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 9;
      fnParticles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 2,
        life: 0.55 + Math.random() * 0.45,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 5,
      });
    }
  };

  const fnSplat = (x, y, kind, bomb) => {
    engineRef.current.fnSplats.push({
      x,
      y,
      life: 1,
      rot: Math.random() * Math.PI,
      kind,
      bomb,
    });
  };

  const fnDrawBomb = (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, 32 * s, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-8 * s, -8 * s, 2 * s, 0, 0, 34 * s);
    g.addColorStop(0, '#555');
    g.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ff2244';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s);
      ctx.lineTo(Math.cos(a) * 28 * s, Math.sin(a) * 28 * s);
      ctx.stroke();
    }
  };

  const fnDrawApple = (ctx, s) => {
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 30 * s, 28 * s, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-8 * s, -10 * s, 4 * s, 0, 0, 34 * s);
    g.addColorStop(0, '#ff6a6a');
    g.addColorStop(0.6, '#e02020');
    g.addColorStop(1, '#8b0000');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,0,0,0.35)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.strokeStyle = '#4a2c10';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(0, -24 * s);
    ctx.lineTo(2 * s, -34 * s);
    ctx.stroke();
    ctx.fillStyle = '#2d5a1e';
    ctx.beginPath();
    ctx.ellipse(10 * s, -30 * s, 8 * s, 5 * s, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-10 * s, -4 * s, 10 * s, 14 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
  };

  const fnDrawOrange = (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, 30 * s, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-10 * s, -10 * s, 4 * s, 0, 0, 32 * s);
    g.addColorStop(0, '#ffcc80');
    g.addColorStop(0.5, '#ff9100');
    g.addColorStop(1, '#e65100');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,80,0,0.4)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1 * s;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 18 * s, Math.sin(a) * 18 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#3d2914';
    ctx.beginPath();
    ctx.arc(0, -28 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  };

  const fnDrawWatermelon = (ctx, s) => {
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 34 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1b5e20';
    ctx.fill();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 6 * s, 28 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5252';
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 7; i++) {
      const a = -0.8 + i * 0.22;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(a) * 10 * s,
        Math.sin(a) * 4 * s + 6 * s,
        2 * s,
        3 * s,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-18 * s, -14 * s);
    ctx.lineTo(18 * s, -14 * s);
    ctx.stroke();
  };

  const fnDrawKiwi = (ctx, s) => {
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 30 * s, 26 * s, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-6 * s, -6 * s, 2 * s, 0, 0, 32 * s);
    g.addColorStop(0, '#bcaaa4');
    g.addColorStop(0.7, '#6d4c41');
    g.addColorStop(1, '#3e2723');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 22 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c5e1a5';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 2 * s);
      ctx.lineTo(Math.cos(a) * 18 * s, Math.sin(a) * 18 * s + 2 * s);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff59d';
    ctx.beginPath();
    ctx.arc(0, 2 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  };

  const fnDrawGrape = (ctx, s) => {
    const cols = ['#7b1fa2', '#9c27b0', '#ce93d8'];
    const offs = [
      [0, 0],
      [-10 * s, 8 * s],
      [10 * s, 8 * s],
      [-6 * s, -10 * s],
      [8 * s, -8 * s],
    ];
    offs.forEach((o, i) => {
      ctx.beginPath();
      ctx.arc(o[0], o[1], 11 * s, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(
        o[0] - 3 * s,
        o[1] - 3 * s,
        1,
        o[0],
        o[1],
        12 * s
      );
      g.addColorStop(0, cols[i % cols.length]);
      g.addColorStop(1, '#4a148c');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1 * s;
      ctx.stroke();
    });
  };

  const fnDrawFruitShape = (ctx, f) => {
    const s = f.r / 30;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.bomb || f.kind === 'bomb') fnDrawBomb(ctx, s);
    else if (f.kind === 'apple') fnDrawApple(ctx, s);
    else if (f.kind === 'orange') fnDrawOrange(ctx, s);
    else if (f.kind === 'watermelon') fnDrawWatermelon(ctx, s);
    else if (f.kind === 'kiwi') fnDrawKiwi(ctx, s);
    else if (f.kind === 'grape') fnDrawGrape(ctx, s);
    else fnDrawApple(ctx, s);
    ctx.restore();
  };

  const fnDrawBlades = ctx => {
    const { fnTrails } = engineRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let h = 0; h < FN_MAX_HANDS; h++) {
      const tr = fnTrails[h];
      if (tr.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(tr[0].x, tr[0].y);
      for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y);
      const g = ctx.createLinearGradient(
        tr[0].x,
        tr[0].y,
        tr[tr.length - 1].x,
        tr[tr.length - 1].y
      );
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(
        0.55,
        h === 0 ? 'rgba(160, 255, 255, 0.95)' : 'rgba(255, 210, 140, 0.95)'
      );
      g.addColorStop(1, '#ffffff');
      ctx.strokeStyle = g;
      ctx.lineWidth = 7;
      ctx.shadowBlur = 16;
      ctx.shadowColor = h === 0 ? '#6cf0ff' : '#ffb84d';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const fnDrawSplats = ctx => {
    const { fnSplats } = engineRef.current;
    for (const sp of fnSplats) {
      ctx.save();
      ctx.globalAlpha = sp.life;
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.rot);
      const sc = 0.65 + (1 - sp.life) * 0.55;
      if (sp.bomb) {
        ctx.fillStyle = 'rgba(35,35,35,0.95)';
        ctx.beginPath();
        ctx.arc(-9 * sc, -5 * sc, 14 * sc, 0, Math.PI * 2);
        ctx.arc(9 * sc, 6 * sc, 12 * sc, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff7043';
        ctx.beginPath();
        ctx.ellipse(-10 * sc, 0, 16 * sc, 20 * sc, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath();
        ctx.ellipse(10 * sc, 2 * sc, 14 * sc, 18 * sc, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const fnUpdateSplats = dt => {
    const { fnSplats } = engineRef.current;
    for (let i = fnSplats.length - 1; i >= 0; i--) {
      fnSplats[i].life -= dt * 1.85;
      if (fnSplats[i].life <= 0) fnSplats.splice(i, 1);
    }
  };

  const fnUpdateParticles = (ctx, dt) => {
    const { fnParticles } = engineRef.current;
    for (let i = fnParticles.length - 1; i >= 0; i--) {
      const p = fnParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.16;
      p.life -= dt * 1.5;
      if (p.life <= 0) {
        fnParticles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawBackgroundNinja = bgCtx => {
    const { width, height } = engineRef.current;
    bgCtx.globalCompositeOperation = 'source-over';
    bgCtx.fillStyle = 'rgba(6, 8, 18, 0.35)';
    bgCtx.fillRect(0, 0, width, height);
    const g = bgCtx.createRadialGradient(
      width * 0.5,
      height * 0.35,
      0,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.65
    );
    g.addColorStop(0, 'rgba(40, 80, 60, 0.2)');
    g.addColorStop(0.5, 'rgba(20, 30, 50, 0.15)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, width, height);
  };

  const updateFruitNinja = dt => {
    const eng = engineRef.current;
    fnUpdateTrails();
    if (eng.fnGameState !== 'playing') return;
    eng.fnSpawnAcc += dt;
    eng.fnSpawnEvery = Math.max(0.58, 1.65 - eng.fnScore * 0.0028);
    while (eng.fnSpawnAcc >= eng.fnSpawnEvery) {
      eng.fnSpawnAcc -= eng.fnSpawnEvery;
      fnSpawnFruit();
    }
    for (let i = eng.fnFruits.length - 1; i >= 0; i--) {
      const f = eng.fnFruits[i];
      f.x += f.vx;
      f.y += f.vy;
      f.vy += f.ay;
      f.rot += f.vr;
      if (fnAnyBladeHits(f.x, f.y, f.r)) {
        if (f.bomb) {
          eng.fnLives -= 1;
          if (uiLivesRef.current) uiLivesRef.current.textContent = String(eng.fnLives);
          fnBurst(f.x, f.y, ['#222', '#ff1744', '#111'], 36);
          fnSplat(f.x, f.y, f.kind, true);
          if (eng.fnLives <= 0) endFruitNinja();
        } else {
          eng.fnScore += 10;
          if (uiScoreRef.current) uiScoreRef.current.textContent = String(eng.fnScore);
          fnBurst(f.x, f.y, ['#ffcc80', '#ff7043', '#fff176', '#e040fb'], 22);
          fnSplat(f.x, f.y, f.kind, false);
          fnPlaySlice();
        }
        eng.fnFruits.splice(i, 1);
        continue;
      }
      if (f.y > eng.height + f.r * 2 && f.vy > 0) {
        if (!f.bomb) {
          eng.fnLives -= 1;
          if (uiLivesRef.current) uiLivesRef.current.textContent = String(eng.fnLives);
          if (eng.fnLives <= 0) endFruitNinja();
        }
        eng.fnFruits.splice(i, 1);
      } else if (f.x < -f.r * 4 || f.x > eng.width + f.r * 4) {
        eng.fnFruits.splice(i, 1);
      }
    }
  };

  const renderFruitNinjaFrame = dt => {
    const eng = engineRef.current;
    const ctx = mainCanvasRef.current.getContext('2d');
    const bgCtx = bgCanvasRef.current.getContext('2d');
    drawBackgroundNinja(bgCtx);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, eng.width, eng.height);
    updateFruitNinja(dt);
    for (const f of eng.fnFruits) fnDrawFruitShape(ctx, f);
    fnDrawSplats(ctx);
    fnUpdateSplats(dt);
    ctx.globalCompositeOperation = 'lighter';
    fnUpdateParticles(ctx, dt);
    ctx.globalCompositeOperation = 'source-over';
    fnDrawBlades(ctx);
    if (
      eng.currentHands.length &&
      typeof window.drawConnectors === 'function' &&
      typeof window.HAND_CONNECTIONS !== 'undefined'
    ) {
      eng.currentHands.forEach((hand, idx) => {
        const col = idx === 0 ? 'rgba(120, 240, 255, 0.28)' : 'rgba(255, 190, 120, 0.28)';
        window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
          color: col,
          lineWidth: 2,
        });
      });
    }
  };

  /* ---------- AR mode background + physics ---------- */
  const drawBackground = () => {
    const eng = engineRef.current;
    const bgCtx = bgCanvasRef.current.getContext('2d');
    bgCtx.globalCompositeOperation = 'destination-out';
    bgCtx.fillStyle = `rgba(0, 0, 0, ${0.15 + Math.min(eng.handVelocities * 10, 0.5)})`;
    bgCtx.fillRect(0, 0, eng.width, eng.height);
    bgCtx.globalCompositeOperation = 'source-over';

    bgCtx.fillStyle = themes[eng.currentTheme](eng.time, 1, 1);
    bgCtx.font = `${FONT_SIZE}px monospace`;
    const speedMult = 1 + eng.handVelocities * 100;

    for (let i = 0; i < eng.matrixColumns.length; i++) {
      if (Math.random() > 0.95) {
        const char = String.fromCharCode(0x30a0 + Math.random() * 96);
        bgCtx.fillText(char, i * FONT_SIZE, eng.matrixColumns[i] * FONT_SIZE);
      }
      eng.matrixColumns[i] += Math.random() * speedMult;
      if (eng.matrixColumns[i] * FONT_SIZE > eng.height && Math.random() > 0.9) {
        eng.matrixColumns[i] = 0;
      }
    }
  };

  const updatePhysics = () => {
    const eng = engineRef.current;
    const ctx = mainCanvasRef.current.getContext('2d');

    for (let i = eng.particles.length - 1; i >= 0; i--) {
      const p = eng.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      p.vy += 0.1;
      if (p.life <= 0) {
        eng.particles.splice(i, 1);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
      }
    }

    for (let i = eng.ripples.length - 1; i >= 0; i--) {
      const r = eng.ripples[i];
      r.radius += (r.maxRadius - r.radius) * 0.1;
      r.life -= 0.03;
      if (r.life <= 0) {
        eng.ripples.splice(i, 1);
      } else {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4 * r.life;
        ctx.globalAlpha = r.life;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
  };

  /* ---------- Main render loop ---------- */
  function renderLoop(timestamp) {
    const eng = engineRef.current;
    eng.rafId = requestAnimationFrame(renderLoop);

    const dt = (timestamp - eng.lastTime) / 1000;
    eng.lastTime = timestamp;
    eng.time += dt;

    eng.framesThisSecond++;
    if (timestamp > eng.lastFpsTime + 1000) {
      if (uiFpsRef.current) uiFpsRef.current.textContent = String(eng.framesThisSecond);
      eng.framesThisSecond = 0;
      eng.lastFpsTime = timestamp;
    }

    if (isFruitNinjaMode()) {
      if (eng.audioCtx && eng.humGain) {
        eng.humGain.gain.setTargetAtTime(0, eng.audioCtx.currentTime, 0.05);
      }
      renderFruitNinjaFrame(dt);
      return;
    }

    drawBackground();

    const ctx = mainCanvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, eng.width, eng.height);
    ctx.globalCompositeOperation = 'screen';

    updatePhysics();

    if (eng.currentHands.length > 0) {
      eng.currentHands.forEach((hand, handIndex) => {
        const glowColor = themes[eng.currentTheme](eng.time, handIndex, 2);
        if (
          typeof window.drawConnectors === 'function' &&
          typeof window.HAND_CONNECTIONS !== 'undefined'
        ) {
          window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
            color: glowColor,
            lineWidth: 2,
          });
        }
        ctx.shadowBlur = 15;
        ctx.shadowColor = glowColor;

        FINGER_TIPS.forEach((tipIndex, idx) => {
          const pt = mapToCanvas(hand[tipIndex]);
          const tipCol = themes[eng.currentTheme](eng.time, idx, FINGER_TIPS.length);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          if (Math.random() > 0.6) createParticles(pt, tipCol, 1);
        });
        ctx.shadowBlur = 0;
      });

      if (eng.currentHands.length >= 2) {
        const h1 = eng.currentHands[0];
        const h2 = eng.currentHands[1];

        FINGER_TIPS.forEach((tipIndex, idx) => {
          const pt1 = mapToCanvas(h1[tipIndex]);
          const pt2 = mapToCanvas(h2[tipIndex]);
          const dist = getDist(pt1, pt2);
          const col = themes[eng.currentTheme](eng.time, idx, FINGER_TIPS.length);

          if (dist < 150 && Math.random() > 0.5) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            const midX = (pt1.x + pt2.x) / 2 + (Math.random() - 0.5) * 50;
            const midY = (pt1.y + pt2.y) / 2 + (Math.random() - 0.5) * 50;
            ctx.lineTo(midX, midY);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = '#ffffff';
            ctx.shadowBlur = 20;
            ctx.shadowColor = col;
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          const grad = ctx.createLinearGradient(pt1.x, pt1.y, pt2.x, pt2.y);
          grad.addColorStop(0, themes[eng.currentTheme](eng.time, idx, 5));
          grad.addColorStop(0.5, themes[eng.currentTheme](eng.time, idx + 1, 5));
          grad.addColorStop(1, themes[eng.currentTheme](eng.time, idx + 2, 5));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 4;
          ctx.shadowBlur = 10;
          ctx.shadowColor = col;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });

        if (h1 && h2) {
          const allTips = FINGER_TIPS.map(t => mapToCanvas(h1[t])).concat(
            FINGER_TIPS.map(t => mapToCanvas(h2[t]))
          );
          ctx.save();
          const cx = allTips.reduce((sum, p) => sum + p.x, 0) / 10;
          const cy = allTips.reduce((sum, p) => sum + p.y, 0) / 10;
          ctx.translate(cx, cy);
          ctx.rotate(eng.time * 0.5);
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const t1 = { x: allTips[i].x - cx, y: allTips[i].y - cy };
            const t2 = { x: allTips[(i + 3) % 10].x - cx, y: allTips[(i + 3) % 10].y - cy };
            ctx.moveTo(t1.x, t1.y);
            ctx.lineTo(t2.x, t2.y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }
      detectGestures();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------
   * MediaPipe init
   * ------------------------------------------------------------------ */
  function initMediaPipe() {
    const eng = engineRef.current;
    const Hands = window.Hands;
    const Camera = window.Camera;
    if (!Hands || !Camera) {
      console.error('MediaPipe scripts not loaded');
      return;
    }

    const hands = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(results => {
      const landmarks = results.multiHandLandmarks || [];
      if (uiHandsRef.current) uiHandsRef.current.textContent = String(landmarks.length);

      if (eng.currentHands.length > 0 && landmarks.length > 0) {
        const oldP = eng.currentHands[0][8];
        const newP = landmarks[0][8];
        if (oldP && newP) eng.handVelocities = getDist(oldP, newP);
      } else {
        eng.handVelocities = 0;
      }

      eng.currentHands = landmarks;
      if (eng.audioCtx && !isFruitNinjaMode()) updateHum(eng.currentHands);
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
      facingMode: 'user',
    });
    camera.start();

    eng.hands = hands;
    eng.camera = camera;
  }

  /* ------------------------------------------------------------------
   * Mount: ResizeObserver. Cleanup: stop everything.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    resize();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && rootRef.current) {
      ro = new ResizeObserver(() => resize());
      ro.observe(rootRef.current);
    } else {
      window.addEventListener('resize', resize);
    }

    return () => {
      const eng = engineRef.current;
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      if (eng.rafId) cancelAnimationFrame(eng.rafId);
      try {
        eng.camera?.stop?.();
      } catch (e) { /* noop */ }
      try {
        eng.hands?.close?.();
      } catch (e) { /* noop */ }
      try {
        if (eng.humOsc) eng.humOsc.stop();
      } catch (e) { /* noop */ }
      try {
        eng.audioCtx?.close();
      } catch (e) { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ninjaMode = currentTheme === 'FruitNinja';

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${ninjaMode ? styles.fnPipMode : ''}`}
    >
      {/* Logout Button */}      
      {started && (
        <LogoutButton/>
      )}

      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={bgCanvasRef} className={styles.bgCanvas} />
        <canvas ref={mainCanvasRef} className={styles.mainCanvas} />
      </div>

      <Hud
        visible={started}
        ninjaMode={ninjaMode}
        handsRef={uiHandsRef}
        fpsRef={uiFpsRef}
        gestureRef={uiGestureRef}
        spreadRef={uiSpreadRef}
        scoreRef={uiScoreRef}
        livesRef={uiLivesRef}
      />

      <ThemeSwitcher
        visible={started}
        current={currentTheme}
        onChange={handleThemeChange}
      />

      <GameOverScreen
        visible={gameOverVisible}
        score={finalScore}
        onRestart={handleRestart}
      />

      <StartOverlay visible={!started} onStart={handleStart} />
    </div>
  );
}
