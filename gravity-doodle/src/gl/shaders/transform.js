// FS_TRANSFORM — ignition + phase change in one pass.
//
// Ignition (was its own shader): cells become fire when their temperature
// or |charge| exceeds the relevant threshold.
// Phase change: meltingPoint→meltsTo, boilingPoint→boilsTo,
// freezingPoint→freezesTo, sampled from trait rows 2/3.
//
// Ignition runs first; if a cell ignites it never phase-changes the same
// frame.

import { SH_HASH } from './common.js';

export const FS_TRANSFORM = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uTemp;
  uniform highp usampler2D uTraits;
  uniform highp usampler2D uCharge;
  uniform highp usampler2D uElemData;
  uniform highp usampler2D uRegisters;
  uniform ivec2 uSize;
  uniform int uFrame;
  uniform uint uFireId;
  ${SH_HASH}

  uvec4 transformTo(uint newId, uint h, ivec2 px) {
    uvec4 e = texelFetch(uElemData, ivec2(int(newId), 0), 0);
    uint life = (e.r == 4u) ? 120u : 0u;       // gas default lifespan
    uint regRa = texelFetch(uRegisters, ivec2(int(newId), 0), 0).r;
    uint ra = (regRa > 0u) ? regRa : life;
    return uvec4(newId, h & 3u, ra, 0u);
  }

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    if (self.r == 0u) { outColor = self; return; }
    uvec4 r0 = texelFetch(uTraits, ivec2(int(self.r), 0), 0);
    uvec4 r2 = texelFetch(uTraits, ivec2(int(self.r), 2), 0);
    uvec4 r3 = texelFetch(uTraits, ivec2(int(self.r), 3), 0);
    uvec4 r4 = texelFetch(uTraits, ivec2(int(self.r), 4), 0);
    uint ignitionPoint = r0.g;
    uint flammability  = r0.b;
    uint ignitesAtCh   = r4.b;
    uint meltAt   = r2.r; uint boilAt   = r2.g; uint freezeAt = r2.b;
    uint meltTo   = r3.r; uint boilTo   = r3.g; uint freezeTo = r3.b;

    uint temp = texelFetch(uTemp, px, 0).r;
    uint chRaw = texelFetch(uCharge, px, 0).r;
    int chargeMag = abs(int(chRaw) - 128);
    uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));

    // Ignition.
    bool tempIgnite   = (flammability > 0u) && (temp >= ignitionPoint);
    bool chargeIgnite = (ignitesAtCh > 0u) && (uint(chargeMag) >= ignitesAtCh);
    if (tempIgnite || chargeIgnite) {
      uint hi = hash3(uvec3(uint(px.x) * 1009u + 7u, uint(px.y) * 31u + 13u, uint(uFrame) * 41u + 3u));
      if (chargeIgnite || ((hi & 0xFFu) < flammability)) {
        if (uFireId == 0u) { outColor = uvec4(0u); return; }
        outColor = uvec4(uFireId, h & 3u, 0u, 0u);
        return;
      }
    }

    // Phase change. Boil checked before melt so a hot solid that has both
    // can boil straight.
    uint roll = h & 0xFFu;
    if (boilAt > 0u && boilTo > 0u && temp >= boilAt && roll < 64u) {
      outColor = transformTo(boilTo, h, px); return;
    }
    if (meltAt > 0u && meltTo > 0u && temp >= meltAt && roll < 32u) {
      outColor = transformTo(meltTo, h, px); return;
    }
    if (freezeAt > 0u && freezeTo > 0u && temp <= freezeAt && roll < 24u) {
      outColor = transformTo(freezeTo, h, px); return;
    }
    outColor = self;
  }
`;
