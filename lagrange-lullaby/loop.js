// loop.js — Lagrange Lullaby. Owns: physics state, render, sim state machine.

// physics constants in arbitrary units (1 unit ≈ canvas-radius / 2)
const G = 0.79;             // tuned so a 1.0-au* circular orbit takes ~5s
const STAR_RADIUS = 0.07;   // physical radius (collision threshold)
const ESCAPE_RADIUS = 4.0;  // |p - COM| beyond this = slingshot
const SIM_DURATION = 60.0;  // seconds of sim time
const DT = 0.005;
const SUBSTEPS = 3;         // 3 × DT = 0.015s sim per real frame ≈ realtime @60fps

const TIER = {
  STABLE_ORBIT:      { name: 'stable orbit',     desc: 'a quiet symmetry. your moon traced a clean loop without flinching.' },
  RESONANCE_HUGGER:  { name: 'resonance hugger', desc: 'locked tight against one star. the binary swung past — your moon never noticed.' },
  CAPTURED_WANDERER: { name: 'captured wanderer',desc: 'bound but unsettled. a new path every revolution, sixty seconds without escape.' },
  DOOMED_COMET:      { name: 'doomed comet',     desc: 'the gravity wells took it. either it smashed in, or it was hurled past the edge.' },
};

function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todaysSystem() {
  const seed = hash32(dayKey());
  const rng = mulberry32(seed);
  const ratio = 1.0 + rng() * 1.5;        // m1/m2 in [1.0, 2.5]
  const sepFactor = 0.88 + rng() * 0.27;  // separation in [0.88, 1.15]
  const phase0 = rng() * Math.PI * 2;
  const m2 = 1.0;
  const m1 = ratio * m2;
  const M = m1 + m2;
  const r = sepFactor;
  const omega = Math.sqrt(G * M / (r * r * r));
  return { m1, m2, M, r, r1: m2 / M * r, r2: m1 / M * r, omega, phase0, seed };
}

function starPositions(sys, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    s1: { x: -sys.r1 * c, y: -sys.r1 * s },
    s2: { x:  sys.r2 * c, y:  sys.r2 * s },
  };
}

function accelAt(sys, pos, angle) {
  const { s1, s2 } = starPositions(sys, angle);
  const dx1 = s1.x - pos.x, dy1 = s1.y - pos.y;
  const dx2 = s2.x - pos.x, dy2 = s2.y - pos.y;
  const r1sq = dx1 * dx1 + dy1 * dy1;
  const r2sq = dx2 * dx2 + dy2 * dy2;
  const r1 = Math.sqrt(r1sq);
  const r2 = Math.sqrt(r2sq);
  const a1 = G * sys.m1 / (r1sq * r1 + 1e-9);
  const a2 = G * sys.m2 / (r2sq * r2 + 1e-9);
  return { ax: a1 * dx1 + a2 * dx2, ay: a1 * dy1 + a2 * dy2 };
}

function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let cssW = 400, cssH = 400, scale = cssW / 4;
  function size() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(280, Math.floor(rect.width));
    cssH = cssW;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.height = cssW + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = cssW / 4;       // canvas spans ±2 physics units
  }
  return {
    ctx, size,
    get scale() { return scale; },
    get cssW() { return cssW; },
    get cssH() { return cssH; },
  };
}

