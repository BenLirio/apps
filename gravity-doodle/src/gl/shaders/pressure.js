// FS_PRESSURE — coarse-grid pressure + airflow. Each coarse cell
// samples its 4×4 region of full-res state, accumulates "mass" (count
// of solid cells weighted by density), updates pressure with neighbor
// diffusion, computes velocity from the pressure gradient, applies
// buoyancy from local hot air, and overrides with airflow sources
// (fan elements with non-zero emitsAirflow).

export const FS_PRESSURE = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uTemp;
  uniform highp usampler2D uAir;
  uniform highp usampler2D uElemData;
  uniform highp usampler2D uTraits;
  uniform ivec2 uSize;
  uniform ivec2 uAirSize;

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    ivec2 baseFull = px * 4;

    int solidCount = 0;
    int gasCount = 0;
    int totalDensity = 0;
    uint sumTemp = 0u;
    uint tempCount = 0u;
    int srcVx = 0, srcVy = 0;
    int srcCount = 0;
    for (int dy = 0; dy < 4; dy++) {
      for (int dx = 0; dx < 4; dx++) {
        ivec2 fp = baseFull + ivec2(dx, dy);
        if (fp.x >= uSize.x || fp.y >= uSize.y) continue;
        uint id = texelFetch(uState, fp, 0).r;
        if (id != 0u) {
          uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
          uint kind = e.r;
          if (kind == 1u || kind == 2u || kind == 3u || kind == 5u) {
            solidCount++;
            totalDensity += int(e.g);
          } else if (kind == 4u) {
            gasCount++;
          }
          // Airflow source from trait row 5: (airflowEmitVx, airflowEmitVy, _, _)
          uvec4 r5 = texelFetch(uTraits, ivec2(int(id), 5), 0);
          int vx = int(r5.r) - 128;
          int vy = int(r5.g) - 128;
          if (vx != 0 || vy != 0) { srcVx += vx; srcVy += vy; srcCount++; }
        }
        sumTemp += texelFetch(uTemp, fp, 0).r;
        tempCount++;
      }
    }

    uvec4 cur = texelFetch(uAir, px, 0);
    uint curPressure = cur.r;
    uint curVx = cur.g;
    uint curVy = cur.b;
    uint curAmb = cur.a;

    // Pressure: target = 128 + density-deviation. Diffuse with neighbors.
    uint pNeighSum = 0u;
    int pCount = 0;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uAirSize.x || np.y >= uAirSize.y) continue;
        pNeighSum += texelFetch(uAir, np, 0).r;
        pCount++;
      }
    }
    float pAvg = pCount > 0 ? float(pNeighSum) / float(pCount) : 128.0;
    float densityP = 128.0 + float(totalDensity - 32) * 0.6;
    float newP = mix(float(curPressure), pAvg, 0.45);
    newP = mix(newP, densityP, 0.08);
    newP = clamp(newP, 0.0, 255.0);

    // Velocity from pressure gradient.
    ivec2 pxL = px - ivec2(1,0); pxL = clamp(pxL, ivec2(0), uAirSize - 1);
    ivec2 pxR = px + ivec2(1,0); pxR = clamp(pxR, ivec2(0), uAirSize - 1);
    ivec2 pxD = px - ivec2(0,1); pxD = clamp(pxD, ivec2(0), uAirSize - 1);
    ivec2 pxU = px + ivec2(0,1); pxU = clamp(pxU, ivec2(0), uAirSize - 1);
    float pL = float(texelFetch(uAir, pxL, 0).r);
    float pR = float(texelFetch(uAir, pxR, 0).r);
    float pD = float(texelFetch(uAir, pxD, 0).r);
    float pU = float(texelFetch(uAir, pxU, 0).r);
    float gradX = (pR - pL) * 0.5;
    float gradY = (pU - pD) * 0.5;

    float ambTempF = tempCount > 0u ? float(sumTemp) / float(tempCount) : 30.0;
    // Buoyancy: hot air rises (vy positive in fragment-y-up).
    float buoy = clamp((ambTempF - 30.0) * 0.06, 0.0, 8.0);

    float vxF = float(int(curVx) - 128) - gradX * 0.35;
    float vyF = float(int(curVy) - 128) - gradY * 0.35 + buoy * 0.4;

    // Damp.
    vxF *= 0.9; vyF *= 0.9;

    // Sources override: a fan in this coarse cell sets the velocity.
    if (srcCount > 0) {
      vxF = float(srcVx) / float(srcCount);
      vyF = float(srcVy) / float(srcCount);
    }

    // Decay ambient temp toward 30.
    float ambNew = mix(ambTempF, 30.0, 0.05);

    uint outVx = uint(clamp(vxF + 128.0, 0.0, 255.0));
    uint outVy = uint(clamp(vyF + 128.0, 0.0, 255.0));
    uint outP = uint(clamp(newP, 0.0, 255.0));
    uint outAmb = uint(clamp(ambNew, 0.0, 255.0));
    outColor = uvec4(outP, outVx, outVy, outAmb);
  }
`;
