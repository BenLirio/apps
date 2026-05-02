// FS_CLEAR — write zeros. Used as a generic "blank this texture" pass.

export const FS_CLEAR = `#version 300 es
  precision highp float; precision highp int;
  in vec2 vUv;
  out uvec4 outColor;
  void main() { outColor = uvec4(0u); }
`;
