// mechanic.js — pure logic, no DOM. Owns:
//   1. The audio engine (Web Audio API; sine oscillator + exponential glide).
//   2. The round configuration (baseline freq + glide rate per round).
//   3. The scoring math (cents deviation, percentile lookup, verdict).
//
// Audio gotchas handled here:
//   - AudioContext is created lazily inside a user gesture (unlock()).
//   - playsInline is implicit for Web Audio (no <audio> element involved).
//   - Tone is sustained (no buffer) so iOS doesn't pre-empt it.
//   - Resume the context on every gesture (Safari occasionally suspends).
//
// Usage:
//   const eng = createEngine();
//   await eng.unlock();              // user gesture required
//   await eng.testTone();            // 0.6s calibration
//   const handle = eng.startGlide(round); // begins climbing
//   ...
//   const tap = eng.stopGlide();     // returns { tapHz, baselineHz, ... }

import { REF_DISTRIBUTION, VERDICTS } from "./data.js";

// Three rounds, increasing baseline-pitch difficulty.
// Higher baselines are harder because (a) the absolute Hz delta of one octave
// is larger, so the glide covers a bigger gap, and (b) the human pitch JND
// degrades above ~2kHz.
export const ROUNDS = Object.freeze([
  // R1: low baseline, 6.5s glide, gentle.
  { baseline: 196.0,  durationSec: 6.5, label: "low baseline · easy glide",    note: "G3 → G4" },
  // R2: mid baseline, 5.0s glide.
  { baseline: 392.0,  durationSec: 5.0, label: "mid baseline · medium glide", note: "G4 → G5" },
  // R3: high baseline, 4.0s glide. Climbs faster, higher freqs, less margin.
  { baseline: 880.0,  durationSec: 4.0, label: "high baseline · fast glide",  note: "A5 → A6" }
]);

// Cap glide ceiling so the tone never *exceeds* one octave — the experience is
// "did it just hit one octave?" not "guess somewhere inside an open-ended ramp."
// We let the glide actually go to 1.25× the octave to give an explicit fail
// zone the user can hit (i.e. they tapped late).
const GLIDE_OVERSHOOT = 1.25;

export function createEngine() {
  let ctx = null;
  let osc = null;
  let gain = null;
  let unlocked = false;

  // -------- audio context lifecycle --------

  async function unlock() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error("no-audiocontext");
      ctx = new Ctor({ latencyHint: "interactive" });
    }
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = true;
    return ctx.state;
  }

  async function ensureRunning() {
    if (!ctx) await unlock();
    if (ctx.state === "suspended") await ctx.resume();
  }

  // 0.6s calibration tone — 440Hz, fades in/out, low gain.
  // User confirms "I heard it" by visual change; we don't try to mic-detect.
  async function testTone() {
    await ensureRunning();
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(440, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.06);
    g.gain.setValueAtTime(0.18, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.62);
    return new Promise((resolve) => {
      o.onended = () => resolve();
    });
  }

  // -------- round playback --------

  // Returns { startedAt, baseline, durationSec, ceiling }.
  // Tone glides exponentially from baseline → baseline * GLIDE_OVERSHOOT
  // (ceiling) over durationSec. The user is supposed to tap when it has
  // doubled (= baseline * 2).
  function startGlide(round) {
    if (!ctx) throw new Error("not-unlocked");
    stopGlide(); // safety
    const t0 = ctx.currentTime;
    const ceiling = round.baseline * GLIDE_OVERSHOOT;
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(round.baseline, t0);
    // Exponential ramp matches how humans perceive pitch (logarithmic).
    osc.frequency.exponentialRampToValueAtTime(ceiling, t0 + round.durationSec);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.08);
    // Hold steady; we'll fade out on stop.
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    // Auto-stop a hair after the ramp ends so we don't dangle indefinitely.
    osc.stop(t0 + round.durationSec + 0.2);
    return {
      startedAt: t0,
      baseline: round.baseline,
      durationSec: round.durationSec,
      ceiling
    };
  }

  // Stops the current glide and returns the tap freq + timing info.
  // Returns null if no glide is active.
  function stopGlide() {
    if (!osc || !gain || !ctx) return null;
    const tNow = ctx.currentTime;
    const o = osc, g = gain;
    osc = null; gain = null;
    // Quick fade-out (10ms) so we don't click.
    try {
      g.gain.cancelScheduledValues(tNow);
      g.gain.setValueAtTime(g.gain.value || 0.16, tNow);
      g.gain.exponentialRampToValueAtTime(0.0001, tNow + 0.04);
      o.stop(tNow + 0.05);
    } catch (_) { /* already stopped */ }
    return { tNow };
  }

  function close() {
    stopGlide();
    if (ctx) {
      try { ctx.close(); } catch (_) {}
      ctx = null;
      unlocked = false;
    }
  }

  function isUnlocked() { return unlocked; }
  function getCtx() { return ctx; }

  return { unlock, ensureRunning, testTone, startGlide, stopGlide, close, isUnlocked, getCtx };
}

