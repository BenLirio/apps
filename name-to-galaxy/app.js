// Name to Galaxy — procedural galaxy renderer seeded from a name string

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color palette pools (warm/cool pairs, NO purple+blue) ────────────────────
const NEBULA_PALETTES = [
  // amber + teal
  { a: [255, 180, 60], b: [40, 200, 180] },
  // rose + indigo
  { a: [255, 100, 130], b: [80, 60, 180] },
  // green + purple
  { a: [80, 220, 120], b: [160, 50, 200] },
  // gold + cyan
  { a: [240, 210, 50], b: [30, 190, 220] },
  // coral + mint
  { a: [255, 120, 80], b: [60, 210, 160] },
  // lavender + amber
  { a: [180, 140, 255], b: [255, 200, 80] },
  // crimson + aquamarine
  { a: [220, 40, 80], b: [50, 200, 200] },
  // peach + slate-blue
  { a: [255, 170, 120], b: [70, 90, 200] },
];

// ── Galaxy renderer ───────────────────────────────────────────────────────────
function renderGalaxy(canvas, name) {
  const SIZE = 500;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const seed = hash(name);
  const rng = makePRNG(seed);

  // Background — near-black void
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Palette selection
  const palette = NEBULA_PALETTES[seed % NEBULA_PALETTES.length];
  const colA = palette.a;
  const colB = palette.b;

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // ── Nebula blobs (3-4 layered radial gradients) ───────────────────────────
  const blobCount = 3 + Math.floor(rng() * 2); // 3 or 4
  for (let b = 0; b < blobCount; b++) {
    const bx = cx + (rng() - 0.5) * SIZE * 0.6;
    const by = cy + (rng() - 0.5) * SIZE * 0.6;
    const r = 100 + rng() * 160;
    const useA = rng() < 0.55;
    const col = useA ? colA : colB;
    const alpha = 0.06 + rng() * 0.1;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(alpha * 2.5).toFixed(3)})`);
    grad.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Soft central glow (blends both palette colors)
  const centralGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.38);
  centralGlow.addColorStop(0, `rgba(${colA[0]},${colA[1]},${colA[2]},0.09)`);
  centralGlow.addColorStop(0.5, `rgba(${colB[0]},${colB[1]},${colB[2]},0.05)`);
  centralGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centralGlow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Star field (200-400 points) ───────────────────────────────────────────
  const starCount = 200 + Math.floor(rng() * 201);
  for (let i = 0; i < starCount; i++) {
    const sx = rng() * SIZE;
    const sy = rng() * SIZE;
    const size = rng() < 0.85 ? 0.5 + rng() * 1.2 : 1.5 + rng() * 2;
    const brightness = 0.5 + rng() * 0.5;
    // slight color tint — white/cream/pale-blue
    const tint = rng();
    let rc, gc, bc;
    if (tint < 0.6) { rc = 248; gc = 248; bc = 240; }       // cream-white
    else if (tint < 0.85) { rc = 200; gc = 215; bc = 255; } // pale blue
    else { rc = 255; gc = 220; bc = 180; }                   // warm amber star
    const alpha = brightness;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha.toFixed(2)})`;
    ctx.fill();
  }

  // A few bright "foreground" stars with a cross-hair flare
  const brightCount = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < brightCount; i++) {
    const sx = rng() * SIZE;
    const sy = rng() * SIZE;
    const r = 1.5 + rng() * 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,245,0.95)';
    ctx.fill();
    // diffraction spike
    ctx.strokeStyle = 'rgba(255,255,245,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - r * 5, sy);
    ctx.lineTo(sx + r * 5, sy);
    ctx.moveTo(sx, sy - r * 5);
    ctx.lineTo(sx, sy + r * 5);
    ctx.stroke();
  }

  // ── Central object (seeded: star cluster or black hole) ───────────────────
  const isBH = rng() < 0.4; // 40% chance of black hole

  if (isBH) {
    // Black hole: dark circle with accretion ring
    const bhR = 18 + rng() * 14;
    const ringW = 10 + rng() * 14;
    const ringCol = rng() < 0.5 ? colA : colB;

    // Accretion disk glow (outer halo)
    const diskGlow = ctx.createRadialGradient(cx, cy, bhR * 0.8, cx, cy, bhR + ringW + 30);
    diskGlow.addColorStop(0, `rgba(${ringCol[0]},${ringCol[1]},${ringCol[2]},0.5)`);
    diskGlow.addColorStop(0.4, `rgba(${ringCol[0]},${ringCol[1]},${ringCol[2]},0.15)`);
    diskGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = diskGlow;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Accretion ring arc (bright crescent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, bhR + ringW / 2, 0, Math.PI * 2);
    ctx.arc(cx, cy, bhR, Math.PI * 2, 0, true);
    ctx.fillStyle = `rgba(${ringCol[0]},${ringCol[1]},${ringCol[2]},0.7)`;
    ctx.fill();
    ctx.restore();

    // Event horizon (pure dark circle)
    ctx.beginPath();
    ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
    ctx.fillStyle = '#020208';
    ctx.fill();

  } else {
    // Star cluster: bright glowing center
    const clustR = 22 + rng() * 18;
    const clCol = rng() < 0.5 ? colA : colB;

    const clGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, clustR * 2.5);
    clGrad.addColorStop(0, `rgba(255,255,245,0.95)`);
    clGrad.addColorStop(0.15, `rgba(${clCol[0]},${clCol[1]},${clCol[2]},0.75)`);
    clGrad.addColorStop(0.5, `rgba(${clCol[0]},${clCol[1]},${clCol[2]},0.18)`);
    clGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = clGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Tight bright core
    ctx.beginPath();
    ctx.arc(cx, cy, clustR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,250,0.98)';
    ctx.fill();

    // Mini cluster stars around center
    const clStars = 8 + Math.floor(rng() * 10);
    for (let i = 0; i < clStars; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * clustR * 1.4;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const sr = 0.8 + rng() * 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,240,${(0.5 + rng() * 0.5).toFixed(2)})`;
      ctx.fill();
    }
  }
}

// ── NumbersAPI fetch ──────────────────────────────────────────────────────────
async function fetchCosmicFact(charCount) {
  const fallback = 'This galaxy is 13.8 billion light years from everything.';
  try {
    const res = await fetch(`https://numbersapi.com/${charCount}?json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data.text || fallback;
  } catch {
    return fallback;
  }
}

