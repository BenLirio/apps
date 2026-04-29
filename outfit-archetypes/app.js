/* =============================================
   OUTFIT ARCHETYPES — app.js
   Style oracle using vision + AI text endpoints
   ============================================= */

'use strict';

// ── Endpoints ──────────────────────────────────
const VISION_ENDPOINT = 'https://sm3y7y9t2a.execute-api.us-east-1.amazonaws.com/vision';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'outfit-archetypes';

// ── Archetypes ────────────────────────────────
const ARCHETYPES = [
  {
    name: 'The Maximalist Curator',
    tagline: 'More is more, and you know exactly how to orchestrate the chaos.',
    fallback: 'Your outfit is a portfolio review that somehow passed every jury.'
  },
  {
    name: 'Stealth Luxury Understater',
    tagline: 'Quiet quality speaks louder than logos ever could.',
    fallback: 'Three people have already Googled what brand those are.'
  },
  {
    name: 'Chaotic Thrift Spirit',
    tagline: 'Every piece tells a different story; together they\'re a novel.',
    fallback: 'You dressed like a time capsule containing five different decades.'
  },
  {
    name: 'Corporate Rebel',
    tagline: 'The blazer says boardroom; everything else says otherwise.',
    fallback: 'You found the exact line between employed and unemployable and parked there.'
  },
  {
    name: 'Coastal Drifter',
    tagline: 'You dress like you just got off a boat and need to be somewhere nice.',
    fallback: 'Salt air is almost certainly involved in your morning routine.'
  },
  {
    name: 'The Art Student',
    tagline: 'Fashion is a thesis statement. Yours is currently in revision.',
    fallback: 'At least two items on your body are technically a critique of capitalism.'
  },
  {
    name: 'Nostalgic Reconstructionist',
    tagline: 'You excavate aesthetics from the past and make them feel urgent.',
    fallback: 'You are wearing something your parents threw away in 1994 and you are winning.'
  },
  {
    name: 'Monochrome Theorist',
    tagline: 'You\'ve chosen a color system and you\'re committed to the bit.',
    fallback: 'You have achieved the rare harmony of people who are afraid to touch the walls.'
  },
  {
    name: 'Soft Futurist',
    tagline: 'Technical fabrics, gentle pastels, and an air of mild anxiety about the climate.',
    fallback: 'Your outfit is kindly prepared for a mild emergency.'
  },
  {
    name: 'The Eclectic Professor',
    tagline: 'You dressed in the dark but it somehow works completely.',
    fallback: 'You have accidentally arrived at a look that took other people years of study.'
  },
  {
    name: 'Uptown Slacker',
    tagline: 'Expensive shoes. Zero effort elsewhere. Maximum results.',
    fallback: 'The footwear alone has rendered every other choice irrelevant.'
  },
  {
    name: 'Tactical Minimalist',
    tagline: 'Every item has a purpose. Decorative elements have not been approved.',
    fallback: 'Your outfit would pass a rigorous impact assessment.'
  },
  {
    name: 'Romantic Catastrophist',
    tagline: 'Flowy and a little bit doomed. Absolutely gorgeous.',
    fallback: 'You look like the protagonist of a film where something important happens in the rain.'
  },
  {
    name: 'The Method Actor',
    tagline: 'You dressed for a character. The character is compelling.',
    fallback: 'There is a committed internal logic to this look that rewards close reading.'
  },
  {
    name: 'Park Slope Parent',
    tagline: 'Athleisure to brunch to the farmer\'s market. A tight loop.',
    fallback: 'Your outfit is technically ready for a half-marathon you are not planning to run.'
  },
  {
    name: 'The Fashion Archaeologist',
    tagline: 'You found something nobody else was wearing yet. Again.',
    fallback: 'In approximately eighteen months, a trend piece will describe your outfit as \'emerging\'.'
  },
  {
    name: 'Quiet Luxury Maximalist',
    tagline: 'You have successfully broken the paradox. It looks great.',
    fallback: 'This should cancel itself out. It does not cancel itself out.'
  },
  {
    name: 'Urban Forager',
    tagline: 'Layered, functional, and clearly prepared for unexpected weather.',
    fallback: 'You have achieved the impossible: you are both practical and interesting.'
  },
  {
    name: 'The Dandy in Training',
    tagline: 'One accessory away from being fully committed.',
    fallback: 'The entire fit is building toward something. It is nearly there.'
  },
  {
    name: 'Chaos Luxe',
    tagline: 'This should not work. It absolutely works.',
    fallback: 'The oracle has no further notes. This has already been resolved in your favor.'
  }
];

// ── Simple hash from image data URL ──────────
function hashFromImageData(dataUrl) {
  // Use length + first 100 chars as seed
  const seed = dataUrl.length + dataUrl.slice(0, 100);
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    h = ((h << 5) - h) + char;
    h = h & h; // to 32-bit int
  }
  return Math.abs(h);
}

function pickArchetypeFromHash(hash) {
  return ARCHETYPES[hash % ARCHETYPES.length];
}

