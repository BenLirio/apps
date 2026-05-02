// FS_RENDER — palette lookup with subtle hot-glow + charge halo. The
// only shader whose output goes to the default framebuffer (the canvas).

import { SH_HASH } from './common.js';

export const FS_RENDER = `#version 300 es
  precision highp float;
  precision highp int;
  in vec2 vUv;
  out vec4 outColor;

  uniform highp usampler2D uState;
  uniform sampler2D uPalette;
  uniform highp usampler2D uElemData;
  uniform highp usampler2D uTemp;
  uniform highp usampler2D uCharge;
  uniform ivec2 uSize;
  uniform int uFrame;
  ${SH_HASH}

  void main() {
    ivec2 px = ivec2(vUv * vec2(uSize));
    px = clamp(px, ivec2(0), uSize - ivec2(1));
    uvec4 c = texelFetch(uState, px, 0);
    uint temp = texelFetch(uTemp, px, 0).r;
    uint ch = texelFetch(uCharge, px, 0).r;

    vec3 rgb;
    if (c.r == 0u) {
      // Empty: dark background. Hint at temperature in the air via warm tint.
      float warm = clamp((float(temp) - 30.0) / 100.0, 0.0, 1.0);
      rgb = mix(vec3(0.059, 0.055, 0.047), vec3(0.18, 0.07, 0.04), warm * 0.5);
    } else {
      uvec4 e = texelFetch(uElemData, ivec2(int(c.r), 0), 0);
      uint variant;
      if ((e.a & 0x80u) != 0u) {
        uint h = uint(px.x) * 73856093u ^ uint(px.y) * 19349663u ^ uint(uFrame >> 2) * 83492791u;
        variant = h & 3u;
      } else {
        variant = c.g & 3u;
      }
      rgb = texelFetch(uPalette, ivec2(int(c.r), int(variant)), 0).rgb;
      // Hot-element glow: above 120, brighten toward warm.
      if (temp > 120u) {
        float k = clamp((float(temp) - 120.0) / 100.0, 0.0, 0.6);
        rgb = mix(rgb, vec3(1.0, 0.7, 0.3), k * 0.45);
      }
    }
    // Charge halo: cells with strong charge get a blue/violet tint that
    // shimmers per frame so charge is visible without a separate overlay.
    int signedCharge = int(ch) - 128;
    int chargeMag = abs(signedCharge);
    if (chargeMag > 12) {
      float k = clamp(float(chargeMag) / 127.0, 0.0, 1.0);
      uint h = hash3(uvec3(uint(px.x), uint(px.y), uint(uFrame >> 1)));
      float flicker = float(h & 0xFFu) / 255.0;
      vec3 chargeTint = (signedCharge > 0)
        ? vec3(0.55, 0.75, 1.0)   // positive: cyan-white
        : vec3(0.95, 0.55, 1.0);  // negative: magenta
      rgb = mix(rgb, chargeTint, k * 0.45 * (0.6 + 0.4 * flicker));
    }
    outColor = vec4(rgb, 1.0);
  }
`;
