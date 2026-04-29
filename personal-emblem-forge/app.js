// Personal Emblem Forge — deterministic heraldic emblem generator

// === Seeded randomness ===
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// === Trait data ===
const TRAITS = [
  'ambitious', 'curious', 'loyal', 'brave', 'wise',
  'creative', 'stoic', 'generous', 'fierce', 'gentle',
  'cunning', 'honest', 'patient', 'bold', 'humble',
  'passionate', 'resilient', 'witty', 'kind', 'tenacious'
];

// === Heraldic data pools ===
const ANIMALS = [
  { name: 'Lion', draw: drawLion },
  { name: 'Eagle', draw: drawEagle },
  { name: 'Stag', draw: drawStag },
  { name: 'Wolf', draw: drawWolf },
  { name: 'Bear', draw: drawBear },
  { name: 'Serpent', draw: drawSerpent },
  { name: 'Griffin', draw: drawGriffin },
  { name: 'Owl', draw: drawOwl },
  { name: 'Boar', draw: drawBoar },
  { name: 'Raven', draw: drawRaven }
];

// Each trait maps to heraldic meaning: animals it favors (weighted),
// preferred palette tones, patterns, and motto fragments.
// When the user picks 3 traits, votes are aggregated across these pools,
// so choices directly shape the emblem instead of being just a hash seed.
const TRAIT_MEANINGS = {
  ambitious:  { animals: ['Eagle', 'Griffin', 'Lion'],    palette: 'royal',    pattern: 'pale',       virtue: 'Vision',    closer: 'We Ascend' },
  curious:    { animals: ['Owl', 'Raven', 'Serpent'],     palette: 'twilight', pattern: 'saltire',    virtue: 'Wisdom',    closer: 'The Path Opens' },
  loyal:      { animals: ['Wolf', 'Stag', 'Bear'],        palette: 'forest',   pattern: 'fess',       virtue: 'Honor',     closer: 'We Stand' },
  brave:      { animals: ['Lion', 'Bear', 'Boar'],        palette: 'crimson',  pattern: 'chevron',    virtue: 'Courage',   closer: 'I Conquer' },
  wise:       { animals: ['Owl', 'Raven', 'Stag'],        palette: 'twilight', pattern: 'cross',      virtue: 'Wisdom',    closer: 'Light Persists' },
  creative:   { animals: ['Griffin', 'Serpent', 'Raven'], palette: 'violet',   pattern: 'quarterly',  virtue: 'Vision',    closer: 'All Burns Bright' },
  stoic:      { animals: ['Stag', 'Bear', 'Owl'],         palette: 'navy',     pattern: 'stripe',     virtue: 'Fortitude', closer: 'I Endure' },
  generous:   { animals: ['Stag', 'Lion', 'Griffin'],     palette: 'gold',     pattern: 'cross',      virtue: 'Grace',     closer: 'Light Persists' },
  fierce:     { animals: ['Lion', 'Wolf', 'Boar'],        palette: 'crimson',  pattern: 'saltire',    virtue: 'Fury',      closer: 'I Conquer' },
  gentle:     { animals: ['Stag', 'Owl', 'Raven'],        palette: 'verdant',  pattern: 'fess',       virtue: 'Grace',     closer: 'Light Persists' },
  cunning:    { animals: ['Serpent', 'Wolf', 'Raven'],    palette: 'shadow',   pattern: 'bend',       virtue: 'Vision',    closer: 'The Path Opens' },
  honest:     { animals: ['Stag', 'Lion', 'Eagle'],       palette: 'royal',    pattern: 'cross',      virtue: 'Truth',     closer: 'Light Persists' },
  patient:    { animals: ['Owl', 'Bear', 'Stag'],         palette: 'verdant',  pattern: 'stripe',     virtue: 'Patience',  closer: 'I Endure' },
  bold:       { animals: ['Lion', 'Eagle', 'Griffin'],    palette: 'crimson',  pattern: 'chevron',    virtue: 'Courage',   closer: 'I Rise' },
  humble:     { animals: ['Raven', 'Owl', 'Stag'],        palette: 'shadow',   pattern: 'fess',       virtue: 'Grace',     closer: 'We Stand' },
  passionate: { animals: ['Lion', 'Griffin', 'Boar'],     palette: 'crimson',  pattern: 'saltire',    virtue: 'Fury',      closer: 'All Burns Bright' },
  resilient:  { animals: ['Bear', 'Boar', 'Wolf'],        palette: 'forest',   pattern: 'chevron',    virtue: 'Fortitude', closer: 'I Endure' },
  witty:      { animals: ['Raven', 'Owl', 'Serpent'],     palette: 'violet',   pattern: 'bend',       virtue: 'Wisdom',    closer: 'The Path Opens' },
  kind:       { animals: ['Stag', 'Owl', 'Lion'],         palette: 'gold',     pattern: 'fess',       virtue: 'Grace',     closer: 'Light Persists' },
  tenacious:  { animals: ['Boar', 'Wolf', 'Bear'],        palette: 'shadow',   pattern: 'pale',       virtue: 'Resolve',   closer: 'I Prevail' }
};

