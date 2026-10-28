"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, Play } from "lucide-react";

// Self-contained Flappy Bird clone for the landing page.
//
// Speed is normalised across displays via a delta-time scalar (dt = 1 at
// 60Hz, 0.5 at 120Hz, etc), so the game feels the same on a 60Hz Android
// and a 120Hz iPhone Pro. All per-frame motion is multiplied by dt.
//
// Input handled with onPointerDown (the unified mouse/touch/stylus event)
// so a single tap fires one flap, not the duplicate (touchstart + click)
// pair the old code generated on iOS Safari.
//
// Difficulty: three presets adjust pipe gap, scroll speed and spawn rate.
// Choice persisted in localStorage as `flappyDifficulty`.

const W = 320;
const H = 420;
const BIRD_X = 80;
const BIRD_R = 12;
const FLAP_V = -7;
const MAX_FALL = 10;
const PIPE_W = 52;
const GROUND_H = 28;

const HIGH_KEY = "flappyHighScore";
const DIFFICULTY_KEY = "flappyDifficulty";

// Per-difficulty physics. Gap = vertical space between top/bottom pipe;
// speed = px/frame at 60Hz; spawn = frames-at-60Hz between pipes.
const DIFFICULTIES = {
  easy: { label: "Easy", PIPE_GAP: 145, PIPE_SPEED: 1.8, PIPE_SPAWN_EVERY: 110, GRAVITY: 0.38 },
  normal: { label: "Normal", PIPE_GAP: 120, PIPE_SPEED: 2.2, PIPE_SPAWN_EVERY: 90, GRAVITY: 0.45 },
  hard: { label: "Hard", PIPE_GAP: 100, PIPE_SPEED: 2.7, PIPE_SPAWN_EVERY: 75, GRAVITY: 0.52 },
};

function makePipe(prevHadOne, gap) {
  const minY = 60;
  const maxY = H - GROUND_H - gap - 60;
  const gapY = Math.floor(minY + Math.random() * (maxY - minY));
  return { x: W + (prevHadOne ? 0 : 40), gapY, passed: false };
}

function initialState() {
  return {
    bird: { y: H / 2, v: 0 },
    pipes: [],
    framesSinceSpawn: 0,
    running: false,
    phase: "ready",
    score: 0,
    lastTime: 0,
  };
}

