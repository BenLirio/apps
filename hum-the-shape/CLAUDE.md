# Hum The Shape

Audio-first pitch-tracing game. A target curve appears on a black canvas; the user hums, the mic listens, and their pitch contour is drawn in glowing red over the white target. DTW scores path overlap; verdict reveals after three rounds. Finger-trace fallback if mic is denied.

## Files

- `index.html` — DOM (intro / mic-confirm / play / result screens) + share-preview meta + ES module entry
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **terminal/CRT — black bg, amber-on-green monospace HUD, subtle scanlines, white target line, glowing red user trace**. Owns colors, fonts (VT323 + Share Tech Mono), borders, glow.
- `app.js` — entry point: imports `loop.js`, exposes `window.share = shareResult`, calls `startLoop()`.
- `loop.js` — per-screen state machine, rAF play loop (8s × 3 rounds), all canvas rendering (target, user trace, confirm preview, receipt mini-canvases, 1080×600 share-card composer), input plumbing (mic-or-finger).
- `audio.js` — pure data + math: the three deterministic target shapes (`SHAPES`), DTW (`dtw`), autocorrelation pitch detection (`detectPitch`), verdict tiers (`verdictFor`), mic acquisition (`acquireMic`).
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

1. User taps `// ENGAGE MIC` → `acquireMic()` returns `{ ctx, analyser, buf, source }`. Show `screen-confirm`. The confirm loop reads `analyser.getFloatTimeDomainData(buf)` each frame, runs `detectPitch`, paints a rolling 200-sample red trace, and **calibrates `state.pitchRange` from observed min/max** so the play canvas maps the user's actual range onto y in [0,1].
2. Confirm gate forces an explicit "yes — red line moved" tap (per `audio-constraints.md` audio-confirmation-gate rule); "no" tears down the AudioContext and switches to finger mode.
3. Each round: `playTick(now)` walks `[0, ROUND_SECONDS]`, samples pitch (or `state.fingerY`) at each frame, fills `state.userSamples` to 200 samples by the end. `drawPlay` re-renders target + user trace each frame.
4. Round end: `dtw(target, userFilled)` → mean per-step cost in [0,1] → `(1 - cost) * 100` is the round overlap %. Stored in `state.rounds`.
5. After round 3: average overlap → `verdictFor(pct)` returns `{ name, tone }`. Result screen shows verdict band, three mini target-vs-user receipt rows, micro-copy.
6. Share: `composeShareCard()` paints a 1080×600 verdict + 3-panel receipt PNG; `navigator.share` if available, else clipboard fallback.

## Quirks

- **Pitch calibration is round-by-round-stable but session-fresh.** `state.pitchRange` is set from the confirm screen's observed min/max + 40% padding. We deliberately don't hard-code 100–350 Hz because user vocal ranges differ — calibration makes "your highest hum" map to the top of the canvas, not "C5 maps to top."
- **`detectPitch` returns 0 on silence (rms < 0.012).** When the mic returns 0 we hold the previous y rather than dropping to baseline — keeps the trace continuous if the user breathes.
- **Targets are deterministic, not generated at runtime.** `buildU / buildSaw / buildDuck` produce the exact same arrays every load. The "small angry duck" is a sum of 3 sines + 3 spikes — it's a recognizable squiggle, not a literal duck (per the spec).
- **DTW is O(n·m) with rolling rows** — both sequences are 200 samples, so ~40k ops per round. Trivially fast in JS.
- **No save/share CTA on intermediate rounds.** The artifact is the final 3-panel receipt; per-round mini-canvases are inside the receipt, not separately downloadable.
- **Mic-confirmation-gate is mandatory** even on a desktop where it might feel pedantic — `audioContext.state === "running"` is not the same as "user heard / saw movement." Catches silent-output / mic-on-but-broken cases.

## Editing rules

- Soft cap 400 lines per JS file. `loop.js` is at 395 — if any new feature pushes it over, split out a `share.js` (the share-card composer is the obvious next seam).
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
