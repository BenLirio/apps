# src/

ES modules organised by concern. Each subdirectory has its own
CLAUDE.md with editing notes.

## Module map

```
constants.js      Tunables, endpoints, element id constants. Pure data.
state.js          Single mutable state object. Every module imports it.
discovery.js      Reaction-pair discovery toasts. Reads back GPU state.
main.js           Entry point. Wires everything up; `init()` runs at load.

elements/         Element registry + the 28 built-ins.
gl/               WebGL2 context, lookup-texture uploaders, shaders, grid.
sim/              Per-frame simulation pipeline + paint + pours.
ui/               DOM glue: palette, input, probe, modals, overlay.
ai/               Invent-element call + name-based hints + finalizer.
```

## Module dependency rules

1. **`state.js` and `constants.js` depend on nothing else.**
2. **`elements/` depends only on `constants.js`, `state.js`, and the
   things it needs to push fresh data to the GPU (`gl/uploads.js`).**
3. **`gl/uploads.js` depends on `elements/registry.js` for `kindCode`.**
   This circular import is intentional and works because both sides only
   call across at runtime, not at module-init.
4. **`sim/` depends on `gl/` for the binders and on `state.js` for
   ping-pong textures. It does NOT touch the DOM.**
5. **`ui/` depends on `state.js` and on `sim/`. It owns DOM access.**
6. **`ai/` depends on `state.js` for context and `elements/registry.js`
   for nextCustomId. It does NOT touch the DOM (modals.js does that).**

If you find yourself adding a new circular dependency, route it through
`state.js` instead.

## Why ES modules and not a bundler

GitHub Pages serves static files. Browsers natively resolve ES module
imports. Removing the bundler removes the "AI agent has to know to run
a build step" tax. Modules are still small enough that the boot waterfall
of relative imports is invisible.
