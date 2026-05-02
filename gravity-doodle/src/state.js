// Single shared mutable state. Imported as `state` everywhere so that
// ping-pong swaps and registry mutations are observable across modules.
//
// Tunables (constant values) live in constants.js, not here. Anything
// in this object is something the running app actively mutates.

export const state = {
  // DOM / GL
  canvas: null,
  gl: null,
  quadVao: null,
  frame: 0,

  // Grid dimensions (full-res sim and coarse 1/4-res air grid).
  cols: 0,
  rows: 0,
  airCols: 0,
  airRows: 0,

  // Ping-pong texture pairs (PingPong instances; see gl/grid.js).
  // Each exposes .read() (tex bound to sampler), .write() (fbo we draw
  // to), .swap() to commit, and .clear(...rgba) to reset.
  state: null,    // RGBA8UI per cell: (id, variant, ra, rb)
  temp:  null,    // R = temperature 0-255
  charge:null,    // R = signed charge in offset binary (128 = 0)
  air:   null,    // RGBA8UI per coarse cell: (pressure, vx, vy, ambient)

  // Lookup textures (256-wide strips packed from the JS registry).
  lookups: {
    elementData: null,
    palette:     null,
    reactions:   null,
    traits:      null,
    cellular:    null,
    registers:   null,
  },

  // GL programs, keyed by short name (sim, paint, render, …).
  programs: {},

  // Element registry — populated by elements.js (built-ins) and
  // ai/finalize.js (invented).
  registry: {},
  keyToId: {},
  nextId: 1,

  // Input + tool state.
  selectedKey: 'wall',
  isPointerDown: false,
  lastCell: null,
  lastPointer: null,
  holdPaintTimer: null,
  animId: null,
  probeMode: false,

  // Element-feedback modal target.
  elfbTargetKey: null,
};
