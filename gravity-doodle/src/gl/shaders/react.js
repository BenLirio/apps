// FS_REACT — pairwise reactions between adjacent cells, with optional
// minTemp/maxTemp gates and catalyst flag. Reactions texture is 256×6:
// 3 slots × 2 rows. Slot row 0 = (other, becomes, chance, selfConsume);
// slot row 1 = (minTemp, maxTemp, conditionFlags, _).
// conditionFlags bit 0 = catalyst (self stays even if reaction fires).

import { SH_HASH } from './common.js';

export const FS_REACT = `#version 300 es
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
