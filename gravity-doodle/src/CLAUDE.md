# src/

ES modules organised by concern. Single mutable `state` object holds
all per-frame mutable handles; every module imports it.

## Module map

```
constants.js     Tunables and HTTP endpoints. Pure data.
state.js         Single mutable state object. Every module imports it.
traits.js        Single trait table — slot, encoder, default, AI prompt doc.
elements.js      28 built-ins as a flat table + registerElement entry point.
main.js          Entry point. `init()` runs at load.

gl/              WebGL2 context, lookup-texture uploaders, ping-pong grid,
                 shader files (one per pass).
sim/             Per-frame simulation pipeline (passes.js declares the
                 pipeline, loop.js drives requestAnimationFrame, paint.js
                 owns the brush).
ui/              DOM glue: palette, input, probe, modals, overlay.
ai/              Invent-element call (generate.js) + spec validator
                 (finalize.js). No name-keyword heuristics — we trust the
                 model and clamp via the trait table.
```

## Adding a trait

A trait is one byte in the traits texture. To add one:

1. Pick a free `[row, col]` slot in `traits.js TRAITS`.
2. Append an entry: `{ name, slot, def, enc, cl, doc }`.
3. Add the texelFetch in whichever shader needs to read it.

That's it. `uploads.js`, `ai/finalize.js`, `ai/generate.js`, and
`ui/probe.js` all read from the table — they need no edits.

## Adding a GPU pass

1. Add a shader file under `gl/shaders/`.
2. Register the program in `gl/context.js PROGRAMS`.
3. Append a `runPass(...)` call in `sim/passes.js runFrame()` at the
   right point in the order.

## Module dependency rules

1. `state.js`, `constants.js`, and `traits.js` depend on nothing.
2. `elements.js` depends on `state.js` and `gl/uploads.js`.
3. `gl/uploads.js` depends on `elements.js` (for `kindCode`) and on
   `traits.js`. The cycle is fine — both sides only call across at
   runtime, not at module-init.
4. `sim/` depends on `gl/` and on `state.js`. It does NOT touch the DOM.
5. `ui/` depends on `state.js` and on `sim/`. It owns DOM access.
6. `ai/` depends on `state.js`, `traits.js`, and `elements.js`. The
   modals (`ui/modals.js`) own the DOM glue around the AI call.

## Why ES modules and not a bundler

GitHub Pages serves static files. Browsers natively resolve ES module
imports. No build step = no "AI agent has to know to run a build" tax.
