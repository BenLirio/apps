// ghost.js — share-fragment encode/decode + verdict naming.
//
// The URL fragment encodes the user's three pull lengths in a tiny base32-ish
// payload so it survives mobile SMS linkification (well under 300 chars). The
// verdict is a deterministic function of the three lengths so the recipient
// who clicks an "I got X" share message would, on a fresh device, see the same
// dental archetype. (We don't share the verdict in the URL — we recompute it
// from the lengths, which keeps the URL minimal.)
//
// Determinism rule from the design doc: same input always produces same output.

// ---------- length formatting ----------

export function formatLen(cm) {
  // Force 1 decimal — readable, photogenic.
  if (!isFinite(cm)) return '0.0 cm';
  return `${cm.toFixed(1)} cm`;
}

// ---------- URL fragment codec ----------
// We encode three lengths (cm) at 1 decimal precision, so we round to integer
// millimeters (mm = cm * 10). Range: 0..2000 mm = 0..200cm; well within 11 bits each.
// Pack three 11-bit values into a base32-ish string.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'; // 32-symbol, urlsafe

export function encodeRun({ lengths }) {
  const arr = (lengths || []).slice(0, 3);
  while (arr.length < 3) arr.push(0);
  const mm = arr.map(v => Math.max(0, Math.min(2047, Math.round(v * 10))));
  // Pack: 11 + 11 + 11 = 33 bits → 7 base-32 chars (35 bits, 2 spare)
  let bits = 0n;
  for (let i = 0; i < 3; i++) bits = (bits << 11n) | BigInt(mm[i]);
  // Pad to 35 bits
  bits = bits << 2n;
  let out = '';
  let n = bits;
  for (let i = 0; i < 7; i++) {
    out = ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return `g1${out}`;
}

export function decodeRun(frag) {
  const m = /^g1([a-z2-7]{7})$/.exec(String(frag || ''));
  if (!m) return null;
  const s = m[1];
  let n = 0n;
  for (let i = 0; i < s.length; i++) {
    const idx = ALPHABET.indexOf(s[i]);
    if (idx < 0) return null;
    n = (n << 5n) | BigInt(idx);
  }
  n >>= 2n; // drop the 2 padding bits
  const a = Number(n & 2047n); n >>= 11n;
  const b = Number(n & 2047n); n >>= 11n;
  const c = Number(n & 2047n);
  return { lengths: [c / 10, b / 10, a / 10] };
}

// ---------- verdict bank ----------
// Deterministic hash → archetype. Voice is mock-clinical / fake-dental, slightly
// roasting the *examiner* (the dentist), never the user (per the ceremony-app
// roast-placement rule). The user's longest stretch is the headline number;
// the archetype is shareable identity.

const ARCHETYPES = [
  // 16 entries — feels curated, not infinite
  { name: 'Aggressive Mastication Profile',
    line: 'Subject pulls with the conviction of someone who has unfinished business with a piece of taffy from 2014.',
    foot: 'recommended action: keep the gum away from family heirlooms.' },
  { name: 'Retentive Salivator',
    line: 'A meticulous tugger. Each pull approached as though the gum is being returned to its rightful shape.',
    foot: 'examiner notes: clings to gum, deadlines, and old grudges in equal measure.' },
  { name: 'Glassy Tongue Thinker',
    line: 'Pulls dispassionately. Watches the strand narrow with the calm of a person watching toast.',
    foot: 'no further action recommended; subject did not flinch at the snap.' },
  { name: 'Texturally Indecisive',
    line: 'Three pulls of three different opinions. The gum has spent more time deliberating than chewing.',
    foot: 'recommended texture: anything but ice.' },
  { name: 'Polite to a Fault',
    line: 'Subject seemed hesitant to apply force, as if the strand were a stranger on a train.',
    foot: 'consider extending pulls by approximately 8% in subsequent visits.' },
  { name: 'Compulsive Re-Anchorer',
    line: 'A serial restarter. Each pull abandoned the moment the strand exceeded conversational length.',
    foot: 'subject treats commitment the way most people treat parking meters.' },
  { name: 'Bovine Persistence Profile',
    line: 'Pulls slowly, consistently, and with the placid focus of an animal mid-cud. Effective.',
    foot: 'subject likely does not return phone calls.' },
  { name: 'Snap-Curious',
    line: 'Eager to find the breaking point. The dentist found a gleam in the subject\'s eye that warrants follow-up.',
    foot: 'next appointment recommended: in person, not over teleconference.' },
  { name: 'Theoretical Chewer',
    line: 'Strong opening intent; weak follow-through. The pulls had the shape of an essay outline.',
    foot: 'subject may benefit from concrete deadlines.' },
  { name: 'Adhesive Personality Type',
    line: 'A grippy, tenacious tugger. The gum had to be peeled from social obligations.',
    foot: 'examiner: "I felt this one in my jaw."' },
  { name: 'Filibuster Variant',
    line: 'Each pull carried on past the natural conclusion of the pull. Three pulls; one breath.',
    foot: 'time on examination chair: approximately 14% over standard.' },
  { name: 'Unserious Mastication Cluster',
    line: 'Pulls were brief, performative, and largely for the camera. The strand was not consulted.',
    foot: 'subject would absolutely chew gum at a wedding.' },
  { name: 'Ambient Drifter',
    line: 'The strand wandered more than it stretched. Subject\'s grip seemed to be elsewhere.',
    foot: 'no acute findings. subject is described as "watching a moth, possibly."' },
  { name: 'Catastrophist of the Jaw',
    line: 'Each pull treated the strand as a detonator. Loud, fast, and deeply suspicious of the dentist.',
    foot: 'recommended: resin guard, decaffeinated everything.' },
  { name: 'Quiet Stretcher',
    line: 'Three patient pulls. Not the longest, but the only pulls that did not look at us.',
    foot: 'subject\'s gum is the only one that thanked us on the way out.' },
  { name: 'Honorary Surface Tension',
    line: 'Pulls produced visible string-bridges before snap on multiple attempts — a mark of conviction.',
    foot: 'subject is hereby authorized to chew under pressure.' },
];

// Hash → seed → bucket
function hashLengths(lengths) {
  // Use mm-rounded ints so the verdict for the same recorded run is stable.
  const mm = lengths.map(v => Math.max(0, Math.round(v * 10)));
  let h = 2166136261;
  for (const v of mm) {
    h = (h ^ v) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function verdictFor(lengths) {
  if (!lengths || lengths.length < 3) {
    return ARCHETYPES[0];
  }
  const h = hashLengths(lengths);
  const idx = h % ARCHETYPES.length;
  const v = ARCHETYPES[idx];
  return { name: v.name, line: v.line, footer: v.foot };
}
