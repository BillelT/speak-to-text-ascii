#version 300 es
precision highp float;

// one vertex == one grain of the grid. No CPU loop, no per-frame upload:
// the fall is a closed-form function of time, evaluated entirely on GPU.

layout(location = 0) in vec2 aBasePos;   // rest position inside the word, px, centered
layout(location = 1) in float aIntensity; // fill coverage sampled from the text mask (0..1)
layout(location = 2) in vec2 aSeed;      // deterministic per-grain randomness (not time-based)

uniform mat4 uProjection;
uniform vec2 uOrigin;          // where the word sits on screen, px
uniform float uTime;
uniform float uAppearAt;       // uTime value when the word started appearing
uniform float uAppearMs;
uniform float uFallAt;         // uTime value when the word started falling, < 0 == still resting
uniform float uFallFadeMs;
uniform float uGravity;        // px/s^2, positive value, pulled downward internally
uniform float uLateralSpeed;   // px/s
uniform float uFallFloor;      // px below rest position where grains settle, like sand hitting ground
uniform float uPointSize;      // px, already in device pixels

out float vAlpha;

void main() {
  vec2 offset = vec2(0.0);
  float scale = 1.0;
  float alpha = aIntensity;

  float appear = clamp((uTime - uAppearAt) / (uAppearMs * 0.001), 0.0, 1.0);
  appear = 1.0 - pow(1.0 - appear, 3.0); // ease-out: grains "settle" in, not just blink on
  alpha *= appear;
  scale *= appear;

  if (uFallAt >= 0.0) {
    float t = max(uTime - uFallAt, 0.0);
    float vx = (aSeed.x - 0.5) * 2.0 * uLateralSpeed;
    float vy0 = 40.0 + aSeed.y * 60.0; // small upward pop, like sand losing cohesion

    float dx = vx * t;
    float dy = max(vy0 * t - 0.5 * uGravity * t * t, uFallFloor); // settles, doesn't sink further

    offset = vec2(dx, dy);

    float fade = 1.0 - clamp(t / (uFallFadeMs * 0.001), 0.0, 1.0);
    alpha *= fade * fade;
    scale *= mix(1.0, 0.6, 1.0 - fade);
  }

  vec2 world = uOrigin + aBasePos + offset;
  gl_Position = uProjection * vec4(world, 0.0, 1.0);
  gl_PointSize = max(uPointSize * scale, 0.0);
  vAlpha = clamp(alpha, 0.0, 1.0);
}
