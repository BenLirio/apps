/* audio.js — Hum The Shape
 *
 * Owns: AudioContext setup, AnalyserNode wiring, autocorrelation pitch
 * detection, DTW scoring, and the three deterministic target shapes.
 *
 * Pure data + math; no DOM. loop.js owns rendering, state, and the rAF tick.
 */

// ── Three target shapes — deterministic, pre-defined data ────────────
// Each target is a normalised pitch contour (y in [0,1], length SAMPLES).
// 0 = lowest, 1 = highest. Drawn into the canvas vertically inverted in loop.js
// (so 0 → top of canvas in pitch space, NOT top of canvas in CSS space).
export const SAMPLES = 200;
export const ROUND_SECONDS = 8;

export const SHAPES = [
  { name: "clean U",          id: "u",    points: buildU() },
  { name: "sawtooth",         id: "saw",  points: buildSaw() },
  { name: "small angry duck", id: "duck", points: buildDuck() },
];

function buildU() {
  const out = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    // parabola: edges high (≈0.95), middle low (≈0.10)
    const y = 1 - 4 * t * (1 - t) * 0.85;
    out.push(clamp01(y));
  }
  return out;
}
function buildSaw() {
  const out = [];
  const teeth = 3;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const phase = (t * teeth) % 1;
    out.push(clamp01(0.18 + phase * 0.74));
  }
  return out;
}
function buildDuck() {
  // sum of sines + a few angry spikes — deterministic squiggle
  const out = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    let y = 0.5
      + 0.22 * Math.sin(t * Math.PI * 2.0 + 0.3)
      + 0.14 * Math.sin(t * Math.PI * 5.5 + 1.2)
      - 0.10 * Math.sin(t * Math.PI * 9.0 + 0.7);
    y += spike(t, 0.30, 0.05, 0.18);
    y += spike(t, 0.62, 0.04, 0.14);
    y -= spike(t, 0.85, 0.06, 0.20);
    out.push(clamp01(y));
  }
  return out;
}
function spike(t, center, width, amp) {
  const d = (t - center) / width;
  return amp * Math.exp(-d * d);
}
function clamp01(x) { return Math.max(0.05, Math.min(0.95, x)); }

// ── DTW — O(n·m), short sequences, returns mean per-step cost in [0,1]
export function dtw(a, b) {
  const n = a.length, m = b.length;
  let prev = new Float32Array(m + 1).fill(Infinity);
  let curr = new Float32Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m] / Math.max(n, m);
}

// ── Verdict tiers — deterministic from total overlap %
export function verdictFor(pct) {
  if (pct >= 78) return { name: "CHOIRMASTER",      tone: "the algorithm bows." };
  if (pct >= 58) return { name: "KARAOKE ADJACENT", tone: "competent. unsettlingly so." };
  if (pct >= 38) return { name: "CIVILIAN",         tone: "you exist on the pitch axis." };
  return            { name: "THE KAZOO OF THESEUS", tone: "every note replaced. still recognizably you." };
}

// ── Pitch detection — autocorrelation on AnalyserNode time-domain
// Returns Hz, or 0 on silence / no clear pitch.
export function detectPitch(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.012) return 0;

  const maxLag = Math.floor(sampleRate / 60);
  const minLag = Math.floor(sampleRate / 600);
  let bestLag = -1, bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < SIZE - lag; i++) corr += buf[i] * buf[i + lag];
    corr /= (SIZE - lag);
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  if (bestLag === -1 || bestCorr < 0.005) return 0;
  return sampleRate / bestLag;
}

// ── Mic acquisition — returns { ctx, analyser, buf } or throws
export async function acquireMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
  }});
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctxA = new Ctx();
  if (ctxA.state === "suspended") await ctxA.resume();
  const source = ctxA.createMediaStreamSource(stream);
  const analyser = ctxA.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  return { ctx: ctxA, analyser, buf: new Float32Array(analyser.fftSize), source };
}
