// content.js — the deck of 100 feelings, the 60-emoji palette, and the
// scoring + verdict tables for Synapse Sync.
//
// Mechanic: on each round, both players see the SAME feeling at the SAME time
// and independently compose a 4-emoji response from the 60-emoji palette.
// Score per round = number of shared emojis between the two compositions
// (set intersection, 0..4). 5 rounds → total 0..20.
//
// Design constraints:
//   - Each feeling must have at least 3 plausibly-mappable 4-emoji
//     compositions on this palette so independent agreement is possible
//     above chance (curated, not enforced mechanically).
//   - Order of emojis is irrelevant for scoring — only the set matters.

export const FEELINGS = [
  "the feeling of finding a 20 in last winter's coat",
  "the gap between the elevator stopping and the doors opening",
  "the silence after the microwave beeps but before you open it",
  "watching a streetlight turn on at exactly the moment you look up",
  "the panic of forgetting if you locked the front door",
  "the second sip of coffee that's somehow better than the first",
  "the moment a song you'd forgotten plays in a grocery store",
  "the weight of holding the door for someone slightly too far away",
  "watching a pigeon walk into a sandwich shop with confidence",
  "the suspicion that the self-checkout is judging your produce choices",
  "the relief of finally peeing after holding it for too long",
  "the quiet of a library at 4pm in early winter",
  "the dread of replying to an unread text from three days ago",
  "the small thrill of merging onto a highway perfectly",
  "the hush that falls when the popcorn finishes popping",
  "the moment you realize you've been petting a cat for an hour",
  "the deja vu of walking into a room and forgetting why",
  "the betrayal of biting into a cold fry",
  "the second of weightlessness as a swing reaches its peak",
  "watching a leaf fall in slow motion in front of a car windshield",
  "the satisfaction of peeling a sticker off in one piece",
  "the moment a song's bass drops in your headphones on the bus",
  "the strange dignity of an old dog at the vet",
  "the hum of a fridge in an empty kitchen at 2am",
  "the embarrassment of waving at a stranger you mistook for a friend",
  "the smug calm of being early to a meeting",
  "watching a coworker microwave fish in the break room",
  "the panic of your phone dying at 8% in a parking lot",
  "the warmth of a freshly laundered hoodie pulled from the dryer",
  "the disorientation of waking up from a 20-minute nap",
  "the soft horror of finding a sock in the freezer",
  "the relief of someone else laughing at your bad joke first",
  "the slow descent of an escalator that's stopped working",
  "the smell of a public library after rain",
  "the moment a thunderstorm becomes a car wash on the highway",
  "the peace of a fully-packed dishwasher running",
  "watching steam rise off a manhole cover at dawn",
  "the cold dread of the dentist saying we'll need to take a closer look",
  "the joy of catching a bus by exactly one second",
  "the quiet of a hotel hallway at 3am",
  "the betrayal of a hot tap that runs cold",
  "the strange pride of a perfectly aligned ponytail",
  "the dread of opening a banking app on a Sunday",
  "the satisfaction of a perfectly toasted bagel",
  "the embarrassment of singing along when your headphones disconnect",
  "the strange comfort of static on an old TV",
  "the relief of remembering you DID send the email",
  "watching a kid stare at an escalator for too long",
  "the quiet of fresh snow at 6am",
  "the panic of a group photo countdown",
  "the soft betrayal of running out of toilet paper at the worst time",
  "the satisfaction of a deeply parallel parallel park",
  "the cold dread of the printer making a noise you don't recognize",
  "the small joy of a green wave of traffic lights",
  "watching a candle relight after you blew it out",
  "the strange melancholy of an abandoned shopping cart in a field",
  "the satisfaction of cracking the seal on a fresh peanut butter jar",
  "the dread of a notification at 11:47pm from your boss",
  "the comfort of someone else driving while you stare out the window",
  "the moment a movie pauses for a buffering wheel during a kiss",
  "the embarrassment of pulling a push door three times",
  "the joy of a fresh pen that writes perfectly",
  "watching a bee bump into the same window for ten minutes",
  "the soft horror of a half-eaten apple left on a desk",
  "the strange grief of throwing away a really good pizza box",
  "the calm of a ceiling fan in a hot summer bedroom",
  "the dread of a shared screen with too many tabs open",
  "the satisfaction of a key turning in a stiff lock",
  "the quiet betrayal of an out-of-stock favorite snack",
  "the moment you realize the song has been on loop for 20 minutes",
  "the dread of a missed call from an unknown area code",
  "watching a balloon escape into a perfectly blue sky",
  "the relief of a spider being on the OTHER side of the window",
  "the satisfaction of finishing a roll of tape exactly evenly",
  "the cold dread of a low battery beep at 3am",
  "the strange tenderness of a stranger holding the elevator",
  "the panic of a smoke alarm chirp you can't locate",
  "the joy of finding a parking space directly in front",
  "the moment a clean kitchen looks too clean to use",
  "the soft horror of a forgotten leftovers container",
  "watching a flock of birds make a perfect S in the sky",
  "the dread of a friend saying we need to talk",
  "the satisfaction of a phone hitting 100%",
  "the embarrassment of laughing at a meme in a quiet meeting",
  "the moment a shower goes from too cold to perfect",
  "the relief of a hangnail finally coming off cleanly",
  "the strange grief of a song's outro fading too soon",
  "the panic of forgetting a coworker's name mid-sentence",
  "the comfort of a heavy book in a soft chair",
  "watching a moth realize the porch light is glass",
  "the satisfaction of a perfectly folded fitted sheet",
  "the dread of a doctor entering with two clipboards",
  "the joy of a passcode that worked on the first try",
  "the embarrassment of starting a slow clap that doesn't catch on",
  "the moment a candle smells exactly like your grandmother's car",
  "the relief of finishing a podcast right as you arrive",
  "the strange melancholy of leaving a hotel room cleaner than you found it",
  "watching the last leaf of autumn finally fall from a branch",
  "the dread of a calendar invite with no description",
  "the soft joy of a stranger's umbrella shielding you for one block",
  "the satisfaction of a chair height adjusting on the first pull",
  "the dread of an ATM noise pause that lasts a beat too long"
];

