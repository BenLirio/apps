// Their Color — bespoke Pantone-style chips for any name.
// Hex is deterministic (hashed). LLM writes the name + italic flavor sentence.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'their-color';

const $ = (sel, root = document) => root.querySelector(sel);

const els = {
  form: $('#form'),
  name1: $('#name1'),
  name2: $('#name2'),
  secondWrap: $('#secondWrap'),
  addSecond: $('#addSecond'),
  removeSecond: $('#removeSecond'),
  mixBtn: $('#mixBtn'),
  palette: $('#palette'),
  shareRow: $('#share'),
  errorMsg: $('#errorMsg'),
  samples: document.querySelectorAll('.sample-pill'),
  exportStage: $('#exportStage'),
};

let chipCounter = 0;

// ---------- hashing ----------
function hashStr(str) {
  // 32-bit FNV-1a-ish — stable
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Mulberry32 from a seed for additional channels
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- color: name -> hex (deterministic, varied palette) ----------
function nameToHex(name) {
  const seed = hashStr('their-color::' + normalizeName(name));
  const rng = mulberry32(seed);

  // Pick a hue across full circle, but biased to evocative ranges.
  // Use HSL with avoided extremes, then convert to hex.
  const hue = Math.floor(rng() * 360);
  // Saturation: 28-78 (avoid neon and dead grey)
  const sat = 28 + Math.floor(rng() * 50);
  // Lightness: 30-72 (avoid black/white)
  const light = 30 + Math.floor(rng() * 42);

  return hslToHex(hue, sat, light);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return ('#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4))).toUpperCase();
}

// ---------- color blending in LAB-ish (OKLab) for couple chips ----------
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255,
  ];
}
function rgbToHex([r, g, b]) {
  const c = v => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}
// sRGB <-> OKLab (Björn Ottosson, MIT). Perceptual midpoint blend.
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function rgbToOklab([r, g, b]) {
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(bl)];
}
function blendHexOKLab(h1, h2) {
  const a = rgbToOklab(hexToRgb(h1));
  const b = rgbToOklab(hexToRgb(h2));
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return rgbToHex(oklabToRgb(mid));
}

// Pick black or white text against a bg hex
function readableInkOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.62 ? '#15140f' : '#fbf8f1';
}

// ---------- offline fallback chip-name generator ----------
const FALLBACK_ADJ = [
  'Late', 'Quiet', 'Tuesday', 'Honest', 'Borrowed', 'Sunday', 'Patient', 'Half-', 'Soft',
  'Bruised', 'Rumored', 'Apricot', 'Stubborn', 'Dim', 'Fond', 'Slow', 'Loyal', 'Salted',
];
const FALLBACK_NOUN = [
  'Olive', 'Cinder', 'Auntie', 'Dusk', 'Linen', 'Velvet', 'Plum', 'Marigold', 'Slate',
  'Tea', 'Rose', 'Pebble', 'Brick', 'Mist', 'Lemon', 'Sage', 'Rust', 'Cedar', 'Bone',
];
function offlineChipName(name) {
  const seed = hashStr('chipname::' + normalizeName(name));
  const rng = mulberry32(seed);
  const a = FALLBACK_ADJ[Math.floor(rng() * FALLBACK_ADJ.length)];
  const n = FALLBACK_NOUN[Math.floor(rng() * FALLBACK_NOUN.length)];
  return `${a} ${n}`.replace(/-\s/, '-');
}
function offlineFlavor(name, hex, isCouple) {
  if (isCouple) return 'two of them, settled into one shade like an old shared sweater.';
  const lines = [
    'a color that walks in late and apologizes anyway.',
    'the shade of a quiet promise nobody else heard.',
    'looks like a Sunday you didn\'t plan but kept.',
    'evidence of having loved something twice.',
    'a hue that hums while it works.',
  ];
  const idx = hashStr('flavor::' + normalizeName(name) + hex) % lines.length;
  return lines[idx];
}

