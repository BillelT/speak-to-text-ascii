import vertSrc from "./shaders/grain.vert.glsl?raw";
import fragSrc from "./shaders/grain.frag.glsl?raw";
import { renderTextMask, measureWidth } from "./textMask.js";

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function link(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

// Deterministic hash -> two pseudo-random floats in [0,1). Same index always
// gives the same seed, so the grid stays reproducible frame to frame.
function seedFor(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const t = Math.sin(i * 78.233) * 19642.53;
  return [s - Math.floor(s), t - Math.floor(t)];
}

// Width (device px) of the soft halo where grains thin out around the glyphs.
let featherPx = 14;
export function setFeather(px) {
  featherPx = px;
}

// Stipple, not a grid: every cell rolls a die against the local density, and a
// surviving grain lands at a random spot inside its cell. Density is a mix of
// the sharp glyph coverage (keeps letters legible) and a blurred copy of it
// (dissolves the edges into scattered specks, like a noise-sketch brush).
function buildInstances(text, fontSizePx, spacing) {
  const mask = renderTextMask(text, fontSizePx);
  const basePos = [];
  const intensity = [];
  const seed = [];

  const cols = Math.floor(mask.width / spacing);
  const rows = Math.floor(mask.height / spacing);
  const sharpR = Math.max(1, spacing * 0.5);
  const featherR = Math.max(sharpR, featherPx);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * spacing + spacing / 2;
      const cy = row * spacing + spacing / 2;

      const sharp = mask.meanAt(cx, cy, sharpR);
      const soft = mask.meanAt(cx, cy, featherR);
      // interior saturates just under 1 so even the solid body stays noisy
      const density = Math.min(0.97, 0.95 * sharp + 0.5 * soft * soft + 0.2 * soft * sharp);
      if (density < 0.01) continue;

      // two dice per cell: the stipple reads denser without a visible lattice
      for (let k = 0; k < 2; k++) {
        const idx = row * 92821 + col * 6151 + 17 + k * 40009;
        const [rx, ry] = seedFor(idx);
        const [dice, jx] = seedFor(idx + 7919);
        const [jy] = seedFor(idx + 104729);
        if (dice > density) continue;

        const px = cx + (jx - 0.5) * spacing;
        const py = cy + (jy - 0.5) * spacing;
        basePos.push(px - mask.width / 2, mask.height / 2 - py);
        intensity.push(1);
        seed.push(rx, ry);
      }
    }
  }

  return {
    count: basePos.length / 2,
    basePos: new Float32Array(basePos),
    intensity: new Float32Array(intensity),
    seed: new Float32Array(seed),
  };
}

class WordLayer {
  constructor(gl, text, opts) {
    this.gl = gl;
    this.text = text;
    this.state = "interim"; // interim -> final -> falling -> done
    this.appearAt = opts.now;
    this.fallAt = -1;
    this.settleTimer = null;

    this.vao = gl.createVertexArray();
    this.posBuf = gl.createBuffer();
    this.intensityBuf = gl.createBuffer();
    this.seedBuf = gl.createBuffer();
    this.count = 0;

    this.rebuild(opts.fontSizePx, opts.spacing);
  }

  rebuild(fontSizePx, spacing) {
    const gl = this.gl;
    const data = buildInstances(this.text, fontSizePx, spacing);
    this.count = data.count;

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.basePos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.intensity, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.seed, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.posBuf);
    gl.deleteBuffer(this.intensityBuf);
    gl.deleteBuffer(this.seedBuf);
    if (this.settleTimer) clearTimeout(this.settleTimer);
  }
}

export class GrainField {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.canvas = canvas;

    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    this.program = link(gl, vs, fs);

