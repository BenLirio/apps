// journey.js — copy strings + screen state machine.
//
// Screens: unlock → ready → listen → round-result → (loop x3) → verdict
//
// Imports the audio engine + scoring from mechanic.js. Owns:
//   - which screen is visible
//   - per-round tap timing (tapElapsed via performance.now → AudioContext.currentTime)
//   - the rolling rounds[] array of scored results
//   - all human-facing copy
//
// Deliberately no Alpine.js — the screen state is small enough that hand-rolled
// wiring is shorter than an Alpine x-data factory, and we want absolute control
// over button-disable and meter-fill timing.

import {
  createEngine, ROUNDS, scoreRound, percentile, verdictFor, subjectId, flavorFor
} from "./mechanic.js";

// -------- copy --------

const COPY = Object.freeze({
  unlockTrying:   "Starting audio…",
  unlockTone:     "Listen for three short beeps.",
  unlockTonePlayed: "",
  unlockOk:       "",
  unlockFail:     "Audio didn't start — try a different browser or turn off silent mode.",
  liveListening:  "",
  liveTooEarly:   "Too early — wait until you actually hear it rise, then tap.",
  liveAuto:       "You didn't tap in time. We'll log this round as the latest possible tap.",
});

// -------- state machine --------

export function startJourney(root) {
  const $ = (id) => root.querySelector("#" + id);

  const screens = {
    unlock: $("screen-unlock"),
    ready:  $("screen-ready"),
    listen: $("screen-listen"),
    rresult:$("screen-round-result"),
    verdict:$("screen-verdict"),
  };

  // Set the unlock-status line. Hides itself when empty so the screen stays
  // visually quiet — the line is reserved for transient progress / failure.
  function setStatus(el, text) {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.removeAttribute("hidden");
    } else {
      el.textContent = "";
      el.setAttribute("hidden", "");
    }
  }

  function show(name) {
    for (const k of Object.keys(screens)) {
      const el = screens[k];
      if (k === name) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    }
    // small autoscroll so the active screen is always at the top of the
    // viewport after a transition (mobile users tap, screen swaps, content
    // appears below the fold otherwise).
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // engine + per-session state
  const engine = createEngine();
  const session = {
    roundIdx: 0,
    rounds: [],          // scored results per round
    glideHandle: null,
    rafId: null,
    tapped: false,
  };

  // -------- unlock screen --------

  const btnUnlock     = $("btn-unlock");
  const unlockStatus  = $("unlock-status");
  const unlockConfirm = $("unlock-confirm");
  const unlockHelp    = $("unlock-help");
  const btnHeardYes   = $("btn-heard-yes");
  const btnHeardNo    = $("btn-heard-no");
  const btnReplayTone = $("btn-replay-tone");
  const pulseRow      = $("pulse-row");
  const pulseDots     = pulseRow.querySelectorAll(".pulse-dot");

  // Run the unlock + test-tone + reveal the "did you hear it?" gate.
  // Synchronous start: createEngine() is sync, so unlock() creates the
  // AudioContext synchronously inside this user-gesture frame before any
  // await; iOS Safari needs that to bind the gesture to the context.
  async function runUnlockAndTone() {
    btnUnlock.disabled = true;
    btnReplayTone.disabled = true;
    unlockHelp.setAttribute("hidden", "");
    unlockConfirm.setAttribute("hidden", "");
    pulseRow.removeAttribute("hidden");
    pulseDots.forEach((d) => d.classList.remove("active"));
    setStatus(unlockStatus, COPY.unlockTrying);
    try {
      await engine.unlock();
      setStatus(unlockStatus, COPY.unlockTone);
      // Light the pulse dots in sync with each audio pulse so the user can
      // SEE the audio path fire even if the device is muted — that turns a
      // "the app is broken" report into a "my speaker is muted" diagnosis.
      await engine.testTone((idx) => {
        const dot = pulseDots[idx - 1];
        if (dot) dot.classList.add("active");
      });
      setStatus(unlockStatus, COPY.unlockTonePlayed);
      // Reveal the confirmation gate. We do NOT auto-advance — the user
      // must affirm they heard the tone, otherwise they get help.
      unlockConfirm.removeAttribute("hidden");
    } catch (e) {
      setStatus(unlockStatus, COPY.unlockFail);
      // Treat exceptions as a no-sound case so the user has a path forward.
      unlockHelp.removeAttribute("hidden");
    } finally {
      btnUnlock.disabled = false;
      btnReplayTone.disabled = false;
    }
  }

  btnUnlock.addEventListener("click", runUnlockAndTone);
  btnReplayTone.addEventListener("click", runUnlockAndTone);

  btnHeardYes.addEventListener("click", () => {
    setStatus(unlockStatus, COPY.unlockOk);
    show("ready");
    $("begin-round").textContent = String(session.roundIdx + 1);
    $("round-pill").textContent = `ROUND ${session.roundIdx + 1} / 3`;
  });

  btnHeardNo.addEventListener("click", () => {
    unlockConfirm.setAttribute("hidden", "");
    unlockHelp.removeAttribute("hidden");
  });

  // -------- ready screen --------

  const btnBegin = $("btn-begin");
  btnBegin.addEventListener("click", () => beginRound());

  // -------- live screen --------

  const liveRoundPill = $("live-round-pill");
  const liveFreq      = $("live-freq");
  const liveStatus    = $("live-status");
  const meterFill     = $("meter-fill");
  const btnTap        = $("btn-tap");

  btnTap.addEventListener("click", () => onTap());

  async function beginRound() {
    const round = ROUNDS[session.roundIdx];
    liveRoundPill.textContent = `ROUND ${session.roundIdx + 1} / 3`;
    liveFreq.textContent = `${Math.round(round.baseline)} Hz`;
    setStatus(liveStatus, COPY.liveListening);
    meterFill.style.width = "0%";
    session.tapped = false;
    show("listen");

    // Audio context might suspend if user backgrounded the tab.
    await engine.ensureRunning();
    session.glideHandle = engine.startGlide(round);

    // rAF loop — updates meter fill + live freq display.
    const ctx = engine.getCtx();
    const tStart = ctx.currentTime;
    const tick = () => {
      if (!session.glideHandle) return;
      const elapsed = ctx.currentTime - tStart;
      const ratio = Math.min(elapsed / round.durationSec, 1);
      meterFill.style.width = (ratio * 100).toFixed(2) + "%";
      // live readout: octave is at ratio = log_GLIDE_OVERSHOOT(2) of duration,
      // but we just show the actual current Hz from the same exponential.
      const ceiling = session.glideHandle.ceiling;
      const fNow = round.baseline * Math.pow(ceiling / round.baseline, ratio);
      liveFreq.textContent = `${Math.round(fNow)} Hz`;
      if (ratio >= 1) {
        // auto-fail: tone reached the ceiling without a tap.
        setStatus(liveStatus, COPY.liveAuto);
        autoEndRound();
        return;
      }
      session.rafId = requestAnimationFrame(tick);
    };
    session.rafId = requestAnimationFrame(tick);
  }

  function onTap() {
    if (session.tapped) return;
    if (!session.glideHandle) return;
    session.tapped = true;

    const ctx = engine.getCtx();
    const elapsed = ctx.currentTime - session.glideHandle.startedAt;

    // Guard rail: if they tap basically instantly (< 150ms), reject the tap
    // and let them keep going. This is the "tap-too-early" misfire.
    if (elapsed < 0.15) {
      session.tapped = false;
      setStatus(liveStatus, COPY.liveTooEarly);
      return;
    }

    finishRound(elapsed);
  }

  function autoEndRound() {
    if (session.tapped) return;
    if (!session.glideHandle) return;
    session.tapped = true;
    finishRound(session.glideHandle.durationSec); // tap at ceiling
  }

  function finishRound(elapsed) {
    const round = ROUNDS[session.roundIdx];
    if (session.rafId) {
      cancelAnimationFrame(session.rafId);
      session.rafId = null;
    }
    engine.stopGlide();
    const score = scoreRound(round, session.glideHandle, elapsed);
    session.glideHandle = null;
    session.rounds.push(score);
    renderRoundResult(score);
  }

  // -------- round-result screen --------

  const rrRoundPill = $("rr-round-pill");
  const rrTag       = $("rr-tag");
  const rrTapHz     = $("rr-tap-hz");
  const rrTrueHz    = $("rr-true-hz");
  const rrCents     = $("rr-cents");
  const rrFlavor    = $("rr-flavor");
  const btnNext     = $("btn-next");

  function renderRoundResult(score) {
    rrRoundPill.textContent = `ROUND ${session.roundIdx + 1} / 3`;
    const dirTag = score.cents > 0 ? "SHARP" : (score.cents < 0 ? "FLAT" : "EXACT");
    rrTag.textContent = `${dirTag} OF OCTAVE`;
    rrTapHz.textContent  = `${Math.round(score.tapHz)} Hz`;
    rrTrueHz.textContent = `${Math.round(score.trueOctaveHz)} Hz`;
    const cv = Math.round(score.cents);
    rrCents.textContent = (cv > 0 ? "+" : "") + cv + " ¢";
    rrFlavor.textContent = flavorFor(score);

    // mark next/finish
    if (session.roundIdx >= ROUNDS.length - 1) {
      btnNext.textContent = "REVEAL VERDICT";
    } else {
      btnNext.textContent = `NEXT ROUND (${session.roundIdx + 2} / 3)`;
    }
    show("rresult");
  }

  btnNext.addEventListener("click", () => {
    if (session.roundIdx >= ROUNDS.length - 1) {
      renderVerdict();
    } else {
      session.roundIdx++;
      $("begin-round").textContent = String(session.roundIdx + 1);
      $("round-pill").textContent = `ROUND ${session.roundIdx + 1} / 3`;
      show("ready");
    }
  });

  // -------- verdict screen --------

  const cardPct      = $("card-pct");
  const cardVerdict  = $("card-verdict");
  const cardSub      = $("card-sub");
  const cardRounds   = $("card-rounds");
  const wave         = $("wave");

  function renderVerdict() {
    const total = session.rounds.reduce((a, r) => a + r.absCents, 0);
    const avg = total / session.rounds.length;
    const pct = percentile(avg);
    const v = verdictFor(avg);
    const sid = subjectId(session.rounds);

    cardPct.textContent = `${pct}th percentile`;
    cardVerdict.textContent = v.name;
    cardSub.textContent = v.sub.replace("subject_*", `subject_${sid}`);

    // per-round chips
    cardRounds.innerHTML = "";
    session.rounds.forEach((r, i) => {
      const chip = document.createElement("div");
      chip.className = "cr" + (r.absCents > 280 ? " fail" : "");
      const c = Math.round(r.absCents);
      chip.innerHTML = `
        <span class="rk">R${i + 1} · ${Math.round(r.baseline)} HZ</span>
        <span class="rv">|${c}| ¢</span>
      `;
      cardRounds.appendChild(chip);
    });

    drawWave(wave, session.rounds);

    // expose for the share function
    window.__verdict = { name: v.name, pct, avg: Math.round(avg), sid };

    show("verdict");
  }

  // tiny SVG waveform: a short sine line + a tap-line marker per round.
  function drawWave(svg, rounds) {
    const W = 600, H = 160;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const NS = "http://www.w3.org/2000/svg";

    // baseline (grid)
    const grid = document.createElementNS(NS, "line");
    grid.setAttribute("x1", "0"); grid.setAttribute("x2", String(W));
    grid.setAttribute("y1", String(H/2)); grid.setAttribute("y2", String(H/2));
    grid.setAttribute("stroke", "#1f2a26"); grid.setAttribute("stroke-dasharray", "4 6");
    svg.appendChild(grid);

    // sine wave path
    const cycles = 6;
    const amp = H * 0.32;
    let d = "M0," + (H/2);
    for (let x = 0; x <= W; x += 4) {
      const t = (x / W) * cycles * Math.PI * 2;
      const y = (H / 2) + Math.sin(t) * amp;
      d += " L" + x + "," + y.toFixed(1);
    }
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#4be3a4");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("opacity", "0.85");
    svg.appendChild(path);

    // tap-lines per round, x = elapsed/duration (clamped to 0..1)
    rounds.forEach((r, i) => {
      const x = (r.tapElapsed / r.durationSec) * W;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", x.toFixed(1));
      line.setAttribute("x2", x.toFixed(1));
      line.setAttribute("y1", "10");
      line.setAttribute("y2", String(H - 10));
      line.setAttribute("stroke", r.absCents > 280 ? "#ff7a59" : "#f1c46a");
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);

      const lbl = document.createElementNS(NS, "text");
      lbl.setAttribute("x", String(Math.min(x + 4, W - 24)));
      lbl.setAttribute("y", String(20 + (i * 14)));
      lbl.setAttribute("fill", r.absCents > 280 ? "#ff7a59" : "#f1c46a");
      lbl.setAttribute("font-family", "JetBrains Mono, monospace");
      lbl.setAttribute("font-size", "11");
      lbl.textContent = `R${i + 1}: ${Math.round(r.absCents)}¢`;
      svg.appendChild(lbl);
    });

    // octave marker (target: where the *correct* tap would be)
    rounds.forEach((r, i) => {
      // f(t) = baseline * (ceiling/baseline)^(t/dur) = 2*baseline → solve for t
      // t/dur = log_2(2) / log_2(ceiling/baseline) = 1 / log2(ceiling/baseline)
      const cb = r.ceiling / r.baseline;
      const tFrac = 1 / Math.log2(cb);
      const x = tFrac * W;
      const tick = document.createElementNS(NS, "line");
      tick.setAttribute("x1", x.toFixed(1));
      tick.setAttribute("x2", x.toFixed(1));
      tick.setAttribute("y1", String(H - 4));
      tick.setAttribute("y2", String(H + 4));
      tick.setAttribute("stroke", "#8a9a92");
      tick.setAttribute("stroke-width", "1");
      svg.appendChild(tick);
    });
  }

  // -------- replay --------

  const btnReplay = $("btn-replay");
  btnReplay.addEventListener("click", () => {
    session.roundIdx = 0;
    session.rounds = [];
    session.glideHandle = null;
    session.tapped = false;
    $("begin-round").textContent = "1";
    $("round-pill").textContent = "ROUND 1 / 3";
    show("ready");
  });

  // first paint
  show("unlock");
}
