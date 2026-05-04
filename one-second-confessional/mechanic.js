// pure logic. no DOM. owns the bin math, the 200-line confession bank,
// the per-day rotation, and the share-fragment encode/decode.

const RANGE_LO = 500;   // ms — below this is "you broke the contract" (under)
const RANGE_HI = 1500;  // ms — above this is "you broke the contract" (over)
const BIN_SIZE = 5;     // ms per bin → 200 bins across the usable window

// broader tier slugs by absolute duration. these are the named identity that
// rides on the share artifact; the bin range underneath is the verifiable seam.
const TIERS = [
  { lo: 500,  hi: 700,  name: 'the early-releasers' },
  { lo: 700,  hi: 850,  name: 'the impatients' },
  { lo: 850,  hi: 950,  name: 'the close calls' },
  { lo: 950,  hi: 1050, name: 'the contenders' },
  { lo: 1050, hi: 1150, name: 'the overshooters' },
  { lo: 1150, hi: 1300, name: 'the patient' },
  { lo: 1300, hi: 1500, name: 'the dawdlers' },
];

const OUT_UNDER = {
  tier: 'the contract-breakers',
  confession: 'you released too fast. the button registered nothing of substance and has filed a note in your name.',
};
const OUT_OVER = {
  tier: 'the contract-breakers',
  confession: 'you held longer than the contract called for. the button has decided to overlook it this once, but the count holds.',
};

