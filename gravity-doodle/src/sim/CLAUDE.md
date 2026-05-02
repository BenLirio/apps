# sim/

Per-frame simulation pipeline. No DOM access from this directory.

## Files

- `loop.js` — one function: `loop()`. Calls every pass in order, then
  schedules the next animation frame. Discovery readback runs on a
  60-frame interval to avoid GPU→CPU sync stalls.
- `passes.js` — one exported `*Step()` function per GPU pass. Each
  binds its uniforms, draws the fullscreen quad, and ping-pong-swaps
  the textures it wrote.
- `paint.js` — paint-brush logic. `paintAtFrag(cx, cy, brushR)` is the
  entry point input handlers call. Handles randomized gas life and
  explosive settle window.
- `pours.js` — pour state (the "pour sand" button). Spawns elements
  every frame for ~5 seconds. Multiple pours queue independently.

## Adding a new pass

```js
// in passes.js
export function fooStep() {
  const { gl, progFoo, frameCounter, cols, rows } = state;
  if (!progFoo) return;
  gl.useProgram(progFoo);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);  // or tempFboB / chargeFboB / airFboB
  gl.viewport(0, 0, cols, rows);
  bindStateA(progFoo, 'uState', 0);
  // ... bind other inputs ...
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  // PING-PONG SWAP — easy to forget, always required:
  [state.stateTexA, state.stateTexB] = [state.stateTexB, state.stateTexA];
  [state.stateFboA, state.stateFboB] = [state.stateFboB, state.stateFboA];
}
```

Then call `fooStep()` from `loop.js` at the appropriate point in the
pipeline.

## Pipeline ordering rules

- Motion (`simStep`, `explosionStep`) before chemistry — otherwise
  reactions fire on stale positions.
- Heat (`heatStep`) before ignition / phase — temperature must settle
  before threshold checks.
- Charge AFTER ignition reads it — ignition uses the charge from the
  PREVIOUS frame, which is fine.
- Render last; it goes to the default framebuffer.
