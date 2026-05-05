// histogram.js — talks to the shared per-slug histogram store
// (config.distribution.endpoint). Encodes a duo's final shared-brain score
// (0..10 correct) into the millisecond bin space the proxy expects:
// score → score*1000 ms (range 0..10000 — within proxy limits, 5ms bin width).
//
// The proxy aggregates ALL pairs that have ever played telephone-brain into a
// single per-slug distribution. We GET the bins to draw the histogram and
// compute the percentile of this duo's score, then POST our own score so the
// next pair's histogram includes us.
//
// If the proxy is unreachable, fall back to a believable simulated distribution
// (skewed toward the middle) so the user still sees a histogram and verdict —
// the goal is the FEELING of "how do we compare to everyone else."

const HIST_ENDPOINT = "https://7uhtm126ve.execute-api.us-east-1.amazonaws.com";
const SLUG = "telephone-brain";

// Score domain: 0..10 correct guesses. We map to ms = score * 1000.
const MS_PER_SCORE = 1000;
const MAX_SCORE = 10;

export async function fetchDistribution() {
  try {
    const r = await fetch(`${HIST_ENDPOINT}/hold/${SLUG}`, { method: "GET" });
    if (!r.ok) return simulatedDistribution();
    const data = await r.json();
    if (!data || !Array.isArray(data.bins)) return simulatedDistribution();
    return normalizeFromProxy(data);
  } catch (_e) {
    return simulatedDistribution();
  }
}

export async function recordScore(score) {
  const dur = Math.max(0, Math.min(MAX_SCORE, score)) * MS_PER_SCORE;
  try {
    await fetch(`${HIST_ENDPOINT}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, durationMs: dur })
    });
  } catch (_e) {
    // Posting is best-effort — the user already saw their verdict.
  }
}

// Convert proxy bins (5ms width, [bin, count]) into per-score counts.
function normalizeFromProxy(data) {
  const counts = new Array(MAX_SCORE + 1).fill(0);
  let total = 0;
  for (const [bin, count] of data.bins) {
    const score = Math.round(bin / MS_PER_SCORE);
    if (score >= 0 && score <= MAX_SCORE) {
      counts[score] += count;
      total += count;
    }
  }
  return { counts, total, simulated: total === 0 };
}

// Simulated baseline: roughly normal-ish around 5.5/10 with 240 fake duos.
// Used when the real distribution is empty or the proxy is unreachable.
function simulatedDistribution() {
  // Hand-tuned shape so percentile feels right.
  // Curve: lots of pairs score 5–7, fewer at extremes.
  const shape = [3, 6, 14, 28, 38, 48, 42, 32, 18, 8, 3];
  return { counts: shape.slice(), total: shape.reduce((a, b) => a + b, 0), simulated: true };
}

// Return percentile (0..99) of `score` in the given distribution.
// Percentile = "what fraction of duos scored strictly less than us, plus half
// of those tied." This is the standard mid-rank percentile and avoids
// degenerate 100s.
export function percentileOf(score, dist) {
  const total = dist.total || 1;
  let below = 0;
  let at = 0;
  for (let s = 0; s < dist.counts.length; s++) {
    if (s < score) below += dist.counts[s];
    else if (s === score) at += dist.counts[s];
  }
  const pct = ((below + at / 2) / total) * 100;
  return Math.max(0, Math.min(99, Math.round(pct)));
}
