// FS_SIM — the main Margolus 2×2 block CA. Density-aware (heavier
// powder/liquid sinks through lighter), stickiness-aware (tar/honey
// cling to walls), and reads the coarse air velocity field to bias
// gas rise and liquid sideways flow.
//
// The shader runs four times per frame, once per phase (0..3), with
// the block origin shifting each phase so cells get to interact in all
// four 2×2 alignments.

import { SH_HASH } from './common.js';

export const FS_SIM = `#version 300 es
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