    this.uniforms = {};
    for (const name of [
      "uProjection", "uOrigin", "uTime", "uAppearAt", "uAppearMs",
      "uFallAt", "uFallFadeMs", "uGravity", "uLateralSpeed",
      "uFallFloor", "uPointSize", "uColor", "uSizeVar", "uShimmer",
    ]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    this.layers = [];

    this.params = {
      spacing: 4,
      maxFontSizePx: 220, // upper bound; long phrases shrink to fit the viewport
      minFontSizePx: 42,
      pointSize: 2.5,
      appearMs: 240,
      holdMs: 800, // time a settled word stays whole before it crumbles
      fallFadeMs: 1000,
      gravity: 1700,
      lateralSpeed: 400,
      fallFloor: -400,
      feather: 7,      // css px, width of the stipple halo around glyphs
      sizeVar: 0.35,   // grain size variance
      shimmer: 0.3,    // css px, grain tremble
      background: [1, 1, 1],
      color: [0.05, 0.05, 0.06],
    };
  }

  resize(width, height, dpr) {
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.dpr = dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  fitFontSize(text) {
    const { maxFontSizePx, minFontSizePx } = this.params;
    const targetWidth = this.canvas.width * 0.82;
    const widthAtMax = measureWidth(text, maxFontSizePx * this.dpr);
    if (widthAtMax <= targetWidth) return maxFontSizePx * this.dpr;
    const scaled = (maxFontSizePx * this.dpr * targetWidth) / widthAtMax;
    return Math.max(minFontSizePx * this.dpr, scaled);
  }

  // A phrase is currently forming (interim STT result, or live typing).
  setInterim(text, now) {
    const fontSizePx = this.fitFontSize(text);
    let top = this.layers[this.layers.length - 1];
    if (!top || top.state !== "interim") {
      top = new WordLayer(this.gl, text, {
        now,
        fontSizePx,
        spacing: this.params.spacing * this.dpr,
      });
      this.layers.push(top);
    } else if (top.text !== text) {
      top.text = text;
      top.rebuild(fontSizePx, this.params.spacing * this.dpr);
    }
    return top;
  }

  // The phrase is done — it will hold for `holdMs`, then crumble like sand.
  finalize() {
    const top = this.layers[this.layers.length - 1];
    if (!top || top.state !== "interim") return;
    top.state = "final";
    top.settleTimer = setTimeout(() => this.triggerFall(top), this.params.holdMs);
  }

  triggerFall(layer) {
    if (layer.state === "falling" || layer.state === "done") return;
    layer.state = "falling";
    layer.fallAt = performance.now() / 1000;
  }

  rebuildAll() {
    setFeather(this.params.feather * this.dpr);
    for (const layer of this.layers) {
      layer.rebuild(this.fitFontSize(layer.text), this.params.spacing * this.dpr);
    }
  }

  grainCount() {
    return this.layers.reduce((sum, l) => sum + l.count, 0);
  }

  render(now, projection) {
    const gl = this.gl;
    const bg = this.params.background;
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // drop layers whose fall has fully faded out
    this.layers = this.layers.filter((layer) => {
      if (layer.state !== "falling") return true;
      const t = now - layer.fallAt;
      if (t > this.params.fallFadeMs / 1000 + 0.1) {
        layer.dispose();
        return false;
      }
      return true;
    });

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.uProjection, false, projection);
    gl.uniform1f(this.uniforms.uTime, now);
    gl.uniform1f(this.uniforms.uAppearMs, this.params.appearMs);
    gl.uniform1f(this.uniforms.uFallFadeMs, this.params.fallFadeMs);
    gl.uniform1f(this.uniforms.uGravity, this.params.gravity);
    gl.uniform1f(this.uniforms.uLateralSpeed, this.params.lateralSpeed);
    gl.uniform1f(this.uniforms.uFallFloor, this.params.fallFloor);
    gl.uniform1f(this.uniforms.uPointSize, this.params.pointSize * this.dpr);
    gl.uniform3fv(this.uniforms.uColor, this.params.color);
    gl.uniform1f(this.uniforms.uSizeVar, this.params.sizeVar);
    gl.uniform1f(this.uniforms.uShimmer, this.params.shimmer * this.dpr);
    gl.uniform2f(this.uniforms.uOrigin, 0, 0);

    for (const layer of this.layers) {
      if (layer.count === 0) continue;
      gl.uniform1f(this.uniforms.uAppearAt, layer.appearAt);
      gl.uniform1f(this.uniforms.uFallAt, layer.fallAt);
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.POINTS, 0, layer.count);
    }
    gl.bindVertexArray(null);
  }
}
