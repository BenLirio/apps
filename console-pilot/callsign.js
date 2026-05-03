// callsign.js — deterministic callsign generation from a finished run.
//
// Each run produces a stat profile {maxG, closestPass, sectorIndex, beacons,
// nearMisses, smoothness, hit}. We derive descriptors from properties of the
// actual flight (not random), producing names like:
//
//   "Cmdr. Shortwave"          (smooth + many beacons)
//   "Pilot 4-Echo-Twitchy"     (high-G + many near-misses)
//   "Lt. Slowburn"             (low-G + survived to end)
//   "Ensign Coldnose"          (tight closest-pass on an early hit)
//
// The pool is finite but selection is shaped by the actual numbers, so two
// users with similar flying styles get adjacent callsigns rather than the
// same one. Same input → same callsign (seeded by run signature for the
// final tie-breaker).

// 1) The descriptor — single distinctive adjective derived from the
//    *dominant* axis of the flight. Order = priority.
const DESCRIPTORS = [
  // [tag, predicate(stats) -> 0..1 how strongly this fits]
  ['Twitchy',     s => clamp01((s.nearMisses - 4) / 14) * 0.9 + clamp01((s.maxG - 3) / 4) * 0.1],
  ['Shortwave',   s => clamp01(1 - s.smoothness / 0.32) * (0.5 + 0.5 * clamp01(s.beaconsHit / Math.max(1, s.beaconsTotal)))],
  ['Coldnose',    s => clamp01((1.6 - s.closestPass) / 1.6) * (s.hit ? 0.95 : 0.6)],
  ['Slowburn',    s => clamp01((2 - s.maxG) / 2) * clamp01(s.timeSurvived / 60)],
  ['Lighthouse',  s => clamp01(s.beaconsHit / Math.max(1, s.beaconsTotal)) * clamp01(s.beaconsHit / 6)],
  ['Driftless',   s => clamp01(1 - s.smoothness / 0.18) * 0.7 + clamp01(s.timeSurvived / 60) * 0.3],
  ['Hot-Stick',   s => clamp01((s.maxG - 4) / 3) * 0.85 + clamp01(s.nearMisses / 12) * 0.15],
  ['Knife-Edge',  s => clamp01((1.0 - s.closestPass) / 1.0) * clamp01(s.timeSurvived / 50)],
  ['Off-Axis',    s => clamp01(Math.abs(s.meanX) * 2.5) + clamp01(Math.abs(s.meanY) * 2.5)],
  ['Quiet-Pulse', s => clamp01(1 - s.smoothness / 0.22) * 0.7 + (1 - clamp01(s.maxG / 4)) * 0.3],
  ['Halfshade',   s => s.hit && s.timeSurvived < 30 ? 0.6 : 0],
  ['Greenhand',   s => s.hit && s.timeSurvived < 12 ? 0.9 : 0],
  ['Logbook',     s => clamp01(s.timeSurvived / 60) * clamp01(s.sectorIndex / 30) * (s.beaconsHit >= 4 ? 0.9 : 0.6)],
];

const RANKS = [
  // rank picked by how complete / clean the run was
  // [tag, priority(stats) -> number]
  { tag: 'Cmdr.',   p: s => completion(s) > 0.85 ? 1 : 0 },
  { tag: 'Lt.',     p: s => completion(s) > 0.65 && completion(s) <= 0.85 ? 1 : 0 },
  { tag: 'Ensign',  p: s => completion(s) > 0.40 && completion(s) <= 0.65 ? 1 : 0 },
  { tag: 'Pilot',   p: s => completion(s) <= 0.40 ? 1 : 0 },
];

// 2) Optional handle prefix — small chance based on closest-pass / beacons
const HANDLES = [
  null, null, null,                 // mostly no handle
  '4-Echo',
  '7-Bravo',
  'Foxglove',
  'Niner-Cur',
  'Echo-Loud',
  'Wirecut',
];

export function generateCallsign(stats) {
  const s = enrich(stats);

  // pick descriptor: highest-scoring tag, with deterministic tiebreaker
  let best = { tag: 'Logbook', score: -1 };
  for (const [tag, fn] of DESCRIPTORS) {
    const score = fn(s);
    if (score > best.score) best = { tag, score };
  }
  // small deterministic seed for handle / fallback descriptor variation
  const sig = signature(s);

  // rank
  let rank = 'Pilot';
  for (const r of RANKS) if (r.p(s) > 0) { rank = r.tag; break; }

  // handle (only when descriptor is "loud" or pilot took a hit)
  let handle = null;
  if (best.score < 0.55 || s.nearMisses >= 6 || s.hit) {
    handle = HANDLES[sig % HANDLES.length] || null;
  }

  // assemble
  const parts = [rank];
  if (handle) parts.push(handle);
  parts.push(best.tag);
  return {
    name: parts.join(' '),
    descriptor: best.tag,
    rank,
    blurb: blurbFor(best.tag, s),
    tail: tailFor(s),
  };
}

