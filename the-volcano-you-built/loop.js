// loop.js — heat-propagation grid simulation + render.
// 60-second session. Taps drop thermal energy onto a flat island grid.
// Cells above ignition threshold heat their neighbors; ridges emerge.
// On end: snapshots geography → derives a satellite portrait + named verdict.

const GRID = 60;                   // 60x60 cells; CSS scales canvas to viewport
const SESSION_S = 60;
const TAP_HEAT = 1.4;              // heat dropped on tap center
const TAP_RADIUS = 3;              // gaussian-ish drop radius (cells)
const IGNITE_THRESH = 0.55;        // neighbor-spread threshold
const SPREAD_RATE = 0.18;          // per-second flow into neighbors
const COOL_RATE = 0.025;           // per-second passive cooling
const ELEV_RATE = 0.55;            // per-second elevation gain when ignited

// Public state, captured for the result reveal.
export const state = {
  startedAt: 0,
  taps: [],            // [{x, y, t}]
  heat: null,          // Float32Array (GRID*GRID)
  elev: null,          // Float32Array — accumulated land
  ignited: null,       // Uint8Array — sticky "has ever ignited"
  peakHeat: 0,
  rafId: 0,
  running: false,
  onEnd: null,
};

let canvas, ctx, lastT = 0;
let onTapsChip, onTimeChip, onHeatChip, wrap;

export function startLoop({ onEnd, onUI }) {
  canvas = document.getElementById('island');
  ctx = canvas.getContext('2d');
  wrap = canvas.parentElement;

  onTapsChip = onUI.taps;
  onTimeChip = onUI.time;
  onHeatChip = onUI.heat;

  state.heat = new Float32Array(GRID * GRID);
  state.elev = new Float32Array(GRID * GRID);
  state.ignited = new Uint8Array(GRID * GRID);
  state.taps = [];
  state.peakHeat = 0;
  state.running = true;
  state.onEnd = onEnd;
  state.startedAt = performance.now();
  lastT = state.startedAt;

  wrap.classList.add('live');

  bindInput();
  state.rafId = requestAnimationFrame(tick);
}

function endLoop() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  wrap.classList.remove('live');
  if (state.onEnd) state.onEnd();
}

function bindInput() {
  const handler = (ev) => {
    if (!state.running) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const points = ev.touches ? Array.from(ev.touches) : [ev];
    for (const p of points) {
      const cx = (p.clientX - rect.left) * (GRID / rect.width);
      const cy = (p.clientY - rect.top)  * (GRID / rect.height);
      dropHeat(cx, cy);
    }
  };
  canvas.addEventListener('mousedown', handler, { passive: false });
  canvas.addEventListener('touchstart', handler, { passive: false });
}

function dropHeat(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return;
  const r = TAP_RADIUS;
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= GRID) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= GRID) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 > r2) continue;
      const falloff = Math.exp(-d2 / (r2 * 0.45));
      state.heat[y * GRID + x] += TAP_HEAT * falloff;
    }
  }
  state.taps.push({ x: cx / GRID, y: cy / GRID, t: performance.now() - state.startedAt });
  if (onTapsChip) onTapsChip(state.taps.length);
}

function tick(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  step(dt);
  render();

  const elapsed = (now - state.startedAt) / 1000;
  const remaining = Math.max(0, SESSION_S - elapsed);
  if (onTimeChip) onTimeChip(remaining);
  if (onHeatChip) onHeatChip(state.peakHeat);

  if (elapsed >= SESSION_S) { endLoop(); return; }
  state.rafId = requestAnimationFrame(tick);
}

function step(dt) {
  const heat = state.heat, elev = state.elev, ig = state.ignited;
  const next = new Float32Array(heat.length);
  let peak = 0;

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      let h = heat[i];

      // ignition spreads from this cell to neighbors if above threshold
      if (h >= IGNITE_THRESH) {
        ig[i] = 1;
        let outflow = 0;
        for (const [dx, dy] of NEI) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          const flow = SPREAD_RATE * dt * (h - heat[ni]) * 0.25;
          if (flow > 0) {
            next[ni] += flow;
            outflow += flow;
          }
        }
        h -= outflow;
        elev[i] += ELEV_RATE * dt * Math.min(1, h);
      }

      // passive cooling
      h -= COOL_RATE * dt;
      if (h < 0) h = 0;

      next[i] += h;
      if (next[i] > peak) peak = next[i];
    }
  }
  state.heat = next;
  if (peak > state.peakHeat) state.peakHeat = peak;
}

const NEI = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];

function render() {
  const w = canvas.width, h = canvas.height;
  const cw = w / GRID, ch = h / GRID;

  // sea
  ctx.fillStyle = '#03121a';
  ctx.fillRect(0, 0, w, h);

  // island disc backdrop (soft falloff so taps near edge make sense)
  const cxw = w * 0.5, cyw = h * 0.5, rad = w * 0.46;
  const grad = ctx.createRadialGradient(cxw, cyw, rad * 0.15, cxw, cyw, rad);
  grad.addColorStop(0, '#1a3640');
  grad.addColorStop(0.7, '#0e2630');
  grad.addColorStop(1, '#03121a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cxw, cyw, rad, 0, Math.PI * 2);
  ctx.fill();

  // grid: layered land + heat
  const heat = state.heat, elev = state.elev;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const e = elev[i];
      const hh = heat[i];
      if (e < 0.02 && hh < 0.02) continue;

      const px = x * cw, py = y * ch;

      // land cell — color ramps darker → ochre with elevation
      if (e > 0.02) {
        const t = Math.min(1, e / 4);
        const r = lerp(48, 130, t);
        const g = lerp(36, 88, t);
        const b = lerp(28, 52, t);
        ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
      }

      // heat overlay — orange to white-hot
      if (hh > 0.05) {
        const t = Math.min(1, hh / 1.6);
        const r = 255;
        const g = lerp(70, 230, t);
        const b = lerp(20, 140, t);
        const a = Math.min(0.95, 0.25 + t);
        ctx.fillStyle = `rgba(${r},${g|0},${b|0},${a})`;
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
      }
    }
  }

  // crosshair / scale ticks (instrument feel, light cost)
  ctx.strokeStyle = 'rgba(255,177,74,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
  ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
  ctx.stroke();
}

function lerp(a, b, t) { return a + (b - a) * t; }

export function getGridSize() { return GRID; }
