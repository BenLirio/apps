// FS_CELLULAR — Conway-style growth with optional anisotropy.
//
// Encoding:
//   cellularDataTex row 0: (bornMaskLo, surviveMaskLo, growChance, surviveChance)
//   cellularDataTex row 1: (extras, birthFromId0, birthFromId1, birthFromId2)
//     extras low bits: bornMask bit 8, surviveMask bit 8, tick (4 bits),
//                      growBias (2 bits, 0=any 1=up 2=down 3=side).

import { SH_HASH } from './common.js';

export const FS_CELLULAR = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uCellularData;
  uniform ivec2 uSize;
  uniform uint uCellularId;
  uniform int uFrame;
  ${SH_HASH}

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    bool selfIsThis  = (self.r == uCellularId);
    bool selfIsEmpty = (self.r == 0u);
    if (!selfIsThis && !selfIsEmpty) { outColor = self; return; }

    uvec4 cd0 = texelFetch(uCellularData, ivec2(int(uCellularId), 0), 0);
    uvec4 cd1 = texelFetch(uCellularData, ivec2(int(uCellularId), 1), 0);
    uint bornMask    = cd0.r | ((cd1.r & 1u) << 8u);
    uint surviveMask = cd0.g | ((cd1.r & 2u) << 7u);
    uint growChance  = cd0.b;
    uint survChance  = cd0.a;
    uint bF0 = cd1.g;
    uint bF1 = cd1.b;
    uint bF2 = cd1.a;
    uint growBias = (cd1.r >> 6u) & 0x3u;   // 0=any 1=up 2=down 3=side

    uint nCount = 0u;
    uint nUp = 0u, nDown = 0u, nSide = 0u;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
        uint nId = texelFetch(uState, np, 0).r;
        if (nId == 0u) continue;
        if (nId == uCellularId
            || (bF0 != 0u && nId == bF0)
            || (bF1 != 0u && nId == bF1)
            || (bF2 != 0u && nId == bF2)) {
          nCount++;
          // Track which side the support is on.
          if (dy < 0) nDown++;       // support below me (in fragment-y-up, dy<0 = below)
          else if (dy > 0) nUp++;    // support above me
          else nSide++;
        }
      }
    }
    if (nCount > 8u) nCount = 8u;
    uint maskBit = 1u << nCount;
    uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame)));

    if (selfIsThis) {
      bool survives = (surviveMask & maskBit) != 0u;
      if (!survives) {
        uint h2 = (h >> 8u) & 0xFFu;
        if (h2 >= survChance) { outColor = uvec4(0u); return; }
      }
      outColor = self;
      return;
    }

    if ((bornMask & maskBit) != 0u) {
      // growBias: vine grows from below (support comes from down → cell appears above)
      // 1 = up: prefer to be born when support is below me (extend upward).
      // 2 = down: prefer to be born when support is above me (root downward).
      // 3 = side: prefer side support.
      bool biasOk = true;
      if (growBias == 1u) biasOk = (nDown >= 1u);
      else if (growBias == 2u) biasOk = (nUp >= 1u);
      else if (growBias == 3u) biasOk = (nSide >= 1u);
      if (!biasOk) { outColor = self; return; }
      uint h3 = h & 0xFFu;
      if (h3 < growChance) {
        uint v = (h >> 16u) & 3u;
        outColor = uvec4(uCellularId, v, 0u, 0u);
        return;
      }
    }
    outColor = self;
  }
`;
