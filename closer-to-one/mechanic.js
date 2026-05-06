// pure logic. no DOM, no fetch. owns the percentile math, the tier-distribution
// helper, and the share-fragment encode/decode. percentile and the
// tier-comparison readout are computed from a histogram of session-averages
// submitted by previous players — see distribution proxy at
// infrastructure/distribution/. tiers stay deterministic on |delta|.

const TARGET_MS = 1000;          // bullseye
const RANGE_LO = 500;            // ms — visible track floor (off-track clamps below)
const RANGE_HI = 1500;           // ms — visible track ceiling

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

// Rank among recorded session-averages: how many past averages sit closer
// to 1.000s than yours, plus 1 (so #1 = the very best ever recorded). Bins
// store counts so we just count the number of submissions with strictly
// smaller |delta|. Returns null if the histogram hasn't loaded yet so the
// UI can render a placeholder; returns 1 when bins exist but no one beats
// you. Use alongside `total` for a "#42 of 1,234" display.
export function rankFromBins(durationMs, bins, total) {
  if (!bins || !total) return null;
  const myAbs = Math.abs(durationMs - TARGET_MS);
  let closer = 0;
  for (const [ms, count] of bins) {
    const binAbs = Math.abs(ms - TARGET_MS);
    if (binAbs < myAbs) closer += count;
  }
  return closer + 1;
}

// Bucket every recorded session-average into one of the seven tiers and
// return [{key, label, count}, ...] in tier order. This is what the final
// screen renders instead of an SVG histogram — sparse data looks like
// "BULLSEYE: 0, DEAD-ON: 1, SHARP: 0, ..." (honest), not a near-flat
// near-empty curve (looks broken). Always returns all seven tiers, even at
// total=0, so the table layout never jumps when the fetch resolves.
export function tierDistributionFromBins(bins) {
  const out = TIERS.map(t => ({ key: t.key, label: t.label, count: 0 }));
  if (!bins) return out;
  for (const [ms, count] of bins) {
    const absDelta = Math.abs(ms - TARGET_MS);
    for (let i = 0; i < TIERS.length; i++) {
      if (absDelta <= TIERS[i].maxDelta) {
        out[i].count += count;
        break;
      }
    }
  }
  return out;
}

// 0..100% across the visible 0.5..1.5s range. used to position the pin (and
// the bullseye marker) on the horizontal score track via `left: X%`.
// out-of-range averages clamp to 0 / 100 so the pin still renders at the edge.
export function pinPctFor(durationMs) {
  const pct = ((durationMs - RANGE_LO) / (RANGE_HI - RANGE_LO)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export const TARGET_PCT = pinPctFor(TARGET_MS); // 50 — bullseye marker

// the central function. give it a duration in ms plus the live histogram, get
// back everything the result + final screens need to render. beatPct / rank /
// rankTotal are null when bins haven't loaded yet — the UI shows "—" until
// the network catches up, but duration/delta/tier are already fully
// determined.
export function computeResult(durationMs, bins, total) {
  durationMs = Math.max(0, Math.round(durationMs));
  const isOutOfRange = durationMs < RANGE_LO || durationMs >= RANGE_HI;
  const signedDelta = durationMs - TARGET_MS;
  const absDelta = Math.abs(signedDelta);
  const tier = tierFor(absDelta);
  const rank = rankFromBins(durationMs, bins, total);
  return {
    durationMs,
    durationStr: fmtSec(durationMs),
    deltaMs: signedDelta,
    deltaStr: fmtSignedDelta(signedDelta),
    beatPct: beatPctFromBins(durationMs, bins, total),
    rank,
    rankTotal: rank == null ? null : (Number(total) || null),
    tierKey: tier.key,
    tierLabel: tier.label,
    pinPct: pinPctFor(durationMs),
    isOutOfRange,
  };
}

// session score = arithmetic mean of the three holds, rounded to ms. one
// session contributes one data point to the live scoreboard.
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
