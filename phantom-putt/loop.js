// loop.js — game state, hole catalogue, physics, render. The single
// imperative-loop file for this canvas-game (controls and verdicts split off
// into their own modules so a future bug-fix can target one concern).

import { TiltControls } from "./controls.js";

// ─── world constants (logical pixels) ──────────────────────────────────────
const W = 480;
const H = 640;
const BALL_R = 9;
const HOLE_R = 15;
const FRICTION = 0.984;          // per-frame decay (tuned at 60fps)
const REST_THRESHOLD = 0.15;     // |v| below this counts as "stopped"
const REST_FRAMES = 22;          // sustained-rest frames before atRest=true
const WAKE_THRESHOLD = 0.35;     // |v| above this from rest = new stroke
const WALL_BOUNCE = 0.62;        // velocity damping on wall collision
const SUNK_VELOCITY_MAX = 2.4;   // ball must be slow enough to drop in cup

// ─── hole catalogue ────────────────────────────────────────────────────────
// Each hole is a small json: name, par, tee, hole, list of wall segments.
// Coordinates are logical (480x640). Walls are line segments [x1,y1,x2,y2].
// Designed so the canvas border closes the play area; no fully-enclosed
// regions around tee/hole.
const HOLES = [
  { name: "The Straightaway", par: 2, tee: [240, 90], hole: [240, 560], walls: [] },

  { name: "Crooked Lane", par: 3, tee: [80, 90], hole: [400, 560], walls: [
    [0, 240, 360, 240], [120, 400, 480, 400]
  ]},

  { name: "The Pinch", par: 3, tee: [240, 90], hole: [240, 560], walls: [
    [0, 320, 200, 320], [280, 320, 480, 320]
  ]},

  { name: "S-Bend", par: 4, tee: [240, 90], hole: [240, 560], walls: [
    [120, 200, 480, 200], [0, 340, 360, 340], [120, 480, 480, 480]
  ]},

  { name: "Diagonal Drift", par: 3, tee: [80, 90], hole: [400, 560], walls: [
    [80, 240, 400, 460]
  ]},

  { name: "Bumper Pen", par: 3, tee: [240, 90], hole: [240, 560], walls: [
    [60, 240, 200, 380], [420, 240, 280, 380]
  ]},

  { name: "The Letterbox", par: 3, tee: [240, 90], hole: [240, 560], walls: [
    [0, 320, 180, 320], [300, 320, 480, 320]
  ]},

  { name: "The Funnel", par: 2, tee: [240, 90], hole: [240, 580], walls: [
    [60, 380, 200, 540], [420, 380, 280, 540]
  ]},

  { name: "Pinball Alley", par: 4, tee: [240, 90], hole: [240, 560], walls: [
    [120, 220, 200, 260], [280, 220, 360, 260],
    [80, 380, 160, 420], [320, 380, 400, 420]
  ]},

  { name: "L-Turn", par: 3, tee: [80, 90], hole: [400, 560], walls: [
    [240, 0, 240, 380], [240, 380, 480, 380]
  ]},

  { name: "Snake Path", par: 5, tee: [240, 90], hole: [240, 560], walls: [
    [0, 200, 360, 200], [120, 320, 480, 320], [0, 440, 360, 440]
  ]},

  { name: "Double Hatch", par: 4, tee: [240, 90], hole: [240, 580], walls: [
    [0, 240, 180, 240], [300, 240, 480, 240],
    [0, 420, 280, 420], [380, 420, 480, 420]
  ]},

  { name: "Dogleg Right", par: 3, tee: [80, 90], hole: [80, 560], walls: [
    [200, 0, 200, 460]
  ]},

  { name: "Two Towers", par: 3, tee: [240, 90], hole: [240, 580], walls: [
    [160, 220, 160, 480], [320, 160, 320, 420]
  ]},

  { name: "The Wedge", par: 3, tee: [80, 90], hole: [400, 560], walls: [
    [80, 280, 280, 280], [280, 280, 280, 480]
  ]},
];

// ─── daily seeding ─────────────────────────────────────────────────────────
// Hole rotates by UTC day so it's the same hole for everyone today.
function utcDayIndex() {
  return Math.floor(Date.now() / 86400000);
}

const LAUNCH_DAY = 20576; // 2026-05-03 UTC — Hole #1

export function todaysHole() {
  const day = utcDayIndex();
  const dayNumber = day - LAUNCH_DAY + 1;
  const layout = HOLES[((day % HOLES.length) + HOLES.length) % HOLES.length];
  return { layout, dayNumber };
}

// ─── canvas / state ───────────────────────────────────────────────────────
export class Course {
  constructor(canvas, layout, onSunk) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.layout = layout;
    this.onSunk = onSunk;
    this.controls = new TiltControls();

    this.ball = { x: layout.tee[0], y: layout.tee[1], vx: 0, vy: 0 };
    this.atRest = true;
    this.restCount = REST_FRAMES;
    this.strokes = 0;
    this.distances = [];        // per-stroke distance for the share grid
    this._currentStrokeDist = 0;
    this.sunk = false;
    this.sunkAt = 0;
    this._lastT = 0;
    this._raf = 0;
    this._running = false;

