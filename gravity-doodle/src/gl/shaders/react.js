// FS_REACT — pairwise reactions + corrosion in one pass.
//
// Reactions: each element has up to 3 reaction slots (256×6 reactions
// texture). A neighbor with a matching `other` transforms self into
// `becomes`, gated by chance and optional minTemp/maxTemp / catalyst flag.
//
// Corrosion: any neighbor whose corrosivity (trait row 1 col 0) exceeds
// the post-react hardness (trait row 1 col 1) eats self at a rate
// proportional to the difference.

import { SH_HASH } from './common.js';

export const FS_REACT = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;

  uniform highp usampler2D uState;
  uniform highp usampler2D uReactions;
  uniform highp usampler2D uTraits;
  uniform highp usampler2D uTemp;
  uniform ivec2 uSize;
  uniform int uFrame;
  ${SH_HASH}

  bool tempOk(uint t, uint minT, uint maxT) {
    if (minT > 0u && t < minT) return false;
    if (maxT > 0u && t > maxT) return false;
    return true;
  }

  uvec3 pairKey(ivec2 a, ivec2 b, int frame, int slot) {
    ivec2 lo = min(a, b);
    ivec2 hi = max(a, b);
    return uvec3(uint(lo.x) | (uint(lo.y) << 16),
                 uint(hi.x) | (uint(hi.y) << 16),
                 uint(frame) * 31u + uint(slot));
  }

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 selfCell = texelFetch(uState, px, 0);
    uint selfId = selfCell.r;
    uint selfTemp = texelFetch(uTemp, px, 0).r;

    ivec2 D[8] = ivec2[8](
      ivec2(-1,-1), ivec2( 0,-1), ivec2( 1,-1),
      ivec2(-1, 0),                ivec2( 1, 0),
      ivec2(-1, 1), ivec2( 0, 1), ivec2( 1, 1));
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

    // (1) Inverse reaction: a neighbor's reaction transforms me.
    if (selfId != 0u) {
      for (int i = 0; i < 8 && !transformed; i++) {
        uint nid = nIds[i];
        if (nid == 0u) continue;
        uint nTemp = texelFetch(uTemp, px + D[i], 0).r;
        for (int slot = 0; slot < 3 && !transformed; slot++) {
          uvec4 rxA = texelFetch(uReactions, ivec2(int(nid), slot * 2), 0);
          uint other = rxA.r;
          if (other == 0u) break;
          if (other != selfId) continue;
          uvec4 rxB = texelFetch(uReactions, ivec2(int(nid), slot * 2 + 1), 0);
          if (!tempOk(max(selfTemp, nTemp), rxB.r, rxB.g)) continue;
          uint h = hash3(pairKey(px, px + D[i], uFrame, slot));
          if ((h & 0xFFu) >= rxA.b) continue;
          newId = rxA.g;
          transformed = true;
        }
      }
    }

    // (2) Self-consume reaction.
    if (selfId != 0u && !transformed) {
      for (int slot = 0; slot < 3 && !transformed; slot++) {
        uvec4 rxA = texelFetch(uReactions, ivec2(int(selfId), slot * 2), 0);
        uint other = rxA.r;
        if (other == 0u) break;
        uint chance      = rxA.b;
        uint selfConsume = rxA.a;
        if (selfConsume == 0u) continue;
        uvec4 rxB = texelFetch(uReactions, ivec2(int(selfId), slot * 2 + 1), 0);
        if ((rxB.b & 0x01u) != 0u) continue;     // catalyst: self never consumed
        for (int i = 0; i < 8 && !transformed; i++) {
          if (nIds[i] != other) continue;
          uint nTemp = texelFetch(uTemp, px + D[i], 0).r;
          if (!tempOk(max(selfTemp, nTemp), rxB.r, rxB.g)) continue;
          uint h1 = hash3(pairKey(px, px + D[i], uFrame, slot));
          if ((h1 & 0xFFu) >= chance) continue;
          uint h2 = hash3(uvec3(uint(px.x) * 1009u + 7u, uint(px.y) * 31u + 13u,
                                uint(uFrame) * 17u + uint(slot)));
          if ((h2 & 0xFFu) < selfConsume) {
            newId = 0u;
            transformed = true;
          }
        }
      }
    }

    // (3) Corrosion: any neighbor with corrosivity > my (post-react) hardness eats me.
    if (newId != 0u) {
      uint hardness = texelFetch(uTraits, ivec2(int(newId), 1), 0).g;
      uint maxCorr = 0u;
      for (int i = 0; i < 8; i++) {
        uint nid = nIds[i];
        if (nid == 0u || nid == newId) continue;
        uint corr = texelFetch(uTraits, ivec2(int(nid), 1), 0).r;
        if (corr > maxCorr) maxCorr = corr;
      }
      if (maxCorr > hardness) {
        uint diff = maxCorr - hardness;
        uint hc = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 4242u));
        if ((hc & 0x7FFu) < diff) { newId = 0u; transformed = true; }
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
