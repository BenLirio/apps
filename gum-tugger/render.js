// render.js — canvas rendering for the strand, the ghost, and the chrome.
//
// Pure rendering — no physics, no input. Takes a `strand` and a `ghost` and a
// `ctx` + dimensions, paints one frame. State (positions, strains) is passed
// in from loop.js; this file does not own simulation state.

export function bakeGrain(w, h) {
  if (w <= 0 || h <= 0) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = 220 + Math.floor(Math.random() * 35);
    data[i]   = v;
    data[i+1] = v - 6;
    data[i+2] = v - 18;
    data[i+3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function drawBackdrop(ctx, cssW, cssH, grainCanvas) {
  ctx.clearRect(0, 0, cssW, cssH);
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, '#f8f0df');
  grad.addColorStop(1, '#ebdfc1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);
  if (grainCanvas) {
    ctx.globalAlpha = 0.12;
    ctx.drawImage(grainCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }
}

export function drawAnchorClamp(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#5d5142';
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 2);
  ctx.lineTo(x + 22, y - 2);
  ctx.lineTo(x + 14, y + 10);
  ctx.lineTo(x - 14, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a6c58';
  ctx.fillRect(x - 1.5, y + 8, 3, 6);
  ctx.restore();
}

export function drawStrand(ctx, s, cssW, opts) {
  const nodes = s.nodes;
  const n = nodes.length;
  const restL = s.restSegLen;

  // Per-node thickness based on local strain. Real gum thins fastest at the
  // midpoint, so we apply a sin() taper across the chain on top of strain.
  const baseW = Math.max(8, Math.min(18, cssW * 0.038));
  const widths = new Array(n);
  for (let i = 0; i < n; i++) {
    let strain = 1;
    if (i > 0 && i < n - 1) {
      const a = nodes[i - 1], b = nodes[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) / 2;
      strain = Math.max(0.5, segLen / restL);
    } else if (i > 0) {
      const a = nodes[i - 1];
      const segLen = Math.hypot(nodes[i].x - a.x, nodes[i].y - a.y);
      strain = Math.max(0.5, segLen / restL);
    } else {
      strain = 1;
    }
    const mid = i / (n - 1);
    const taperToMiddle = 1 - 0.55 * Math.sin(mid * Math.PI); // ~1 at ends, ~0.45 at middle
    const w = (baseW / Math.pow(strain, 0.95)) * taperToMiddle;
    widths[i] = Math.max(0.6, w);
  }

  // Layer stack:
  // 1) Soft drop-shadow ribbon (offset, dark, low alpha)
  drawRibbon(ctx, nodes, widths, 'rgba(60, 30, 50, 0.18)', 1.05, 1.5, 0);
  // 2) Pink core
  drawRibbon(ctx, nodes, widths, '#ff8db7', 1.0, 0, -1);
  // 3) Inner highlight (skinnier, lighter)
  drawRibbon(ctx, nodes, widthsScaled(widths, 0.42), 'rgba(255, 213, 227, 0.85)', 1.0, 0, -1.5);
  // 4) Specular hairline along one side
  drawSpecular(ctx, nodes, widths);
  // 5) Translucent thinning at midpoint when strain is high
  const strain = opts.maxStrain;
  if (strain > 2.6) drawTranslucentThin(ctx, nodes, widths, strain);
  // 6) String-bridges near snap
  if (strain > 3.4 && !s.snapped && !s.recoiling) drawStringBridge(ctx, nodes, widths, strain);
  // 7) Recoil flash
  if (s.recoiling) drawRecoil(ctx, s);
}

function widthsScaled(arr, k) { return arr.map(v => Math.max(0.4, v * k)); }

function drawRibbon(ctx, nodes, widths, color, widthMul, offsetX, offsetY) {
  const left = [], right = [];
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const prev = nodes[Math.max(0, i - 1)];
    const next = nodes[Math.min(nodes.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.max(1e-3, Math.hypot(tx, ty));
    const nx = -ty / tl;
    const ny =  tx / tl;
    const w = (widths[i] * widthMul) * 0.5;
    left.push({  x: p.x + nx * w + offsetX, y: p.y + ny * w + offsetY });
    right.push({ x: p.x - nx * w + offsetX, y: p.y - ny * w + offsetY });
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawSpecular(ctx, nodes, widths) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < nodes.length; i++) {
    if (widths[i] < 4) { started = false; continue; }
    const p = nodes[i];
    const prev = nodes[Math.max(0, i - 1)];
    const next = nodes[Math.min(nodes.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.max(1e-3, Math.hypot(tx, ty));
    const nx = -ty / tl, ny = tx / tl;
    const w = widths[i] * 0.5 * 0.55;
    const lx = p.x + nx * w * 0.6;
    const ly = p.y + ny * w * 0.6;
    if (!started) { ctx.moveTo(lx, ly); started = true; }
    else ctx.lineTo(lx, ly);
  }
  ctx.stroke();
}

function drawTranslucentThin(ctx, nodes, widths, strain) {
  let minI = 0, minW = Infinity;
  for (let i = 1; i < nodes.length - 1; i++) {
    if (widths[i] < minW) { minW = widths[i]; minI = i; }
  }
  const p = nodes[minI];
  const r = Math.max(8, minW * 1.6 + (strain - 2) * 4);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, 'rgba(248, 240, 223, 0.85)');
  g.addColorStop(0.6, 'rgba(248, 240, 223, 0.25)');
  g.addColorStop(1, 'rgba(248, 240, 223, 0.0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStringBridge(ctx, nodes, widths, strain) {
  let minI = 1, minW = Infinity;
  for (let i = 1; i < nodes.length - 1; i++) {
    if (widths[i] < minW) { minW = widths[i]; minI = i; }
  }
  const a = nodes[minI - 1], b = nodes[minI + 1];
  const hairs = Math.min(7, Math.floor((strain - 3.0) * 4));
  ctx.strokeStyle = 'rgba(255, 141, 183, 0.75)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let h = 0; h < hairs; h++) {
    const t1 = 0.05 + Math.random() * 0.9;
    const t2 = t1 + 0.04 + Math.random() * 0.05;
    const x1 = a.x + (b.x - a.x) * t1 + (Math.random() - 0.5) * 1.4;
    const y1 = a.y + (b.y - a.y) * t1 + (Math.random() - 0.5) * 1.4;
    const x2 = a.x + (b.x - a.x) * t2 + (Math.random() - 0.5) * 1.4;
    const y2 = a.y + (b.y - a.y) * t2 + (Math.random() - 0.5) * 1.4;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

function drawRecoil(ctx, s) {
  const t = (performance.now() - s.recoilStart) / 360;
  if (t > 1) return;
  const a = 1 - t;
  ctx.fillStyle = `rgba(217, 106, 147, ${0.35 * a})`;
  for (const n of s.nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3 + 2 * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGhostStrands(ctx, ghost, cssW, cssH, now, pxPerCm) {
  const baseX = cssW * 0.12;
  const gap = Math.max(18, cssW * 0.06);
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < ghost.lengths.length; i++) {
    const cm = ghost.lengths[i];
    const lenPx = cm * pxPerCm;
    const x = baseX + i * gap;
    const wob = Math.sin((now / 700) + i) * 1.2;
    ctx.strokeStyle = '#d96a93';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + wob, 6);
    ctx.lineTo(x - wob, Math.min(cssH - 12, 6 + lenPx));
    ctx.stroke();
    ctx.fillStyle = '#d96a93';
    ctx.beginPath();
    ctx.arc(x - wob, Math.min(cssH - 12, 6 + lenPx), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c4f60';
    ctx.font = '10px "Special Elite", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cm.toFixed(1), x, Math.min(cssH - 2, 6 + lenPx + 12));
  }
  ctx.restore();
}