const PALETTE_MAP = {
  crimson:  { primary: '#8b1a1a', secondary: '#c5952a', accent: '#1a2744' },  // crimson & gold — fire, blood, valor
  navy:     { primary: '#1a2744', secondary: '#c5952a', accent: '#8b1a1a' },  // navy & gold — steady, loyal
  forest:   { primary: '#2a4a2a', secondary: '#c5952a', accent: '#1a2744' },  // forest & gold — rooted
  violet:   { primary: '#4a1a4a', secondary: '#c5952a', accent: '#2a4a2a' },  // violet & gold — creative, strange
  royal:    { primary: '#1a2744', secondary: '#b8860b', accent: '#8b1a1a' },  // navy & dark gold — regal
  twilight: { primary: '#2a2044', secondary: '#b8a630', accent: '#1a3a44' },  // twilight blue — wise, curious
  verdant:  { primary: '#2a3a1a', secondary: '#c49a2a', accent: '#4a1a2a' },  // verdant olive — gentle, patient
  shadow:   { primary: '#2a1a2a', secondary: '#b8942a', accent: '#1a3a44' },  // shadow — humble, cunning
  gold:     { primary: '#5c3a1a', secondary: '#d4a439', accent: '#2a4a2a' },  // gold & earth — generous
};

const MOTTO_PARTS = {
  openers: [
    'Through', 'By', 'With', 'In', 'From', 'Beyond', 'Above', 'Beneath'
  ],
  virtues: [
    'Valor', 'Honor', 'Wisdom', 'Courage', 'Truth', 'Strength',
    'Fortitude', 'Grace', 'Resolve', 'Vision', 'Fury', 'Patience'
  ],
  closers: [
    'I Rise', 'I Endure', 'I Prevail', 'We Stand', 'I Conquer',
    'I Forge Ahead', 'All Burns Bright', 'The Path Opens',
    'Victory Follows', 'Light Persists', 'We Ascend', 'I Am Forged'
  ]
};

const PATTERNS = ['chevron', 'stripe', 'quarterly', 'pale', 'cross', 'saltire', 'bend', 'fess'];

// === Trait-driven pickers ===
// Tally votes across the 3 selected traits and break ties deterministically
// using the name-seeded RNG, so two different trait sets always yield
// meaningfully different emblems — but the same inputs reproduce the same result.
function tallyVotes(traits, key) {
  const tally = {};
  traits.forEach(t => {
    const meaning = TRAIT_MEANINGS[t];
    if (!meaning) return;
    const val = meaning[key];
    if (Array.isArray(val)) {
      val.forEach((v, i) => {
        // earlier entries in the list get more weight
        const w = val.length - i;
        tally[v] = (tally[v] || 0) + w;
      });
    } else if (val) {
      tally[val] = (tally[val] || 0) + 1;
    }
  });
  return tally;
}

