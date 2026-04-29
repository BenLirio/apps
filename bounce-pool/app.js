// Bounce Pool — daily one-shot pool puzzle
// All physics deterministic. Trajectory preview up to 3 bounces. 14 curated levels cycled by date.

// ---------- Logical table coordinate system ----------
// The canvas renders at any pixel size; physics uses a 600x800 virtual table.
const TW = 600; // table width  (virtual units)
const TH = 800; // table height (virtual units)
const CUE_R = 14;      // cue ball radius
const TARGET_R = 16;   // target radius
const BUMPER_R = 28;   // circular bumper radius
const MAX_POWER = 22;  // max launch speed (virtual units / step)
const FRICTION = 0.992;
const STOP_SPEED = 0.06;
const DT = 1; // fixed step; physics uses integer-ish virtual units

// ---------- 14 curated levels ----------
// Each level has: cue start, 5 targets, and optional rectangular walls + circular bumpers (beyond outer rails).
// Levels are designed to be solvable within par (3) with visible ricochets, but clearable in 1-2 for clever lines.
const LEVELS = [
  // 1: gentle intro — targets clustered top, simple direct line
  {
    cue: [300, 700],
    targets: [[220, 280], [300, 240], [380, 280], [260, 340], [340, 340]],
    walls: [], bumpers: []
  },
  // 2: corridor walls — must squeeze between
  {
    cue: [300, 720],
    targets: [[180, 160], [300, 120], [420, 160], [200, 440], [400, 440]],
    walls: [[260, 300, 80, 20], [260, 540, 80, 20]], bumpers: []
  },
  // 3: central bumper — must bank around
  {
    cue: [300, 700],
    targets: [[120, 200], [480, 200], [120, 400], [480, 400], [300, 120]],
    walls: [], bumpers: [[300, 420]]
  },
  // 4: two bumpers — ricochet needed
  {
    cue: [120, 720],
    targets: [[480, 200], [440, 360], [520, 520], [380, 140], [240, 180]],
    walls: [], bumpers: [[200, 440], [400, 520]]
  },
  // 5: diagonal wall
  {
    cue: [300, 740],
    targets: [[140, 180], [260, 160], [380, 180], [460, 320], [140, 440]],
    walls: [[380, 420, 140, 20]], bumpers: []
  },
  // 6: pocket cluster — linear blast
  {
    cue: [540, 700],
    targets: [[80, 160], [160, 120], [240, 160], [80, 240], [160, 240]],
    walls: [], bumpers: [[360, 400]]
  },
  // 7: goalie bumper
  {
    cue: [300, 720],
    targets: [[120, 140], [300, 100], [480, 140], [180, 300], [420, 300]],
    walls: [], bumpers: [[300, 500]]
  },
  // 8: zig walls
  {
    cue: [80, 720],
    targets: [[520, 140], [460, 260], [400, 380], [340, 500], [280, 620]],
    walls: [[160, 600, 20, 80], [440, 380, 20, 80]], bumpers: []
  },
  // 9: four corners plus center
  {
    cue: [300, 700],
    targets: [[100, 120], [500, 120], [100, 480], [500, 480], [300, 300]],
    walls: [], bumpers: [[300, 600]]
  },
  // 10: narrow gate
  {
    cue: [300, 740],
    targets: [[300, 200], [180, 280], [420, 280], [220, 160], [380, 160]],
    walls: [[100, 440, 180, 20], [320, 440, 180, 20]], bumpers: []
  },
  // 11: deflector bumper near cue
  {
    cue: [160, 700],
    targets: [[460, 180], [380, 260], [500, 340], [260, 140], [340, 420]],
    walls: [], bumpers: [[260, 560]]
  },
  // 12: sandwich walls
  {
    cue: [300, 720],
    targets: [[300, 140], [160, 260], [440, 260], [160, 500], [440, 500]],
    walls: [[260, 380, 80, 20]], bumpers: []
  },
  // 13: far-wall blast
  {
    cue: [300, 700],
    targets: [[120, 160], [220, 120], [380, 120], [480, 160], [300, 260]],
    walls: [], bumpers: [[200, 480], [400, 480]]
  },
  // 14: finale — two bumpers + wall
  {
    cue: [120, 720],
    targets: [[500, 120], [400, 200], [500, 300], [300, 140], [440, 420]],
    walls: [[160, 400, 20, 120]], bumpers: [[320, 560]]
  }
];

