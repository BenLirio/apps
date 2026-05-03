// Geometric overlap scoring.
//
// Both the player's drawing and the reference country outline are rasterized
// to the SAME offscreen canvas size, then we count pixels where each is filled
// to compute Intersection-over-Union. IoU * 100 = the round score (0-100).
//
// IoU is the simplest reliable shape-similarity metric — fully deterministic,
// no AI, no API. We also reward "decent attempt" by lifting low scores on a
// gentle curve so a sloppy-but-recognisable outline scores ~40 instead of 8.

const SCORE_RES = 240; // offscreen canvas resolution (square)

// Fit a normalized [0..1] polygon into the canvas, preserving aspect ratio.
// We keep the original aspect (it's already normalized) and center it.
function fitPolyToCanvas(poly, w, h, pad = 0.08) {
  const minX = Math.min(...poly.map(p => p[0]));
  const maxX = Math.max(...poly.map(p => p[0]));
  const minY = Math.min(...poly.map(p => p[1]));
  const maxY = Math.max(...poly.map(p => p[1]));
  const pw = maxX - minX || 1;
  const ph = maxY - minY || 1;
  const usableW = w * (1 - 2 * pad);
  const usableH = h * (1 - 2 * pad);
  const scale = Math.min(usableW / pw, usableH / ph);
  const offX = (w - pw * scale) / 2 - minX * scale;
  const offY = (h - ph * scale) / 2 - minY * scale;
  return poly.map(([x, y]) => [x * scale + offX, y * scale + offY]);
}

function rasterizePolygon(poly, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.beginPath();
  poly.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, w, h);
}

function rasterizeStroke(points, w, h, strokeWidth) {
  // Players draw a stroke (open path). To compare to a filled reference shape
  // we close the path and fill it. We also stroke it with width to handle
  // skinny shapes (Chile, Norway) and so a clean outline still has area.
  if (points.length < 3) {
    const empty = new ImageData(w, h);
    return empty;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, w, h);
}

// Player's stroke comes in as canvas-pixel coords (from their device's drawing
// canvas). Normalize to 0..1 by their canvas bounds, then fit into our scoring
// canvas the same way the reference is fit. This makes the comparison
// device-size-agnostic.
function normalizeStroke(points, srcW, srcH) {
  if (!points.length) return [];
  return points.map(([x, y]) => [x / srcW, y / srcH]);
}

export function scoreDrawing(strokePointsPx, srcW, srcH, referencePoly) {
  const W = SCORE_RES, H = SCORE_RES;

  const strokeNorm = normalizeStroke(strokePointsPx, srcW, srcH);
  const strokeFit = fitPolyToCanvas(strokeNorm, W, H);
  const refFit = fitPolyToCanvas(referencePoly, W, H);

  const strokeImg = rasterizeStroke(strokeFit, W, H, 6);
  const refImg = rasterizePolygon(refFit, W, H);

  let inter = 0, sUnion = 0;
  // Fill alpha is at index 3, every 4 bytes
  const sd = strokeImg.data;
  const rd = refImg.data;
  for (let i = 3; i < sd.length; i += 4) {
    const sFilled = sd[i] > 0 ? 1 : 0;
    const rFilled = rd[i] > 0 ? 1 : 0;
    if (sFilled || rFilled) sUnion++;
    if (sFilled && rFilled) inter++;
  }
  const iou = sUnion === 0 ? 0 : inter / sUnion;

  // Lift the curve. Pure IoU is brutal — even a great freehand match rarely
  // exceeds 0.55. Map [0..1] → [0..100] but with a gentler curve so a 0.30
  // IoU (visibly the right shape) reads as ~55 instead of 30.
  const score = Math.round(Math.pow(iou, 0.65) * 100);
  return Math.min(100, Math.max(0, score));
}

// Render a small reveal that overlays the player's stroke on top of the
// reference shape, into a target canvas. Used on the round-result screen so
// players can see why their score was what it was.
export function renderOverlay(targetCanvas, strokePointsPx, srcW, srcH, referencePoly, palette) {
  const ctx = targetCanvas.getContext('2d');
  const w = targetCanvas.width;
  const h = targetCanvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background paper
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, w, h);

  // Reference (filled, faint)
  const refFit = fitPolyToCanvas(referencePoly, w, h);
  ctx.fillStyle = palette.refFill;
  ctx.beginPath();
  refFit.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = palette.refStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Player stroke (in its own coordinate space, then fit the same way)
  if (strokePointsPx.length > 1) {
    const strokeNorm = normalizeStroke(strokePointsPx, srcW, srcH);
    const strokeFit = fitPolyToCanvas(strokeNorm, w, h);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    strokeFit.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
  }
}
