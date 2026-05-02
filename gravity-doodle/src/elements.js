// Element registry: built-in element table + the registerElement entry
// point that AI-invented elements also flow through.
//
// Built-ins are expressed as a flat table. Anything not specified inherits
// the trait defaults from traits.js. Adding a built-in: append a row to
// BUILTINS with at least { colors }; pick a kind; everything else is
// optional. IDs are assigned in registration order — there is no canonical
// numbering.

import { state } from './state.js';
import {
  uploadElementData, uploadPalette, uploadReactions,
  uploadTraits, uploadCellular, uploadRegisters,
} from './gl/uploads.js';

const SAND_COLORS = ['#e8a030', '#d89028', '#f0b848', '#e8a838'];

// Format: [key, kind, spec_overrides]. Order = palette order.
const BUILTINS = [
  ['wall',      'static',   { density: 10, hardness: 200, conductivity: 60,
                              colors: ['#d8c8a0','#c8b890','#b8a880','#c0c090'] }],
  ['stone',     'static',   { density: 9, hardness: 200, conductivity: 100,
                              meltingPoint: 200, meltsTo: 'lava',
                              colors: ['#888080','#706868','#a09890','#605850'] }],
  ['wood',      'static',   { density: 4, hardness: 100, conductivity: 40,
                              ignitionPoint: 140, flammability: 0.04,
                              colors: ['#7a4820','#8a5828','#5a3010','#a06838'] }],
  ['sand',      'powder',   { density: 5, flow: 0.55, hardness: 60, conductivity: 80,
                              colors: SAND_COLORS }],
  ['gravel',    'powder',   { density: 7, flow: 0.15, hardness: 100, conductivity: 100,
                              ignitionPoint: 240,
                              colors: ['#7a7060','#605040','#8a8278','#504438'] }],
  ['dust',      'powder',   { density: 1, flow: 0.95, hardness: 10, conductivity: 50,
                              ignitionPoint: 200, flammability: 0.02, airflowFactor: 0.95,
                              colors: ['#d0c8b8','#b0a898','#e8e0d0','#988c7c'] }],
  ['water',     'liquid',   { density: 5, viscosity: 0, conductivity: 140, emitTemp: 25,
                              boilingPoint: 100, boilsTo: 'steam',
                              freezingPoint: 22, freezesTo: 'ice',
                              colors: ['#4aa8d8','#3e9ac8','#62b8e0','#2e84b8'] }],
  ['oil',       'liquid',   { density: 2, viscosity: 0.3, conductivity: 90,
                              ignitionPoint: 100, flammability: 0.20,
                              boilingPoint: 180, boilsTo: 'smoke',
                              colors: ['#2a1010','#4a2810','#1a0808','#603020'] }],
  ['mercury',   'liquid',   { density: 9, viscosity: 0.1, conductivity: 240, conducts: true,
                              colors: ['#c0c0d0','#a0a0b8','#d8d8e0','#909098'] }],
  ['honey',     'liquid',   { density: 6, viscosity: 0.92, stickiness: 0.7,
                              ignitionPoint: 180, flammability: 0.05, conductivity: 70,
                              colors: ['#e8a030','#d48020','#ffc050','#b86020'] }],
  ['tar',       'liquid',   { density: 6, viscosity: 0.95, stickiness: 0.85,
                              ignitionPoint: 130, flammability: 0.10, conductivity: 60,
                              colors: ['#1a1008','#2a1810','#3a2418','#1f1410'] }],
  ['acid',      'liquid',   { density: 4, viscosity: 0.1, conductivity: 110, corrosivity: 200,
                              ignitionPoint: 200,
                              colors: ['#60ff30','#80ff40','#30d020','#b0ff60'] }],
  ['ice',       'static',   { density: 5, hardness: 60, conductivity: 160, emitTemp: 10,
                              meltingPoint: 33, meltsTo: 'water',
                              colors: ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'] }],
  ['steam',     'gas',      { density: 1, buoyancy: 0.95, lifeMin: 180, lifeMax: 240,
                              emitTemp: 130, conductivity: 200, airflowFactor: 0.8,
                              freezingPoint: 50, freezesTo: 'water',
                              colors: ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'] }],
  ['lava',      'liquid',   { density: 8, viscosity: 0.7, emitTemp: 210, conductivity: 180,
                              corrosivity: 80, hardness: 30,
                              freezingPoint: 80, freezesTo: 'stone',
                              colors: ['#ff5020','#ff8030','#d03010','#ffc040'] }],
  ['fire',      'gas',      { density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70,
                              emitTemp: 240, conductivity: 220, corrosivity: 40,
                              airflowFactor: 0.5,
                              colors: ['#ff4020','#ff8010','#ffc040','#ffe070'] }],
  ['explosive', 'powder',   { density: 4, flow: 0.45, isExplosive: true,
                              explosionRadius: 5, explosionPower: 0.9,
                              ignitionPoint: 100, flammability: 0.30, conductivity: 90,
                              hardness: 30, ignitesAtCharge: 30,
                              colors: ['#d01818','#ff4030','#ffae40','#ffd060'] }],
  ['smoke',     'gas',      { density: 2, buoyancy: 0.6, lifeMin: 90, lifeMax: 180,
                              emitTemp: 70, conductivity: 200, airflowFactor: 0.7,
                              colors: ['#9a9a9a','#aaaaaa','#888888','#bbbbbb'] }],
  ['balloon',   'gas',      { density: 1, buoyancy: 0.95, lifeMin: 400, lifeMax: 600,
                              ignitionPoint: 90, flammability: 0.30, conductivity: 80,
                              airflowFactor: 0.9, pressureBlast: 180, pressureBlastTo: 'fire',
                              colors: ['#e84060','#d03050','#ff6080','#a02040'] }],
  ['plant',     'static',   { density: 3, hardness: 40, conductivity: 70,
                              ignitionPoint: 120, flammability: 0.05,
                              colors: ['#3aa040','#2c8c34','#4cb854','#226c2a'] }],
  ['mold',      'cellular', { density: 3, hardness: 50, conductivity: 70,
                              ignitionPoint: 150, flammability: 0.06,
                              born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8],
                              cellularTick: 14, growChance: 0.06, surviveChance: 1,
                              birthFrom: ['plant'],
                              reactions: [{ other: 'plant', becomes: 'mold', chance: 0.03 }],
                              colors: ['#304820','#405830','#50682a','#2a3818'] }],
  ['vine',      'cellular', { density: 3, hardness: 40, conductivity: 70,
                              ignitionPoint: 130, flammability: 0.05,
                              born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8],
                              cellularTick: 12, growChance: 0.08, surviveChance: 1,
                              birthFrom: ['plant'], growBias: 'up',
                              colors: ['#3aa050','#2c8042','#4cb858','#1f6028'] }],
  ['copper',    'static',   { density: 8, hardness: 140, conductivity: 240, conducts: true,
                              ignitionPoint: 220,
                              colors: ['#c87838','#a85820','#d88848','#985020'] }],
  ['battery',   'static',   { density: 8, hardness: 160, conductivity: 180, conducts: true,
                              chargeEmit: 120, ignitionPoint: 200,
                              colors: ['#e0c020','#a08018','#fff060','#806010'] }],
  ['lightning', 'gas',      { density: 1, buoyancy: 1, lifeMin: 12, lifeMax: 24,
                              emitTemp: 220, conductivity: 255, corrosivity: 60,
                              conducts: true, chargeEmit: 110, airflowFactor: 0.3,
                              colors: ['#fff8e0','#a0d0ff','#ffffff','#80b0ff'] }],
  ['fan',       'static',   { density: 6, hardness: 120, conductivity: 100,
                              ignitionPoint: 220, emitsAirflow: { vx: 0, vy: 6 },
                              colors: ['#506070','#3a4858','#607888','#404a55'] }],
  ['uranium',   'static',   { density: 9, hardness: 180, conductivity: 180,
                              corrosivity: 30, emitTemp: 110,
                              raInit: 250, raDelta: -1, raDiesAt: 0, raTransformsTo: 'stone',
                              colors: ['#80b020','#608018','#a0d040','#506010'] }],
  // Hidden: spawned by the engine (explosions), not user-paintable.
  ['spark',     'gas',      { density: 1, buoyancy: 1, lifeMin: 14, lifeMax: 34,
                              emitTemp: 150, conductivity: 220, airflowFactor: 0.5,
                              isHidden: true,
                              colors: ['#ffe070','#ffb030','#fff0a0','#ff6020'] }],
];

export function initBuiltIns() {
  for (const [key, kind, overrides] of BUILTINS) {
    const id = state.nextId++;
    state.registry[id] = Object.assign({
      id, key, displayName: key, kind, isBuiltIn: true, reactions: [],
    }, overrides);
    state.keyToId[key] = id;
  }
}

export function registerElement(spec) {
  state.registry[spec.id] = spec;
  state.keyToId[spec.key] = spec.id;
  if (spec.id >= state.nextId) state.nextId = spec.id + 1;
  if (state.gl) {
    uploadElementData();
    uploadPalette();
    uploadReactions();
    uploadTraits();
    uploadCellular();
    uploadRegisters();
  }
}

export function nextCustomId() { return state.nextId++; }

export function kindCode(kind) {
  switch (kind) {
    case 'static':   return 1;
    case 'powder':   return 2;
    case 'liquid':   return 3;
    case 'gas':      return 4;
    case 'cellular': return 5;
  }
  return 0;
}
