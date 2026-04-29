// Kite String Physics — a one-line kite on a live wind field.
// Pure client-side. No LLM, no API. Deterministic wind per daily seed.

(() => {
  'use strict';

  // -------- Deterministic PRNG (mulberry32) & hashing --------
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------- Today's wind seed + label --------
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase(); // e.g. "apr 19"

  // Parse URL fragment for replay
  const frag = window.location.hash.slice(1);
  let replayData = null;
  if (frag) {
    try { replayData = decodeShare(frag); } catch (_) { replayData = null; }
  }

  const daySeedStr = replayData ? replayData.seedStr : yyyymmdd;
  const seedFn = xmur3(daySeedStr);
  const rng = mulberry32(seedFn());

  // Wind character — compass direction, adjective, strength
  const DIRS = [
    { name: 'northerly',   ang: -Math.PI/2 },
    { name: 'northeasterly', ang: -Math.PI/4 },
    { name: 'easterly',    ang: 0 },
    { name: 'southeasterly', ang: Math.PI/4 },
    { name: 'southerly',   ang: Math.PI/2 },
    { name: 'southwesterly', ang: 3*Math.PI/4 },
    { name: 'westerly',    ang: Math.PI },
    { name: 'northwesterly', ang: -3*Math.PI/4 }
  ];
  const MOODS = ['gusty','steady','fickle','sleepy','crisp','warm','restless','skittish','even'];
  const dir = DIRS[Math.floor(rng()*DIRS.length)];
  const mood = MOODS[Math.floor(rng()*MOODS.length)];
  // Strength affects base wind magnitude.
  const strength = 0.72 + rng() * 0.55; // ~0.72..1.27
  // Gust parameters per seed
  const gustAmp = 0.22 + rng() * 0.45;
  const gustSpeed = 0.35 + rng() * 0.7;
  const noiseSeed = rng() * 1000;

  const windLabel = `${dayStr}: ${mood} ${dir.name}`;
  document.getElementById('wind-label').textContent = windLabel;

  // -------- Canvas + sizing --------
  const canvas = document.getElementById('kite-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  function resize() {
    DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rebuildStreamlines();
  }
  window.addEventListener('resize', resize);

  // -------- Wind field --------
  // Base wind vector + procedural gust perturbation using simple value-noise.
  const baseWind = { x: Math.cos(dir.ang) * strength, y: Math.sin(dir.ang) * strength * 0.45 }; // visually flatten vertical

  // Value-noise grid
  const NGRID = 32;
  const noiseGrid = new Float32Array(NGRID * NGRID);
  for (let i = 0; i < noiseGrid.length; i++) noiseGrid[i] = rng();

  function smooth(t) { return t*t*(3 - 2*t); }
  function vnoise(x, y) {
    // tile-wrapped value noise
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % NGRID) + NGRID) % NGRID;
    const y0 = ((yi % NGRID) + NGRID) % NGRID;
    const x1 = (x0 + 1) % NGRID;
    const y1 = (y0 + 1) % NGRID;
    const a = noiseGrid[y0*NGRID + x0];
    const b = noiseGrid[y0*NGRID + x1];
    const c = noiseGrid[y1*NGRID + x0];
    const d = noiseGrid[y1*NGRID + x1];
    const u = smooth(xf), v = smooth(yf);
    return (a*(1-u) + b*u)*(1-v) + (c*(1-u) + d*u)*v; // 0..1
  }

  function windAt(px, py, t) {
    // px,py in screen pixels. Normalize into noise space.
    const nx = px / 180 + t * 0.12;
    const ny = py / 200 + t * 0.08 + noiseSeed;
    const n1 = vnoise(nx, ny) - 0.5;               // -0.5..0.5
    const n2 = vnoise(nx*2.1 + 3.3, ny*2.1 + 7.7) - 0.5;
    // Perturbation vector
    const ang = (n1 + n2) * Math.PI * 1.2;
    const amp = gustAmp * (0.6 + vnoise(nx*0.4 + 11, ny*0.4 + 5) * 0.9) * gustSpeed;
    return {
      x: baseWind.x + Math.cos(ang) * amp,
      y: baseWind.y + Math.sin(ang) * amp
    };
  }

  // -------- Streamlines (visual only) --------
  let streamlines = [];
  function rebuildStreamlines() {
    streamlines = [];
    const rows = 6, cols = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = (c + 0.5) * (W / cols) + (rng()-0.5) * 20;
        const sy = (r + 0.5) * (H / rows) + (rng()-0.5) * 20;
        streamlines.push({ x: sx, y: sy, ox: sx, oy: sy, age: rng() * 4 });
      }
    }
  }

  // -------- Kite physics --------
  // Reel = fixed anchor at bottom of screen (the "person on the ground").
  // The cursor/touch directly steers the kite — drag where you want it to go.
  const reel = { x: 0, y: 0 };
  // Steering target — where the user is pulling the kite toward
  const steer = { x: 0, y: 0, active: false };
  // Kite state
  const kite = {
    x: 0, y: 0, vx: 0, vy: 0,
    angle: 0, angVel: 0,
    mass: 1.0,
    lineLen: 220,   // soft rest length of string
    minLine: 90,
    maxLine: 360
  };

  function initKite() {
    reel.x = W/2;
    reel.y = H * 0.88;
    kite.x = reel.x;
    kite.y = reel.y - kite.lineLen;
    kite.vx = 0; kite.vy = 0;
    kite.angle = 0; kite.angVel = 0;
    kite.lineLen = 220;
    steer.x = kite.x;
    steer.y = kite.y;
    steer.active = false;
  }

  // -------- Game state --------
  const state = {
    mode: 'prestart', // prestart | flying | replay | done
    tStart: 0,
    tNow: 0,
    duration: 60, // seconds
    path: [],     // [{x,y}]  kite path in screen coords
    reelPath: [], // sparse user-input (steer) path; kept name for share-format compat
    tricks: [],   // [{name, t}]
    lastSampleT: 0
  };

  // -------- Input --------
  // The cursor (or touch) is the kite's steering target. Mouse hover steers on
  // desktop too, so the kite responds to where you point — no click required.
  function ptFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const t = ev.touches ? ev.touches[0] : ev;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function onDown(ev) {
    ev.preventDefault();
    if (state.mode !== 'flying' && state.mode !== 'replay') return;
    const p = ptFromEvent(ev);
    steer.active = true;
    steer.x = p.x; steer.y = p.y;
  }
  function onMove(ev) {
    if (state.mode !== 'flying') return;
    if (!steer.active && ev.type !== 'mousemove') return;
    const p = ptFromEvent(ev);
    steer.x = p.x; steer.y = p.y;
    if (ev.type !== 'mousemove') ev.preventDefault();
    if (ev.type === 'mousemove') steer.active = true;
  }
  function onUp() { /* keep last steer target so kite drifts toward it */ }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
  window.addEventListener('touchcancel', onUp);

  // -------- Tricks --------
  // We detect by watching the cumulative signed angular travel of the kite
  // around its own recent centroid. 2*PI clockwise = loop, CCW = reverse loop.
  const trickBuf = { angles: [], cum: 0, lastAng: null, recent: [] };

  const TRICK_DEFS = {
    cobra:           { name: 'cobra' },
    reverseCobra:    { name: 'reverse cobra' },
    figureEight:     { name: 'figure-eight' },
    doubleCobra:     { name: 'double cobra' },
    nosediveSave:    { name: 'faint heart' },
    skylark:         { name: 'skylark' }
  };

  function trickLanded(key) {
    const now = state.tNow;
    const t = TRICK_DEFS[key];
    if (!t) return;
    // Dedup within 0.8s
    if (state.tricks.length && state.tricks[state.tricks.length-1].name === t.name && now - state.tricks[state.tricks.length-1].t < 0.8) return;
    state.tricks.push({ name: t.name, t: now });
    showTrick(t.name);
  }

  const toastEl = document.getElementById('trick-toast');
  let toastTimer = null;
  function showTrick(name) {
    toastEl.textContent = name;
    toastEl.classList.remove('show');
    // force reflow to restart transition
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1100);
  }

  // Track loop completion: consecutive direction + magnitude
  const loop = { dir: 0, progress: 0, lastFlipT: -10, flipsInWindow: 0, lastLoopDir: 0, lastLoopT: -10 };
  let nosediveLowSpeed = 0;
  let nosediveAngleFromDown = 0;

  function updateTricks(dt) {
    // Compute centroid of recent path
    const RECENT = 40;
    if (state.path.length < 2) return;
    const start = Math.max(0, state.path.length - RECENT);
    let cx = 0, cy = 0, n = 0;
    for (let i = start; i < state.path.length; i++) {
      cx += state.path[i].x; cy += state.path[i].y; n++;
    }
    cx /= n; cy /= n;
    const ang = Math.atan2(kite.y - cy, kite.x - cx);
    if (trickBuf.lastAng === null) { trickBuf.lastAng = ang; return; }
    let d = ang - trickBuf.lastAng;
    if (d > Math.PI) d -= 2*Math.PI;
    if (d < -Math.PI) d += 2*Math.PI;
    trickBuf.lastAng = ang;

    // Only count if kite is above reel and moving coherently (avoid jitter in dead zone)
    const speed = Math.hypot(kite.vx, kite.vy);
    if (speed < 1.2) return;
    trickBuf.cum += d;

    const dirNow = Math.sign(d);
    if (dirNow !== 0 && dirNow !== loop.dir) {
      // direction flip
      if (Math.abs(loop.progress) > 1.2) {
        loop.flipsInWindow++;
        loop.lastFlipT = state.tNow;
      }
      loop.dir = dirNow;
      loop.progress = 0;
    }
    loop.progress += d;

    // Loop completion thresholds
    const threshold = 2 * Math.PI * 0.82;
    if (loop.progress >= threshold) {
      // CCW loop (in screen coords, +y down, so positive d = CCW-on-paper / CW-on-screen)
      // We'll call this a cobra.
      const prevDir = loop.lastLoopDir;
      const prevT = loop.lastLoopT;
      if (prevDir === -1 && state.tNow - prevT < 3.5) {
        trickLanded('figureEight');
      } else if (prevDir === 1 && state.tNow - prevT < 2.2) {
        trickLanded('doubleCobra');
      } else {
        trickLanded('cobra');
      }
      loop.lastLoopDir = 1;
      loop.lastLoopT = state.tNow;
      loop.progress = 0;
    } else if (loop.progress <= -threshold) {
      const prevDir = loop.lastLoopDir;
      const prevT = loop.lastLoopT;
      if (prevDir === 1 && state.tNow - prevT < 3.5) {
        trickLanded('figureEight');
      } else {
        trickLanded('reverseCobra');
      }
      loop.lastLoopDir = -1;
      loop.lastLoopT = state.tNow;
      loop.progress = 0;
    }

    // Skylark: kite held above reel with low velocity and line near max
    const above = (reel.y - kite.y) > 120;
    const lineDist = Math.hypot(kite.x - reel.x, kite.y - reel.y);
    if (above && speed < 1.0 && lineDist > 220) {
      skylarkHold += dt;
      if (skylarkHold > 1.2 && state.tNow - lastSkylarkT > 6) {
        trickLanded('skylark');
        lastSkylarkT = state.tNow;
        skylarkHold = 0;
      }
    } else {
      skylarkHold = Math.max(0, skylarkHold - dt * 2);
    }

    // Nosedive save: kite velocity pointing downward strongly near ground, then recovers upward
    const toGround = (H - kite.y);
    const pointingDown = kite.vy > 3.5 && Math.abs(kite.vx) < kite.vy * 1.2;
    if (pointingDown && toGround < H * 0.35) {
      nosediveArmed = true;
      nosediveArmT = state.tNow;
      nosediveY = kite.y;
    }
    if (nosediveArmed) {
      if (kite.vy < -1.5 && state.tNow - nosediveArmT < 1.2 && kite.y < nosediveY - 30) {
        if (state.tNow - lastNosediveT > 4) {
          trickLanded('nosediveSave');
          lastNosediveT = state.tNow;
        }
        nosediveArmed = false;
      } else if (state.tNow - nosediveArmT > 1.2 || kite.y > H - 20) {
        nosediveArmed = false;
      }
    }
  }
  let skylarkHold = 0, lastSkylarkT = -10;
  let nosediveArmed = false, nosediveArmT = 0, nosediveY = 0, lastNosediveT = -10;

  // -------- Simulation step --------
  let lastT = 0;
  function step(now) {
    if (!lastT) lastT = now;
    const dtMs = Math.min(40, now - lastT); // clamp to avoid huge jumps
    lastT = now;
    const dt = dtMs / 1000;

    if (state.mode === 'flying' || state.mode === 'replay') {
      state.tNow = (now - state.tStart) / 1000;
      tick(dt);
    }
    draw();
    requestAnimationFrame(step);
  }

  function tick(dt) {
    // Reel is fixed (the person on the ground). Just snap to bottom-center on
    // resize — no reel input.
    reel.x = W/2;
    reel.y = H * 0.88;

    // Wind force on kite
    const w = windAt(kite.x, kite.y, state.tNow);

    // Thermal / lift — kite has an airfoil, lift scales with wind so dead air
    // doesn't yank the kite around.
    const windMag = Math.hypot(w.x, w.y);
    const lift = 0.5 + windMag * 0.6;

    // Apply wind + lift forces
    const WIND_SCALE = 90; // px/s^2 ish
    kite.vx += w.x * WIND_SCALE * dt / kite.mass;
    kite.vy += (w.y * WIND_SCALE - lift * 32) * dt / kite.mass;

    // Steering force — pull the kite toward the cursor/touch target. This is
    // the user's primary control. Direct & responsive but with enough
    // smoothing that the kite still feels like it has weight. Force scales
    // with distance up to a saturation cap so the kite has a sensible top
    // speed (the cursor feels like a target, not a teleport pad).
    const sdx = steer.x - kite.x;
    const sdy = steer.y - kite.y;
    const sdist = Math.hypot(sdx, sdy);
    if (sdist > 1) {
      // saturates around fmag=140 (px/s^2). Tuned so a long-distance pull
      // settles at ~8 px/frame (~480 px/s) given the drag below.
      const fmag = Math.min(sdist * 1.4, 140);
      kite.vx += (sdx / sdist) * fmag * dt;
      kite.vy += (sdy / sdist) * fmag * dt;
    }

    // Air drag
    const drag = 0.86;
    kite.vx *= Math.pow(drag, dt * 60);
    kite.vy *= Math.pow(drag, dt * 60);

    // Integrate
    kite.x += kite.vx * dt * 60;
    kite.y += kite.vy * dt * 60;

    // String — soft spring. Beyond rest length the string pulls back; below
    // rest length it doesn't push. Eliminates the jittery hard-constraint snap.
    const dx = kite.x - reel.x;
    const dy = kite.y - reel.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / dist, ny = dy / dist;
    const stretch = dist - kite.lineLen;
    if (stretch > 0) {
      // Spring pulls kite back toward reel
      const k = 24; // spring stiffness
      const f = stretch * k;
      kite.vx -= nx * f * dt / kite.mass;
      kite.vy -= ny * f * dt / kite.mass;
      // Damp radial velocity a touch so it doesn't oscillate forever
      const vr = kite.vx * nx + kite.vy * ny;
      if (vr > 0) {
        kite.vx -= nx * vr * 0.12;
        kite.vy -= ny * vr * 0.12;
      }
    }
    // Hard cap to absolutely prevent runaway
    if (dist > kite.maxLine) {
      const overCap = dist - kite.maxLine;
      kite.x -= nx * overCap;
      kite.y -= ny * overCap;
      const vr = kite.vx * nx + kite.vy * ny;
      if (vr > 0) {
        kite.vx -= vr * nx * 0.5;
        kite.vy -= vr * ny * 0.5;
      }
    }

    // Keep kite above the ground
    if (kite.y > H - 20) {
      kite.y = H - 20;
      kite.vy = Math.min(kite.vy, 0);
      kite.vx *= 0.6;
    }

    // Kite angle: nose points along the string away from reel, tilted by horizontal velocity
    const targetAngle = Math.atan2(-ny, -nx) + Math.PI/2 + kite.vx * 0.025;
    let da = targetAngle - kite.angle;
    while (da > Math.PI) da -= 2*Math.PI;
    while (da < -Math.PI) da += 2*Math.PI;
    kite.angle += da * Math.min(1, dt * 10);

    // Sample path (for card + tricks) at ~20hz. reelPath now records the
    // user's steering input, which is what drives a replay.
    if (state.tNow - state.lastSampleT > 0.05) {
      state.path.push({ x: kite.x, y: kite.y });
      if (state.path.length > 1400) state.path.shift();
      const last = state.reelPath.length ? state.reelPath[state.reelPath.length-1] : null;
      if (!last || Math.hypot(steer.x - last.x, steer.y - last.y) > 18) {
        state.reelPath.push({ x: steer.x, y: steer.y });
        if (state.reelPath.length > 200) state.reelPath.shift();
      }
      state.lastSampleT = state.tNow;
    }

    // Streamline advection (purely visual)
    for (const s of streamlines) {
      const wv = windAt(s.x, s.y, state.tNow);
      s.x += wv.x * 12 * dt * 60;
      s.y += wv.y * 12 * dt * 60;
      s.age += dt;
      if (s.x < -10 || s.x > W+10 || s.y < -10 || s.y > H+10 || s.age > 3.5) {
        // respawn from upwind edge
        if (baseWind.x >= 0) s.x = -8; else s.x = W + 8;
        s.y = rng() * H;
        s.ox = s.x; s.oy = s.y;
        s.age = 0;
      }
    }

    // Trick detection
    updateTricks(dt);

    // Timer — end at duration
    if (state.mode === 'flying') {
      const remaining = Math.max(0, state.duration - state.tNow);
      document.getElementById('timer').textContent = remaining.toFixed(0);
      if (remaining <= 0) endSession();
    } else if (state.mode === 'replay') {
      const remaining = Math.max(0, state.duration - state.tNow);
      document.getElementById('timer').textContent = remaining.toFixed(0);
      if (state.tNow > state.duration + 1) endSession();
    }
  }

  // -------- Drawing --------
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Subtle horizon line
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#8a7a5f';
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.lineTo(W, H - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Streamlines — faint curved traces along the wind direction
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of streamlines) {
      const wv = windAt(s.x, s.y, state.tNow);
      const len = 26;
      const mag = Math.hypot(wv.x, wv.y) || 1;
      const ux = wv.x / mag, uy = wv.y / mag;
      ctx.globalAlpha = Math.max(0, 0.14 * (1 - Math.abs(s.age - 1.75) / 1.75));
      ctx.strokeStyle = '#3a4356';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - ux*len*0.5, s.y - uy*len*0.5);
      ctx.lineTo(s.x + ux*len*0.5, s.y + uy*len*0.5);
      ctx.stroke();
    }
    ctx.restore();

    // Draw the recent traced path — ink ghost
    if (state.path.length > 4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(26,31,41,0.22)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const start = Math.max(0, state.path.length - 180);
      ctx.moveTo(state.path[start].x, state.path[start].y);
      for (let i = start + 1; i < state.path.length; i++) {
        ctx.lineTo(state.path[i].x, state.path[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw the string
    ctx.save();
    ctx.strokeStyle = 'rgba(26,31,41,0.8)';
    ctx.lineWidth = 0.9;
    // Sag: catenary-ish via a quadratic curve with sag based on slack = (lineLen - actual)
    const mx = (reel.x + kite.x) / 2;
    const my = (reel.y + kite.y) / 2;
    const actual = Math.hypot(kite.x - reel.x, kite.y - reel.y);
    const sag = Math.max(0, kite.lineLen - actual) * 0.25 + 6;
    ctx.beginPath();
    ctx.moveTo(reel.x, reel.y);
    ctx.quadraticCurveTo(mx, my + sag, kite.x, kite.y);
    ctx.stroke();
    ctx.restore();

    // Reel (hand on the ground) — small ink tick at fixed bottom-center
    ctx.save();
    ctx.fillStyle = 'rgba(26,31,41,0.85)';
    ctx.beginPath();
    ctx.arc(reel.x, reel.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(26,31,41,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(reel.x, reel.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Steer reticle — faint ring at cursor target so user understands they're
    // steering the kite. Hidden if cursor is right on the kite.
    if (steer.active && state.mode === 'flying') {
      const sd = Math.hypot(steer.x - kite.x, steer.y - kite.y);
      if (sd > 18) {
        ctx.save();
        ctx.strokeStyle = 'rgba(201,79,58,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(steer.x, steer.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Kite body — ink diamond with cross brace and tail
    ctx.save();
    ctx.translate(kite.x, kite.y);
    ctx.rotate(kite.angle);
    const K = 14;
    // Body fill (pastel)
    ctx.fillStyle = '#e7dac1';
    ctx.strokeStyle = '#1a1f29';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -K);
    ctx.lineTo(K*0.7, 0);
    ctx.lineTo(0, K);
    ctx.lineTo(-K*0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cross brace
    ctx.beginPath();
    ctx.moveTo(0, -K); ctx.lineTo(0, K);
    ctx.moveTo(-K*0.7, 0); ctx.lineTo(K*0.7, 0);
    ctx.stroke();
    // Accent diamond
    ctx.fillStyle = 'rgba(201,79,58,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Tail — ribbon of little triangles trailing from the bottom of the kite
    drawTail();
  }

  const tailPts = [];
  function drawTail() {
    // Tail base point (bottom of kite in world space)
    const baseX = kite.x + Math.cos(kite.angle + Math.PI/2) * 14;
    const baseY = kite.y + Math.sin(kite.angle + Math.PI/2) * 14;
    tailPts.unshift({ x: baseX, y: baseY });
    if (tailPts.length > 16) tailPts.pop();

    ctx.save();
    ctx.strokeStyle = 'rgba(201,79,58,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (tailPts.length) ctx.moveTo(tailPts[0].x, tailPts[0].y);
    for (let i = 1; i < tailPts.length; i++) ctx.lineTo(tailPts[i].x, tailPts[i].y);
    ctx.stroke();
    // Little bows along the tail
    ctx.fillStyle = 'rgba(201,79,58,0.7)';
    for (let i = 3; i < tailPts.length; i += 3) {
      const p = tailPts[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------- Start / End --------
  function startSession() {
    state.mode = 'flying';
    state.tStart = performance.now();
    state.tNow = 0;
    state.path = [];
    state.reelPath = [];
    state.tricks = [];
    state.lastSampleT = 0;
    tailPts.length = 0;
    initKite();
    // Park the steer target up where the kite already is, so the kite
    // doesn't get yanked anywhere until the user actually inputs.
    steer.x = kite.x;
    steer.y = kite.y;
    steer.active = false;
    document.getElementById('prestart').style.display = 'none';
    document.getElementById('flight-log').style.display = 'none';
    document.getElementById('timer').textContent = state.duration;
  }

  function startReplay(data) {
    state.mode = 'replay';
    state.tStart = performance.now();
    state.tNow = 0;
    state.tricks = data.tricks || [];
    state.path = [];
    state.reelPath = [];
    tailPts.length = 0;
    initKite();
    // Drive the replay from the recorded reel path
    replayReel = data.reelPath.slice();
    replayT0 = 0;
    replayDur = data.duration || 60;
    document.getElementById('prestart').style.display = 'none';
    document.getElementById('flight-log').style.display = 'none';
    document.getElementById('timer').textContent = replayDur;
    // Banner
    if (!document.getElementById('replay-banner')) {
      const b = document.createElement('div');
      b.id = 'replay-banner';
      b.textContent = 'watching a friend\'s flight';
      document.getElementById('sky').appendChild(b);
      setTimeout(() => b.remove(), 3500);
    }
  }

  let replayReel = null;
  let replayDur = 60;
  let replayT0 = 0;

  // Replay drives the steer target along the recorded user-input path.
  function replayTick() {
    if (!replayReel || !replayReel.length) return;
    const t = state.tNow;
    const frac = Math.max(0, Math.min(1, t / replayDur));
    const idx = frac * (replayReel.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(replayReel.length - 1, i0 + 1);
    const u = idx - i0;
    const p0 = replayReel[i0], p1 = replayReel[i1];
    steer.x = p0.x * (1-u) + p1.x * u;
    steer.y = p0.y * (1-u) + p1.y * u;
    steer.active = true;
  }
  // Hook replayTick into tick loop
  const originalTick = tick;
  tick = function(dt) {
    if (state.mode === 'replay') replayTick();
    originalTick(dt);
  };

  function endSession() {
    state.mode = 'done';
    renderFlightLog();
  }

  // -------- Flight log card --------
  function renderFlightLog() {
    const logEl = document.getElementById('flight-log');
    logEl.style.display = 'flex';

    document.getElementById('card-date').textContent = dayStr;
    document.getElementById('card-wind').textContent = windLabel;

    // Path silhouette — normalize path into viewBox 320x180 with 10px padding
    const svg = document.getElementById('card-path');
    svg.innerHTML = '';
    const pathPts = state.path.length > 2 ? state.path : [{x: W/2, y: H/2}];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pathPts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 10;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const scale = Math.min((320 - pad*2) / bw, (180 - pad*2) / bh);
    const offX = (320 - bw * scale) / 2 - minX * scale;
    const offY = (180 - bh * scale) / 2 - minY * scale;
    let d = '';
    for (let i = 0; i < pathPts.length; i++) {
      const px = pathPts[i].x * scale + offX;
      const py = pathPts[i].y * scale + offY;
      d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
    }
    const svgNS = 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'route');
    svg.appendChild(p);

    // Reel path (dashed, red) in same frame
    if (state.reelPath.length > 2) {
      let rd = '';
      for (let i = 0; i < state.reelPath.length; i++) {
        const px = state.reelPath[i].x * scale + offX;
        const py = state.reelPath[i].y * scale + offY;
        rd += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      }
      const rp = document.createElementNS(svgNS, 'path');
      rp.setAttribute('d', rd);
      rp.setAttribute('class', 'reel');
      svg.appendChild(rp);
    }

    // Tricks
    const tEl = document.getElementById('card-tricks');
    tEl.innerHTML = '';
    // Deduplicate display — count per trick
    const counts = {};
    for (const tr of state.tricks) counts[tr.name] = (counts[tr.name]||0)+1;
    const names = Object.keys(counts);
    if (names.length === 0) {
      const d = document.createElement('div');
      d.className = 'no-tricks';
      d.textContent = 'no tricks landed — but you stayed up.';
      tEl.appendChild(d);
    } else {
      for (const n of names) {
        const span = document.createElement('span');
        span.className = 'trick-stamp';
        span.style.setProperty('--rot', ((Math.random()*6)-3).toFixed(1) + 'deg');
        span.textContent = counts[n] > 1 ? `${n} x${counts[n]}` : n;
        tEl.appendChild(span);
      }
    }

    // Meta — path length, max height
    const pathLen = state.path.length;
    const highest = pathPts.reduce((m,p) => Math.min(m, p.y), Infinity);
    const highPct = Math.max(0, Math.min(100, Math.round((1 - highest/H)*100)));
    document.getElementById('card-meta').textContent = `${pathLen} samples · peak ${highPct}% above the grass · ${state.tricks.length} trick${state.tricks.length===1?'':'s'}`;

    // Sig
    document.getElementById('card-sig-slug').textContent = seededHandle();

    // Build share URL
    buildShareURL();
  }

  function seededHandle() {
    // Silly deterministic handle per seed
    const adj = ['ink','salt','paper','dune','ember','tin','thistle','rook','ash','lark','cobalt','mica'];
    const noun = ['kite','sparrow','reed','stoop','spool','rind','ridge','thread','wren','flag'];
    const r = mulberry32(xmur3(daySeedStr + 'handle')());
    return `${adj[Math.floor(r()*adj.length)]}-${noun[Math.floor(r()*noun.length)]}`;
  }

  // -------- Share encoding --------
  // Encode seedStr + compressed polyline + tricks into URL fragment
  // Format: v1:<seedStr>:<reelPolyline>:<tricks>:<dur>
  // reelPolyline: base64-url of int16 pairs normalized to 0..1023 over width/height
  function encodeShare() {
    const seed = daySeedStr;
    const pts = state.reelPath;
    const buf = new Int16Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) {
      buf[i*2]   = Math.round(Math.max(0, Math.min(1, pts[i].x / W)) * 1023);
      buf[i*2+1] = Math.round(Math.max(0, Math.min(1, pts[i].y / H)) * 1023);
    }
    const bytes = new Uint8Array(buf.buffer);
    const b64 = b64urlEncode(bytes);
    const tricksEnc = encodeURIComponent(state.tricks.map(t => t.name).join('|'));
    return `v1:${encodeURIComponent(seed)}:${b64}:${tricksEnc}:${state.duration}`;
  }

  function decodeShare(s) {
    if (!s.startsWith('v1:')) throw new Error('bad');
    const parts = s.split(':');
    if (parts.length < 5) throw new Error('short');
    const seedStr = decodeURIComponent(parts[1]);
    const b64 = parts[2];
    const tricks = decodeURIComponent(parts[3]).split('|').filter(Boolean).map(n => ({ name: n, t: 0 }));
    const duration = parseInt(parts[4], 10) || 60;
    const bytes = b64urlDecode(b64);
    const view = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const pts = [];
    const wNow = window.innerWidth, hNow = window.innerHeight;
    for (let i = 0; i < view.length; i += 2) {
      pts.push({ x: (view[i] / 1023) * wNow, y: (view[i+1] / 1023) * hNow });
    }
    return { seedStr, reelPath: pts, tricks, duration };
  }

  function b64urlEncode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlDecode(b64) {
    const s = atob(b64.replace(/-/g,'+').replace(/_/g,'/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  let cachedShareHash = '';
  function buildShareURL() {
    try {
      cachedShareHash = encodeShare();
      const url = new URL(window.location.href);
      url.hash = cachedShareHash;
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      cachedShareHash = '';
    }
  }

  // share() is exposed globally for the button's onclick.
  window.share = function() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'my flight log — kite string physics',
        text: `flew ${state.tricks.length} trick${state.tricks.length===1?'':'s'} in the ${windLabel}.`,
        url
      }).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };
  function fallbackCopy(url) {
    navigator.clipboard.writeText(url)
      .then(() => toast('link copied — they\'ll see your exact flight.'))
      .catch(() => toast('copy blocked — grab the URL from the bar.'));
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:50%;top:20px;transform:translateX(-50%);background:#1a1f29;color:#f4ecd8;font-family:Caveat,cursive;font-size:20px;padding:6px 14px;border-radius:2px;z-index:30;box-shadow:2px 2px 0 rgba(0,0,0,0.25)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  // -------- Boot --------
  function boot() {
    resize();
    initKite();

    if (replayData) {
      // Clear fragment so "fly again" starts fresh-on-same-seed
      document.getElementById('start-btn').textContent = 'watch this flight';
      document.getElementById('start-btn').addEventListener('click', () => {
        startReplay(replayData);
      });
    } else {
      document.getElementById('start-btn').addEventListener('click', startSession);
    }
    document.getElementById('again-btn').addEventListener('click', () => {
      // Clear fragment so a fresh run doesn't get interpreted as replay
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      startSession();
    });

    requestAnimationFrame(step);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
