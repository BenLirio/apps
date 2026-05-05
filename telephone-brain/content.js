// content.js — the deck of 100 feelings and the 60-emoji palette.
//
// Design constraints (from the pitch's risk callout):
//   - Each feeling must have at least 3 plausibly-mappable 4-emoji compositions
//     on this palette so the encoding has signal. We don't enforce that
//     mechanically — we curate the deck and palette so it's true in practice.
//   - The 8-tile multiple-choice for the receiver is sampled from the deck;
//     the truth is always one of the 8. Shuffled per round.
//
// FEELINGS — handcurated absurdly-specific feelings. The Bureau of Synapse
// Telegraphy refers to these as "subjective frequencies".

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

if (FEELINGS.length !== 100) {
  console.error("FEELINGS deck is not 100 entries:", FEELINGS.length);
}

// PALETTE — 60 emojis spanning emotional registers, motion, objects, weather,
// fauna, household. Curated so each feeling has at least 3 plausible 4-emoji
// compositions. Indexed 0..59.
export const PALETTE = [
  // emotion / face (10)
  "😀","😶","😬","😭","😱","😴","🥹","🤐","😵‍💫","🫠",
  // body / gesture (6)
  "👁️","👋","✋","🫳","🦶","🧠",
  // weather / time (8)
  "☀️","🌧️","❄️","🌫️","🌙","⏰","⏳","💧",
  // motion / energy (6)
  "⚡","🌀","💥","🔁","➡️","⬇️",
  // sound / signal (4)
  "🔔","🔕","📣","🔇",
  // objects / household (10)
  "🚪","🛒","☕","🍞","🍕","📦","🪑","🛏️","🧦","🧻",
  // fauna / nature (6)
  "🐈","🐦","🐝","🍂","🌳","🦗",
  // place / direction (4)
  "🛗","🛣️","🪟","🔦",
  // quality / verdict (6)
  "✨","🩹","🤝","🚫","✅","❓"
];

if (PALETTE.length !== 60) {
  console.error("PALETTE is not 60 emojis:", PALETTE.length);
}

// Deterministic shuffle (same seed → same order). Used to shuffle the
// 8-tile multiple-choice consistently across both clients in a round.
export function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick the round's feeling tile and 7 distractors from the deck.
// `seed` is the room-code+round hash; both clients run identical logic so the
// 8-tile choice set is identical on both phones (the receiver gets the same
// shuffle as the sender).
export function pickRoundTiles(seed, truthIndex) {
  // Pick 7 distractors that are not the truth.
  const indices = [];
  let s = seed >>> 0;
  while (indices.length < 7) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const idx = s % FEELINGS.length;
    if (idx !== truthIndex && !indices.includes(idx)) {
      indices.push(idx);
    }
  }
  // Insert truth, then deterministic shuffle.
  const eight = [truthIndex, ...indices];
  return seededShuffle(eight, seed ^ 0xa5a5a5a5);
}

// Deterministic per-room round seed: hash of (roomCode, round, role)
export function roundSeed(roomCode, round, salt = 0) {
  let h = 2166136261 >>> 0;
  const s = `${roomCode}:${round}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Pick the truth tile for a given round (deterministic per room).
export function pickTruth(roomCode, round) {
  const s = roundSeed(roomCode, round, 0xfeedface);
  return s % FEELINGS.length;
}

// Bureau verdict bands — keyed by percentile. Bureau-style copy.
// Each band is { name, blurb, stamp }.
export const VERDICTS = [
  { min: 95, name: "A FUSED-CORTEX OPERATIONAL UNIT",
    blurb: "Filed under: Section 14(a). Recommended for classified telegraphic work and ambient lighthouse keeping. Considered a state-level asset.",
    stamp: "TIER I" },
  { min: 80, name: "A FUNCTIONALLY-LINKED LOBE PAIR",
    blurb: "Filed under: Section 12(b). Recommended for emergency séance work and assembling IKEA furniture without speaking.",
    stamp: "TIER II" },
  { min: 60, name: "A SATISFACTORY SYNAPTIC CORRESPONDENCE",
    blurb: "Filed under: Section 9(c). Cleared for non-classified telepathy and choosing where to eat without an argument.",
    stamp: "TIER III" },
  { min: 40, name: "A WORKING-CLASS COMMUNICATION UNIT",
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
