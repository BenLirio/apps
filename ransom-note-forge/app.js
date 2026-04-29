// Ransom Note Forge — cut-out-letters composer

const FONTS = [
  'f-playfair', 'f-playfair-i',
  'f-merri', 'f-merri-i',
  'f-bebas', 'f-oswald', 'f-anton',
  'f-caveat', 'f-shadow',
  'f-elite',
  'f-black1', 'f-black2'
];

const PAPERS = [
  'p-newsprint', 'p-newsprint', 'p-newsprint', // slightly weighted toward newsprint
  'p-yellowed', 'p-yellowed',
  'p-glossy-pink', 'p-glossy-blue', 'p-glossy-green',
  'p-highlight', 'p-pinkhighlight',
  'p-black',
  'p-torn'
];

const ACCENT_COLORS = ['#7a1414', '#0b1d3a', '#2d1a00', '#111', '#111', '#111'];

const msgEl    = document.getElementById('msg');
const countEl  = document.getElementById('count');
const noteEl   = document.getElementById('note');
const errorEl  = document.getElementById('error');
const shareEl  = document.getElementById('share');
const forgeBtn = document.getElementById('forge-btn');
const rerollBtn = document.getElementById('reroll-btn');
const saveBtn  = document.getElementById('save-btn');

function pickFrom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function rngFactory(seed) {
  // xorshift32 — stable, fast
  let s = seed | 0;
  if (s === 0) s = 0x9e3779b1;
  return function () {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 0xffffffff);
  };
}

function randomSeed() {
  return (Math.random() * 0xffffffff) | 0;
}

function render(text, seed) {
  const rng = rngFactory(seed);
  noteEl.innerHTML = '';

  if (!text.trim()) {
    noteEl.textContent = '';
    return;
  }

  // Wrap tight: split into words so wrapping happens at word boundaries.
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const span = document.createElement('span');
    span.className = 'clip';

    if (ch === ' ' || ch === '\n') {
      span.classList.add('space');
      span.textContent = ch === '\n' ? '\u00A0' : '\u00A0';
      if (ch === '\n') {
        noteEl.appendChild(document.createElement('br'));
        continue;
      }
    } else {
      const font = pickFrom(FONTS, rng);
      const paper = pickFrom(PAPERS, rng);
      span.classList.add(font, paper);
      span.textContent = ch;

      // Rotation: -10..+10 deg
      const rot = (rng() * 20 - 10).toFixed(2);
      // Size: 24..56 px (bigger letters feel more real)
      const size = Math.floor(24 + rng() * 32);
      // Slight translate-y so letters don't feel perfectly baselined
      const dy = (rng() * 6 - 3).toFixed(1);

      span.style.transform = `rotate(${rot}deg) translateY(${dy}px)`;
      span.style.fontSize = size + 'px';

      // Occasional accent color override (only on light papers)
      if (!span.classList.contains('p-black') && rng() < 0.18) {
        span.style.color = pickFrom(ACCENT_COLORS, rng);
      }

      // Random slight padding tweak to vary clipping shapes
      const padY = Math.floor(2 + rng() * 6);
      const padX = Math.floor(4 + rng() * 8);
      span.style.padding = `${padY}px ${padX}px`;
    }

    noteEl.appendChild(span);
  }

  noteEl.setAttribute('aria-label', 'Ransom note reading: ' + text);
}

function updateCount() {
  countEl.textContent = String(msgEl.value.length);
}

function currentText() {
  return msgEl.value.trim();
}

function flashError(msg) {
  errorEl.textContent = msg;
  setTimeout(() => { errorEl.textContent = ''; }, 2600);
}

// Initial render with a computed seed so same-text looks consistent on load.
function seedForText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h || 1;
}

function doForge() {
  const t = currentText();
  if (!t) {
    flashError('type something first — even one cursed word will do.');
    return;
  }
  render(t, seedForText(t));
  shareEl.style.display = 'block';
}

function doReroll() {
  const t = currentText();
  if (!t) {
    flashError('nothing to re-roll yet. type a message.');
    return;
  }
  render(t, randomSeed());
  shareEl.style.display = 'block';
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function doSave() {
  if (!noteEl.firstChild) {
    flashError('forge it first, then save.');
    return;
  }
  if (typeof html2canvas !== 'function') {
    flashError('rendering engine still loading — try again in a sec.');
    return;
  }
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = 'Snapping...';

  // Give the browser a beat to ensure fonts are painted.
  requestAnimationFrame(() => {
    html2canvas(noteEl, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false
    }).then((canvas) => {
      const dataUrl = canvas.toDataURL('image/png');
      const stamp = Date.now().toString(36);
      triggerDownload(dataUrl, `ransom-note-${stamp}.png`);
    }).catch(() => {
      flashError('save failed — try re-rolling and saving again.');
    }).finally(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    });
  });
}

msgEl.addEventListener('input', updateCount);
forgeBtn.addEventListener('click', doForge);
rerollBtn.addEventListener('click', doReroll);
saveBtn.addEventListener('click', doSave);

msgEl.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    doForge();
  }
});

// First paint with the default message, waiting a tick for web fonts.
document.fonts && document.fonts.ready
  ? document.fonts.ready.then(() => { updateCount(); doForge(); })
  : (updateCount(), doForge());

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}