function pickFromTally(tally, rand) {
  const entries = Object.entries(tally);
  if (entries.length === 0) return null;
  const maxScore = Math.max(...entries.map(e => e[1]));
  const topChoices = entries.filter(e => e[1] === maxScore).map(e => e[0]);
  return topChoices[Math.floor(rand() * topChoices.length)];
}

const COMPUTING_MESSAGES = [
  'The blacksmith heats the iron... consulting ancient heraldic tomes...',
  'Smelting your essence into molten sigils...',
  'The herald squints at dusty scrolls, seeking your lineage...',
  'A raven carries your name to the College of Arms...',
  'The forge glows white-hot... your crest takes shape in the flames...'
];

// === Trait chip rendering ===
const traitsGrid = document.getElementById('traits-grid');
const traitCount = document.getElementById('trait-count');
let selectedTraits = [];

TRAITS.forEach(trait => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'trait-chip';
  chip.textContent = trait;
  chip.addEventListener('click', () => {
    if (chip.classList.contains('selected')) {
      chip.classList.remove('selected');
      selectedTraits = selectedTraits.filter(t => t !== trait);
    } else if (selectedTraits.length < 3) {
      chip.classList.add('selected');
      selectedTraits.push(trait);
    }
    traitCount.textContent = selectedTraits.length + ' of 3 selected';
  });
  traitsGrid.appendChild(chip);
});

// === Form submission ===
document.getElementById('input-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const nameVal = document.getElementById('name-input').value.trim();
  const errorMsg = document.getElementById('error-msg');

  if (!nameVal) {
    errorMsg.textContent = 'The forge needs a name to work with — even a false one will do.';
    errorMsg.style.display = 'block';
    return;
  }
  if (selectedTraits.length !== 3) {
    errorMsg.textContent = 'Three traits, no more, no less — the heraldic code demands it.';
    errorMsg.style.display = 'block';
    return;
  }

  errorMsg.style.display = 'none';
  document.getElementById('input-form').style.display = 'none';

  const computing = document.getElementById('computing');
  const seed = hash(nameVal + selectedTraits.join(''));
  const rand = seededRandom(seed);
  const msgIdx = Math.floor(rand() * COMPUTING_MESSAGES.length);
  document.getElementById('computing-msg').textContent = COMPUTING_MESSAGES[msgIdx];
  computing.style.display = 'block';

  setTimeout(() => {
    computing.style.display = 'none';
    generateEmblem(nameVal, selectedTraits);
  }, 1200);
});

