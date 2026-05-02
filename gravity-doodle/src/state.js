// Single source of truth for mutable runtime state. Modules import this
// object and read or assign properties on it. We deliberately avoid
// per-module `let` exports because ping-pong texture swaps must be
// observable everywhere — `[state.stateTexA, state.stateTexB] = ...` is
// the canonical pattern.
//
// Nothing in here is "configuration" — tunables live in constants.js.
// Anything in here is something the running app actively mutates.

export const state = {
  // DOM / GL
  canvas: null,
  gl: null,

  // Grid sizes (full-res state and coarse pressure/airflow grid).
  cols: 0,
  rows: 0,
  airCols: 0,
  airRows: 0,

  // Ping-pong textures + framebuffers.
  stateTexA: null, stateTexB: null,
  stateFboA: null, stateFboB: null,
  tempTexA:  null, tempTexB:  null,
  tempFboA:  null, tempFboB:  null,
  chargeTexA: null, chargeTexB: null,
  chargeFboA: null, chargeFboB: null,
  airTexA: null, airTexB: null,
  airFboA: null, airFboB: null,

  // Lookup textures (1D-ish strips, one column per element id).
  elementDataTex: null,
  paletteTex: null,
  reactionsTex: null,
  traitsTex: null,
  cellularDataTex: null,
  registersTex: null,

  // GL programs.
  progSim: null, progPaint: null, progRender: null, progClear: null,
  progReact: null, progContact: null, progBlast: null,
  progHeat: null, progIgnition: null, progCellular: null,
  progCorrosion: null, progPhase: null,
  progRegister: null, progCharge: null,
  progPressure: null, progAdvect: null, progPressureBlast: null,

  quadVao: null,
  frameCounter: 0,

  // Element registry — populated by elements/builtins.js then by AI.
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

  // Pours (sand pouring from top, gas from bottom).
  pours: [],

  // Discovery log.
  discoveryRules: [],
  discoveredKeys: new Set(),
  discoveryReadBuf: null,
  discoveryToastQueue: [],
  discoveryToastActive: false,
  discoveryToastTimer: null,

  // Element-feedback modal target.
  elfbTargetKey: null,
};
