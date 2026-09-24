#version 300 es
precision highp float;

in float vAlpha;
uniform vec3 uColor;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float edge = smoothstep(1.0, 0.55, d);
  fragColor = vec4(uColor, vAlpha * edge);
}
