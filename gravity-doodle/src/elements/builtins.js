// The 28 built-in elements that ship with the sandbox.
//
// Each spec describes physics traits the engine reads to drive the
// simulation. To add a new built-in: add an id constant in
// constants.js, append a registry entry below with `isBuiltIn: true`,
// then add it to the palette ordering in ui/palette.js if you want it
// to show up in the toolbar.
//
// Trait reference (any may be omitted — sensible defaults apply):
//   kind            'static'|'powder'|'liquid'|'gas'|'cellular'
//   density         1..9 — heavier sinks below lighter
//   colors          ['#hex', ...] — 1-4 swatches; engine cycles through them
//   reactions       [{ other, becomes, chance, selfConsume?, minTemp?, maxTemp?, catalyst? }]
//   flow            powder fluidity 0..1 (sand 0.55, dust 0.95)
//   viscosity       liquid resistance 0..1 (water 0, honey 0.92)
//   stickiness      0..1 — clings to walls (tar 0.85)
//   buoyancy        gas rise 0..1
//   lifeMin/lifeMax gas frame lifespan
//   emitTemp        baseline temp 0..255 (fire 240, ice 10)
//   ignitionPoint   temp at which it can catch fire
//   flammability    0..1 — chance to ignite per frame above ignitionPoint
//   conductivity    0..255 — heat diffusion
//   corrosivity     0..255 — eats neighbors with lower hardness
//   hardness        0..255 — corrosion resistance
//   meltingPoint/meltsTo    — phase change (wall has none)
//   boilingPoint/boilsTo
//   freezingPoint/freezesTo
//   conducts        bool — electrical conductor
//   chargeEmit      -127..127 — overrides cell charge each frame (battery 120)
//   ignitesAtCharge 0..255 — pop on |charge| ≥ this (gunpowder)
//   airflowFactor   0..1 — wind sensitivity
//   emitsAirflow    { vx, vy } in -8..8 — fan
//   pressureBlast/pressureBlastTo  — pop at high pressure
//   raInit/raDelta/raDiesAt/raTransformsTo  — per-cell timer (uranium decay)
//   isExplosive     bool — primes on contact, blasts the next frame
//   born/survive/cellularTick/growChance/surviveChance/birthFrom/growBias
//                   cellular automaton parameters

import { state } from '../state.js';
import {
  WALL_ID, SAND_ID, WATER_ID, EXPLOSIVE_ID, SMOKE_ID, PLANT_ID, SPARK_ID,
  ICE_ID, STEAM_ID, LAVA_ID, FIRE_ID, ACID_ID, HONEY_ID, GRAVEL_ID, STONE_ID,
  MOLD_ID, WOOD_ID, OIL_ID, MERCURY_ID, DUST_ID, COPPER_ID, BATTERY_ID,
  LIGHTNING_ID, FAN_ID, BALLOON_ID, URANIUM_ID, TAR_ID, VINE_ID,
} from '../constants.js';

const SAND_PALETTE = ['#e8a030', '#d89028', '#f0b848', '#e8a838'];

