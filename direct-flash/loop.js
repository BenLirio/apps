// loop.js — state machine for the camera (calibrate → preview → flash →
// develop → reveal → again) plus the procedural scene renderer for both the
// live viewfinder and the developed photo card.
//
// The "photo" is fully procedural — no real camera access. Each scene is a
// small composition of layered shapes with a hot-flash washout, slight
// chromatic aberration, off-center subject, and 2008-digicam grain. The
// tilt vector seeds per-render randomness so the live preview reacts to
// motion and the captured card differs from one tilt to the next.

import {
  requestPermissionAndCalibrate,
  recalibrate,
  onTilt,
  currentTilt,
  pickScene,
  SCENES,
} from './controls.js';

let lastShot = null;
let mode = 'cal';

const $ = (id) => document.getElementById(id);

export function getLastShot() { return lastShot; }

export function startCamera() {
  $('btn-permit').addEventListener('click', onPermit);
  $('btn-recal').addEventListener('click', onRecal);
  $('btn-flash').addEventListener('click', onFlash);
  $('btn-help').addEventListener('click', () => $('modal-help').hidden = false);
  $('btn-close-help').addEventListener('click', () => $('modal-help').hidden = true);
  $('btn-again').addEventListener('click', onAgain);
  $('btn-save').addEventListener('click', onSave);

  // Spacebar = flash on desktop fallback.
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && mode === 'preview') { e.preventDefault(); onFlash(); }
  });

  // Live preview redraw: subscribe to tilt updates AND keep an idle rAF so
  // the bottom REC indicator + slight scene drift still animate when no
  // motion is happening. Cap dt for tab-switch resilience.
  const previewCanvas = $('preview');
  const pctx = previewCanvas.getContext('2d');
  let lastNow = performance.now();
  let drift = 0;

  onTilt((v) => {
    if (mode !== 'preview') return;
    const scene = pickScene(v);
    updateReadouts(v, scene);
    drawScene(pctx, previewCanvas.width, previewCanvas.height, scene, v, drift, false);
  });

  function tick(now) {
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    drift += dt;
    if (mode === 'preview') {
      const v = currentTilt();
      const scene = pickScene(v);
      drawScene(pctx, previewCanvas.width, previewCanvas.height, scene, v, drift, false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function onPermit() {
  const btn = $('btn-permit');
  btn.disabled = true;
  btn.textContent = 'CALIBRATING…';
  const result = await requestPermissionAndCalibrate();
  if (result.mode !== 'sensor') {
    $('perm-hint')?.removeAttribute('hidden');
  }
  enterPreview();
}

function enterPreview() {
  mode = 'preview';
  $('panel-calibrate').dataset.active = 'false';
  $('panel-calibrate').setAttribute('hidden', '');
  $('panel-view').removeAttribute('hidden');
  $('panel-view').dataset.active = 'true';
  $('panel-card').setAttribute('hidden', '');
  // Force one tilt-driven readout immediately.
  const v = currentTilt();
  updateReadouts(v, pickScene(v));
}

function onRecal() {
  recalibrate();
  // Quick visual ping on recal — the panel-bar pulses.
  const bar = $('panel-view').querySelector('.panel-bar');
  // No bar inside view panel — fall through; the readout will update naturally.
}

function onFlash() {
  if (mode !== 'preview') return;
  mode = 'flashing';
  const v = currentTilt();
  const scene = pickScene(v);

  // Capture the shot — sample current tilt + a fresh seed so the developed
  // card has its own per-shot variation independent of subsequent preview drift.
  const shot = {
    sceneId: scene.id,
    sceneName: scene.name,
    caption: scene.caption,
    tilt: { pitch: v.pitch, roll: v.roll },
    seed: Math.floor(Math.random() * 2 ** 30),
    takenAt: new Date(),
  };
  lastShot = shot;

  // Trigger the screen-flash overlay.
  const overlay = $('flash-overlay');
  overlay.classList.remove('firing');
  // Reflow so the animation restarts cleanly even on repeat flashes.
  void overlay.offsetWidth;
  overlay.classList.add('firing');

  // Tiny click via WebAudio if available — no asset, no network cost.
  shutterClick();

  // Mid-flash, swap to the developed card panel and run the develop animation.
  setTimeout(() => {
    renderCard(shot);
    $('panel-view').setAttribute('hidden', '');
    $('panel-card').removeAttribute('hidden');
    const dev = $('developed');
    dev.classList.remove('developing');
    void dev.offsetWidth;
    dev.classList.add('developing');
    mode = 'card';
  }, 220);
}

function onAgain() {
  enterPreview();
}

function onSave() {
  if (!lastShot) return;
  const c = $('card-canvas');
  try {
    const url = c.toDataURL('image/png');
    const a = document.createElement('a');
    const stamp = lastShot.takenAt.toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `direct-flash-${lastShot.sceneId}-${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    // Some mobile browsers block download — fall back to opening the data URL.
    window.open(c.toDataURL('image/png'), '_blank');
  }
}

function updateReadouts(v, scene) {
  $('scene-name').textContent = scene.name.toUpperCase();
  $('tilt-readout').textContent =
    `P ${Math.round(v.pitch).toString().padStart(2, ' ')}° · R ${Math.round(v.roll).toString().padStart(2, ' ')}°`;
}

// ---------- Scene rendering ----------
//
// Scenes are layered procedural compositions painted onto a 2D canvas. We
// share one renderer between the live preview (~640×800) and the developed
// card (~900×1125), so the same composition reads at both sizes. Then we
// post-process: hot-flash washout (radial white burst from off-center),
// slight chromatic aberration on edges, low-contrast then push-back, and
// 2000s-digicam grain.

function drawScene(ctx, W, H, scene, tilt, t, finalShot) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Subtle off-center subject offset — paparazzi shake. For live preview
  // we let it react to tilt for the "morphing as you move" feel.
  const offX = (tilt.roll  / 90) * 0.18 * W;
  const offY = (-tilt.pitch / 90) * 0.18 * H;

  switch (scene.id) {
    case 'ceiling': drawCeiling(ctx, W, H, t, offX, offY); break;
    case 'shoes':   drawShoes(ctx, W, H, t, offX, offY); break;
    case 'club':    drawClub(ctx, W, H, t, offX, offY); break;
    case 'wall':    drawWall(ctx, W, H, t, offX, offY); break;
    case 'booth':   drawBooth(ctx, W, H, t, offX, offY); break;
    case 'selfie':  drawSelfie(ctx, W, H, t, offX, offY); break;
    case 'drink':   drawDrink(ctx, W, H, t, offX, offY); break;
    default:        drawClub(ctx, W, H, t, offX, offY);
  }

  // Hot flash washout — radial bloom near the subject. Direction matches
  // the off-center offset so it reads as the camera-mounted flash.
  flashBloom(ctx, W, H, W * 0.5 + offX * 0.6, H * 0.45 + offY * 0.6);

  // Slight chromatic-aberration tint at edges.
  chromaticEdge(ctx, W, H);

  // Grain.
  grain(ctx, W, H, 0.07);

  ctx.restore();
}

function drawCeiling(ctx, W, H, t, ox, oy) {
  // Popcorn ceiling + halogen halo — desaturated cream with white-hot bloom.
  ctx.fillStyle = '#cdc4ac';
  ctx.fillRect(0, 0, W, H);
  // Speckle texture
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = Math.random() < 0.5 ? '#b8ad92' : '#e7dfc8';
    ctx.beginPath(); ctx.arc(x, y, 1.2 + Math.random() * 1.6, 0, 6.283); ctx.fill();
  }
  // Off-center halogen fixture
  const cx = W * 0.62 + ox * 0.4, cy = H * 0.32 + oy * 0.4;
  const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, W * 0.55);
  halo.addColorStop(0, 'rgba(255,255,235,1)');
  halo.addColorStop(0.18, 'rgba(255,247,210,0.85)');
  halo.addColorStop(0.45, 'rgba(255,180,80,0.18)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  // A second tiny fixture for depth
  const cx2 = W * 0.18, cy2 = H * 0.78;
  const halo2 = ctx.createRadialGradient(cx2, cy2, 2, cx2, cy2, W * 0.22);
  halo2.addColorStop(0, 'rgba(255,247,210,0.7)');
  halo2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo2; ctx.fillRect(0, 0, W, H);
  // Ceiling-tile seam line
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.55); ctx.lineTo(W, H * 0.62 + oy * 0.06);
  ctx.stroke();
}

function drawShoes(ctx, W, H, t, ox, oy) {
  // Black-and-white tile floor + two off-white sneakers.
  // Floor: alternating tiles in perspective.
  ctx.fillStyle = '#dad3c6';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H * 0.95);
  // Cheap perspective: rows of varying sizes
  for (let row = 0; row < 12; row++) {
    const k = row / 12;
    const rowY = -H * 0.6 * k * k - 20;
    const tileH = 18 + 60 * k;
    const tileW = 30 + 90 * k;
    for (let i = -8; i <= 8; i++) {
      const x = i * tileW;
      const dark = ((row + i) & 1) === 0;
      ctx.fillStyle = dark ? '#2a2723' : '#e7dfd0';
      ctx.fillRect(x - tileW / 2, rowY, tileW, tileH);
    }
  }
  ctx.restore();
  // Two sneakers — off-white silhouettes with shoelace strokes.
  drawSneaker(ctx, W * 0.36 + ox * 0.3, H * 0.72 + oy * 0.3, W * 0.22, -8);
  drawSneaker(ctx, W * 0.62 + ox * 0.3, H * 0.78 + oy * 0.3, W * 0.22, 6);
}

function drawSneaker(ctx, cx, cy, w, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  // Sole
  ctx.fillStyle = '#fff';
  roundedRect(ctx, -w / 2, 0, w, w * 0.18, 8); ctx.fill();
  // Upper
  ctx.fillStyle = '#f1eadc';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.46, -w * 0.32, -w * 0.18, -w * 0.34);
  ctx.lineTo(w * 0.36, -w * 0.34);
  ctx.quadraticCurveTo(w * 0.5, -w * 0.18, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  // Stripe
  ctx.fillStyle = '#cf2a4a';
  ctx.fillRect(-w * 0.05, -w * 0.22, w * 0.5, w * 0.06);
  // Laces
  ctx.strokeStyle = '#8a7e6a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.1 + i * (w * 0.08), -w * 0.32);
    ctx.lineTo(-w * 0.05 + i * (w * 0.08), -w * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawClub(ctx, W, H, t, ox, oy) {
  // Magenta + teal nightclub backdrop with two silhouette bodies.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a0426'); bg.addColorStop(0.5, '#4a0a55'); bg.addColorStop(1, '#062423');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // Wash spots
  spot(ctx, W * 0.2, H * 0.2, W * 0.45, 'rgba(255,43,214,0.65)');
  spot(ctx, W * 0.85, H * 0.85, W * 0.5, 'rgba(24,224,208,0.5)');
  // Two silhouettes — off-center subject + companion.
  silhouette(ctx, W * 0.55 + ox * 0.4, H * 0.62 + oy * 0.4, W * 0.42, '#0a0612', false);
  silhouette(ctx, W * 0.32 + ox * 0.2, H * 0.72 + oy * 0.2, W * 0.34, '#0a0612', true);
  // Bokeh dots
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * W, y = Math.random() * H * 0.55;
    const r = 6 + Math.random() * 18;
    spot(ctx, x, y, r, Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,43,214,0.35)');
  }
}

function silhouette(ctx, cx, cy, scale, color, profile) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  // Shoulders
  ctx.beginPath();
  ctx.moveTo(-scale * 0.45, scale * 0.6);
  ctx.quadraticCurveTo(-scale * 0.4, scale * 0.05, -scale * 0.18, scale * 0.0);
  ctx.lineTo(scale * 0.18, scale * 0.0);
  ctx.quadraticCurveTo(scale * 0.4, scale * 0.05, scale * 0.45, scale * 0.6);
  ctx.lineTo(-scale * 0.45, scale * 0.6);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(0, -scale * 0.18, scale * 0.18, scale * 0.22, 0, 0, 6.283);
  ctx.fill();
  // Profile flair if set — a faint hot-pink rim on one side (flash bounce).
  if (profile) {
    ctx.fillStyle = 'rgba(255,90,200,0.35)';
    ctx.beginPath();
    ctx.ellipse(scale * 0.16, -scale * 0.18, scale * 0.05, scale * 0.18, 0, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

function drawWall(ctx, W, H, t, ox, oy) {
  // Blurred neutral wall + part of a shoulder coming in from the side.
  ctx.fillStyle = '#a89b88';
  ctx.fillRect(0, 0, W, H);
  // Faint wall texture — diagonal scuffs
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = -10; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60 - 200, H);
    ctx.stroke();
  }
  // A picture-frame-like rectangle off to the side
  ctx.fillStyle = '#7c6f5d';
  ctx.fillRect(W * 0.66, H * 0.18, W * 0.22, H * 0.28);
  ctx.fillStyle = '#dcd2bd';
  ctx.fillRect(W * 0.68, H * 0.20, W * 0.18, H * 0.24);
  // Shoulder intruding from left
  ctx.fillStyle = '#0a0612';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.95);
  ctx.lineTo(0, H * 0.55 + oy * 0.2);
  ctx.quadraticCurveTo(W * 0.18, H * 0.5 + oy * 0.2, W * 0.32, H * 0.7);
  ctx.lineTo(W * 0.34, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  // Hint of an ear
  ctx.fillStyle = '#1a0e1c';
  ctx.beginPath(); ctx.ellipse(W * 0.18, H * 0.58 + oy * 0.2, 14, 22, 0, 0, 6.283); ctx.fill();
}

function drawBooth(ctx, W, H, t, ox, oy) {
  // Stage-light bloom + DJ booth silhouette.
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, W, H);
  // Stage lights from above
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (W / 6);
    const cone = ctx.createLinearGradient(x, 0, x + (i % 2 ? 80 : -80), H * 0.7);
    const col = i % 2 ? 'rgba(24,224,208,0.55)' : 'rgba(255,43,214,0.55)';
    cone.addColorStop(0, col);
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 8, 0); ctx.lineTo(x + 8, 0);
    ctx.lineTo(x + 90 * (i % 2 ? 1 : -1), H * 0.7);
    ctx.lineTo(x - 90 * (i % 2 ? 1 : -1), H * 0.7);
    ctx.closePath(); ctx.fill();
  }
  // Booth silhouette
  ctx.fillStyle = '#000';
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  // CDJ shapes
  ctx.fillStyle = '#1a0e1c';
  ctx.fillRect(W * 0.12 + ox * 0.2, H * 0.7, W * 0.32, H * 0.12);
  ctx.fillRect(W * 0.56 + ox * 0.2, H * 0.7, W * 0.32, H * 0.12);
  // Glowing knobs
  ctx.fillStyle = '#18e0d0';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.18 + i * (W * 0.06) + ox * 0.2, H * 0.74, 4, 0, 6.283);
    ctx.fill();
  }
  // DJ silhouette behind it
  silhouette(ctx, W * 0.5 + ox * 0.4, H * 0.55 + oy * 0.3, W * 0.45, '#000', false);
}

function drawSelfie(ctx, W, H, t, ox, oy) {
  // Half a face, mostly forehead. Off-center, hot flash on skin.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a1230'); bg.addColorStop(1, '#06181f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // Forehead
  ctx.fillStyle = '#f0b790';
  ctx.beginPath();
  ctx.ellipse(W * 0.5 + ox * 0.6, H * 1.0 + oy * 0.3, W * 0.7, H * 0.5, 0, 0, 6.283);
  ctx.fill();
  // Eyebrow at the bottom edge
  ctx.fillStyle = '#1a0d05';
  ctx.beginPath();
  ctx.ellipse(W * 0.55 + ox * 0.6, H * 0.92 + oy * 0.3, W * 0.18, 8, -0.1, 0, 6.283);
  ctx.fill();
  // Hairline at top
  ctx.fillStyle = '#1a0d05';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.32);
  ctx.quadraticCurveTo(W * 0.5 + ox * 0.6, H * 0.18 + oy * 0.3, W, H * 0.36);
  ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
  ctx.fill();
  // Phone-finger blur in corner
  ctx.fillStyle = 'rgba(240,183,144,0.55)';
  ctx.beginPath();
  ctx.ellipse(W * 0.06, H * 0.5, W * 0.12, H * 0.2, 0.4, 0, 6.283);
  ctx.fill();
}

function drawDrink(ctx, W, H, t, ox, oy) {
  // Ice + condensation in a plastic cup, bar lights behind.
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, W, H);
  // Bar bokeh
  for (let i = 0; i < 14; i++) {
    spot(ctx, Math.random() * W, H * 0.2 + Math.random() * H * 0.4,
         18 + Math.random() * 32,
         Math.random() < 0.5 ? 'rgba(255,180,80,0.55)' : 'rgba(255,43,214,0.45)');
  }
  // Cup
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const cx = W * 0.5 + ox * 0.4, cy = H * 0.65 + oy * 0.3;
  const cw = W * 0.36, ch = H * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy - ch / 2);
  ctx.lineTo(cx - cw / 2 + 18, cy + ch / 2);
  ctx.lineTo(cx + cw / 2 - 18, cy + ch / 2);
  ctx.lineTo(cx + cw / 2, cy - ch / 2);
  ctx.closePath();
  ctx.fill();
  // Liquid
  ctx.fillStyle = 'rgba(220,90,40,0.7)';
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2 + 8, cy - ch / 4);
  ctx.lineTo(cx - cw / 2 + 18, cy + ch / 2);
  ctx.lineTo(cx + cw / 2 - 18, cy + ch / 2);
  ctx.lineTo(cx + cw / 2 - 8, cy - ch / 4);
  ctx.closePath();
  ctx.fill();
  // Ice cubes
  for (let i = 0; i < 6; i++) {
    const ix = cx - cw / 4 + Math.random() * cw / 2;
    const iy = cy - ch / 5 + Math.random() * ch / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(ix, iy, 18 + Math.random() * 12, 12 + Math.random() * 10);
  }
  // Hand on the cup — peach silhouette around the rim.
  ctx.fillStyle = '#f0b790';
  ctx.beginPath();
  ctx.ellipse(cx - cw / 2 + 8, cy + ch / 4, 26, 36, 0.3, 0, 6.283);
  ctx.fill();
  // Condensation streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const sx = cx - cw / 4 + Math.random() * cw / 2;
    ctx.beginPath();
    ctx.moveTo(sx, cy - ch / 3);
    ctx.bezierCurveTo(sx + 4, cy, sx - 4, cy + 30, sx + 2, cy + ch / 3);
    ctx.stroke();
  }
}

// ---------- Helpers ----------

function spot(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
}

function flashBloom(ctx, W, H, fx, fy) {
  const r = Math.max(W, H) * 0.7;
  const g = ctx.createRadialGradient(fx, fy, 4, fx, fy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.06, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

function chromaticEdge(ctx, W, H) {
  // Cyan + magenta tints near opposite corners — fakes lens fringing.
  ctx.globalCompositeOperation = 'screen';
  let g = ctx.createRadialGradient(0, H, 20, 0, H, Math.max(W, H));
  g.addColorStop(0, 'rgba(0,180,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W, 0, 20, W, 0, Math.max(W, H));
  g.addColorStop(0, 'rgba(255,30,170,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

function grain(ctx, W, H, intensity) {
  // Cheap grain — sparse white/black dots; dense enough to read at 2008 jpeg.
  const count = Math.floor(W * H * 0.012);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const a = Math.random() * intensity;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ---------- Card composition ----------

function renderCard(shot) {
  const c = $('card-canvas');
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;

  // Paper background — slight cream tint.
  ctx.fillStyle = '#f1ece1';
  ctx.fillRect(0, 0, W, H);

  // Photo area — reserves bottom strip for date stamp + EXIF + brand.
  // Card is 900×1125 (4:5 portrait card). Photo itself is roughly 4:5
  // inside the card, leaving ~280px below for the text block.
  const padding = 36;
  const photoX = padding, photoY = padding;
  const photoW = W - padding * 2;
  const photoH = Math.round(photoW * 0.92); // ~4:3.7 — leaves ~330px below

  // Black border behind the photo.
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(photoX - 6, photoY - 6, photoW + 12, photoH + 12);

  // Render the scene into the photo area via an offscreen buffer for clean
  // composition (so chromatic edges only land inside the photo, not on paper).
  const off = document.createElement('canvas');
  off.width = photoW; off.height = photoH;
  const octx = off.getContext('2d');
  // Seeded variation per shot — push the bloom + offset using shot.seed.
  const seed = shot.seed || 1;
  const rng = mulberry32(seed);
  const fakeTilt = {
    pitch: shot.tilt.pitch + (rng() - 0.5) * 8,
    roll: shot.tilt.roll + (rng() - 0.5) * 8,
  };
  drawScene(octx, photoW, photoH, SCENES[shot.sceneId.toUpperCase()] || SCENES.CLUB,
            fakeTilt, rng() * 5, true);

  ctx.drawImage(off, photoX, photoY);

  // Date stamp — orange seven-seg, bottom-right of photo.
  const d = shot.takenAt;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const stamp = `${mm} ${dd} ${yy}`;
  ctx.font = `bold 38px 'VT323', monospace`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  // Glow
  ctx.shadowColor = 'rgba(255,140,30,0.85)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff8c1e';
  ctx.fillText(stamp, photoX + photoW - 14, photoY + photoH - 12);
  ctx.shadowBlur = 0;

  // Below the photo: scene name + EXIF + brand.
  const textTop = photoY + photoH + 28;
  ctx.fillStyle = '#0a0612';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold 56px 'Antonio', sans-serif`;
  ctx.fillText(shot.sceneName.toUpperCase(), photoX, textTop);

  ctx.font = `22px 'Share Tech Mono', monospace`;
  ctx.fillStyle = '#5a4f40';
  const exif = `DIRECT FLASH · ISO 1600 · f/2.8 · 1/60s`;
  ctx.fillText(exif, photoX, textTop + 64);

  ctx.fillStyle = '#9a8d77';
  const cap = shot.caption;
  ctx.fillText(cap, photoX, textTop + 92);

  // Brand line at bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0a0612';
  ctx.font = `18px 'Share Tech Mono', monospace`;
  ctx.fillText('benlirio.com/apps/direct-flash', photoX + photoW, H - padding);

  // Tear-line / fold-feel on the bottom-right corner: a small triangle nick.
  ctx.fillStyle = '#0a0612';
  ctx.beginPath();
  ctx.moveTo(W - padding - 18, H - padding - 18);
  ctx.lineTo(W - padding, H - padding - 18);
  ctx.lineTo(W - padding, H - padding);
  ctx.closePath();
  ctx.fill();
}

function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Audio ----------
let audioCtx = null;
function shutterClick() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    // Click — short noise burst + a quick bandpass.
    const buf = audioCtx.createBuffer(1, 0.04 * audioCtx.sampleRate, audioCtx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 1.2;
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.18, t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
    src.start(t0); src.stop(t0 + 0.05);
    // Whine — small descending sine (flash recharge).
    const osc = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    osc.frequency.setValueAtTime(2400, t0 + 0.06);
    osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.5);
    og.gain.setValueAtTime(0.0001, t0 + 0.06);
    og.gain.exponentialRampToValueAtTime(0.04, t0 + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(og); og.connect(audioCtx.destination);
    osc.start(t0 + 0.06); osc.stop(t0 + 0.6);
  } catch (e) { /* audio is optional */ }
}
