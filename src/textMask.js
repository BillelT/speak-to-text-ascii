// Draws a word once on an offscreen 2D canvas and exposes its alpha channel.
// This is the "font renderer" — the only place glyph shapes come from.
// Everything downstream only ever sees a grid of sampled alpha values.

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

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

  return {
    width,
    height,
    // alpha channel only, one byte per pixel
    alphaAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 0;
      return data[(y * width + x) * 4 + 3] / 255;
    },
  };
}
