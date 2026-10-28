"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, Play, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

// Simplified Crossy Road clone for the landing page.
//
// Car speed is normalised across displays via a delta-time scalar so the
// game feels the same on a 60Hz Android and a 120Hz iPhone Pro. Player
// movement is discrete (one cell per input event) so it doesn't need dt.
//
// Tap / swipe / click input handled with onPointerDown + onPointerUp -
// the unified pointer API fires once per gesture instead of the old
// touchstart-plus-click pair that produced double-moves on iOS Safari.
//
// Difficulty: three presets adjust car speed multiplier + spawn density.
// Choice persisted in localStorage as `crossyDifficulty`.

const COLS = 10;
const ROWS = 13;
const CELL = 32;
const W = COLS * CELL; // 320
const H = ROWS * CELL; // 416

const HIGH_KEY = "crossyHighScore";
const DIFFICULTY_KEY = "crossyDifficulty";

const DIFFICULTIES = {
  easy: { label: "Easy", speedMul: 0.65, carDensity: 0.35 },
  normal: { label: "Normal", speedMul: 1.0, carDensity: 0.5 },
  hard: { label: "Hard", speedMul: 1.5, carDensity: 0.7 },
};

function generateLanes(diff) {
  const cfg = DIFFICULTIES[diff] ?? DIFFICULTIES.normal;
  const lanes = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === 0 || r === ROWS - 1) {
      lanes.push({ type: "grass", cars: [] });
      continue;
    }
    const isRoad = r % 2 === 0 ? Math.random() > 0.4 : Math.random() > 0.7;
    if (!isRoad) {
      lanes.push({ type: "grass", cars: [] });
      continue;
    }
    const direction = Math.random() > 0.5 ? 1 : -1;
    const speed = (0.6 + Math.random() * 1.0) * cfg.speedMul;
    // Density determines whether the lane has 1 or 2 cars.
    const count = Math.random() < cfg.carDensity ? 2 : 1;
    const cars = [];
    for (let i = 0; i < count; i++) {
      cars.push({
        x: (W / count) * i + Math.random() * 40,
        w: 2 * CELL,
      });
    }
    lanes.push({ type: "road", cars, direction, speed });
  }
  return lanes;
}

function initialState(diff) {
  return {
    player: { col: Math.floor(COLS / 2), row: ROWS - 1 },
    lanes: generateLanes(diff),
    running: false,
    phase: "ready",
    score: 0,
    completedRuns: 0,
    lastTime: 0,
  };
}