// ---------- LLM call ----------
async function generateChipText({ name, hex, name2, hex2, blendedHex }) {
  const isCouple = !!name2;
  const sys = isCouple
    ? 'You are a paint-chip namer for a Pantone-style specimen book. Given two names and three hex colors (the two source chips and their perceptually-blended midpoint), return strict JSON with exactly two keys: "chip_name" (a 2-3 word couple/portmanteau name in Title Case, evocative and specific, NEVER generic — combine sounds or feel of both names; examples: "Marcus Olive", "Emma & Stem", "Dahlia Cinder") and "flavor" (one italic-style sentence, max 14 words, that personifies the relationship between the two people through this exact midpoint color). No emojis, no quotes around values, no extra keys.'
    : 'You are a paint-chip namer for a Pantone-style specimen book. Given a person\'s name and a hex color, return strict JSON with exactly two keys: "chip_name" (a 2-3 word evocative paint-chip name in Title Case — examples: "Emma Greenwell", "Cinder Auntie", "Tuesday Olive", "Late-Afternoon Rust"; it should feel hand-named for THIS person and faithful to THIS color, NEVER generic) and "flavor" (one italic-style sentence, max 14 words, that personifies the color through the person; e.g. "a late-afternoon olive that doesn\'t need to win"). No emojis, no quotes around values, no extra keys.';

  const userContent = isCouple
    ? `Person 1: ${name} (${hex})\nPerson 2: ${name2} (${hex2})\nBlended midpoint: ${blendedHex}\nName the blended chip and write its flavor line.`
    : `Person: ${name}\nHex: ${hex}\nName this chip and write its flavor line.`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userContent },
        ],
        max_tokens: 120,
        response_format: 'json_object',
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let parsed = null;
    try { parsed = JSON.parse(data.content); } catch (_) { parsed = null; }
    const chipName = (parsed?.chip_name || '').toString().trim();
    const flavor = (parsed?.flavor || '').toString().trim();
    if (!chipName || !flavor) throw new Error('empty');
    return { chipName, flavor };
  } catch (_) {
    const fName = isCouple
      ? offlineChipName(name + '+' + name2)
      : offlineChipName(name);
    return {
      chipName: fName,
      flavor: offlineFlavor(isCouple ? `${name} & ${name2}` : name, blendedHex || hex, isCouple),
    };
  }
}

// ---------- DOM rendering ----------
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function chipIndexLabel() {
  chipCounter += 1;
  return 'TC-' + String(chipCounter).padStart(3, '0');
}

function renderChip({ name, name2, hex, hex2, blendedHex }) {
  const isCouple = !!name2;
  const finalHex = isCouple ? blendedHex : hex;
  const ink = readableInkOn(finalHex);
  const idx = chipIndexLabel();

  const chipEl = document.createElement('article');
  chipEl.className = 'chip-card reveal';
  chipEl.dataset.hex = finalHex;
  chipEl.dataset.name1 = name;
  if (name2) chipEl.dataset.name2 = name2;

  const sourcesHTML = isCouple ? `
    <div class="couple-sources">
      <div class="source-chip">
        <div class="src-swatch" style="background:${hex}"></div>
        <div class="src-meta">
          <p class="src-name">${escapeHTML(name)}</p>
          <p class="src-hex">${hex}</p>
        </div>
      </div>
      <div class="source-chip">
        <div class="src-swatch" style="background:${hex2}"></div>
        <div class="src-meta">
          <p class="src-name">${escapeHTML(name2)}</p>
          <p class="src-hex">${hex2}</p>
        </div>
      </div>
    </div>
    <div class="couple-arrow">&darr; mixed in OKLab &darr;</div>
  ` : '';

  chipEl.innerHTML = `
    ${sourcesHTML}
    <div class="chip-swatch" style="background:${finalHex}"></div>
    <div class="chip-meta">
      <div class="chip-hex-row">
        <span class="chip-hex">${finalHex}</span>
        <span class="chip-index">${idx}</span>
      </div>
      <h2 class="chip-name skeleton">Mixing the chip&hellip;</h2>
      <p class="chip-person">${escapeHTML(isCouple ? name + ' & ' + name2 : name)}</p>
      <p class="chip-flavor skeleton">consulting the specimen book&hellip;</p>
      <p class="chip-loading-msg">hand-naming this color&hellip;</p>
    </div>
    <div class="card-actions" style="padding:0 18px 18px">
      <button class="btn-ghost act-save">Save card</button>
      <button class="btn-ghost act-link">Copy link</button>
      <button class="btn-ghost act-again">Try another</button>
    </div>
  `;

  // Wrap in couple wrapper if needed (so source-chips and main card stack visually together)
  let containerEl = chipEl;
  if (isCouple) {
    const wrap = document.createElement('div');
    wrap.className = 'couple';
    wrap.appendChild(chipEl);
    containerEl = wrap;
  }

  // Prepend so newest is at the top (stacks growing downward = newest first)
  els.palette.prepend(containerEl);

  // Hook up actions
  chipEl.querySelector('.act-save').addEventListener('click', () => saveChipAsPNG(chipEl));
  chipEl.querySelector('.act-link').addEventListener('click', () => copyShareLink({ name, name2 }));
  chipEl.querySelector('.act-again').addEventListener('click', () => {
    els.name1.value = '';
    els.name2.value = '';
    els.name1.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  els.shareRow.style.display = 'flex';

  return chipEl;
}

function fillChipText(chipEl, { chipName, flavor }) {
  const nameEl = chipEl.querySelector('.chip-name');
  const flavorEl = chipEl.querySelector('.chip-flavor');
  const loadingEl = chipEl.querySelector('.chip-loading-msg');
  nameEl.classList.remove('skeleton');
  flavorEl.classList.remove('skeleton');
  nameEl.textContent = chipName;
  flavorEl.textContent = flavor;
  if (loadingEl) loadingEl.remove();
}

// ---------- save card as PNG ----------
async function saveChipAsPNG(chipEl) {
  // Determine the export root — for couple chips, capture the parent .couple wrap
  const exportRoot = chipEl.closest('.couple') || chipEl;

  const btn = chipEl.querySelector('.act-save');
  const original = btn.textContent;
  btn.textContent = 'rendering...';
  btn.disabled = true;

  try {
    if (typeof html2canvas !== 'function') throw new Error('no-html2canvas');

    // Hide the action row temporarily
    const actions = chipEl.querySelector('.card-actions');
    const prevDisplay = actions ? actions.style.display : '';
    if (actions) actions.style.display = 'none';

    const canvas = await html2canvas(exportRoot, {
      backgroundColor: '#f3efe6',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    if (actions) actions.style.display = prevDisplay;

    const dataUrl = canvas.toDataURL('image/png');
    const filename = (chipEl.querySelector('.chip-name')?.textContent || 'their-color').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.png';

    // Try Web Share with file first (mobile)
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Their Color' });
        btn.textContent = 'shared!';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1400);
        return;
      }
    } catch (_) { /* fallthrough to download */ }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    btn.textContent = 'saved!';
  } catch (e) {
    btn.textContent = 'oops, try again';
  } finally {
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1400);
  }
}

