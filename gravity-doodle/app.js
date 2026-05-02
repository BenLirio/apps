// Gravity Doodle — GPU-accelerated falling-sand sandbox.
//
// MILESTONE 1 (this file): the simulation runs on the GPU via WebGL2 fragment
// shaders. A 2×2 Margolus block cellular automaton handles falling/sinking
// for powders and liquids. Painting, pours, and clears are also shader passes,
// so the CPU never touches the simulation grid.
//
// What works in milestone 1:
//   • static (walls, ice, plant)
//   • powder (sand, salt, snow, gunpowder)
//   • liquid (water, oil, honey, acid) — with viscosity & density swaps
//
// Stubbed for milestone 2+ (will be added in follow-up commits):
//   • gas (smoke rises) — currently renders but doesn't move
//   • cellular (plant growth, mold) — currently renders but doesn't grow
//   • reactions (acid eats walls, fire ignites oil)
//   • explosions, sparks, flying debris
//
// AI invention still works; invented elements register with their full trait
// spec, but only static/powder/liquid behave correctly until milestone 2.

(function () {
  // ── Constants ──────────────────────────────────────────────────────────────
  const CELL = 3;
  const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
  const FEEDBACK_ENDPOINT = 'https://5c99bazuj0.execute-api.us-east-1.amazonaws.com/feedback';
  const SLUG = 'gravity-doodle';

  const EMPTY = 0;

  // Element kind packed into the lookup texture's R channel.
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
    }
  }

  function nextCustomId() { return nextId++; }

  // ── Built-in seed elements ─────────────────────────────────────────────────
  const WALL_ID      = 1;
  const SAND_ID      = 2;
  const WATER_ID     = 3;
  const EXPLOSIVE_ID = 4;
  const SMOKE_ID     = 5;
  const PLANT_ID     = 6;

  const SAND_PALETTE = ['#e8a030', '#d89028', '#f0b848', '#e8a838'];

  // Trait scale convention (all 0..255 for cheap shader packing later):
  //   emitTemp:      ambient temperature this element radiates. 0=ambient (~30),
  //                  fire/lava ~220, ice/snow ~10. Drives heat propagation.
  //   ignitionPoint: temperature above which the element catches fire. 0..255.
  //   flammability:  per-frame chance × 255 of igniting once above ignitionPoint.
  //   conductivity:  how fast heat diffuses to neighbors (0=insulator, 255=metal).
  //   corrosivity:   strength as a corrosive agent (acid 200, water 0).
  //   hardness:      resistance to corrosion / eating (wall 200, sand 60).
  // The current physics engine still uses explicit reactions, but registering
  // these traits puts the data in place and gives the AI a richer vocabulary.
  // A future commit will replace the reaction lookup with a trait-driven
  // pass (heat diffusion → ignition → corrosion → phase change).
  function initBuiltIns() {
    registry[WALL_ID]      = { id: WALL_ID,      key: 'wall',      displayName: 'wall',      kind: 'static', density: 10, colors: ['#d8c8a0', '#c8b890', '#b8a880', '#c0c090'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0,    conductivity: 60,  corrosivity: 0,   hardness: 200 };
    registry[SAND_ID]      = { id: SAND_ID,      key: 'sand',      displayName: 'sand',      kind: 'powder', density: 5, flow: 0.55, stickiness: 0, colors: SAND_PALETTE, isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 255, flammability: 0,    conductivity: 80,  corrosivity: 0,   hardness: 60 };
    registry[WATER_ID]     = { id: WATER_ID,     key: 'water',     displayName: 'water',     kind: 'liquid', density: 5, viscosity: 0, stickiness: 0, colors: ['#4aa8d8', '#3e9ac8', '#62b8e0', '#2e84b8'], isBuiltIn: true, reactions: [],
      emitTemp: 25, ignitionPoint: 255, flammability: 0,    conductivity: 140, corrosivity: 0,   hardness: 0 };
    registry[EXPLOSIVE_ID] = { id: EXPLOSIVE_ID, key: 'explosive', displayName: 'explosive', kind: 'powder', density: 4, flow: 0.45, stickiness: 0, colors: ['#e02020', '#ff3030', '#c01010', '#ff5040'], isBuiltIn: true, isExplosive: true, explosionRadius: 5, explosionPower: 0.9, reactions: [],
      emitTemp: 30, ignitionPoint: 100, flammability: 0.30, conductivity: 90,  corrosivity: 0,   hardness: 30 };
    registry[SMOKE_ID]     = { id: SMOKE_ID,     key: 'smoke',     displayName: 'smoke',     kind: 'gas',    density: 2, buoyancy: 0.6, lifeMin: 90, lifeMax: 180, colors: ['#9a9a9a', '#aaaaaa', '#888888', '#bbbbbb'], isBuiltIn: true, reactions: [],
      emitTemp: 70, ignitionPoint: 255, flammability: 0,    conductivity: 200, corrosivity: 0,   hardness: 0 };
    registry[PLANT_ID]     = { id: PLANT_ID,     key: 'plant',     displayName: 'plant',     kind: 'cellular', density: 3, born: [2,3], survive: [0,1,2,3,4,5,6,7,8], cellularTick: 14, growChance: 0.10, surviveChance: 1, birthFrom: ['wall'], colors: ['#3aa040', '#2c8c34', '#4cb854', '#226c2a'], isBuiltIn: true, reactions: [],
      emitTemp: 30, ignitionPoint: 120, flammability: 0.05, conductivity: 70,  corrosivity: 0,   hardness: 40 };
    keyToId.wall = WALL_ID;
    keyToId.sand = SAND_ID;
    keyToId.water = WATER_ID;
    keyToId.explosive = EXPLOSIVE_ID;
    keyToId.smoke = SMOKE_ID;
    keyToId.plant = PLANT_ID;
    nextId = PLANT_ID + 1;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let canvas;
  let gl;
  let COLS, ROWS;

  // GPU resources
  let stateTexA = null, stateTexB = null;     // ping-pong RGBA8UI grids
  let stateFboA = null, stateFboB = null;
  let tempTexA = null, tempTexB = null;       // ping-pong RGBA8UI temperature (R=temp)
  let tempFboA = null, tempFboB = null;
  let elementDataTex = null;                   // 256x1 RGBA8UI: kind, density, paramA, paramB
  let paletteTex = null;                       // 256x4 RGBA8: 4 color variants per element
  let reactionsTex = null;                     // 256x3 RGBA8UI: per-id reaction slots
  let traitsTex = null;                        // 256x2 RGBA8UI: per-id trait slots
  let cellularDataTex = null;                  // 256x2 RGBA8UI: per-id cellular CA params
  let progSim = null, progPaint = null, progRender = null, progClear = null, progReact = null;
  let progContact = null, progBlast = null;
  let progHeat = null, progIgnition = null, progCellular = null;
  let quadVao = null;
  let frameCounter = 0;
  // Settle frames live in the B channel of state texture for explosives. We
  // decrement them in the sim shader.

  let selectedKey = 'wall';
  let isPointerDown = false;
  let lastCell = null;
  let lastPointer = null;
  let holdPaintTimer = null;
  let animId = null;

  // Pours: each entry is { id, kind, frames, total }. Top-row spawns each frame.
  let pours = [];

  // ── Init ───────────────────────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('main-canvas');
    gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      showOverlay('this browser doesn\'t support webgl2.\ntry a recent chrome/firefox/safari.');
      return;
    }

    initBuiltIns();
    initGL();

    rebuildPalette();

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

    showOverlay('paint walls or any element on the canvas.\npour sand or water from the top.\n\npaint smoke (rises) or invent fire\nwith the +invent button.');
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
    initGrid();
  }

  function initGrid() {
    if (!gl) return;
    // Allocate ping-pong RGBA8UI textures sized COLS x ROWS.
    if (stateTexA) gl.deleteTexture(stateTexA);
    if (stateTexB) gl.deleteTexture(stateTexB);
    if (stateFboA) gl.deleteFramebuffer(stateFboA);
    if (stateFboB) gl.deleteFramebuffer(stateFboB);
    if (tempTexA)  gl.deleteTexture(tempTexA);
    if (tempTexB)  gl.deleteTexture(tempTexB);
    if (tempFboA)  gl.deleteFramebuffer(tempFboA);
    if (tempFboB)  gl.deleteFramebuffer(tempFboB);

    stateTexA = createUI8Texture(COLS, ROWS);
    stateTexB = createUI8Texture(COLS, ROWS);
    stateFboA = makeFbo(stateTexA);
    stateFboB = makeFbo(stateTexB);

    tempTexA = createUI8Texture(COLS, ROWS);
    tempTexB = createUI8Texture(COLS, ROWS);
    tempFboA = makeFbo(tempTexA);
    tempFboB = makeFbo(tempTexB);

    // Clear state to empty, temperature to ambient (30).
    clearStateTo(stateFboA, 0, 0, 0, 0);
    clearStateTo(stateFboB, 0, 0, 0, 0);
    clearStateTo(tempFboA, 30, 0, 0, 0);
    clearStateTo(tempFboB, 30, 0, 0, 0);
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

  function clearStateTo(fbo, r, g, b, a) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, COLS, ROWS);
    // Use clear with explicit uint clear since FBO is RGBA8UI
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

  // Simulation shader: 2×2 Margolus block CA. Each block of 4 cells decides
  // its own swap independently of others. Block origin alternates per phase
  // so neighboring blocks meet over time.
  const FS_SIM = `#version 300 es
    precision highp float;
    precision highp int;

    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;     // current grid
    uniform highp usampler2D uElemData;  // 256x1: (kind, density, paramA, paramB)
    uniform int uPhase;                  // 0..3 — block-origin offset selector
    uniform int uFrame;                  // monotonically increasing
    uniform ivec2 uSize;                 // grid (COLS, ROWS)

    // Hash for stochastic decisions in the block. Cheap but well-mixed.
    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }
    float rand01(uvec3 v) { return float(hash3(v) & 0xFFFFFFu) / float(0x1000000u); }

    struct Cell { uint id; uint variant; uint settle; uint life; };
    Cell readCell(ivec2 p) {
      uvec4 c = texelFetch(uState, p, 0);
      return Cell(c.r, c.g, c.b, c.a);
    }
    uvec4 packCell(Cell c) { return uvec4(c.id, c.variant, c.settle, c.life); }
    Cell empty() { return Cell(0u, 0u, 0u, 0u); }

    struct ElemInfo { uint kind; uint density; uint paramA; uint paramB; };
    ElemInfo getInfo(uint id) {
      uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
      return ElemInfo(e.r, e.g, e.b, e.a);
    }

    // Whether top should sink into / displace bot.
    bool wantsSink(Cell top, Cell bot) {
      if (top.id == 0u) return false;
      ElemInfo ti = getInfo(top.id);
      // Only powders and liquids fall.
      if (ti.kind != 2u && ti.kind != 3u) return false;
      if (bot.id == 0u) return true;
      ElemInfo bi = getInfo(bot.id);
      // Powders/liquids can sink through liquids of lower density.
      // Powders/liquids sink through liquids of equal-or-lower density,
      // but never through the same liquid (would just flicker variants).
      if (bi.kind == 3u && top.id != bot.id && ti.density >= bi.density) return true;
      return false;
    }

    bool isLiquid(Cell c) {
      if (c.id == 0u) return false;
      return getInfo(c.id).kind == 3u;
    }
    bool isGas(Cell c) {
      if (c.id == 0u) return false;
      return getInfo(c.id).kind == 4u;
    }

    // Tick auxiliary state per frame: decrement explosive settle frames and
    // tick gas life. When life hits zero the cell evaporates. Only called in
    // phase 0 so each tick = one real frame, not 4× per frame.
    Cell tickAux(Cell c, bool doTick) {
      if (!doTick) return c;
      if (c.id == 0u) return c;
      if (c.settle > 0u) c.settle = c.settle - 1u;
      ElemInfo info = getInfo(c.id);
      if (info.kind == 4u && c.life > 0u) {
        c.life = c.life - 1u;
        if (c.life == 0u) c = Cell(0u, 0u, 0u, 0u);
      }
      return c;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      // GL fragments use y-up; we map fragment y directly into texture y.
      // "Down" in gameplay = decreasing fragment y, "up" = increasing y.

      bool isPhase0 = (uPhase == 0);

      // Phase chooses a 2×2 block origin offset. We rotate through
      // (0,0),(1,1),(0,1),(1,0) for full coverage.
      ivec2 off;
      if (uPhase == 0) off = ivec2(0, 0);
      else if (uPhase == 1) off = ivec2(1, 1);
      else if (uPhase == 2) off = ivec2(1, 0);
      else off = ivec2(0, 1);

      // Top-row gas escape: cells at the top edge (highest fragment y) evaporate
      // if they're gas. Mirrors the CPU sim's open-sky-at-top rule.
      if (px.y == uSize.y - 1) {
        Cell self = tickAux(readCell(px), isPhase0);
        if (isGas(self)) self = Cell(0u, 0u, 0u, 0u);
        outColor = packCell(self);
        return;
      }

      // Block origin (lower-left of the 2×2)
      ivec2 rel = px - off;
      ivec2 blockOrigin = (rel / 2) * 2 + off;
      ivec2 local = px - blockOrigin;

      // Edge handling: if block goes out of bounds, pass cell through unchanged
      // (apart from aux tick).
      if (local.x < 0 || local.y < 0 ||
          blockOrigin.x < 0 || blockOrigin.y < 0 ||
          blockOrigin.x + 1 >= uSize.x || blockOrigin.y + 1 >= uSize.y) {
        outColor = packCell(tickAux(readCell(px), isPhase0));
        return;
      }

      // Read 4 cells of the block. (BL=lower-left, TL=upper-left, etc.)
      Cell bl = readCell(blockOrigin + ivec2(0,0));
      Cell br = readCell(blockOrigin + ivec2(1,0));
      Cell tl = readCell(blockOrigin + ivec2(0,1));
      Cell tr = readCell(blockOrigin + ivec2(1,1));

      // Tick aux on all four cells (only fires in phase 0).
      bl = tickAux(bl, isPhase0); br = tickAux(br, isPhase0);
      tl = tickAux(tl, isPhase0); tr = tickAux(tr, isPhase0);

      // Decide swaps. We process gravity (top→bottom) then sideways (liquid),
      // then gas rising (bottom→top).
      // 1) Direct fall: TL→BL, TR→BR
      if (wantsSink(tl, bl)) { Cell t = tl; tl = bl; bl = t; }
      if (wantsSink(tr, br)) { Cell t = tr; tr = br; br = t; }

      // 2) Diagonal slide: TL→BR or TR→BL (after direct fall)
      float r = rand01(uvec3(uint(blockOrigin.x), uint(blockOrigin.y), uint(uFrame)));
      bool preferLeft = r < 0.5;
      if (preferLeft) {
        if (wantsSink(tl, br)) { Cell t = tl; tl = br; br = t; }
        if (wantsSink(tr, bl)) { Cell t = tr; tr = bl; bl = t; }
      } else {
        if (wantsSink(tr, bl)) { Cell t = tr; tr = bl; bl = t; }
        if (wantsSink(tl, br)) { Cell t = tl; tl = br; br = t; }
      }

      // 3) Liquid sideways flow on the bottom row.
      if (isLiquid(bl) && br.id == 0u && r >= 0.5) {
        Cell t = bl; bl = br; br = t;
      } else if (isLiquid(br) && bl.id == 0u && r < 0.5) {
        Cell t = br; br = bl; bl = t;
      }
      // 3b) Liquid sideways flow on the top row.
      float r2 = rand01(uvec3(uint(blockOrigin.x), uint(blockOrigin.y) + 7919u, uint(uFrame)));
      if (isLiquid(tl) && tr.id == 0u && r2 >= 0.5) {
        Cell t = tl; tl = tr; tr = t;
      } else if (isLiquid(tr) && tl.id == 0u && r2 < 0.5) {
        Cell t = tr; tr = tl; tl = t;
      }

      // 4) Gas rising: BL→TL, BR→TR if buoyancy roll passes. Gas in TL/TR
      // also rises into a TL/TR... wait no — those are already at top of
      // block. We rely on the next phase's offset to put TL into a BL slot
      // of the block above. Buoyancy = paramA scaled to [0,1].
      float rGas = rand01(uvec3(uint(blockOrigin.x) + 1234u, uint(blockOrigin.y) + 5678u, uint(uFrame)));
      // BL gas rises into empty TL.
      if (isGas(bl) && tl.id == 0u) {
        float buoy = float(getInfo(bl.id).paramA) / 255.0;
        if (rGas < buoy) { Cell t = bl; bl = tl; tl = t; }
      }
      // BR gas rises into empty TR (use a separate slice of the random).
      float rGas2 = rand01(uvec3(uint(blockOrigin.x) + 4321u, uint(blockOrigin.y) + 8765u, uint(uFrame)));
      if (isGas(br) && tr.id == 0u) {
        float buoy = float(getInfo(br.id).paramA) / 255.0;
        if (rGas2 < buoy) { Cell t = br; br = tr; tr = t; }
      }
      // Diagonal rise: BL→TR or BR→TL when direct rise is blocked.
      if (isGas(bl) && tl.id != 0u && tr.id == 0u) {
        float buoy = float(getInfo(bl.id).paramA) / 255.0;
        if (rGas < buoy * 0.5) { Cell t = bl; bl = tr; tr = t; }
      }
      if (isGas(br) && tr.id != 0u && tl.id == 0u) {
        float buoy = float(getInfo(br.id).paramA) / 255.0;
        if (rGas2 < buoy * 0.5) { Cell t = br; br = tl; tl = t; }
      }

      // Output the cell at this fragment's local block position.
      Cell outc;
      if (local == ivec2(0, 0))      outc = bl;
      else if (local == ivec2(1, 0)) outc = br;
      else if (local == ivec2(0, 1)) outc = tl;
      else                            outc = tr;

      outColor = packCell(outc);
    }
  `;

  // Paint shader: writes a circular brush of `id` (with random color variant
  // per cell) into the state. Reads existing state so we can avoid overwriting
  // walls/dynamic cells with rules matching the original CPU paintAt.
  const FS_PAINT = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform ivec2 uSize;
    uniform ivec2 uCenter;       // brush center in fragment coords
    uniform int uRadius;         // brush radius in cells (squared check)
    uniform uint uPaintId;       // element id to paint (0 = erase)
    uniform uint uVariantSeed;   // varies per frame so painted cells aren't all the same color
    uniform uint uSettleFrames;  // settle frames to set on freshly-painted cells
    uniform uint uLifeFrames;    // life frames (gas decay)
    uniform uint uPaintKind;     // kind of the element being painted

    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 cur = texelFetch(uState, px, 0);
      ivec2 d = px - uCenter;
      int dist2 = d.x * d.x + d.y * d.y;

      if (dist2 > uRadius * uRadius) {
        outColor = cur;
        return;
      }
      if (uPaintId == 0u) {
        outColor = uvec4(0u);
        return;
      }
      // Don't overwrite non-empty same-or-different dynamic cells with non-static.
      // Static elements (walls) overwrite anything.
      if (uPaintKind != 1u) {
        if (cur.r != 0u && cur.r != uPaintId) {
          outColor = cur;
          return;
        }
      }
      uint v = hash3(uvec3(uint(px.x), uint(px.y), uVariantSeed)) & 3u;
      outColor = uvec4(uPaintId, v, uSettleFrames, uLifeFrames);
    }
  `;

  // Render shader: read state, look up palette, output regular RGB.
  const FS_RENDER = `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 vUv;
    out vec4 outColor;

    uniform highp usampler2D uState;
    uniform sampler2D uPalette;   // 256x4 RGBA8, srgb-ish
    uniform ivec2 uSize;

    void main() {
      ivec2 px = ivec2(vUv * vec2(uSize));
      px = clamp(px, ivec2(0), uSize - ivec2(1));
      uvec4 c = texelFetch(uState, px, 0);
      if (c.r == 0u) {
        outColor = vec4(0.059, 0.055, 0.047, 1.0); // app bg #0f0e0c
        return;
      }
      vec3 rgb = texelFetch(uPalette, ivec2(int(c.r), int(c.g & 3u)), 0).rgb;
      outColor = vec4(rgb, 1.0);
    }
  `;

  // Clear shader (for clearAll): writes empty.
  const FS_CLEAR = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    void main() { outColor = uvec4(0u); }
  `;

  // Explosive contact shader: an explosive cell with settle==0 that touches
  // any non-explosive non-empty neighbor gets primed (life=255). Primed cells
  // will detonate in the next pass. Non-explosive cells pass through unchanged.
  // Note: explosive elements are always powders in the seed/AI data, so the life
  // channel is otherwise unused for them — safe to repurpose as the prime flag.
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
      // Already primed?
      if (self.a == 255u) { outColor = self; return; }
      // Still in settle window — immune to contact detonation.
      if (self.b > 0u) { outColor = self; return; }
      // Scan 8 neighbors for any non-empty non-explosive cell.
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

  // Blast shader: any cell within BLAST_R of a primed explosive is cleared.
  // Primed explosives clear themselves. Other explosives within radius become
  // primed too — chain reaction propagates one cell-radius per frame.
  const FS_BLAST = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uElemData;
    uniform ivec2 uSize;
    const int BLAST_R = 5;

    bool isExplosiveId(uint id) {
      if (id == 0u) return false;
      uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
      return (e.a & 0x80u) != 0u;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      bool selfExp = isExplosiveId(self.r);
      bool selfPrimed = (selfExp && self.a == 255u);

      if (selfPrimed) {
        // Detonate: vanish.
        outColor = uvec4(0u);
        return;
      }
      // Scan blast neighborhood for primed explosives.
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
      if (self.r == 0u) { outColor = self; return; }
      if (selfExp) {
        // Chain detonation: also become primed for next frame's blast.
        outColor = uvec4(self.r, self.g, self.b, 255u);
        return;
      }
      // Non-explosive: cleared by blast.
      outColor = uvec4(0u);
    }
  `;

  // Reaction shader: each cell looks at its 8 neighbors. For each neighbor's
  // reaction list, if a slot's `other` matches this cell's id and a chance
  // roll succeeds, this cell transforms to that slot's `becomes`. We also
  // check this cell's OWN reactions for self-consume rolls — if any neighbor
  // matches a self-consume reaction's `other` and both rolls succeed, this
  // cell goes empty. Each fragment writes only itself, so the "neighbor changes
  // me" inversion is the only fragment-shader-friendly formulation of the CPU
  // sim's "I change my neighbors" rule. Reactions run once per frame.
  // Heat shader: each cell's new temperature is a conductivity-weighted blend
  // of (its previous temp, the average of its 8 neighbors' temps, the trait
  // emitTemp of its element kind, and ambient 30). Hot elements force their
  // emission temp; cold elements pull toward theirs. Cells decay slightly
  // toward ambient so heat doesn't accumulate forever.
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
      // Average neighbor temperatures.
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

      // Diffusion strength scales with self's conductivity.
      TraitInfo t = (selfId == 0u) ? TraitInfo(30u, 255u, 0u, 100u, 0u, 0u) : getTraits(selfId);
      float k = float(t.conductivity) / 255.0;
      float newT = mix(curF, avg, clamp(k * 0.5, 0.0, 0.5));

      // Element-driven emission: hot/cold cells pull toward emitTemp.
      float emit = float(t.emitTemp);
      if (emit > newT) newT = mix(newT, emit, 0.30);
      else             newT = mix(newT, emit, 0.05);

      // Slow decay toward ambient (30) so transient heat dissipates.
      newT = mix(newT, 30.0, 0.015);

      uint outT = uint(clamp(newT, 0.0, 255.0));
      outColor = uvec4(outT, 0u, 0u, 0u);
    }
  `;

  // Ignition shader: cells with non-zero flammability whose temperature is
  // above their ignitionPoint roll a per-frame chance (= flammability/255)
  // and convert to fire (if a "fire" element is registered) or to empty.
  // Ignition-prone cells write themselves out as the "fire" id passed via
  // uniform; non-ignitable cells pass through unchanged.
  const FS_IGNITION = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uTemp;
    uniform highp usampler2D uTraits;
    uniform ivec2 uSize;
    uniform int uFrame;
    uniform uint uFireId;   // id to convert to when igniting; 0 = vanish

    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }
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
      uvec4 self = texelFetch(uState, px, 0);
      if (self.r == 0u) { outColor = self; return; }
      TraitInfo t = getTraits(self.r);
      if (t.flammability == 0u) { outColor = self; return; }
      uint temp = texelFetch(uTemp, px, 0).r;
      if (temp < t.ignitionPoint) { outColor = self; return; }
      // Roll
      uint h = hash3(uvec3(uint(px.x) * 1009u + 7u,
                           uint(px.y) * 31u  + 13u,
                           uint(uFrame) * 41u + 3u));
      if ((h & 0xFFu) >= t.flammability) { outColor = self; return; }
      // Ignite: become fire if registered, else vanish.
      if (uFireId == 0u) {
        outColor = uvec4(0u);
      } else {
        uint v = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 1234u)) & 3u;
        outColor = uvec4(uFireId, v, 0u, 0u);
      }
    }
  `;

  // Cellular CA shader. Run once per frame per cellular element (gated by
  // cellularTick on the JS side). For each cell, count neighbors that match
  // the cellular id OR any of its birthFrom ids. If the cell is the cellular
  // id, apply survive rule with surviveChance gate. If empty, apply born
  // rule with growChance gate. Other cells pass through unchanged.
  const FS_CELLULAR = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;
    uniform highp usampler2D uState;
    uniform highp usampler2D uCellularData;  // 256x2: row0=(bornLo,surviveLo,growChance,surviveChance), row1=(extras,bF0,bF1,bF2)
    uniform ivec2 uSize;
    uniform uint uCellularId;
    uniform int uFrame;

    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 self = texelFetch(uState, px, 0);
      bool selfIsThis  = (self.r == uCellularId);
      bool selfIsEmpty = (self.r == 0u);
      if (!selfIsThis && !selfIsEmpty) { outColor = self; return; }

      // Decode cellular params for uCellularId.
      uvec4 cd0 = texelFetch(uCellularData, ivec2(int(uCellularId), 0), 0);
      uvec4 cd1 = texelFetch(uCellularData, ivec2(int(uCellularId), 1), 0);
      uint bornMask    = cd0.r | ((cd1.r & 1u) << 8);
      uint surviveMask = cd0.g | ((cd1.r & 2u) << 7);
      uint growChance  = cd0.b;
      uint survChance  = cd0.a;
      uint bF0 = cd1.g;
      uint bF1 = cd1.b;
      uint bF2 = cd1.a;

      // Count neighbors that count as "alive" for this cellular element.
      uint nCount = 0u;
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
          }
        }
      }
      if (nCount > 8u) nCount = 8u;
      uint maskBit = 1u << nCount;

      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));
      if (selfIsThis) {
        bool survives = (surviveMask & maskBit) != 0u;
        if (!survives) {
          // Stochastic death gate: surviveChance = chance to escape death.
          uint h2 = (h >> 8) & 0xFFu;
          if (h2 >= survChance) { outColor = uvec4(0u); return; }
        }
        outColor = self;
        return;
      }
      // self is empty: maybe birth.
      if ((bornMask & maskBit) != 0u) {
        uint h3 = h & 0xFFu;
        if (h3 < growChance) {
          uint v = (h >> 16) & 3u;
          outColor = uvec4(uCellularId, v, 0u, 0u);
          return;
        }
      }
      outColor = self;
    }
  `;

  const FS_REACT = `#version 300 es
    precision highp float; precision highp int;
    in vec2 vUv;
    out uvec4 outColor;

    uniform highp usampler2D uState;
    uniform highp usampler2D uReactions;  // 256 wide × 3 tall, per-id reaction slots
    uniform ivec2 uSize;
    uniform int uFrame;

    uint hash3(uvec3 v) {
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= (v >> 16u);
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return v.x;
    }

    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      uvec4 selfCell = texelFetch(uState, px, 0);
      uint selfId = selfCell.r;

      // Read all 8 neighbors (clamped to edges by texture wrap mode).
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

      // 1) Inverse pass: did a neighbor's reaction transform me?
      // If selfId == 0, skip (empty cells aren't transformed by reactions).
      uint newId = selfId;
      uvec4 newCell = selfCell;
      bool transformed = false;

      if (selfId != 0u) {
        for (int i = 0; i < 8 && !transformed; i++) {
          uint nid = nIds[i];
          if (nid == 0u) continue;
          for (int slot = 0; slot < 3 && !transformed; slot++) {
            uvec4 rx = texelFetch(uReactions, ivec2(int(nid), slot), 0);
            uint other = rx.r;
            if (other == 0u) break;       // unused slot
            if (other != selfId) continue; // not me
            uint becomes = rx.g;
            uint chance  = rx.b;
            // Roll using a hash of (sorted-cell-pair, frame, slot) so both
            // sides of the pair compute the same roll.
            ivec2 a = px;
            ivec2 b = px + D[i];
            ivec2 lo = min(a, b);
            ivec2 hi = max(a, b);
            uint h = hash3(uvec3(uint(lo.x) | (uint(lo.y) << 16),
                                 uint(hi.x) | (uint(hi.y) << 16),
                                 uint(uFrame) * 31u + uint(slot)));
            if ((h & 0xFFu) < chance) {
              newId = becomes;
              transformed = true;
            }
          }
        }
      }

      // 2) Self-consume pass: do any of MY reactions trigger consumption?
      // Only matters if I haven't already been transformed by step 1.
      if (selfId != 0u && !transformed) {
        bool consumed = false;
        for (int slot = 0; slot < 3 && !consumed; slot++) {
          uvec4 rx = texelFetch(uReactions, ivec2(int(selfId), slot), 0);
          uint other = rx.r;
          if (other == 0u) break;
          uint chance      = rx.b;
          uint selfConsume = rx.a;
          if (selfConsume == 0u) continue;
          for (int i = 0; i < 8 && !consumed; i++) {
            if (nIds[i] != other) continue;
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
        if (newId == 0u) {
          newCell = uvec4(0u);
        } else {
          // Pick a fresh color variant for the new element.
          uint v = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 9001u)) & 3u;
          newCell = uvec4(newId, v, 0u, 0u);
        }
      }
      outColor = newCell;
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
    progHeat   = linkProgram(VS_QUAD, FS_HEAT);
    progIgnition = linkProgram(VS_QUAD, FS_IGNITION);
    progCellular = linkProgram(VS_QUAD, FS_CELLULAR);

    // Fullscreen triangle (covers the framebuffer with two tris).
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

    // Element data lookup texture (256x1 RGBA8UI).
    elementDataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Palette texture (256x4 RGBA8). Width=ids, Height=variants.
    paletteTex = createU8Texture2D(256, 4);

    // Reactions texture: 256 wide × 3 tall, RGBA8UI per slot.
    reactionsTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 3);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Traits texture: 256 wide × 2 tall, RGBA8UI.
    // Row 0 = (emitTemp, ignitionPoint, flammability, conductivity)
    // Row 1 = (corrosivity, hardness, _, _)
    traitsTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Cellular CA params texture: 256 wide × 2 tall, RGBA8UI.
    cellularDataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cellularDataTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    uploadElementData();
    uploadPalette();
    uploadReactions();
    uploadTraits();
    uploadCellular();
  }

  // Pack registry into the lookup texture.
  function uploadElementData() {
    const buf = new Uint8Array(256 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec) {
        buf[id * 4 + 0] = KIND_EMPTY;
        continue;
      }
      buf[id * 4 + 0] = kindCode(spec.kind);
      buf[id * 4 + 1] = Math.max(1, Math.min(15, Math.round(spec.density || 1)));
      // paramA: kind-specific (flow for powder, viscosity for liquid, buoyancy for gas)
      let paramA = 128;
      if (spec.kind === 'powder') paramA = Math.round(((typeof spec.flow === 'number') ? spec.flow : 0.55) * 255);
      else if (spec.kind === 'liquid') paramA = Math.round(((typeof spec.viscosity === 'number') ? spec.viscosity : 0) * 255);
      else if (spec.kind === 'gas') paramA = Math.round(((typeof spec.buoyancy === 'number') ? spec.buoyancy : 0.9) * 255);
      buf[id * 4 + 2] = paramA;
      // paramB: low 7 bits = stickiness × 127, high bit = isExplosive flag.
      let paramB = Math.round(((typeof spec.stickiness === 'number') ? spec.stickiness : 0) * 127) & 0x7f;
      if (spec.isExplosive) paramB |= 0x80;
      buf[id * 4 + 3] = paramB;
    }
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  // Pack registry palettes into the palette texture: 4 variants per element.
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

  // Pack each element's reaction list into 3 slots × 256 ids.
  // Per slot: (otherId, becomesId, chanceByte, selfConsumeByte).
  // otherId == 0 marks an unused slot. Reactions with explodes:true are
  // skipped here (they belong to the milestone-3 explosion path).
  function uploadReactions() {
    const buf = new Uint8Array(256 * 3 * 4);
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
        // Slot row layout: slot 0 = top row of texture (y=0), etc.
        const o = (slot * 256 + id) * 4;
        buf[o + 0] = otherId;
        buf[o + 1] = becomesId;
        buf[o + 2] = chance;
        buf[o + 3] = selfConsume;
        slot++;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 3, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  // Pack each element's traits into 2 rows of RGBA8UI per id.
  // Row 0 = (emitTemp, ignitionPoint, flammability, conductivity)
  // Row 1 = (corrosivity, hardness, _, _)
  function uploadTraits() {
    const buf = new Uint8Array(256 * 2 * 4);
    for (let id = 0; id < 256; id++) {
      const spec = registry[id];
      if (!spec) continue;
      const emitTemp      = clamp255(spec.emitTemp,      30);
      const ignitionPoint = clamp255(spec.ignitionPoint, 255);
      const flammability  = clamp255(Math.round(((typeof spec.flammability === 'number') ? spec.flammability : 0) * 255), 0);
      const conductivity  = clamp255(spec.conductivity,  100);
      const corrosivity   = clamp255(spec.corrosivity,   0);
      const hardness      = clamp255(spec.hardness,      80);
      const o0 = (0 * 256 + id) * 4;
      buf[o0+0] = emitTemp;
      buf[o0+1] = ignitionPoint;
      buf[o0+2] = flammability;
      buf[o0+3] = conductivity;
      const o1 = (1 * 256 + id) * 4;
      buf[o1+0] = corrosivity;
      buf[o1+1] = hardness;
      buf[o1+2] = 0;
      buf[o1+3] = 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  }

  function clamp255(v, def) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  // Pack cellular CA parameters per id into 2 rows of RGBA8UI.
  // Row 0 = (bornMaskLo, surviveMaskLo, growChance, surviveChance)
  // Row 1 = (extras, birthFrom0, birthFrom1, birthFrom2)
  // extras byte: bit0 = bornMask>>8, bit1 = surviveMask>>8, bits 2-7 = cellularTick
  function uploadCellular() {
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
      const extras = ((bornMask >> 8) & 1)
                   | (((surviveMask >> 8) & 1) << 1)
                   | ((tick & 0x3F) << 2);
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

    const orderedIds = [WALL_ID, SAND_ID, WATER_ID, EXPLOSIVE_ID, SMOKE_ID, PLANT_ID];
    const customIds = Object.keys(registry)
      .map(n => +n)
      .filter(id => !registry[id].isBuiltIn)
      .sort((a, b) => a - b);
    orderedIds.push(...customIds);

    for (const id of orderedIds) {
      const spec = registry[id];
      if (!spec) continue;
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

  // ── Reset ──────────────────────────────────────────────────────────────────
  window.clearAll = function () {
    pours = [];
    if (gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboA);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0,0,0,0]));
      // Reset temperature to ambient.
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboA);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([30,0,0,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([30,0,0,0]));
    }
    selectedKey = 'wall';
    refreshActiveClass();
    syncActionLabel();
    showOverlay('paint walls or any element on the canvas.\npour sand or water from the top.');
  };

  // ── Drawing ────────────────────────────────────────────────────────────────
  function canvasCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Convert to fragment-coord space: bottom-left origin, so flip y.
    const fx = Math.floor(x * COLS / rect.width);
    const fyRow = Math.floor(y * ROWS / rect.height);
    const fy = (ROWS - 1 - fyRow);
    return { c: fx, r: fy }; // c = column (frag x), r = row (frag y, y-up)
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
      const visc = (typeof spec.viscosity === 'number') ? spec.viscosity : 0;
      if (visc >= 0.8) return 2;
      return 2;
    }
    if (spec.kind === 'powder') {
      const flow = (typeof spec.flow === 'number') ? spec.flow : 0.55;
      if (flow >= 0.9) return 3;
      if (flow <= 0.2) return 2;
      return 2;
    }
    return 2;
  }

  // Issues a paint pass at (cx, cy) frag coords with the currently-selected
  // material. Renders into stateB (reading from stateA) then swaps.
  function paintAtFrag(cx, cy, brushR) {
    const key = selectedKey;
    let id = 0;
    let spec = null;
    if (key !== 'erase') {
      id = keyToId[key] || 0;
      if (!id) return;
      spec = registry[id];
    }
    paintPass(cx, cy, brushR, id, spec);
  }

  function paintPass(cx, cy, brushR, id, spec) {
    const settleFrames = (spec && spec.isExplosive) ? 28 : 0;
    let lifeFrames = 0;
    if (spec && spec.kind === 'gas' && spec.lifeMin) {
      lifeFrames = Math.min(255, spec.lifeMin + Math.floor(Math.random() * Math.max(1, (spec.lifeMax || spec.lifeMin) - spec.lifeMin)));
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
    gl.uniform2i(gl.getUniformLocation(progPaint, 'uSize'), COLS, ROWS);
    gl.uniform2i(gl.getUniformLocation(progPaint, 'uCenter'), cx, cy);
    gl.uniform1i(gl.getUniformLocation(progPaint, 'uRadius'), brushR);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintId'), id >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uVariantSeed'), (frameCounter * 2654435761) >>> 0);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uSettleFrames'), settleFrames);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uLifeFrames'), lifeFrames);
    gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintKind'), kind);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap A/B
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  // Stroke from (c0,r0) to (c1,r1) in frag coords with brush radius.
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
    isPointerDown = true;
    const cell = canvasCell(e);
    lastCell = cell;
    lastPointer = cell;
    paintAtFrag(cell.c, cell.r, brushRadiusFor(selectedKey));
    hideOverlay();
    startHoldPaint();
  }

  function onPointerMove(e) {
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

  // ── Pour ───────────────────────────────────────────────────────────────────
  window.startDrop = function () {
    const key = pourableKeyFor(selectedKey);
    const id = keyToId[key];
    if (!id) return;
    const spec = registry[id];
    pours.push({ id, kind: spec.kind, frames: 0, total: 300 });
    hideOverlay();
  };

  // Each frame, pour a stripe near the top edge for active pours.
  function spawnFromPours() {
    if (!pours.length) return;
    const next = [];
    for (const p of pours) {
      if (p.frames > p.total) continue;
      const spec = registry[p.id];
      if (!spec) continue;
      // Top of canvas in frag coords = high y.
      const sprayRow = (spec.kind === 'gas') ? 1 : (ROWS - 2);
      // Random scatter centers across the row to create a curtain.
      for (let s = 0; s < 6; s++) {
        const cx = Math.floor(Math.random() * COLS);
        // Use a tiny brush so we don't smear; but bursts of small dots create
        // a natural pour curtain.
        const settle = spec.isExplosive ? 28 : 0;
        let life = 0;
        if (spec.kind === 'gas' && spec.lifeMin) {
          life = Math.min(255, spec.lifeMin + Math.floor(Math.random() * Math.max(1, (spec.lifeMax || spec.lifeMin) - spec.lifeMin)));
        }
        paintPass(cx, sprayRow, 1, p.id, spec);
        // (settle/life were applied via paintPass through uniforms.)
      }
      p.frames++;
      next.push(p);
    }
    pours = next;
  }

  // ── Sim step ──────────────────────────────────────────────────────────────
  function simStep() {
    // Run several phases per frame so cells can fall faster than 1 row / 4 frames.
    // Each phase rotates the block origin so all cells get covered over time.
    for (let phase = 0; phase < 4; phase++) {
      gl.useProgram(progSim);
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stateTexA);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uState'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uElemData'), 1);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uPhase'), (frameCounter * 4 + phase) & 3);
      gl.uniform1i(gl.getUniformLocation(progSim, 'uFrame'), frameCounter * 4 + phase);
      gl.uniform2i(gl.getUniformLocation(progSim, 'uSize'), COLS, ROWS);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      [stateTexA, stateTexB] = [stateTexB, stateTexA];
      [stateFboA, stateFboB] = [stateFboB, stateFboA];
    }
  }

  function explosionStep() {
    // Pass 1: contact detection — mark explosives that touch non-explosive.
    gl.useProgram(progContact);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progContact, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.uniform1i(gl.getUniformLocation(progContact, 'uElemData'), 1);
    gl.uniform2i(gl.getUniformLocation(progContact, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];

    // Pass 2: blast — clear cells within blast radius of any primed explosive,
    // detonate primed cells themselves, and prime any other explosive within
    // radius (chain reaction).
    gl.useProgram(progBlast);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progBlast, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, elementDataTex);
    gl.uniform1i(gl.getUniformLocation(progBlast, 'uElemData'), 1);
    gl.uniform2i(gl.getUniformLocation(progBlast, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function reactStep() {
    gl.useProgram(progReact);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, reactionsTex);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uReactions'), 1);
    gl.uniform2i(gl.getUniformLocation(progReact, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progReact, 'uFrame'), frameCounter);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function render() {
    gl.useProgram(progRender);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uPalette'), 1);
    gl.uniform2i(gl.getUniformLocation(progRender, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function heatStep() {
    gl.useProgram(progHeat);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progHeat, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progHeat, 'uTemp'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.uniform1i(gl.getUniformLocation(progHeat, 'uTraits'), 2);
    gl.uniform2i(gl.getUniformLocation(progHeat, 'uSize'), COLS, ROWS);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [tempTexA, tempTexB] = [tempTexB, tempTexA];
    [tempFboA, tempFboB] = [tempFboB, tempFboA];
  }

  function ignitionStep() {
    const fireId = keyToId.fire || 0;
    gl.useProgram(progIgnition);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
    gl.viewport(0, 0, COLS, ROWS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexA);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexA);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uTemp'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, traitsTex);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uTraits'), 2);
    gl.uniform2i(gl.getUniformLocation(progIgnition, 'uSize'), COLS, ROWS);
    gl.uniform1i(gl.getUniformLocation(progIgnition, 'uFrame'), frameCounter);
    gl.uniform1ui(gl.getUniformLocation(progIgnition, 'uFireId'), fireId >>> 0);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    [stateTexA, stateTexB] = [stateTexB, stateTexA];
    [stateFboA, stateFboB] = [stateFboB, stateFboA];
  }

  function cellularStep() {
    // Run a separate pass per cellular element. cellularTick gates evaluation.
    for (const idStr of Object.keys(registry)) {
      const id = +idStr;
      const spec = registry[id];
      if (!spec || spec.kind !== 'cellular') continue;
      const tick = Math.max(1, Math.min(30, Math.round(spec.cellularTick || 6)));
      if (frameCounter % tick !== 0) continue;
      gl.useProgram(progCellular);
      gl.bindFramebuffer(gl.FRAMEBUFFER, stateFboB);
      gl.viewport(0, 0, COLS, ROWS);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stateTexA);
      gl.uniform1i(gl.getUniformLocation(progCellular, 'uState'), 0);
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

  function loop() {
    spawnFromPours();
    simStep();
    explosionStep();
    reactStep();
    heatStep();
    ignitionStep();
    cellularStep();
    render();
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
    const report = {
      type: 'element_feedback',
      element: {
        displayName: spec.displayName, key: spec.key, userDesc: spec.userDesc || '',
        kind: spec.kind, density: spec.density, viscosity: spec.viscosity,
        flow: spec.flow, stickiness: spec.stickiness, buoyancy: spec.buoyancy,
        lifeMin: spec.lifeMin, lifeMax: spec.lifeMax, colors: spec.colors,
        reactions: spec.reactions,
        emitTemp: spec.emitTemp, ignitionPoint: spec.ignitionPoint,
        flammability: spec.flammability, conductivity: spec.conductivity,
        corrosivity: spec.corrosivity, hardness: spec.hardness,
      },
      reasons, note,
    };
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

  // ── AI call (unchanged from CPU version) ──────────────────────────────────
  async function generateElement(name, desc) {
    const existing = Object.keys(keyToId);
    const otherList = existing.join(', ');
    const SYSTEM_PROMPT = [
      'You design elements for a falling-sand physics sandbox. Output ONE strict JSON object, no prose, no code fence.',
      'Schema: { "kind":"static"|"powder"|"liquid"|"gas"|"cellular", "density":1-9, "viscosity":0-1 (liquid), "flow":0-1 (powder), "stickiness":0-1 (liquid/powder), "buoyancy":0-1 (gas), "lifeMin":0-150 (gas), "lifeMax":0-200 (gas), "born":[int 0-8] (cellular), "survive":[int 0-8] (cellular), "cellularTick":1-30 (cellular,opt), "growChance":0.05-1 (cellular,opt), "surviveChance":0.5-1 (cellular,opt), "birthFrom":[key] (cellular,opt), "colors":[3-6 hex], "reactions":[ { "other":"<key>", "becomes":"<key|empty>", "chance":0.005-0.25, "selfConsume":0-1 (opt), "selfBecomes":"<key|empty>" (opt), "explodes":bool (opt), "explosionRadius":int 4-16 (opt), "explosionPower":0.5-2 (opt) } ] }',
      'Existing keys: ' + otherList + '.',
      'Pick kind by what the name evokes (fire/smoke = gas; lava/water/oil = liquid; sand/snow/tnt = powder; wall/wood/metal = static; mold/coral/life = cellular).',
      'Match common intuition: fire MUST rise (gas, buoyancy>=0.9), water flows (liquid visc 0), honey is thick (liquid visc 0.9), tnt explodes on fire.',
      'Colors: 3-6 hex strings that read on near-black. Avoid pure black. Coherent palette per element.',
      'Reactions are optional but strongly recommended for reactive elements (fire burns plant/oil, acid eats wall/sand, lava cools on water).',
      '',
      'TRAITS — additionally include this OPTIONAL block to describe the material physically. The engine will use these to derive emergent behaviour (heat propagation, ignition, corrosion). All values 0-255 unless noted; safe to omit.',
      'Trait fields: { "emitTemp":0-255 (the ambient temperature this material radiates: ice=10, room=30, hot lava=210, fire=240),',
      '  "ignitionPoint":0-255 (temperature above which it catches fire: oil=100, wood=140, paper=110, water=255 (never), explosives=80),',
      '  "flammability":0-1 (per-frame chance of igniting once over ignitionPoint: paper=0.25, oil=0.20, wood=0.04, plant=0.05, tnt=0.30),',
      '  "conductivity":0-255 (heat diffusion rate: insulator wood=40, water=140, metal=240, plasma=255),',
      '  "corrosivity":0-255 (how aggressively this material eats less-hard neighbors: water=0, acid=200, lava=80),',
      '  "hardness":0-255 (resistance to corrosion: sand=60, plant=40, wall=200, metal=240, diamond=255) }',
      'Use traits whenever they make the element\'s physical identity clearer; they are forward-compatible with the upcoming trait-driven physics.',
      'Output JSON only.',
    ].join('\n');
    const userPrompt = desc ? `Name: ${name}\nDescription: ${desc}` : `Name: ${name}`;
    const body = {
      slug: SLUG, model: 'gpt-5.4', temperature: 0.7, max_tokens: 600,
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
    if (hits(name, ['fire','flame','inferno','ember','plasma','lightning','spark'])) return 'gas';
    if (hits(name, ['smoke','steam','vapor','mist','fog','cloud','haze'])) return 'gas';
    if (hits(name, ['wall','brick','concrete','bedrock','stone','rock'])) return 'static';
    if (hits(name, ['wood','timber','log','bark'])) return 'static';
    if (hits(name, ['metal','iron','steel','copper','brass','gold','silver'])) return 'static';
    if (hits(name, ['ice','icicle','glacier'])) return 'static';
    if (hits(name, ['plant','leaf','vine','tree','grass','moss'])) return 'static';
    if (hits(name, ['glass','crystal','gem','diamond'])) return 'static';
    if (hits(name, ['lava','magma'])) return 'liquid';
    if (hits(name, ['water','ocean','river'])) return 'liquid';
    if (hits(name, ['oil','gasoline','petrol','fuel'])) return 'liquid';
    if (hits(name, ['acid','poison'])) return 'liquid';
    if (hits(name, ['honey','syrup','molasses','caramel','tar'])) return 'liquid';
    if (hits(name, ['blood','slime','goo','ooze'])) return 'liquid';
    if (hits(name, ['juice','milk','wine','soda','ink','paint'])) return 'liquid';
    if (hits(name, ['sand','salt','sugar','flour','dust','talc'])) return 'powder';
    if (hits(name, ['ash','soot','cinder','glitter','gravel'])) return 'powder';
    if (hits(name, ['snow','seed','gunpowder','gun-powder','confetti'])) return 'powder';
    if (hits(name, ['tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'])) return 'powder';
    if (hits(name, ['mold','fungus','mycelium','lichen','coral','conway','automaton','slime-mold'])) return 'cellular';
    return null;
  }

  function namePropertyHints(key) {
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    if (has('fire','flame','inferno','ember','plasma','spark','lightning')) return { density: 1, buoyancy: 1, lifeMin: 30, lifeMax: 70 };
    if (has('lava','magma'))   return { density: 8, viscosity: 0.8, stickiness: 0 };
    if (has('steam'))          return { density: 2, buoyancy: 0.8, lifeMin: 30, lifeMax: 60 };
    if (has('smoke'))          return { density: 2, buoyancy: 0.6, lifeMin: 60, lifeMax: 120 };
    if (has('fog','mist','vapor','cloud','haze')) return { density: 2, buoyancy: 0.5, lifeMin: 60, lifeMax: 120 };
    if (has('honey','syrup','molasses','caramel')) return { density: 6, viscosity: 0.9, stickiness: 0.7 };
    if (has('tar','pitch','glue','resin')) return { density: 6, viscosity: 0.95, stickiness: 0.85 };
    if (has('acid'))           return { density: 4, viscosity: 0.1, stickiness: 0 };
    if (has('oil','gasoline','petrol','fuel')) return { density: 3, viscosity: 0.3, stickiness: 0 };
    if (has('water','juice','milk','wine','soda')) return { density: 5, viscosity: 0, stickiness: 0 };
    if (has('slime','goo','ooze'))   return { density: 5, viscosity: 0.6, stickiness: 0.5 };
    if (has('blood'))          return { density: 6, viscosity: 0.4, stickiness: 0 };
    if (has('ink','paint'))    return { density: 5, viscosity: 0.2, stickiness: 0 };
    if (has('snow'))           return { density: 2, flow: 0.4, stickiness: 0 };
    if (has('flour','dust','talc','powder')) return { density: 2, flow: 1.0, stickiness: 0 };
    if (has('ash','soot','cinder')) return { density: 2, flow: 0.9, stickiness: 0 };
    if (has('gravel','pebbles','rocks')) return { density: 7, flow: 0.15, stickiness: 0 };
    if (has('gunpowder')||has('gun-powder')) return { density: 4, flow: 0.6, stickiness: 0 };
    if (has('salt','sugar','seed','rice','glitter','confetti','sand')) return { density: 4, flow: 0.55, stickiness: 0 };
    if (has('wood','timber','log','bark')) return { density: 4 };
    if (has('metal','iron','steel','copper','brass','gold','silver')) return { density: 8 };
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
      let selfPropagateCount = 0;
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
        if (becomes === key) {
          selfPropagateCount++;
          if (selfPropagateCount > 1) continue;
          chance = Math.min(chance, 0.05);
        }
        const reaction = { other, becomes, chance };
        const sc = Number(rx.selfConsume);
        if (isFinite(sc) && sc > 0) {
          reaction.selfConsume = Math.max(0, Math.min(1, sc));
          if (typeof rx.selfBecomes === 'string') {
            const sb = rx.selfBecomes.toLowerCase();
            if (sb === '' || sb === 'empty') reaction.selfBecomes = null;
            else if (validKeys.has(sb)) reaction.selfBecomes = sb;
          }
        }
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
    }

    applyTraits(out, raw, key, userDesc);
    return out;
  }

  // Trait normalization. Each trait field is optional in the AI's response;
  // when absent we fill in a name-based default so the data is always present.
  // The current physics engine doesn't read these yet, but the AI prompt now
  // mentions them and the element-feedback modal serializes them, so the next
  // iteration cycle has structured signal to work with.
  function applyTraits(out, raw, key, userDesc) {
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
    out.emitTemp      = raw255(raw && raw.emitTemp,      defaults.emitTemp);
    out.ignitionPoint = raw255(raw && raw.ignitionPoint, defaults.ignitionPoint);
    out.flammability  = raw01 (raw && raw.flammability,  defaults.flammability);
    out.conductivity  = raw255(raw && raw.conductivity,  defaults.conductivity);
    out.corrosivity   = raw255(raw && raw.corrosivity,   defaults.corrosivity);
    out.hardness      = raw255(raw && raw.hardness,      defaults.hardness);
  }

  // Default trait values derived from element name + kind. Picks sensible
  // physical analogs so users get plausible behavior even when the AI omits
  // the trait block entirely. Falls through to kind-only defaults at the end.
  function traitDefaultsForName(key, kind) {
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    if (has('fire','flame','inferno','ember','plasma','spark','lightning'))
      return { emitTemp: 240, ignitionPoint: 255, flammability: 0,    conductivity: 220, corrosivity: 40,  hardness: 0 };
    if (has('lava','magma'))
      return { emitTemp: 210, ignitionPoint: 255, flammability: 0,    conductivity: 180, corrosivity: 80,  hardness: 30 };
    if (has('steam'))
      return { emitTemp: 130, ignitionPoint: 255, flammability: 0,    conductivity: 200, corrosivity: 0,   hardness: 0 };
    if (has('smoke','fog','mist','vapor','cloud','haze'))
      return { emitTemp: 70,  ignitionPoint: 255, flammability: 0,    conductivity: 200, corrosivity: 0,   hardness: 0 };
    if (has('ice','icicle','glacier','snow'))
      return { emitTemp: 10,  ignitionPoint: 255, flammability: 0,    conductivity: 160, corrosivity: 0,   hardness: 60 };
    if (has('water','juice','milk','wine','soda'))
      return { emitTemp: 25,  ignitionPoint: 255, flammability: 0,    conductivity: 140, corrosivity: 0,   hardness: 0 };
    if (has('oil','gasoline','petrol','fuel'))
      return { emitTemp: 30,  ignitionPoint: 100, flammability: 0.20, conductivity: 90,  corrosivity: 0,   hardness: 0 };
    if (has('acid'))
      return { emitTemp: 30,  ignitionPoint: 200, flammability: 0,    conductivity: 110, corrosivity: 200, hardness: 0 };
    if (has('honey','syrup','molasses','caramel'))
      return { emitTemp: 30,  ignitionPoint: 180, flammability: 0.05, conductivity: 70,  corrosivity: 0,   hardness: 0 };
    if (has('tar','pitch','glue','resin'))
      return { emitTemp: 30,  ignitionPoint: 130, flammability: 0.10, conductivity: 60,  corrosivity: 0,   hardness: 0 };
    if (has('blood'))
      return { emitTemp: 38,  ignitionPoint: 200, flammability: 0,    conductivity: 130, corrosivity: 0,   hardness: 0 };
    if (has('slime','goo','ooze'))
      return { emitTemp: 30,  ignitionPoint: 220, flammability: 0,    conductivity: 90,  corrosivity: 0,   hardness: 0 };
    if (has('plant','leaf','vine','tree','grass','moss'))
      return { emitTemp: 30,  ignitionPoint: 120, flammability: 0.05, conductivity: 70,  corrosivity: 0,   hardness: 40 };
    if (has('wood','timber','log','bark','twig'))
      return { emitTemp: 30,  ignitionPoint: 140, flammability: 0.04, conductivity: 40,  corrosivity: 0,   hardness: 100 };
    if (has('paper','cardboard','parchment'))
      return { emitTemp: 30,  ignitionPoint: 110, flammability: 0.25, conductivity: 50,  corrosivity: 0,   hardness: 20 };
    if (has('metal','iron','steel','copper','brass','gold','silver'))
      return { emitTemp: 30,  ignitionPoint: 220, flammability: 0,    conductivity: 240, corrosivity: 0,   hardness: 240 };
    if (has('diamond','gem'))
      return { emitTemp: 30,  ignitionPoint: 250, flammability: 0,    conductivity: 220, corrosivity: 0,   hardness: 255 };
    if (has('crystal','glass'))
      return { emitTemp: 30,  ignitionPoint: 240, flammability: 0,    conductivity: 120, corrosivity: 0,   hardness: 180 };
    if (has('rock','stone','brick','concrete','bedrock'))
      return { emitTemp: 30,  ignitionPoint: 240, flammability: 0,    conductivity: 100, corrosivity: 0,   hardness: 200 };
    if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine'))
      return { emitTemp: 30,  ignitionPoint: 100, flammability: 0.30, conductivity: 90,  corrosivity: 0,   hardness: 30 };
    if (has('gunpowder')||has('gun-powder'))
      return { emitTemp: 30,  ignitionPoint: 90,  flammability: 0.50, conductivity: 80,  corrosivity: 0,   hardness: 20 };
    if (has('ash','soot','cinder'))
      return { emitTemp: 50,  ignitionPoint: 255, flammability: 0,    conductivity: 60,  corrosivity: 0,   hardness: 30 };
    if (has('mold','fungus','mycelium','lichen','coral','slime-mold'))
      return { emitTemp: 30,  ignitionPoint: 150, flammability: 0.06, conductivity: 70,  corrosivity: 0,   hardness: 50 };
    // Kind-based final fallback.
    if (kind === 'gas')      return { emitTemp: 60,  ignitionPoint: 255, flammability: 0,    conductivity: 180, corrosivity: 0,   hardness: 0 };
    if (kind === 'liquid')   return { emitTemp: 30,  ignitionPoint: 200, flammability: 0,    conductivity: 130, corrosivity: 0,   hardness: 0 };
    if (kind === 'powder')   return { emitTemp: 30,  ignitionPoint: 200, flammability: 0,    conductivity: 90,  corrosivity: 0,   hardness: 60 };
    if (kind === 'cellular') return { emitTemp: 30,  ignitionPoint: 160, flammability: 0.05, conductivity: 70,  corrosivity: 0,   hardness: 50 };
    /* static */              return { emitTemp: 30,  ignitionPoint: 220, flammability: 0,    conductivity: 100, corrosivity: 0,   hardness: 180 };
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
    if (has('fire','flame','inferno','ember','plasma','spark','lightning')) return ['#ff4020','#ff8010','#ffc040','#ffe070'];
    if (has('lava','magma')) return ['#ff5020','#ff8030','#d03010','#ffc040'];
    if (has('steam')) return ['#d8e8f0','#b0c8d8','#f0f6fa','#c0d8e0'];
    if (has('smoke')) return ['#606060','#808080','#4a4a4a','#a0a0a0'];
    if (has('fog','mist','vapor','cloud','haze')) return ['#a0b8c8','#c0d0dc','#7890a0','#90a8b8'];
    if (has('honey','syrup','molasses','caramel')) return ['#e8a030','#d48020','#ffc050','#b86020'];
    if (has('tar','pitch','glue','resin')) return ['#1a1008','#2a1810','#3a2418','#1f1410'];
    if (has('acid')) return ['#60ff30','#80ff40','#30d020','#b0ff60'];
    if (has('oil','gasoline','petrol','fuel')) return ['#2a1010','#4a2810','#1a0808','#603020'];
    if (has('slime','goo','ooze')) return ['#60c060','#40a040','#80d080','#509050'];
    if (has('blood')) return ['#a02020','#801010','#c03030','#600808'];
    if (has('snow')) return ['#ffffff','#e8f0ff','#d0e0f0','#fafcff'];
    if (has('ash','soot','cinder')) return ['#505050','#707070','#3a3a3a','#606060'];
    if (has('gunpowder')||has('gun-powder')) return ['#2a2a2a','#404040','#1a1a1a','#303030'];
    if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine')) return ['#c02020','#e03030','#ff4040','#802020'];
    if (has('ice','icicle')) return ['#c0e0ff','#a0d0f0','#e0f0ff','#80b0e0'];
    if (has('plant','leaf','vine','tree','grass','moss')) return ['#409040','#60a050','#308030','#80b060'];
    if (has('wood','timber','log','bark','twig')) return ['#7a4820','#8a5828','#5a3010','#a06838'];
    if (has('metal','iron','steel','copper','brass','gold','silver')) return ['#9a9a9a','#b0b0b0','#707070','#c8c8c8'];
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
    const n = (key || '').toLowerCase();
    const has = (...words) => words.some(w => n.indexOf(w) >= 0);
    let kind = 'powder', density = 5, viscosity = 0, flow = 0.55, stickiness = 0;
    let buoyancy = 0.9, lifeMin = 60, lifeMax = 110;
    let colorsOverride = null;
    let born = [3], survive = [2,3];
    if (has('fire','flame','inferno','ember','plasma','spark','lightning')) {
      kind='gas'; density=1; buoyancy=1; lifeMin=30; lifeMax=70;
    } else if (has('lava','magma')) {
      kind='liquid'; density=8; viscosity=0.8;
    } else if (has('smoke','steam','fog','mist','vapor','cloud','haze')) {
      kind='gas'; density=2; buoyancy=0.6; lifeMin=60; lifeMax=120;
    } else if (has('ice','icicle')) { kind='static'; density=5; }
    else if (has('plant','leaf','vine','tree','grass','moss')) { kind='static'; density=3; }
    else if (has('wood','timber','log','bark','twig')) { kind='static'; density=4; }
    else if (has('metal','iron','steel','copper','brass','gold','silver')) { kind='static'; density=8; }
    else if (has('rock','stone','brick','concrete','crystal','glass')) { kind='static'; }
    else if (has('honey','syrup','molasses','caramel')) { kind='liquid'; density=6; viscosity=0.9; stickiness=0.7; }
    else if (has('tar','glue','resin','pitch')) { kind='liquid'; density=6; viscosity=0.95; stickiness=0.85; }
    else if (has('acid')) { kind='liquid'; density=4; viscosity=0.1; }
    else if (has('oil','gasoline','petrol','fuel')) { kind='liquid'; density=3; viscosity=0.3; }
    else if (has('water','juice','milk','wine','soda','liquid')) { kind='liquid'; density=5; viscosity=0; }
    else if (has('slime','goo','ooze')) { kind='liquid'; density=5; viscosity=0.6; stickiness=0.5; }
    else if (has('blood')) { kind='liquid'; density=6; viscosity=0.4; }
    else if (has('snow')) { kind='powder'; density=2; flow=0.4; }
    else if (has('flour','powder','dust','talc')) { kind='powder'; flow=1.0; density=2; }
    else if (has('ash','soot','cinder')) { kind='powder'; flow=0.9; density=2; }
    else if (has('gravel','rocks','pebbles')) { kind='powder'; flow=0.15; density=7; }
    else if (has('gunpowder','gun-powder')) { kind='powder'; flow=0.6; density=4; }
    else if (has('tnt','bomb','dynamite','explosive','c4','grenade','blastite','landmine')) { kind='powder'; flow=0.45; density=4; }
    else if (has('mold','fungus','mycelium','lichen','coral','slime-mold')) { kind='cellular'; density=3; born=[2,3]; survive=[1,2,3,4,5]; }
    else if (has('conway','automaton','life')) { kind='cellular'; density=3; }
    else if (has('sand','salt','glitter','seed','sugar','rice','confetti')) { kind='powder'; flow=0.55; }

    colorsOverride = canonicalPaletteFromName(key) || fillFallbackColors(key);
    const out = {
      id: nextCustomId(), key,
      displayName: displayName.slice(0, 14).toLowerCase(),
      kind, density, colors: colorsOverride, reactions: [],
      isBuiltIn: false, userDesc: desc || '',
    };
    if (kind === 'liquid') { out.viscosity = viscosity; out.stickiness = stickiness; }
    if (kind === 'powder') { out.flow = flow; out.stickiness = stickiness; }
    if (kind === 'gas')    { out.buoyancy = buoyancy; out.lifeMin = lifeMin; out.lifeMax = lifeMax; }
    if (kind === 'cellular') {
      out.born = born; out.survive = survive;
      out.cellularTick = 6; out.growChance = 0.4; out.surviveChance = 0.94;
    }
    applyTraits(out, null, key, desc);
    return out;
  }
})();
