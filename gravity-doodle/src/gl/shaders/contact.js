// FS_CONTACT — primes explosive cells whose neighborhood has a non-
// explosive solid (i.e. they've landed). Sets ra=255 to mark "primed";
// the next pass (blast) consumes primed cells.

export const FS_CONTACT = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  uniform highp usampler2D uState;
  uniform highp usampler2D uElemData;
  uniform ivec2 uSize;

  bool isExplosiveId(uint id) {
    if (id == 0u) return false;
    uvec4 e = texelFetch(uElemData, ivec2(int(id), 0), 0);
    return (e.a & 0x80u) != 0u;
  }

  void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    uvec4 self = texelFetch(uState, px, 0);
    if (self.r == 0u) { outColor = self; return; }
    if (!isExplosiveId(self.r)) { outColor = self; return; }
    if (self.a == 255u) { outColor = self; return; }   // already primed
    if (self.b > 0u) { outColor = self; return; }      // settle window

    bool triggered = false;
    for (int dy = -1; dy <= 1 && !triggered; dy++) {
      for (int dx = -1; dx <= 1 && !triggered; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 np = px + ivec2(dx, dy);
        if (np.x < 0 || np.y < 0 || np.x >= uSize.x || np.y >= uSize.y) continue;
        uvec4 n = texelFetch(uState, np, 0);
        if (n.r == 0u) continue;
        if (isExplosiveId(n.r)) continue;
        triggered = true;
      }
    }
    if (triggered) self.a = 255u;
    outColor = self;
  }
`;
