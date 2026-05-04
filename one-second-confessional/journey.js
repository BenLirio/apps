// copy strings + screen state machine + pointer-event handlers for the oracle
// button. Alpine factory exported on `window`.

import {
  computeResult,
  encodeShare,
  decodeShare,
  todayDateInt,
  dateLabelFromDateInt,
} from './mechanic.js';

export function oneSecondConfessional() {
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
    replayDateInt: 0,
    replayDateLabel: '',

    init() {
      // if a share fragment is present, jump straight to final replay.
      const decoded = decodeShare(window.location.hash);
      if (decoded) {
        this.isReplay = true;
        this.replayDateInt = decoded.dateInt;
        this.replayDateLabel = dateLabelFromDateInt(decoded.dateInt);
        this.results = decoded.durationsMs.map(d => computeResult(d, decoded.dateInt));
        this.holds = decoded.durationsMs.slice();
        this.screen = 'final';
        return;
      }
      this.replayDateInt = todayDateInt();
      this.replayDateLabel = dateLabelFromDateInt(this.replayDateInt);
    },

    startSession() {
      this.holdNumber = 1;
      this.holds = [];
      this.results = [];
      this.current = null;
      this.isReplay = false;
      this.replayDateInt = todayDateInt();
      this.replayDateLabel = dateLabelFromDateInt(this.replayDateInt);
      this.screen = 'hold';
    },

    onPress(ev) {
      if (this.pressing) return;
      // capture so a drag-off-and-release still resolves on this element
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
      // confession. (the alternative — silently dropping the hold — feels
      // broken, and re-tapping doesn't recover the timing.)
      const elapsedMs = performance.now() - this.pressStart;
      this.pressing = false;
      this.pressPointerId = null;
      this.recordHold(elapsedMs);
    },

    recordHold(elapsedMs) {
      const dateInt = this.replayDateInt || todayDateInt();
      const result = computeResult(elapsedMs, dateInt);
      this.holds.push(Math.round(elapsedMs));
      this.results.push(result);
      this.current = result;
      this.screen = 'result';
    },

    advanceFromResult() {
      if (this.holdNumber < 3) {
        this.holdNumber += 1;
        this.current = null;
        this.screen = 'hold';
        return;
      }
      // third hold done — write the share fragment and move to final.
      const fragment = encodeShare(this.holds, this.replayDateInt);
      try {
        history.replaceState(null, '', '#' + fragment);
      } catch (_) { /* noop */ }
      this.screen = 'final';
    },

    restart() {
      // clear the fragment so next session starts fresh on today's seed.
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) { /* noop */ }
      this.startSession();
    },
  };
}

window.oneSecondConfessional = oneSecondConfessional;