export function initBuiltIns() {
  const r = state.registry;

  r[WALL_ID]      = { id: WALL_ID, key: 'wall', displayName: 'wall', kind: 'static', density: 10, colors: ['#d8c8a0','#c8b890','#b8a880','#c0c090'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 60, corrosivity: 0, hardness: 200 };
  r[SAND_ID]      = { id: SAND_ID, key: 'sand', displayName: 'sand', kind: 'powder', density: 5, flow: 0.55, stickiness: 0, colors: SAND_PALETTE, isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 80, corrosivity: 0, hardness: 60 };
  r[WATER_ID]     = { id: WATER_ID, key: 'water', displayName: 'water', kind: 'liquid', density: 5, viscosity: 0, stickiness: 0, colors: ['#4aa8d8','#3e9ac8','#62b8e0','#2e84b8'], isBuiltIn: true, reactions: [],
    emitTemp: 25, ignitionPoint: 255, flammability: 0, conductivity: 140, corrosivity: 0, hardness: 0,
    boilingPoint: 100, boilsTo: 'steam', freezingPoint: 22, freezesTo: 'ice' };
  r[EXPLOSIVE_ID] = { id: EXPLOSIVE_ID, key: 'explosive', displayName: 'explosive', kind: 'powder', density: 4, flow: 0.45, stickiness: 0, colors: ['#d01818','#ff4030','#ffae40','#ffd060'], isBuiltIn: true, isExplosive: true, explosionRadius: 5, explosionPower: 0.9, reactions: [],
    emitTemp: 30, ignitionPoint: 100, flammability: 0.30, conductivity: 90, corrosivity: 0, hardness: 30,
    ignitesAtCharge: 30 };
  r[SMOKE_ID]     = { id: SMOKE_ID, key: 'smoke', displayName: 'smoke', kind: 'gas', density: 2, buoyancy: 0.6, lifeMin: 90, lifeMax: 180, colors: ['#9a9a9a','#aaaaaa','#888888','#bbbbbb'], isBuiltIn: true, reactions: [],
    emitTemp: 70, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0,
    airflowFactor: 0.7 };
  r[PLANT_ID]     = { id: PLANT_ID, key: 'plant', displayName: 'plant', kind: 'static', density: 3, colors: ['#3aa040','#2c8c34','#4cb854','#226c2a'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 120, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };
  r[SPARK_ID]     = { id: SPARK_ID, key: 'spark', displayName: 'spark', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 14, lifeMax: 34, colors: ['#ffe070','#ffb030','#fff0a0','#ff6020'], isBuiltIn: true, isHidden: true, reactions: [],
    emitTemp: 150, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 0,
    airflowFactor: 0.5 };
  r[ICE_ID]       = { id: ICE_ID, key: 'ice', displayName: 'ice', kind: 'static', density: 5, colors: ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'], isBuiltIn: true, reactions: [],
    emitTemp: 10, ignitionPoint: 255, flammability: 0, conductivity: 160, corrosivity: 0, hardness: 60,
    meltingPoint: 33, meltsTo: 'water' };
  r[STEAM_ID]     = { id: STEAM_ID, key: 'steam', displayName: 'steam', kind: 'gas', density: 1, buoyancy: 0.95, lifeMin: 180, lifeMax: 240, colors: ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'], isBuiltIn: true, reactions: [],
    emitTemp: 130, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0,
    freezingPoint: 50, freezesTo: 'water', airflowFactor: 0.8 };
  r[LAVA_ID]      = { id: LAVA_ID, key: 'lava', displayName: 'lava', kind: 'liquid', density: 8, viscosity: 0.7, stickiness: 0, colors: ['#ff5020','#ff8030','#d03010','#ffc040'], isBuiltIn: true, reactions: [],
    emitTemp: 210, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 80, hardness: 30,
    freezingPoint: 80, freezesTo: 'stone' };
  r[FIRE_ID]      = { id: FIRE_ID, key: 'fire', displayName: 'fire', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70, colors: ['#ff4020','#ff8010','#ffc040','#ffe070'], isBuiltIn: true, reactions: [],
    emitTemp: 240, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 40, hardness: 0,
    airflowFactor: 0.5 };
  r[ACID_ID]      = { id: ACID_ID, key: 'acid', displayName: 'acid', kind: 'liquid', density: 4, viscosity: 0.1, stickiness: 0, colors: ['#60ff30','#80ff40','#30d020','#b0ff60'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 110, corrosivity: 200, hardness: 0 };
  r[HONEY_ID]     = { id: HONEY_ID, key: 'honey', displayName: 'honey', kind: 'liquid', density: 6, viscosity: 0.92, stickiness: 0.7, colors: ['#e8a030','#d48020','#ffc050','#b86020'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 180, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 0 };
  r[GRAVEL_ID]    = { id: GRAVEL_ID, key: 'gravel', displayName: 'gravel', kind: 'powder', density: 7, flow: 0.15, stickiness: 0, colors: ['#7a7060','#605040','#8a8278','#504438'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 100 };
  r[STONE_ID]     = { id: STONE_ID, key: 'stone', displayName: 'stone', kind: 'static', density: 9, colors: ['#888080','#706868','#a09890','#605850'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 200,
    meltingPoint: 200, meltsTo: 'lava' };
  r[MOLD_ID]      = { id: MOLD_ID, key: 'mold', displayName: 'mold', kind: 'cellular', density: 3, born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8], cellularTick: 14, growChance: 0.06, surviveChance: 1, birthFrom: ['plant'], colors: ['#304820','#405830','#50682a','#2a3818'], isBuiltIn: true,
    reactions: [{ other: 'plant', becomes: 'mold', chance: 0.03 }],
    emitTemp: 30, ignitionPoint: 150, flammability: 0.06, conductivity: 70, corrosivity: 0, hardness: 50 };

  // wood — flammable static. Burns through register-based aging.
  r[WOOD_ID]      = { id: WOOD_ID, key: 'wood', displayName: 'wood', kind: 'static', density: 4, colors: ['#7a4820','#8a5828','#5a3010','#a06838'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 140, flammability: 0.04, conductivity: 40, corrosivity: 0, hardness: 100 };
  // oil — light flammable liquid. Floats on water (density 2 vs 5).
  r[OIL_ID]       = { id: OIL_ID, key: 'oil', displayName: 'oil', kind: 'liquid', density: 2, viscosity: 0.3, stickiness: 0, colors: ['#2a1010','#4a2810','#1a0808','#603020'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 100, flammability: 0.20, conductivity: 90, corrosivity: 0, hardness: 0,
    boilingPoint: 180, boilsTo: 'smoke' };
  // mercury — heaviest liquid. Conducts electricity.
  r[MERCURY_ID]   = { id: MERCURY_ID, key: 'mercury', displayName: 'mercury', kind: 'liquid', density: 9, viscosity: 0.1, stickiness: 0, colors: ['#c0c0d0','#a0a0b8','#d8d8e0','#909098'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 0,
    conducts: true };
  // dust — almost weightless powder. Blown around by fans and explosions.
  r[DUST_ID]      = { id: DUST_ID, key: 'dust', displayName: 'dust', kind: 'powder', density: 1, flow: 0.95, stickiness: 0, colors: ['#d0c8b8','#b0a898','#e8e0d0','#988c7c'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 200, flammability: 0.02, conductivity: 50, corrosivity: 0, hardness: 10,
    airflowFactor: 0.95 };
  // copper — electrical conductor.
  r[COPPER_ID]    = { id: COPPER_ID, key: 'copper', displayName: 'copper', kind: 'static', density: 8, colors: ['#c87838','#a85820','#d88848','#985020'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 140,
    conducts: true };
  // battery — charge source. Emits +120 charge constantly.
  r[BATTERY_ID]   = { id: BATTERY_ID, key: 'battery', displayName: 'battery', kind: 'static', density: 8, colors: ['#e0c020','#a08018','#fff060','#806010'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 160,
    conducts: true, chargeEmit: 120 };
  // lightning — short-lived super-charged gas.
  r[LIGHTNING_ID] = { id: LIGHTNING_ID, key: 'lightning', displayName: 'lightning', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 12, lifeMax: 24, colors: ['#fff8e0','#a0d0ff','#ffffff','#80b0ff'], isBuiltIn: true, reactions: [],
    emitTemp: 220, ignitionPoint: 255, flammability: 0, conductivity: 255, corrosivity: 60, hardness: 0,
    conducts: true, chargeEmit: 110, airflowFactor: 0.3 };
  // fan — airflow source. Emits velocity upward.
  r[FAN_ID]       = { id: FAN_ID, key: 'fan', displayName: 'fan', kind: 'static', density: 6, colors: ['#506070','#3a4858','#607888','#404a55'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 120,
    emitsAirflow: { vx: 0, vy: 6 } };
  // balloon — gas you can paint. Pops at high pressure into fire.
  r[BALLOON_ID]   = { id: BALLOON_ID, key: 'balloon', displayName: 'balloon', kind: 'gas', density: 1, buoyancy: 0.95, lifeMin: 400, lifeMax: 600, colors: ['#e84060','#d03050','#ff6080','#a02040'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 90, flammability: 0.30, conductivity: 80, corrosivity: 0, hardness: 0,
    airflowFactor: 0.9, pressureBlast: 180, pressureBlastTo: 'fire' };
  // uranium — radioactive. Decays via ra register over ~250 frames into stone.
  r[URANIUM_ID]   = { id: URANIUM_ID, key: 'uranium', displayName: 'uranium', kind: 'static', density: 9, colors: ['#80b020','#608018','#a0d040','#506010'], isBuiltIn: true, reactions: [],
    emitTemp: 110, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 30, hardness: 180,
    raInit: 250, raDelta: -1, raDiesAt: 0, raTransformsTo: 'stone' };
  // tar — extremely sticky liquid. Stays where you paint it.
  r[TAR_ID]       = { id: TAR_ID, key: 'tar', displayName: 'tar', kind: 'liquid', density: 6, viscosity: 0.95, stickiness: 0.85, colors: ['#1a1008','#2a1810','#3a2418','#1f1410'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 130, flammability: 0.10, conductivity: 60, corrosivity: 0, hardness: 0 };
  // vine — anisotropic cellular. Grows upward preferentially.
  r[VINE_ID]      = { id: VINE_ID, key: 'vine', displayName: 'vine', kind: 'cellular', density: 3, born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8], cellularTick: 12, growChance: 0.08, surviveChance: 1, birthFrom: ['plant'], growBias: 'up', colors: ['#3aa050','#2c8042','#4cb858','#1f6028'], isBuiltIn: true, reactions: [],
    emitTemp: 30, ignitionPoint: 130, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };

  const k = state.keyToId;
  k.wall = WALL_ID;       k.sand = SAND_ID;       k.water = WATER_ID;
  k.explosive = EXPLOSIVE_ID; k.smoke = SMOKE_ID;   k.plant = PLANT_ID;
  k.spark = SPARK_ID;     k.ice = ICE_ID;         k.steam = STEAM_ID;
  k.lava = LAVA_ID;       k.fire = FIRE_ID;       k.acid = ACID_ID;
  k.honey = HONEY_ID;     k.gravel = GRAVEL_ID;   k.stone = STONE_ID;
  k.mold = MOLD_ID;       k.wood = WOOD_ID;       k.oil = OIL_ID;
  k.mercury = MERCURY_ID; k.dust = DUST_ID;       k.copper = COPPER_ID;
  k.battery = BATTERY_ID; k.lightning = LIGHTNING_ID; k.fan = FAN_ID;
  k.balloon = BALLOON_ID; k.uranium = URANIUM_ID; k.tar = TAR_ID;
  k.vine = VINE_ID;

  state.nextId = VINE_ID + 1;
}
