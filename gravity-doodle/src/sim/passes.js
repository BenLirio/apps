// Per-frame GPU pass pipeline.
//
// A "pass" is a useProgram → bind FBO → bind samplers → bind uniforms →
// drawArrays → swap. We do that pattern ~10 times per frame, so it lives
// in `runPass` and each pass below just declares its inputs.
//
// `runFrame` is called from sim/loop.js once per requestAnimationFrame.

import { state } from '../state.js';

// Resolve a sampler source name to a GPU texture handle.
function tex(src) {
  if (src === 'stateRead')  return state.state.read();
  if (src === 'tempRead')   return state.temp.read();
  if (src === 'chargeRead') return state.charge.read();
  if (src === 'airRead')    return state.air.read();
  return state.lookups[src];
}

// Run one pass. opts:
//   prog       — key into state.programs
//   write      — 'state'|'temp'|'charge'|'air' (which ping-pong gets the output and swap)
//                  — null/undefined → write to the default framebuffer (canvas), no swap
//   viewport   — 'full' (default) or 'air'
//   samplers   — { uniformName: sourceKey } map
//   uniforms   — function(prog, gl) called after sampler binds to set scalar/uvec uniforms
function runPass({ prog, write, viewport, samplers, uniforms }) {
  const { gl, programs } = state;
  const p = programs[prog];
  gl.useProgram(p);

  if (write) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, state[write].write());
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  const [vw, vh] = (viewport === 'air')
    ? [state.airCols, state.airRows]
    : (write ? [state.cols, state.rows] : [state.canvas.width, state.canvas.height]);
  gl.viewport(0, 0, vw, vh);

  if (samplers) {
    let unit = 0;
    for (const name in samplers) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex(samplers[name]));
      gl.uniform1i(gl.getUniformLocation(p, name), unit);
      unit++;
    }
  }
  if (uniforms) uniforms(p, gl);

  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  if (write) state[write].swap();
}

// Helpers for the most common uniform sets.
function setSize(p, gl) {
  gl.uniform2i(gl.getUniformLocation(p, 'uSize'), state.cols, state.rows);
  gl.uniform1i(gl.getUniformLocation(p, 'uFrame'), state.frame);
}
function setSizeAir(p, gl) {
  setSize(p, gl);
  gl.uniform2i(gl.getUniformLocation(p, 'uAirSize'), state.airCols, state.airRows);
}

const STATE_SAMPLERS = { uState: 'stateRead', uElemData: 'elementData' };

// ---- Per-frame pipeline ---------------------------------------------------

export function runFrame() {
  // 1. Margolus block CA — runs 4 phases per frame (one per block alignment).
  for (let phase = 0; phase < 4; phase++) {
    runPass({
      prog: 'sim', write: 'state',
      samplers: { uState: 'stateRead', uElemData: 'elementData', uTraits: 'traits', uAir: 'airRead' },
      uniforms: (p, gl) => {
        setSizeAir(p, gl);
        gl.uniform1i(gl.getUniformLocation(p, 'uPhase'), (state.frame * 4 + phase) & 3);
        gl.uniform1i(gl.getUniformLocation(p, 'uFrame'), state.frame * 4 + phase);
      },
    });
  }

  // 2. Explosions — prime then blast.
  runPass({ prog: 'explosionPrime', write: 'state', samplers: STATE_SAMPLERS, uniforms: setSize });
  runPass({
    prog: 'explosionBlast', write: 'state', samplers: STATE_SAMPLERS,
    uniforms: (p, gl) => {
      setSize(p, gl);
      gl.uniform1ui(gl.getUniformLocation(p, 'uSparkId'), (state.keyToId.spark || 0) >>> 0);
    },
  });

  // 3. Reactions + corrosion.
  runPass({
    prog: 'react', write: 'state',
    samplers: { uState: 'stateRead', uReactions: 'reactions', uTraits: 'traits', uTemp: 'tempRead' },
    uniforms: setSize,
  });

  // 4. Heat diffusion (writes to temp, not state).
  runPass({
    prog: 'heat', write: 'temp',
    samplers: { uState: 'stateRead', uTemp: 'tempRead', uTraits: 'traits' },
    uniforms: setSize,
  });

  // 5. Transform (ignition + phase change).
  runPass({
    prog: 'transform', write: 'state',
    samplers: { uState: 'stateRead', uTemp: 'tempRead', uTraits: 'traits',
                uCharge: 'chargeRead', uElemData: 'elementData', uRegisters: 'registers' },
    uniforms: (p, gl) => {
      setSize(p, gl);
      gl.uniform1ui(gl.getUniformLocation(p, 'uFireId'), (state.keyToId.fire || 0) >>> 0);
    },
  });

  // 6. Cellular automaton — once per cellular element per its tick.
  for (const idStr in state.registry) {
    const id = +idStr;
    const spec = state.registry[id];
    if (!spec || spec.kind !== 'cellular') continue;
    const tick = Math.max(1, Math.min(15, Math.round(spec.cellularTick || 6)));
    if (state.frame % tick !== 0) continue;
    runPass({
      prog: 'cellular', write: 'state',
      samplers: { uState: 'stateRead', uCellularData: 'cellular' },
      uniforms: (p, gl) => {
        setSize(p, gl);
        gl.uniform1ui(gl.getUniformLocation(p, 'uCellularId'), id >>> 0);
      },
    });
  }

  // 7. Per-cell register tick (ra timer).
  runPass({
    prog: 'register', write: 'state',
    samplers: { uState: 'stateRead', uRegisters: 'registers', uElemData: 'elementData' },
    uniforms: setSize,
  });

  // 8. Charge propagation.
  runPass({
    prog: 'charge', write: 'charge',
    samplers: { uState: 'stateRead', uCharge: 'chargeRead', uTraits: 'traits' },
    uniforms: setSize,
  });

  // 9. Coarse pressure / airflow.
  runPass({
    prog: 'pressure', write: 'air', viewport: 'air',
    samplers: { uState: 'stateRead', uTemp: 'tempRead', uAir: 'airRead',
                uElemData: 'elementData', uTraits: 'traits' },
    uniforms: setSizeAir,
  });

  // 10. Pop cells when local pressure exceeds their threshold.
  runPass({
    prog: 'pressureBlast', write: 'state',
    samplers: { uState: 'stateRead', uAir: 'airRead', uTraits: 'traits',
                uElemData: 'elementData', uRegisters: 'registers' },
    uniforms: setSizeAir,
  });

  // 11. Composite to canvas.
  runPass({
    prog: 'render', write: null,
    samplers: { uState: 'stateRead', uPalette: 'palette', uElemData: 'elementData',
                uTemp: 'tempRead', uCharge: 'chargeRead' },
    uniforms: setSize,
  });
}
