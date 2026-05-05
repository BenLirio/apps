// app.js — module entry. Renders the current minute, ticks silently once per
// minute on the round boundary, and exposes `window.share` for the inline
// onclick on the share button. No screen flow — this is a single-screen
// declarative reveal app whose only "interaction" is waiting.

import { generateDecree, generateSerial, formatTime, WEEKDAY_FULL, WEEKDAY_SHORT } from './mechanic.js';

// --------------------------------------------------------------- DOM refs

const els = {};
function bind() {
  els.weekday   = document.getElementById('anchor-weekday');
  els.digits    = document.getElementById('anchor-digits');
  els.meridiem  = document.getElementById('anchor-meridiem');
  els.decree    = document.getElementById('decree-line');
  els.stampTime = document.getElementById('stamp-time');
  els.stampDate = document.getElementById('stamp-date');
  els.serial    = document.getElementById('stamp-serial');
  els.anchor    = document.querySelector('.anchor');
  els.tickSecs  = document.getElementById('next-tick-secs');
  els.shareHint = document.getElementById('share-hint');
}

// --------------------------------------------------------------- render

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function render() {
  const now = new Date();
  const weekday = now.getDay();
  const hour    = now.getHours();
  const minute  = now.getMinutes();

  const t = formatTime(hour, minute);

  els.weekday.textContent  = WEEKDAY_FULL[weekday];
  els.digits.textContent   = t.display;
  els.meridiem.textContent = t.meridiem;
  els.decree.textContent   = generateDecree(weekday, hour, minute);

  els.stampTime.textContent = t.full;
  els.stampDate.textContent =
    `${WEEKDAY_SHORT[weekday]} · ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  els.serial.textContent = generateSerial(weekday, hour, minute);
}

// Light visual flash when the minute rolls over.
function flashAnchor() {
  if (!els.anchor) return;
  els.anchor.classList.remove('tick-flash');
  // Force reflow so the animation restarts.
  void els.anchor.offsetWidth;
  els.anchor.classList.add('tick-flash');
}

// --------------------------------------------------------------- ticker

// Schedule a render exactly at the next round minute boundary, then once per
// minute thereafter. setInterval(60000) drifts; aligning to the boundary keeps
// the displayed minute visually correct relative to the wall clock.
function scheduleNextMinute() {
  const now = new Date();
  const ms = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(() => {
    render();
    flashAnchor();
    scheduleNextMinute();
  }, ms + 50); // tiny pad so we land *just after* the boundary
}

// Update the "next decree files in Xs" line every second.
function startNextTickTicker() {
  const update = () => {
    const now = new Date();
    const remaining = 60 - now.getSeconds();
    if (els.tickSecs) els.tickSecs.textContent = remaining;
  };
  update();
  setInterval(update, 1000);
}

// --------------------------------------------------------------- share

// Renders the postage-stamp card to a canvas at high resolution, then either
// invokes the Web Share API (if available with a file payload) or downloads
// the PNG. The image is the share artifact — it contains the weekday + HH:MM
// stamp + the decree, so the screenshot is self-evidencing per the brief.
async function renderShareCanvas() {
  const W = 1600, H = 900;        // 16:9 — same ratio as the OG image
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const now = new Date();
  const weekday = now.getDay();
  const hour    = now.getHours();
  const minute  = now.getMinutes();
  const t       = formatTime(hour, minute);
  const decree  = generateDecree(weekday, hour, minute);
  const serial  = generateSerial(weekday, hour, minute);

  // ---- background: manilla cardstock ----
  ctx.fillStyle = '#d8c89d';
  ctx.fillRect(0, 0, W, H);

  // light paper grain via random dots — deterministic by minute so the same
  // minute always produces the same image.
  let seed = (weekday * 31 + hour) * 60 + minute;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  ctx.fillStyle = 'rgba(26,20,13,0.05)';
  for (let i = 0; i < 1800; i++) {
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }

  // ---- masthead ----
  ctx.fillStyle = '#4a3f2c';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('UNITED STATES BUREAU OF', W / 2, 70);

  ctx.fillStyle = '#1a140d';
  ctx.font = '700 56px "IBM Plex Mono", monospace';
  ctx.fillText('THE CURRENT MINUTE', W / 2, 130);

  ctx.fillStyle = '#4a3f2c';
  ctx.font = 'italic 22px "Special Elite", monospace';
  ctx.fillText('Office of Pinned Observations — Section 4', W / 2, 162);

  ctx.strokeStyle = '#6e5e3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.18, 184);
  ctx.lineTo(W * 0.82, 184);
  ctx.stroke();

  // ---- the anchor — weekday + huge time ----
  // weekday rubber-stamp box
  ctx.save();
  ctx.translate(W / 2, 254);
  ctx.rotate(-0.022);
  const wdText = WEEKDAY_FULL[weekday];
  ctx.font = '700 36px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#b1271b';
  ctx.strokeStyle = '#b1271b';
  ctx.lineWidth = 3;
  const wdW = ctx.measureText(wdText).width + 56;
  ctx.strokeRect(-wdW / 2, -32, wdW, 60);
  ctx.fillText(wdText, 0, 8);
  ctx.restore();

  // huge time + meridiem, measured to keep the pair visually centered.
  ctx.fillStyle = '#1a140d';
  ctx.font = '400 220px "Special Elite", "IBM Plex Mono", monospace';
  const timeW = ctx.measureText(t.display).width;
  ctx.font = '700 60px "IBM Plex Mono", monospace';
  const meridiemW = ctx.measureText(t.meridiem).width;
  const gap = 24;
  const totalW = timeW + gap + meridiemW;
  const startX = W / 2 - totalW / 2;

  ctx.fillStyle = '#1a140d';
  ctx.font = '400 220px "Special Elite", "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(t.display, startX, 480);

  ctx.fillStyle = '#4a3f2c';
  ctx.font = '700 60px "IBM Plex Mono", monospace';
  ctx.fillText(t.meridiem, startX + timeW + gap, 405);

  // anchor rule
  ctx.strokeStyle = '#1a140d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.30, 510);
  ctx.lineTo(W * 0.70, 510);
  ctx.stroke();

  // ---- the decree ----
  ctx.fillStyle = '#4a3f2c';
  ctx.font = '700 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FILED THIS MINUTE', W / 2, 560);

  // wrap the decree to fit
  ctx.fillStyle = '#1a140d';
  ctx.font = '400 30px "Special Elite", "IBM Plex Mono", monospace';
  wrapTextCentered(ctx, decree, W / 2, 605, W * 0.78, 42);

  // ---- footer: serial + bureau line ----
  ctx.fillStyle = '#4a3f2c';
  ctx.font = '700 20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(serial, 80, H - 60);

  ctx.textAlign = 'right';
  const dateLine = `${WEEKDAY_SHORT[weekday]} · ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  ctx.fillText(dateLine, W - 80, H - 60);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a140d';
  ctx.font = '700 16px "IBM Plex Mono", monospace';
  ctx.fillText('benlirio.com/apps/bureau-of-the-current-minute', W / 2, H - 30);

  // FILED stamp at top-right
  ctx.save();
  ctx.translate(W - 200, 130);
  ctx.rotate(-0.18);
  ctx.strokeStyle = '#b1271b';
  ctx.lineWidth = 4;
  ctx.strokeRect(-90, -32, 180, 64);
  ctx.fillStyle = '#b1271b';
  ctx.font = '700 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FILED', 0, 12);
  ctx.restore();

  return canvas;
}

