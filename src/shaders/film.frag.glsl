#version 300 es
precision highp float;

uniform float uFrame;   // quantized time -> grain re-rolls at a filmic rate
uniform float uAmount;  // 0..1
uniform float uScale;   // device px per grain
out vec4 fragColor;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

void main() {
  uvec2 p = uvec2(gl_FragCoord.xy / uScale);
  uint h = pcg(p.x + pcg(p.y + pcg(uint(uFrame))));
  float n = float(h) / 4294967295.0 - 0.5;   // -0.5 .. 0.5
  float a = pow(abs(n) * 2.0, 1.6) * uAmount; // peaky: mostly quiet, some sharp specks
  fragColor = vec4(vec3(n > 0.0 ? 1.0 : 0.0), a);
}
