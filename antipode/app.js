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

  // --- Patterns ---
  // Each pattern returns an array of obstacle rects. Coordinates are world-space (x in pixels, y is the *top* of the pattern band).
  // The orbit "diameter gap" players must thread is 2*orbitRadius wide (with ball radius slack), centered on orbitCenter.x.
  // A pattern is *passable* if there exists an x-range of >= 2*orbitRadius+gap that is free of bars at the orbit's y-band.
  function makePatterns() {
    const W2 = W;
    const cx = W2 / 2;
    const barH = 22;
    const orbitDiam = orbitRadius * 2;
    const passWidth = orbitDiam + BALL_R * 2 + 20; // safe channel width
    const out = [];

    // single bar offset left
    out.push((y) => [
      { x: 0, y, w: cx - passWidth / 2, h: barH }
    ]);
    // single bar offset right
    out.push((y) => [
      { x: cx + passWidth / 2, y, w: W2 - (cx + passWidth / 2), h: barH }
    ]);
    // two bars with center gap
    out.push((y) => [
      { x: 0, y, w: cx - passWidth / 2, h: barH },
      { x: cx + passWidth / 2, y, w: W2 - (cx + passWidth / 2), h: barH }
    ]);
    // narrow center bar — gap on either side wide enough
    out.push((y) => {
      const narrow = Math.max(40, Math.min(120, W2 * 0.12));
      return [{ x: cx - narrow / 2, y, w: narrow, h: barH }];
    });
    // diagonal staircase: bar offset slightly + small bar lower on one side (two-row pattern)
    out.push((y) => {
      const off = passWidth * 0.6;
      return [
        { x: 0, y, w: cx - off / 2, h: barH },
        { x: cx + off / 2, y: y + barH * 2.2, w: W2 - (cx + off / 2), h: barH }
      ];
    });
    // two-row staggered (left-then-right)
    out.push((y) => [
      { x: 0, y, w: cx - passWidth / 2, h: barH },
      { x: cx + passWidth / 2, y: y + barH * 2.2, w: W2 - (cx + passWidth / 2), h: barH }
    ]);
    // big bar with a hole on one side + small notch
    out.push((y) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      // Bar covers most of width, leaving a passWidth gap on `side`
      if (side < 0) {
        return [{ x: passWidth, y, w: W2 - passWidth, h: barH }];
      } else {
        return [{ x: 0, y, w: W2 - passWidth, h: barH }];
      }
    });

    return out;
  }
  let PATTERNS = [];

  function spawnPattern(topY) {
    const fn = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const rects = fn(topY);
    // tag with pattern id so we can score once when fully passed
    const pid = Math.random().toString(36).slice(2);
    rects.forEach(r => { r.pid = pid; r.scored = false; });
    obstacles.push(...rects);
  }

  function resetGame() {
    layout();
    PATTERNS = makePatterns();
    angle = -Math.PI / 2;       // red on top? actually start with red at right (0). Let's start at 0.
    angle = 0;
    angVel = 0;
    trailA.length = 0;
    trailB.length = 0;
    obstacles = [];
    score = 0;
    timeAlive = 0;
    baseFallSpeed = 2.4;
    // First few patterns staggered up the screen
    for (let i = 0; i < 3; i++) {
      spawnPattern(-200 - i * 220);
    }
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

    // Score: when an obstacle's bottom passes below orbit (any obstacle in pattern), score the pattern once
    const orbitBottom = orbitCenter.y + orbitRadius + BALL_R;
    const scoredPids = new Set();
    for (const o of obstacles) {
      if (!o.scored && (o.y + o.h) > orbitBottom) {
        if (!scoredPids.has(o.pid)) {
          // first time this frame we see this pid passing
          // mark all rects in this pid scored
          scoredPids.add(o.pid);
        }
      }
    }
    if (scoredPids.size > 0) {
      for (const o of obstacles) {
        if (scoredPids.has(o.pid) && !o.scored) {
          // Only score once per pattern: when *all* rects in the pattern have passed
          const allPassed = obstacles.filter(x => x.pid === o.pid).every(x => (x.y + x.h) > orbitBottom);
          if (allPassed) {
            // Mark all as scored to prevent double counting
            for (const x of obstacles) if (x.pid === o.pid) x.scored = true;
            score++;
            scoreEl.textContent = String(score);
          }
          break;
        }
      }
    }

    // Cull obstacles that are off-screen
    obstacles = obstacles.filter(o => o.y < H + 200);

    // Spawn new patterns when topmost obstacle has descended enough
    let topmost = -Infinity;
    for (const o of obstacles) if (o.y < topmost || topmost === -Infinity) topmost = o.y;
    // Spawn cadence tightens with time
    const spawnGap = Math.max(150, 240 - timeAlive * 0.05);
    if (obstacles.length === 0 || topmost > -spawnGap) {
      // Find current min y to place new pattern above it
      let minY = -spawnGap;
      for (const o of obstacles) if (o.y < minY) minY = o.y;
      spawnPattern(minY - spawnGap);
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
    PATTERNS = makePatterns();
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