export default function CrossyRoad({ active }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(initialState("normal"));
  const rafRef = useRef(0);
  const pointerStartRef = useRef(null);
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficultyState] = useState("normal");
  const difficultyRef = useRef("normal");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedHigh = Number(window.localStorage.getItem(HIGH_KEY)) || 0;
    setHighScore(storedHigh);
    const storedDiff = window.localStorage.getItem(DIFFICULTY_KEY);
    if (storedDiff && DIFFICULTIES[storedDiff]) {
      setDifficultyState(storedDiff);
      difficultyRef.current = storedDiff;
      gameRef.current = initialState(storedDiff);
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

    for (let r = 0; r < ROWS; r++) {
      const lane = g.lanes[r];
      const y = r * CELL;
      if (lane.type === "grass") {
        ctx.fillStyle = "hsl(158 30% 14%)";
        ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = "hsl(158 40% 22%)";
        for (let i = 0; i < 6; i++) {
          const sx = (i * 53 + r * 17) % W;
          ctx.fillRect(sx, y + (i % 2) * 8 + 4, 3, 3);
        }
      } else {
        ctx.fillStyle = "hsl(220 14% 14%)";
        ctx.fillRect(0, y, W, CELL);
        ctx.strokeStyle = "hsl(220 14% 24%)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, y + CELL / 2);
        ctx.lineTo(W, y + CELL / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.fillStyle = "hsl(4 69% 38% / 0.18)";
    ctx.fillRect(0, 0, W, CELL);
    ctx.strokeStyle = "hsl(4 69% 38% / 0.5)";
    ctx.strokeRect(0, 0, W, CELL);

    for (let r = 0; r < ROWS; r++) {
      const lane = g.lanes[r];
      if (lane.type !== "road") continue;
      const y = r * CELL + 4;
      for (const car of lane.cars) {
        ctx.fillStyle = "hsl(0 75% 60%)";
        roundRect(ctx, car.x, y, car.w, CELL - 8, 5);
        ctx.fill();
        ctx.fillStyle = "hsl(38 92% 70%)";
        const lightX = lane.direction > 0 ? car.x + car.w - 5 : car.x + 1;
        ctx.fillRect(lightX, y + 4, 4, 6);
        ctx.fillRect(lightX, y + CELL - 18, 4, 6);
      }
    }

    const px = g.player.col * CELL + 4;
    const py = g.player.row * CELL + 4;
    ctx.fillStyle = "hsl(4 69% 38%)";
    roundRect(ctx, px, py, CELL - 8, CELL - 8, 6);
    ctx.fill();
    ctx.fillStyle = "hsl(38 92% 60%)";
    roundRect(ctx, px + 4, py + 4, CELL - 16, CELL - 16, 4);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.fillRect(px + 8, py + 10, 3, 3);
    ctx.fillRect(px + CELL - 16, py + 10, 3, 3);

    if (g.phase === "playing") {
      ctx.fillStyle = "white";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(g.score), W / 2, 22);
    }
  }, []);

  const checkCollision = useCallback(() => {
    const g = gameRef.current;
    const lane = g.lanes[g.player.row];
    if (lane.type !== "road") return false;
    const px = g.player.col * CELL + 4;
    const py = g.player.row * CELL + 4;
    const pw = CELL - 8;
    const ph = CELL - 8;
    for (const car of lane.cars) {
      const cx = car.x;
      const cy = g.player.row * CELL + 4;
      const cw = car.w;
      const ch = CELL - 8;
      if (px < cx + cw && px + pw > cx && py < cy + ch && py + ph > cy) {
        return true;
      }
    }
    return false;
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

      // Delta-time scaler. dt=1 at 60Hz, 0.5 at 120Hz. Cap at 2.5.
      const last = g.lastTime || now;
      const dt = Math.min(2.5, (now - last) / (1000 / 60));
      g.lastTime = now;

      for (const lane of g.lanes) {
        if (lane.type !== "road") continue;
        for (const car of lane.cars) {
          car.x += lane.direction * lane.speed * dt;
          if (lane.direction > 0 && car.x > W) car.x = -car.w;
          if (lane.direction < 0 && car.x + car.w < 0) car.x = W;
        }
      }

      if (checkCollision()) {
        endGame();
        return;
      }

      draw();
      rafRef.current = requestAnimationFrame(tick);
    },
    [draw, checkCollision, endGame]
  );

  const move = useCallback(
    (dx, dy) => {
      const g = gameRef.current;
      if (g.phase !== "playing") return;
      const nextCol = Math.max(0, Math.min(COLS - 1, g.player.col + dx));
      const nextRow = Math.max(0, Math.min(ROWS - 1, g.player.row + dy));
      g.player.col = nextCol;
      g.player.row = nextRow;
      const rowsAdvanced =
        g.completedRuns * (ROWS - 1) + (ROWS - 1 - g.player.row);
      if (rowsAdvanced > g.score) {
        g.score = rowsAdvanced;
        setScore(rowsAdvanced);
      }
      if (g.player.row === 0) {
        g.completedRuns += 1;
        g.player.row = ROWS - 1;
        g.lanes = generateLanes(difficultyRef.current);
      }
      if (checkCollision()) {
        endGame();
        return;
      }
      draw();
    },
    [checkCollision, draw, endGame]
  );

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    gameRef.current = initialState(difficultyRef.current);
    gameRef.current.running = true;
    gameRef.current.phase = "playing";
    setPhase("playing");
    setScore(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    draw();
    const onKey = (e) => {
      if (!active) return;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          if (gameRef.current.phase === "playing") move(0, -1);
          else startGame();
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          move(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(1, 0);
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw, move, startGame, active]);

  useEffect(() => {
    if (!active && gameRef.current.running) {
      cancelAnimationFrame(rafRef.current);
      gameRef.current.running = false;
      gameRef.current.phase = "over";
      setPhase("over");
    }
  }, [active]);

  // Pointer events for tap + swipe. pointerdown records start; pointerup
  // calculates the delta to decide tap (move up) vs swipe (direction).
  // This replaces the previous touch+click pair that double-fired on
  // iOS Safari for a single tap.
  const onPointerDown = (e) => {
    e.preventDefault();
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    if (gameRef.current.phase !== "playing") {
      startGame();
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const min = 18;
    if (Math.abs(dx) < min && Math.abs(dy) < min) {
      move(0, -1);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1, 0);
    } else {
      move(0, dy > 0 ? 1 : -1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="rounded-xl border bg-card touch-none select-none"
          aria-label="Crossy Road playfield"
          role="img"
        />
        {phase === "ready" ? (
          <Overlay>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Crossy</p>
            <p className="mt-1 text-xl font-semibold">Cross the road</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Arrows / WASD on desktop, swipe or tap to move up on phone
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Squished</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{score}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              rows · Best: {Math.max(highScore, score)}
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

      <div className="grid grid-cols-3 gap-1 sm:hidden" aria-hidden="true">
        <span />
        <button
          type="button"
          onClick={() => move(0, -1)}
          className="rounded-md border bg-card p-2 text-foreground active:bg-primary active:text-primary-foreground"
          aria-label="Up"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => move(-1, 0)}
          className="rounded-md border bg-card p-2 text-foreground active:bg-primary active:text-primary-foreground"
          aria-label="Left"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => move(0, 1)}
          className="rounded-md border bg-card p-2 text-foreground active:bg-primary active:text-primary-foreground"
          aria-label="Down"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => move(1, 0)}
          className="rounded-md border bg-card p-2 text-foreground active:bg-primary active:text-primary-foreground"
          aria-label="Right"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function Overlay({ children }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-center">
      <div className="pointer-events-auto rounded-xl border bg-card p-5 shadow-paper-1">
        {children}
      </div>
    </div>
  );
}
