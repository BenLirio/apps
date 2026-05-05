// mechanic.js — deterministic per-minute decree generator.
//
// Inputs: (weekday 0..6, hour 0..23, minute 0..59).
// Output: one sentence in the cursed-mundane Petty-Small-Claims voice that
// reads as if hand-written for that specific minute. Same minute on the same
// weekday always produces the same line — that's the whole game.
//
// The pool isn't a flat 10,080 lines (which would be neither hand-written nor
// distinguishable). It's three deterministically-combined banks:
//
//   - VOICE_FRAMES: bureaucratic openers ("the minute where", "section 4-...
//     observed that") that pin the register and reference the time/weekday.
//   - SUBJECTS: who/what is observed — petty, domestic, hyper-specific.
//   - DETAILS: what they were doing — the cursed-mundane concrete anchor
//     (microwave at 0:01 for thirty seconds, the kind of thing that lands).
//
// Bank sizes intentionally chosen so the (weekday × hour × minute) cartesian
// product picks a unique combination for each of the 10,080 minutes of the
// working week — no two minutes share the exact same SUBJECT × DETAIL pair.

// --------------------------------------------------------------- hashing

// Deterministic non-cryptographic hash — same input always returns same int.
export function hash(...parts) {
  let h = 0x811c9dc5; // FNV offset
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return Math.abs(h);
}

// --------------------------------------------------------------- banks

// Each frame contains {WEEKDAY}, {TIME}, or {HOUR_TONE} placeholders so the
// time itself shows up in the prose, not just on the stamp above. The bureau
// "anchors" the line to the minute by quoting it.
const VOICE_FRAMES = [
  "{WEEKDAY} {TIME} — the minute where {SUBJECT} {DETAIL}.",
  "Section 4-{WEEKDAY_SHORT} hereby files {TIME} as the minute {SUBJECT} {DETAIL}.",
  "On the docket for {TIME}: {SUBJECT} {DETAIL}.",
  "Bureau notes for {WEEKDAY} {TIME}: {SUBJECT} {DETAIL}.",
  "It being {TIME} on a {WEEKDAY}, {SUBJECT} {DETAIL}.",
  "The Office of the Current Minute classifies {TIME} as the kind of minute where {SUBJECT} {DETAIL}.",
  "Filed under '{WEEKDAY}': at {TIME}, {SUBJECT} {DETAIL}.",
  "Per Section 4 paragraph (b), {TIME} on a {WEEKDAY} is the minute {SUBJECT} {DETAIL}.",
  "Affidavit of the Current Minute, sworn at {TIME}: {SUBJECT} {DETAIL}.",
  "Witness for {WEEKDAY} {TIME} reports {SUBJECT} {DETAIL}.",
  "Be it known that at {TIME} on this {WEEKDAY}, {SUBJECT} {DETAIL}.",
  "{TIME} {WEEKDAY} — entered into the minute log: {SUBJECT} {DETAIL}.",
  "{HOUR_TONE} of a {WEEKDAY} — by {TIME} on the wall, {SUBJECT} {DETAIL}.",
  "Bureau record for {TIME}: in some apartment within the jurisdiction, {SUBJECT} {DETAIL}.",
  "The {WEEKDAY} {TIME} bulletin: {SUBJECT} {DETAIL}, and the bureau has noted it.",
];

// Subjects — who/what the bureau has observed. Petty, domestic, specific.
// Avoids "you" / "they" except where needed; prefers a concrete third-party
// noun phrase so the line reads as a filed observation, not a horoscope.
const SUBJECTS = [
  "someone's microwave",
  "the upstairs neighbor",
  "a single open browser tab",
  "the second-most-used coffee mug",
  "an unanswered group chat",
  "the cat that lives on the back of the couch",
  "someone's left AirPod",
  "the tupperware lid that doesn't match anything",
  "the small printer in the hallway",
  "a roomba that has stopped moving",
  "the third drawer down",
  "a refrigerator door that wasn't fully closed",
  "the sock that everyone in the house disowns",
  "an iPhone face-down on the counter",
  "the toaster oven",
  "a half-open window",
  "the teakettle that whistled twice and gave up",
  "a single grocery bag in the entryway",
  "the calendar magnet that says 2023",
  "a houseplant the resident has stopped speaking to",
  "the space heater under the desk",
  "an overhead light that nobody wanted on",
  "the dishwasher",
  "a parking app holding the user's payment hostage",
  "the back of a CVS receipt",
  "a single elevator button",
  "the office mini-fridge",
  "a stapler that is, strictly speaking, on someone else's desk",
  "the conference-room speakerphone",
  "a paper coffee cup with the lid pressed back on",
  "someone's open laptop fan",
  "the WiFi router behind the TV",
  "a notebook with one page used",
  "the hood vent above the stove",
  "a Blinker on a parked car",
  "the elevator on the second floor",
  "a Walgreens receipt as long as a forearm",
  "the corner of a rug",
  "a houseguest's car, idling",
  "the screen door that doesn't quite close",
  "the bathroom fan",
  "a Keurig with the lid open",
  "an unfinished crossword on the kitchen table",
  "the porch light",
  "the upstairs television, watching itself",
  "a pair of shoes left in the doorway",
  "an iPad in a kitchen-counter stand",
  "a charging cable plugged into nothing",
  "the dryer with one shoe in it",
  "the smoke detector",
  "a candle the resident forgot was lit",
  "an Alexa in standby",
  "the Roomba dock, alone",
  "the dog water bowl",
  "the Wednesday recycling bin",
  "a thermostat set to 71",
  "the Brita pitcher",
  "an open jar of peanut butter",
  "the cabinet door above the microwave",
];

