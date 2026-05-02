// Gravity Doodle — physics sandbox v2.
//
// What's new vs v1:
//   • Per-cell registers (ra/rb) — element-defined state for aging, decay,
//     radioactivity, fermentation, anything that needs a counter per pixel.
//   • Charge field — electricity propagates through conductors. Batteries
//     emit, copper carries, lightning ignites flammables, gunpowder pops at
//     a charge threshold. New full-resolution texture, diffusion shader.
//   • Coarse pressure/airflow grid (1/4 res) — gases drift, fans push,
//     explosions inject pressure pulses, balloons pop at high pressure.
//   • Density-aware displacement — mercury (9) sinks through water (5),
//     oil (2) floats on water, all liquids stack by density.
//   • Stickiness wired into Margolus block — tar/honey actually cling to
//     walls. Cells with stickiness > 0 skip their swap with probability
//     stickiness when adjacent to a static or cellular cell.
//   • Reaction conditions — minTemp/maxTemp gates, catalyst flag.
//   • Anisotropic cellular growth — vines grow up, roots grow down.
//
// Cell layout: RGBA8UI = (id, variant, ra, rb).
// ra and rb are general-purpose 8-bit registers whose meaning is
// element-defined. Existing semantics (explosive settle, gas life) are
// special cases: explosive uses (ra=settle, rb=primedFlag); gas uses
// (ra=life). The registerStep shader handles AI-defined registers via the
// raInit/raDelta/raDiesAt/raTransformsTo trait fields.

