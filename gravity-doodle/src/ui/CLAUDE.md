# ui/

DOM glue. Everything that calls `document.getElementById` or attaches
event listeners lives here. The simulation core in `../sim/` has no
knowledge of the DOM.

## Files

- `palette.js` — material toolbar. `rebuildPalette()` regenerates
  buttons from the registry; `setMaterial(key)` switches the active
  brush. The element ordering for built-ins is hardcoded in
  `ORDERED_BUILTIN_IDS`; AI-invented elements append.
- `input.js` — pointer / touch handling for the canvas. `bindCanvasInput()`
  attaches all listeners. Also exports `toggleProbe` for the probe button.
- `probe.js` — probe-mode tooltip. `probeAt(col, row)` reads four GL
  textures synchronously (state, temp, charge, air) and renders a
  multi-line readout. Don't call probeAt during normal hover — only
  on click — synchronous readPixels stalls the pipeline.
- `modals.js` — both modals: invent-element and flag-element.
  `bindInventModal` / `bindElementFeedbackModal` wire up listeners;
  `openInvent()` / `openElementFeedback(key)` are the entry points.
- `overlay.js` — the dim canvas overlay with a help message.

## Conventions

- DOM ids in `index.html` are kebab-cased (`btn-drop`, `palette-buttons`).
- Click bindings live in `main.js` for buttons that already exist in
  the static HTML; modal-internal bindings live with each modal.
- Never call `state.gl` methods from this directory — go through a
  `sim/` or `gl/` function instead. The boundary keeps render concerns
  separate from input concerns.
