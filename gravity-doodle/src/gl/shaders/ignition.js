// FS_IGNITION — ignites cells either by temperature OR by charge
// magnitude (the ignitesAtCharge trait, e.g. gunpowder pops at low charge).

import { SH_HASH } from './common.js';

export const FS_IGNITION = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uTemp;
  uniform highp usampler2D uTraits;
  uniform highp usampler2D uCharge;
  uniform ivec2 uSize;
  uniform int uFrame;
  uniform uint uFireId;
  ${SH_HASH}

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    if (self.r == 0u) { outColor = self; return; }
    uvec4 r0 = texelFetch(uTraits, ivec2(int(self.r), 0), 0);
    uvec4 r4 = texelFetch(uTraits, ivec2(int(self.r), 4), 0);
    uint ignitionPoint = r0.g;
    uint flammability  = r0.b;
    uint ignitesAtCh   = r4.b;       // trait row 4: (conductsBit, chargeEmit, ignitesAtCharge, airflowFactor)
    uint temp = texelFetch(uTemp, px, 0).r;
    uint chRaw = texelFetch(uCharge, px, 0).r;
    int chargeMag = abs(int(chRaw) - 128);

    bool tempIgnite   = (flammability > 0u) && (temp >= ignitionPoint);
    bool chargeIgnite = (ignitesAtCh > 0u) && (uint(chargeMag) >= ignitesAtCh);
    if (!tempIgnite && !chargeIgnite) { outColor = self; return; }

    // Charge ignition is strong (always rolls); temp ignition rolls
    // against flammability.
    uint h = hash3(uvec3(uint(px.x) * 1009u + 7u, uint(px.y) * 31u + 13u, uint(uFrame) * 41u + 3u));
    if (chargeIgnite || ((h & 0xFFu) < flammability)) {
      if (uFireId == 0u) outColor = uvec4(0u);
      else {
        uint v = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame) + 1234u)) & 3u;
        outColor = uvec4(uFireId, v, 0u, 0u);
      }
      return;
    }
    outColor = self;
  }
`;