// ---------- Deterministic daily level selection ----------
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dateSeed(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const DAY_KEY = todayKey();
const LEVEL_INDEX = dateSeed(DAY_KEY) % LEVELS.length;
const LEVEL = JSON.parse(JSON.stringify(LEVELS[LEVEL_INDEX]));
const PAR = 3;

// ---------- State ----------
const state = {
  cue: { x: LEVEL.cue[0], y: LEVEL.cue[1], vx: 0, vy: 0, alive: true },
  targets: LEVEL.targets.map(([x, y]) => ({ x, y, alive: true })),
  walls: LEVEL.walls.map(([x, y, w, h]) => ({ x, y, w, h })),
  bumpers: LEVEL.bumpers.map(([x, y]) => ({ x, y })),
  shots: 0,
  aiming: false,
  aimStart: null,
  aimEnd: null,
  moving: false,
  finished: false,
  shotTrail: [],     // hits per shot, for share grid (T=target, W=wall, R=rail, B=bumper, .=miss)
  currentShotHits: '',
};

// ---------- DOM ----------
const canvas = document.getElementById('felt');
const ctx = canvas.getContext('2d');
const hudDate = document.getElementById('hud-date');
const hudShots = document.getElementById('hud-shots');
const hudTargets = document.getElementById('hud-targets');
const statusEl = document.getElementById('status');
const prelude = document.getElementById('prelude');
const blocker = document.getElementById('blocker');
const resetBtn = document.getElementById('reset-btn');
const resultEl = document.getElementById('result');
const resultVerdict = document.getElementById('result-verdict');
const resultShots = document.getElementById('result-shots');
const resultGrid = document.getElementById('result-grid');
const replayBtn = document.getElementById('replay-btn');

hudDate.textContent = `DAY ${DAY_KEY.slice(5)}`;
updateHUD();

// ---------- Canvas sizing (HiDPI, keep virtual 600x800) ----------
function resize() {
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  draw();
}
window.addEventListener('resize', resize);

// Map a DOM pixel event to virtual table coordinates
function eventToTable(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  return { x: px * TW, y: py * TH };
}

// ---------- Drawing ----------
function scale() {
  // virtual -> canvas pixels
  return { sx: canvas.width / TW, sy: canvas.height / TH };
}

function draw() {
  const { sx, sy } = scale();
  ctx.save();
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.clearRect(0, 0, TW, TH);

  // subtle felt weave
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < TW; i += 14) {
    ctx.fillRect(i, 0, 1, TH);
  }

  // rails — thin cream line
  ctx.strokeStyle = 'rgba(245,236,210,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, TW - 6, TH - 6);

  // walls
  ctx.fillStyle = '#6b3a12';
  for (const w of state.walls) {
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  // bumpers — circular
  for (const b of state.bumpers) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BUMPER_R, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(b.x - 6, b.y - 6, 4, b.x, b.y, BUMPER_R);
    grad.addColorStop(0, '#f5ecd2');
    grad.addColorStop(0.6, '#c88c3c');
    grad.addColorStop(1, '#6b3a12');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // targets
  for (const t of state.targets) {
    if (!t.alive) continue;
    ctx.beginPath();
    ctx.arc(t.x, t.y, TARGET_R, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(t.x - 4, t.y - 4, 2, t.x, t.y, TARGET_R);
    grad.addColorStop(0, '#ffeaa0');
    grad.addColorStop(0.7, '#f0c244');
    grad.addColorStop(1, '#8a6b10');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#0b1f14';
    ctx.lineWidth = 2;
    ctx.stroke();
    // center dot
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1f14';
    ctx.fill();
  }

  // trajectory preview (only while aiming)
  if (state.aiming && state.aimStart && state.aimEnd) {
    const { vx, vy } = aimToVelocity(state.aimStart, state.aimEnd);
    if (vx !== 0 || vy !== 0) {
      const pts = predictPath({ x: state.cue.x, y: state.cue.y, vx, vy }, 3);
      drawTrajectory(pts);
    }
  }

  // cue ball
  if (state.cue.alive) {
    ctx.beginPath();
    ctx.arc(state.cue.x, state.cue.y, CUE_R, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      state.cue.x - 5, state.cue.y - 6, 2,
      state.cue.x, state.cue.y, CUE_R
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.8, '#e8e0c4');
    grad.addColorStop(1, '#9a906a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#0b1f14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // aim arrow from cue
  if (state.aiming && state.aimEnd) {
    const dx = state.aimEnd.x - state.cue.x;
    const dy = state.aimEnd.y - state.cue.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const ux = dx / dist, uy = dy / dist;
      // power indicator
      const powerRatio = Math.min(1, dist / 200);
      ctx.strokeStyle = `rgba(240,194,68,${0.35 + 0.5 * powerRatio})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(state.cue.x - ux * (CUE_R + 2), state.cue.y - uy * (CUE_R + 2));
      ctx.lineTo(state.cue.x - ux * (CUE_R + 2 + 30 * powerRatio), state.cue.y - uy * (CUE_R + 2 + 30 * powerRatio));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTrajectory(pts) {
  if (pts.length < 2) return;
  ctx.save();
  // dotted line preview
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(245,236,210,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // mark each bounce point
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f0c244';
    ctx.fill();
    ctx.strokeStyle = '#0b1f14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // terminal arrowhead at end
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const a = Math.atan2(last.y - prev.y, last.x - prev.x);
  ctx.translate(last.x, last.y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(245,236,210,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- Aim -> velocity ----------
function aimToVelocity(start, end) {
  // Pull-back style: drag away from cue, release shoots opposite direction
  const dx = state.cue.x - end.x;
  const dy = state.cue.y - end.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { vx: 0, vy: 0 };
  const power = Math.min(1, dist / 200);
  const speed = power * MAX_POWER;
  const ux = dx / dist, uy = dy / dist;
  return { vx: ux * speed, vy: uy * speed };
}

// ---------- Deterministic physics stepping ----------
// Step the ball forward by `maxSteps`, resolving wall/bumper/target collisions.
// Returns the array of points along its path plus hit log.
function simulate(ball, maxBounces, maxSteps, consumeTargets) {
  const path = [{ x: ball.x, y: ball.y }];
  let bounces = 0;
  let steps = 0;
  const targetsSnapshot = state.targets.map(t => ({ ...t }));
  const hits = [];
  let b = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
  while (steps < maxSteps && bounces <= maxBounces) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < STOP_SPEED) break;
    // advance
    b.x += b.vx;
    b.y += b.vy;
    // friction
    b.vx *= FRICTION;
    b.vy *= FRICTION;

    // Rails
    let railHit = false;
    if (b.x - CUE_R < 0) { b.x = CUE_R; b.vx = -b.vx; railHit = true; }
    if (b.x + CUE_R > TW) { b.x = TW - CUE_R; b.vx = -b.vx; railHit = true; }
    if (b.y - CUE_R < 0) { b.y = CUE_R; b.vy = -b.vy; railHit = true; }
    if (b.y + CUE_R > TH) { b.y = TH - CUE_R; b.vy = -b.vy; railHit = true; }
    if (railHit) {
      bounces++;
      path.push({ x: b.x, y: b.y });
      hits.push('R');
      if (bounces > maxBounces) break;
    }

    // Walls (AABB vs circle)
    for (const w of state.walls) {
      const nx = Math.max(w.x, Math.min(b.x, w.x + w.w));
      const ny = Math.max(w.y, Math.min(b.y, w.y + w.h));
      const dx = b.x - nx;
      const dy = b.y - ny;
      const d = Math.hypot(dx, dy);
      if (d < CUE_R) {
        // push out along normal
        let nXn, nYn;
        if (d === 0) {
          // inside — use dominant axis
          const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
          const rx = (b.x - cx) / (w.w / 2);
          const ry = (b.y - cy) / (w.h / 2);
          if (Math.abs(rx) > Math.abs(ry)) { nXn = Math.sign(rx) || 1; nYn = 0; }
          else { nXn = 0; nYn = Math.sign(ry) || 1; }
        } else {
          nXn = dx / d;
          nYn = dy / d;
        }
        // separate
        b.x = nx + nXn * CUE_R;
        b.y = ny + nYn * CUE_R;
        // reflect
        const dot = b.vx * nXn + b.vy * nYn;
        b.vx -= 2 * dot * nXn;
        b.vy -= 2 * dot * nYn;
        bounces++;
        path.push({ x: b.x, y: b.y });
        hits.push('W');
        if (bounces > maxBounces) break;
      }
    }
    if (bounces > maxBounces) break;

    // Bumpers (circle vs circle)
    for (const bu of state.bumpers) {
      const dx = b.x - bu.x;
      const dy = b.y - bu.y;
      const d = Math.hypot(dx, dy);
      const rr = CUE_R + BUMPER_R;
      if (d < rr && d > 0) {
        const nxn = dx / d, nyn = dy / d;
        b.x = bu.x + nxn * rr;
        b.y = bu.y + nyn * rr;
        const dot = b.vx * nxn + b.vy * nyn;
        b.vx -= 2 * dot * nxn;
        b.vy -= 2 * dot * nyn;
        // slight boost — bumpers should feel springy
        b.vx *= 1.02;
        b.vy *= 1.02;
        bounces++;
        path.push({ x: b.x, y: b.y });
        hits.push('B');
        if (bounces > maxBounces) break;
      }
    }
    if (bounces > maxBounces) break;

    // Targets — absorb when consuming (live), not during preview
    for (const t of (consumeTargets ? state.targets : targetsSnapshot)) {
      if (!t.alive) continue;
      const dx = b.x - t.x;
      const dy = b.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < CUE_R + TARGET_R) {
        t.alive = false;
        hits.push('T');
        // ball keeps going — no deflection; simulates an absorbing pocket
      }
    }

    steps++;
  }
  // terminal position
  path.push({ x: b.x, y: b.y });
  return { path, hits, final: b };
}

function predictPath(ball, maxBounces) {
  const { path } = simulate(ball, maxBounces, 2000, false);
  return path;
}

// ---------- Event handling ----------
function canAim() {
  return !state.moving && !state.finished && state.cue.alive;
}

function onPointerDown(e) {
  e.preventDefault();
  if (!canAim()) return;
  prelude.classList.add('gone');
  const p = eventToTable(e);
  // only start if near cue
  const dx = p.x - state.cue.x, dy = p.y - state.cue.y;
  if (Math.hypot(dx, dy) > 120) return;
  state.aiming = true;
  state.aimStart = { x: state.cue.x, y: state.cue.y };
  state.aimEnd = p;
  setStatus('line the shot up — three bounces shown');
  draw();
}
function onPointerMove(e) {
  if (!state.aiming) return;
  e.preventDefault();
  state.aimEnd = eventToTable(e);
  draw();
}
function onPointerUp(e) {
  if (!state.aiming) return;
  e.preventDefault();
  const v = aimToVelocity(state.aimStart, state.aimEnd);
  state.aiming = false;
  if (Math.hypot(v.vx, v.vy) < 0.8) {
    setStatus('too gentle — pull back harder next time');
    draw();
    return;
  }
  fireShot(v.vx, v.vy);
}

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove', onPointerMove, { passive: false });
canvas.addEventListener('touchend', onPointerUp, { passive: false });
canvas.addEventListener('touchcancel', onPointerUp, { passive: false });

// ---------- Shot execution (animated real-time) ----------
function fireShot(vx, vy) {
  state.moving = true;
  state.shots++;
  state.cue.vx = vx;
  state.cue.vy = vy;
  state.currentShotHits = '';
  updateHUD();
  setStatus('rolling...');
  blocker.classList.add('active');
  requestAnimationFrame(animateShot);
}

function animateShot() {
  // step physics one tick
  const sp = Math.hypot(state.cue.vx, state.cue.vy);
  if (sp < STOP_SPEED) {
    state.cue.vx = 0; state.cue.vy = 0;
    state.moving = false;
    blocker.classList.remove('active');
    afterShot();
    draw();
    return;
  }
  // Advance by sub-steps for collision stability on fast shots
  const substeps = Math.max(1, Math.ceil(sp / 4));
  for (let i = 0; i < substeps; i++) {
    stepCueOnce();
    // check stop inside loop too
    const s = Math.hypot(state.cue.vx, state.cue.vy);
    if (s < STOP_SPEED) break;
  }
  draw();
  requestAnimationFrame(animateShot);
}

function stepCueOnce() {
  const c = state.cue;
  // sub-step has 1/substeps of velocity
  // We divide velocity when calling; but here we apply integer update with friction.
  // For simplicity: move a fraction that keeps collisions stable.
  const total = Math.hypot(c.vx, c.vy);
  const stepLen = Math.min(total, 4);
  if (total === 0) return;
  const nx = c.vx / total, ny = c.vy / total;
  c.x += nx * stepLen;
  c.y += ny * stepLen;

  // apply friction scaled by fraction
  const fracFriction = Math.pow(FRICTION, stepLen / 1.0 * 0.25);
  c.vx *= fracFriction;
  c.vy *= fracFriction;

  // Rails
  if (c.x - CUE_R < 0) { c.x = CUE_R; c.vx = -c.vx; state.currentShotHits += 'R'; }
  if (c.x + CUE_R > TW) { c.x = TW - CUE_R; c.vx = -c.vx; state.currentShotHits += 'R'; }
  if (c.y - CUE_R < 0) { c.y = CUE_R; c.vy = -c.vy; state.currentShotHits += 'R'; }
  if (c.y + CUE_R > TH) { c.y = TH - CUE_R; c.vy = -c.vy; state.currentShotHits += 'R'; }

  // Walls
  for (const w of state.walls) {
    const nxp = Math.max(w.x, Math.min(c.x, w.x + w.w));
    const nyp = Math.max(w.y, Math.min(c.y, w.y + w.h));
    const dx = c.x - nxp;
    const dy = c.y - nyp;
    const d = Math.hypot(dx, dy);
    if (d < CUE_R) {
      let nXn, nYn;
      if (d === 0) {
        const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
        const rx = (c.x - cx) / (w.w / 2);
        const ry = (c.y - cy) / (w.h / 2);
        if (Math.abs(rx) > Math.abs(ry)) { nXn = Math.sign(rx) || 1; nYn = 0; }
        else { nXn = 0; nYn = Math.sign(ry) || 1; }
      } else {
        nXn = dx / d; nYn = dy / d;
      }
      c.x = nxp + nXn * CUE_R;
      c.y = nyp + nYn * CUE_R;
      const dot = c.vx * nXn + c.vy * nYn;
      c.vx -= 2 * dot * nXn;
      c.vy -= 2 * dot * nYn;
      state.currentShotHits += 'W';
    }
  }
  // Bumpers
  for (const b of state.bumpers) {
    const dx = c.x - b.x, dy = c.y - b.y;
    const d = Math.hypot(dx, dy);
    const rr = CUE_R + BUMPER_R;
    if (d < rr && d > 0) {
      const nxn = dx / d, nyn = dy / d;
      c.x = b.x + nxn * rr;
      c.y = b.y + nyn * rr;
      const dot = c.vx * nxn + c.vy * nyn;
      c.vx -= 2 * dot * nxn;
      c.vy -= 2 * dot * nyn;
      c.vx *= 1.02;
      c.vy *= 1.02;
      state.currentShotHits += 'B';
    }
  }
  // Targets
  for (const t of state.targets) {
    if (!t.alive) continue;
    const dx = c.x - t.x, dy = c.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < CUE_R + TARGET_R) {
      t.alive = false;
      state.currentShotHits += 'T';
    }
  }
}

function afterShot() {
  const hits = state.currentShotHits;
  state.shotTrail.push(hits);
  const cleared = state.targets.filter(t => !t.alive).length;
  updateHUD();
  if (cleared === 5) {
    state.finished = true;
    showResult();
    return;
  }
  const hitTargets = (hits.match(/T/g) || []).length;
  if (hitTargets === 0) {
    setStatus('dry shot — reset or line up another');
  } else if (hitTargets === 1) {
    setStatus('one down — nice');
  } else {
    setStatus(`${hitTargets} in one swing — filthy`);
  }
}

// ---------- HUD / result ----------
function updateHUD() {
  hudShots.textContent = `SHOT ${state.shots} / PAR ${PAR}`;
  const cleared = state.targets.filter(t => !t.alive).length;
  hudTargets.textContent = `${cleared} / 5`;
}

function setStatus(msg) { statusEl.textContent = msg; }

function showResult() {
  const shots = state.shots;
  let verdict;
  if (shots === 1) verdict = 'TABLE RUN';
  else if (shots <= PAR - 1) verdict = 'UNDER PAR';
  else if (shots === PAR) verdict = 'MADE PAR';
  else if (shots === PAR + 1) verdict = 'BOGEY';
  else verdict = 'HUSTLED';
  resultVerdict.textContent = verdict;
  resultShots.textContent = String(shots);

  // Build share grid (emoji-per-shot)
  const gridRows = state.shotTrail.map(hits => {
    // Count targets hit in that shot, show targets + bounces
    const t = (hits.match(/T/g) || []).length;
    const b = (hits.match(/[WRB]/g) || []).length;
    let row = '';
    for (let i = 0; i < t; i++) row += '🟡';
    for (let i = 0; i < Math.min(b, 3); i++) row += '🟢';
    if (!row) row = '⚫';
    return row;
  });
  const gridText = gridRows.join('\n');
  resultGrid.textContent = gridText;

  resultEl.style.display = 'flex';
}

// ---------- Share ----------
function shareText() {
  const shots = state.shots;
  const rows = state.shotTrail.map(hits => {
    const t = (hits.match(/T/g) || []).length;
    const b = (hits.match(/[WRB]/g) || []).length;
    let row = '';
    for (let i = 0; i < t; i++) row += '🟡';
    for (let i = 0; i < Math.min(b, 3); i++) row += '🟢';
    if (!row) row = '⚫';
    return row;
  });
  return [
    `Bounce Pool — ${DAY_KEY}`,
    `${shots}/${PAR}`,
    rows.join('\n'),
    `play today's level: ${location.href}`
  ].join('\n');
}

function share() {
  const text = shareText();
  if (navigator.share) {
    navigator.share({ title: 'Bounce Pool', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => alert('copied your run to clipboard'))
      .catch(() => alert(text));
  } else {
    alert(text);
  }
}
window.share = share;

// ---------- Reset ----------
function resetLevel() {
  state.cue = { x: LEVEL.cue[0], y: LEVEL.cue[1], vx: 0, vy: 0, alive: true };
  state.targets = LEVEL.targets.map(([x, y]) => ({ x, y, alive: true }));
  state.shots = 0;
  state.aiming = false;
  state.aimStart = null;
  state.aimEnd = null;
  state.moving = false;
  state.finished = false;
  state.shotTrail = [];
  state.currentShotHits = '';
  resultEl.style.display = 'none';
  updateHUD();
  setStatus('fresh rack. same level for everyone today.');
  draw();
}
resetBtn.addEventListener('click', resetLevel);
replayBtn.addEventListener('click', () => {
  resultEl.style.display = 'none';
  setStatus('replay run — same day, same level');
});

// ---------- Boot ----------
resize();
setStatus('drag from the cue to aim. release to shoot.');