// ── UI state ──────────────────────────────────────────────────────────────────
const inputSection  = document.getElementById('input-section');
const preState      = document.getElementById('pre-state');
const loadingSection = document.getElementById('loading-section');
const resultSection = document.getElementById('result-section');
const nameInput     = document.getElementById('name-input');
const generateBtn   = document.getElementById('generate-btn');
const errorMsg      = document.getElementById('error-msg');
const galaxyLabel   = document.getElementById('galaxy-label');
const galaxyCanvas  = document.getElementById('galaxy-canvas');
const galaxyFact    = document.getElementById('galaxy-fact');
const downloadBtn   = document.getElementById('download-btn');
const shareBtn      = document.getElementById('share-btn');
const newGalaxyBtn  = document.getElementById('new-galaxy-btn');

function showError(msg) {
  errorMsg.textContent = msg;
}

function clearError() {
  errorMsg.textContent = '';
}

async function generate() {
  const rawName = nameInput.value.trim();
  if (!rawName) {
    showError('every galaxy needs a name — try yours');
    nameInput.focus();
    return;
  }
  clearError();

  // Show loading, hide input & header
  preState.style.display = 'none';
  inputSection.style.display = 'none';
  loadingSection.style.display = 'block';
  resultSection.style.display = 'none';

  // Parallel: render galaxy + fetch fact, wait at least 800ms
  const [fact] = await Promise.all([
    fetchCosmicFact(rawName.length),
    new Promise(r => setTimeout(r, 800)),
  ]);

  // Render the galaxy
  renderGalaxy(galaxyCanvas, rawName.toLowerCase());

  // Compose label and fact
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  galaxyLabel.textContent = `The ${displayName} Nebula — ${rawName.length} light years across`;
  galaxyFact.textContent = `cosmic signal: ${fact}`;

  // Show result
  loadingSection.style.display = 'none';
  resultSection.style.display = 'flex';
}

function resetToInput() {
  resultSection.style.display = 'none';
  loadingSection.style.display = 'none';
  preState.style.display = '';
  inputSection.style.display = '';
  nameInput.value = '';
  nameInput.focus();
}

// ── Download ──────────────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  const rawName = nameInput.value.trim() || 'galaxy';
  const link = document.createElement('a');
  link.download = `${rawName.toLowerCase().replace(/\s+/g, '-')}-nebula.png`;
  link.href = galaxyCanvas.toDataURL('image/png');
  link.click();
});

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}

shareBtn.addEventListener('click', share);

// ── Events ────────────────────────────────────────────────────────────────────
generateBtn.addEventListener('click', generate);

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});

nameInput.addEventListener('input', clearError);

newGalaxyBtn.addEventListener('click', resetToInput);