    this._sizeCanvas();
    this._resizeObs = new ResizeObserver(() => this._sizeCanvas());
    this._resizeObs.observe(canvas);
  }

  _sizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    // Logical drawing surface: scale so 1 unit == 1 logical px.
    this._scale = (rect.width * dpr) / W;
    this.ctx.setTransform(this._scale, 0, 0, this._scale, 0, 0);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastT = performance.now();
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._resizeObs.disconnect();
  }

  attachDesktopControls(boardEl) {
    this.controls.attachDesktop(boardEl);
  }

  async attachOrientation() {
    return this.controls.attachOrientation();
  }

  // ─── physics ────────────────────────────────────────────────────────────
  _tick(now) {
    const dtMs = Math.min(now - this._lastT, 50);   // cap dt for tab-resume
    this._lastT = now;
    const steps = Math.max(1, Math.round(dtMs / (1000 / 60)));
    for (let i = 0; i < steps; i++) this._step();
    this._render();
    if (this._running) this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  _step() {
    if (this.sunk) return;

    const b = this.ball;
    const g = this.controls.gravity;

    b.vx += g.x;
    b.vy += g.y;
    b.vx *= FRICTION;
    b.vy *= FRICTION;

    // tentative move
    let nx = b.x + b.vx;
    let ny = b.y + b.vy;

    // wall (segment) collisions
    for (const wall of this.layout.walls) {
      const [x1, y1, x2, y2] = wall;
      const hit = circleSegmentHit(nx, ny, BALL_R, x1, y1, x2, y2);
      if (hit) {
        // push out + reflect velocity along normal
        nx = hit.px + hit.nx * BALL_R;
        ny = hit.py + hit.ny * BALL_R;
        const dot = b.vx * hit.nx + b.vy * hit.ny;
        b.vx = (b.vx - 2 * dot * hit.nx) * WALL_BOUNCE;
        b.vy = (b.vy - 2 * dot * hit.ny) * WALL_BOUNCE;
      }
    }

    // canvas border collisions
    if (nx < BALL_R) { nx = BALL_R; b.vx = -b.vx * WALL_BOUNCE; }
    if (nx > W - BALL_R) { nx = W - BALL_R; b.vx = -b.vx * WALL_BOUNCE; }
    if (ny < BALL_R) { ny = BALL_R; b.vy = -b.vy * WALL_BOUNCE; }
    if (ny > H - BALL_R) { ny = H - BALL_R; b.vy = -b.vy * WALL_BOUNCE; }

    const dx = nx - b.x;
    const dy = ny - b.y;
    b.x = nx;
    b.y = ny;

    // accumulate distance for the in-progress stroke
    if (!this.atRest) this._currentStrokeDist += Math.hypot(dx, dy);

    // hole-sunk check (must be slow enough to drop in)
    const hx = this.layout.hole[0], hy = this.layout.hole[1];
    const distToHole = Math.hypot(b.x - hx, b.y - hy);
    const speed = Math.hypot(b.vx, b.vy);
    if (distToHole < HOLE_R - 2 && speed < SUNK_VELOCITY_MAX) {
      this._sink();
      return;
    }

    // stroke book-keeping based on motion / rest state
    if (speed < REST_THRESHOLD) {
      this.restCount += 1;
      if (this.restCount >= REST_FRAMES && !this.atRest) {
        this.atRest = true;
        // commit the stroke distance
        if (this._currentStrokeDist > 0) {
          // already counted strokes++ at wake; just push the distance
        }
      }
    } else {
      // speed is non-trivial
      if (this.atRest && speed > WAKE_THRESHOLD) {
        // wake — new stroke begins
        this.atRest = false;
        this.restCount = 0;
        this.strokes += 1;
        this.distances.push(0); // placeholder, will fill at rest
        this._currentStrokeDist = 0;
      }
      // While moving, keep the in-progress distance current at the tail.
      if (!this.atRest && this.distances.length > 0) {
        this.distances[this.distances.length - 1] = this._currentStrokeDist;
      }
      // small motions don't reset rest count back to 0; only awake does
      if (!this.atRest) this.restCount = 0;
    }
  }

  _sink() {
    this.sunk = true;
    this.sunkAt = performance.now();
    // ensure the sinking stroke is recorded and counted
    if (this.strokes === 0) {
      // sank without registering a wake (extreme edge case) — record one
      this.strokes = 1;
      this.distances.push(this._currentStrokeDist);
    } else if (this.distances.length < this.strokes) {
      this.distances.push(this._currentStrokeDist);
    } else {
      this.distances[this.distances.length - 1] = this._currentStrokeDist;
    }
    // Brief celebratory delay before firing onSunk so the player sees the
    // ball drop. Page-level result card slides up after.
    const callback = this.onSunk;
    setTimeout(() => callback && callback({
      strokes: this.strokes,
      distances: this.distances.slice()
    }), 850);
  }

  // ─── render ─────────────────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    drawPaper(ctx);
    drawGrid(ctx);
    for (const w of this.layout.walls) drawWall(ctx, w);
    drawTee(ctx, this.layout.tee);
    drawHole(ctx, this.layout.hole);
    drawBall(ctx, this.ball, this.sunk);
    if (this.sunk) drawSunkStamp(ctx, this.layout.hole);

    ctx.restore();
  }
}