export function startLoop(refs) {
  const { canvas, badgeEl, briefEl, metaEl, verdictEl, tierNameEl, tierDescEl, telemetryEl, againBtn } = refs;

  const renderer = makeRenderer(canvas);
  const sys = todaysSystem();
  metaEl.textContent =
    `// today's binary · α=${sys.m1.toFixed(2)} M☉ · β=${sys.m2.toFixed(2)} M☉ · sep=${sys.r.toFixed(2)} au* · period=${(2*Math.PI/sys.omega).toFixed(2)}s`;

  let state = 'PLACE';            // PLACE | SIMULATE | VERDICT
  let starAngle = sys.phase0;
  let t = 0;
  let moon = null;                // { x, y, vx, vy }
  let trail = [];
  let stats = null;
  let outcome = null;
  let lastFrame = null;
  let flashUntil = 0;
  let stepsSinceTrail = 0;

  function flashBadge(text, ms = 1400) {
    badgeEl.textContent = text;
    flashUntil = performance.now() + ms;
  }

  function placeMoonAt(x, y) {
    const { s1, s2 } = starPositions(sys, starAngle);
    const d1 = Math.hypot(x - s1.x, y - s1.y);
    const d2 = Math.hypot(x - s2.x, y - s2.y);
    if (d1 < STAR_RADIUS * 1.6 || d2 < STAR_RADIUS * 1.6) {
      flashBadge('// too close — the photosphere would vaporize it');
      return;
    }
    moon = { x, y, vx: 0, vy: 0 };
    trail = [{ x, y }];
    stats = newStats();
    t = 0;
    outcome = null;
    state = 'SIMULATE';
    badgeEl.textContent = '> SIMULATION RUNNING · t=0.0s';
    briefEl.style.display = 'none';
  }

  function newStats() {
    return {
      dist1Sum: 0, dist2Sum: 0,
      distCOMSum: 0, distCOMSqSum: 0,
      samples: 0,
      minDist1: Infinity, minDist2: Infinity,
      maxDistCOM: 0,
    };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (state !== 'PLACE') return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const x = (px / rect.width) * 4 - 2;
    const y = (py / rect.height) * 4 - 2;
    placeMoonAt(x, y);
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('gesturestart', (e) => e.preventDefault());

  function simStep(dt) {
    starAngle += sys.omega * dt;
    if (state !== 'SIMULATE' || !moon) return;

    const angleBefore = starAngle - sys.omega * dt;
    const a = accelAt(sys, moon, angleBefore);
    const nx = moon.x + moon.vx * dt + 0.5 * a.ax * dt * dt;
    const ny = moon.y + moon.vy * dt + 0.5 * a.ay * dt * dt;
    const a2 = accelAt(sys, { x: nx, y: ny }, starAngle);
    moon.x = nx; moon.y = ny;
    moon.vx += 0.5 * (a.ax + a2.ax) * dt;
    moon.vy += 0.5 * (a.ay + a2.ay) * dt;

    t += dt;

    const { s1, s2 } = starPositions(sys, starAngle);
    const d1 = Math.hypot(moon.x - s1.x, moon.y - s1.y);
    const d2 = Math.hypot(moon.x - s2.x, moon.y - s2.y);
    const dc = Math.hypot(moon.x, moon.y);
    stats.dist1Sum += d1; stats.dist2Sum += d2;
    stats.distCOMSum += dc; stats.distCOMSqSum += dc * dc;
    stats.samples++;
    if (d1 < stats.minDist1) stats.minDist1 = d1;
    if (d2 < stats.minDist2) stats.minDist2 = d2;
    if (dc > stats.maxDistCOM) stats.maxDistCOM = dc;

    if (d1 < STAR_RADIUS) { outcome = 'crashed_a'; finishVerdict(); return; }
    if (d2 < STAR_RADIUS) { outcome = 'crashed_b'; finishVerdict(); return; }
    if (dc > ESCAPE_RADIUS) { outcome = 'escaped'; finishVerdict(); return; }
    if (t >= SIM_DURATION) { outcome = 'survived'; finishVerdict(); return; }

    stepsSinceTrail++;
    if (stepsSinceTrail >= 8) {
      stepsSinceTrail = 0;
      trail.push({ x: moon.x, y: moon.y });
      if (trail.length > 1500) trail.shift();
    }
  }

  function classify() {
    if (outcome !== 'survived') return TIER.DOOMED_COMET;
    const meanCOM = stats.distCOMSum / stats.samples;
    const meanCOMSq = stats.distCOMSqSum / stats.samples;
    const stdCOM = Math.sqrt(Math.max(0, meanCOMSq - meanCOM * meanCOM));
    const meanD1 = stats.dist1Sum / stats.samples;
    const meanD2 = stats.dist2Sum / stats.samples;
    const tightStar = Math.min(meanD1, meanD2);
    const looseStar = Math.max(meanD1, meanD2);
    const ratio = tightStar / (looseStar + 1e-9);
    if (ratio < 0.45 && tightStar < sys.r * 0.7) return TIER.RESONANCE_HUGGER;
    if (stdCOM / (meanCOM + 1e-9) < 0.18) return TIER.STABLE_ORBIT;
    return TIER.CAPTURED_WANDERER;
  }

  function outcomeLabel(o) {
    if (o === 'crashed_a') return 'crashed into α';
    if (o === 'crashed_b') return 'crashed into β';
    if (o === 'escaped') return 'slingshot escape past edge';
    if (o === 'survived') return 'bound at t=60s';
    return o || 'unknown';
  }

  function finishVerdict() {
    state = 'VERDICT';
    const tier = classify();
    badgeEl.textContent = '// VERDICT LOGGED';
    tierNameEl.textContent = tier.name;
    tierDescEl.textContent = tier.desc;
    const meanCOM = stats.distCOMSum / Math.max(1, stats.samples);
    telemetryEl.textContent =
`> survived: ${t.toFixed(1)}s of ${SIM_DURATION.toFixed(0)}s
> peak distance from COM: ${stats.maxDistCOM.toFixed(2)} au*
> mean orbital radius: ${meanCOM.toFixed(2)} au*
> closest approach: α ${stats.minDist1.toFixed(2)} · β ${stats.minDist2.toFixed(2)} au*
> outcome: ${outcomeLabel(outcome)}`;
    verdictEl.hidden = false;
    window.__lastVerdict = { tier: tier.name, day: dayKey(), survived: t, outcome };
    requestAnimationFrame(() => {
      verdictEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function reset() {
    state = 'PLACE';
    t = 0;
    moon = null;
    trail = [];
    stats = null;
    outcome = null;
    verdictEl.hidden = true;
    badgeEl.textContent = '// MISSION: PLACEMENT';
    briefEl.style.display = '';
    flashUntil = 0;
    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  againBtn.addEventListener('click', reset);

  function draw() {
    const ctx = renderer.ctx;
    const W = renderer.cssW, H = renderer.cssH, S = renderer.scale;
    const cx = W / 2, cy = H / 2;
    const toX = (x) => cx + x * S;
    const toY = (y) => cy + y * S;

    // motion-blur veil
    ctx.fillStyle = 'rgba(6, 8, 13, 0.22)';
    ctx.fillRect(0, 0, W, H);

    // axis line
    const { s1, s2 } = starPositions(sys, starAngle);
    ctx.strokeStyle = 'rgba(108, 229, 232, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(s1.x), toY(s1.y));
    ctx.lineTo(toX(s2.x), toY(s2.y));
    ctx.stroke();

    // hint ring while placing — shows roughly where stable orbits live
    if (state === 'PLACE') {
      ctx.strokeStyle = 'rgba(108, 229, 232, 0.18)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, S * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // moon trail
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(108, 229, 232, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toX(trail[0].x), toY(trail[0].y));
      for (let i = 1; i < trail.length; i++) ctx.lineTo(toX(trail[i].x), toY(trail[i].y));
      ctx.stroke();
    }

    // stars (α larger if heavier)
    const r1px = STAR_RADIUS * S * Math.sqrt(sys.m1) * 1.2;
    const r2px = STAR_RADIUS * S * Math.sqrt(sys.m2) * 1.2;
    // glow halos
    ctx.fillStyle = 'rgba(240, 168, 48, 0.18)';
    ctx.beginPath(); ctx.arc(toX(s1.x), toY(s1.y), r1px * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 94, 126, 0.18)';
    ctx.beginPath(); ctx.arc(toX(s2.x), toY(s2.y), r2px * 2.2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#f0a830';
    ctx.beginPath(); ctx.arc(toX(s1.x), toY(s1.y), r1px, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5e7e';
    ctx.beginPath(); ctx.arc(toX(s2.x), toY(s2.y), r2px, 0, Math.PI * 2); ctx.fill();

    // star labels (α / β) — small monospace tag
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(240, 168, 48, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('α', toX(s1.x), toY(s1.y) - r1px - 4);
    ctx.fillStyle = 'rgba(255, 94, 126, 0.9)';
    ctx.fillText('β', toX(s2.x), toY(s2.y) - r2px - 4);

    // moon
    if (moon) {
      const mx = toX(moon.x), my = toY(moon.y);
      ctx.fillStyle = 'rgba(232, 238, 247, 0.30)';
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8eef7';
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // sim-time HUD update (skips while a flash message is up)
    if (state === 'SIMULATE' && performance.now() > flashUntil) {
      badgeEl.textContent = `> SIMULATION RUNNING · t=${t.toFixed(1)}s`;
    }
  }

  function frame(ts) {
    if (lastFrame === null) lastFrame = ts;
    const realDt = Math.min(0.05, (ts - lastFrame) / 1000);
    lastFrame = ts;

    if (state === 'SIMULATE') {
      for (let i = 0; i < SUBSTEPS; i++) simStep(DT);
    } else {
      starAngle += sys.omega * realDt;
    }

    draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(() => {
    renderer.size();
    requestAnimationFrame(frame);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderer.size(), 80);
  });
}