// === Emblem generation ===
function generateEmblem(name, traits) {
  const seedStr = name.toLowerCase() + traits.slice().sort().join('');
  const seed = hash(seedStr);
  const rand = seededRandom(seed);

  // Traits vote for specific heraldic elements. Name only breaks ties, so the
  // emblem reflects your choices, not your name hash.
  const animalName = pickFromTally(tallyVotes(traits, 'animals'), rand);
  const paletteKey = pickFromTally(tallyVotes(traits, 'palette'), rand);
  const pattern    = pickFromTally(tallyVotes(traits, 'pattern'), rand);
  const virtue     = pickFromTally(tallyVotes(traits, 'virtue'), rand);
  const closer     = pickFromTally(tallyVotes(traits, 'closer'), rand);

  const animal = ANIMALS.find(a => a.name === animalName) || ANIMALS[0];
  const palette = PALETTE_MAP[paletteKey] || PALETTE_MAP.crimson;

  const mottoOpener = MOTTO_PARTS.openers[Math.floor(rand() * MOTTO_PARTS.openers.length)];
  const mottoVirtue = virtue || MOTTO_PARTS.virtues[0];
  const mottoCloser = closer || MOTTO_PARTS.closers[0];
  const motto = mottoOpener + ' ' + mottoVirtue + ', ' + mottoCloser;

  const canvas = document.getElementById('emblem-canvas');
  const ctx = canvas.getContext('2d');
  const W = 600, H = 700;
  canvas.width = W;
  canvas.height = H;

  // Parchment background
  ctx.fillStyle = '#f0e6d0';
  ctx.fillRect(0, 0, W, H);

  // Add texture noise
  drawParchmentTexture(ctx, W, H, rand);

  // Draw shield
  const shieldX = W / 2;
  const shieldY = 100;
  const shieldW = 340;
  const shieldH = 400;

  drawShield(ctx, shieldX, shieldY, shieldW, shieldH, palette, pattern, rand);

  // Draw animal centered on shield
  const animalCx = shieldX;
  const animalCy = shieldY + shieldH * 0.42;
  animal.draw(ctx, animalCx, animalCy, 130, palette);

  // Draw shield border (heavy woodcut line)
  drawShieldOutline(ctx, shieldX, shieldY, shieldW, shieldH);

  // Name banner on top
  drawBanner(ctx, shieldX, shieldY - 20, name.toUpperCase(), palette);

  // Motto ribbon at bottom
  drawMottoBanner(ctx, shieldX, shieldY + shieldH + 30, motto, palette);

  // Animal name label
  ctx.fillStyle = '#1a1410';
  ctx.font = '16px "IM Fell English SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Charge: ' + animal.name, shieldX, shieldY + shieldH + 80);

  // Show result
  document.getElementById('result').style.display = 'flex';
  document.getElementById('share').style.display = 'flex';
  document.getElementById('restart-btn').style.display = 'block';

  const traitStr = traits.join(', ');
  const paletteName = (paletteKey || 'crimson').replace(/^./, c => c.toUpperCase());
  document.getElementById('result-copy').textContent =
    'The forge has spoken for ' + name + '. Your ' + traitStr +
    ' nature summoned the ' + animal.name + ' upon a ' + paletteName +
    ' field in the ' + pattern + ' pattern, crowned with the motto: "' + motto + '."';
}

// === Drawing helpers ===

function drawParchmentTexture(ctx, W, H, rand) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 3000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const s = rand() * 2 + 0.5;
    ctx.fillStyle = rand() > 0.5 ? '#1a1410' : '#8a7a60';
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function getShieldPath(ctx, cx, topY, w, h) {
  const left = cx - w / 2;
  const right = cx + w / 2;
  ctx.beginPath();
  ctx.moveTo(left, topY);
  ctx.lineTo(right, topY);
  ctx.lineTo(right, topY + h * 0.6);
  ctx.quadraticCurveTo(right, topY + h * 0.85, cx, topY + h);
  ctx.quadraticCurveTo(left, topY + h * 0.85, left, topY + h * 0.6);
  ctx.closePath();
}

function drawShield(ctx, cx, topY, w, h, palette, pattern, rand) {
  ctx.save();
  getShieldPath(ctx, cx, topY, w, h);
  ctx.fillStyle = palette.primary;
  ctx.fill();

  // Pattern overlay
  ctx.save();
  getShieldPath(ctx, cx, topY, w, h);
  ctx.clip();
  drawPattern(ctx, cx, topY, w, h, pattern, palette, rand);
  ctx.restore();

  ctx.restore();
}