// ── Image resize helper ───────────────────────
function fileToResizedDataURL(file, maxEdge = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = objUrl;
  });
}

// ── Vision API: analyze outfit ────────────────
async function analyzeOutfitWithVision(imageDataUrl) {
  const prompt = `You are a fashion oracle. Look at this outfit photo and describe in 2-3 SHORT sentences: the dominant colors and color blocking, the silhouette and fit, and the overall vibe or aesthetic energy. Be specific and vivid but concise. Do not make judgments. Output only the description, nothing else.`;

  try {
    const res = await fetch(VISION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        image: imageDataUrl,
        prompt,
        quality: 'fast',
        max_tokens: 200
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    return (data.text || '').trim() || null;
  } catch (_) {
    return null;
  }
}

// ── AI Text: personalized diagnosis sentence ──
async function generateDiagnosis(archetypeName, visionDescription) {
  const userContent = visionDescription
    ? `Archetype: ${archetypeName}\nWhat the oracle saw: ${visionDescription}`
    : `Archetype: ${archetypeName}`;

  const messages = [
    {
      role: 'system',
      content: 'You are a fashion oracle writing one eerie, eerily accurate style diagnosis sentence. Under 30 words. Speaks directly to the person ("you"). No emojis. No hashtags. Dry wit, high specificity. Feels like the oracle saw something real.'
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 80 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    return (data.content || '').trim() || null;
  } catch (_) {
    return null;
  }
}

// ── DOM helpers ───────────────────────────────
function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Loading messages ──────────────────────────
const LOADING_LINES = [
  'Reading your outfit\u2026',
  'Consulting the archive of silhouettes\u2026',
  'Decoding your color theory\u2026',
  'The oracle is assessing the vibe\u2026',
  'Cross-referencing the canon\u2026'
];
let loadingInterval;

function startLoadingAnimation() {
  let i = 0;
  setText('loading-line', LOADING_LINES[0]);
  loadingInterval = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    setText('loading-line', LOADING_LINES[i]);
  }, 1800);
}

function stopLoadingAnimation() {
  clearInterval(loadingInterval);
}

// ── Main flow ─────────────────────────────────
let currentArchetype = null;

async function processOutfitPhoto(file) {
  // Switch to loading
  hide('pre-state');
  show('loading-state');
  startLoadingAnimation();

  let imageDataUrl;
  try {
    imageDataUrl = await fileToResizedDataURL(file);
  } catch (_) {
    // Can't read image — fall back
    stopLoadingAnimation();
    hide('loading-state');
    show('pre-state');
    alert("Couldn't read that image. Try a JPG or PNG.");
    return;
  }

  // Deterministic archetype from image hash
  const hash = hashFromImageData(imageDataUrl);
  const archetype = pickArchetypeFromHash(hash);
  currentArchetype = archetype;

  // Wait at least 1.5s for the oracle feel, then call APIs in parallel
  const [_, visionResult, diagnosisResult] = await Promise.all([
    new Promise(r => setTimeout(r, 1500)),
    analyzeOutfitWithVision(imageDataUrl),
    // We'll get diagnosis after vision since it enriches it, but run in parallel with timeout
    null
  ]);

  // Get diagnosis using vision result (if available)
  const diagnosis = await generateDiagnosis(archetype.name, visionResult);

  stopLoadingAnimation();

  // Render result
  renderResult(archetype, visionResult, diagnosis);
}

function renderResult(archetype, visionDescription, diagnosis) {
  setText('badge-name', archetype.name);
  setText('archetype-tagline', archetype.tagline);

  // AI diagnosis
  const diagnosisText = diagnosis || archetype.fallback;
  setText('diagnosis-text', diagnosisText);

  // Vision flavor note
  if (visionDescription) {
    setText('vision-text', visionDescription);
    const visionBlock = document.getElementById('vision-note-block');
    if (visionBlock) visionBlock.style.display = 'block';
  } else {
    const visionBlock = document.getElementById('vision-note-block');
    if (visionBlock) visionBlock.style.display = 'none';
  }

  hide('loading-state');
  show('result-state');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Share ─────────────────────────────────────
function shareResult() {
  if (!currentArchetype) return;
  const text = `My outfit archetype: ${currentArchetype.name}\n"${currentArchetype.tagline}"\n\nFind yours → https://benlirio.com/outfit-archetypes/`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}

function copyFallback(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy your archetype to share'; }, 2000);
      }
    }).catch(() => {});
  }
}

// ── Restart ───────────────────────────────────
function restart() {
  currentArchetype = null;

  // Reset file input
  const input = document.getElementById('photo-input');
  if (input) input.value = '';

  hide('result-state');
  hide('loading-state');
  show('pre-state');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Wire up file input ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const photoInput = document.getElementById('photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processOutfitPhoto(file);
      }
    });
  }

  // Make upload area draggable
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#e8d08a';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        processOutfitPhoto(file);
      }
    });
  }
});

// Expose globals for inline onclick handlers
window.shareResult = shareResult;
window.restart = restart;