export default function FlappyBird({ active }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(initialState());
  const rafRef = useRef(0);
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficultyState] = useState("normal");
  // Difficulty held in a ref too so the tick loop reads the current value
  // without needing to re-create the closure every time difficulty changes.
  const difficultyRef = useRef("normal");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedHigh = Number(window.localStorage.getItem(HIGH_KEY)) || 0;
    setHighScore(storedHigh);
    const storedDiff = window.localStorage.getItem(DIFFICULTY_KEY);
    if (storedDiff && DIFFICULTIES[storedDiff]) {
      setDifficultyState(storedDiff);
      difficultyRef.current = storedDiff;
    }
  }, []);

  const setDifficulty = (next) => {
    setDifficultyState(next);
    difficultyRef.current = next;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DIFFICULTY_KEY, next);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const g = gameRef.current;
    const cfg = DIFFICULTIES[difficultyRef.current];

    ctx.fillStyle = "hsl(220 18% 11%)";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "hsl(220 14% 14%)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const p of g.pipes) {
      ctx.fillStyle = "hsl(4 69% 38% / 0.18)";
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
      ctx.strokeStyle = "hsl(4 69% 38% / 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, 0, PIPE_W, p.gapY);
      ctx.fillStyle = "hsl(4 69% 38% / 0.35)";
      ctx.fillRect(p.x - 4, p.gapY - 8, PIPE_W + 8, 8);

      const bY = p.gapY + cfg.PIPE_GAP;
      const bH = H - GROUND_H - bY;
      ctx.fillStyle = "hsl(4 69% 38% / 0.18)";
      ctx.fillRect(p.x, bY, PIPE_W, bH);
      ctx.strokeStyle = "hsl(4 69% 38% / 0.6)";
      ctx.strokeRect(p.x, bY, PIPE_W, bH);
      ctx.fillStyle = "hsl(4 69% 38% / 0.35)";
      ctx.fillRect(p.x - 4, bY, PIPE_W + 8, 8);
    }

    ctx.fillStyle = "hsl(220 14% 16%)";
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.strokeStyle = "hsl(4 69% 38% / 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_H);
    ctx.lineTo(W, H - GROUND_H);
    ctx.stroke();

    const { y, v } = g.bird;
    const angle = Math.max(-0.4, Math.min(0.8, v * 0.06));
    ctx.save();
    ctx.translate(BIRD_X, y);
    ctx.rotate(angle);
    ctx.fillStyle = "hsl(4 69% 38%)";
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "hsl(38 92% 60%)";
    ctx.beginPath();
    ctx.arc(-3, -2, BIRD_R - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(5, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (g.phase === "playing") {
      ctx.fillStyle = "white";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(g.score), W / 2, 44);
    }
  }, []);

  const endGame = useCallback(() => {
    const g = gameRef.current;
    g.running = false;
    g.phase = "over";
    setPhase("over");
    setHighScore((prev) => {
      if (g.score <= prev) return prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIGH_KEY, String(g.score));
      }
      return g.score;
    });
    draw();
  }, [draw]);

  const tick = useCallback(
    (now) => {
      const g = gameRef.current;
      if (!g.running) return;
      const cfg = DIFFICULTIES[difficultyRef.current];

      // Delta-time scaler. dt=1 at 60Hz, 0.5 at 120Hz. Cap at 2.5 so a
      // backgrounded tab returning after seconds doesn't teleport the
      // bird through every pipe at once.
      const last = g.lastTime || now;
      const dt = Math.min(2.5, (now - last) / (1000 / 60));
      g.lastTime = now;

      // Physics (frame-rate independent now)
      g.bird.v = Math.min(MAX_FALL, g.bird.v + cfg.GRAVITY * dt);
      g.bird.y += g.bird.v * dt;

      if (g.bird.y + BIRD_R >= H - GROUND_H || g.bird.y - BIRD_R <= 0) {
        endGame();
        return;
      }

      g.framesSinceSpawn += dt;
      if (g.framesSinceSpawn >= cfg.PIPE_SPAWN_EVERY) {
        g.pipes.push(makePipe(g.pipes.length > 0, cfg.PIPE_GAP));
        g.framesSinceSpawn = 0;
      }

      for (const p of g.pipes) {
        p.x -= cfg.PIPE_SPEED * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          g.score += 1;
          setScore(g.score);
        }
        const inXRange =
          BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
        if (inXRange) {
          const hitTop = g.bird.y - BIRD_R < p.gapY;
          const hitBottom = g.bird.y + BIRD_R > p.gapY + cfg.PIPE_GAP;
          if (hitTop || hitBottom) {
            endGame();
            return;
          }
        }
      }

      g.pipes = g.pipes.filter((p) => p.x + PIPE_W > -10);

      draw();
      rafRef.current = requestAnimationFrame(tick);
    },
    [draw, endGame]
  );

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    gameRef.current = initialState();
    gameRef.current.running = true;
    gameRef.current.phase = "playing";
    setPhase("playing");
    setScore(0);
    gameRef.current.bird.v = FLAP_V;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const flap = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "playing") {
      g.bird.v = FLAP_V;
    } else {
      startGame();
    }
  }, [startGame]);

  // Initial draw, keyboard listener, parent-tab-pause
  useEffect(() => {
    draw();
    const onKey = (e) => {
      if (e.code === "Space" || e.key === " ") {
        if (!active) return;
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw, flap, active]);

  useEffect(() => {
    if (!active && gameRef.current.running) {
      cancelAnimationFrame(rafRef.current);
      gameRef.current.running = false;
      gameRef.current.phase = "over";
      setPhase("over");
    }
  }, [active]);

  // Pointer-down covers mouse, touch and stylus in a single event - no
  // more double-fire when iOS Safari synthesises a click after a tap.
  const onPointerDown = (e) => {
    e.preventDefault();
    flap();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onPointerDown}
          className="rounded-xl border bg-card touch-none select-none"
          aria-label="Flappy Bird playfield"
          role="img"
        />
        {phase === "ready" ? (
          <Overlay>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Flappy</p>
            <p className="mt-1 text-xl font-semibold">Tap to play</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Tap, click, or press space to flap
            </p>
            <button
              onClick={startGame}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          </Overlay>
        ) : null}
        {phase === "over" ? (
          <Overlay>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Game over</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{score}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Best: {Math.max(highScore, score)}
            </p>
            <button
              onClick={startGame}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Play again
            </button>
          </Overlay>
        ) : null}
      </div>

      <DifficultyPicker value={difficulty} onChange={setDifficulty} />

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Score: <span className="font-semibold tabular-nums text-foreground">{score}</span>
        </span>
        <span>
          Best: <span className="font-semibold tabular-nums text-foreground">{highScore}</span>
        </span>
      </div>
    </div>
  );
}

function DifficultyPicker({ value, onChange }) {
  return (
    <div className="inline-flex gap-1 rounded-md border bg-card p-1">
      {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={[
            "rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-center">
      <div className="pointer-events-auto rounded-xl border bg-card/95 p-5 shadow-paper-1">
        {children}
      </div>
    </div>
  );
}