function drawPattern(ctx, cx, topY, w, h, pattern, palette, rand) {
  const left = cx - w / 2;
  const right = cx + w / 2;
  ctx.fillStyle = palette.secondary;
  ctx.globalAlpha = 0.35;

  switch (pattern) {
    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(left, topY + h * 0.55);
      ctx.lineTo(cx, topY + h * 0.35);
      ctx.lineTo(right, topY + h * 0.55);
      ctx.lineTo(right, topY + h * 0.65);
      ctx.lineTo(cx, topY + h * 0.45);
      ctx.lineTo(left, topY + h * 0.65);
      ctx.closePath();
      ctx.fill();
      break;
    case 'stripe':
      for (let i = 0; i < 5; i += 2) {
        ctx.fillRect(left, topY + (h / 5) * i, w, h / 5);
      }
      break;
    case 'quarterly':
      ctx.fillRect(left, topY, w / 2, h / 2);
      ctx.fillRect(cx, topY + h / 2, w / 2, h / 2);
      break;
    case 'pale':
      ctx.fillRect(cx - w / 6, topY, w / 3, h);
      break;
    case 'cross':
      ctx.fillRect(cx - w * 0.08, topY, w * 0.16, h);
      ctx.fillRect(left, topY + h * 0.35, w, h * 0.16);
      break;
    case 'saltire':
      ctx.save();
      ctx.translate(cx, topY + h / 2);
      ctx.lineWidth = w * 0.12;
      ctx.strokeStyle = palette.secondary;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.moveTo(w / 2, -h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.stroke();
      ctx.restore();
      break;
    case 'bend':
      ctx.beginPath();
      ctx.moveTo(left, topY);
      ctx.lineTo(left + w * 0.2, topY);
      ctx.lineTo(right, topY + h * 0.8);
      ctx.lineTo(right - w * 0.2, topY + h);
      ctx.closePath();
      ctx.fill();
      break;
    case 'fess':
      ctx.fillRect(left, topY + h * 0.38, w, h * 0.24);
      break;
  }
  ctx.globalAlpha = 1;
}

function drawShieldOutline(ctx, cx, topY, w, h) {
  ctx.save();
  getShieldPath(ctx, cx, topY, w, h);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a1410';
  ctx.stroke();

  // Inner border for woodcut feel
  getShieldPath(ctx, cx, topY + 6, w - 12, h - 12);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBanner(ctx, cx, bottomY, text, palette) {
  const bw = 300, bh = 50;
  const left = cx - bw / 2;
  const top = bottomY - bh;

  // Banner shape
  ctx.save();
  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.moveTo(left - 30, top + 5);
  ctx.lineTo(left, top);
  ctx.lineTo(left + bw, top);
  ctx.lineTo(left + bw + 30, top + 5);
  ctx.lineTo(left + bw + 20, top + bh / 2);
  ctx.lineTo(left + bw + 30, top + bh - 5);
  ctx.lineTo(left + bw, top + bh);
  ctx.lineTo(left, top + bh);
  ctx.lineTo(left - 30, top + bh - 5);
  ctx.lineTo(left - 20, top + bh / 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1410';
  ctx.stroke();
  ctx.restore();

  // Text
  ctx.save();
  ctx.fillStyle = '#1a1410';
  ctx.font = 'bold 22px "MedievalSharp", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Truncate if too long
  let displayText = text;
  while (ctx.measureText(displayText).width > bw - 20 && displayText.length > 3) {
    displayText = displayText.slice(0, -1);
  }

  ctx.fillText(displayText, cx, top + bh / 2 + 1);
  ctx.restore();
}

function drawMottoBanner(ctx, cx, topY, text, palette) {
  const bw = 360, bh = 36;
  const left = cx - bw / 2;

  ctx.save();
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(left - 15, topY);
  ctx.lineTo(left + bw + 15, topY);
  ctx.lineTo(left + bw + 8, topY + bh);
  ctx.lineTo(left - 8, topY + bh);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1410';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = palette.secondary;
  ctx.font = 'italic 15px "IM Fell English SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, topY + bh / 2 + 1);
  ctx.restore();
}

// === Animal drawing functions (stylized woodcut) ===

function drawLion(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 10, s * 0.35, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Mane
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const r = s * 0.38 + Math.sin(a * 5) * s * 0.08;
    const x = Math.cos(a) * r;
    const y = -s * 0.15 + Math.sin(a) * r * 0.8;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = palette.secondary;
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(0, -s * 0.15, s * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = palette.secondary;
  ctx.fill();
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(-s * 0.08, -s * 0.18, 4, 0, Math.PI * 2);
  ctx.arc(s * 0.08, -s * 0.18, 4, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.08);
  ctx.lineTo(0, -s * 0.04);
  ctx.lineTo(s * 0.06, -s * 0.08);
  ctx.stroke();

  // Crown mark
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.35);
  ctx.lineTo(-s * 0.05, -s * 0.42);
  ctx.lineTo(0, -s * 0.35);
  ctx.lineTo(s * 0.05, -s * 0.42);
  ctx.lineTo(s * 0.1, -s * 0.35);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

function drawEagle(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Wings spread
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.1);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.5, -s * 0.55, -s * 0.15);
  ctx.quadraticCurveTo(-s * 0.45, 0, -s * 0.2, s * 0.1);
  ctx.lineTo(0, s * 0.05);
  ctx.quadraticCurveTo(s * 0.2, s * 0.1, s * 0.2, s * 0.1);
  ctx.lineTo(0, s * 0.05);
  ctx.fill();
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.1);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.5, s * 0.55, -s * 0.15);
  ctx.quadraticCurveTo(s * 0.45, 0, s * 0.2, s * 0.1);
  ctx.lineTo(0, s * 0.05);
  ctx.fill();
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.15, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(0, -s * 0.18, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Beak
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(s * 0.04, -s * 0.18);
  ctx.lineTo(s * 0.2, -s * 0.16);
  ctx.lineTo(s * 0.04, -s * 0.12);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.beginPath();
  ctx.arc(-s * 0.02, -s * 0.2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Tail feathers
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6, s * 0.3);
    ctx.lineTo(i * 12, s * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStag(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.25, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.05);
  ctx.lineTo(-s * 0.02, -s * 0.3);
  ctx.lineTo(s * 0.08, -s * 0.3);
  ctx.lineTo(s * 0.05, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.03, -s * 0.35, s * 0.1, s * 0.09, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Antlers
  ctx.lineWidth = 2.5;
  // Left antler
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.42);
  ctx.lineTo(-s * 0.18, -s * 0.62);
  ctx.moveTo(-s * 0.1, -s * 0.52);
  ctx.lineTo(-s * 0.2, -s * 0.5);
  ctx.moveTo(-s * 0.14, -s * 0.57);
  ctx.lineTo(-s * 0.08, -s * 0.65);
  ctx.stroke();
  // Right antler
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.42);
  ctx.lineTo(s * 0.24, -s * 0.62);
  ctx.moveTo(s * 0.16, -s * 0.52);
  ctx.lineTo(s * 0.26, -s * 0.5);
  ctx.moveTo(s * 0.2, -s * 0.57);
  ctx.lineTo(s * 0.14, -s * 0.65);
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.36, 3, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, s * 0.25);
  ctx.lineTo(-s * 0.15, s * 0.5);
  ctx.moveTo(s * 0.12, s * 0.25);
  ctx.lineTo(s * 0.15, s * 0.5);
  ctx.moveTo(-s * 0.05, s * 0.25);
  ctx.lineTo(-s * 0.08, s * 0.5);
  ctx.moveTo(s * 0.05, s * 0.25);
  ctx.lineTo(s * 0.08, s * 0.5);
  ctx.stroke();

  ctx.restore();
}

