// copy strings + screen state machine + pointer-event handlers for the hold
// button, plus the network glue to the ef-distribution histogram backend.
// Alpine factory exported on `window`.
//
// Reveal model: each of the three holds gets a private result screen
// (duration + delta + tier only). The live curve is unlocked on the final
// screen, where the player's session-average is pinned against the
// distribution of every previous player's average. One session = one POST.

import {
  computeResult,
  encodeShare,
  decodeShare,
  averageMsOf,
  curvePathFromBins,
  CURVE_VIEWBOX,
  TARGET_X,
} from './mechanic.js';

// shared service: see infrastructure/distribution/ in the entertainment-factory.
// POST /hold {slug, durationMs} → records a hold and returns the new bin count.
// GET /hold/{slug} → returns [[ms, count], ...] over all holds + total.
const DISTRIBUTION_BASE = 'https://7uhtm126ve.execute-api.us-east-1.amazonaws.com';
const SLUG = 'closer-to-one';

async function fetchBins() {
  try {
    const r = await fetch(`${DISTRIBUTION_BASE}/hold/${SLUG}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { bins: Array.isArray(j.bins) ? j.bins : [], total: Number(j.total) || 0 };
  } catch (_) { return null; }
}

async function postHold(durationMs) {
  try {
    const r = await fetch(`${DISTRIBUTION_BASE}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, durationMs: Math.round(durationMs) }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

export function closerToOne() {
  return {
    // screen: 'intro' | 'hold' | 'result' | 'final'
    screen: 'intro',
    holdNumber: 1,
    pressing: false,
    pressStart: 0,
    pressPointerId: null,
    holds: [],          // duration in ms, one per hold
    results: [],        // per-hold result objects (duration / delta / tier)
    current: null,      // most recent per-hold result for the result screen
    isReplay: false,

    // live histogram of session-averages, populated only when the player
    // reaches the final screen (regular flow) or on init (share-link replay).
    bins: [],
    total: 0,
    statsLoaded: false,

    // session-average pin computed once on transition to final.
    averageMs: null,
    averageResult: null,

    // expose curve constants to the template
    curvePath: curvePathFromBins([]),
    curveViewBox: CURVE_VIEWBOX,
    targetX: TARGET_X,

    async init() {
      // replay path: shared-link viewers jump straight to the final screen.
      // We re-fetch the live curve so the average pin is rendered against
      // *today's* distribution, not whatever was true when the link was made.
      const decoded = decodeShare(window.location.hash);
      if (!decoded) return;
      this.isReplay = true;
      this.holds = decoded.durationsMs.slice();
      this.results = decoded.durationsMs.map(d => computeResult(d, [], 0));
      this.averageMs = averageMsOf(this.holds);
      this.screen = 'final';
      await this.loadStats();
      this.refreshAverageResult();
    },

    async loadStats() {
      const stats = await fetchBins();
      if (stats) {
        this.bins = stats.bins;
        this.total = stats.total;
        this.curvePath = curvePathFromBins(stats.bins);
        this.statsLoaded = true;
      }
    },

    refreshAverageResult() {
      if (this.averageMs == null) return;
      this.averageResult = computeResult(this.averageMs, this.bins, this.total);
    },

    startSession() {
      this.holdNumber = 1;
      this.holds = [];
      this.results = [];
      this.current = null;
      this.averageMs = null;
      this.averageResult = null;
      this.isReplay = false;
      this.screen = 'hold';
    },

    onPress(ev) {
      if (this.pressing) return;
      try { ev.target.setPointerCapture(ev.pointerId); } catch (_) { /* noop */ }
      this.pressPointerId = ev.pointerId;
      this.pressStart = performance.now();
      this.pressing = true;
    },

    onRelease(ev) {
      if (!this.pressing || ev.pointerId !== this.pressPointerId) return;
      const elapsedMs = performance.now() - this.pressStart;
      this.pressing = false;
      this.pressPointerId = null;
      try { ev.target.releasePointerCapture(ev.pointerId); } catch (_) { /* noop */ }
      this.recordHold(elapsedMs);
    },

    onCancel(ev) {
      if (!this.pressing) return;
      // a pointercancel mid-press is treated as a release at "now" — the user
      // committed to a press and the system interrupted; we still owe them a
      // score. silently dropping the hold feels broken.
      const elapsedMs = performance.now() - this.pressStart;
      this.pressing = false;
      this.pressPointerId = null;
      this.recordHold(elapsedMs);
    },

    recordHold(elapsedMs) {
      const ms = Math.round(elapsedMs);
      // No network on per-hold reveal — the curve stays hidden until hold 3.
      // duration / delta / tier are everything the player sees here.
      const result = computeResult(ms, [], 0);
      this.holds.push(ms);
      this.results.push(result);
      this.current = result;
      this.screen = 'result';
    },

    async advanceFromResult() {
      if (this.holdNumber < 3) {
        this.holdNumber += 1;
        this.current = null;
        this.screen = 'hold';
        return;
      }
      // third hold done: compute the session average, write the share
      // fragment, transition to final, then submit + fetch in the background.
      this.averageMs = averageMsOf(this.holds);
      const fragment = encodeShare(this.holds);
      try { history.replaceState(null, '', '#' + fragment); } catch (_) { /* noop */ }
      this.screen = 'final';

      const post = await postHold(this.averageMs);
      const fresh = await fetchBins();
      if (fresh) {
        this.bins = fresh.bins;
        this.total = fresh.total;
        this.statsLoaded = true;
      }
      // GET may not yet reflect our own POST (eventual consistency on the
      // table reads). If POST returned a count higher than what we see for
      // that bin, patch in the difference so the percentile reflects the
      // submission. Also covers the GET-failed-but-POST-landed case.
      if (post && typeof post.bin === 'number' && typeof post.count === 'number') {
        const idx = this.bins.findIndex(([b]) => b === post.bin);
        const seen = idx >= 0 ? this.bins[idx][1] : 0;
        if (post.count > seen) {
          if (idx >= 0) {
            this.total += (post.count - seen);
            this.bins[idx] = [post.bin, post.count];
          } else {
            this.bins = [...this.bins, [post.bin, post.count]].sort((a, b) => a[0] - b[0]);
            this.total += post.count;
          }
          this.statsLoaded = true;
        }
      }
      this.curvePath = curvePathFromBins(this.bins);
      this.refreshAverageResult();
    },

    restart() {
      // clear the fragment so next session starts fresh.
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) { /* noop */ }
      this.startSession();
    },

    // formatted "1,234 sessions recorded" for the small histogram tally line.
    // sessions, not holds — the curve is one-pin-per-player.
    get totalLabel() {
      if (!this.statsLoaded) return '… loading the curve';
      const n = this.total;
      return n.toLocaleString() + (n === 1 ? ' session recorded' : ' sessions recorded');
    },
  };
}

window.closerToOne = closerToOne;
