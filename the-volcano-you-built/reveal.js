// reveal.js — analyze the elev grid into named geography and render the
// satellite portrait. Pure functions of state; deterministic over the same
// (taps, elev) sequence.

import { state, getGridSize } from './loop.js';

const GRID = getGridSize();

// ---------- analysis ----------

function findCones(elev) {
  // local maxima above a floor; cluster within radius into cone groups
  const cones = [];
  const FLOOR = 0.6;
  const MIN_DIST = 5; // cone separation in cells

  const peaks = [];
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const i = y * GRID + x;
      const v = elev[i];
      if (v < FLOOR) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (elev[(y + dy) * GRID + (x + dx)] > v) { isMax = false; break; }
        }
      }
      if (isMax) peaks.push({ x, y, h: v });
    }
  }
  // sort tallest first, greedily collapse close peaks
  peaks.sort((a, b) => b.h - a.h);
  for (const p of peaks) {
    let merged = false;
    for (const c of cones) {
      const dx = c.x - p.x, dy = c.y - p.y;
      if (Math.sqrt(dx*dx + dy*dy) < MIN_DIST) { merged = true; break; }
    }
    if (!merged) cones.push(p);
    if (cones.length >= 8) break;
  }
  return cones;
}

function ridgeAxis(cones) {
  if (cones.length < 2) return null;
  // PCA-lite via covariance of cone positions weighted by height
  let mx = 0, my = 0, w = 0;
  for (const c of cones) { mx += c.x * c.h; my += c.y * c.h; w += c.h; }
  mx /= w; my /= w;
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of cones) {
    const dx = c.x - mx, dy = c.y - my;
    sxx += dx * dx * c.h;
    syy += dy * dy * c.h;
    sxy += dx * dy * c.h;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy); // radians
  // anisotropy ratio gives ridge "stretchedness"
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const root = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + root;
  const l2 = tr / 2 - root;
  const aniso = l2 > 0.0001 ? l1 / l2 : 9;
  return { theta, aniso, mx, my };
}

function bearing(theta) {
  // theta in [-pi, pi] from PCA. Convert to compass direction of the long axis.
  // 0 rad → x-axis = E-W. pi/2 → N-S.
  const deg = ((theta * 180 / Math.PI) % 180 + 180) % 180; // 0..180
  if (deg < 22.5)  return 'East-West';
  if (deg < 67.5)  return 'NE-SW';
  if (deg < 112.5) return 'North-South';
  if (deg < 157.5) return 'NW-SE';
  return 'East-West';
}

function quadrant(mx, my) {
  // which quadrant of the island the volcano centers on
  const cx = GRID / 2, cy = GRID / 2;
  const dx = mx - cx, dy = my - cy;
  const r = Math.sqrt(dx*dx + dy*dy);
  if (r < GRID * 0.08) return 'Centerline';
  // dy is screen-y (down). North = -dy.
  const ang = Math.atan2(-dy, dx) * 180 / Math.PI; // -180..180, 0=East
  const a = (ang + 360) % 360;
  if (a < 22.5 || a >= 337.5) return 'East-Face';
  if (a < 67.5)  return 'NE-Face';
  if (a < 112.5) return 'North-Face';
  if (a < 157.5) return 'NW-Face';
  if (a < 202.5) return 'West-Face';
  if (a < 247.5) return 'SW-Face';
  if (a < 292.5) return 'South-Face';
  return 'SE-Face';
}

// ---------- naming ----------

const TEMPER_PREFIXES = {
  // by peakHeat band
  cool:   ['Slow-Burn', 'Smolder', 'Whisper', 'Drowsy', 'Half-Lit'],
  warm:   ['Mid-Boil', 'Quietkettle', 'Slow-Speak', 'Patient'],
  hot:    ['Hard-Bake', 'Open-Throat', 'Loud-Mouth', 'Riot'],
  searing:['Skyrip', 'Furnace-Wake', 'Hellgate', 'Magmajaw', 'Wildtongue'],
};
const SHAPE_NOUNS = {
  one:    ['Cone', 'Pillar', 'Lone Peak', 'Single', 'Spine'],
  twin:   ['Twin', 'Two-Cone', 'Forked', 'Dyad', 'Pair'],
  tri:    ['Tri-Cone', 'Triarch', 'Triad', 'Three-Tooth', 'Fang-Trio'],
  many:   ['Crown', 'Comb', 'Chain', 'Fence', 'Hydra', 'Reef'],
};

