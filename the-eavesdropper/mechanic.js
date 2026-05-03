/* mechanic.js — the listening loop, dwell-time vector, and deterministic
 * letter seed. No DOM references here other than minimal callbacks the
 * journey passes in. The journey is the renderer; this is the engine.
 */

import { TABLES, SEATS, NAME_BANK } from './cafe.js';

export const SESSION_SECONDS = 90;
const FRAGMENT_INTERVAL_MS = 5500; // a new fragment surfaces every 5.5s
const MAX_VISIBLE_FRAGMENTS = 4;

/* String hash — 32-bit FNV-ish via Math.imul. Stable across JS runtimes. */
export function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* Mulberry32 — small seeded PRNG. We use it only inside mechanic to pick
 * which fragment to surface next, seeded by the seat id. The dwell vector
 * is shaped by the user, so the *content* the user lingers on is still
 * meaningfully theirs even though the surfacing schedule is deterministic
 * per seat. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Dwell-time tracker ----------
 * Tracks how many tick-ms each table got the user's attention.
 * "Attention" defaults to whatever fragment is most recent, but if the user
 * taps a fragment to "lean in," that locks the focus to the fragment's
 * source until the next fragment appears. */
export function makeDwell(tableIds) {
  const ms = Object.fromEntries(tableIds.map(t => [t, 0]));
  let total = 0;
  return {
    add(target, delta) {
      if (!(target in ms)) return;
      ms[target] += delta;
      total += delta;
    },
    snapshot() {
      const safeTotal = total || 1;
      const pct = Object.fromEntries(
        Object.entries(ms).map(([k, v]) => [k, v / safeTotal])
      );
      return { ms: { ...ms }, totalMs: total, pct };
    },
    leaderId() {
      let best = null;
      let bestVal = -1;
      for (const [k, v] of Object.entries(ms)) {
        if (v > bestVal) { bestVal = v; best = k; }
      }
      return best;
    },
  };
}

/* ---------- Fragment scheduler ----------
 * Given a seat (which conditions proximity weights) and a deterministic seed,
 * produce a list of {atMs, tableId, fragmentIndex, fragmentText, speaker}
 * spanning the 90-second session.
 *
 * We pre-compute the schedule rather than sampling live so the same seat
 * always plays the same fragments in the same order — that lets the
 * dwell-time vector be the only user-controlled variable. */
export function scheduleFragments(seatId) {
  const seat = SEATS[seatId];
  if (!seat) return [];
  const seed = hash('halcyon|' + seatId);
  const rand = mulberry32(seed);

  // Per-seat fragment pool — every table contributes a number of fragments
  // proportional to the seat's proximity weight.
  const pool = [];
  for (const [tableId, weight] of Object.entries(seat.proximity)) {
    const table = TABLES[tableId];
    if (!table) continue;
    // pick floor(weight * 6) + 1 fragments (range 1..7) from this table
    const wantCount = Math.max(1, Math.min(table.fragments.length, Math.round(weight * 6) + 1));
    // shuffle indices using rand, take wantCount
    const indices = table.fragments.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < wantCount; i++) {
      pool.push({ tableId, fragmentIndex: indices[i] });
    }
  }

  // Now stitch them into a 90s timeline, alternating sources where possible
  // so the listener gets a "the room is alive" feel rather than one table at
  // a time. We weight the next-pick by 1/recent-occurrence-of-tableId.
  const timeline = [];
  const recentBoost = {};
  const total = Math.floor((SESSION_SECONDS * 1000) / FRAGMENT_INTERVAL_MS) + 1;

  for (let step = 0; step < total && pool.length > 0; step++) {
    // weight each candidate by inverse recent presence
    const weighted = pool.map((p, idx) => {
      const recent = recentBoost[p.tableId] || 0;
      const w = 1 / (1 + recent);
      return { idx, p, w };
    });
    const sumW = weighted.reduce((s, x) => s + x.w, 0);
    let pick = rand() * sumW;
    let chosen = weighted[0];
    for (const w of weighted) {
      pick -= w.w;
      if (pick <= 0) { chosen = w; break; }
    }
    const { p, idx } = chosen;
    pool.splice(idx, 1);
    // decay all recent counts, then bump the chosen one
    for (const k of Object.keys(recentBoost)) recentBoost[k] *= 0.5;
    recentBoost[p.tableId] = (recentBoost[p.tableId] || 0) + 2;

    const table = TABLES[p.tableId];
    timeline.push({
      atMs: step * FRAGMENT_INTERVAL_MS,
      tableId: p.tableId,
      tableName: table.name,
      tableLabel: table.label,
      fragmentIndex: p.fragmentIndex,
      fragmentText: table.fragments[p.fragmentIndex],
      speaker: table.speakers[p.fragmentIndex % table.speakers.length],
    });
  }

  return timeline;
}