// ---------- shareable URL with names in the hash ----------
function buildHashFor({ name, name2 }) {
  const params = new URLSearchParams();
  params.set('n', name);
  if (name2) params.set('n2', name2);
  return '#' + params.toString();
}
function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (!h) return null;
  const p = new URLSearchParams(h);
  const n = (p.get('n') || '').trim();
  if (!n) return null;
  const n2 = (p.get('n2') || '').trim();
  return { name: n, name2: n2 || '' };
}
async function copyShareLink({ name, name2 }) {
  const url = location.origin + location.pathname + buildHashFor({ name, name2 });
  try {
    await navigator.clipboard.writeText(url);
    flashTooltip('link copied');
  } catch (_) {
    // fallback prompt
    prompt('copy this link:', url);
  }
}
function flashTooltip(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#15140f;color:#f3efe6;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;padding:8px 14px;z-index:9999;border-radius:0;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}

// ---------- main flow ----------
async function mix({ name, name2 }) {
  // validate
  if (!name || !name.trim()) {
    showError("hmm, that didn't work — type a name first");
    els.name1.focus();
    return;
  }
  hideError();

  const trimmedName = name.trim().slice(0, 60);
  const trimmedName2 = (name2 || '').trim().slice(0, 60);
  const isCouple = trimmedName2.length > 0;

  // hex(es) — instant, deterministic
  const hex = nameToHex(trimmedName);
  const hex2 = isCouple ? nameToHex(trimmedName2) : null;
  const blendedHex = isCouple ? blendHexOKLab(hex, hex2) : null;

  // render skeleton chip immediately (hex shown, name+flavor shimmer)
  const chipEl = renderChip({ name: trimmedName, name2: trimmedName2 || null, hex, hex2, blendedHex });

  // update URL hash so refreshing keeps the most recent input
  history.replaceState(null, '', buildHashFor({ name: trimmedName, name2: trimmedName2 }));

  // disable mix briefly to prevent dupes
  els.mixBtn.disabled = true;

  // call LLM (with deterministic fallback)
  const t0 = Date.now();
  const { chipName, flavor } = await generateChipText({
    name: trimmedName,
    hex,
    name2: trimmedName2 || null,
    hex2,
    blendedHex,
  });
  // Floor a min skeleton time so the shimmer doesn't flash if we're fast
  const elapsed = Date.now() - t0;
  if (elapsed < 700) await new Promise(r => setTimeout(r, 700 - elapsed));

  fillChipText(chipEl, { chipName, flavor });

  els.mixBtn.disabled = false;
}

function showError(msg) {
  els.errorMsg.textContent = msg;
  els.errorMsg.hidden = false;
}
function hideError() {
  els.errorMsg.hidden = true;
}

// ---------- wire UI ----------
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  mix({ name: els.name1.value, name2: els.name2.value });
});

els.addSecond.addEventListener('click', () => {
  els.secondWrap.hidden = false;
  els.addSecond.hidden = true;
  els.removeSecond.hidden = false;
  els.name2.focus();
});
els.removeSecond.addEventListener('click', () => {
  els.secondWrap.hidden = true;
  els.addSecond.hidden = false;
  els.removeSecond.hidden = true;
  els.name2.value = '';
});

els.samples.forEach(btn => {
  btn.addEventListener('click', () => {
    els.name1.value = btn.dataset.name;
    mix({ name: els.name1.value, name2: '' });
  });
});

// Auto-load from hash on first paint
window.addEventListener('DOMContentLoaded', () => {
  const fromHash = parseHash();
  if (fromHash) {
    els.name1.value = fromHash.name;
    if (fromHash.name2) {
      els.secondWrap.hidden = false;
      els.addSecond.hidden = true;
      els.removeSecond.hidden = false;
      els.name2.value = fromHash.name2;
    }
    mix(fromHash);
  }
});

// Top-level share button — copies the URL of the most recent chip (already in hash)
function share() {
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => flashTooltip('link copied'))
      .catch(() => prompt('copy this link:', url));
  }
}
window.share = share;