// ─── geometry ──────────────────────────────────────────────────────────────
// Closest point on segment to (cx,cy); if within r, return push-out info.
function circleSegmentHit(cx, cy, r, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const ddx = cx - px, ddy = cy - py;
  const dist = Math.hypot(ddx, ddy);
  if (dist >= r) return null;
  // normal away from segment toward circle center; degenerate case picks
  // the perpendicular to the segment.
  let nx, ny;
  if (dist > 0.0001) { nx = ddx / dist; ny = ddy / dist; }
  else {
    const segLen = Math.sqrt(lenSq) || 1;
    nx = -dy / segLen; ny = dx / segLen;
  }
  return { px, py, nx, ny, dist };
}

// ─── drawing helpers ───────────────────────────────────────────────────────
const INK = "#1c2a4a";
const INK_SOFT = "#2c3b62";
const RED = "#b53028";
const PAPER = "#f6efd8";
const GRID_THIN = "rgba(64, 109, 156, 0.22)";
const GRID_THICK = "rgba(64, 109, 156, 0.40)";

function drawPaper(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
}

function drawGrid(ctx) {
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = GRID_THIN;
  ctx.beginPath();
  for (let x = 20; x < W; x += 20) {
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let y = 20; y < H; y += 20) {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = GRID_THICK;
  ctx.beginPath();
  for (let x = 100; x < W; x += 100) {
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let y = 100; y < H; y += 100) {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();
}

// Wobbly-pen line: subdivide segment and jitter each midpoint slightly so
// the wall reads as hand-drawn, not laser-printed.
function drawWall(ctx, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const segs = Math.max(2, Math.round(len / 24));
  const seed = (x1 * 13 + y1 * 7 + x2 * 11 + y2 * 5) | 0;
  let s = seed;
  function nextNoise() {
    s = (s * 9301 + 49297) & 0x7fffffff;
    return ((s % 1000) / 1000) - 0.5;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // pen wobble
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const px = x1 + dx * t + nextNoise() * 1.6;
    const py = y1 + dy * t + nextNoise() * 1.6;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // a thin inner highlight for ink-bleed feel
  ctx.strokeStyle = "rgba(28, 42, 74, 0.35)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawTee(ctx, [x, y]) {
  ctx.save();
  ctx.translate(x, y);
  // small "T" pen mark, rotated slightly for hand-drawn feel
  ctx.rotate(-0.06);
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-12, -16); ctx.lineTo(12, -16);
  ctx.moveTo(0, -16); ctx.lineTo(0, 8);
  ctx.stroke();
  // dotted circle around tee
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHole(ctx, [x, y]) {
  // outer pen ring
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, HOLE_R + 2, 0, Math.PI * 2);
  ctx.stroke();
  // inner cup — black hole
  ctx.fillStyle = "#0c1428";
  ctx.beginPath();
  ctx.arc(0, 0, HOLE_R, 0, Math.PI * 2);
  ctx.fill();
  // cross-hatch shading inside
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, HOLE_R - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = -HOLE_R; i <= HOLE_R; i += 3) {
    ctx.moveTo(i, -HOLE_R); ctx.lineTo(i + HOLE_R, HOLE_R);
  }
  ctx.stroke();
  ctx.restore();
  // little flag-stick sketch above
  ctx.strokeStyle = RED;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -HOLE_R - 2);
  ctx.lineTo(2, -HOLE_R - 22);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(2, -HOLE_R - 22);
  ctx.lineTo(14, -HOLE_R - 18);
  ctx.lineTo(2, -HOLE_R - 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx, ball, sunk) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  // soft shadow
  ctx.fillStyle = "rgba(28, 42, 74, 0.22)";
  ctx.beginPath();
  ctx.ellipse(2, 3, BALL_R - 1, BALL_R * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // ball — ink-filled circle with pen-line ring
  ctx.fillStyle = sunk ? "#0c1428" : "#fafbff";
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // tiny dimple stippling for hand-drawn feel
  if (!sunk) {
    ctx.fillStyle = "rgba(28, 42, 74, 0.45)";
    ctx.beginPath();
    ctx.arc(-2.2, -2.4, 0.9, 0, Math.PI * 2);
    ctx.arc(2.4, -1.4, 0.9, 0, Math.PI * 2);
    ctx.arc(0.2, 2.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSunkStamp(ctx, [x, y]) {
  ctx.save();
  ctx.translate(x, y - 40);
  ctx.rotate(-0.12);
  ctx.font = "bold 22px 'Architects Daughter', cursive";
  ctx.fillStyle = RED;
  ctx.strokeStyle = "rgba(181, 48, 40, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.textAlign = "center";
  ctx.fillText("SUNK!", 0, 0);
  // little box around it like a stamp
  ctx.beginPath();
  ctx.rect(-44, -22, 88, 30);
  ctx.stroke();
  ctx.restore();
}
