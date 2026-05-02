# gravity-doodle

GPU-driven falling-sand sandbox with AI-invented elements. Runs entirely
in the browser on WebGL2. The only network calls are to two AWS API
Gateway endpoints (one for the AI invent call, one for user feedback).

## Files at this level

- `index.html` — DOM scaffold. Loads `src/main.js` as a module and
  `feedback.js` as a classic script. Buttons have ids; JS finds them
  with `getElementById` — **no inline `onclick`**.
- `style.css` — all styling. Keep changes self-contained per selector.
- `feedback.js` — independent global feedback widget. Mounts a
  "Feedback" button that POSTs to the shared feedback endpoint.
  Don't touch unless the endpoint changes.
- `src/` — all simulation code, split into focused ES modules. See
  `src/CLAUDE.md` for the module map.

## Architecture in one sentence

The simulation is **a chain of GPU passes** (sim → explosion → react →
heat → transform → cellular → register → charge → pressure → render)
declared in `src/sim/passes.js`, reading and writing small `RGBA8UI`
ping-pong textures sized to the canvas, plus per-element lookup
textures packed from the JS registry whenever it changes.

## Hard constraints

- **No build step.** GitHub Pages serves these files as-is.
  `<script type="module">` does the heavy lifting.
- **No bundler, no TypeScript, no JSX.** The bar for this app is
  "AI agent edits a file, pushes, it works".
- **WebGL2 required.** No WebGL1 fallback path.

## How to run locally

`python3 -m http.server 8000` from this directory, then open
`http://localhost:8000/`. Native ESM requires a real HTTP server —
`file://` won't work because of CORS on imports.

## Editing checklist

When you change anything, ask:

1. **Adding an engine trait?** Edit `src/traits.js TRAITS` (one entry:
   slot, encoder, default, AI-prompt doc). Then add the texelFetch in
   the relevant shader. `uploads.js`, `ai/finalize.js`, `ai/generate.js`,
   and `ui/probe.js` are all driven by that table — they need no edits.
2. **Adding a GPU pass?** Add a shader file under `src/gl/shaders/`,
   register it in `src/gl/context.js PROGRAMS`, and append a
   `runPass(...)` call in `src/sim/passes.js runFrame()` at the right
   point in the order.
3. **Adding a built-in element?** Append a row to `BUILTINS` in
   `src/elements.js`. Any trait you don't set takes the default from
   `traits.js`. IDs are assigned in registration order.
4. **Touching shared mutable state?** Read `src/state.js` first.
   Per-frame texture pairs go through the `PingPong` helper —
   `state.state.swap()` is the one place a swap happens.
