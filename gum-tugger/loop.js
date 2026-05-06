// loop.js — physics simulation + lifecycle. Owns the strand, the snap, and
// the requestAnimationFrame tick. Rendering is delegated to render.js.
//
// Model: a 1D chain of N point-masses connected by structural springs along a
// vertical axis from the anchor (top of stage) to the user's finger. The user
// drags the LAST node (the "tip"); springs propagate through the chain so the
// strand stretches with elastic give and "lags" behind the finger. When the
// maximum-segment strain exceeds the snap threshold for a sustained window,
// the strand breaks.
//
// Three pulls per session: the strand re-anchors after each release/snap.
// We expose hooks for app.js to read length, render readout, and store ghost.
//
// Coordinates: the canvas uses CSS pixels via ctx.scale(dpr,dpr). Lengths are
// converted via PX_PER_CM so the readout reads in centimeters.

import { bakeGrain, drawBackdrop, drawAnchorClamp, drawStrand, drawGhostStrands } from './render.js';

const PX_PER_CM = 18;          // canvas-pixel scale for the readout (tactile, not metric)
const N_NODES   = 36;          // chain nodes (incl anchor + tip)
const STRUCTURE_K = 1700;      // structural spring stiffness per segment
const NODE_MASS  = 0.012;      // each node's mass (kg-ish, tuned)
const DAMP_NODE  = 5.5;        // velocity damping per node (stops oscillation)
const GRAVITY    = 360;        // px/s^2
const SUBSTEPS   = 6;          // physics substeps per frame for stability
const MAX_DT     = 0.033;      // cap dt so backgrounded tabs don't snowball

// Strain = current segment length / rest length.
const SNAP_STRAIN_THRESHOLD = 4.6;
const SNAP_STRAIN_SUSTAIN_MS = 90;

let grainCanvas = null;
let cv, ctx;
let cssW = 0, cssH = 0;
let dpr = 1;

let strand = null;
let ghost  = null;
let pulling = false;
let pointerActive = false;
let pointerX = 0, pointerY = 0;

let cb = {};
let lastSnapLengthCm = 0;

// ---------- public api ----------

export function startLoop(callbacks) {
  cb = callbacks || {};
  cv = document.getElementById('cv');
  ctx = cv.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);

  cv.addEventListener('pointerdown',   onDown, { passive: false });
  cv.addEventListener('pointermove',   onMove, { passive: false });
  cv.addEventListener('pointerup',     onUp,   { passive: false });
  cv.addEventListener('pointercancel', onUp,   { passive: false });
  cv.addEventListener('contextmenu',  (e) => e.preventDefault());
  cv.addEventListener('gesturestart', (e) => e.preventDefault());

  if (callbacks && callbacks.ghost) ghost = makeGhost(callbacks.ghost);

  requestAnimationFrame(tick);
}

export function isPulling() { return pulling; }
export function getLastSnapLength() { return lastSnapLengthCm; }

// ---------- canvas sizing ----------

function resize() {
  // ResizeObserver-ish: read post-layout via rAF, avoiding the first-load stretch race.
  requestAnimationFrame(() => {
    const rect = cv.getBoundingClientRect();
    cssW = Math.max(1, Math.floor(rect.width));
    cssH = Math.max(1, Math.floor(rect.height));
    dpr  = Math.min(2, window.devicePixelRatio || 1);
    cv.width  = Math.floor(cssW * dpr);
    cv.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    grainCanvas = bakeGrain(cssW, cssH);
  });
}

// ---------- input ----------

function eventXY(e) {
  const rect = cv.getBoundingClientRect();
  return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}

function onDown(e) {
  e.preventDefault();
  cv.setPointerCapture?.(e.pointerId);
  const { x, y } = eventXY(e);
  pointerX = x; pointerY = y;
  pointerActive = true;
  startPull(x, y);
}

function onMove(e) {
  if (!pointerActive) return;
  e.preventDefault();
  const { x, y } = eventXY(e);
  pointerX = x; pointerY = y;
}

function onUp(e) {
  if (!pointerActive) return;
  pointerActive = false;
  e.preventDefault();
  if (pulling && strand) endPull(false);
}

// ---------- strand lifecycle ----------

function startPull(x, y) {
  if (cb.onFirstTouch) cb.onFirstTouch();

  const anchorX = cssW * 0.5;
  const anchorY = -2;     // just above the visible stage so it looks "from above"
  // Tiny rest-segment so the user has a long way to *stretch* before snap.
  const restSegLen = Math.max(2.5, Math.min(8, cssH * 0.012));

  const nodes = [];
  for (let i = 0; i < N_NODES; i++) {
    const t = i / (N_NODES - 1);
    nodes.push({
      x: anchorX,
      y: anchorY + t * (restSegLen * (N_NODES - 1)),
      vx: 0, vy: 0,
      pinned: i === 0,
    });
  }
  // Tip starts at the finger.
  nodes[N_NODES - 1].x = x;
  nodes[N_NODES - 1].y = y;
  nodes[N_NODES - 1].pinned = false;

  strand = {
    nodes,
    anchorX, anchorY,
    restSegLen,
    snapped: false,
    snapStartT: 0,
    sustainT: 0,
    bornAt: performance.now(),
  };
  pulling = true;
}

