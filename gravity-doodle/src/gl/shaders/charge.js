// FS_CHARGE — propagates electrical charge through conductors.
// Sources (chargeEmit != 128) override their cell's charge each frame.
// Conductors diffuse with neighbors. Non-conductors decay toward neutral
// (128 in offset binary).

export const FS_CHARGE = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uCharge;
  uniform highp usampler2D uTraits;
  uniform ivec2 uSize;

  bool isConductor(uint id) {
    if (id == 0u) return false;
    // traits row 4: (conductsBit, chargeEmit, ignitesAtCharge, airflowFactor)
    uvec4 r4 = texelFetch(uTraits, ivec2(int(id), 4), 0);
    return r4.r != 0u;
  }

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uint selfId = texelFetch(uState, px, 0).r;
    uint cur = texelFetch(uCharge, px, 0).r;

    if (selfId == 0u) {
      // Air: decay toward 128 (neutral).
      uint outC;
      if (cur > 128u) outC = cur - 1u;
      else if (cur < 128u) outC = cur + 1u;
      else outC = cur;
      outColor = uvec4(outC, 0u, 0u, 0u);
      return;
    }

    uvec4 r4 = texelFetch(uTraits, ivec2(int(selfId), 4), 0);
    uint conductsBit = r4.r;
    uint chargeEmit  = r4.g;

    // Charge source overrides.
    if (chargeEmit != 128u) {
      outColor = uvec4(chargeEmit, 0u, 0u, 0u);
      return;
    }

    if (conductsBit == 0u) {
      // Insulator: decay slowly.
      uint outC;
      if (cur > 128u) outC = cur - 1u;
      else if (cur < 128u) outC = cur + 1u;
      else outC = cur;
      outColor = uvec4(outC, 0u, 0u, 0u);
      return;
    }

    // Conductor: average charge with conductor neighbors.
    int sumDelta = 0;
    int count = 0;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
        uint nid = texelFetch(uState, np, 0).r;
        if (nid == 0u) continue;
        uvec4 nr4 = texelFetch(uTraits, ivec2(int(nid), 4), 0);
        if (nr4.r == 0u && nr4.g == 128u) continue;            // neither conducts nor sources
        uint nc = texelFetch(uCharge, np, 0).r;
        sumDelta += int(nc) - int(cur);
        count++;
      }
    }
    int newCharge;
    if (count > 0) {
      // Move halfway toward the average.
      newCharge = int(cur) + sumDelta / (count * 2);
    } else {
      // Isolated conductor: decay to neutral.
      newCharge = int(cur);
      if (newCharge > 128) newCharge -= 1;
      else if (newCharge < 128) newCharge += 1;
    }
    newCharge = clamp(newCharge, 0, 255);
    outColor = uvec4(uint(newCharge), 0u, 0u, 0u);
  }
`;
