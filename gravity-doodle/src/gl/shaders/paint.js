// FS_PAINT — element-aware painting. Reads registersTex for default
// raInit; the JS paint code passes uPaintRaOverride (256 = use defaults,
// <256 = use this value) for randomized gas life and explosive settle.

import { SH_HASH } from './common.js';

export const FS_PAINT = `#version 300 es
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