function drawWolf(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.05, s * 0.3, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.05, -s * 0.25, s * 0.16, s * 0.13, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.35);
  ctx.lineTo(-s * 0.12, -s * 0.5);
  ctx.lineTo(0, -s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.08, -s * 0.35);
  ctx.lineTo(s * 0.15, -s * 0.5);
  ctx.lineTo(s * 0.18, -s * 0.33);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.beginPath();
  ctx.moveTo(s * 0.15, -s * 0.25);
  ctx.lineTo(s * 0.3, -s * 0.22);
  ctx.lineTo(s * 0.15, -s * 0.18);
  ctx.closePath();
  ctx.fillStyle = palette.secondary;
  ctx.fill();
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.27, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(-s * 0.25, 0);
  ctx.quadraticCurveTo(-s * 0.45, -s * 0.2, -s * 0.35, -s * 0.35);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, s * 0.22);
  ctx.lineTo(-s * 0.15, s * 0.48);
  ctx.moveTo(s * 0.12, s * 0.22);
  ctx.lineTo(s * 0.15, s * 0.48);
  ctx.stroke();

  ctx.restore();
}

function drawBear(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body (large, round)
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.32, s * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.arc(-s * 0.14, -s * 0.42, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.14, -s * 0.42, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.22, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d4c4a8';
  ctx.fill();
  ctx.stroke();

  // Nose
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(0, -s * 0.23, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.beginPath();
  ctx.arc(-s * 0.07, -s * 0.32, 3.5, 0, Math.PI * 2);
  ctx.arc(s * 0.07, -s * 0.32, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Paws
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, s * 0.35);
  ctx.lineTo(-s * 0.22, s * 0.5);
  ctx.moveTo(s * 0.2, s * 0.35);
  ctx.lineTo(s * 0.22, s * 0.5);
  ctx.stroke();

  ctx.restore();
}

function drawSerpent(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Coiling body
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.4, -s * 0.25, s * 0.3, s * 0.05, 0, s * 0.05);
  ctx.bezierCurveTo(-s * 0.3, s * 0.05, -s * 0.35, s * 0.3, 0, s * 0.35);
  ctx.bezierCurveTo(s * 0.2, s * 0.38, s * 0.15, s * 0.48, s * 0.05, s * 0.5);
  ctx.lineWidth = 12;
  ctx.strokeStyle = palette.secondary;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1410';
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.38, s * 0.1, s * 0.07, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = palette.secondary;
  ctx.fill();
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(-s * 0.02, -s * 0.39, 3, 0, Math.PI * 2);
  ctx.fill();

  // Tongue
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#8b1a1a';
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.37);
  ctx.lineTo(-s * 0.16, -s * 0.35);
  ctx.moveTo(-s * 0.13, -s * 0.36);
  ctx.lineTo(-s * 0.16, -s * 0.4);
  ctx.stroke();

  // Scale pattern
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const bx = Math.sin(t * Math.PI * 2) * s * 0.15;
    const by = -s * 0.3 + t * s * 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawGriffin(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Lion body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eagle head
  ctx.beginPath();
  ctx.arc(0, -s * 0.2, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Beak
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.2);
  ctx.lineTo(s * 0.25, -s * 0.18);
  ctx.lineTo(s * 0.1, -s * 0.14);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.beginPath();
  ctx.arc(-s * 0.02, -s * 0.22, 3, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.05);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.4, -s * 0.4, -s * 0.15);
  ctx.quadraticCurveTo(-s * 0.35, s * 0.05, -s * 0.1, s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ear tufts
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.32);
  ctx.lineTo(-s * 0.15, -s * 0.45);
  ctx.moveTo(s * 0.02, -s * 0.33);
  ctx.lineTo(s * 0.05, -s * 0.46);
  ctx.stroke();

  // Tail
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.22, s * 0.15);
  ctx.quadraticCurveTo(-s * 0.4, s * 0.05, -s * 0.38, s * 0.3);
  ctx.stroke();

  // Front talons
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.28);
  ctx.lineTo(-s * 0.12, s * 0.48);
  ctx.moveTo(s * 0.1, s * 0.28);
  ctx.lineTo(s * 0.12, s * 0.48);
  ctx.stroke();

  ctx.restore();
}

