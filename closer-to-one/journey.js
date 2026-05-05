// copy strings + screen state machine + pointer-event handlers for the hold
// button, plus the network glue to the ef-distribution histogram backend.
// Alpine factory exported on `window`.

import {
  computeResult,
  encodeShare,
  decodeShare,
  bestOf,
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
    holds: [],          // array of duration in ms
    results: [],        // array of result objects from computeResult
    current: null,      // result for the just-revealed hold
    isReplay: false,

    // live histogram, updated after every POST /hold
    bins: [],
    total: 0,
    statsLoaded: false,

    // expose curve constants to the template
    curvePath: curvePathFromBins([]),
    curveViewBox: CURVE_VIEWBOX,
    targetX: TARGET_X,

    init() {
      // fire the histogram fetch first, then handle replay. render-related
      // state updates only after the fetch resolves; until then duration/delta
      // render normally and beatPct shows a placeholder.
      this.loadStatsThen(() => {
        const decoded = decodeShare(window.location.hash);
        if (decoded) {
          this.isReplay = true;
          this.holds = decoded.durationsMs.slice();
          this.results = decoded.durationsMs.map(d => computeResult(d, this.bins, this.total));
          this.screen = 'final';
        }
      });
    },

    async loadStatsThen(after) {
      const stats = await fetchBins();
      if (stats) {
        this.bins = stats.bins;
        this.total = stats.total;
        this.curvePath = curvePathFromBins(stats.bins);
        this.statsLoaded = true;
      }
      if (typeof after === 'function') after();
    },

    startSession() {
      this.holdNumber = 1;
      this.holds = [];
      this.results = [];
      this.current = null;
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
      // optimistic render from the bins we already have so the result screen
      // shows immediately; the POST resolves in the background and re-renders
      // with the up-to-date bin counts (your own hold included).
      const result = computeResult(ms, this.bins, this.total);
      this.holds.push(ms);
      this.results.push(result);
      this.current = result;
      this.screen = 'result';
      this.submitHold(ms);
    },

    async submitHold(ms) {
      const r = await postHold(ms);
      if (!r || typeof r.bin !== 'number' || typeof r.count !== 'number') return;
      this.applyBinUpdate(r.bin, r.count);
      // recompute every result with the updated bins so percentiles stay
      // coherent (every previously-shown result reflects the same denominator).
      this.results = this.results.map(res =>
        computeResult(res.durationMs, this.bins, this.total)
      );
      this.current = this.results[this.results.length - 1];
      this.curvePath = curvePathFromBins(this.bins);
    },

    applyBinUpdate(binMs, newCount) {
      const idx = this.bins.findIndex(([b]) => b === binMs);
      if (idx >= 0) {
        const oldCount = this.bins[idx][1];
        this.total += (newCount - oldCount);
        this.bins[idx] = [binMs, newCount];
      } else {
        this.bins = [...this.bins, [binMs, newCount]].sort((a, b) => a[0] - b[0]);
        this.total += newCount;
      }
    },

    advanceFromResult() {
      if (this.holdNumber < 3) {
        this.holdNumber += 1;
        this.current = null;
        this.screen = 'hold';
        return;
      }
      // third hold done — write the share fragment and move to final.
      const fragment = encodeShare(this.holds);
      try { history.replaceState(null, '', '#' + fragment); } catch (_) { /* noop */ }
      this.screen = 'final';
    },

    restart() {
      // clear the fragment so next session starts fresh.
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) { /* noop */ }
      this.startSession();
    },

    // best-of-three — the one that beat the most of the field. used as the
    // headline on the final screen.
    get bestResult() {
      return bestOf(this.results);
    },

    // formatted "1,234 holds recorded" for the small histogram tally line.
    get totalLabel() {
      if (!this.statsLoaded) return '… loading the curve';
      return this.total.toLocaleString() + ' holds recorded';
    },
  };
}

window.closerToOne = closerToOne;