(function () {
  // ── Constants ──────────────────────────────────────────────────────────────
  const CELL = 3;
  const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
  const FEEDBACK_ENDPOINT = 'https://5c99bazuj0.execute-api.us-east-1.amazonaws.com/feedback';
  const SLUG = 'gravity-doodle';

  const KIND_EMPTY    = 0;
  const KIND_STATIC   = 1;
  const KIND_POWDER   = 2;
  const KIND_LIQUID   = 3;
  const KIND_GAS      = 4;
  const KIND_CELLULAR = 5;

  function kindCode(kind) {
    switch (kind) {
      case 'static':   return KIND_STATIC;
      case 'powder':   return KIND_POWDER;
      case 'liquid':   return KIND_LIQUID;
      case 'gas':      return KIND_GAS;
      case 'cellular': return KIND_CELLULAR;
    }
    return KIND_EMPTY;
  }

  // ── Element registry ───────────────────────────────────────────────────────
  const registry = {};
  const keyToId  = {};
  let nextId = 1;

  function registerElement(spec) {
    registry[spec.id] = spec;
    keyToId[spec.key] = spec.id;
    if (spec.id >= nextId) nextId = spec.id + 1;
    if (gl) {
      uploadElementData();
      uploadPalette();
      uploadReactions();
      uploadTraits();
      uploadCellular();
      uploadRegisters();
    }
    rebuildDiscoveryRules();
  }

  function nextCustomId() { return nextId++; }

  // ── Built-in seed elements ─────────────────────────────────────────────────
  const WALL_ID      = 1;
  const SAND_ID      = 2;
  const WATER_ID     = 3;
  const EXPLOSIVE_ID = 4;
  const SMOKE_ID     = 5;
  const PLANT_ID     = 6;
  const SPARK_ID     = 7;
  const ICE_ID       = 8;
  const STEAM_ID     = 9;
  const LAVA_ID      = 10;
  const FIRE_ID      = 11;
  const ACID_ID      = 12;
  const HONEY_ID     = 13;
  const GRAVEL_ID    = 14;
  const STONE_ID     = 15;
  const MOLD_ID      = 16;
  // v2 showcase elements
  const WOOD_ID      = 17;
  const OIL_ID       = 18;
  const MERCURY_ID   = 19;
  const DUST_ID      = 20;
  const COPPER_ID    = 21;
  const BATTERY_ID   = 22;
  const LIGHTNING_ID = 23;
  const FAN_ID       = 24;
  const BALLOON_ID   = 25;
  const URANIUM_ID   = 26;
  const TAR_ID       = 27;
  const VINE_ID      = 28;

  const SAND_PALETTE = ['#e8a030', '#d89028', '#f0b848', '#e8a838'];

  function initBuiltIns() {
    // Existing core ────────────────────────────────────────────────────────
    registry[WALL_ID]      = { id: WALL_ID, key: 'wall', displayName: 'wall', kind: 'static', density: 10, colors: ['#d8c8a0','#c8b890','#b8a880','#c0c090'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 60, corrosivity: 0, hardness: 200 };
    registry[SAND_ID]      = { id: SAND_ID, key: 'sand', displayName: 'sand', kind: 'powder', density: 5, flow: 0.55, stickiness: 0, colors: SAND_PALETTE, isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 80, corrosivity: 0, hardness: 60 };
    registry[WATER_ID]     = { id: WATER_ID, key: 'water', displayName: 'water', kind: 'liquid', density: 5, viscosity: 0, stickiness: 0, colors: ['#4aa8d8','#3e9ac8','#62b8e0','#2e84b8'], isBuiltIn: true, reactions: [],
      emitTemp: 25, ignitionPoint: 255, flammability: 0, conductivity: 140, corrosivity: 0, hardness: 0,
      boilingPoint: 100, boilsTo: 'steam', freezingPoint: 22, freezesTo: 'ice' };
    registry[EXPLOSIVE_ID] = { id: EXPLOSIVE_ID, key: 'explosive', displayName: 'explosive', kind: 'powder', density: 4, flow: 0.45, stickiness: 0, colors: ['#d01818','#ff4030','#ffae40','#ffd060'], isBuiltIn: true, isExplosive: true, explosionRadius: 5, explosionPower: 0.9, reactions: [],
      emitTemp: 30, ignitionPoint: 100, flammability: 0.30, conductivity: 90, corrosivity: 0, hardness: 30,
      ignitesAtCharge: 30 };
    registry[SMOKE_ID]     = { id: SMOKE_ID, key: 'smoke', displayName: 'smoke', kind: 'gas', density: 2, buoyancy: 0.6, lifeMin: 90, lifeMax: 180, colors: ['#9a9a9a','#aaaaaa','#888888','#bbbbbb'], isBuiltIn: true, reactions: [],
      emitTemp: 70, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0,
      airflowFactor: 0.7 };
    registry[PLANT_ID]     = { id: PLANT_ID, key: 'plant', displayName: 'plant', kind: 'static', density: 3, colors: ['#3aa040','#2c8c34','#4cb854','#226c2a'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 120, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };
    registry[SPARK_ID]     = { id: SPARK_ID, key: 'spark', displayName: 'spark', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 14, lifeMax: 34, colors: ['#ffe070','#ffb030','#fff0a0','#ff6020'], isBuiltIn: true, isHidden: true, reactions: [],
      emitTemp: 150, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 0,
      airflowFactor: 0.5 };
    registry[ICE_ID]       = { id: ICE_ID, key: 'ice', displayName: 'ice', kind: 'static', density: 5, colors: ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'], isBuiltIn: true, reactions: [],
      emitTemp: 10, ignitionPoint: 255, flammability: 0, conductivity: 160, corrosivity: 0, hardness: 60,
      meltingPoint: 33, meltsTo: 'water' };
    registry[STEAM_ID]     = { id: STEAM_ID, key: 'steam', displayName: 'steam', kind: 'gas', density: 1, buoyancy: 0.95, lifeMin: 180, lifeMax: 240, colors: ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'], isBuiltIn: true, reactions: [],
      emitTemp: 130, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0,
      freezingPoint: 50, freezesTo: 'water', airflowFactor: 0.8 };
    registry[LAVA_ID]      = { id: LAVA_ID, key: 'lava', displayName: 'lava', kind: 'liquid', density: 8, viscosity: 0.7, stickiness: 0, colors: ['#ff5020','#ff8030','#d03010','#ffc040'], isBuiltIn: true, reactions: [],
      emitTemp: 210, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 80, hardness: 30,
      freezingPoint: 80, freezesTo: 'stone' };
    registry[FIRE_ID]      = { id: FIRE_ID, key: 'fire', displayName: 'fire', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70, colors: ['#ff4020','#ff8010','#ffc040','#ffe070'], isBuiltIn: true, reactions: [],
      emitTemp: 240, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 40, hardness: 0,
      airflowFactor: 0.5 };
    registry[ACID_ID]      = { id: ACID_ID, key: 'acid', displayName: 'acid', kind: 'liquid', density: 4, viscosity: 0.1, stickiness: 0, colors: ['#60ff30','#80ff40','#30d020','#b0ff60'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 110, corrosivity: 200, hardness: 0 };
    registry[HONEY_ID]     = { id: HONEY_ID, key: 'honey', displayName: 'honey', kind: 'liquid', density: 6, viscosity: 0.92, stickiness: 0.7, colors: ['#e8a030','#d48020','#ffc050','#b86020'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 180, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 0 };
    registry[GRAVEL_ID]    = { id: GRAVEL_ID, key: 'gravel', displayName: 'gravel', kind: 'powder', density: 7, flow: 0.15, stickiness: 0, colors: ['#7a7060','#605040','#8a8278','#504438'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 100 };
    registry[STONE_ID]     = { id: STONE_ID, key: 'stone', displayName: 'stone', kind: 'static', density: 9, colors: ['#888080','#706868','#a09890','#605850'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 200,
      meltingPoint: 200, meltsTo: 'lava' };
    registry[MOLD_ID]      = { id: MOLD_ID, key: 'mold', displayName: 'mold', kind: 'cellular', density: 3, born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8], cellularTick: 14, growChance: 0.06, surviveChance: 1, birthFrom: ['plant'], colors: ['#304820','#405830','#50682a','#2a3818'], isBuiltIn: true,
      reactions: [{ other: 'plant', becomes: 'mold', chance: 0.03 }],
      emitTemp: 30, ignitionPoint: 150, flammability: 0.06, conductivity: 70, corrosivity: 0, hardness: 50 };

    // v2 showcase ──────────────────────────────────────────────────────────
    // wood — flammable static. Burns through register-based aging instead of
    // the gas life mechanism: when ignited, ra ticks down each frame; when
    // ra hits zero, wood vanishes (becomes fire). This gives wood real burn
    // duration. Without ignition, ra stays at raInit (no decay).
    registry[WOOD_ID]      = { id: WOOD_ID, key: 'wood', displayName: 'wood', kind: 'static', density: 4, colors: ['#7a4820','#8a5828','#5a3010','#a06838'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 140, flammability: 0.04, conductivity: 40, corrosivity: 0, hardness: 100 };
    // oil — light flammable liquid. Floats on water (density 2 vs 5). Boils
    // straight to smoke at ~180; ignites easily.
    registry[OIL_ID]       = { id: OIL_ID, key: 'oil', displayName: 'oil', kind: 'liquid', density: 2, viscosity: 0.3, stickiness: 0, colors: ['#2a1010','#4a2810','#1a0808','#603020'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 100, flammability: 0.20, conductivity: 90, corrosivity: 0, hardness: 0,
      boilingPoint: 180, boilsTo: 'smoke' };
    // mercury — heaviest liquid. Sinks through water/acid/oil. Conducts
    // electricity (real-world mercury is conductive).
    registry[MERCURY_ID]   = { id: MERCURY_ID, key: 'mercury', displayName: 'mercury', kind: 'liquid', density: 9, viscosity: 0.1, stickiness: 0, colors: ['#c0c0d0','#a0a0b8','#d8d8e0','#909098'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 0,
      conducts: true };
    // dust — almost weightless powder. High airflow factor: blown around
    // by fans and explosions. Bus fall slowly.
    registry[DUST_ID]      = { id: DUST_ID, key: 'dust', displayName: 'dust', kind: 'powder', density: 1, flow: 0.95, stickiness: 0, colors: ['#d0c8b8','#b0a898','#e8e0d0','#988c7c'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 200, flammability: 0.02, conductivity: 50, corrosivity: 0, hardness: 10,
      airflowFactor: 0.95 };
    // copper — electrical conductor. Charge spreads through copper at near
    // full speed; it doesn't emit charge itself.
    registry[COPPER_ID]    = { id: COPPER_ID, key: 'copper', displayName: 'copper', kind: 'static', density: 8, colors: ['#c87838','#a85820','#d88848','#985020'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 140,
      conducts: true };
    // battery — charge source. Emits +120 charge constantly. Build a wire
    // from copper, attach a battery, watch the charge propagate.
    registry[BATTERY_ID]   = { id: BATTERY_ID, key: 'battery', displayName: 'battery', kind: 'static', density: 8, colors: ['#e0c020','#a08018','#fff060','#806010'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 160,
      conducts: true, chargeEmit: 120 };
    // lightning — short-lived super-charged gas. Travels along conductors,
    // ignites flammables on contact, dies fast (gas life ~ 14 frames).
    registry[LIGHTNING_ID] = { id: LIGHTNING_ID, key: 'lightning', displayName: 'lightning', kind: 'gas', density: 1, buoyancy: 1, lifeMin: 12, lifeMax: 24, colors: ['#fff8e0','#a0d0ff','#ffffff','#80b0ff'], isBuiltIn: true, reactions: [],
      emitTemp: 220, ignitionPoint: 255, flammability: 0, conductivity: 255, corrosivity: 60, hardness: 0,
      conducts: true, chargeEmit: 110, airflowFactor: 0.3 };
    // fan — airflow source. Emits velocity upward (vy > 0 in fragment-y-up).
    // Drop a fan below smoke/dust/balloons to push them around.
    registry[FAN_ID]       = { id: FAN_ID, key: 'fan', displayName: 'fan', kind: 'static', density: 6, colors: ['#506070','#3a4858','#607888','#404a55'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 120,
      emitsAirflow: { vx: 0, vy: 6 } };
    // balloon — gas you can paint. Long lifespan; floats with airflow;
    // pops at high pressure (e.g. inside an explosion) into fire.
    registry[BALLOON_ID]   = { id: BALLOON_ID, key: 'balloon', displayName: 'balloon', kind: 'gas', density: 1, buoyancy: 0.95, lifeMin: 400, lifeMax: 600, colors: ['#e84060','#d03050','#ff6080','#a02040'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 90, flammability: 0.30, conductivity: 80, corrosivity: 0, hardness: 0,
      airflowFactor: 0.9, pressureBlast: 180, pressureBlastTo: 'fire' };
    // uranium — radioactive. Emits heat constantly, slowly decays via ra
    // register over ~250 frames, transforms to stone when register hits 0.
    registry[URANIUM_ID]   = { id: URANIUM_ID, key: 'uranium', displayName: 'uranium', kind: 'static', density: 9, colors: ['#80b020','#608018','#a0d040','#506010'], isBuiltIn: true, reactions: [],
      emitTemp: 110, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 30, hardness: 180,
      raInit: 250, raDelta: -1, raDiesAt: 0, raTransformsTo: 'stone' };
    // tar — extremely sticky liquid. Stays where you paint it; clings to
    // walls. Flammable.
    registry[TAR_ID]       = { id: TAR_ID, key: 'tar', displayName: 'tar', kind: 'liquid', density: 6, viscosity: 0.95, stickiness: 0.85, colors: ['#1a1008','#2a1810','#3a2418','#1f1410'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 130, flammability: 0.10, conductivity: 60, corrosivity: 0, hardness: 0 };
    // vine — anisotropic cellular. Grows upward preferentially; needs an
    // adjacent vine or plant. Looks like climbing creeper.
    registry[VINE_ID]      = { id: VINE_ID, key: 'vine', displayName: 'vine', kind: 'cellular', density: 3, born: [1,2,3], survive: [0,1,2,3,4,5,6,7,8], cellularTick: 12, growChance: 0.08, surviveChance: 1, birthFrom: ['plant'], growBias: 'up', colors: ['#3aa050','#2c8042','#4cb858','#1f6028'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 130, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };

    keyToId.wall = WALL_ID;       keyToId.sand = SAND_ID;       keyToId.water = WATER_ID;
    keyToId.explosive = EXPLOSIVE_ID; keyToId.smoke = SMOKE_ID;   keyToId.plant = PLANT_ID;
    keyToId.spark = SPARK_ID;     keyToId.ice = ICE_ID;         keyToId.steam = STEAM_ID;
    keyToId.lava = LAVA_ID;       keyToId.fire = FIRE_ID;       keyToId.acid = ACID_ID;
    keyToId.honey = HONEY_ID;     keyToId.gravel = GRAVEL_ID;   keyToId.stone = STONE_ID;
    keyToId.mold = MOLD_ID;       keyToId.wood = WOOD_ID;       keyToId.oil = OIL_ID;
    keyToId.mercury = MERCURY_ID; keyToId.dust = DUST_ID;       keyToId.copper = COPPER_ID;
    keyToId.battery = BATTERY_ID; keyToId.lightning = LIGHTNING_ID; keyToId.fan = FAN_ID;
    keyToId.balloon = BALLOON_ID; keyToId.uranium = URANIUM_ID; keyToId.tar = TAR_ID;
    keyToId.vine = VINE_ID;
    nextId = VINE_ID + 1;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let canvas;
  let gl;
  let COLS, ROWS;
  let AIR_COLS, AIR_ROWS;  // coarse pressure/airflow grid (1/4 res)

  // GPU resources
  let stateTexA = null, stateTexB = null;
  let stateFboA = null, stateFboB = null;
  let tempTexA = null, tempTexB = null;
  let tempFboA = null, tempFboB = null;
  let chargeTexA = null, chargeTexB = null;
  let chargeFboA = null, chargeFboB = null;
  let airTexA = null, airTexB = null;
  let airFboA = null, airFboB = null;
  let elementDataTex = null;
  let paletteTex = null;
  let reactionsTex = null;          // 256 wide × 6 tall (3 slots × 2 rows: payload + conditions)
  let traitsTex = null;             // 256 wide × 6 tall — heat/phase/charge/airflow
  let cellularDataTex = null;
  let registersTex = null;          // 256 wide × 1 tall — register init/delta/diesAt/transformsTo
  let progSim = null, progPaint = null, progRender = null, progClear = null, progReact = null;
  let progContact = null, progBlast = null;
  let progHeat = null, progIgnition = null, progCellular = null;
  let progCorrosion = null, progPhase = null;
  let progRegister = null, progCharge = null;
  let progPressure = null, progAdvect = null, progPressureBlast = null;
  let quadVao = null;
  let frameCounter = 0;

  let selectedKey = 'wall';
  let isPointerDown = false;
  let lastCell = null;
  let lastPointer = null;
  let holdPaintTimer = null;
  let animId = null;
  let probeMode = false;

  let pours = [];

  const DISCOVERY_INTERVAL = 60;
  let discoveryRules = [];
  const discoveredKeys = new Set();
  let discoveryReadBuf = null;
  // Discovery toast queue: discoveries pile up faster than 4s/each so we
  // queue them and pop one at a time. The lab-notebook button shows count.
  let discoveryToastQueue = [];
  let discoveryToastActive = false;
  let discoveryToastTimer = null;

  // ── Init ───────────────────────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('main-canvas');
    gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      showOverlay('this browser doesn\'t support webgl2.\ntry a recent chrome/firefox/safari.');
      return;
    }

    initBuiltIns();
    rebuildDiscoveryRules();
    rebuildPalette();
    try {
      initGL();
    } catch (err) {
      console.error('initGL failed:', err);
      showOverlay('webgl init failed:\n' + (err && err.message ? err.message : err)
        + '\n\nopen the console for the full shader log.');
      return;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    const swallowTouch = (e) => { if (e.cancelable) e.preventDefault(); };
    canvas.addEventListener('touchstart',  swallowTouch, { passive: false });
    canvas.addEventListener('touchmove',   swallowTouch, { passive: false });
    canvas.addEventListener('touchend',    swallowTouch, { passive: false });
    canvas.addEventListener('gesturestart',  (e) => e.preventDefault());
    canvas.addEventListener('gesturechange', (e) => e.preventDefault());
    canvas.addEventListener('gestureend',    (e) => e.preventDefault());
    canvas.addEventListener('contextmenu',   (e) => e.preventDefault());
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 350 && e.cancelable) e.preventDefault();
      lastTap = now;
    }, { passive: false });

    animId = requestAnimationFrame(loop);

    showOverlay('paint walls or any element on the canvas.\npour from the top.\n\ntry: drop a battery onto copper, or paint lightning\non gunpowder. open invent for endless physics.');
    syncActionLabel();
    bindModal();
    bindElementFeedbackModal();
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    canvas.width  = w;
    canvas.height = h;
    let cols = Math.floor(w / CELL);
    let rows = Math.floor(h / CELL);
    if (cols & 1) cols--;
    if (rows & 1) rows--;
    COLS = cols;
    ROWS = rows;
    AIR_COLS = Math.max(2, Math.floor(COLS / 4));
    AIR_ROWS = Math.max(2, Math.floor(ROWS / 4));
    initGrid();
  }

  function initGrid() {
    if (!gl) return;
    if (stateTexA) gl.deleteTexture(stateTexA);
    if (stateTexB) gl.deleteTexture(stateTexB);
    if (stateFboA) gl.deleteFramebuffer(stateFboA);
    if (stateFboB) gl.deleteFramebuffer(stateFboB);
    if (tempTexA)  gl.deleteTexture(tempTexA);
    if (tempTexB)  gl.deleteTexture(tempTexB);
    if (tempFboA)  gl.deleteFramebuffer(tempFboA);
    if (tempFboB)  gl.deleteFramebuffer(tempFboB);
    if (chargeTexA) gl.deleteTexture(chargeTexA);
    if (chargeTexB) gl.deleteTexture(chargeTexB);
    if (chargeFboA) gl.deleteFramebuffer(chargeFboA);
    if (chargeFboB) gl.deleteFramebuffer(chargeFboB);
    if (airTexA) gl.deleteTexture(airTexA);
    if (airTexB) gl.deleteTexture(airTexB);
    if (airFboA) gl.deleteFramebuffer(airFboA);
    if (airFboB) gl.deleteFramebuffer(airFboB);

    stateTexA = createUI8Texture(COLS, ROWS);
    stateTexB = createUI8Texture(COLS, ROWS);
    stateFboA = makeFbo(stateTexA);
    stateFboB = makeFbo(stateTexB);

    tempTexA = createUI8Texture(COLS, ROWS);
    tempTexB = createUI8Texture(COLS, ROWS);
    tempFboA = makeFbo(tempTexA);
    tempFboB = makeFbo(tempTexB);

    // Charge texture: R = signed charge in offset binary (128 = 0).
    chargeTexA = createUI8Texture(COLS, ROWS);
    chargeTexB = createUI8Texture(COLS, ROWS);
    chargeFboA = makeFbo(chargeTexA);
    chargeFboB = makeFbo(chargeTexB);

    // Air texture (coarse): R=pressure, G=vx_offset, B=vy_offset, A=ambient temp.
    airTexA = createUI8Texture(AIR_COLS, AIR_ROWS);
    airTexB = createUI8Texture(AIR_COLS, AIR_ROWS);
    airFboA = makeFbo(airTexA);
    airFboB = makeFbo(airTexB);

    clearStateTo(stateFboA, COLS, ROWS, 0, 0, 0, 0);
    clearStateTo(stateFboB, COLS, ROWS, 0, 0, 0, 0);
    clearStateTo(tempFboA, COLS, ROWS, 30, 0, 0, 0);
    clearStateTo(tempFboB, COLS, ROWS, 30, 0, 0, 0);
    clearStateTo(chargeFboA, COLS, ROWS, 128, 0, 0, 0);
    clearStateTo(chargeFboB, COLS, ROWS, 128, 0, 0, 0);
    clearStateTo(airFboA, AIR_COLS, AIR_ROWS, 128, 128, 128, 30);
    clearStateTo(airFboB, AIR_COLS, AIR_ROWS, 128, 128, 128, 30);
  }

  // ── GL helpers ─────────────────────────────────────────────────────────────
  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('shader compile failed:\n' + log + '\n\n' + src);
      throw new Error('shader compile: ' + log);
    }
    return sh;
  }

  function linkProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program link: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  function createUI8Texture(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function createU8Texture2D(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function makeFbo(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('FBO incomplete');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  }

  function clearStateTo(fbo, w, h, r, g, b, a) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([r, g, b, a]));
  }

  // ── Shaders ────────────────────────────────────────────────────────────────
  const VS_QUAD = `#version 300 es
    layout(location=0) in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  // Common header injected into shaders that use trait/element data so we
  // don't repeat struct definitions. JavaScript-level constant.
  const SH_HASH = `
    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }
    float rand01(uvec3 v) { return float(hash3(v) & 0xFFFFFFu) / float(0x1000000u); }
  `;

  // FS_SIM — Margolus 2×2 block CA. Now density-aware (any heavier
  // powder/liquid sinks through any lighter one) and stickiness-aware
  // (cells with stickiness > 0 next to a static/cellular skip swaps).
  // Reads coarse air velocity to bias gas-rise / liquid-drift sideways.
  const FS_SIM = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uTraits;
    uniform highp usampler2D uAir;
    uniform int uPhase;
    uniform int uFrame;
    uniform ivec2 uSize;
    uniform ivec2 uAirSize;
    ${SH_HASH}

    struct Cell { uint id; uint variant; uint ra; uint rb; };
    Cell readCell(ivec2 p) {
      uvec4 c = texelFetch(uState, p, 0);
      return Cell(c.r, c.g, c.b, c.a);
    }
    uvec4 packCell(Cell c) { return uvec4(c.id, c.variant, c.ra, c.rb); }

    struct ElemInfo { uint kind; uint density; uint paramA; uint paramB; };
    ElemInfo getInfo(uint id) {
      uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
      return ElemInfo(e.r, e.g, e.b, e.a);
    }

    bool isStaticOrCellular(uint id) {
      if (id == 0u) return false;
      uint k = getInfo(id).kind;
      return k == 1u || k == 5u;
    }

    // Density-aware sink: top wants to swap with bot when going down.
    bool wantsSink(Cell top, Cell bot) {
      if (top.id == 0u) return false;
      ElemInfo ti = getInfo(top.id);
      if (ti.kind != 2u && ti.kind != 3u) return false;          // only powder/liquid sink
      if (bot.id == 0u) return true;                              // empty: just fall
      ElemInfo bi = getInfo(bot.id);
      if (bi.kind == 1u || bi.kind == 5u) return false;          // static/cellular block
      if (bi.kind == 4u) return true;                             // sink through gas
      if (bi.kind == 3u) {                                        // liquid below
        if (top.id == bot.id) return false;
        return ti.density > bi.density;                           // heavier stuff sinks
      }
      // Powder below blocks (powders pile, don't trade).
      return false;
    }

    // Density-aware rise: bot (gas) wants to swap with top.
    bool wantsRise(Cell bot, Cell top) {
      if (bot.id == 0u) return false;
      ElemInfo bi = getInfo(bot.id);
      if (bi.kind != 4u) return false;                            // only gas rises
      if (top.id == 0u) return true;
      ElemInfo ti = getInfo(top.id);
      if (ti.kind == 1u || ti.kind == 5u) return false;
      if (ti.kind == 4u) {
        if (bot.id == top.id) return false;
        return bi.density < ti.density;                           // lighter gas rises
      }
      return false;                                               // can't push past liquid/powder
    }

    bool isLiquid(Cell c) {
      if (c.id == 0u) return false;
      return getInfo(c.id).kind == 3u;
    }
    bool isGas(Cell c) {
      if (c.id == 0u) return false;
      return getInfo(c.id).kind == 4u;
    }

    // paramB low 7 bits = stickiness × 127, high bit = isExplosive.
    float stickiness(uint id) {
      if (id == 0u) return 0.0;
      ElemInfo info = getInfo(id);
      return float(info.paramB & 0x7fu) / 127.0;
    }
    bool isStickyAdjacentToWall(ivec2 p, uint selfId) {
      if (selfId == 0u) return false;
      ivec2 D[4] = ivec2[4](ivec2(0,-1), ivec2(0,1), ivec2(-1,0), ivec2(1,0));
      for (int i = 0; i < 4; i++) {
        ivec2 np = p + D[i];
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) return true;
        uint nid = texelFetch(uState, np, 0).r;
        if (nid == 0u || nid == selfId) continue;
        if (isStaticOrCellular(nid)) return true;
      }
      return false;
    }

    // Per-element fluidity. Powders use flow (paramA/255); liquids use
    // 1 - viscosity. Stickiness against a static reduces fluidity.
    float fluidity(uint id, ivec2 p) {
      if (id == 0u) return 1.0;
      ElemInfo info = getInfo(id);
      float f = 1.0;
      if (info.kind == 2u) f = float(info.paramA) / 255.0;
      else if (info.kind == 3u) f = 1.0 - float(info.paramA) / 255.0;
      float s = stickiness(id);
      if (s > 0.0 && isStickyAdjacentToWall(p, id)) f *= max(0.0, 1.0 - s);
      return f;
    }

    // Sample the coarse air field at the full-res cell's position.
    vec2 airVelocity(ivec2 p) {
      ivec2 ap = p / 4;
      ap = clamp(ap, ivec2(0), uAirSize - 1);
      uvec4 a = texelFetch(uAir, ap, 0);
      return vec2(float(int(a.g) - 128), float(int(a.b) - 128)) / 8.0;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);

      // Top-row gas escape.
      if (px.y == uSize.y - 1) {
        Cell self = readCell(px);
        if (isGas(self)) self = Cell(0u, 0u, 0u, 0u);
        outColor = packCell(self);
        return;
      }

      ivec2 off;
      if (uPhase == 0) off = ivec2(0, 0);
      else if (uPhase == 1) off = ivec2(1, 1);
      else if (uPhase == 2) off = ivec2(1, 0);
      else off = ivec2(0, 1);

      ivec2 rel = px - off;
      ivec2 blockOrigin = (rel / 2) * 2 + off;
      ivec2 local = px - blockOrigin;

      if (local.x < 0 || local.y < 0 ||
          blockOrigin.x < 0 || blockOrigin.y < 0 ||
          blockOrigin.x + 1 >= uSize.x || blockOrigin.y + 1 >= uSize.y) {
        outColor = packCell(readCell(px));
        return;
      }

      ivec2 blPos = blockOrigin + ivec2(0,0);
      ivec2 brPos = blockOrigin + ivec2(1,0);
      ivec2 tlPos = blockOrigin + ivec2(0,1);
      ivec2 trPos = blockOrigin + ivec2(1,1);

      Cell bl = readCell(blPos);
      Cell br = readCell(brPos);
      Cell tl = readCell(tlPos);
      Cell tr = readCell(trPos);

      // 1) Direct fall.
      if (wantsSink(tl, bl)) { Cell t = tl; tl = bl; bl = t; }
      if (wantsSink(tr, br)) { Cell t = tr; tr = br; br = t; }

      // 2) Diagonal slide, gated by fluidity (which folds in stickiness).
      float r = rand01(uvec3(uint(blockOrigin.x), uint(blockOrigin.y), uint(uFrame)));
      bool preferLeft = r < 0.5;
      float gL = rand01(uvec3(uint(blockOrigin.x) + 11u, uint(blockOrigin.y), uint(uFrame) + 1u));
      float gR = rand01(uvec3(uint(blockOrigin.x), uint(blockOrigin.y) + 13u, uint(uFrame) + 2u));
      if (preferLeft) {
        if (wantsSink(tl, br) && gL < fluidity(tl.id, tlPos)) { Cell t = tl; tl = br; br = t; }
        if (wantsSink(tr, bl) && gR < fluidity(tr.id, trPos)) { Cell t = tr; tr = bl; bl = t; }
      } else {
        if (wantsSink(tr, bl) && gR < fluidity(tr.id, trPos)) { Cell t = tr; tr = bl; bl = t; }
        if (wantsSink(tl, br) && gL < fluidity(tl.id, tlPos)) { Cell t = tl; tl = br; br = t; }
      }

      // 3) Liquid sideways flow on the bottom row, gated by fluidity. Air
      // velocity biases the choice — left flow boosted if vx<0, etc.
      vec2 airBL = airVelocity(blPos);
      float sB = rand01(uvec3(uint(blockOrigin.x) + 17u, uint(blockOrigin.y), uint(uFrame) + 3u));
      float sideBias = clamp(airBL.x * 0.05, -0.3, 0.3);
      bool wantR = isLiquid(bl) && br.id == 0u && (r + sideBias) >= 0.5 && sB < fluidity(bl.id, blPos);
      bool wantL = isLiquid(br) && bl.id == 0u && (r + sideBias) <  0.5 && sB < fluidity(br.id, brPos);
      if (wantR) { Cell t = bl; bl = br; br = t; }
      else if (wantL) { Cell t = br; br = bl; bl = t; }

      float r2 = rand01(uvec3(uint(blockOrigin.x), uint(blockOrigin.y) + 7919u, uint(uFrame)));
      float sT = rand01(uvec3(uint(blockOrigin.x) + 23u, uint(blockOrigin.y) + 19u, uint(uFrame) + 4u));
      vec2 airTL = airVelocity(tlPos);
      float sideBiasT = clamp(airTL.x * 0.05, -0.3, 0.3);
      bool wantTR = isLiquid(tl) && tr.id == 0u && (r2 + sideBiasT) >= 0.5 && sT < fluidity(tl.id, tlPos);
      bool wantTL = isLiquid(tr) && tl.id == 0u && (r2 + sideBiasT) <  0.5 && sT < fluidity(tr.id, trPos);
      if (wantTR) { Cell t = tl; tl = tr; tr = t; }
      else if (wantTL) { Cell t = tr; tr = tl; tl = t; }

      // 4) Density-aware gas rise. Buoyancy boosted by upward air velocity.
      float rGas = rand01(uvec3(uint(blockOrigin.x) + 1234u, uint(blockOrigin.y) + 5678u, uint(uFrame)));
      float airBoostBL = clamp(airBL.y * 0.08, -0.4, 0.4);
      if (wantsRise(bl, tl)) {
        float buoy = float(getInfo(bl.id).paramA) / 255.0 + airBoostBL;
        if (rGas < buoy) { Cell t = bl; bl = tl; tl = t; }
      }
      vec2 airBR = airVelocity(brPos);
      float airBoostBR = clamp(airBR.y * 0.08, -0.4, 0.4);
      float rGas2 = rand01(uvec3(uint(blockOrigin.x) + 4321u, uint(blockOrigin.y) + 8765u, uint(uFrame)));
      if (wantsRise(br, tr)) {
        float buoy = float(getInfo(br.id).paramA) / 255.0 + airBoostBR;
        if (rGas2 < buoy) { Cell t = br; br = tr; tr = t; }
      }
      // Diagonal gas rise.
      if (isGas(bl) && tl.id != 0u && tr.id == 0u) {
        float buoy = float(getInfo(bl.id).paramA) / 255.0 + airBoostBL;
        if (rGas < buoy * 0.5) { Cell t = bl; bl = tr; tr = t; }
      }
      if (isGas(br) && tr.id != 0u && tl.id == 0u) {
        float buoy = float(getInfo(br.id).paramA) / 255.0 + airBoostBR;
        if (rGas2 < buoy * 0.5) { Cell t = br; br = tl; tl = t; }
      }

      Cell outc;
      if (local == ivec2(0, 0))      outc = bl;
      else if (local == ivec2(1, 0)) outc = br;
      else if (local == ivec2(0, 1)) outc = tl;
      else                            outc = tr;

      outColor = packCell(outc);
    }
  `;

  // FS_PAINT — paints with element-aware register init. Reads registersTex
  // for default raInit; paint code passes uPaintRaOverride for randomized
  // gas life. rb starts at 0 unless overridden.
  const FS_PAINT = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uRegisters;
    uniform ivec2 uSize;
    uniform ivec2 uCenter;
    uniform int uRadius;
    uniform uint uPaintId;
    uniform uint uVariantSeed;
    uniform uint uPaintRaOverride;     // 256 = use registers default; <256 = use this
    uniform uint uPaintRb;
    uniform uint uPaintKind;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 cur = texelFetch(uState, px, 0);
      ivec2 d = px - uCenter;
      int dist2 = d.x * d.x + d.y * d.y;
      if (dist2 > uRadius * uRadius) { outColor = cur; return; }
      if (uPaintId == 0u) { outColor = uvec4(0u); return; }
      if (uPaintKind != 1u) {
        if (cur.r != 0u && cur.r != uPaintId) { outColor = cur; return; }
      }
      uint v = hash3(uvec3(uint(px.x), uint(px.y), uVariantSeed)) & 3u;
      uint ra;
      if (uPaintRaOverride < 256u) ra = uPaintRaOverride & 0xFFu;
      else ra = texelFetch(uRegisters, ivec2(int(uPaintId), 0), 0).r;
      outColor = uvec4(uPaintId, v, ra, uPaintRb & 0xFFu);
    }
  `;

  // FS_RENDER — element color with subtle hot-glow + charge halo.
  const FS_RENDER = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 vUv;
    out vec4 outColor;

    uniform highp usampler2D uState;
    uniform sampler2D uPalette;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uCharge;
    uniform ivec2 uSize;
    uniform int uFrame;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(vUv * vec2(uSize));
      px = clamp(px, ivec2(0), uSize - ivec2(1));
      uvec4 c = texelFetch(uState, px, 0);
      uint temp = texelFetch(uTemp, px, 0).r;
      uint ch = texelFetch(uCharge, px, 0).r;

      vec3 rgb;
      if (c.r == 0u) {
        // Empty: dark background. Hint at temperature in the air via warm tint.
        float warm = clamp((float(temp) - 30.0) / 100.0, 0.0, 1.0);
        rgb = mix(vec3(0.059, 0.055, 0.047), vec3(0.18, 0.07, 0.04), warm * 0.5);
      } else {
        uvec4 e = texelFetch(uElemData, ivec2(int(c.r), 0), 0);
        uint variant;
        if ((e.a & 0x80u) != 0u) {
          uint h = uint(px.x) * 73856093u ^ uint(px.y) * 19349663u ^ uint(uFrame >> 2) * 83492791u;
          variant = h & 3u;
        } else {
          variant = c.g & 3u;
        }
        rgb = texelFetch(uPalette, ivec2(int(c.r), int(variant)), 0).rgb;
        // Hot-element glow: above 120, brighten toward warm.
        if (temp > 120u) {
          float k = clamp((float(temp) - 120.0) / 100.0, 0.0, 0.6);
          rgb = mix(rgb, vec3(1.0, 0.7, 0.3), k * 0.45);
        }
      }
      // Charge halo: cells with strong charge get a blue/violet tint that
      // shimmers per frame so charge is visible without a separate overlay.
      int signedCharge = int(ch) - 128;
      int chargeMag = abs(signedCharge);
      if (chargeMag > 12) {
        float k = clamp(float(chargeMag) / 127.0, 0.0, 1.0);
        uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame >> 1)));
        float flicker = float(h & 0xFFu) / 255.0;
        vec3 chargeTint = (signedCharge > 0)
          ? vec3(0.55, 0.75, 1.0)   // positive: cyan-white
          : vec3(0.95, 0.55, 1.0);  // negative: magenta
        rgb = mix(rgb, chargeTint, k * 0.45 * (0.6 + 0.4 * flicker));
      }
      outColor = vec4(rgb, 1.0);
    }
  `;

  const FS_CLEAR = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    void main() { outColor = uvec4(0u); }
  `;

  const FS_CONTACT = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform ivec2 uSize;

    bool isExplosiveId(uint id) {
      if (id == 0u) return false;
      uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
      return (e.a & 0x80u) != 0u;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      if (!isExplosiveId(self.r)) { outColor = self; return; }
      if (self.a == 255u) { outColor = self; return; }   // already primed
      if (self.b > 0u) { outColor = self; return; }      // settle window

      bool triggered = false;
      for (int dy = -1; dy <= 1 && !triggered; dy++) {
        for (int dx = -1; dx <= 1 && !triggered; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          uvec4 n = texelFetch(uState, np, 0);
          if (n.r == 0u) continue;
          if (isExplosiveId(n.r)) continue;
          triggered = true;
        }
      }
      if (triggered) self.a = 255u;
      outColor = self;
    }
  `;

  const FS_BLAST = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform ivec2 uSize;
    uniform uint uSparkId;
    uniform int uFrame;
    const int BLAST_R = 5;
    ${SH_HASH}

    bool isExplosiveId(uint id) {
      if (id == 0u) return false;
      uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
      return (e.a & 0x80u) != 0u;
    }

    uvec4 makeSpark(uint h) {
      uint variant = h & 3u;
      uint life = 16u + ((h >> 8u) & 31u);
      return uvec4(uSparkId, variant, life, 0u);   // ra=life
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      bool selfExp = isExplosiveId(self.r);
      bool selfPrimed = (selfExp && self.a == 255u);
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));

      if (selfPrimed) {
        outColor = (uSparkId != 0u) ? makeSpark(h) : uvec4(0u);
        return;
      }
      bool inBlast = false;
      for (int dy = -BLAST_R; dy <= BLAST_R && !inBlast; dy++) {
        for (int dx = -BLAST_R; dx <= BLAST_R && !inBlast; dx++) {
          if (dx*dx + dy*dy > BLAST_R*BLAST_R) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          uvec4 n = texelFetch(uState, np, 0);
          if (!isExplosiveId(n.r)) continue;
          if (n.a == 255u) inBlast = true;
        }
      }
      if (!inBlast) { outColor = self; return; }
      if (selfExp) {
        outColor = uvec4(self.r, self.g, self.b, 255u);
        return;
      }
      if (self.r == 0u) {
        if (uSparkId != 0u && (h & 3u) == 0u) { outColor = makeSpark(h); return; }
        outColor = self;
        return;
      }
      if (uSparkId != 0u && (h & 1u) == 0u) { outColor = makeSpark(h); return; }
      outColor = uvec4(0u);
    }
  `;

  // FS_REACT — pairwise reactions, with optional minTemp/maxTemp gates and
  // catalyst flag. Reactions texture is now 256×6: each of 3 slots uses 2
  // rows. Slot row 0 = (other, becomes, chance, selfConsume); slot row 1 =
  // (minTemp, maxTemp, conditionFlags, _). conditionFlags bit 0 = catalyst
  // (other transforms but self stays). selfConsume row 0.a applies as
  // before to self-death from reaction.
  const FS_REACT = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;
    uniform highp usampler2D uReactions;
    uniform highp usampler2D uTemp;
    uniform ivec2 uSize;
    uniform int uFrame;
    ${SH_HASH}

    bool tempOk(uint t, uint minT, uint maxT) {
      if (minT > 0u && t < minT) return false;
      if (maxT > 0u && t > maxT) return false;
      return true;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 selfCell = texelFetch(uState, px, 0);
      uint selfId = selfCell.r;
      uint selfTemp = texelFetch(uTemp, px, 0).r;

      ivec2 D[8];
      D[0] = ivec2(-1, -1); D[1] = ivec2(0, -1); D[2] = ivec2(1, -1);
      D[3] = ivec2(-1,  0);                       D[4] = ivec2(1,  0);
      D[5] = ivec2(-1,  1); D[6] = ivec2(0,  1); D[7] = ivec2(1,  1);
      uint nIds[8];
      for (int i = 0; i < 8; i++) {
        ivec2 np = px + D[i];
        if (np.x < 0 || np.x >= uSize.x || np.y < 0 || np.y >= uSize.y) {
          nIds[i] = 0u;
        } else {
          nIds[i] = texelFetch(uState, np, 0).r;
        }
      }

      uint newId = selfId;
      uvec4 newCell = selfCell;
      bool transformed = false;

      // Inverse pass: a neighbor's reaction transforms me.
      if (selfId != 0u) {
        for (int i = 0; i < 8 && !transformed; i++) {
          uint nid = nIds[i];
          if (nid == 0u) continue;
          uint nTemp = texelFetch(uTemp, px + D[i], 0).r;
          for (int slot = 0; slot < 3 && !transformed; slot++) {
            int row0 = slot * 2;
            int row1 = slot * 2 + 1;
            uvec4 rxA = texelFetch(uReactions, ivec2(int(nid), row0), 0);
            uint other = rxA.r;
            if (other == 0u) break;
            if (other != selfId) continue;
            uint becomes = rxA.g;
            uint chance  = rxA.b;
            uvec4 rxB = texelFetch(uReactions, ivec2(int(nid), row1), 0);
            uint minT = rxB.r;
            uint maxT = rxB.g;
            uint flags = rxB.b;
            // Use whichever side is hotter for the temp gate.
            uint tCheck = max(selfTemp, nTemp);
            if (!tempOk(tCheck, minT, maxT)) continue;
            ivec2 a = px;
            ivec2 b = px + D[i];
            ivec2 lo = min(a, b);
            ivec2 hi = max(a, b);
            uint h = hash3(uvec3(uint(lo.x) | (uint(lo.y) << 16),
                                 uint(hi.x) | (uint(hi.y) << 16),
                                 uint(uFrame) * 31u + uint(slot)));
            if ((h & 0xFFu) >= chance) continue;
            newId = becomes;
            transformed = true;
          }
        }
      }

      // Self-consume pass.
      if (selfId != 0u && !transformed) {
        bool consumed = false;
        for (int slot = 0; slot < 3 && !consumed; slot++) {
          int row0 = slot * 2;
          int row1 = slot * 2 + 1;
          uvec4 rxA = texelFetch(uReactions, ivec2(int(selfId), row0), 0);
          uint other = rxA.r;
          if (other == 0u) break;
          uint chance      = rxA.b;
          uint selfConsume = rxA.a;
          if (selfConsume == 0u) continue;
          uvec4 rxB = texelFetch(uReactions, ivec2(int(selfId), row1), 0);
          uint minT = rxB.r;
          uint maxT = rxB.g;
          uint flags = rxB.b;
          if ((flags & 0x01u) != 0u) continue;  // catalyst: self never consumed
          for (int i = 0; i < 8 && !consumed; i++) {
            if (nIds[i] != other) continue;
            uint nTemp = texelFetch(uTemp, px + D[i], 0).r;
            uint tCheck = max(selfTemp, nTemp);
            if (!tempOk(tCheck, minT, maxT)) continue;
            ivec2 a = px;
            ivec2 b = px + D[i];
            ivec2 lo = min(a, b);
            ivec2 hi = max(a, b);
            uint h1 = hash3(uvec3(uint(lo.x) | (uint(lo.y) << 16),
                                  uint(hi.x) | (uint(hi.y) << 16),
                                  uint(uFrame) * 31u + uint(slot)));
            if ((h1 & 0xFFu) >= chance) continue;
            uint h2 = hash3(uvec3(uint(px.x) * 1009u + 7u, uint(px.y) * 31u + 13u,
                                  uint(uFrame) * 17u + uint(slot)));
            if ((h2 & 0xFFu) < selfConsume) {
              newId = 0u;
              consumed = true;
              transformed = true;
            }
          }
        }
      }

      if (transformed) {
        if (newId == 0u) newCell = uvec4(0u);
        else {
          uint v = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 9001u)) & 3u;
          newCell = uvec4(newId, v, 0u, 0u);
        }
      }
      outColor = newCell;
    }
  `;

  // FS_HEAT — temperature diffusion plus emitTemp pull plus ambient decay.
  const FS_HEAT = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uTraits;
    uniform ivec2 uSize;

    struct TraitInfo {
      uint emitTemp;
      uint ignitionPoint;
      uint flammability;
      uint conductivity;
      uint corrosivity;
      uint hardness;
    };
    TraitInfo getTraits(uint id) {
      uvec4 r0 = texelFetch(uTraits, ivec2(int(id), 0), 0);
      uvec4 r1 = texelFetch(uTraits, ivec2(int(id), 1), 0);
      return TraitInfo(r0.r, r0.g, r0.b, r0.a, r1.r, r1.g);
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uint selfId = texelFetch(uState, px, 0).r;
      uint cur = texelFetch(uTemp, px, 0).r;
      uint sum = 0u;
      uint count = 0u;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          sum += texelFetch(uTemp, np, 0).r;
          count++;
        }
      }
      float avg = count > 0u ? float(sum) / float(count) : float(cur);
      float curF = float(cur);

      TraitInfo t;
      if (selfId == 0u) {
        t.emitTemp = 30u; t.ignitionPoint = 255u; t.flammability = 0u;
        t.conductivity = 100u; t.corrosivity = 0u; t.hardness = 0u;
      } else {
        t = getTraits(selfId);
      }
      float k = float(t.conductivity) / 255.0;
      float newT = mix(curF, avg, clamp(k * 0.5, 0.0, 0.5));

      float emit = float(t.emitTemp);
      if (emit > newT) newT = mix(newT, emit, 0.30);
      else             newT = mix(newT, emit, 0.05);

      newT = mix(newT, 30.0, 0.015);

      uint outT = uint(clamp(newT, 0.0, 255.0));
      outColor = uvec4(outT, 0u, 0u, 0u);
    }
  `;

  // FS_IGNITION — ignites cells either by temperature OR by charge magnitude
  // (new: ignitesAtCharge trait, e.g. gunpowder pops at low charge).
  const FS_IGNITION = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uTraits;
    uniform highp usampler2D uCharge;
    uniform ivec2 uSize;
    uniform int uFrame;
    uniform uint uFireId;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      uvec4 r0 = texelFetch(uTraits, ivec2(int(self.r), 0), 0);
      uvec4 r4 = texelFetch(uTraits, ivec2(int(self.r), 4), 0);
      uint ignitionPoint = r0.g;
      uint flammability  = r0.b;
      uint ignitesAtCh   = r4.b;       // trait row 4: (conductsBit, chargeEmit, ignitesAtCharge, airflowFactor)
      uint temp = texelFetch(uTemp, px, 0).r;
      uint chRaw = texelFetch(uCharge, px, 0).r;
      int chargeMag = abs(int(chRaw) - 128);

      bool tempIgnite   = (flammability > 0u) && (temp >= ignitionPoint);
      bool chargeIgnite = (ignitesAtCh > 0u) && (uint(chargeMag) >= ignitesAtCh);
      if (!tempIgnite && !chargeIgnite) { outColor = self; return; }

      // Charge ignition is strong (always rolls); temp ignition rolls
      // against flammability.
      uint h = hash3(uvec3(uint(px.x) * 1009u + 7u, uint(px.y) * 31u + 13u, uint(uFrame) * 41u + 3u));
      if (chargeIgnite || ((h & 0xFFu) < flammability)) {
        if (uFireId == 0u) outColor = uvec4(0u);
        else {
          uint v = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 1234u)) & 3u;
          outColor = uvec4(uFireId, v, 0u, 0u);
        }
        return;
      }
      outColor = self;
    }
  `;

  // FS_CELLULAR — Conway-like growth with optional anisotropy. growBias
  // (cellularDataTex row 1 byte 4 high nibble): 0=any, 1=up, 2=down, 3=side.
  const FS_CELLULAR = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uCellularData;
    uniform ivec2 uSize;
    uniform uint uCellularId;
    uniform int uFrame;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      bool selfIsThis  = (self.r == uCellularId);
      bool selfIsEmpty = (self.r == 0u);
      if (!selfIsThis && !selfIsEmpty) { outColor = self; return; }

      uvec4 cd0 = texelFetch(uCellularData, ivec2(int(uCellularId), 0), 0);
      uvec4 cd1 = texelFetch(uCellularData, ivec2(int(uCellularId), 1), 0);
      uint bornMask    = cd0.r | ((cd1.r & 1u) << 8u);
      uint surviveMask = cd0.g | ((cd1.r & 2u) << 7u);
      uint growChance  = cd0.b;
      uint survChance  = cd0.a;
      uint bF0 = cd1.g;
      uint bF1 = cd1.b;
      uint bF2 = cd1.a;
      uint growBias = (cd1.r >> 6u) & 0x3u;   // 0=any 1=up 2=down 3=side

      uint nCount = 0u;
      uint nUp = 0u, nDown = 0u, nSide = 0u;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          uint nId = texelFetch(uState, np, 0).r;
          if (nId == 0u) continue;
          if (nId == uCellularId
              || (bF0 != 0u && nId == bF0)
              || (bF1 != 0u && nId == bF1)
              || (bF2 != 0u && nId == bF2)) {
            nCount++;
            // Track which side the support is on.
            if (dy < 0) nDown++;       // support below me (in fragment-y-up, dy<0 = below)
            else if (dy > 0) nUp++;    // support above me
            else nSide++;
          }
        }
      }
      if (nCount > 8u) nCount = 8u;
      uint maskBit = 1u << nCount;
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));

      if (selfIsThis) {
        bool survives = (surviveMask & maskBit) != 0u;
        if (!survives) {
          uint h2 = (h >> 8u) & 0xFFu;
          if (h2 >= survChance) { outColor = uvec4(0u); return; }
        }
        outColor = self;
        return;
      }

      if ((bornMask & maskBit) != 0u) {
        // growBias: vine grows from below (support comes from down → cell appears above)
        // 1 = up: prefer to be born when support is below me (extend upward).
        // 2 = down: prefer to be born when support is above me (root downward).
        // 3 = side: prefer side support.
        bool biasOk = true;
        if (growBias == 1u) biasOk = (nDown >= 1u);
        else if (growBias == 2u) biasOk = (nUp >= 1u);
        else if (growBias == 3u) biasOk = (nSide >= 1u);
        if (!biasOk) { outColor = self; return; }
        uint h3 = h & 0xFFu;
        if (h3 < growChance) {
          uint v = (h >> 16u) & 3u;
          outColor = uvec4(uCellularId, v, 0u, 0u);
          return;
        }
      }
      outColor = self;
    }
  `;

  // FS_CORROSION — unchanged from v1.
  const FS_CORROSION = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTraits;
    uniform ivec2 uSize;
    uniform int uFrame;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      uvec4 sr1 = texelFetch(uTraits, ivec2(int(self.r), 1), 0);
      uint hard = sr1.g;
      uint maxCorr = 0u;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          uint nid = texelFetch(uState, np, 0).r;
          if (nid == 0u) continue;
          if (nid == self.r) continue;
          uvec4 nr1 = texelFetch(uTraits, ivec2(int(nid), 1), 0);
          if (nr1.r > maxCorr) maxCorr = nr1.r;
        }
      }
      if (maxCorr <= hard) { outColor = self; return; }
      uint diff = maxCorr - hard;
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));
      if ((h & 0x7FFu) < diff) outColor = uvec4(0u);
      else outColor = self;
    }
  `;

  // FS_PHASE — phase transitions (melt/boil/freeze) unchanged from v1.
  const FS_PHASE = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uTraits;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uRegisters;
    uniform ivec2 uSize;
    uniform int uFrame;
    ${SH_HASH}

    uvec4 transformTo(uint newId, uint h, ivec2 px) {
      uvec4 e = texelFetch(uElemData, ivec2(int(newId), 0), 0);
      uint life = (e.r == 4u) ? 120u : 0u;
      uint regRa = texelFetch(uRegisters, ivec2(int(newId), 0), 0).r;
      uint ra = (regRa > 0u) ? regRa : life;
      return uvec4(newId, h & 3u, ra, 0u);
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      uvec4 r2 = texelFetch(uTraits, ivec2(int(self.r), 2), 0);
      uvec4 r3 = texelFetch(uTraits, ivec2(int(self.r), 3), 0);
      uint meltAt   = r2.r; uint boilAt   = r2.g; uint freezeAt = r2.b;
      uint meltTo   = r3.r; uint boilTo   = r3.g; uint freezeTo = r3.b;
      uint temp = texelFetch(uTemp, px, 0).r;
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));
      uint roll = h & 0xFFu;
      if (boilAt > 0u && boilTo > 0u && temp >= boilAt) {
        if (roll < 64u) { outColor = transformTo(boilTo, h, px); return; }
      }
      if (meltAt > 0u && meltTo > 0u && temp >= meltAt) {
        if (roll < 32u) { outColor = transformTo(meltTo, h, px); return; }
      }
      if (freezeAt > 0u && freezeTo > 0u && temp <= freezeAt) {
        if (roll < 24u) { outColor = transformTo(freezeTo, h, px); return; }
      }
      outColor = self;
    }
  `;

  // FS_REGISTER — per-element register tick. ra changes by raDelta each
  // frame (signed via offset binary, 128 = no change). When ra hits raDiesAt,
  // cell either dies (raTransformsTo == 0) or transforms (id swap). Also
  // looks at registersTex row 1 for rb (currently unused but reserved).
  const FS_REGISTER = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uRegisters;
    uniform highp usampler2D uElemData;
    uniform ivec2 uSize;
    uniform int uFrame;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      uvec4 reg = texelFetch(uRegisters, ivec2(int(self.r), 0), 0);
      uint raDeltaOffset = reg.g;
      if (raDeltaOffset == 128u) { outColor = self; return; }   // no register tick

      uint raDiesAt    = reg.b;
      uint raTransform = reg.a;

      int delta = int(raDeltaOffset) - 128;
      uint oldRa = self.b;
      int newRa = int(oldRa) + delta;
      newRa = clamp(newRa, 0, 255);

      // Hit the death/transform threshold? Require crossing it in the
      // direction of the delta — otherwise an unreachable raDiesAt (e.g.,
      // explosive's 255 with downward decay) would fire on every frame.
      bool hit = false;
      if (delta < 0 && uint(newRa) <= raDiesAt && oldRa > raDiesAt) hit = true;
      else if (delta > 0 && uint(newRa) >= raDiesAt && oldRa < raDiesAt) hit = true;

      if (hit) {
        if (raTransform == 0u) { outColor = uvec4(0u); return; }
        uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 7777u));
        uint v = h & 3u;
        // Inherit register defaults of the new element so the chain can
        // continue (e.g., uranium → stone with stone's defaults).
        uvec4 newReg = texelFetch(uRegisters, ivec2(int(raTransform), 0), 0);
        uvec4 elem   = texelFetch(uElemData, ivec2(int(raTransform), 0), 0);
        uint newRaVal = newReg.r;
        if (elem.r == 4u && newRaVal == 0u) newRaVal = 120u;     // gas default life
        outColor = uvec4(raTransform, v, newRaVal, 0u);
        return;
      }

      outColor = uvec4(self.r, self.g, uint(newRa) & 0xFFu, self.a);
    }
  `;

  // FS_CHARGE — propagates electrical charge through conductors. Sources
  // (chargeEmit != 128) override their cell's charge each frame. Conductors
  // diffuse with neighbors. Non-conductors decay toward neutral (128).
  const FS_CHARGE = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uCharge;
    uniform highp usampler2D uTraits;
    uniform ivec2 uSize;

    bool isConductor(uint id) {
      if (id == 0u) return false;
      // traits row 4: (conductsBit, chargeEmit, ignitesAtCharge, airflowFactor)
      uvec4 r4 = texelFetch(uTraits, ivec2(int(id), 4), 0);
      return r4.r != 0u;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uint selfId = texelFetch(uState, px, 0).r;
      uint cur = texelFetch(uCharge, px, 0).r;

      if (selfId == 0u) {
        // Air: decay toward 128 (neutral).
        uint outC;
        if (cur > 128u) outC = cur - 1u;
        else if (cur < 128u) outC = cur + 1u;
        else outC = cur;
        outColor = uvec4(outC, 0u, 0u, 0u);
        return;
      }

      uvec4 r4 = texelFetch(uTraits, ivec2(int(selfId), 4), 0);
      uint conductsBit = r4.r;
      uint chargeEmit  = r4.g;

      // Charge source overrides.
      if (chargeEmit != 128u) {
        outColor = uvec4(chargeEmit, 0u, 0u, 0u);
        return;
      }

      if (conductsBit == 0u) {
        // Insulator: decay slowly.
        uint outC;
        if (cur > 128u) outC = cur - 1u;
        else if (cur < 128u) outC = cur + 1u;
        else outC = cur;
        outColor = uvec4(outC, 0u, 0u, 0u);
        return;
      }

      // Conductor: average charge with conductor neighbors.
      int sumDelta = 0;
      int count = 0;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
          uint nid = texelFetch(uState, np, 0).r;
          if (nid == 0u) continue;
          uvec4 nr4 = texelFetch(uTraits, ivec2(int(nid), 4), 0);
          if (nr4.r == 0u && nr4.g == 128u) continue;            // neither conducts nor sources
          uint nc = texelFetch(uCharge, np, 0).r;
          sumDelta += int(nc) - int(cur);
          count++;
        }
      }
      int newCharge;
      if (count > 0) {
        // Move halfway toward the average.
        newCharge = int(cur) + sumDelta / (count * 2);
      } else {
        // Isolated conductor: decay to neutral.
        newCharge = int(cur);
        if (newCharge > 128) newCharge -= 1;
        else if (newCharge < 128) newCharge += 1;
      }
      newCharge = clamp(newCharge, 0, 255);
      outColor = uvec4(uint(newCharge), 0u, 0u, 0u);
    }
  `;

  // FS_PRESSURE — coarse-grid pressure + airflow. Each coarse cell samples
  // its 4×4 region of full-res state, accumulates "mass" (count of solid
  // cells weighted by density), updates pressure with neighbor-diffusion,
  // computes velocity from the pressure gradient, applies buoyancy from
  // local hot air, and overrides with airflow sources (fan elements).
  const FS_PRESSURE = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uAir;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uTraits;
    uniform ivec2 uSize;
    uniform ivec2 uAirSize;

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      ivec2 baseFull = px * 4;

      int solidCount = 0;
      int gasCount = 0;
      int totalDensity = 0;
      uint sumTemp = 0u;
      uint tempCount = 0u;
      int srcVx = 0, srcVy = 0;
      int srcCount = 0;
      for (int dy = 0; dy < 4; dy++) {
        for (int dx = 0; dx < 4; dx++) {
          ivec2 fp = baseFull + ivec2(dx, dy);
          if (fp.x >= uSize.x || fp.y >= uSize.y) continue;
          uint id = texelFetch(uState, fp, 0).r;
          if (id != 0u) {
            uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
            uint kind = e.r;
            if (kind == 1u || kind == 2u || kind == 3u || kind == 5u) {
              solidCount++;
              totalDensity += int(e.g);
            } else if (kind == 4u) {
              gasCount++;
            }
            // Airflow source from trait row 5: (airflowEmitVx, airflowEmitVy, _, _)
            uvec4 r5 = texelFetch(uTraits, ivec2(int(id), 5), 0);
            int vx = int(r5.r) - 128;
            int vy = int(r5.g) - 128;
            if (vx != 0 || vy != 0) { srcVx += vx; srcVy += vy; srcCount++; }
          }
          sumTemp += texelFetch(uTemp, fp, 0).r;
          tempCount++;
        }
      }

      uvec4 cur = texelFetch(uAir, px, 0);
      uint curPressure = cur.r;
      uint curVx = cur.g;
      uint curVy = cur.b;
      uint curAmb = cur.a;

      // Pressure: target = 128 + density-deviation. Diffuse with neighbors.
      uint pNeighSum = 0u;
      int pCount = 0;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          ivec2 np = px + ivec2(dx, dy);
          if (np.x < 0 || np.y < 0 || np.x >= uAirSize.x || np.y >= uAirSize.y) continue;
          pNeighSum += texelFetch(uAir, np, 0).r;
          pCount++;
        }
      }
      float pAvg = pCount > 0 ? float(pNeighSum) / float(pCount) : 128.0;
      float densityP = 128.0 + float(totalDensity - 32) * 0.6;
      float newP = mix(float(curPressure), pAvg, 0.45);
      newP = mix(newP, densityP, 0.08);
      newP = clamp(newP, 0.0, 255.0);

      // Velocity from pressure gradient.
      ivec2 pxL = px - ivec2(1,0); pxL = clamp(pxL, ivec2(0), uAirSize - 1);
      ivec2 pxR = px + ivec2(1,0); pxR = clamp(pxR, ivec2(0), uAirSize - 1);
      ivec2 pxD = px - ivec2(0,1); pxD = clamp(pxD, ivec2(0), uAirSize - 1);
      ivec2 pxU = px + ivec2(0,1); pxU = clamp(pxU, ivec2(0), uAirSize - 1);
      float pL = float(texelFetch(uAir, pxL, 0).r);
      float pR = float(texelFetch(uAir, pxR, 0).r);
      float pD = float(texelFetch(uAir, pxD, 0).r);
      float pU = float(texelFetch(uAir, pxU, 0).r);
      float gradX = (pR - pL) * 0.5;
      float gradY = (pU - pD) * 0.5;

      float ambTempF = tempCount > 0u ? float(sumTemp) / float(tempCount) : 30.0;
      // Buoyancy: hot air rises (vy positive in fragment-y-up).
      float buoy = clamp((ambTempF - 30.0) * 0.06, 0.0, 8.0);

      float vxF = float(int(curVx) - 128) - gradX * 0.35;
      float vyF = float(int(curVy) - 128) - gradY * 0.35 + buoy * 0.4;

      // Damp.
      vxF *= 0.9; vyF *= 0.9;

      // Sources override: a fan in this coarse cell sets the velocity.
      if (srcCount > 0) {
        vxF = float(srcVx) / float(srcCount);
        vyF = float(srcVy) / float(srcCount);
      }

      // Decay ambient temp toward 30.
      float ambNew = mix(ambTempF, 30.0, 0.05);

      uint outVx = uint(clamp(vxF + 128.0, 0.0, 255.0));
      uint outVy = uint(clamp(vyF + 128.0, 0.0, 255.0));
      uint outP = uint(clamp(newP, 0.0, 255.0));
      uint outAmb = uint(clamp(ambNew, 0.0, 255.0));
      outColor = uvec4(outP, outVx, outVy, outAmb);
    }
  `;

  // FS_PRESSURE_BLAST — pop cells with `pressureBlast` trait when local
  // pressure exceeds threshold. Replacement id is in trait row 5 byte 3.
  const FS_PRESSURE_BLAST = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uAir;
    uniform highp usampler2D uTraits;
    uniform highp usampler2D uElemData;
    uniform highp usampler2D uRegisters;
    uniform ivec2 uSize;
    uniform ivec2 uAirSize;
    uniform int uFrame;
    ${SH_HASH}

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      uvec4 r5 = texelFetch(uTraits, ivec2(int(self.r), 5), 0);
      uint blastAt = r5.b;
      uint blastTo = r5.a;
      if (blastAt == 0u) { outColor = self; return; }
      ivec2 ap = clamp(px / 4, ivec2(0), uAirSize - 1);
      uint pressure = texelFetch(uAir, ap, 0).r;
      if (pressure < blastAt) { outColor = self; return; }
      // Roll a die: 25%/frame to actually pop, so blast has a "fizz" feel.
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 31337u));
      if ((h & 3u) != 0u) { outColor = self; return; }
      if (blastTo == 0u) { outColor = uvec4(0u); return; }
      uvec4 e = texelFetch(uElemData, ivec2(int(blastTo), 0), 0);
      uint regRa = texelFetch(uRegisters, ivec2(int(blastTo), 0), 0).r;
      uint life = (e.r == 4u) ? 120u : 0u;
      uint ra = (regRa > 0u) ? regRa : life;
      outColor = uvec4(blastTo, h & 3u, ra, 0u);
    }
  `;

  function initGL() {
    progSim    = linkProgram(VS_QUAD, FS_SIM);
    progPaint  = linkProgram(VS_QUAD, FS_PAINT);
    progRender = linkProgram(VS_QUAD, FS_RENDER);
    progClear  = linkProgram(VS_QUAD, FS_CLEAR);
    progReact  = linkProgram(VS_QUAD, FS_REACT);
    progContact= linkProgram(VS_QUAD, FS_CONTACT);
    progBlast  = linkProgram(VS_QUAD, FS_BLAST);
    try { progHeat          = linkProgram(VS_QUAD, FS_HEAT);          } catch (e) { console.warn('progHeat compile failed:', e); }
    try { progIgnition      = linkProgram(VS_QUAD, FS_IGNITION);      } catch (e) { console.warn('progIgnition compile failed:', e); }
    try { progCellular      = linkProgram(VS_QUAD, FS_CELLULAR);      } catch (e) { console.warn('progCellular compile failed:', e); }
    try { progCorrosion     = linkProgram(VS_QUAD, FS_CORROSION);     } catch (e) { console.warn('progCorrosion compile failed:', e); }
    try { progPhase         = linkProgram(VS_QUAD, FS_PHASE);         } catch (e) { console.warn('progPhase compile failed:', e); }
    try { progRegister      = linkProgram(VS_QUAD, FS_REGISTER);      } catch (e) { console.warn('progRegister compile failed:', e); }
    try { progCharge        = linkProgram(VS_QUAD, FS_CHARGE);        } catch (e) { console.warn('progCharge compile failed:', e); }
    try { progPressure      = linkProgram(VS_QUAD, FS_PRESSURE);      } catch (e) { console.warn('progPressure compile failed:', e); }
    try { progPressureBlast = linkProgram(VS_QUAD, FS_PRESSURE_BLAST);} catch (e) { console.warn('progPressureBlast compile failed:', e); }

    quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1, 1,
      -1,  1,  1, -1,  1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    elementDataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    paletteTex = createU8Texture2D(256, 4);

    reactionsTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 6);   // 3 slots × 2 rows
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    traitsTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 6);   // 6 rows now
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    cellularDataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cellularDataTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    registersTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);   // row 0 ra, row 1 reserved
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    uploadElementData();
    uploadPalette();
    uploadReactions();
    uploadTraits();
    uploadCellular();
    uploadRegisters();
  }

  function uploadElementData() {
    const buf = new Uint8Array(256 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec) { buf[id * 4 + 0] = KIND_EMPTY; continue; }
      buf[id * 4 + 0] = kindCode(spec.kind);
      buf[id * 4 + 1] = Math.max(1, Math.min(15, Math.round(spec.density || 1)));
      let paramA = 128;
      if (spec.kind === 'powder') paramA = Math.round(((typeof spec.flow === 'number') ? spec.flow : 0.55) * 255);
      else if (spec.kind === 'liquid') paramA = Math.round(((typeof spec.viscosity === 'number') ? spec.viscosity : 0) * 255);
      else if (spec.kind === 'gas') paramA = Math.round(((typeof spec.buoyancy === 'number') ? spec.buoyancy : 0.9) * 255);
      buf[id * 4 + 2] = paramA;
      let paramB = Math.round(((typeof spec.stickiness === 'number') ? spec.stickiness : 0) * 127) & 0x7f;
      if (spec.isExplosive) paramB |= 0x80;
      buf[id * 4 + 3] = paramB;
    }
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  function uploadPalette() {
    const buf = new Uint8Array(256 * 4 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec || !spec.colors || !spec.colors.length) continue;
      const colors = spec.colors;
      for (let v = 0; v < 4; v++) {
        const c = parseHex(colors[v % colors.length]);
        const o = (v * 256 + id) * 4;
        buf[o + 0] = c[0];
        buf[o + 1] = c[1];
        buf[o + 2] = c[2];
        buf[o + 3] = 255;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 4, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  }

  function parseHex(h) {
    if (typeof h !== 'string') return [136, 136, 136];
    h = h.replace(/^#/, '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length !== 6) return [136, 136, 136];
    return [parseInt(h.slice(0,2),16)|0, parseInt(h.slice(2,4),16)|0, parseInt(h.slice(4,6),16)|0];
  }

  // Pack reactions: 3 slots × 2 rows × 256 ids.
  // Row 0 (per slot): (otherId, becomesId, chance, selfConsume)
  // Row 1 (per slot): (minTemp, maxTemp, conditionFlags, _)
  function uploadReactions() {
    const buf = new Uint8Array(256 * 6 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec || !Array.isArray(spec.reactions)) continue;
      let slot = 0;
      for (const rx of spec.reactions) {
        if (slot >= 3) break;
        if (!rx || rx.explodes) continue;
        const otherId = keyToId[rx.other];
        if (!otherId) continue;
        let becomesId = 0;
        if (rx.becomes != null && rx.becomes !== '' && rx.becomes !== 'empty') {
          becomesId = keyToId[rx.becomes] || 0;
          if (!becomesId) continue;
        }
        const chance = Math.max(0, Math.min(255, Math.round((rx.chance || 0) * 255)));
        const selfConsume = Math.max(0, Math.min(255, Math.round(((typeof rx.selfConsume === 'number') ? rx.selfConsume : 0) * 255)));
        const minTemp = clamp255(rx.minTemp, 0);
        const maxTemp = clamp255(rx.maxTemp, 0);
        let flags = 0;
        if (rx.catalyst) flags |= 0x01;
        const r0 = (slot * 2 + 0) * 256 * 4 + id * 4;
        buf[r0 + 0] = otherId;
        buf[r0 + 1] = becomesId;
        buf[r0 + 2] = chance;
        buf[r0 + 3] = selfConsume;
        const r1 = (slot * 2 + 1) * 256 * 4 + id * 4;
        buf[r1 + 0] = minTemp;
        buf[r1 + 1] = maxTemp;
        buf[r1 + 2] = flags;
        buf[r1 + 3] = 0;
        slot++;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 6, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  // Traits: 256 wide × 6 rows.
  // Row 0: (emitTemp, ignitionPoint, flammability, conductivity)
  // Row 1: (corrosivity, hardness, stickiness*127, _)
  // Row 2: (meltAt, boilAt, freezeAt, _)
  // Row 3: (meltsToId, boilsToId, freezesToId, _)
  // Row 4: (conductsBit, chargeEmit_offset, ignitesAtCharge, airflowFactor*255)
  // Row 5: (airflowEmitVx_offset, airflowEmitVy_offset, pressureBlast, pressureBlastToId)
  function uploadTraits() {
    if (!traitsTex) return;
    const buf = new Uint8Array(256 * 6 * 4);
    const resolveId = (key) => {
      if (typeof key !== 'string' || !key) return 0;
      const lc = key.toLowerCase();
      if (lc === 'empty') return 0;
      return keyToId[lc] || 0;
    };
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec) continue;
      const o0 = (0 * 256 + id) * 4;
      buf[o0+0] = clamp255(spec.emitTemp,      30);
      buf[o0+1] = clamp255(spec.ignitionPoint, 255);
      buf[o0+2] = clamp255(Math.round(((typeof spec.flammability === 'number') ? spec.flammability : 0) * 255), 0);
      buf[o0+3] = clamp255(spec.conductivity,  100);
      const o1 = (1 * 256 + id) * 4;
      buf[o1+0] = clamp255(spec.corrosivity, 0);
      buf[o1+1] = clamp255(spec.hardness, 80);
      buf[o1+2] = Math.round(((typeof spec.stickiness === 'number') ? spec.stickiness : 0) * 127);
      buf[o1+3] = 0;
      const o2 = (2 * 256 + id) * 4;
      buf[o2+0] = clamp255(spec.meltingPoint,   0);
      buf[o2+1] = clamp255(spec.boilingPoint,   0);
      buf[o2+2] = clamp255(spec.freezingPoint,  0);
      buf[o2+3] = 0;
      const o3 = (3 * 256 + id) * 4;
      buf[o3+0] = resolveId(spec.meltsTo);
      buf[o3+1] = resolveId(spec.boilsTo);
      buf[o3+2] = resolveId(spec.freezesTo);
      buf[o3+3] = 0;
      const o4 = (4 * 256 + id) * 4;
      buf[o4+0] = spec.conducts ? 1 : 0;
      // chargeEmit: signed -127..127 → offset binary 1..255 (128 = no source, default).
      const ce = (typeof spec.chargeEmit === 'number') ? Math.max(-127, Math.min(127, spec.chargeEmit | 0)) : 0;
      buf[o4+1] = (spec.chargeEmit === undefined || spec.chargeEmit === null) ? 128 : (ce + 128);
      buf[o4+2] = clamp255(spec.ignitesAtCharge, 0);
      buf[o4+3] = Math.round(((typeof spec.airflowFactor === 'number') ? spec.airflowFactor : 0) * 255);
      const o5 = (5 * 256 + id) * 4;
      const emit = spec.emitsAirflow || null;
      if (emit && (emit.vx || emit.vy)) {
        const evx = Math.max(-127, Math.min(127, (emit.vx || 0) | 0));
        const evy = Math.max(-127, Math.min(127, (emit.vy || 0) | 0));
        buf[o5+0] = evx + 128;
        buf[o5+1] = evy + 128;
      } else {
        buf[o5+0] = 128;
        buf[o5+1] = 128;
      }
      buf[o5+2] = clamp255(spec.pressureBlast, 0);
      buf[o5+3] = resolveId(spec.pressureBlastTo);
    }
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 6, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  function clamp255(v, def) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  function uploadCellular() {
    if (!cellularDataTex) return;
    const buf = new Uint8Array(256 * 2 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec || spec.kind !== 'cellular') continue;
      let bornMask = 0;
      for (const n of (spec.born || [])) {
        const ni = (n | 0);
        if (ni >= 0 && ni <= 8) bornMask |= (1 << ni);
      }
      let surviveMask = 0;
      for (const n of (spec.survive || [])) {
        const ni = (n | 0);
        if (ni >= 0 && ni <= 8) surviveMask |= (1 << ni);
      }
      const tick = Math.max(1, Math.min(30, Math.round(spec.cellularTick || 6)));
      const growChance    = clamp255(Math.round((typeof spec.growChance    === 'number' ? spec.growChance    : 0.45) * 255), 115);
      const surviveChance = clamp255(Math.round((typeof spec.surviveChance === 'number' ? spec.surviveChance : 0.92) * 255), 235);
      const bF = (spec.birthFrom || []).map(k => keyToId[k] || 0).slice(0, 3);
      while (bF.length < 3) bF.push(0);
      // growBias: 0=any 1=up 2=down 3=side
      let growBias = 0;
      if (spec.growBias === 'up') growBias = 1;
      else if (spec.growBias === 'down') growBias = 2;
      else if (spec.growBias === 'side') growBias = 3;
      const extras = ((bornMask >> 8) & 1)
                   | (((surviveMask >> 8) & 1) << 1)
                   | ((tick & 0x0F) << 2)
                   | ((growBias & 0x3) << 6);
      const o0 = (0 * 256 + id) * 4;
      buf[o0+0] = bornMask & 0xff;
      buf[o0+1] = surviveMask & 0xff;
      buf[o0+2] = growChance;
      buf[o0+3] = surviveChance;
      const o1 = (1 * 256 + id) * 4;
      buf[o1+0] = extras;
      buf[o1+1] = bF[0];
      buf[o1+2] = bF[1];
      buf[o1+3] = bF[2];
    }
    gl.bindTexture(gl.TEXTURE_2D, cellularDataTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  // Registers texture:
  // Row 0: (raInit, raDelta_offset, raDiesAt, raTransformsToId)
  // Row 1: reserved (rb)
  // raDelta offset: 128 = no tick. <128 = negative delta. >128 = positive.
  // For gas elements we leave row 0 raInit = lifeMin (paint may override
  // with a randomized value via uniform). raDelta = 127 (= -1).
  function uploadRegisters() {
    if (!registersTex) return;
    const buf = new Uint8Array(256 * 2 * 4);
    const resolveId = (key) => {
      if (typeof key !== 'string' || !key) return 0;
      if (key.toLowerCase() === 'empty') return 0;
      return keyToId[key.toLowerCase()] || 0;
    };
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec) continue;
      let raInit = 0, raDelta = 128, raDiesAt = 0, raTransforms = 0;
      if (spec.kind === 'gas' && spec.lifeMin) {
        raInit = clamp255(spec.lifeMin, 60);
        raDelta = 127;             // -1
        raDiesAt = 0;
        raTransforms = 0;          // dies on hitting 0
      }
      if (spec.isExplosive) {
        raInit = 28;               // settle frames
        raDelta = 127;             // -1
        raDiesAt = 255;            // never dies (clamp at 0 stops countdown)
        raTransforms = 0;
      }
      // AI / built-in custom registers override the above defaults.
      if (typeof spec.raInit === 'number') raInit = clamp255(spec.raInit, 0);
      if (typeof spec.raDelta === 'number') {
        raDelta = Math.max(1, Math.min(255, (spec.raDelta | 0) + 128));
      }
      if (typeof spec.raDiesAt === 'number') raDiesAt = clamp255(spec.raDiesAt, 0);
      if (typeof spec.raTransformsTo === 'string') raTransforms = resolveId(spec.raTransformsTo);
      const o0 = (0 * 256 + id) * 4;
      buf[o0+0] = raInit;
      buf[o0+1] = raDelta;
      buf[o0+2] = raDiesAt;
      buf[o0+3] = raTransforms;
    }
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  // ── Overlay / palette UI / pours / paint state ─────────────────────────────
  function showOverlay(msg) {
    const el = document.getElementById('overlay-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function hideOverlay() {
    document.getElementById('overlay-msg').classList.add('hidden');
  }

  function rebuildPalette() {
    const host = document.getElementById('palette-buttons');
    if (!host) return;
    host.innerHTML = '';

    // Logical grouping for v2: solids → powders → liquids → cold↔hot
    // → volatile → life → electrical → airflow.
    const orderedIds = [
      WALL_ID, STONE_ID, WOOD_ID,
      SAND_ID, GRAVEL_ID, DUST_ID,
      WATER_ID, OIL_ID, MERCURY_ID, HONEY_ID, TAR_ID, ACID_ID,
      ICE_ID, STEAM_ID,
      LAVA_ID, FIRE_ID, EXPLOSIVE_ID, SMOKE_ID, BALLOON_ID,
      PLANT_ID, MOLD_ID, VINE_ID,
      COPPER_ID, BATTERY_ID, LIGHTNING_ID,
      FAN_ID,
      URANIUM_ID,
    ];
    const customIds = Object.keys(registry)
      .map(n => +n)
      .filter(id => !registry[id].isBuiltIn)
      .sort((a, b) => a - b);
    orderedIds.push(...customIds);

    for (const id of orderedIds) {
      const spec = registry[id];
      if (!spec || spec.isHidden) continue;
      host.appendChild(buildMaterialButton(spec));
    }
    host.appendChild(buildEraseButton());
    refreshActiveClass();
  }

  function buildMaterialButton(spec) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const extraClass = spec.isBuiltIn && spec.isExplosive ? ' mat-explosive-builtin' : '';
    btn.className = 'tool-btn ' + (spec.isBuiltIn ? ('mat-' + spec.key) : 'mat-custom') + extraClass;
    btn.setAttribute('data-key', spec.key);
    if (!spec.isBuiltIn) {
      btn.style.setProperty('--swatch', spec.colors[0] || '#e8a030');
    }
    const label = document.createElement('span');
    label.textContent = spec.displayName.slice(0, 14);
    btn.appendChild(label);
    if (!spec.isBuiltIn) {
      const flag = document.createElement('span');
      flag.className = 'flag-el';
      flag.setAttribute('role', 'button');
      flag.setAttribute('aria-label', 'flag ' + spec.displayName);
      flag.setAttribute('title', 'flag ' + spec.displayName + ' — tell the builder what is wrong');
      flag.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        openElementFeedback(spec.key);
      });
      btn.appendChild(flag);
      attachLongPress(btn, () => openElementFeedback(spec.key));
    }
    btn.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('flag-el')) return;
      setMaterial(spec.key);
    });
    return btn;
  }

  function attachLongPress(el, handler) {
    let timer = null, startX = 0, startY = 0, fired = false;
    const start = (e) => {
      fired = false;
      const t = (e.touches && e.touches[0]) || e;
      startX = t.clientX; startY = t.clientY;
      timer = setTimeout(() => { fired = true; handler(); }, 650);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const move = (e) => {
      if (!timer) return;
      const t = (e.touches && e.touches[0]) || e;
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', (e) => { cancel(); if (fired && e.cancelable) e.preventDefault(); });
    el.addEventListener('touchcancel', cancel);
  }

  function buildEraseButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn mat-erase';
    btn.setAttribute('data-key', 'erase');
    btn.textContent = 'erase';
    btn.onclick = () => setMaterial('erase');
    return btn;
  }

  function refreshActiveClass() {
    document.querySelectorAll('.tool-btn').forEach(b => {
      const k = b.getAttribute('data-key');
      b.classList.toggle('active', k === selectedKey);
    });
  }

  window.setMaterial = function (key) {
    selectedKey = key;
    refreshActiveClass();
    syncActionLabel();
  };

  function pourableKeyFor(key) {
    if (key === 'erase') return 'sand';
    const id = keyToId[key];
    if (!id) return 'sand';
    const spec = registry[id];
    if (!spec) return 'sand';
    if (spec.kind !== 'powder' && spec.kind !== 'liquid') return 'sand';
    return key;
  }

  function syncActionLabel() {
    const drop = document.getElementById('btn-drop');
    if (drop) drop.textContent = 'pour ' + pourableKeyFor(selectedKey);
  }

  window.clearAll = function () {
    pours = [];
    if (gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboA);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboA);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([30,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([30,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, chargeFboA);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([128,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, chargeFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([128,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, airFboA);
      gl.viewport(0, 0, AIR_COLS, AIR_ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([128,128,128,30]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, airFboB);
      gl.viewport(0, 0, AIR_COLS, AIR_ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([128,128,128,30]));
    }
    selectedKey = 'wall';
    refreshActiveClass();
    syncActionLabel();
    discoveredKeys.clear();
    discoveryToastQueue = [];
    showOverlay('paint walls or any element on the canvas.\npour from the top.\n\ntry: drop a battery onto copper, or paint lightning\non gunpowder. open invent for endless physics.');
  };

  function canvasCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const fx = Math.floor(x * COLS / rect.width);
    const fyRow = Math.floor(y * ROWS / rect.height);
    const fy = (ROWS - 1 - fyRow);
    return { c: fx, r: fy };
  }

  function brushRadiusFor(key) {
    if (key === 'erase') return 3;
    const id = keyToId[key];
    if (!id) return 2;
    const spec = registry[id];
    if (!spec) return 2;
    if (spec.isExplosive) return 3;
    if (spec.kind === 'static') return 4;
    if (spec.kind === 'gas') {
      const buoy = (typeof spec.buoyancy === 'number') ? spec.buoyancy : 0.9;
      return buoy >= 0.9 ? 2 : 3;
    }
    if (spec.kind === 'liquid') {
      const stick = (typeof spec.stickiness === 'number') ? spec.stickiness : 0;
      if (stick >= 0.7) return 1;
      return 2;
    }
    if (spec.kind === 'powder') {
      const flow = (typeof spec.flow === 'number') ? spec.flow : 0.55;
      if (flow >= 0.9) return 3;
      return 2;
    }
    return 2;
  }

  function paintAtFrag(cx, cy, brushR) {
    const key = selectedKey;
    let id = 0; let spec = null;
    if (key !== 'erase') {
      id = keyToId[key] || 0;
      if (!id) return;
      spec = registry[id];
    }
    paintPass(cx, cy, brushR, id, spec);
  }

  function paintPass(cx, cy, brushR, id, spec) {
    let raOverride = 256;     // 256 = use registers texture default
    let rb = 0;
    if (spec && spec.kind === 'gas' && spec.lifeMin) {
      const lifeMin = spec.lifeMin;
      const lifeMax = spec.lifeMax || (lifeMin + 40);
      raOverride = Math.min(255, lifeMin + Math.floor(Math.random() * Math.max(1, lifeMax - lifeMin)));
    }
    if (spec && spec.isExplosive) {
      raOverride = 28;        // settle window
      rb = 0;
    }
    const kind = spec ? kindCode(spec.kind) : 0;

    gl.useProgram(progPaint);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progPaint, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.uniform1i(gl.getUniformLocation(progPaint, 'uElemData'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.uniform1i(gl.getUniformLocation(progPaint, 'uRegisters'), 2);
    gl.uniform2i(gl.getUniformLocation(progPaint, 'uSize'), COLS, ROWS);
    gl.uniform2i(gl.getUniformLocation(progPaint, 'uCenter'), cx, cy);
    gl.uniform1i(gl.getUniformLocation(progPaint, 'uRadius'), brushR);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintId'), id >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uVariantSeed'), (frameCounter * 2654435761) >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintRaOverride'), raOverride >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintRb'), rb >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintKind'), kind);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function paintLineFrag(c0, r0, c1, r1, brushR) {
    let dx = Math.abs(c1 - c0), sx = c0 < c1 ? 1 : -1;
    let dy = -Math.abs(r1 - r0), sy = r0 < r1 ? 1 : -1;
    let err = dx + dy;
    let c = c0, r = r0;
    while (true) {
      paintAtFrag(c, r, brushR);
      if (c === c1 && r === r1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; c += sx; }
      if (e2 <= dx) { err += dx; r += sy; }
    }
  }

  function startHoldPaint() {
    stopHoldPaint();
    holdPaintTimer = setInterval(() => {
      if (!isPointerDown || !lastPointer) return;
      paintAtFrag(lastPointer.c, lastPointer.r, brushRadiusFor(selectedKey));
    }, 33);
  }
  function stopHoldPaint() {
    if (holdPaintTimer) { clearInterval(holdPaintTimer); holdPaintTimer = null; }
  }

  function onPointerDown(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const cell = canvasCell(e);
    if (probeMode) { probeAt(cell.c, cell.r); return; }
    isPointerDown = true;
    lastCell = cell;
    lastPointer = cell;
    paintAtFrag(cell.c, cell.r, brushRadiusFor(selectedKey));
    hideOverlay();
    startHoldPaint();
  }
  function onPointerMove(e) {
    if (probeMode) {
      if (e.buttons || (e.pointerType === 'touch')) {
        e.preventDefault();
        const cell = canvasCell(e);
        probeAt(cell.c, cell.r);
      }
      return;
    }
    if (!isPointerDown) return;
    e.preventDefault();
    const cell = canvasCell(e);
    if (lastCell) paintLineFrag(lastCell.c, lastCell.r, cell.c, cell.r, brushRadiusFor(selectedKey));
    lastCell = cell;
    lastPointer = cell;
  }
  function onPointerUp() {
    isPointerDown = false;
    lastCell = null;
    lastPointer = null;
    stopHoldPaint();
  }

  // ── Probe mode ─────────────────────────────────────────────────────────────
  window.toggleProbe = function () {
    probeMode = !probeMode;
    const btn = document.getElementById('btn-probe');
    if (btn) btn.setAttribute('aria-pressed', probeMode ? 'true' : 'false');
    if (canvas) canvas.style.cursor = probeMode ? 'crosshair' : 'crosshair';
    if (!probeMode) hideProbeTooltip();
  };

  function probeAt(col, row) {
    if (!gl || col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      hideProbeTooltip();
      return;
    }
    const cell = new Uint8Array(4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, stateFboA);
    gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, cell);
    const tempPixel = new Uint8Array(4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tempFboA);
    gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempPixel);
    const chargePixel = new Uint8Array(4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, chargeFboA);
    gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, chargePixel);
    const airPixel = new Uint8Array(4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, airFboA);
    const ax = Math.max(0, Math.min(AIR_COLS - 1, Math.floor(col / 4)));
    const ay = Math.max(0, Math.min(AIR_ROWS - 1, Math.floor(row / 4)));
    gl.readPixels(ax, ay, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, airPixel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    showProbeTooltip(cell[0], cell[2], cell[3], tempPixel[0], chargePixel[0], airPixel);
  }

  function showProbeTooltip(id, ra, rb, temp, charge, airPixel) {
    const el = document.getElementById('probe-tooltip');
    if (!el) return;
    const signedCharge = charge - 128;
    const pressure = airPixel[0] - 128;
    const airVx = airPixel[1] - 128;
    const airVy = airPixel[2] - 128;

    if (id === 0) {
      const lines = [`<span class="probe-name">empty</span>`,
        `temp     ${pad3(temp)}  ${heatBar(temp)}`,
        `charge   ${signCh(signedCharge)}  ${chargeBar(charge)}`,
        `pres     ${signNum(pressure)}  ${pressureBar(airPixel[0])}`,
        `wind     ${signNum(airVx)},${signNum(airVy)}`];
      el.innerHTML = lines.join('\n');
      el.classList.remove('hidden');
      return;
    }
    const spec = registry[id];
    if (!spec) { el.classList.add('hidden'); return; }
    const name = spec.displayName || spec.key || ('id ' + id);
    const lines = [`<span class="probe-name">${escapeHtml(name)}</span>`];
    lines.push(`kind     ${spec.kind}`);
    lines.push(`temp     ${pad3(temp)}  ${heatBar(temp)}`);
    if (typeof spec.density === 'number')      lines.push(`density  ${pad3(spec.density)}`);
    if (typeof spec.flow === 'number')         lines.push(`flow     ${spec.flow.toFixed(2)}  ${unitBar(spec.flow)}`);
    if (typeof spec.viscosity === 'number')    lines.push(`viscos   ${spec.viscosity.toFixed(2)}  ${unitBar(spec.viscosity)}`);
    if (typeof spec.buoyancy === 'number')     lines.push(`buoyant  ${spec.buoyancy.toFixed(2)}  ${unitBar(spec.buoyancy)}`);
    if (typeof spec.stickiness === 'number' && spec.stickiness > 0)
      lines.push(`sticky   ${spec.stickiness.toFixed(2)}  ${unitBar(spec.stickiness)}`);
    if (typeof spec.airflowFactor === 'number' && spec.airflowFactor > 0)
      lines.push(`drift    ${spec.airflowFactor.toFixed(2)}  ${unitBar(spec.airflowFactor)}`);
    lines.push(`charge   ${signCh(signedCharge)}  ${chargeBar(charge)}`);
    lines.push(`pres     ${signNum(pressure)}  ${pressureBar(airPixel[0])}`);
    lines.push(`wind     ${signNum(airVx)},${signNum(airVy)}`);
    if (spec.conducts) lines.push(`conducts yes`);
    if (typeof spec.chargeEmit === 'number' && spec.chargeEmit !== 0) lines.push(`emit-c   ${signNum(spec.chargeEmit)}`);
    if (typeof spec.ignitesAtCharge === 'number' && spec.ignitesAtCharge > 0) lines.push(`pop@chg  ${pad3(spec.ignitesAtCharge)}+`);
    if (typeof spec.emitTemp === 'number' && spec.emitTemp !== 30)
      lines.push(`emits    ${pad3(spec.emitTemp)}  ${heatBar(spec.emitTemp)}`);
    if (typeof spec.ignitionPoint === 'number' && spec.ignitionPoint < 255)
      lines.push(`ignites  ${pad3(spec.ignitionPoint)}+ flam ${(spec.flammability||0).toFixed(2)}`);
    if (typeof spec.conductivity === 'number') lines.push(`heat-k   ${pad3(spec.conductivity)}  ${valBar(spec.conductivity)}`);
    if (typeof spec.corrosivity === 'number' && spec.corrosivity > 0)
      lines.push(`corrode  ${pad3(spec.corrosivity)}  ${valBar(spec.corrosivity)}`);
    if (typeof spec.hardness === 'number')     lines.push(`hard     ${pad3(spec.hardness)}  ${valBar(spec.hardness)}`);
    if (spec.meltingPoint && spec.meltsTo)     lines.push(`melts→${spec.meltsTo} @ ${spec.meltingPoint}`);
    if (spec.boilingPoint && spec.boilsTo)     lines.push(`boils→${spec.boilsTo} @ ${spec.boilingPoint}`);
    if (spec.freezingPoint && spec.freezesTo)  lines.push(`freeze→${spec.freezesTo} @ ${spec.freezingPoint}`);
    if (spec.pressureBlast > 0)                lines.push(`pop@P    ${pad3(spec.pressureBlast)}+ → ${spec.pressureBlastTo || 'empty'}`);
    if (typeof spec.raDelta === 'number' && spec.raDelta !== 0)
      lines.push(`reg-a    ${pad3(ra)} (Δ${spec.raDelta > 0 ? '+' : ''}${spec.raDelta})`);
    else if (ra > 0)
      lines.push(`reg-a    ${pad3(ra)}`);
    el.innerHTML = lines.join('\n');
    el.classList.remove('hidden');
  }

  function hideProbeTooltip() {
    const el = document.getElementById('probe-tooltip');
    if (el) el.classList.add('hidden');
  }

  function pad3(n) { return ('  ' + (n|0)).slice(-3); }
  function signNum(n) { const x = (n|0); return (x >= 0 ? '+' : '') + x; }
  function signCh(n) { const x = (n|0); return (x >= 0 ? '+' : '') + pad3(Math.abs(x)).trim(); }
  function unitBar(v) {
    const w = Math.max(0, Math.min(60, Math.round(v * 60)));
    return `<span class="probe-bar"><span style="width:${w}px"></span></span>`;
  }
  function valBar(v) {
    const w = Math.max(0, Math.min(60, Math.round((v / 255) * 60)));
    return `<span class="probe-bar"><span style="width:${w}px"></span></span>`;
  }
  function heatBar(t) {
    const w = Math.max(0, Math.min(60, Math.round((t / 255) * 60)));
    return `<span class="probe-bar heat"><span style="width:${w}px"></span></span>`;
  }
  function chargeBar(c) {
    const mag = Math.abs(c - 128);
    const w = Math.max(0, Math.min(60, Math.round((mag / 127) * 60)));
    const cls = c >= 128 ? 'pos' : 'neg';
    return `<span class="probe-bar charge ${cls}"><span style="width:${w}px"></span></span>`;
  }
  function pressureBar(p) {
    const mag = Math.abs(p - 128);
    const w = Math.max(0, Math.min(60, Math.round((mag / 127) * 60)));
    const cls = p >= 128 ? 'pos' : 'neg';
    return `<span class="probe-bar pres ${cls}"><span style="width:${w}px"></span></span>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // ── Discovery log ─────────────────────────────────────────────────────────
  function rebuildDiscoveryRules() {
    discoveryRules = [];
    const seen = new Set();
    const push = (fromKey, toKey, label) => {
      if (!fromKey || !toKey || fromKey === toKey) return;
      const from = keyToId[fromKey];
      const to = keyToId[toKey];
      if (!from || !to) return;
      const k = from + '>' + to;
      if (seen.has(k)) return;
      seen.add(k);
      discoveryRules.push({ from, to, fromKey, toKey, label });
    };
    for (const idStr of Object.keys(registry)) {
      const spec = registry[+idStr];
      if (!spec) continue;
      if (spec.meltsTo)    push(spec.key, spec.meltsTo,   `${spec.key} melts → ${spec.meltsTo}`);
      if (spec.boilsTo)    push(spec.key, spec.boilsTo,   `${spec.key} boils → ${spec.boilsTo}`);
      if (spec.freezesTo)  push(spec.key, spec.freezesTo, `${spec.key} ${spec.kind === 'gas' ? 'condenses' : 'freezes'} → ${spec.freezesTo}`);
      if (spec.raTransformsTo) push(spec.key, spec.raTransformsTo, `${spec.key} decays → ${spec.raTransformsTo}`);
      if (spec.pressureBlastTo) push(spec.key, spec.pressureBlastTo, `${spec.key} pops → ${spec.pressureBlastTo}`);
      if (Array.isArray(spec.reactions)) {
        for (const rx of spec.reactions) {
          if (!rx || rx.explodes) continue;
          if (rx.becomes) push(rx.other, rx.becomes, `${rx.other} + ${spec.key} → ${rx.becomes}`);
        }
      }
    }
  }

  function discoveryReadback() {
    if (!gl || !discoveryRules.length) return;
    if (!discoveryReadBuf || discoveryReadBuf.length !== COLS * ROWS * 4) {
      discoveryReadBuf = new Uint8Array(COLS * ROWS * 4);
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, stateFboA);
    gl.readPixels(0, 0, COLS, ROWS, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, discoveryReadBuf);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    const present = new Set();
    for (let i = 0; i < discoveryReadBuf.length; i += 4) {
      const id = discoveryReadBuf[i];
      if (id !== 0) present.add(id);
    }
    for (const rule of discoveryRules) {
      const k = rule.from + '>' + rule.to;
      if (discoveredKeys.has(k)) continue;
      if (present.has(rule.from) && present.has(rule.to)) {
        discoveredKeys.add(k);
        if (rule.label) queueDiscoveryToast(rule.label);
      }
    }
  }

  function queueDiscoveryToast(label) {
    discoveryToastQueue.push(label);
    if (!discoveryToastActive) showNextDiscoveryToast();
  }
  function showNextDiscoveryToast() {
    const el = document.getElementById('discovery-toast');
    if (!el) return;
    if (!discoveryToastQueue.length) {
      discoveryToastActive = false;
      el.classList.add('hidden');
      return;
    }
    discoveryToastActive = true;
    const label = discoveryToastQueue.shift();
    el.textContent = 'discovered: ' + label;
    el.classList.add('hidden');
    void el.offsetWidth;
    el.classList.remove('hidden');
    if (discoveryToastTimer) clearTimeout(discoveryToastTimer);
    discoveryToastTimer = setTimeout(() => {
      discoveryToastActive = false;
      showNextDiscoveryToast();
    }, 3200);
  }

  // ── Pour ───────────────────────────────────────────────────────────────────
  window.startDrop = function () {
    const key = pourableKeyFor(selectedKey);
    const id = keyToId[key];
    if (!id) return;
    const spec = registry[id];
    pours.push({ id, kind: spec.kind, frames: 0, total: 300 });
    hideOverlay();
  };

  function spawnFromPours() {
    if (!pours.length) return;
    const next = [];
    for (const p of pours) {
      if (p.frames > p.total) continue;
      const spec = registry[p.id];
      if (!spec) continue;
      const sprayRow = (spec.kind === 'gas') ? 1 : (ROWS - 2);
      for (let s = 0; s < 6; s++) {
        const cx = Math.floor(Math.random() * COLS);
        paintPass(cx, sprayRow, 1, p.id, spec);
      }
      p.frames++;
      next.push(p);
    }
    pours = next;
  }

  // ── Sim orchestration ─────────────────────────────────────────────────────
  function bindStateA(prog, name, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }
  function bindElementData(prog, name, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }
  function bindTraits(prog, name, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  function simStep() {
    for (let phase = 0; phase < 4; phase++) {
      gl.useProgram(progSim);
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      bindStateA(progSim, 'uState', 0);
      bindElementData(progSim, 'uElemData', 1);
      bindTraits(progSim, 'uTraits', 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, airTexA);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uAir'), 3);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uPhase'), (frameCounter * 4 + phase) & 3);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uFrame'), frameCounter * 4 + phase);
      gl.uniform2i(gl.getUniformLocation(progSim, 'uSize'), COLS, ROWS);
      gl.uniform2i(gl.getUniformLocation(progSim, 'uAirSize'), AIR_COLS, AIR_ROWS);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      [stateTexA, stateTexB] = [stateTexB, stateTexA];
      [stateFboA, stateFboB] = [stateFboB, stateFboA];
    }
  }

  function explosionStep() {
    gl.useProgram(progContact);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progContact, 'uState', 0);
    bindElementData(progContact, 'uElemData', 1);
    gl.uniform2i(gl.getUniformLocation(progContact, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];

    gl.useProgram(progBlast);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progBlast, 'uState', 0);
    bindElementData(progBlast, 'uElemData', 1);
    gl.uniform2i(gl.getUniformLocation(progBlast, 'uSize'), COLS, ROWS);
    gl.uniform1ui(gl.getUniformLocation(progBlast, 'uSparkId'), (keyToId.spark || 0) >>> 0);
    gl.uniform1i(gl.getUniformLocation(progBlast, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function reactStep() {
    gl.useProgram(progReact);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progReact, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uReactions'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uTemp'), 2);
    gl.uniform2i(gl.getUniformLocation(progReact, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function corrosionStep() {
    if (!progCorrosion) return;
    gl.useProgram(progCorrosion);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progCorrosion, 'uState', 0);
    bindTraits(progCorrosion, 'uTraits', 1);
    gl.uniform2i(gl.getUniformLocation(progCorrosion, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progCorrosion, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function phaseStep() {
    if (!progPhase) return;
    gl.useProgram(progPhase);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progPhase, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progPhase, 'uTemp'), 1);
    bindTraits(progPhase, 'uTraits', 2);
    bindElementData(progPhase, 'uElemData', 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.uniform1i(gl.getUniformLocation(progPhase, 'uRegisters'), 4);
    gl.uniform2i(gl.getUniformLocation(progPhase, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progPhase, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function heatStep() {
    if (!progHeat) return;
    gl.useProgram(progHeat);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progHeat, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progHeat, 'uTemp'), 1);
    bindTraits(progHeat, 'uTraits', 2);
    gl.uniform2i(gl.getUniformLocation(progHeat, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [tempTexA, tempTexB] = [tempTexB, tempTexA];
    [tempFboA, tempFboB] = [tempFboB, tempFboA];
  }

  function ignitionStep() {
    if (!progIgnition) return;
    const fireId = keyToId.fire || 0;
    gl.useProgram(progIgnition);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progIgnition, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uTemp'), 1);
    bindTraits(progIgnition, 'uTraits', 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, chargeTexA);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uCharge'), 3);
    gl.uniform2i(gl.getUniformLocation(progIgnition, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uFrame'), frameCounter);
    gl.uniform1ui(gl.getUniformLocation(progIgnition, 'uFireId'), fireId >>> 0);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function cellularStep() {
    if (!progCellular) return;
    for (const idStr of Object.keys(registry)) {
      const id = +idStr;
      const spec = registry[id];
      if (!spec || spec.kind !== 'cellular') continue;
      const tick = Math.max(1, Math.min(15, Math.round(spec.cellularTick || 6)));
      if (frameCounter % tick !== 0) continue;
      gl.useProgram(progCellular);
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      bindStateA(progCellular, 'uState', 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cellularDataTex);
      gl.uniform1i(gl.getUniformLocation(progCellular, 'uCellularData'), 1);
      gl.uniform2i(gl.getUniformLocation(progCellular, 'uSize'), COLS, ROWS);
      gl.uniform1ui(gl.getUniformLocation(progCellular, 'uCellularId'), id >>> 0);
      gl.uniform1i(gl.getUniformLocation(progCellular, 'uFrame'), frameCounter);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      [stateTexA, stateTexB] = [stateTexB, stateTexA];
      [stateFboA, stateFboB] = [stateFboB, stateFboA];
    }
  }

  function registerStep() {
    if (!progRegister) return;
    gl.useProgram(progRegister);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progRegister, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.uniform1i(gl.getUniformLocation(progRegister, 'uRegisters'), 1);
    bindElementData(progRegister, 'uElemData', 2);
    gl.uniform2i(gl.getUniformLocation(progRegister, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progRegister, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function chargeStep() {
    if (!progCharge) return;
    gl.useProgram(progCharge);
    gl.bindFramebuffer(gl.FRAMEBUFFER, chargeFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progCharge, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, chargeTexA);
    gl.uniform1i(gl.getUniformLocation(progCharge, 'uCharge'), 1);
    bindTraits(progCharge, 'uTraits', 2);
    gl.uniform2i(gl.getUniformLocation(progCharge, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [chargeTexA, chargeTexB] = [chargeTexB, chargeTexA];
    [chargeFboA, chargeFboB] = [chargeFboB, chargeFboA];
  }

  function pressureStep() {
    if (!progPressure) return;
    gl.useProgram(progPressure);
    gl.bindFramebuffer(gl.FRAMEBUFFER, airFboB);
    gl.viewport(0, 0, AIR_COLS, AIR_ROWS);
    bindStateA(progPressure, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progPressure, 'uTemp'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, airTexA);
    gl.uniform1i(gl.getUniformLocation(progPressure, 'uAir'), 2);
    bindElementData(progPressure, 'uElemData', 3);
    bindTraits(progPressure, 'uTraits', 4);
    gl.uniform2i(gl.getUniformLocation(progPressure, 'uSize'), COLS, ROWS);
    gl.uniform2i(gl.getUniformLocation(progPressure, 'uAirSize'), AIR_COLS, AIR_ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [airTexA, airTexB] = [airTexB, airTexA];
    [airFboA, airFboB] = [airFboB, airFboA];
  }

  function pressureBlastStep() {
    if (!progPressureBlast) return;
    gl.useProgram(progPressureBlast);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    bindStateA(progPressureBlast, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, airTexA);
    gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uAir'), 1);
    bindTraits(progPressureBlast, 'uTraits', 2);
    bindElementData(progPressureBlast, 'uElemData', 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, registersTex);
    gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uRegisters'), 4);
    gl.uniform2i(gl.getUniformLocation(progPressureBlast, 'uSize'), COLS, ROWS);
    gl.uniform2i(gl.getUniformLocation(progPressureBlast, 'uAirSize'), AIR_COLS, AIR_ROWS);
    gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function render() {
    gl.useProgram(progRender);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bindStateA(progRender, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uPalette'), 1);
    bindElementData(progRender, 'uElemData', 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uTemp'), 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, chargeTexA);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uCharge'), 4);
    gl.uniform2i(gl.getUniformLocation(progRender, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function loop() {
    spawnFromPours();
    simStep();
    explosionStep();
    reactStep();
    corrosionStep();
    heatStep();
    ignitionStep();
    phaseStep();
    cellularStep();
    registerStep();
    chargeStep();
    pressureStep();
    pressureBlastStep();
    render();
    if (frameCounter % DISCOVERY_INTERVAL === 0) discoveryReadback();
    frameCounter++;
    animId = requestAnimationFrame(loop);
  }

  // ── Invent modal ───────────────────────────────────────────────────────────
  function bindModal() {
    const overlay = document.getElementById('invent-overlay');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInvent(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeInvent();
    });
    document.querySelectorAll('.invent-example').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('invent-name').value = btn.getAttribute('data-name') || '';
        document.getElementById('invent-desc').value = btn.getAttribute('data-desc') || '';
        document.getElementById('invent-name').focus();
      });
    });
  }

  let elfbTargetKey = null;
  function bindElementFeedbackModal() {
    const overlay = document.getElementById('elfb-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeElementFeedback(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeElementFeedback();
    });
    document.getElementById('elfb-cancel').addEventListener('click', closeElementFeedback);
    document.getElementById('elfb-submit').addEventListener('click', submitElementFeedback);
    document.querySelectorAll('#elfb-chips .elfb-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });
  }

  function openElementFeedback(key) {
    const id = keyToId[key];
    if (!id) return;
    const spec = registry[id];
    if (!spec) return;
    elfbTargetKey = key;
    document.getElementById('elfb-name').textContent = spec.displayName;
    document.querySelectorAll('#elfb-chips .elfb-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('elfb-note').value = '';
    setElfbStatus('', false);
    document.getElementById('elfb-submit').disabled = false;
    document.getElementById('elfb-submit').textContent = 'send';
    document.getElementById('elfb-overlay').classList.remove('hidden');
  }
  function closeElementFeedback() {
    document.getElementById('elfb-overlay').classList.add('hidden');
    elfbTargetKey = null;
  }
  function setElfbStatus(msg, isErr) {
    const el = document.getElementById('elfb-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }
  function submitElementFeedback() {
    if (!elfbTargetKey) { closeElementFeedback(); return; }
    const id = keyToId[elfbTargetKey];
    const spec = registry[id];
    if (!spec) { closeElementFeedback(); return; }
    const reasons = Array.from(document.querySelectorAll('#elfb-chips .elfb-chip.selected'))
      .map(c => c.getAttribute('data-reason')).filter(Boolean);
    const note = (document.getElementById('elfb-note').value || '').trim();
    if (!reasons.length && !note) { setElfbStatus('pick a reason or add a note.', true); return; }
    const report = { type: 'element_feedback', element: spec, reasons, note };
    const text = '[element_feedback] ' + spec.displayName
      + (reasons.length ? ' — ' + reasons.join('; ') : '')
      + (note ? ' — ' + note : '')
      + '\n' + JSON.stringify(report);
    const submitBtn = document.getElementById('elfb-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'sending…';
    setElfbStatus('', false);
    fetch(FEEDBACK_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, text }),
    }).then(r => { if (!r.ok) throw new Error('http_' + r.status); return r.json(); })
      .then(() => { setElfbStatus('thanks — the builder will see this next iteration.', false); setTimeout(closeElementFeedback, 1200); })
      .catch(() => { submitBtn.disabled = false; submitBtn.textContent = 'retry'; setElfbStatus('send failed. try again?', true); });
  }

  window.openInvent = function () {
    const overlay = document.getElementById('invent-overlay');
    overlay.classList.remove('hidden');
    setInventStatus('', false);
    const nameEl = document.getElementById('invent-name');
    const descEl = document.getElementById('invent-desc');
    nameEl.value = ''; descEl.value = '';
    setInventBusy(false);
    setTimeout(() => nameEl.focus(), 30);
  };
  window.closeInvent = function () {
    document.getElementById('invent-overlay').classList.add('hidden');
  };
  function setInventStatus(msg, isErr) {
    const el = document.getElementById('invent-status');
    el.textContent = msg || ''; el.classList.toggle('err', !!isErr);
  }
  function setInventBusy(busy) {
    document.getElementById('invent-submit').disabled = busy;
    document.getElementById('invent-cancel').disabled = busy;
    document.getElementById('invent-submit').textContent = busy ? 'inventing…' : 'invent';
  }

  window.submitInvent = async function () {
    const nameRaw = (document.getElementById('invent-name').value || '').trim();
    const descRaw = (document.getElementById('invent-desc').value || '').trim();
    if (!nameRaw) { setInventStatus('give it a name first.', true); return; }
    const key = slugify(nameRaw);
    if (!key) { setInventStatus('pick a name with letters in it.', true); return; }
    if (keyToId[key]) { setInventStatus('that name is already taken.', true); return; }
    setInventBusy(true);
    setInventStatus('asking the AI for physics…', false);
    try {
      const spec = await generateElement(nameRaw, descRaw);
      const finalized = finalizeSpec(nameRaw, key, spec, descRaw);
      registerElement(finalized);
      rebuildPalette();
      setMaterial(finalized.key);
      closeInvent();
    } catch (e) {
      try {
        const fb = fallbackSpec(nameRaw, key, descRaw);
        registerElement(fb);
        rebuildPalette();
        setMaterial(fb.key);
        closeInvent();
      } catch (e2) {
        setInventBusy(false);
        setInventStatus('could not invent right now. try a different name.', true);
      }
    }
  };

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
  }

  // ── AI call ────────────────────────────────────────────────────────────────
  async function generateElement(name, desc) {
    const existing = Object.keys(keyToId);
    const otherList = existing.join(', ');
    const SYSTEM_PROMPT = [
      'You design elements for a falling-sand physics sandbox with rich emergent physics. Output ONE strict JSON object, no prose, no code fence.',
      '',
      'KIND determines movement: static (immobile), powder (falls, piles), liquid (flows, density-stacks), gas (rises, drifts in wind, finite life), cellular (Conway-like growth).',
      'DENSITY 1-9 orders stacking; heavier sinks under lighter (helium 1, oil 2, water 5, blood 6, mercury 9).',
      '',
      'PHYSICS AXES — each unlocks dozens of element ideas:',
      '',
      '1. HEAT / PHASE — emitTemp 0-255 (fire 240, ice 10), ignitionPoint, flammability 0-1, conductivity 0-255 (metal 240). meltingPoint+meltsTo, boilingPoint+boilsTo, freezingPoint+freezesTo for cascades like ice→water→steam.',
      '',
      '2. CORROSION — corrosivity (acid 200, lava 80) eats neighbors with lower hardness (sand 60, wall 200, diamond 255).',
      '',
      '3. STICKINESS 0-1 — cells cling to walls. tar 0.85, honey 0.7.',
      '',
      '4. CHARGE — invisible electrical field through conductors:',
      '   conducts: bool — charge propagates through this element',
      '   chargeEmit: -127..127 — sets charge here every frame (battery 120, ground -60)',
      '   ignitesAtCharge: 0-255 — |charge| above this triggers ignition (gunpowder 20)',
      '   Examples: copper conducts; battery emits +120; lightning emits +110 and ignites at 1; saltwater conducts weakly.',
      '',
      '5. AIRFLOW / PRESSURE — coarse velocity field:',
      '   airflowFactor: 0-1 — how much wind pushes this cell (gas/dust)',
      '   emitsAirflow: { vx: -8..8, vy: -8..8 } — fan or jet (positive vy = upward push)',
      '   pressureBlast: 0-255 — cell pops at local pressure above this (balloon 180)',
      '   pressureBlastTo: "<key>" — what pop produces (balloon→fire, glass→empty)',
      '',
      '6. REGISTERS — per-cell stateful behavior. Engine ticks ra each frame:',
      '   raInit: 0-255 starting value',
      '   raDelta: -127..127 per-frame change',
      '   raDiesAt: value that triggers death/transform',
      '   raTransformsTo: "<key>" — what it becomes; omit = die (empty)',
      '   Examples:',
      '     ember:    raInit 80, raDelta -1, raDiesAt 0 → dies in 80 frames',
      '     uranium:  raInit 250, raDelta -1, raDiesAt 0, raTransformsTo "lead"',
      '     wine:     raInit 200, raDelta -1, raDiesAt 0, raTransformsTo "vinegar"',
      '     ripening: raInit 0, raDelta +1, raDiesAt 200, raTransformsTo "rot"',
      '',
      '7. ANISOTROPIC GROWTH — for cellular elements: growBias "up"|"down"|"side"|"any". Vines grow up, roots grow down, mold spreads anywhere.',
      '',
      'REACTIONS — pair-events with optional gates: { other, becomes, chance 0.005-0.25, selfConsume? 0-1, minTemp? 0-255, maxTemp? 0-255, catalyst? bool, explodes? }. Use catalyst:true for true catalysts (self stays).',
      '',
      'The engine handles heat, phase changes, corrosion, charge, airflow, pressure, registers, and growth bias automatically. Use reactions[] only for genuinely unique chemical events (e.g., yeast + sugar → alcohol; iron + acid → rust).',
      '',
      'Existing keys: ' + otherList + '.',
      '',
      'Pick traits based on physical intuition. Schema:',
      '{ "kind":..., "density":1-9, "viscosity":0-1, "flow":0-1, "stickiness":0-1, "buoyancy":0-1, "lifeMin":int, "lifeMax":int, "born":[0-8], "survive":[0-8], "growBias":"up|down|side|any", "growChance":0.05-1, "surviveChance":0.5-1, "birthFrom":[key], "cellularTick":1-30, "colors":["#hex"], "emitTemp":0-255, "ignitionPoint":0-255, "flammability":0-1, "conductivity":0-255, "corrosivity":0-255, "hardness":0-255, "meltingPoint":1-255, "meltsTo":"<key>", "boilingPoint":1-255, "boilsTo":"<key>", "freezingPoint":1-255, "freezesTo":"<key>", "conducts":bool, "chargeEmit":-127..127, "ignitesAtCharge":0-255, "airflowFactor":0-1, "emitsAirflow":{"vx":-8..8,"vy":-8..8}, "pressureBlast":0-255, "pressureBlastTo":"<key>", "raInit":0-255, "raDelta":-127..127, "raDiesAt":0-255, "raTransformsTo":"<key>", "reactions":[...] }',
      '',
      'Output JSON only.',
    ].join('\n');
    const userPrompt = desc ? `Name: ${name}\nDescription: ${desc}` : `Name: ${name}`;
    const body = {
      slug: SLUG, model: 'gpt-5.4', temperature: 0.75, max_tokens: 900,
      response_format: 'json_object',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
    };
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    if (!data || typeof data.content !== 'string') throw new Error('bad_shape');
    return JSON.parse(data.content);
  }

  function kindOverrideFromName(key, desc) {
    function hits(str, words) {
      for (const w of words) {
        const re = new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)', 'i');
        if (re.test(str)) return true;
      }
      return false;
    }
    const name = (key || '').toLowerCase();
    if (hits(name, ['fire','flame','inferno','ember','plasma','lightning','spark','arc'])) return 'gas';
    if (hits(name, ['smoke','steam','vapor','mist','fog','cloud','haze','aroma'])) return 'gas';
    if (hits(name, ['balloon','helium','bubble'])) return 'gas';
    if (hits(name, ['wall','brick','concrete','bedrock','stone','rock','marble','granite'])) return 'static';
    if (hits(name, ['wood','timber','log','bark','plank'])) return 'static';
    if (hits(name, ['metal','iron','steel','copper','brass','gold','silver','aluminum','tin'])) return 'static';
    if (hits(name, ['ice','icicle','glacier'])) return 'static';
    if (hits(name, ['plant','leaf','vine','tree','grass','moss','fern'])) return 'static';
    if (hits(name, ['glass','crystal','gem','diamond'])) return 'static';
    if (hits(name, ['battery','wire','circuit','cable','capacitor'])) return 'static';
    if (hits(name, ['fan','vent','jet'])) return 'static';
    if (hits(name, ['lava','magma'])) return 'liquid';
    if (hits(name, ['water','ocean','river','sea'])) return 'liquid';
    if (hits(name, ['oil','gasoline','petrol','fuel','kerosene'])) return 'liquid';
    if (hits(name, ['acid','poison','venom'])) return 'liquid';
    if (hits(name, ['honey','syrup','molasses','caramel','tar'])) return 'liquid';
    if (hits(name, ['blood','slime','goo','ooze'])) return 'liquid';
    if (hits(name, ['mercury','quicksilver'])) return 'liquid';
    if (hits(name, ['juice','milk','wine','soda','ink','paint','beer'])) return 'liquid';
    if (hits(name, ['sand','salt','sugar','flour','dust','talc'])) return 'powder';
    if (hits(name, ['ash','soot','cinder','glitter','gravel','pebble'])) return 'powder';
    if (hits(name, ['snow','seed','gunpowder','gun-powder','confetti'])) return 'powder';
    if (hits(name, ['tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'])) return 'powder';
    if (hits(name, ['mold','fungus','mycelium','lichen','coral','conway','automaton','slime-mold','vine'])) return 'cellular';
    return null;
  }

  function namePropertyHints(key) {
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    if (has('fire','flame','inferno','ember','plasma','spark','lightning','arc')) return { density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70, airflowFactor: 0.5 };
    if (has('lava','magma'))   return { density: 8, viscosity: 0.8, stickiness: 0 };
    if (has('mercury','quicksilver')) return { density: 9, viscosity: 0.1, stickiness: 0, conducts: true };
    if (has('steam'))          return { density: 2, buoyancy: 0.8, lifeMin: 30, lifeMax: 60, airflowFactor: 0.8 };
    if (has('smoke'))          return { density: 2, buoyancy: 0.6, lifeMin: 60, lifeMax: 120, airflowFactor: 0.7 };
    if (has('fog','mist','vapor','cloud','haze')) return { density: 2, buoyancy: 0.5, lifeMin: 60, lifeMax: 120, airflowFactor: 0.7 };
    if (has('balloon','helium','bubble')) return { density: 1, buoyancy: 0.95, lifeMin: 300, lifeMax: 500, airflowFactor: 0.9, pressureBlast: 180 };
    if (has('honey','syrup','molasses','caramel')) return { density: 6, viscosity: 0.9, stickiness: 0.7 };
    if (has('tar','pitch','glue','resin')) return { density: 6, viscosity: 0.95, stickiness: 0.85 };
    if (has('acid'))           return { density: 4, viscosity: 0.1, stickiness: 0 };
    if (has('oil','gasoline','petrol','fuel')) return { density: 2, viscosity: 0.3, stickiness: 0 };
    if (has('water','juice','milk','wine','soda')) return { density: 5, viscosity: 0, stickiness: 0 };
    if (has('slime','goo','ooze'))   return { density: 5, viscosity: 0.6, stickiness: 0.5 };
    if (has('blood'))          return { density: 6, viscosity: 0.4, stickiness: 0 };
    if (has('ink','paint'))    return { density: 5, viscosity: 0.2, stickiness: 0 };
    if (has('snow'))           return { density: 2, flow: 0.4, stickiness: 0 };
    if (has('flour','dust','talc','powder')) return { density: 1, flow: 0.95, stickiness: 0, airflowFactor: 0.9 };
    if (has('ash','soot','cinder')) return { density: 2, flow: 0.9, stickiness: 0, airflowFactor: 0.7 };
    if (has('gravel','pebbles','rocks')) return { density: 7, flow: 0.15, stickiness: 0 };
    if (has('gunpowder')||has('gun-powder')) return { density: 4, flow: 0.6, stickiness: 0, ignitesAtCharge: 20 };
    if (has('salt','sugar','seed','rice','glitter','confetti','sand')) return { density: 4, flow: 0.55, stickiness: 0 };
    if (has('wood','timber','log','bark','plank')) return { density: 4 };
    if (has('battery'))        return { density: 8, conducts: true, chargeEmit: 120 };
    if (has('wire','cable','circuit')) return { density: 7, conducts: true };
    if (has('copper','brass')) return { density: 8, conducts: true };
    if (has('metal','iron','steel','aluminum','tin')) return { density: 8, conducts: true };
    if (has('gold','silver')) return { density: 9, conducts: true };
    if (has('fan','vent','jet')) return { density: 6, emitsAirflow: { vx: 0, vy: 6 } };
    if (has('uranium','plutonium','radio')) return { density: 9, raInit: 250, raDelta: -1, raTransformsTo: 'stone' };
    if (has('ice','icicle')) return { density: 5 };
    if (has('plant','leaf','vine','tree','grass','moss')) return { density: 3 };
    return null;
  }

  function finalizeSpec(displayName, key, raw, userDesc) {
    const kinds = ['static','powder','liquid','gas','cellular'];
    let kind = (raw && typeof raw.kind === 'string') ? raw.kind.toLowerCase() : 'powder';
    if (kinds.indexOf(kind) < 0) kind = 'powder';
    const override = kindOverrideFromName(key, userDesc);
    const kindWasOverridden = !!(override && override !== kind);
    if (override) kind = override;
    const hint = namePropertyHints(key);

    let density = Number(raw && raw.density);
    if (!isFinite(density)) density = (hint && isFinite(hint.density)) ? hint.density : 5;
    if (kindWasOverridden && hint && isFinite(hint.density)) density = hint.density;
    density = Math.max(1, Math.min(9, density));

    let colorsArr = Array.isArray(raw && raw.colors) ? raw.colors.filter(isHex).slice(0, 6) : [];
    const canonicalColors = kindWasOverridden ? canonicalPaletteFromName(key) : null;
    if (canonicalColors) colorsArr = canonicalColors;
    if (colorsArr.length < 3) colorsArr = canonicalPaletteFromName(key) || fillFallbackColors(key);

    const validKeys = new Set(Object.keys(keyToId));
    validKeys.add(key);
    const reactions = [];
    if (Array.isArray(raw && raw.reactions)) {
      for (const rx of raw.reactions.slice(0, 3)) {
        if (!rx || typeof rx !== 'object') continue;
        const other = (typeof rx.other === 'string') ? rx.other.toLowerCase() : '';
        if (!validKeys.has(other)) continue;
        if (rx.explodes) {
          let chance = Number(rx.chance);
          if (!isFinite(chance)) chance = 0.9;
          chance = Math.max(0.1, Math.min(1, chance));
          const er = Math.max(4, Math.min(20, Math.round(Number(rx.explosionRadius)) || 8));
          const ep = Math.max(0.3, Math.min(3, Number(rx.explosionPower) || 1));
          reactions.push({ other, explodes: true, explosionRadius: er, explosionPower: ep, chance });
          continue;
        }
        let becomes = rx.becomes;
        if (becomes == null || becomes === '' || /^empty$/i.test(String(becomes))) becomes = null;
        else { becomes = String(becomes).toLowerCase(); if (!validKeys.has(becomes)) continue; }
        let chance = Number(rx.chance);
        if (!isFinite(chance)) chance = 0.05;
        chance = Math.max(0.005, Math.min(0.25, chance));
        const reaction = { other, becomes, chance };
        const sc = Number(rx.selfConsume);
        if (isFinite(sc) && sc > 0) reaction.selfConsume = Math.max(0, Math.min(1, sc));
        if (typeof rx.minTemp === 'number') reaction.minTemp = Math.max(0, Math.min(255, rx.minTemp|0));
        if (typeof rx.maxTemp === 'number') reaction.maxTemp = Math.max(0, Math.min(255, rx.maxTemp|0));
        if (rx.catalyst === true) reaction.catalyst = true;
        reactions.push(reaction);
      }
    }

    const out = {
      id: nextCustomId(),
      key,
      displayName: displayName.slice(0, 14).toLowerCase(),
      kind, density, colors: colorsArr, reactions,
      isBuiltIn: false,
      userDesc: userDesc || '',
    };

    const preferHint = kindWasOverridden && hint;
    if (kind === 'liquid') {
      let visc = Number(raw && raw.viscosity);
      if (preferHint && isFinite(hint.viscosity)) visc = hint.viscosity;
      else if (!isFinite(visc)) visc = (hint && isFinite(hint.viscosity)) ? hint.viscosity : 0;
      out.viscosity = Math.max(0, Math.min(1, visc));
      let stick = Number(raw && raw.stickiness);
      if (preferHint && isFinite(hint.stickiness)) stick = hint.stickiness;
      else if (!isFinite(stick)) stick = (hint && isFinite(hint.stickiness)) ? hint.stickiness : 0;
      out.stickiness = Math.max(0, Math.min(1, stick));
    } else if (kind === 'powder') {
      let flow = Number(raw && raw.flow);
      if (preferHint && isFinite(hint.flow)) flow = hint.flow;
      else if (!isFinite(flow)) flow = (hint && isFinite(hint.flow)) ? hint.flow : 0.55;
      out.flow = Math.max(0.05, Math.min(1, flow));
      let stick = Number(raw && raw.stickiness);
      if (preferHint && isFinite(hint.stickiness)) stick = hint.stickiness;
      else if (!isFinite(stick)) stick = (hint && isFinite(hint.stickiness)) ? hint.stickiness : 0;
      out.stickiness = Math.max(0, Math.min(1, stick));
    } else if (kind === 'gas') {
      let buoy = Number(raw && raw.buoyancy);
      if (preferHint && isFinite(hint.buoyancy)) buoy = hint.buoyancy;
      else if (!isFinite(buoy)) buoy = (hint && isFinite(hint.buoyancy)) ? hint.buoyancy : 0.9;
      out.buoyancy = Math.max(0.05, Math.min(1, buoy));
      let lifeMin = Math.round(Number(raw && raw.lifeMin));
      let lifeMax = Math.round(Number(raw && raw.lifeMax));
      if (preferHint && isFinite(hint.lifeMin)) lifeMin = hint.lifeMin;
      else if (!isFinite(lifeMin)) lifeMin = (hint && isFinite(hint.lifeMin)) ? hint.lifeMin : 60;
      if (preferHint && isFinite(hint.lifeMax)) lifeMax = hint.lifeMax;
      else if (!isFinite(lifeMax) || lifeMax < lifeMin) lifeMax = lifeMin + 40;
      lifeMin = Math.max(0, Math.min(150, lifeMin));
      lifeMax = Math.max(0, Math.min(200, lifeMax));
      if (lifeMin === 0 && lifeMax === 0) { lifeMin = 60; lifeMax = 100; }
      out.lifeMin = lifeMin; out.lifeMax = lifeMax;
    } else if (kind === 'cellular') {
      const parseIntArray = (v) => Array.isArray(v) ? v.map(Number).filter(n => isFinite(n) && n >= 0 && n <= 8).map(Math.round) : null;
      out.born    = parseIntArray(raw && raw.born)    || [3];
      out.survive = parseIntArray(raw && raw.survive) || [2,3];
      const tick = Number(raw && raw.cellularTick);
      out.cellularTick = isFinite(tick) ? Math.max(1, Math.min(30, Math.round(tick))) : 6;
      const gc = Number(raw && raw.growChance);
      out.growChance = isFinite(gc) ? Math.max(0.05, Math.min(1, gc)) : 0.45;
      const sc = Number(raw && raw.surviveChance);
      out.surviveChance = isFinite(sc) ? Math.max(0.5, Math.min(1, sc)) : 0.92;
      if (Array.isArray(raw && raw.birthFrom)) {
        out.birthFrom = raw.birthFrom.filter(k => typeof k === 'string').map(k => k.toLowerCase()).filter(k => keyToId[k]);
      }
      if (typeof raw.growBias === 'string' && /^(up|down|side|any)$/i.test(raw.growBias)) {
        out.growBias = raw.growBias.toLowerCase();
      }
    }

    applyTraits(out, raw, key, userDesc, hint, preferHint);
    return out;
  }

  function applyTraits(out, raw, key, userDesc, hint, preferHint) {
    const defaults = traitDefaultsForName(key, out.kind);
    const raw255 = (v, d) => {
      const n = Number(v);
      if (!isFinite(n)) return d;
      return Math.max(0, Math.min(255, Math.round(n)));
    };
    const raw01 = (v, d) => {
      const n = Number(v);
      if (!isFinite(n)) return d;
      return Math.max(0, Math.min(1, n));
    };
    const rawSigned = (v, d) => {
      const n = Number(v);
      if (!isFinite(n)) return d;
      return Math.max(-127, Math.min(127, Math.round(n)));
    };
    const phaseKey = (v) => {
      if (typeof v !== 'string') return undefined;
      const lc = v.toLowerCase().trim();
      if (!lc) return undefined;
      return lc;
    };
    out.emitTemp      = raw255(raw && raw.emitTemp,      defaults.emitTemp);
    out.ignitionPoint = raw255(raw && raw.ignitionPoint, defaults.ignitionPoint);
    out.flammability  = raw01 (raw && raw.flammability,  defaults.flammability);
    out.conductivity  = raw255(raw && raw.conductivity,  defaults.conductivity);
    out.corrosivity   = raw255(raw && raw.corrosivity,   defaults.corrosivity);
    out.hardness      = raw255(raw && raw.hardness,      defaults.hardness);

    // Phase
    const meltAt = raw255(raw && raw.meltingPoint,  0);
    const boilAt = raw255(raw && raw.boilingPoint,  0);
    const freezeAt = raw255(raw && raw.freezingPoint, 0);
    const meltTo   = phaseKey(raw && raw.meltsTo);
    const boilTo   = phaseKey(raw && raw.boilsTo);
    const freezeTo = phaseKey(raw && raw.freezesTo);
    if (meltAt > 0 && meltTo)     { out.meltingPoint = meltAt;     out.meltsTo = meltTo; }
    if (boilAt > 0 && boilTo)     { out.boilingPoint = boilAt;     out.boilsTo = boilTo; }
    if (freezeAt > 0 && freezeTo) { out.freezingPoint = freezeAt;  out.freezesTo = freezeTo; }

    // Charge
    const conducts = (raw && typeof raw.conducts === 'boolean') ? raw.conducts
                   : (preferHint && hint && typeof hint.conducts === 'boolean') ? hint.conducts
                   : (defaults.conducts || false);
    if (conducts) out.conducts = true;
    if (raw && typeof raw.chargeEmit === 'number') out.chargeEmit = rawSigned(raw.chargeEmit, 0);
    else if (preferHint && hint && typeof hint.chargeEmit === 'number') out.chargeEmit = rawSigned(hint.chargeEmit, 0);
    else if (defaults.chargeEmit) out.chargeEmit = rawSigned(defaults.chargeEmit, 0);
    if (raw && typeof raw.ignitesAtCharge === 'number') out.ignitesAtCharge = raw255(raw.ignitesAtCharge, 0);
    else if (preferHint && hint && typeof hint.ignitesAtCharge === 'number') out.ignitesAtCharge = raw255(hint.ignitesAtCharge, 0);
    else if (defaults.ignitesAtCharge) out.ignitesAtCharge = raw255(defaults.ignitesAtCharge, 0);

    // Airflow
    if (raw && typeof raw.airflowFactor === 'number') out.airflowFactor = raw01(raw.airflowFactor, 0);
    else if (preferHint && hint && typeof hint.airflowFactor === 'number') out.airflowFactor = raw01(hint.airflowFactor, 0);
    else if (defaults.airflowFactor) out.airflowFactor = raw01(defaults.airflowFactor, 0);
    if (raw && raw.emitsAirflow && typeof raw.emitsAirflow === 'object') {
      const vx = rawSigned(raw.emitsAirflow.vx, 0);
      const vy = rawSigned(raw.emitsAirflow.vy, 0);
      if (vx || vy) out.emitsAirflow = { vx: Math.max(-8, Math.min(8, vx)), vy: Math.max(-8, Math.min(8, vy)) };
    } else if (preferHint && hint && hint.emitsAirflow) {
      out.emitsAirflow = hint.emitsAirflow;
    }
    if (raw && typeof raw.pressureBlast === 'number') {
      out.pressureBlast = raw255(raw.pressureBlast, 0);
      if (typeof raw.pressureBlastTo === 'string') out.pressureBlastTo = raw.pressureBlastTo.toLowerCase();
    } else if (preferHint && hint && hint.pressureBlast) {
      out.pressureBlast = hint.pressureBlast;
    }

    // Registers
    if (raw && typeof raw.raInit === 'number')          out.raInit = raw255(raw.raInit, 0);
    else if (preferHint && hint && typeof hint.raInit === 'number') out.raInit = raw255(hint.raInit, 0);
    if (raw && typeof raw.raDelta === 'number')         out.raDelta = rawSigned(raw.raDelta, 0);
    else if (preferHint && hint && typeof hint.raDelta === 'number') out.raDelta = rawSigned(hint.raDelta, 0);
    if (raw && typeof raw.raDiesAt === 'number')        out.raDiesAt = raw255(raw.raDiesAt, 0);
    if (raw && typeof raw.raTransformsTo === 'string')  out.raTransformsTo = raw.raTransformsTo.toLowerCase();
    else if (preferHint && hint && typeof hint.raTransformsTo === 'string') out.raTransformsTo = hint.raTransformsTo;
  }

  function traitDefaultsForName(key, kind) {
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    if (has('fire','flame','inferno','ember','plasma','spark','lightning','arc'))
      return { emitTemp: 240, ignitionPoint: 255, flammability: 0, conductivity: 220, corrosivity: 40, hardness: 0, airflowFactor: 0.5, conducts: has('lightning','arc','plasma'), chargeEmit: has('lightning','arc') ? 110 : 0 };
    if (has('lava','magma'))
      return { emitTemp: 210, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 80, hardness: 30 };
    if (has('mercury','quicksilver'))
      return { emitTemp: 30, ignitionPoint: 255, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 0, conducts: true };
    if (has('steam'))
      return { emitTemp: 130, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0, airflowFactor: 0.8 };
    if (has('smoke','fog','mist','vapor','cloud','haze'))
      return { emitTemp: 70, ignitionPoint: 255, flammability: 0, conductivity: 200, corrosivity: 0, hardness: 0, airflowFactor: 0.7 };
    if (has('balloon','helium','bubble'))
      return { emitTemp: 30, ignitionPoint: 90, flammability: 0.30, conductivity: 80, corrosivity: 0, hardness: 0, airflowFactor: 0.9, pressureBlast: 180 };
    if (has('ice','icicle','glacier','snow'))
      return { emitTemp: 10, ignitionPoint: 255, flammability: 0, conductivity: 160, corrosivity: 0, hardness: 60 };
    if (has('water','juice','milk','wine','soda'))
      return { emitTemp: 25, ignitionPoint: 255, flammability: 0, conductivity: 140, corrosivity: 0, hardness: 0 };
    if (has('oil','gasoline','petrol','fuel'))
      return { emitTemp: 30, ignitionPoint: 100, flammability: 0.20, conductivity: 90, corrosivity: 0, hardness: 0 };
    if (has('acid'))
      return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 110, corrosivity: 200, hardness: 0 };
    if (has('honey','syrup','molasses','caramel'))
      return { emitTemp: 30, ignitionPoint: 180, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 0 };
    if (has('tar','pitch','glue','resin'))
      return { emitTemp: 30, ignitionPoint: 130, flammability: 0.10, conductivity: 60, corrosivity: 0, hardness: 0 };
    if (has('blood'))
      return { emitTemp: 38, ignitionPoint: 200, flammability: 0, conductivity: 130, corrosivity: 0, hardness: 0 };
    if (has('slime','goo','ooze'))
      return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 90, corrosivity: 0, hardness: 0 };
    if (has('plant','leaf','vine','tree','grass','moss'))
      return { emitTemp: 30, ignitionPoint: 120, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 40 };
    if (has('wood','timber','log','bark','twig','plank'))
      return { emitTemp: 30, ignitionPoint: 140, flammability: 0.04, conductivity: 40, corrosivity: 0, hardness: 100 };
    if (has('paper','cardboard','parchment'))
      return { emitTemp: 30, ignitionPoint: 110, flammability: 0.25, conductivity: 50, corrosivity: 0, hardness: 20 };
    if (has('battery'))
      return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 160, conducts: true, chargeEmit: 120 };
    if (has('wire','cable','circuit'))
      return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 100, conducts: true };
    if (has('copper','brass'))
      return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 140, conducts: true };
    if (has('metal','iron','steel','aluminum','tin'))
      return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 240, corrosivity: 0, hardness: 240, conducts: true };
    if (has('gold','silver'))
      return { emitTemp: 30, ignitionPoint: 250, flammability: 0, conductivity: 250, corrosivity: 0, hardness: 200, conducts: true };
    if (has('diamond','gem'))
      return { emitTemp: 30, ignitionPoint: 250, flammability: 0, conductivity: 220, corrosivity: 0, hardness: 255 };
    if (has('crystal','glass'))
      return { emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 120, corrosivity: 0, hardness: 180 };
    if (has('rock','stone','brick','concrete','bedrock','marble','granite'))
      return { emitTemp: 30, ignitionPoint: 240, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 200 };
    if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'))
      return { emitTemp: 30, ignitionPoint: 100, flammability: 0.30, conductivity: 90, corrosivity: 0, hardness: 30, ignitesAtCharge: 30 };
    if (has('gunpowder')||has('gun-powder'))
      return { emitTemp: 30, ignitionPoint: 90, flammability: 0.50, conductivity: 80, corrosivity: 0, hardness: 20, ignitesAtCharge: 20 };
    if (has('ash','soot','cinder'))
      return { emitTemp: 50, ignitionPoint: 255, flammability: 0, conductivity: 60, corrosivity: 0, hardness: 30, airflowFactor: 0.7 };
    if (has('mold','fungus','mycelium','lichen','coral','slime-mold'))
      return { emitTemp: 30, ignitionPoint: 150, flammability: 0.06, conductivity: 70, corrosivity: 0, hardness: 50 };
    if (has('uranium','plutonium','radio'))
      return { emitTemp: 110, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 30, hardness: 180, raInit: 250, raDelta: -1, raTransformsTo: 'stone' };
    if (has('fan','vent','jet'))
      return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 120 };
    if (kind === 'gas')      return { emitTemp: 60, ignitionPoint: 255, flammability: 0, conductivity: 180, corrosivity: 0, hardness: 0, airflowFactor: 0.7 };
    if (kind === 'liquid')   return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 130, corrosivity: 0, hardness: 0 };
    if (kind === 'powder')   return { emitTemp: 30, ignitionPoint: 200, flammability: 0, conductivity: 90,  corrosivity: 0, hardness: 60 };
    if (kind === 'cellular') return { emitTemp: 30, ignitionPoint: 160, flammability: 0.05, conductivity: 70, corrosivity: 0, hardness: 50 };
    return { emitTemp: 30, ignitionPoint: 220, flammability: 0, conductivity: 100, corrosivity: 0, hardness: 180 };
  }

  function isHex(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }

  function fillFallbackColors(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const out = [];
    for (let i = 0; i < 5; i++) {
      const hh = (hue + i * 12) % 360;
      const ll = 38 + i * 6;
      out.push(hslToHex(hh, 55, ll));
    }
    return out;
  }

  function canonicalPaletteFromName(key) {
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    if (has('fire','flame','inferno','ember','plasma','spark')) return ['#ff4020','#ff8010','#ffc040','#ffe070'];
    if (has('lightning','arc')) return ['#fff8e0','#a0d0ff','#ffffff','#80b0ff'];
    if (has('lava','magma')) return ['#ff5020','#ff8030','#d03010','#ffc040'];
    if (has('steam')) return ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'];
    if (has('smoke')) return ['#606060','#808080','#4a4a4a','#a0a0a0'];
    if (has('fog','mist','vapor','cloud','haze')) return ['#a0b8c8','#c0d0dc','#7890a0','#90a8b8'];
    if (has('balloon','helium','bubble')) return ['#e84060','#d03050','#ff6080','#a02040'];
    if (has('honey','syrup','molasses','caramel')) return ['#e8a030','#d48020','#ffc050','#b86020'];
    if (has('tar','pitch','glue','resin')) return ['#1a1008','#2a1810','#3a2418','#1f1410'];
    if (has('acid')) return ['#60ff30','#80ff40','#30d020','#b0ff60'];
    if (has('oil','gasoline','petrol','fuel')) return ['#2a1010','#4a2810','#1a0808','#603020'];
    if (has('mercury','quicksilver')) return ['#c0c0d0','#a0a0b8','#d8d8e0','#909098'];
    if (has('slime','goo','ooze')) return ['#60c060','#40a040','#80d080','#509050'];
    if (has('blood')) return ['#a02020','#801010','#c03030','#600808'];
    if (has('snow')) return ['#ffffff','#e8f0ff','#d0e0f0','#fafcff'];
    if (has('ash','soot','cinder')) return ['#505050','#707070','#3a3a3a','#606060'];
    if (has('gunpowder')||has('gun-powder')) return ['#2a2a2a','#404040','#1a1a1a','#303030'];
    if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine')) return ['#c02020','#e03030','#ff4040','#802020'];
    if (has('ice','icicle')) return ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'];
    if (has('plant','leaf','vine','tree','grass','moss')) return ['#409040','#60a050','#308030','#80b060'];
    if (has('wood','timber','log','bark','twig','plank')) return ['#7a4820','#8a5828','#5a3010','#a06838'];
    if (has('battery')) return ['#e0c020','#a08018','#fff060','#806010'];
    if (has('copper','brass')) return ['#c87838','#a85820','#d88848','#985020'];
    if (has('metal','iron','steel','aluminum','tin')) return ['#9a9a9a','#b0b0b0','#707070','#c8c8c8'];
    if (has('gold')) return ['#e0c040','#c8a830','#fff060','#b08820'];
    if (has('silver')) return ['#d0d0e0','#b0b0c0','#e8e8f0','#909098'];
    if (has('uranium','plutonium','radio')) return ['#80b020','#608018','#a0d040','#506010'];
    if (has('fan','vent','jet')) return ['#506070','#3a4858','#607888','#404a55'];
    if (has('mold','fungus','mycelium','lichen','coral','slime-mold')) return ['#304820','#405830','#50682a','#2a3818'];
    if (has('conway','automaton','life')) return ['#40e080','#30c060','#60f090','#20a050'];
    return null;
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const col = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * col).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function fallbackSpec(displayName, key, desc) {
    const kind = kindOverrideFromName(key, desc) || 'powder';
    const hint = namePropertyHints(key) || {};
    const out = {
      id: nextCustomId(), key,
      displayName: displayName.slice(0, 14).toLowerCase(),
      kind,
      density: hint.density || (kind === 'gas' ? 2 : kind === 'liquid' ? 5 : 4),
      colors: canonicalPaletteFromName(key) || fillFallbackColors(key),
      reactions: [],
      isBuiltIn: false, userDesc: desc || '',
    };
    if (kind === 'liquid') { out.viscosity = hint.viscosity || 0; out.stickiness = hint.stickiness || 0; }
    if (kind === 'powder') { out.flow = hint.flow || 0.55; out.stickiness = hint.stickiness || 0; }
    if (kind === 'gas')    { out.buoyancy = hint.buoyancy || 0.9; out.lifeMin = hint.lifeMin || 60; out.lifeMax = hint.lifeMax || 100; }
    if (kind === 'cellular') { out.born = [3]; out.survive = [2,3]; out.cellularTick = 6; out.growChance = 0.4; out.surviveChance = 0.94; }
    applyTraits(out, null, key, desc, hint, true);
    return out;
  }





})();
