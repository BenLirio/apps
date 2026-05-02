// Explosion is a two-pass dance:
//   FS_PRIME — explosive cells with a non-explosive neighbor mark
//              themselves primed (a=255). Settle window (b>0) blocks priming.
//   FS_BLAST — primed cells consume themselves into sparks; a 5-cell
//              radius blast clears non-explosive neighbors and seeds
//              extra sparks.
// Both share the isExplosiveId helper and the high bit of elemData.paramB.

import { SH_HASH } from './common.js';

const COMMON = `
  bool isExplosiveId(uint id) {
    if (id == 0u) return false;
    uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
    return (e.a & 0x80u) != 0u;
  }
`;

export const FS_PRIME = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uElemData;
  uniform ivec2 uSize;
  ${COMMON}

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    if (self.r == 0u || !isExplosiveId(self.r)) { outColor = self; return; }
    if (self.a == 255u || self.b > 0u) { outColor = self; return; }
    bool triggered = false;
    for (int dy = -1; dy <= 1 && !triggered; dy++) {
      for (int dx = -1; dx <= 1 && !triggered; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
        uvec4 n = texelFetch(uState, np, 0);
        if (n.r != 0u && !isExplosiveId(n.r)) triggered = true;
      }
    }
    if (triggered) self.a = 255u;
    outColor = self;
  }
`;

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
  ${COMMON}

  uvec4 makeSpark(uint h) {
    uint variant = h & 3u;
    uint life = 16u + ((h >> 8u) & 31u);
    return uvec4(uSparkId, variant, life, 0u);
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
        if (isExplosiveId(n.r) && n.a == 255u) inBlast = true;
      }
    }
    if (!inBlast) { outColor = self; return; }
    if (selfExp) { outColor = uvec4(self.r, self.g, self.b, 255u); return; }    // chain-detonate
    if (self.r == 0u) {
      if (uSparkId != 0u && (h & 3u) == 0u) { outColor = makeSpark(h); return; }
      outColor = self; return;
    }
    if (uSparkId != 0u && (h & 1u) == 0u) { outColor = makeSpark(h); return; }
    outColor = uvec4(0u);
  }
`;