// 200 hand-written single-sentence confessions. tone: flattering or
// cursed-but-never-shaming. voice: declarative things the BUTTON issues, not
// psychic interpretations. read each one back as if it were about your favorite
// hobby — every line should be one you'd want in your name.
const BANK = [
  "you've never finished a Murakami novel but you keep starting them",
  "you tip badly on coffee and well on dinner and someone has noticed",
  "the photograph you keep meaning to print stays digital",
  "you reread the same six tabs at 2am",
  "your fridge is mostly things you bought once with intent",
  "you have at least three half-burned candles you cannot bring yourself to throw out",
  "you have a song you only listen to alone",
  "you have watched the same five minutes of a comfort show roughly 200 times this year",
  "you have an unwritten apology to a barista you'll never see again",
  "you keep a screenshot of a text you never sent",
  "you have a friend you owe a phone call to and you are aware",
  "you bought the expensive pen and you do not use it",
  "you understand the herb but not the dose",
  "your reading list is longer than most people's reading lifespans",
  "you have a tab open from february you will not close",
  "you have cried at exactly two commercials and you remember both",
  "the journal entry from last week is one sentence and the sentence is not about you",
  "you keep ticket stubs from things you did not enjoy",
  "you have a recipe memorized for a meal you've cooked three times",
  "you are saving a really good book to start on a really good day",
  "you have a shower playlist older than your current haircut",
  "you have bookmarked an apartment listing you will never tour",
  "you are wearing a shirt you almost gave away",
  "you have a piece of furniture from a relationship that ended",
  "you say you don't have a type and have a type",
  "you have a song that requires an empty kitchen",
  "you have redownloaded the same app three times this year",
  "you turn the lamp on before the sun is fully down",
  "you remember other people's birthdays better than your own",
  "you have a perfume you only wear in fall",
  "you walk a longer way home from one specific direction",
  "you have made the same decision in a slightly different costume",
  "you keep a lighter and don't smoke",
  "you bought a plant for a windowsill that doesn't get sun",
  "you have an opinion about the silver paint they use on sidewalks",
  "you have a ringtone you will not change because you cannot remember the password",
  "you screenshot recipes and never make them",
  "you have been to a bookstore three times this month and bought nothing",
  "you remember exactly which sunday you stopped going to that one cafe",
  "you have an unsent voice memo to someone who asked how you were",
  "you have memorized one good poem and recite it only in the shower",
  "you keep a sweater that smells like a place you don't live anymore",
  "you have left exactly one good review and it was for a dentist",
  "you have a draft saved called thoughts",
  "you have apologized to a chair",
  "you have a notebook for ideas and a folder for ideas and you do not consult either",
  "you have practiced one anecdote into the ground",
  "you save the good chocolates for a future you that hasn't earned them",
  "you have held a stranger's umbrella and given it back differently",
  "you have a stretch of road you only listen to one specific album on",
  "you let yourself cry at songs you don't even like",
  "you have a friend in your phone listed as their first nickname",
  "you keep a lipstick you never wear because the color is right twice a year",
  "you have named the spider",
  "you read horoscopes for the people you used to date",
  "you have worn the same socks two days in a row knowingly",
  "you keep the receipts but never check them",
  "you have a candle saved for an occasion that never happens",
  "you read the last page first",
  "you have forgiven faster than you have forgotten",
  "you have kept a flower until it was dust",
  "your favorite mug is chipped and you will not replace it",
  "you have a folder of photos you cannot post and won't delete",
  "you say i will just have water and mean it as a personality",
  "you press the elevator button twice",
  "you have been on hold long enough to lose the thread",
  "you have fallen asleep on a couch you don't own",
  "you have kissed someone's forehead and stood up too fast after",
  "you have a candle that smells like an ex",
  "you have thrown out a voicemail without listening",
  "you have eaten cereal standing up at midnight while feeling fine",
  "you have cried in a museum bathroom",
  "you keep a postcard nobody sent you",
  "you have talked yourself into and out of the same haircut three times",
  "you have kept a houseplant alive longer than you have kept a habit",
  "you have watched the kettle on purpose",
  "you have worn a coat you didn't need because of the pockets",
  "you ration your favorite show into one episode a week",
  "you have memorized a phone number for a person who has changed phones",
  "you have kept exactly one stuffed animal past it being acceptable",
  "you have given directions to a place you have never been",
  "you have held a smile through a small disaster",
  "your chargers are tied with a hair tie",
  "you tilt your head when you're listening hard",
  "you have bookmarked the same article on three devices and not read it once",
  "you have been the friend who closes the bar",
  "you have been the friend who left first and made up an early morning",
  "you have considered moving to four cities and moved to none",
  "you keep a pebble from a beach in a drawer",
  "you have kept the wrapping paper",
  "you have cried in a Trader Joe's",
  "you have bought a vegetable on principle",
  "you bought the bigger size and don't wear belts",
  "you have finished a book on the train and felt embarrassed about it",
  "you have eaten dessert before dinner alone and called it a tuesday",
  "you have held a grudge longer than the relationship that caused it",
  "you have forgiven yourself for less than you have forgiven everyone else for",
  "you keep a list of music for a long drive that never happens",
  "you call your mother only after you have been unhappy for three days",
  "you have had the same screen saver since something good happened",
  "you have made the joke that worked once and waited too long to make it again",
  "you have left a movie at the right time but lied about why",
  "you re-fold the same shirt",
  "you have held a position no one asked you to hold",
  "you have watered a plant that was already gone",
  "you have gone home early and not been missed and noticed",
  "you have waited at a crosswalk that didn't need waiting at",
  "you are a different person at the dentist",
  "you have made eye contact with a stranger and felt seen for sport",
  "you have held a thought through a whole meeting and then forgotten it",
  "you have kept a small thing safe for a person who wouldn't ask",
  "you understand the song now in a way you didn't and you wish you didn't",
  "you have a habit you don't tell your therapist about",
  "you have sent the message twice on different days and it counted as twice",
  "you have waited for a sign that came right on time and you ignored it",
  "you have cried at a bagel",
  "you have had the same dream since elementary school about a hallway",
  "you have kept a friendship alive through one annual text",
  "you have held a hand in the dark in a movie that wasn't even good",
  "you have a draft response to a fight you'll never finish",
  "you keep extras of the toothpaste you don't use yet",
  "you have sat in a parking lot longer than the errand",
  "your coffee order has changed twice in your life and you remember when",
  "you have kept a draft email open for a weekend",
  "you have held a grudge against a fictional character",
  "you have liked a post six months late on purpose",
  "you have added a thing to a cart for a year",
  "you have memorized an exit you no longer use",
  "you have kept a draft of one good text",
  "you keep the playlist from a road trip you haven't fully come back from",
  "you have walked into the same room three times for nothing",
  "you have cried at the dog in a commercial that wasn't even sad",
  "you have worn a perfume to feel like a person you used to be",
  "you keep a photo of a tree you cannot remember why you took",
  "you have practiced the smile in the mirror once and used it for a decade",
  "you have held a baby and felt unprepared in a tender way",
  "you have cooked exactly one meal you cannot repeat",
  "you have kept a takeout menu from a place that closed",
  "you have passed the bookstore twice without going in and counted it as restraint",
  "you have kept a candle wrapper because the color was nice",
  "you have remembered an exact lighting situation from years ago",
  "you have named your good pen",
  "you keep the windows cracked through one specific kind of weather",
  "you have finished a movie out of stubbornness",
  "you have made a soup you didn't enjoy and froze it anyway",
  "you have moved a small picture closer to the lamp",
  "you carry the small key you cannot identify",
  "you have written a postcard you didn't send",
  "you have kept a number you never use because of the area code",
  "you have fallen asleep in the daytime without meaning to",
  "you have kept the same coffee mug rotation for nine months",
  "you have taken the long way past the same window",
  "you have tasted something cold and remembered the year exactly",
  "you keep a drawer of things that go nowhere",
  "you have started the same sentence three times in a journal",
  "you have kept the bag the gift came in",
  "you have held a door open for nobody for a moment too long",
  "you have mistaken a stranger for an old friend and felt the loss anyway",
  "you have kept a candle for the smell of a season",
  "you have waited for a phone call no one promised",
  "you have kept a movie ticket because of the typeface",
  "you have turned down a song while alone in your own car",
  "you have eaten a meal too fast and pretended you hadn't",
  "you have practiced the greeting and then said hi",
  "you have kept a notebook for a class that ended",
  "you have kept the shoes you wore to a hard week",
  "you have hugged someone slightly longer than the social contract suggested",
  "you have kept the receipt for the gift after the person stopped speaking to you",
  "you have kept a piece of paper because you liked the handwriting",
  "you have kept a coat for a city you don't live in",
  "you have turned the volume down to taste your food",
  "you have waited for the song to end before getting out of the car",
  "you have kept the takeout container to use once and forever",
  "you have been five minutes early and circled the block twice",
  "you have kept the dust on a thing because moving it felt premature",
  "you have smiled at a baby on the train and almost cried",
  "you have gone to the grocery store for one thing and forgotten it",
  "you have finished the last sip of someone's drink at the table without asking",
  "you have kept a coin from a country you'll never go back to",
  "you have taken the back stairs because of a feeling",
  "you keep a backup phone charger for someone you know is bad with theirs",
  "you have remembered the way a kitchen smelled in the year of a thing",
  "you have kept the soundtrack of a movie that wasn't very good",
  "you have closed an envelope and reopened it",
  "you keep the gift card that has $1.83 left",
  "you have held two opinions at once and slept fine",
  "you have thanked a vending machine",
  "you have kept a fortune from a cookie you didn't believe in",
  "you have held a thought through a doorway and lost it on the threshold",
  "you have sung along to a song in a language you don't speak",
  "you have finished a coffee shop drink because you ordered it",
  "you have kept a phone number on a napkin that didn't survive the wash",
  "you have taken a photo of a sky you couldn't even describe",
  "you have waited until everyone was asleep to feel like yourself",
  "you have practiced a polite refusal once and never used it",
  "you have held back a compliment that would have changed someone's day",
  "you keep a thing in a drawer because you might want it during a power outage",
  "you have kept a song for an apology that never landed",
  "you have watched yourself become a person you might like",
  "you have held the button for one second and the button has held you back",
];

