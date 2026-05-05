// pure logic. no DOM, no fetch. owns the percentile math, the SVG-density
// helper, and the share-fragment encode/decode. the percentile and curve are
// computed from a histogram of session-averages submitted by previous players
// — see distribution proxy at infrastructure/distribution/. tiers stay
// deterministic on |delta|.

const TARGET_MS = 1000;          // bullseye
const RANGE_LO = 500;            // ms — visible curve floor (off-curve clamps below)
const RANGE_HI = 1500;           // ms — visible curve ceiling

// scoreboard tiers, keyed on absolute |delta| in ms. labels are designed to
// read like a competitive scoreboard, not a fortune-teller's verdict. tiers
// are independent of the live distribution so the badge a player sees on the
// result screen doesn't shift if the histogram updates between renders.
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

// % of recorded session-averages with strictly larger |delta| than yours —
// i.e. the fraction of past players whose average was farther from 1.000s.
// cap at 99 so a perfect average reads "beat 99%" — there's always head-room.
// returns null if the histogram hasn't loaded yet so the UI can render a
// placeholder.
export function beatPctFromBins(durationMs, bins, total) {
  if (!bins || !total) return null;
  const myAbs = Math.abs(durationMs - TARGET_MS);
  if (myAbs === 0) return 99;
  let larger = 0;
  for (const [ms, count] of bins) {
    const binAbs = Math.abs(ms - TARGET_MS);
    if (binAbs > myAbs) larger += count;
  }
  return Math.max(0, Math.min(99, Math.round(100 * larger / total)));
}

// build a closed SVG fill path from histogram bins, restricted to the visible
// 500..1500ms range. heights are normalized so the tallest visible bin equals
// PEAK_H; this keeps the curve visually meaningful across totals (10 averages
// or 10,000). bins is [[ms, count], ...] sorted by ms ascending.
export function curvePathFromBins(bins) {
  const W = 1000, H = 100, BASE_PAD = 6, PEAK_H = 80;
  if (!bins || bins.length === 0) {
    return `M 0,${H - BASE_PAD} L ${W},${H - BASE_PAD} Z`;
  }
  const STEP = 5;
  const stepCount = Math.floor((RANGE_HI - RANGE_LO) / STEP) + 1;
  const heights = new Array(stepCount).fill(0);
  for (const [ms, c] of bins) {
    if (ms < RANGE_LO || ms > RANGE_HI) continue;
    const idx = Math.round((ms - RANGE_LO) / STEP);
    if (idx >= 0 && idx < stepCount) heights[idx] += c;
  }
  const peak = Math.max(1, ...heights);
  const pts = heights.map((c, i) => {
    const x = i * STEP;
    const y = (H - BASE_PAD) - (c / peak) * PEAK_H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${pts[0]} L ${pts.join(' L ')} L ${W},${H - BASE_PAD} L 0,${H - BASE_PAD} Z`;
}

// map a duration to an x in the curve's viewBox; clamp so off-curve pins
// still render at the edge instead of vanishing.
export function pinXFor(durationMs) {
  const x = durationMs - RANGE_LO;
  return Math.max(0, Math.min(1000, x));
}

export const TARGET_X = TARGET_MS - RANGE_LO; // 500
export const CURVE_VIEWBOX = '0 0 1000 100';

// the central function. give it a duration in ms plus the live histogram, get
// back everything the result + final screens need to render. beatPct is null
// when bins haven't loaded yet — the UI shows "—%" until the network catches
// up, but duration/delta/tier are already fully determined.
export function computeResult(durationMs, bins, total) {
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
    beatPct: beatPctFromBins(durationMs, bins, total),
    tierKey: tier.key,
    tierLabel: tier.label,
    pinX: pinXFor(durationMs),
    isOutOfRange,
  };
}

// session score = arithmetic mean of the three holds, rounded to ms. one
// session contributes one data point to the live curve.
export function averageMsOf(durationsMs) {
  if (!durationsMs || durationsMs.length === 0) return null;
  const sum = durationsMs.reduce((s, d) => s + d, 0);
  return Math.round(sum / durationsMs.length);
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
