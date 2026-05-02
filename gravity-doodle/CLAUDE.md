# gravity-doodle

GPU-driven falling-sand sandbox with AI-invented elements. Runs entirely
in the browser on WebGL2; the only network calls are to two AWS API
Gateway endpoints (one for the AI invent call, one for user feedback).

## Files at this level

- `index.html` — DOM scaffold. Loads `src/main.js` as a module and
  `feedback.js` as a classic script. Buttons have ids; JS finds them
  with `getElementById` and binds events — **no inline `onclick`**.
- `style.css` — all styling. Keep changes self-contained per selector.
- `feedback.js` — independent feedback widget. Mounts a "Feedback" button
  that POSTs to the shared feedback endpoint. Don't touch unless the
  endpoint changes.
- `src/` — all simulation code, split into focused ES modules. See
  `src/CLAUDE.md` for the module map.

## Architecture in one sentence

The simulation is **a chain of GPU passes** (sim → reactions → heat →
charge → pressure → render) that read and write small `RGBA8UI` ping-pong
textures sized to the canvas, plus per-element "lookup textures" packed
from the JS element registry on every change.

## Hard constraints

- **No build step.** GitHub Pages serves these files as-is. `<script
  type="module">` does the heavy lifting; native ES module imports
  resolve relative paths in the browser.
- **No bundler, no TypeScript, no JSX.** If you reach for one, stop —
  the bar for this app is "AI agent edits a file, pushes, it works".
- **WebGL2 required.** `webgl1` codepath was deliberately removed; this
  is a 2026 sandbox app.

## How to run locally

`python3 -m http.server 8000` from this directory, then open
`http://localhost:8000/`. Native ESM requires a real HTTP server —
`file://` won't work because of CORS on imports.

## Editing checklist

When you change anything, ask:

1. Did I add a new element trait? **Update three places:** the spec
   format docs in `src/elements/builtins.js`, the AI prompt in
   `src/ai/generate.js`, and the trait packing in `src/gl/uploads.js`.
2. Did I add a new GPU pass? **Update three places:** add the shader
   under `src/gl/shaders/`, register it in `src/gl/context.js` initGL,
   add a step function in `src/sim/passes.js`, and call it from
   `src/sim/loop.js`.
3. Did I touch shared mutable state? Read `src/state.js` first — every
   mutation goes through that one object so ping-pong swaps stay
   coherent across modules.