// -------- scoring math --------

// Compute the frequency the tone is at, given a tap time relative to start.
// Mirrors exponentialRampToValueAtTime: f(t) = f0 * (ceiling/f0)^(t/dur).
export function freqAtTap({ baseline, ceiling, durationSec }, tapElapsed) {
  if (tapElapsed <= 0) return baseline;
  if (tapElapsed >= durationSec) return ceiling;
  return baseline * Math.pow(ceiling / baseline, tapElapsed / durationSec);
}

// Cents between two frequencies. Sign: positive = ratio > 1 (sharp).
// We typically take Math.abs() of this for scoring.
export function centsBetween(fA, fB) {
  return 1200 * Math.log2(fA / fB);
}

// Score one round: positive cents if the tap was *sharp* (above 2f), negative
// if *flat* (below 2f). Magnitude of |cents| is what scores.
export function scoreRound(round, glideHandle, tapElapsed) {
  const tapHz = freqAtTap(glideHandle, tapElapsed);
  const trueOctaveHz = round.baseline * 2;
  const cents = centsBetween(tapHz, trueOctaveHz);
  return {
    tapHz,
    trueOctaveHz,
    baseline: round.baseline,
    ceiling: glideHandle.ceiling,
    durationSec: round.durationSec,
    cents,
    absCents: Math.abs(cents),
    direction: cents > 0 ? "sharp" : (cents < 0 ? "flat" : "exact"),
    tapElapsed
  };
}

// Average |cents| over rounds → percentile (lower is better → higher percentile).
export function percentile(avgAbsCents) {
  const dist = REF_DISTRIBUTION;
  // count how many of dist are *worse* than the player.
  let worse = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > avgAbsCents) worse++;
  }
  return Math.round((worse / dist.length) * 100);
}

export function verdictFor(avgAbsCents) {
  for (const v of VERDICTS) {
    if (avgAbsCents <= v.max) return v;
  }
  return VERDICTS[VERDICTS.length - 1];
}

// Human-readable subject ID, deterministic from round results so two
// identical playthroughs stamp the same ID. Used in the verdict card chrome.
export function subjectId(rounds) {
  if (!rounds || rounds.length === 0) return "0000";
  let h = 0;
  for (const r of rounds) {
    const k = `${Math.round(r.tapHz)}-${Math.round(r.trueOctaveHz)}-${Math.round(r.absCents)}`;
    for (let i = 0; i < k.length; i++) {
      h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
    }
  }
  const n = Math.abs(h) % 10000;
  return String(n).padStart(4, "0");
}

// Per-round flavor copy. Specific, voiced, references the actual deviation.
export function flavorFor(score) {
  const c = Math.round(score.absCents);
  const dir = score.direction;
  if (c <= 25) return dir === "sharp"
    ? "// dead on. you tapped a hair sharp. uncanny."
    : (dir === "flat" ? "// dead on. you tapped a hair flat. uncanny." : "// you nailed it exactly. show-off.");
  if (c <= 75) return dir === "sharp"
    ? "// solid. you tapped a touch sharp — the climb sold you."
    : "// solid. you tapped a touch flat — you bailed early.";
  if (c <= 200) return dir === "sharp"
    ? "// you waited too long. classic civilian instinct: 'surely it's higher than this.'"
    : "// you tapped early. confident, but wrong-confident.";
  if (c <= 400) return dir === "sharp"
    ? "// you held on. that's almost a fifth past the octave. brave."
    : "// you tapped before the climb really got started. itchy thumb.";
  return dir === "sharp"
    ? "// you let it run almost to the ceiling. enthusiast."
    : "// you tapped before the tone settled. that's a vibe.";
}