function pickFromBand(arr, h) {
  // deterministic pick by hash h over arr
  return arr[h % arr.length];
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function temperBand(peakHeat) {
  if (peakHeat < 0.85) return 'cool';
  if (peakHeat < 1.4)  return 'warm';
  if (peakHeat < 2.0)  return 'hot';
  return 'searing';
}

function shapeBand(coneCount) {
  if (coneCount <= 1) return 'one';
  if (coneCount === 2) return 'twin';
  if (coneCount === 3) return 'tri';
  return 'many';
}

function deriveName(geom, peakHeat, taps) {
  // hash over the actual tap geography so the name is reproducible & specific
  let acc = '';
  for (const t of taps) {
    acc += `${t.x.toFixed(2)},${t.y.toFixed(2)}|`;
  }
  acc += `:${geom.cones.length}:${peakHeat.toFixed(2)}`;
  const h = hashStr(acc);

  const tBand = temperBand(peakHeat);
  const sBand = shapeBand(geom.cones.length);
  const temper = pickFromBand(TEMPER_PREFIXES[tBand], h);
  const shape = pickFromBand(SHAPE_NOUNS[sBand], h >> 4);

  let prefix;
  if (geom.cones.length >= 2 && geom.axis) {
    // ridge form: "Mt. Hard-Bake Tri-Cone NE-SW"
    prefix = `Mt. ${temper} ${shape} ${bearing(geom.axis.theta)}`;
  } else if (geom.cones.length === 1) {
    // single cone: orient by quadrant
    const q = quadrant(geom.cones[0].x, geom.cones[0].y);
    prefix = `Mt. ${temper} ${shape} ${q}`;
  } else {
    // no real cones — the user under-tapped and produced glow without rise
    prefix = `Mt. ${temper} ${shape}`;
  }
  return prefix;
}

function deriveBlurb(geom, peakHeat, taps) {
  const tBand = temperBand(peakHeat);
  const sBand = shapeBand(geom.cones.length);

  const flavor = {
    cool:    'Crust never quite gave. Fumaroles, no flow.',
    warm:    'Crust opened on a slow timetable. Steady plume, civic temperament.',
    hot:     'Crust split fast. Vents argued with each other.',
    searing: 'Mantle came up like it had something to prove. Crust was a formality.',
  }[tBand];

  const shapeNote = {
    one:  'A solitary build — every tap fed the same throat.',
    twin: 'Twin throats; the ridge negotiates between them.',
    tri:  'Three peaks share a baseline. Eruption order is a matter of mood.',
    many: 'A chain emerged. Hard to assign authorship to any single vent.',
  }[sBand];

  const tapNote = `${taps.length} thermal events logged in 60s.`;

  return `${flavor} ${shapeNote} ${tapNote}`;
}

// ---------- satellite render ----------

function renderSatellite(canvas, elev, ignited, geom) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cw = w / GRID, ch = h / GRID;

  // dark sea
  ctx.fillStyle = '#021018';
  ctx.fillRect(0, 0, w, h);

  // soft sea-floor halo where land sits
  const cxw = w * 0.5, cyw = h * 0.5, rad = w * 0.48;
  const grad = ctx.createRadialGradient(cxw, cyw, rad * 0.1, cxw, cyw, rad);
  grad.addColorStop(0, '#0b232c');
  grad.addColorStop(0.8, '#03141c');
  grad.addColorStop(1, '#01080d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cxw, cyw, rad, 0, Math.PI * 2);
  ctx.fill();

  // shaded relief — fake hillshade by computing slope and lighting from NW
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const e = elev[i];
      if (e < 0.02) continue;

      // gradient
      const ex1 = elev[y * GRID + Math.min(GRID - 1, x + 1)];
      const ex0 = elev[y * GRID + Math.max(0, x - 1)];
      const ey1 = elev[Math.min(GRID - 1, y + 1) * GRID + x];
      const ey0 = elev[Math.max(0, y - 1) * GRID + x];
      const gx = (ex1 - ex0) * 0.5;
      const gy = (ey1 - ey0) * 0.5;

      // light from NW (in screen coords: -1, -1)
      const lx = -0.7071, ly = -0.7071;
      const slopeMag = Math.sqrt(gx*gx + gy*gy) || 0.0001;
      const dot = (-gx * lx + -gy * ly) / slopeMag;
      const shade = clamp(0.55 + dot * 0.45, 0.2, 1.0);

      const t = Math.min(1, e / 4);
      // base color: dark basalt → ochre at elevation
      const r = lerp(58, 168, t) * shade;
      const g = lerp(44, 110, t) * shade;
      const b = lerp(34, 64, t)  * shade;

      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
    }
  }

  // crater glow at each cone
  for (const c of geom.cones) {
    const px = c.x * cw + cw / 2;
    const py = c.y * ch + ch / 2;
    const cR = Math.max(cw, ch) * (1.5 + Math.min(2, c.h * 0.4));
    const cg = ctx.createRadialGradient(px, py, 0, px, py, cR);
    cg.addColorStop(0, 'rgba(255,210,120,0.95)');
    cg.addColorStop(0.4, 'rgba(255,120,40,0.65)');
    cg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(px, py, cR, 0, Math.PI * 2);
    ctx.fill();
  }

  // grid graticule overlay (satellite ticks)
  ctx.strokeStyle = 'rgba(255,177,74,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (let i = 1; i < 10; i++) {
    const x = (w / 10) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    const y = (h / 10) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  return geom;
}

