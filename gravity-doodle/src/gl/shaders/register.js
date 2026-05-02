// FS_REGISTER — per-element register tick. ra changes by raDelta each
// frame (signed via offset binary, 128 = no change). When ra hits raDiesAt,
// the cell either dies (raTransformsTo == 0) or transforms (id swap).

import { SH_HASH } from './common.js';

export const FS_REGISTER = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uRegisters;
  uniform highp usampler2D uElemData;
  uniform ivec2 uSize;
  uniform int uFrame;
  ${SH_HASH}

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    if (self.r == 0u) { outColor = self; return; }
    uvec4 reg = texelFetch(uRegisters, ivec2(int(self.r), 0), 0);
    uint raDeltaOffset = reg.g;
    if (raDeltaOffset == 128u) { outColor = self; return; }   // no register tick

    uint raDiesAt    = reg.b;
    uint raTransform = reg.a;

    int delta = int(raDeltaOffset) - 128;
    uint oldRa = self.b;
    int newRa = int(oldRa) + delta;
    newRa = clamp(newRa, 0, 255);

    // Hit the death/transform threshold? Require crossing it in the
    // direction of the delta — otherwise an unreachable raDiesAt (e.g.,
    // explosive's 255 with downward decay) would fire on every frame.
    bool hit = false;
    if (delta < 0 && uint(newRa) <= raDiesAt && oldRa > raDiesAt) hit = true;
    else if (delta > 0 && uint(newRa) >= raDiesAt && oldRa < raDiesAt) hit = true;

    if (hit) {
      if (raTransform == 0u) { outColor = uvec4(0u); return; }
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 7777u));
      uint v = h & 3u;
      // Inherit register defaults of the new element so the chain can
      // continue (e.g., uranium → stone with stone's defaults).
      uvec4 newReg = texelFetch(uRegisters, ivec2(int(raTransform), 0), 0);
      uvec4 elem   = texelFetch(uElemData, ivec2(int(raTransform), 0), 0);
      uint newRaVal = newReg.r;
      if (elem.r == 4u && newRaVal == 0u) newRaVal = 120u;     // gas default life
      outColor = uvec4(raTransform, v, newRaVal, 0u);
      return;
    }

    outColor = uvec4(self.r, self.g, uint(newRa) & 0xFFu, self.a);
  }
`;