if (FEELINGS.length < 100) {
  console.error("FEELINGS deck below minimum 100 entries:", FEELINGS.length);
}

// PALETTES — eight 24-symbol themed palettes. Each prompt's palette is
// chosen by FEELING_THEMES[promptIndex] so the symbol kit changes with the
// question. The first eight emojis in EVERY palette are the same universal
// emotional register, so two players can always converge on a feeling
// regardless of theme; the remaining sixteen are theme-specific.
//
// Design constraint: each prompt must have at least 3 plausibly-mappable
// 4-emoji compositions on its theme's 24-emoji palette. The universals
// give partner-agnostic backup; the themed sixteen give specificity.

const UNIVERSAL = ["😀","😬","😭","🥹","🫠","✨","🚫","❓"];

// Theme indexes — keep names stable, FEELING_THEMES values reference these.
export const THEME_NAMES = [
  "kitchen_home",       // 0
  "weather_outdoor",    // 1
  "people_awkward",     // 2
  "night_quiet",        // 3
  "transit_motion",     // 4
  "bodily_sense",       // 5
  "tech_screens",       // 6
  "small_creatures",    // 7
];

// One palette per theme — universals always come first so the wire-format
// ordering and the visible grid order are stable across rounds.
export const THEMES = [
  // 0 · kitchen_home
  [...UNIVERSAL, "🍞","☕","🥛","🍳","🍕","🧊","🪑","🛏️","🛋️","🚪","🪟","💡","🧦","🧻","🪞","📦"],
  // 1 · weather_outdoor
  [...UNIVERSAL, "☀️","🌧️","❄️","🌫️","⚡","💧","🍂","🌳","🌬️","☁️","🌅","🌪️","🪨","🛤️","🌌","🪻"],
  // 2 · people_awkward
  [...UNIVERSAL, "👋","✋","🤝","🤐","🙃","🫥","🫨","💬","🫦","🫳","👀","🙏","🤔","💀","🥺","🫶"],
  // 3 · night_quiet
  [...UNIVERSAL, "🌙","⭐","🛏️","🕯️","🔇","🔕","🔦","🌌","💤","🦉","🌃","⏰","🪟","📚","🛋️","🌠"],
  // 4 · transit_motion
  [...UNIVERSAL, "🚪","🛗","🛣️","🚦","🚌","🚗","🚲","➡️","⬇️","🔁","🌀","🏃","🚏","🚋","🛤️","🛹"],
  // 5 · bodily_sense
  [...UNIVERSAL, "🥶","🥵","💧","🩹","👁️","👂","🦶","🤲","🧠","💪","💤","🫧","🦷","🤕","💖","🥱"],
  // 6 · tech_screens
  [...UNIVERSAL, "📱","💻","🔋","🔌","💬","📅","📧","🔔","🛜","🎧","💾","🖥️","📞","🔁","📺","📡"],
  // 7 · small_creatures
  [...UNIVERSAL, "🐈","🐦","🐝","🦗","🐌","🐜","🐛","🦋","🪲","🦟","🐀","🦝","🐞","🐭","🦔","🐩"],
];

for (let t = 0; t < THEMES.length; t++) {
  if (THEMES[t].length !== 24) {
    console.error(`THEMES[${t}] (${THEME_NAMES[t]}) is not 24 emojis:`, THEMES[t].length);
  }
}