// animated steam vents — drawn each frame on top of the still satellite
function startSteamLoop(canvas, geom) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cw = w / GRID, ch = h / GRID;

  // we keep a snapshot of the static satellite + repaint vents on top
  const snap = ctx.getImageData(0, 0, w, h);

  let t0 = performance.now();
  const puffs = geom.cones.map((c, i) => ({
    x: c.x * cw + cw / 2,
    y: c.y * ch + ch / 2,
    seed: i * 1.7 + 0.31,
    intensity: clamp(0.5 + c.h * 0.25, 0.5, 1.4),
  }));

  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.putImageData(snap, 0, 0);

    for (const p of puffs) {
      for (let k = 0; k < 6; k++) {
        const phase = (t * 0.35 + p.seed + k * 0.18) % 1;
        const py = p.y - phase * (cw * 8);
        const px = p.x + Math.sin((t + p.seed) * 1.5 + k) * (cw * 1.4);
        const r = (cw * 1.4) * (0.5 + phase * 1.2) * p.intensity;
        const a = (1 - phase) * 0.45 * p.intensity;
        const sg = ctx.createRadialGradient(px, py, 0, px, py, r);
        sg.addColorStop(0, `rgba(255,240,220,${a})`);
        sg.addColorStop(1, 'rgba(255,240,220,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- public entrypoint ----------

export function reveal(els) {
  const elev = state.elev;
  const ignited = state.ignited;
  const cones = findCones(elev);
  const axis = ridgeAxis(cones);
  const geom = { cones, axis };

  const peakHeat = state.peakHeat;
  const taps = state.taps;
  const name = deriveName(geom, peakHeat, taps);
  const blurb = deriveBlurb(geom, peakHeat, taps);

  // fake telemetry coords derived deterministically from the geography hash
  const seedStr = `${name}|${peakHeat.toFixed(2)}|${taps.length}`;
  const sh = hashStr(seedStr);
  const lat = ((sh % 1800) / 10 - 90).toFixed(2);
  const lon = (((sh >> 5) % 3600) / 10 - 180).toFixed(2);
  const elevM = (1200 + (sh % 2400)).toString();

  // populate UI
  els.name.textContent = name;
  els.blurb.textContent = blurb;
  els.satLat.textContent = `${lat}°`;
  els.satLon.textContent = `${lon}°`;
  els.satElev.textContent = `${elevM} m`;
  els.satVents.textContent = `${cones.length}`;
  els.statCones.textContent = `${cones.length}`;
  els.statRidge.textContent = cones.length >= 2 && axis ? bearing(axis.theta) : '—';
  els.statHeat.textContent = `${(peakHeat * 100) | 0}%`;
  els.statTaps.textContent = `${taps.length}`;
  els.resultSeedChip.textContent = `SEED: ${(sh.toString(36).slice(-6).toUpperCase())}`;

  // render satellite + start steam vents
  renderSatellite(els.satCanvas, elev, ignited, geom);
  startSteamLoop(els.satCanvas, geom);

  // expose share state
  window.__volcano = { name, blurb, lat, lon, elev: elevM, vents: cones.length, seed: sh.toString(36).slice(-6).toUpperCase() };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
