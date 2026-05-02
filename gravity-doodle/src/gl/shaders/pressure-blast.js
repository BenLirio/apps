// FS_PRESSURE_BLAST — pop cells with `pressureBlast` trait when local
// pressure exceeds threshold. Replacement id is in trait row 5 byte 3.

import { SH_HASH } from './common.js';

export const FS_PRESSURE_BLAST = `#version 300 es
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