// FEELING_THEMES — parallel to FEELINGS, one theme index per feeling so the
// palette tracks the question. Generated by hand-tagging each prompt to the
// closest theme; uncategorisable prompts default to 0 (kitchen_home).
export const FEELING_THEMES = [
  0,4,0,3,0,0,0,2,7,6, // 0..9
  5,3,6,4,0,7,5,5,5,1, // 10..19
  5,6,7,3,2,2,0,6,0,5, // 20..29
  0,2,4,1,1,0,1,5,4,3, // 30..39
  5,5,6,0,6,6,6,4,1,2, // 40..49
  0,4,6,4,0,1,0,6,4,6, // 50..59
  2,0,7,0,0,3,6,0,0,6, // 60..69
  6,1,7,0,6,2,0,4,0,0, // 70..79
  7,2,6,2,5,5,6,2,3,7, // 80..89
  0,5,6,2,5,6,3,1,6,1, // 90..99
  0,6,                 // 100..101
];

if (FEELING_THEMES.length !== FEELINGS.length) {
  console.error(
    `FEELING_THEMES length (${FEELING_THEMES.length}) does not match FEELINGS (${FEELINGS.length})`
  );
}

// Default to theme 0 if the index is somehow out of range or untagged. Both
// clients run this identically given the same promptIndex, so the per-prompt
// palette is shared without any extra wire chatter.
export function getPaletteForPrompt(promptIndex) {
  const t = FEELING_THEMES[promptIndex];
  if (typeof t !== "number" || t < 0 || t >= THEMES.length) return THEMES[0];
  return THEMES[t];
}

export function getThemeName(promptIndex) {
  const t = FEELING_THEMES[promptIndex];
  if (typeof t !== "number" || t < 0 || t >= THEME_NAMES.length) return THEME_NAMES[0];
  return THEME_NAMES[t];
}

// Deterministic per-room round seed: hash of (roomCode, round).
function roundSeed(roomCode, round, salt = 0) {
  let h = 2166136261 >>> 0;
  const s = `${roomCode}:${round}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Pick the prompt feeling for a given round (deterministic per room).
// Both clients run identical logic so they see the SAME prompt at the SAME
// time — the entire mechanic depends on this.
export function pickPrompt(roomCode, round) {
  const s = roundSeed(roomCode, round, 0xfeedface);
  return s % FEELINGS.length;
}

// Score = number of shared emojis between two 4-emoji compositions.
// Order is irrelevant; only set membership matters. Range 0..4.
// Accepts Array<string> (local state) or joined string (from network).
// `palette` is the symbol kit for the round; needed to tokenise the peer's
// flat-string composition since multi-codepoint graphemes can't be split
// on JS string indexing.
export function overlapScore(aComp, bComp, palette) {
  const aSet = compositionToSet(aComp, palette);
  const bSet = compositionToSet(bComp, palette);
  let matches = 0;
  for (const e of aSet) if (bSet.has(e)) matches++;
  return matches;
}

// Reconstruct an emoji set from either an Array<string> or a flat joined
// string. We match against the round's palette entries so multi-codepoint
// graphemes (😵‍💫, 👁️, etc.) are not split on JS string indexing.
export function compositionToSet(comp, palette) {
  if (Array.isArray(comp)) return new Set(comp);
  if (typeof comp !== "string") return new Set();
  const symbols = palette || THEMES[0];
  const sorted = [...symbols].sort((a, b) => b.length - a.length);
  const out = new Set();
  let i = 0;
  while (i < comp.length) {
    let matched = null;
    for (const sym of sorted) {
      if (comp.startsWith(sym, i)) { matched = sym; break; }
    }
    if (matched) {
      out.add(matched);
      i += matched.length;
    } else {
      i++;
    }
  }
  return out;
}

// Bureau verdict bands — keyed by percentile. Bureau-of-Synaptic-Concordance copy.
export const VERDICTS = [
  { min: 95, name: "A FUSED-CORTEX OPERATIONAL UNIT",
    blurb: "Filed under: Section 14(a). Recommended for classified concordance work and ambient lighthouse keeping. Considered a state-level asset.",
    stamp: "TIER I" },
  { min: 80, name: "A FUNCTIONALLY-LINKED LOBE PAIR",
    blurb: "Filed under: Section 12(b). Recommended for emergency séance work and assembling IKEA furniture without speaking.",
    stamp: "TIER II" },
  { min: 60, name: "A SATISFACTORY SYNAPTIC CONCORDANCE",
    blurb: "Filed under: Section 9(c). Cleared for non-classified telepathy and choosing where to eat without an argument.",
    stamp: "TIER III" },
  { min: 40, name: "A WORKING-CLASS CONVERGENCE UNIT",
    blurb: "Filed under: Section 7(d). Approved for joint grocery shopping and the splitting of bills on the second attempt.",
    stamp: "TIER IV" },
  { min: 20, name: "A LOOSELY ENTANGLED PAIR",
    blurb: "Filed under: Section 5(e). Cleared for parallel hobbies and texts that almost cross paths in the night.",
    stamp: "TIER V" },
  { min: 0,  name: "TWO DISTINCT CONSCIOUSNESSES",
    blurb: "Filed under: Section 2(f). Recommended for separate brunches and writing each other very long letters.",
    stamp: "TIER VI" }
];

export function verdictForPercentile(pct) {
  for (const v of VERDICTS) {
    if (pct >= v.min) return v;
  }
  return VERDICTS[VERDICTS.length - 1];
}
