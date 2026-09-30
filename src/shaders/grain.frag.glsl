#version 300 es
precision highp float;

in float vAlpha;
in float vSize;
uniform vec3 uColor;
out vec4 fragColor;

void main() {
  // a perfect disc: hard edge, antialiased over exactly ~1 device pixel
  float r = length(gl_PointCoord * 2.0 - 1.0);
  if (r > 1.0) discard;
  float aa = clamp(2.0 / max(vSize, 1.0), 0.05, 1.0);
  float edge = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  fragColor = vec4(uColor, vAlpha * edge);
}
