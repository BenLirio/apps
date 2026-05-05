// pure logic. no DOM. owns the synthetic distribution model, the percentile
// math, the SVG-density helper, and the share-fragment encode/decode.

const TARGET_MS = 1000;          // bullseye
const RANGE_LO = 500;            // ms — below this is off the curve (under)
const RANGE_HI = 1500;           // ms — above this is off the curve (over)

// SCALE is the Laplace scale parameter on |delta-from-target|. it both
// (a) defines the percentile mapping `beat% = 100 * exp(-|delta|/SCALE)` and
// (b) shapes the visible density curve. a single source of truth means the
// number a player reads ("beat 73%") matches the visual area to the right
// of their pin. SCALE=120 lands the median attempt around |delta|≈83ms,
// matching observed human button-press timing without a visible reference.
const SCALE = 120;

// scoreboard tiers, keyed on absolute |delta| in ms. labels are designed to
// read like a competitive scoreboard, not a fortune-teller's verdict.
const TIERS = [
  { maxDelta: 5,        key: 'bullseye', label: 'BULLSEYE' },
  { maxDelta: 15,       key: 'dead-on',  label: 'DEAD-ON'  },
  { maxDelta: 40,       key: 'sharp',    label: 'SHARP'    },
  { maxDelta: 80,       key: 'close',    label: 'CLOSE'    },
  { maxDelta: 150,      key: 'loose',    label: 'LOOSE'    },
  { maxDelta: 300,      key: 'wide',     label: 'WIDE'     },
  { maxDelta: Infinity, key: 'off',      label: 'OFF THE CURVE' },
];

function tierFor(absDeltaMs) {
  for (const t of TIERS) if (absDeltaMs <= t.maxDelta) return t;
  return TIERS[TIERS.length - 1];
}

function fmtSec(ms) {
  return (ms / 1000).toFixed(3) + 's';
}

function fmtSignedDelta(ms) {
  if (ms === 0) return '±0ms';
  const sign = ms > 0 ? '+' : '−';
  return sign + Math.abs(Math.round(ms)) + 'ms';
}

// % of the modeled population with strictly larger |delta| than yours.
// reserve 100 for nobody (a zero-delta hold reads "beat 99%") so the
// scoreboard always leaves head-room above any real attempt.
export function beatPctFor(durationMs) {
  const absDelta = Math.abs(durationMs - TARGET_MS);
  const raw = 100 * Math.exp(-absDelta / SCALE);
  if (absDelta === 0) return 99;
  return Math.max(0, Math.min(99, Math.round(raw)));
}

// height of the density curve at a given duration in ms, normalized so the
// peak at TARGET_MS equals 1.0. used to draw the SVG path.
function densityAtMs(durationMs) {
  const absDelta = Math.abs(durationMs - TARGET_MS);
  return Math.exp(-absDelta / SCALE);
}

// pre-baked SVG path for the density curve, drawn once at module load.
// viewBox is 1000 wide × 100 tall; 1 unit on x = 1ms over [RANGE_LO..RANGE_HI].
// the path is closed along the baseline so it can be filled.
export const CURVE_PATH = (() => {
  const W = 1000, H = 100, BASE_PAD = 6, PEAK_H = 80;
  const pts = [];
  for (let ms = RANGE_LO; ms <= RANGE_HI; ms += 5) {
    const x = ms - RANGE_LO;
    const y = (H - BASE_PAD) - densityAtMs(ms) * PEAK_H;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M ${pts[0]} L ${pts.join(' L ')} L ${W},${H - BASE_PAD} L 0,${H - BASE_PAD} Z`;
})();

// map a duration in ms to an x in the curve's viewBox; clamp so off-curve
// pins still render at the edge instead of vanishing.
export function pinXFor(durationMs) {
  const x = durationMs - RANGE_LO;
  return Math.max(0, Math.min(1000, x));
}

export const TARGET_X = TARGET_MS - RANGE_LO; // 500
export const CURVE_VIEWBOX = '0 0 1000 100';

// the central deterministic function. give it a duration in ms, get back
// everything the result + final screens need to render.
export function computeResult(durationMs) {
  durationMs = Math.max(0, Math.round(durationMs));
  const isOutOfRange = durationMs < RANGE_LO || durationMs >= RANGE_HI;
  const signedDelta = durationMs - TARGET_MS;
  const absDelta = Math.abs(signedDelta);
  const tier = tierFor(absDelta);
  return {
    durationMs,
    durationStr: fmtSec(durationMs),
    deltaMs: signedDelta,
    deltaStr: fmtSignedDelta(signedDelta),
    beatPct: beatPctFor(durationMs),
    tierKey: tier.key,
    tierLabel: tier.label,
    pinX: pinXFor(durationMs),
    isOutOfRange,
  };
}

// the closest of three results — i.e. the one that beat the most of the field.
// shown as the headline number on the final screen.
export function bestOf(results) {
  if (!results || results.length === 0) return null;
  return results.reduce((best, r) => (r.beatPct > best.beatPct ? r : best), results[0]);
}

// share-fragment shape: `h=847,1023,962`. backwards compatible with the old
// confessional-era format that included `&d=YYYYMMDD` (we ignore extra params).
export function encodeShare(durationsMs) {
  const safe = durationsMs.map(d => Math.max(0, Math.min(9999, Math.round(d))));
  return `h=${safe.join(',')}`;
}

export function decodeShare(fragmentRaw) {
  if (!fragmentRaw) return null;
  const fragment = fragmentRaw.replace(/^#/, '');
  const params = new URLSearchParams(fragment);
  const hStr = params.get('h');
  if (!hStr) return null;
  const durationsMs = hStr.split(',').map(Number);
  if (durationsMs.length !== 3 || durationsMs.some(n => isNaN(n))) return null;
  return { durationsMs };
}