// Details — what the subject is/was doing. Cursed-mundane and concrete.
// Each detail is a tiny observed scene; specificity does the work.
const DETAILS = [
  "has been at 0:01 for thirty seconds",
  "is running the same fan it has been running since Tuesday",
  "displays a notification nobody intends to read",
  "holds the last quarter-inch of room-temperature coffee",
  "contains 47 unread messages and one ellipsis",
  "is asleep, despite the chaos",
  "is missing, presumed under the couch",
  "lives among other lids that also fit nothing",
  "prints two test pages every time the heat comes on",
  "has chosen this exact spot to retire",
  "contains a battery, two pens, and a 2017 receipt",
  "is open by exactly the width of a credit card",
  "has been adopted into the laundry pile against its will",
  "is on do-not-disturb and lying about it",
  "is preheating to 350 with no plan",
  "is open by an inch and the resident has decided that's the temperature now",
  "considers its contractual obligations fulfilled",
  "contains seventeen dollars of items the resident already owns",
  "still says it's January 2023",
  "has not been watered since the inauguration",
  "draws 1500 watts to heat a five-square-foot zone",
  "lights an empty hallway",
  "is mid-cycle and someone is going to forget it",
  "is processing a one-cent authorization charge",
  "shows three coupons the resident will never use",
  "is mysteriously lit",
  "contains a Seltzer, a single Babybel, and four condiments",
  "has started to feel like home, structurally",
  "is muted, but the meeting is also muted",
  "is empty but warm",
  "is pulling a respectable 9 watts to do nothing",
  "contains the WiFi network 'Pretty Fly for a WiFi'",
  "is inscribed with the words 'TUESDAY: ?'",
  "is venting a smell that is not quite identifiable",
  "blinks at three-second intervals for no party",
  "remains stuck between floors of intent",
  "details an $82 transaction involving toothpaste",
  "is curled up in protest",
  "is two minutes from leaving but loud about it",
  "is permitting the outside temperature to negotiate",
  "is venting a forgotten shower",
  "is open and dripping, and no pod has been inserted",
  "is on 14-Across and refuses help",
  "is the only thing on, in any house on the block",
  "is two episodes deep into something nobody picked",
  "is at exactly the angle to be tripped on later",
  "is showing weather for a city the resident does not live in",
  "is delivering current to ambient air",
  "is tumbling a single sneaker, rhythmically",
  "is detecting nothing, loudly",
  "is providing ambient cinnamon to an empty room",
  "is awaiting a wake word that will never come",
  "is humming and unbeloved",
  "contains a single ice cube and the resident's resentment",
  "is overflowing with cardboard the resident broke down with their own two hands",
  "is set two degrees off, to spite somebody",
  "has not been refilled since the last visitor",
  "has its lid up and a knife in it",
  "shuts halfway and gives up",
];

// Hour tone — coarse mood label that prefixes the time of day.
// Used by the {HOUR_TONE} frame variant. Maps each hour to a phrase that
// reads as a Bureau internal classification.
const HOUR_TONES = {
   0: "First hour of the watch",        1: "Small hours",
   2: "Small hours",                    3: "Small hours",
   4: "Pre-dawn jurisdiction",          5: "Pre-dawn jurisdiction",
   6: "Early shift",                    7: "Early shift",
   8: "Opening hours",                  9: "Opening hours",
  10: "Mid-morning docket",            11: "Pre-noon docket",
  12: "Noon recess",                   13: "Afternoon session",
  14: "Afternoon session",             15: "Mid-afternoon",
  16: "Late afternoon",                17: "End-of-business hour",
  18: "Twilight session",              19: "Evening calendar",
  20: "Evening calendar",              21: "Late docket",
  22: "Late docket",                   23: "Last hour of business",
};

const WEEKDAY_FULL = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const WEEKDAY_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// --------------------------------------------------------------- API

// formatTime: 24h hour + minute -> "3:47 PM"
export function formatTime(hour, minute) {
  const h12 = ((hour + 11) % 12) + 1;
  const mm = String(minute).padStart(2, '0');
  const meridiem = hour < 12 ? 'AM' : 'PM';
  return { display: `${h12}:${mm}`, meridiem, full: `${h12}:${mm} ${meridiem}` };
}

// generateDecree: deterministic per-(weekday, hour, minute) one-line decree.
export function generateDecree(weekday, hour, minute) {
  // Use distinct hash seeds for each bank so frames/subjects/details vary
  // independently across adjacent minutes.
  const fIdx = hash('frame', weekday, hour, minute) % VOICE_FRAMES.length;
  const sIdx = hash('subject', weekday, hour, minute) % SUBJECTS.length;
  const dIdx = hash('detail',  weekday, hour, minute) % DETAILS.length;

  const time = formatTime(hour, minute);

  return VOICE_FRAMES[fIdx]
    .replace('{WEEKDAY}',       WEEKDAY_FULL[weekday])
    .replace('{WEEKDAY_SHORT}', WEEKDAY_SHORT[weekday])
    .replace('{TIME}',          time.full)
    .replace('{HOUR_TONE}',     HOUR_TONES[hour])
    .replace('{SUBJECT}',       SUBJECTS[sIdx])
    .replace('{DETAIL}',        DETAILS[dIdx]);
}

// Serial — deterministic, looks bureaucratic. Format: "No. 4-WED-1547".
// Encodes weekday + HHMM so the share artifact carries proof of pinning.
export function generateSerial(weekday, hour, minute) {
  const wd = WEEKDAY_SHORT[weekday];
  const t = String(hour).padStart(2,'0') + String(minute).padStart(2,'0');
  return `No. 4-${wd}-${t}`;
}

export { WEEKDAY_FULL, WEEKDAY_SHORT };
