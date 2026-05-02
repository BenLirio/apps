# ui/

DOM glue. Everything that calls `document.getElementById` or attaches
event listeners lives here. The simulation core in `../sim/` has no
knowledge of the DOM.

## Files

- `palette.js` — material toolbar. `rebuildPalette()` regenerates
  buttons from the registry in id order (built-ins first because they
  register first; AI elements append). `setMaterial(key)` switches the
  active brush. AI elements get a corner "flag" badge that opens the
  element-feedback modal.
- `input.js` — pointer / touch handling for the canvas.
  `bindCanvasInput()` attaches all listeners. Also exports `toggleProbe`
  for the probe button.
- `probe.js` — probe-mode tooltip. `probeAt(col, row)` reads four GPU
  textures synchronously (state, temp, charge, air) and shows the
  basics: name, kind, density, temp, charge, pressure. Tap-only — a
  hover loop would stall the pipeline.
- `modals.js` — both modals: invent-element (calls the AI) and
  flag-element (sends element_feedback to the feedback endpoint).
  `bindInventModal` / `bindElementFeedbackModal` wire up listeners;
  `openInvent()` / `openElementFeedback(key)` are the entry points.
- `overlay.js` — dim canvas overlay with a help message.

## Conventions

- DOM ids in `index.html` are kebab-cased (`btn-probe`, `palette-buttons`).
- Click bindings for static buttons live in `main.js`; modal-internal
  bindings live with each modal.
- Never call `state.gl` methods from this directory — go through a
  `sim/` or `gl/` function. The boundary keeps render concerns
  separate from input concerns.
