// Shared vertex shader (a fullscreen quad) and a hash helper that
// fragment shaders embed via `${SH_HASH}` to get deterministic randomness
// per (x, y, frame).

export const VS_QUAD = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export const SH_HASH = `
  uint hash3(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= (v >> 16u);
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v.x;
  }
  float rand01(uvec3 v) { return float(hash3(v) & 0xFFFFFFu) / float(0x1000000u); }
`;
