// FS_BLAST — consumes primed explosive cells and clears a circle of
// blast radius around them, sprinkling sparks where it can.

import { SH_HASH } from './common.js';

export const FS_BLAST = `#version 300 es
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
