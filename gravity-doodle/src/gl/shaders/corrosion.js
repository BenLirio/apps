// FS_CORROSION — neighbors with corrosivity > self.hardness eat self at
// a rate proportional to the difference. Acid (200) corrodes most things;
// diamond-hard cells survive.

import { SH_HASH } from './common.js';

export const FS_CORROSION = `#version 300 es
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
