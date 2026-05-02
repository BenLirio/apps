// FS_HEAT — temperature diffusion plus emitTemp pull plus ambient decay.
// Self-element conductivity controls how fast a cell averages with its
// neighbors; emitTemp is the cell's "owned" baseline.

export const FS_HEAT = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uTemp;
  uniform highp usampler2D uTraits;
  uniform ivec2 uSize;

  struct TraitInfo {
    uint emitTemp;
    uint ignitionPoint;
    uint flammability;
    uint conductivity;
    uint corrosivity;
    uint hardness;
  };
  TraitInfo getTraits(uint id) {
    uvec4 r0 = texelFetch(uTraits, ivec2(int(id), 0), 0);
    uvec4 r1 = texelFetch(uTraits, ivec2(int(id), 1), 0);
    return TraitInfo(r0.r, r0.g, r0.b, r0.a, r1.r, r1.g);
  }

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uint selfId = texelFetch(uState, px, 0).r;
    uint cur = texelFetch(uTemp, px, 0).r;
    uint sum = 0u;
    uint count = 0u;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
        sum += texelFetch(uTemp, np, 0).r;
        count++;
      }
    }
    float avg = count > 0u ? float(sum) / float(count) : float(cur);
    float curF = float(cur);

    TraitInfo t;
    if (selfId == 0u) {
      t.emitTemp = 30u; t.ignitionPoint = 255u; t.flammability = 0u;
      t.conductivity = 100u; t.corrosivity = 0u; t.hardness = 0u;
    } else {
      t = getTraits(selfId);
    }
    float k = float(t.conductivity) / 255.0;
    float newT = mix(curF, avg, clamp(k * 0.5, 0.0, 0.5));

    float emit = float(t.emitTemp);
    if (emit > newT) newT = mix(newT, emit, 0.30);
    else             newT = mix(newT, emit, 0.05);

    newT = mix(newT, 30.0, 0.015);

    uint outT = uint(clamp(newT, 0.0, 255.0));
    outColor = uvec4(outT, 0u, 0u, 0u);
  }
`;
