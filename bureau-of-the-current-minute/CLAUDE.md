# Bureau of the Current Minute

A federal bureau of the present tense. The page shows the weekday + HH:MM as the largest visual element, plus one deterministically-generated typewritten micro-decree about *this exact minute*. Wait one minute — the page silently updates to the next minute's decree. The share button captures the stamped card (weekday + time + decree + serial) as a PNG.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Single screen, no flow — anchor (weekday + time) → decree → postage-stamp card → share button.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **mock-bureaucratic — manilla cardstock, Special Elite typewriter for body, IBM Plex Mono for chrome, red rubber-stamp accents, postage-stamp card**. Owns colors, fonts, borders, animation.
- `app.js` — entry point: imports modules, wires `window.share`, renders the current minute, schedules the next-minute tick aligned to the wall clock, and renders the share-canvas.
- `mechanic.js` — pure deterministic decree generator. Hash-keyed by (weekday, hour, minute) into three banks (frames × subjects × details) so each of the 10,080 weekly minutes maps to a unique sentence in the cursed-mundane Petty-Small-Claims voice.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.png` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

1. `app.js#render()` reads `new Date()` once, calls `mechanic.generateDecree(weekday, hour, minute)`, and writes the result into the decree element. Same call also fills the postage-stamp card (date + serial).
2. `app.js#scheduleNextMinute()` chains `setTimeout` aligned to `60000 - (now.getSeconds()*1000 + now.getMilliseconds())` so the page re-renders exactly on the round-minute boundary, then re-schedules.
3. `app.js#share()` builds a 1600×900 canvas reproducing the anchor + decree + serial + bureau header, then either uses `navigator.share({ files })` (mobile) or downloads the PNG (desktop).

## Quirks

- The decree corpus is *not* a flat 10,080-item array. It's three small banks combined deterministically; each minute gets a unique (subject × detail) pair via independent hash seeds. Adding a new SUBJECT or DETAIL silently re-permutes which minute gets which line — that's a feature for refresh, but a footgun if a particular minute's text was being remembered by a user. Don't reorder banks unless you mean to.
- `setInterval(60000)` would drift; `setTimeout` aligned to the wall clock is intentional. Don't switch.
- The anchor's weekday/hour/minute *must* remain the largest visual element on the page — this is the literal anchor that satisfies ai-pitfalls.md "no-input reveals" sub-rule. Resizing it down breaks the design contract.
- `mechanic.js` `formatTime()` returns 12-hour wall-clock. Locale-agnostic on purpose; the bureau is fictional.
- Canvas share uses Special Elite via web font — fonts may not have loaded when `share()` fires immediately on first load. In practice the user reads the decree first (font loads), then taps share, so the race rarely surfaces. If it becomes a problem, await `document.fonts.ready` before drawing.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- Adding voice-frames / subjects / details is the safest way to deepen the corpus — keep the cursed-mundane Petty-Small-Claims voice; never write a frame that sounds like ChatGPT advice or generic horoscope mysticism.
