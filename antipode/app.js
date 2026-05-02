// ANTIPODE — one-touch rotation-dodge. Two balls, 180° apart, orbit a fixed point.
// Inspired by Duet (Kumobius). Momentum/inertia rotation is the whole game.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const titleScreen = document.getElementById('title-screen');
  const deathScreen = document.getElementById('death-screen');
  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const finalScoreEl = document.getElementById('final-score');
  const bestScoreEl = document.getElementById('best-score');
  const deathMicroEl = document.getElementById('death-micro');

  // --- Persistent best ---
  const BEST_KEY = 'antipode_best';
  function getBest() {
    const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }
  function setBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (_) {}
  }

  // --- Canvas sizing ---
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Game state ---
  const STATE_TITLE = 'title';
  const STATE_PLAY = 'play';
  const STATE_DEATH = 'death';
  let state = STATE_TITLE;
  let deathAt = 0;
  const DEATH_FREEZE_MS = 600;

  // Orbit / balls
  const BALL_R = 11;
  let orbitCenter = { x: 0, y: 0 };
  let orbitRadius = 86;
  let angle = 0;            // current angle of red ball; blue is +PI
  let angVel = 0;           // angular velocity (rad/frame)
  const ANG_ACCEL = 0.012;
  const ANG_FRICTION = 0.92;
  const ANG_MAX = 0.07;

  // Trails: ring buffer of recent positions for each ball
  const TRAIL_LEN = 14;
  const trailA = [];
  const trailB = [];

  // Input
  const input = { left: false, right: false };

  // Obstacles
  let obstacles = [];
  let score = 0;
  let nextSpawnY = 0;       // next spawn moment tracked by Y position of last obstacle
  let baseFallSpeed = 2.4;  // px/frame at start
  let timeAlive = 0;        // frames

  // --- Layout based on canvas ---
  function layout() {
    orbitCenter.x = W / 2;
    // Lower-third of canvas
    orbitCenter.y = H * 0.7;
    // Orbit radius: scale with width but cap
    orbitRadius = Math.max(64, Math.min(110, W * 0.16));
  }

  // --- Pattern generation ---
  // Every pattern is constructed to be geometrically passable; the previous
  // "edge-gap" patterns were impossible because the two balls span 2r around
  // the orbit center cx, but the gap was anchored at x=0 with width ~2r+42 —
  // there's no rotation that places both balls inside an off-center channel
  // when cx >> channel width.
  //
  // Geometry crib (cx = orbit center x, r = orbit radius):
  //   Ball positions: red=(cx+r·cosθ, cy+r·sinθ), blue=(cx-r·cosθ, cy-r·sinθ).
  //   Both balls span x ∈ [cx - r·|cosθ|, cx + r·|cosθ|], collapsing to x = cx
  //   at vertical (cosθ=0) and spreading to the full diameter at horizontal.
  //
  // Barrier passability (with BALL_R buffer):
  //   centerGap(halfGap):  passable for |cosθ| < (halfGap - BALL_R)/r.
  //                        Always passable when halfGap ≥ r + BALL_R.
  //   sideBar(innerX):     passable for |cosθ| < (cx - innerX - BALL_R)/r.
  //                        Always passable when innerX ≤ cx - r - BALL_R.
  //   narrowCenter(w):     passable for |cosθ| > (w/2 + BALL_R)/r.
  //                        Possible at all when w < 2·(r - BALL_R).
  //
  // Sequenced barriers: vertical spacing dy gives the player ≈ dy/fallSpeed
  // frames to rotate. ANG_MAX = 0.07 rad/frame, so a 90° (1.57 rad) flip needs
  // ≥ ~25 useful frames. dy = 240 at peak fallSpeed (~5 px/frame) → ~48 frames,
  // tight but comfortable. Inter-pattern gap ≥ 170 keeps that budget intact.

  const BAR_H = 22;
  const SAFE = 8;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function weightedPick(items) {
    let total = 0;
    for (const i of items) total += i.weight;
    let v = Math.random() * total;
    for (const i of items) {
      v -= i.weight;
      if (v <= 0) return i.name;
    }
    return items[items.length - 1].name;
  }

  function patternBounds() {
    const cx = orbitCenter.x;
    const r = orbitRadius;
    return {
      cx, r,
      wideHalfGap: r + BALL_R + SAFE + 4,             // always-passable center gap
      safeInnerEdgeLeft: cx - r - BALL_R - SAFE,      // always-passable left bar edge
      safeInnerEdgeRight: cx + r + BALL_R + SAFE,     // always-passable right bar edge
      maxNarrowW: 2 * (r - BALL_R) - SAFE * 2,        // upper bound on splittable narrow bar
      minTightHalfGap: BALL_R + 14,                   // hard lower bound on center channel
    };
  }

  function makeCenterGap(y, halfGap) {
    const cx = orbitCenter.x;
    const out = [];
    if (cx - halfGap > 0) out.push({ x: 0, y, w: cx - halfGap, h: BAR_H });
    if (W - (cx + halfGap) > 0) out.push({ x: cx + halfGap, y, w: W - (cx + halfGap), h: BAR_H });
    return out;
  }
  function makeSideBar(y, side, innerX) {
    if (side < 0) {
      if (innerX <= 0) return [];
      return [{ x: 0, y, w: innerX, h: BAR_H }];
    }
    if (innerX >= W) return [];
    return [{ x: innerX, y, w: W - innerX, h: BAR_H }];
  }
  function makeNarrowCenter(y, w) {
    const cx = orbitCenter.x;
    return [{ x: cx - w / 2, y, w, h: BAR_H }];
  }

  function pickPattern(topY, difficulty) {
    const b = patternBounds();
    const types = [
      { name: 'wide_center',       weight: Math.max(0.10, 0.55 - difficulty * 0.35) },
      { name: 'wide_side',         weight: Math.max(0.10, 0.45 - difficulty * 0.25) },
      { name: 'narrow_center',     weight: 0.20 + difficulty * 0.35 },
      { name: 'tight_channel',     weight: 0.15 + difficulty * 0.30 },
      { name: 'split_then_center', weight: 0.05 + difficulty * 0.55 },
      { name: 'center_then_split', weight: 0.05 + difficulty * 0.55 },
    ];
    const type = weightedPick(types);
    const out = [];

    switch (type) {
      case 'wide_center':
        out.push(...makeCenterGap(topY, b.wideHalfGap));
        break;
      case 'wide_side': {
        const side = Math.random() < 0.5 ? -1 : 1;
        const innerX = side < 0 ? b.safeInnerEdgeLeft : b.safeInnerEdgeRight;
        out.push(...makeSideBar(topY, side, innerX));
        break;
      }
      case 'narrow_center': {
        const w = Math.min(b.maxNarrowW * 0.95, lerp(b.r * 0.5, b.r * 1.3, difficulty));
        out.push(...makeNarrowCenter(topY, w));
        break;
      }
      case 'tight_channel': {
        const half = Math.max(b.minTightHalfGap, lerp(b.r * 0.55, b.r * 0.30, difficulty));
        out.push(...makeCenterGap(topY, half));
        break;
      }
      case 'split_then_center': {
        const wn = Math.min(b.maxNarrowW * 0.85, lerp(b.r * 0.5, b.r * 1.15, difficulty));
        const half = Math.max(b.minTightHalfGap + 4, lerp(b.r * 0.55, b.r * 0.34, difficulty));
        out.push(...makeNarrowCenter(topY, wn));
        out.push(...makeCenterGap(topY + 240, half));
        break;
      }
      case 'center_then_split': {
        const half = Math.max(b.minTightHalfGap + 4, lerp(b.r * 0.55, b.r * 0.34, difficulty));
        const wn = Math.min(b.maxNarrowW * 0.85, lerp(b.r * 0.5, b.r * 1.15, difficulty));
        out.push(...makeCenterGap(topY, half));
        out.push(...makeNarrowCenter(topY + 240, wn));
        break;
      }
    }
    return out;
  }

  function currentDifficulty() {
    return Math.min(1, timeAlive / 5400); // ramps to peak over ~90s @ 60fps
  }

  function spawnNextPattern() {
    let topmost = -50;
    for (const o of obstacles) if (o.y < topmost) topmost = o.y;

    const difficulty = currentDifficulty();
    const pattern = pickPattern(0, difficulty);
    if (pattern.length === 0) return;

    let extent = 0;
    for (const r of pattern) extent = Math.max(extent, r.y + r.h);

    const interGap = Math.max(170, 240 - timeAlive * 0.035);
    const newTop = topmost - extent - interGap;

    // One pid per barrier (rects sharing a y-row); each cleared barrier scores +1.
    const yToPid = new Map();
    for (const r of pattern) {
      r.y += newTop;
      if (!yToPid.has(r.y)) yToPid.set(r.y, Math.random().toString(36).slice(2));
      r.pid = yToPid.get(r.y);
      r.scored = false;
    }
    obstacles.push(...pattern);
  }

  function resetGame() {
    layout();
    angle = 0;
    angVel = 0;
    trailA.length = 0;
    trailB.length = 0;
    obstacles = [];
    score = 0;
    timeAlive = 0;
    baseFallSpeed = 2.4;
    for (let i = 0; i < 3; i++) spawnNextPattern();
    scoreEl.textContent = '0';
  }

  // --- Input ---
  function startPlay() {
    if (state === STATE_PLAY) return;
    state = STATE_PLAY;
    titleScreen.classList.add('hidden');
    deathScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    resetGame();
  }

  function die() {
    if (state !== STATE_PLAY) return;
    state = STATE_DEATH;
    deathAt = performance.now();
    const best = Math.max(getBest(), score);
    setBest(best);
    finalScoreEl.textContent = String(score);
    bestScoreEl.textContent = String(best);
    deathMicroEl.textContent = deathMicro(score);
    hud.classList.add('hidden');
    // death screen revealed after freeze
    setTimeout(() => {
      if (state === STATE_DEATH) deathScreen.classList.remove('hidden');
    }, DEATH_FREEZE_MS);
  }

  function deathMicro(s) {
    if (s < 5) return 'the orbit broke you';
    if (s < 15) return 'almost';
    if (s < 30) return "you're learning the dance";
    return "you've found the rhythm";
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.left = true;
    } else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.right = true;
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (state === STATE_TITLE) startPlay();
      else if (state === STATE_DEATH && performance.now() - deathAt > DEATH_FREEZE_MS) startPlay();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
    else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
  });

  // Touch — left half / right half of canvas
  const activeTouches = new Map(); // id -> 'left' | 'right'

  function touchSide(x) {
    return x < W / 2 ? 'left' : 'right';
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (state === STATE_TITLE) {
      startPlay();
      return;
    }
    if (state === STATE_DEATH) {
      if (performance.now() - deathAt > DEATH_FREEZE_MS) startPlay();
      return;
    }
    for (const t of e.changedTouches) {
      const side = touchSide(t.clientX);
      activeTouches.set(t.identifier, side);
      if (side === 'left') input.left = true; else input.right = true;
    }
  }
  function handleTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const side = activeTouches.get(t.identifier);
      activeTouches.delete(t.identifier);
      if (side === 'left' && ![...activeTouches.values()].includes('left')) input.left = false;
      if (side === 'right' && ![...activeTouches.values()].includes('right')) input.right = false;
    }
  }
  function handleTouchMove(e) { e.preventDefault(); }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

  // Mouse fallback (desktop click on title/death)
  canvas.addEventListener('mousedown', (e) => {
    if (state === STATE_TITLE) { startPlay(); return; }
    if (state === STATE_DEATH && performance.now() - deathAt > DEATH_FREEZE_MS) { startPlay(); return; }
    const side = touchSide(e.clientX);
    if (side === 'left') input.left = true; else input.right = true;
  });
  window.addEventListener('mouseup', () => { input.left = false; input.right = false; });

  // --- Collision ---
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
  }

  // --- Update ---
  function update() {
    if (state !== STATE_PLAY) return;
    timeAlive++;

    // Difficulty ramp
    const fallSpeed = baseFallSpeed + Math.min(2.6, timeAlive / 1800);

    // Rotation physics
    if (input.left && !input.right) angVel -= ANG_ACCEL;
    else if (input.right && !input.left) angVel += ANG_ACCEL;
    else angVel *= ANG_FRICTION;

    if (angVel > ANG_MAX) angVel = ANG_MAX;
    if (angVel < -ANG_MAX) angVel = -ANG_MAX;
    if (Math.abs(angVel) < 0.0005 && !input.left && !input.right) angVel = 0;

    angle += angVel;

    // Ball positions
    const ax = orbitCenter.x + Math.cos(angle) * orbitRadius;
    const ay = orbitCenter.y + Math.sin(angle) * orbitRadius;
    const bx = orbitCenter.x + Math.cos(angle + Math.PI) * orbitRadius;
    const by = orbitCenter.y + Math.sin(angle + Math.PI) * orbitRadius;

    // Update trails
    trailA.push({ x: ax, y: ay });
    if (trailA.length > TRAIL_LEN) trailA.shift();
    trailB.push({ x: bx, y: by });
    if (trailB.length > TRAIL_LEN) trailB.shift();

    // Move obstacles down
    for (const o of obstacles) {
      o.y += fallSpeed;
    }

    // Score: each barrier (rects sharing a pid) increments score once fully past the orbit.
    const orbitBottom = orbitCenter.y + orbitRadius + BALL_R;
    const groups = new Map();
    for (const o of obstacles) {
      if (o.scored) continue;
      if (!groups.has(o.pid)) groups.set(o.pid, []);
      groups.get(o.pid).push(o);
    }
    let scoredThisFrame = false;
    for (const group of groups.values()) {
      if (group.every(o => (o.y + o.h) > orbitBottom)) {
        for (const o of group) o.scored = true;
        score++;
        scoredThisFrame = true;
      }
    }
    if (scoredThisFrame) scoreEl.textContent = String(score);

    obstacles = obstacles.filter(o => o.y < H + 200);

    // Spawn new patterns once the highest obstacle has descended past the spawn line.
    let topmost = Infinity;
    for (const o of obstacles) if (o.y < topmost) topmost = o.y;
    if (obstacles.length === 0 || topmost > -50) {
      spawnNextPattern();
    }

    // Collisions
    for (const o of obstacles) {
      if (circleRect(ax, ay, BALL_R, o.x, o.y, o.w, o.h)) { die(); return; }
      if (circleRect(bx, by, BALL_R, o.x, o.y, o.w, o.h)) { die(); return; }
    }
  }

  // --- Render ---
  const COLOR_BG = '#0a0a12';
  const COLOR_RED = '#ff3b5c';
  const COLOR_BLUE = '#2bb3ff';
  const COLOR_OBSTACLE = '#f3f3f7';
  const COLOR_ORBIT = 'rgba(243,243,247,0.07)';

  function render() {
    // Background
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, W, H);

    if (state === STATE_TITLE) {
      // Subtle backdrop demo: just orbit guide and resting balls
      drawOrbit();
      const rax = orbitCenter.x + Math.cos(angle) * orbitRadius;
      const ray = orbitCenter.y + Math.sin(angle) * orbitRadius;
      const rbx = orbitCenter.x + Math.cos(angle + Math.PI) * orbitRadius;
      const rby = orbitCenter.y + Math.sin(angle + Math.PI) * orbitRadius;
      drawBall(rax, ray, COLOR_RED);
      drawBall(rbx, rby, COLOR_BLUE);
      return;
    }

    // Obstacles
    ctx.fillStyle = COLOR_OBSTACLE;
    for (const o of obstacles) {
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }

    // Orbit guide
    drawOrbit();

    // Ball positions
    const ax = orbitCenter.x + Math.cos(angle) * orbitRadius;
    const ay = orbitCenter.y + Math.sin(angle) * orbitRadius;
    const bx = orbitCenter.x + Math.cos(angle + Math.PI) * orbitRadius;
    const by = orbitCenter.y + Math.sin(angle + Math.PI) * orbitRadius;

    // Trails
    drawTrail(trailA, COLOR_RED);
    drawTrail(trailB, COLOR_BLUE);

    // Death freeze flash
    if (state === STATE_DEATH) {
      const dt = performance.now() - deathAt;
      if (dt < 120) {
        ctx.fillStyle = 'rgba(255,255,255,' + (1 - dt / 120) * 0.55 + ')';
        ctx.fillRect(0, 0, W, H);
      } else {
        // dim playfield while showing scores
        ctx.fillStyle = 'rgba(10,10,18,0.55)';
        ctx.fillRect(0, 0, W, H);
      }
    }

    drawBall(ax, ay, COLOR_RED);
    drawBall(bx, by, COLOR_BLUE);
  }

  function drawOrbit() {
    ctx.strokeStyle = COLOR_ORBIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(orbitCenter.x, orbitCenter.y, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBall(x, y, color) {
    // glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, BALL_R * 2.6);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color + '88');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrail(trail, color) {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const tProg = i / trail.length; // 0 oldest -> 1 newest
      const alpha = tProg * 0.55;
      const r = BALL_R * (0.4 + tProg * 0.6);
      ctx.fillStyle = hexAlpha(color, alpha);
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function hexAlpha(hex, a) {
    // hex like #ff3b5c
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // --- Loop ---
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  // --- Init ---
  function init() {
    layout();
    bestScoreEl.textContent = String(getBest());
    // gentle ambient rotation on title
    angle = -Math.PI / 4;
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { layout(); });
  init();
})();

// Required by skill: share function (must be on global scope for inline onclick)
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'))
      .catch(() => alert(location.href));
  } else {
    alert(location.href);
  }
}
