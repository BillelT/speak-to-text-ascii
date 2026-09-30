// Draws a word once on an offscreen 2D canvas and exposes its alpha channel.
// This is the "font renderer" — the only place glyph shapes come from.
// Everything downstream only ever sees a grid of sampled alpha values.

// Le fallback emoji est nécessaire dès que le texte affiché peut contenir un
// glyphe substitué par Jev (cf. jev.js) — sans lui, certains navigateurs
// dessinent un tofu/carré vide à la place de l'emoji.
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif, ' +
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

const measureCtx = document.createElement("canvas").getContext("2d");

export function measureWidth(text, fontSizePx) {
  measureCtx.font = `600 ${fontSizePx}px ${FONT_FAMILY}`;
  return measureCtx.measureText(text || " ").width;
}

export function renderTextMask(text, fontSizePx) {
  const padding = fontSizePx * 0.4;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `600 ${fontSizePx}px ${FONT_FAMILY}`;
  const metrics = measure.measureText(text || " ");

  const width = Math.max(1, Math.ceil(metrics.width + padding * 2));
  const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.75;
  const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.25;
  const height = Math.max(1, Math.ceil(ascent + descent + padding * 2));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.font = `600 ${fontSizePx}px ${FONT_FAMILY}`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text || "", padding, padding + ascent);

  const { data } = ctx.getImageData(0, 0, width, height);

  // summed-area table of the alpha channel: O(1) box averages, which is what
  // lets the grain density feather smoothly around the glyphs (stipple falloff).
  const w1 = width + 1;
  const sat = new Float32Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += data[(y * width + x) * 4 + 3] / 255;
      sat[(y + 1) * w1 + x + 1] = sat[y * w1 + x + 1] + rowSum;
    }
  }

  return {
    width,
    height,
    // mean alpha inside the square of half-size r centered on (cx, cy)
    meanAt(cx, cy, r) {
      const x0 = Math.max(0, Math.round(cx - r));
      const y0 = Math.max(0, Math.round(cy - r));
      const x1 = Math.min(width, Math.round(cx + r));
      const y1 = Math.min(height, Math.round(cy + r));
      if (x1 <= x0 || y1 <= y0) return 0;
      const sum = sat[y1 * w1 + x1] - sat[y0 * w1 + x1] - sat[y1 * w1 + x0] + sat[y0 * w1 + x0];
      return sum / ((x1 - x0) * (y1 - y0));
    },
    // alpha channel only, one byte per pixel
    alphaAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 0;
      return data[(y * width + x) * 4 + 3] / 255;
    },
  };
}