if (BANK.length !== 200) {
  console.warn(`[1sc] confession bank has ${BANK.length} entries; expected 200.`);
}

// derive a daily integer offset from a YYYYMMDD integer. used to rotate the
// bin → confession mapping so today's draw differs from yesterday's, while a
// shared link replays the same date and therefore the same three confessions.
export function dayShiftFromDateInt(dateInt) {
  const y = Math.floor(dateInt / 10000);
  const m = Math.floor((dateInt / 100) % 100);
  const d = dateInt % 100;
  return ((y * 372) + (m * 31) + d) >>> 0;
}

export function todayDateInt() {
  const now = new Date();
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

export function dateLabelFromDateInt(dateInt) {
  const y = Math.floor(dateInt / 10000);
  const m = Math.floor((dateInt / 100) % 100);
  const d = dateInt % 100;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return `${months[m - 1]} ${d} ${y}`;
}

function tierFor(durationMs) {
  for (const t of TIERS) {
    if (durationMs >= t.lo && durationMs < t.hi) return t.name;
  }
  return null;
}

function fmtSec(durationMs) {
  return (durationMs / 1000).toFixed(3) + 's';
}

function fmtBinRange(loMs, hiMs) {
  return `${(loMs / 1000).toFixed(3)}–${(hiMs / 1000).toFixed(3)}s`;
}

// the central deterministic function. give it a duration in ms and a date
// integer, get back everything the result screen needs to render. swap the
// dateInt to replay a shared session.
export function computeResult(durationMs, dateInt) {
  durationMs = Math.max(0, Math.round(durationMs));
  if (durationMs < RANGE_LO) {
    return {
      durationMs,
      durationStr: fmtSec(durationMs),
      binRangeStr: 'outside the contract',
      tier: OUT_UNDER.tier,
      confession: OUT_UNDER.confession,
      isOutOfRange: true,
    };
  }
  if (durationMs >= RANGE_HI) {
    return {
      durationMs,
      durationStr: fmtSec(durationMs),
      binRangeStr: 'outside the contract',
      tier: OUT_OVER.tier,
      confession: OUT_OVER.confession,
      isOutOfRange: true,
    };
  }
  const binIdx = Math.floor((durationMs - RANGE_LO) / BIN_SIZE);
  const binLo = RANGE_LO + binIdx * BIN_SIZE;
  const binHi = binLo + BIN_SIZE;
  const shift = dayShiftFromDateInt(dateInt);
  const confession = BANK[(binIdx + shift) % BANK.length];
  return {
    durationMs,
    durationStr: fmtSec(durationMs),
    binRangeStr: fmtBinRange(binLo, binHi),
    tier: tierFor(durationMs) || 'the unclassified',
    confession,
    isOutOfRange: false,
  };
}

// share-fragment shape: `h=847,1123,612&d=20260504`. SMS-safe (~30 chars).
export function encodeShare(durationsMs, dateInt) {
  const safe = durationsMs.map(d => Math.max(0, Math.min(9999, Math.round(d))));
  return `h=${safe.join(',')}&d=${dateInt}`;
}

export function decodeShare(fragmentRaw) {
  if (!fragmentRaw) return null;
  const fragment = fragmentRaw.replace(/^#/, '');
  const params = new URLSearchParams(fragment);
  const hStr = params.get('h');
  const dStr = params.get('d');
  if (!hStr || !dStr) return null;
  const durationsMs = hStr.split(',').map(Number);
  if (durationsMs.length !== 3 || durationsMs.some(n => isNaN(n))) return null;
  const dateInt = Number(dStr);
  if (isNaN(dateInt) || dateInt < 20000101 || dateInt > 99991231) return null;
  return { durationsMs, dateInt };
}