function enrich(stats) {
  // smoothness = stddev(input) — small means held the yoke steady
  const n = Math.max(1, stats.samples || 1);
  const meanX = stats.inputXSum / n;
  const meanY = stats.inputYSum / n;
  const varX = Math.max(0, stats.inputXSumSq / n - meanX * meanX);
  const varY = Math.max(0, stats.inputYSumSq / n - meanY * meanY);
  const smoothness = Math.sqrt(varX + varY);

  // sanitize closestPass (Infinity if no debris ever passed)
  const closest = isFinite(stats.closestPass) ? stats.closestPass : 4.5;

  return {
    maxG: stats.maxG,
    closestPass: closest,
    sectorIndex: stats.sectorIndex,
    beaconsHit: stats.beaconsHit,
    beaconsTotal: Math.max(stats.beaconsTotal, 1),
    nearMisses: stats.nearMisses,
    grazes: stats.grazes,
    timeSurvived: stats.timeSurvived,
    hit: !!stats.hit,
    smoothness,
    meanX,
    meanY,
  };
}

function completion(s) {
  // 0..1: how "complete + clean" the run was
  const surv = clamp01(s.timeSurvived / 60);
  const beacon = clamp01(s.beaconsHit / Math.max(3, s.beaconsTotal));
  const intact = s.hit ? 0 : 1;
  return surv * 0.55 + beacon * 0.30 + intact * 0.15;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// signature: 32-bit hash of the stat profile, for deterministic tiebreakers
function signature(s) {
  const str = [
    Math.round(s.maxG * 10),
    Math.round(s.closestPass * 10),
    s.sectorIndex,
    s.beaconsHit,
    s.beaconsTotal,
    s.nearMisses,
    Math.round(s.timeSurvived * 10),
    s.hit ? 1 : 0,
    Math.round(s.smoothness * 1000),
  ].join(':');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function blurbFor(tag, s) {
  // each descriptor has 2 lines; pick deterministically by sub-signature.
  const map = {
    'Twitchy':     ['Reflex on a hair trigger. Nebula has nothing on you.',  'Half your inputs were arguments with the yoke.'],
    'Shortwave':   ['Steady hands. Soft elbows. Loud nebula.',                'You held the line where the line stopped existing.'],
    'Coldnose':    ['You were three centimetres from a story.',               'The closest-pass log just refers to you as "again".'],
    'Slowburn':    ['Low-G, long-arc. The corridor blinked first.',           'Patient flying. The stars learned your name slowly.'],
    'Lighthouse':  ['Beacons love a pilot who shows up.',                     'You ran the route lit. Every sector logged you in.'],
    'Driftless':   ['Anchored without anchor.',                               'No drift, no doubt. The corridor straightened for you.'],
    'Hot-Stick':   ['Yoke welded to the firewall. Lots of fire, lots of wall.', 'G-stack like a denomination. Loud entry, loud middle.'],
    'Knife-Edge':  ['You stitched the gaps.',                                 'Closer-than-margin flying. The hull files a complaint.'],
    'Off-Axis':    ['Held a lean and never gave it back.',                    'You flew with one shoulder. The universe noticed.'],
    'Quiet-Pulse': ['Steady inputs. Audible heart.',                          'Quiet thumbprint, present pilot.'],
    'Halfshade':   ['Halfway in, the lights stopped helping.',                'You met the corridor in the middle. Corridor won the toss.'],
    'Greenhand':   ['First flight. The wall is undefeated.',                  'Welcome to logging. The log is short. Try again.'],
    'Logbook':     ['No frills, full ledger.',                                'A run the recorder will remember in its sleep.'],
  };
  const arr = map[tag] || map['Logbook'];
  return arr[(signature(s)) % arr.length];
}

function tailFor(s) {
  if (s.hit) {
    return `END LOG · INTERCEPT @ SECTOR G7-${pad(s.sectorIndex, 3)} · HULL FAIL`;
  }
  return `END LOG · CORRIDOR DUSTED · BAR ${s.beaconsHit} OF ${s.beaconsTotal} · SECTOR G7-${pad(s.sectorIndex, 3)}`;
}

function pad(n, w) {
  let s = String(Math.max(0, n | 0));
  while (s.length < w) s = '0' + s;
  return s;
}
