# Two Octaves

Audio-first psychoacoustic test: a sine tone climbs upward, the user taps when they think it has risen exactly one octave. Three rounds, increasing baseline difficulty. Verdict + percentile is the share artifact.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Five screens (`#screen-unlock`, `#screen-ready`, `#screen-listen`, `#screen-round-result`, `#screen-verdict`) toggled via `[hidden]`. `#screen-unlock` includes a prominent `.silent-warn` callout (iPhone silent switch / volume / headphones) and a `#pulse-row` of three dots that light up in sync with the calibration tone — both make audio failure user-diagnosable instead of mysterious.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **instrument-credibility** (black bg, amber accent, JetBrains Mono telemetry chrome, code-comment section headers `// ...`, units as captions). Owns colors, fonts, borders, animation.
- `app.js` — entry point: imports `startJourney` from `journey.js`, calls it on the `.app` root, wires `window.share` (Web Share API → clipboard fallback). Reads `window.__verdict` set by journey.js.
- `mechanic.js` — pure logic. Owns the Web Audio engine (`createEngine()`: `unlock`, `testTone`, `startGlide`, `stopGlide`), the per-round config (`ROUNDS`), and the scoring math (`scoreRound`, `percentile`, `verdictFor`, `subjectId`, `flavorFor`, `freqAtTap`, `centsBetween`).
- `data.js` — static reference percentile distribution (400 entries, hand-shaped log-normal-ish) + the four `VERDICTS` (Perfect Pitch / Trained Ear / Civilian / Tone Deaf, Affectionately). DETERMINISTIC and PINNED — do not regenerate; the percentile table is part of the app's identity.
- `journey.js` — copy strings + the screen state machine (`unlock → ready → listen → round-result → verdict`). Owns the rAF tick that drives the live meter, the rounds[] accumulator, and the SVG waveform draw on the verdict card.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/feedback.js`.
- `og.jpg` — share-preview image. Risograph zine print of an oscilloscope sine spiraling into the doubled octave. Regenerate via `implement-deploy` only if the visual identity or core hook changes.

## Data flow

`mechanic.js` exports `ROUNDS` (3 entries) and `createEngine()`. `journey.js` instantiates an engine, awaits `engine.unlock()` inside the unlock-button click handler (required user gesture), plays a calibration tone, then for each round calls `engine.startGlide(round)` → drives a rAF loop that updates `#meter-fill` and `#live-freq` from `ctx.currentTime - glideHandle.startedAt` → on tap (or auto-end at glide ceiling) computes `tapElapsed`, calls `scoreRound(round, glideHandle, tapElapsed)` to produce `{tapHz, trueOctaveHz, cents, absCents, direction, ...}`, pushes onto `session.rounds`. After R3, `percentile(avgAbsCents)` and `verdictFor(avgAbsCents)` produce the verdict; SVG waveform is drawn with one tap-line per round (color-coded green/amber/warn). `window.__verdict = {name, pct, avg, sid}` is the share payload `app.js` reads.

## Quirks

- `engine.unlock()` is called on the FIRST user tap (`#btn-unlock`) and a calibration tone plays inside that same gesture chain — required for iOS Safari Web Audio policy. Subsequent rounds also call `engine.ensureRunning()` to re-resume if the context suspended (background tab).
- The calibration tone is **three short pulses** (vs one steady tone), louder (gain 0.32 vs the old 0.18), and `engine.testTone(onPulse)` accepts a callback so the UI can light its `#pulse-row` dots in sync. Pulsed playback + visible dots make the audio path observable even when the device is muted — that turned previously-mysterious "no sound" reports into clearly-diagnosable "your silent switch is on" UX.
- The glide ceiling is `baseline * 1.25` (a major third *past* the octave), not the octave itself, so the user has somewhere to tap "late." Auto-end fires if they never tap.
- 150ms tap-too-early guard: a tap inside the first 150ms of the glide is rejected (status flashes "// too early"), letting the user try again without burning the round.
- Reference distribution is a fixed 400-entry array in `data.js`. We do NOT call any "live" percentile API — that breaks reproducibility and exceeds the no-key-no-auth rule. Treat the distribution as the app's identity, like a high-score table.
- Frequency math uses `exponentialRampToValueAtTime` and `freqAtTap()` mirrors that exact curve so `tapElapsed → tapHz` is correct (linear ramp would feel wrong perceptually).
- `subjectId()` is a deterministic hash of the round results — same playthrough always stamps the same ID. Used in the verdict-card sub-text for the "subject_4729" flavor.
- The verdict card's `<svg>` is drawn programmatically per session — no canvas, no DPR issues. Tap-lines are amber for "passing" (≤280¢) and warm-warn red for failing rounds.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- Do NOT change `REF_DISTRIBUTION` or `VERDICTS` thresholds without versioning — old screenshots stop matching new percentiles. If you must, regenerate with intent and bump a label somewhere visible.
- Do NOT introduce an `<audio>` element. Web Audio is the *only* path that survives iOS silent-mode with AirPods/Bluetooth.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
