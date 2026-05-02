// FS_PHASE — phase transitions. Reads (meltAt, boilAt, freezeAt) and
// (meltsToId, boilsToId, freezesToId) from traits rows 2 and 3. Boil
// is checked before melt so a hot solid that has both can boil straight.

import { SH_HASH } from './common.js';

export const FS_PHASE = `#version 300 es
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