function endPull(snapped) {
  if (!strand) return;
  const lenPx = currentLengthPx(strand);
  const cm = pxToCm(lenPx);
  pulling = false;

  if (snapped) {
    lastSnapLengthCm = cm;
    flashStage();
  }

  if (snapped && cb.onSnap)     cb.onSnap({ length: cm, snapped: true });
  if (!snapped && cb.onRelease) cb.onRelease({ length: cm, snapped: false });

  strand.recoiling = true;
  strand.recoilStart = performance.now();
}

function flashStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  stage.classList.remove('flash');
  void stage.offsetWidth;
  stage.classList.add('flash');
}

// ---------- physics ----------

function step(dtTotal) {
  if (!strand) return;
  const dt = Math.min(MAX_DT, dtTotal);
  const sub = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) substep(sub);
  if (strand.recoiling) {
    if (performance.now() - strand.recoilStart > 360) strand = null;
  }
}

function substep(h) {
  const nodes = strand.nodes;
  const n = nodes.length;
  const restL = strand.restSegLen;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.pinned) { node.vx = 0; node.vy = 0; continue; }
    let fx = 0, fy = 0;

    fy += GRAVITY * NODE_MASS;

    if (i > 0) {
      const a = nodes[i - 1];
      const dx = node.x - a.x, dy = node.y - a.y;
      const d  = Math.max(1e-3, Math.hypot(dx, dy));
      const ex = dx / d, ey = dy / d;
      const f = -STRUCTURE_K * (d - restL);
      fx += f * ex; fy += f * ey;
    }
    if (i < n - 1) {
      const b = nodes[i + 1];
      const dx = node.x - b.x, dy = node.y - b.y;
      const d  = Math.max(1e-3, Math.hypot(dx, dy));
      const ex = dx / d, ey = dy / d;
      const f = -STRUCTURE_K * (d - restL);
      fx += f * ex; fy += f * ey;
    }

    fx -= DAMP_NODE * node.vx * NODE_MASS;
    fy -= DAMP_NODE * node.vy * NODE_MASS;

    node.vx += (fx / NODE_MASS) * h;
    node.vy += (fy / NODE_MASS) * h;
  }

  // Tip target: stick the tip near the pointer when pulling
  if (pulling && pointerActive && !strand.recoiling) {
    const tip = nodes[n - 1];
    const k = 38, c = 4.0;
    tip.vx += (-k * (tip.x - pointerX) - c * tip.vx) * h;
    tip.vy += (-k * (tip.y - pointerY) - c * tip.vy) * h;
  }

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.pinned) continue;
    node.x += node.vx * h;
    node.y += node.vy * h;
  }
}

function checkSnap(now) {
  if (!strand || strand.snapped || strand.recoiling) return;
  const m = maxStrainOf(strand);
  if (m >= SNAP_STRAIN_THRESHOLD) {
    if (strand.snapStartT === 0) strand.snapStartT = now;
    strand.sustainT = now - strand.snapStartT;
    if (strand.sustainT >= SNAP_STRAIN_SUSTAIN_MS) {
      strand.snapped = true;
      endPull(true);
    }
  } else {
    strand.snapStartT = 0;
    strand.sustainT = 0;
  }
}

function currentLengthPx(s) {
  let total = 0;
  for (let i = 1; i < s.nodes.length; i++) {
    const dx = s.nodes[i].x - s.nodes[i - 1].x;
    const dy = s.nodes[i].y - s.nodes[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function pxToCm(px) { return px / PX_PER_CM; }

function maxStrainOf(s) {
  let m = 1;
  const restL = s.restSegLen;
  const nodes = s.nodes;
  for (let i = 1; i < nodes.length; i++) {
    const d = Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y);
    const ss = d / restL;
    if (ss > m) m = ss;
  }
  return m;
}

function makeGhost(g) {
  const lengths = (g.lengths || []).slice(0, 3).map((v) => Math.max(0.1, +v || 0));
  return { lengths };
}

// ---------- main loop ----------

let prev = 0;
function tick(now) {
  if (!prev) prev = now;
  const dt = (now - prev) / 1000;
  prev = now;

  if (strand && !strand.recoiling) {
    step(dt);
    checkSnap(now);
  }

  // Render
  drawBackdrop(ctx, cssW, cssH, grainCanvas);
  drawAnchorClamp(ctx, cssW * 0.5, 0);
  if (ghost) drawGhostStrands(ctx, ghost, cssW, cssH, now, PX_PER_CM);
  if (strand) drawStrand(ctx, strand, cssW, { maxStrain: maxStrainOf(strand) });

  // Push readout (cm) to app.
  if (cb.onTickReadout && strand && !strand.recoiling) {
    const cm = pxToCm(currentLengthPx(strand));
    const snapping = strand.snapStartT > 0 && !strand.snapped;
    cb.onTickReadout(cm, snapping);
  }

  requestAnimationFrame(tick);
}
