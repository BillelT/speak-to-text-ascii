// Minimal column-major mat4 helpers — just enough for two projections:
// a flat orthographic view (the real product, matches the reference 1:1)
// and a perspective orbit view (the debugger, off by default).

function ortho(l, r, b, t, n, f) {
  return new Float32Array([
    2 / (r - l), 0, 0, 0,
    0, 2 / (t - b), 0, 0,
    0, 0, -2 / (f - n), 0,
    -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1,
  ]);
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, center, up) {
  const z = normalize(sub(eye, center));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a) => {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
};

// Orbit camera used only by the debugger. Drag to rotate, wheel to zoom.
export class OrbitCamera {
  constructor(el) {
    this.el = el;
    this.enabled = false;
    this.azimuth = 0.5;
    this.elevation = 0.35;
    this.distance = 3200;
    this.dragging = false;
    this.last = [0, 0];

    el.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      this.dragging = true;
      this.last = [e.clientX, e.clientY];
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.enabled || !this.dragging) return;
      const dx = e.clientX - this.last[0];
      const dy = e.clientY - this.last[1];
      this.last = [e.clientX, e.clientY];
      this.azimuth -= dx * 0.006;
      this.elevation = Math.max(-1.3, Math.min(1.3, this.elevation - dy * 0.006));
    });
    el.addEventListener("pointerup", () => (this.dragging = false));
    el.addEventListener("pointercancel", () => (this.dragging = false));
    el.addEventListener(
      "wheel",
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.distance = Math.max(500, Math.min(9000, this.distance + e.deltaY * 2));
      },
      { passive: false },
    );
  }

  reset() {
    this.azimuth = 0.5;
    this.elevation = 0.35;
    this.distance = 3200;
  }

  projection(width, height) {
    if (!this.enabled) {
      return ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);
    }
    const eye = [
      this.distance * Math.cos(this.elevation) * Math.sin(this.azimuth),
      this.distance * Math.sin(this.elevation),
      this.distance * Math.cos(this.elevation) * Math.cos(this.azimuth),
    ];
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const proj = perspective((45 * Math.PI) / 180, width / height, 10, 20000);
    return multiply(proj, view);
  }
}