function wrapTextCentered(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lineH);
}

async function share() {
  let canvas;
  try {
    canvas = await renderShareCanvas();
  } catch (err) {
    flashHint('the bureau\'s mimeograph jammed — try again');
    return;
  }

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    flashHint('couldn\'t render the card — give it another go');
    return;
  }

  const now = new Date();
  const weekday = now.getDay();
  const hour    = now.getHours();
  const minute  = now.getMinutes();
  const t = formatTime(hour, minute);
  const filename = `bureau-${WEEKDAY_SHORT[weekday].toLowerCase()}-${String(hour).padStart(2,'0')}${String(minute).padStart(2,'0')}.png`;

  const shareText = `${WEEKDAY_FULL[weekday]} ${t.full} — Bureau of the Current Minute, classified.`;
  const shareUrl = 'https://benlirio.com/apps/bureau-of-the-current-minute/';

  // Try Web Share API with file payload first (mobile path).
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Bureau of the Current Minute', text: shareText });
      flashHint('decree dispatched');
      return;
    }
  } catch (_) { /* fall through to download */ }

  // Fallback: download the PNG. Also copy the share text to clipboard if able.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    }
  } catch (_) {}

  flashHint('card downloaded — post it before the next minute comes');
}

function flashHint(msg) {
  if (!els.shareHint) return;
  els.shareHint.textContent = msg;
  els.shareHint.classList.add('visible');
  clearTimeout(flashHint._t);
  flashHint._t = setTimeout(() => els.shareHint.classList.remove('visible'), 4200);
}

// --------------------------------------------------------------- boot

window.share = share;

function boot() {
  bind();
  render();
  scheduleNextMinute();
  startNextTickTicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