/* ---------- Listening session controller ----------
 * Drives a 90-second session: ticks dwell every 100ms toward whichever
 * "focused" fragment the user is currently on (most-recent by default,
 * or whichever they tapped to lean in on), surfaces fragments at their
 * scheduled atMs, and notifies callbacks. */
export function startSession({ seatId, schedule, onFragment, onTick, onDone }) {
  const tableIds = Object.keys(SEATS[seatId].proximity);
  const dwell = makeDwell(tableIds);
  const startedAt = performance.now();
  let lockedTarget = null; // when user taps a fragment, we lock attention to it
  let lockedTargetUntil = 0;
  let visible = []; // currently-visible fragments {fragId, tableId, ...}
  let lastTickAt = startedAt;
  let nextScheduleIdx = 0;
  let stopped = false;
  let raf = null;

  function defaultTarget() {
    // The most-recent visible fragment is the default focus.
    if (visible.length === 0) return null;
    return visible[visible.length - 1].tableId;
  }

  function currentTarget(now) {
    if (lockedTarget && now < lockedTargetUntil) return lockedTarget;
    return defaultTarget();
  }

  function leanIn(fragId) {
    const f = visible.find(v => v.fragId === fragId);
    if (!f) return;
    lockedTarget = f.tableId;
    // user lock holds until the next fragment surfaces or 7s passes.
    lockedTargetUntil = performance.now() + 7000;
  }

  function tick(now) {
    if (stopped) return;
    const dt = now - lastTickAt;
    lastTickAt = now;

    // surface any scheduled fragments whose atMs has passed
    const elapsed = now - startedAt;
    while (nextScheduleIdx < schedule.length && schedule[nextScheduleIdx].atMs <= elapsed) {
      const item = schedule[nextScheduleIdx++];
      const fragId = `f${nextScheduleIdx}`;
      const newFrag = { fragId, ...item };
      visible.push(newFrag);
      while (visible.length > MAX_VISIBLE_FRAGMENTS) visible.shift();
      // surfacing a new fragment cancels any old lock — user has new attention
      lockedTarget = null;
      onFragment && onFragment({ visible: visible.slice(), newFragId: fragId });
    }

    // accumulate dwell time on the current target
    const target = currentTarget(now);
    if (target) dwell.add(target, dt);

    // notify the journey for live UI (label, attention bar, time bar)
    const remaining = Math.max(0, SESSION_SECONDS * 1000 - elapsed);
    onTick && onTick({
      remainingMs: remaining,
      elapsedMs: elapsed,
      target,
      lockedTargetActive: !!lockedTarget && now < lockedTargetUntil,
      dwell: dwell.snapshot(),
    });

    if (elapsed >= SESSION_SECONDS * 1000) {
      stopped = true;
      const final = dwell.snapshot();
      const leader = dwell.leaderId();
      onDone && onDone({ dwell: final, leaderTableId: leader, visible: visible.slice() });
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return {
    leanIn,
    stop() { stopped = true; if (raf) cancelAnimationFrame(raf); },
  };
}

/* ---------- Letter signature: deterministic name + seed for the AI prompt ----------
 *
 * Inputs:
 *   seatId — string
 *   leaderTableId — the table the user lingered on most
 *   dwellPctVector — { tableId: 0..1 }
 *
 * Output:
 *   { letterSeed, signerName, signerSuffix, letterSelfDescriptor }
 *
 * The letterSeed is a stable hash of (seatId + sorted dwell-pct quantized to 5%).
 * Same seat + same dwell pattern → same letter. The AI proxy receives this
 * seed in the prompt so its temperature-low generation is reproducible-ish. */
export function deriveLetterSignature({ seatId, leaderTableId, dwellPctVector }) {
  const bank = NAME_BANK[leaderTableId];
  const quantized = Object.entries(dwellPctVector)
    .map(([k, v]) => `${k}:${Math.round(v * 20) / 20}`)
    .sort()
    .join(',');
  const seedStr = `seat:${seatId}|leader:${leaderTableId}|dwell:${quantized}`;
  const seed = hash(seedStr);
  const r = mulberry32(seed);
  const first = bank.firsts[Math.floor(r() * bank.firsts.length)];
  const last  = bank.lasts[Math.floor(r() * bank.lasts.length)];
  return {
    letterSeed: seed.toString(36),
    seedString: seedStr,
    signerName: `${first} ${last}`,
    signerSuffix: bank.sigSuffix,
    letterSelfDescriptor: bank.selfDescriptor,
  };
}