function drawOwl(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.22, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(0, -s * 0.22, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ear tufts
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.36);
  ctx.lineTo(-s * 0.18, -s * 0.52);
  ctx.lineTo(-s * 0.04, -s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.36);
  ctx.lineTo(s * 0.18, -s * 0.52);
  ctx.lineTo(s * 0.04, -s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eyes (large, round)
  ctx.fillStyle = '#f0e6d0';
  ctx.beginPath();
  ctx.arc(-s * 0.07, -s * 0.22, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.07, -s * 0.22, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pupils
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(-s * 0.07, -s * 0.22, s * 0.04, 0, Math.PI * 2);
  ctx.arc(s * 0.07, -s * 0.22, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.beginPath();
  ctx.moveTo(-s * 0.03, -s * 0.15);
  ctx.lineTo(0, -s * 0.08);
  ctx.lineTo(s * 0.03, -s * 0.15);
  ctx.closePath();
  ctx.fillStyle = '#c5952a';
  ctx.fill();
  ctx.stroke();

  // Wing marks
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1a1410';
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-s * 0.12, -s * 0.05 + i * s * 0.1, s * 0.1, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.12, -s * 0.05 + i * s * 0.1, s * 0.1, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawBoar(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.05, s * 0.32, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.15, -s * 0.18, s * 0.16, s * 0.14, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.beginPath();
  ctx.ellipse(s * 0.3, -s * 0.14, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d4c4a8';
  ctx.fill();
  ctx.stroke();

  // Tusks
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#f0e6d0';
  ctx.beginPath();
  ctx.moveTo(s * 0.25, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.35, -s * 0.3, s * 0.3, -s * 0.35);
  ctx.stroke();
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.22, 3, 0, Math.PI * 2);
  ctx.fill();

  // Mane bristles
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1410';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const bx = -s * 0.1 + i * s * 0.07;
    ctx.moveTo(bx, -s * 0.08);
    ctx.lineTo(bx - s * 0.02, -s * 0.2);
    ctx.stroke();
  }

  // Legs
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, s * 0.24);
  ctx.lineTo(-s * 0.18, s * 0.48);
  ctx.moveTo(s * 0.1, s * 0.24);
  ctx.lineTo(s * 0.13, s * 0.48);
  ctx.moveTo(-s * 0.05, s * 0.24);
  ctx.lineTo(-s * 0.06, s * 0.48);
  ctx.moveTo(s * 0.2, s * 0.22);
  ctx.lineTo(s * 0.22, s * 0.48);
  ctx.stroke();

  ctx.restore();
}

function drawRaven(ctx, cx, cy, size, palette) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 3;
  ctx.fillStyle = palette.secondary;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.18, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wings tucked
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, -s * 0.08);
  ctx.quadraticCurveTo(-s * 0.38, s * 0.05, -s * 0.3, s * 0.35);
  ctx.lineTo(-s * 0.08, s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s * 0.12, -s * 0.08);
  ctx.quadraticCurveTo(s * 0.38, s * 0.05, s * 0.3, s * 0.35);
  ctx.lineTo(s * 0.08, s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(0, -s * 0.22, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Beak
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(s * 0.08, -s * 0.24);
  ctx.lineTo(s * 0.25, -s * 0.2);
  ctx.lineTo(s * 0.08, -s * 0.17);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#f0e6d0';
  ctx.beginPath();
  ctx.arc(-s * 0.01, -s * 0.24, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(-s * 0.01, -s * 0.24, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Tail feathers
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, s * 0.32);
  ctx.lineTo(-s * 0.08, s * 0.5);
  ctx.moveTo(0, s * 0.34);
  ctx.lineTo(0, s * 0.52);
  ctx.moveTo(s * 0.04, s * 0.32);
  ctx.lineTo(s * 0.08, s * 0.5);
  ctx.stroke();

  // Perch feet
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, s * 0.32);
  ctx.lineTo(-s * 0.12, s * 0.38);
  ctx.lineTo(-s * 0.02, s * 0.36);
  ctx.moveTo(s * 0.06, s * 0.32);
  ctx.lineTo(s * 0.12, s * 0.38);
  ctx.lineTo(s * 0.02, s * 0.36);
  ctx.stroke();

  ctx.restore();
}

// === Download ===
function downloadEmblem() {
  const canvas = document.getElementById('emblem-canvas');
  const link = document.createElement('a');
  link.download = 'my-personal-emblem.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// === Share ===
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}

// === Restart ===
function restart() {
  document.getElementById('result').style.display = 'none';
  document.getElementById('share').style.display = 'none';
  document.getElementById('restart-btn').style.display = 'none';
  document.getElementById('input-form').style.display = 'flex';

  // Reset selections
  selectedTraits = [];
  document.querySelectorAll('.trait-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('trait-count').textContent = '0 of 3 selected';
  document.getElementById('name-input').value = '';
}
