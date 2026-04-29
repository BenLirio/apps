// Lowercase Court — judge six anonymous texts and receive your judicial archetype.
// Deterministic: the six cases are seeded by a "docket number" stored in the URL
// fragment. Your verdicts + punishment chips are encoded into the fragment on
// the result screen so friends opening the share link get the same six cases.

/* ---------------- Case bank ---------------- */
// Each case now carries its OWN set of punishment chips per verdict so the
// sentences are tailored to the specific text message — not a generic pool.
// This makes reading the docket funny because the punishment echoes the crime.

const CASES = [
  {
    caption: "The matter of the 2:47am check-in",
    text: "u up? no reason just thinking",
    sender: "an unnamed party · received 2:47 am",
    chips: {
      "guilty": [
        "do not disturb, permanently, between 10pm and 10am",
        "must lead with a reason from now on",
        "auto-reply set to 'go to sleep' until further notice",
        "phone confiscated after 11pm for 30 days",
      ],
      "not guilty": [
        "granted one (1) late-night pass per quarter",
        "acquitted — the court has also been up",
        "permitted to text at 2am if accompanied by a reason",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "remanded until daylight",
        "case sealed until the next full moon",
      ],
    },
  },
  {
    caption: "The matter of the unsolicited update",
    text: "omg guess who i saw at trader joe's...... u'll never guess",
    sender: "a witness of the group chat · 11:02 am",
    chips: {
      "guilty": [
        "must name the person within 10 seconds or forfeit the story",
        "banned from trader joe's-related openings",
        "required to lead with the name, not the tease",
        "stripped of the right to use ellipses",
      ],
      "not guilty": [
        "acquitted — the tease was earned",
        "granted honorary correspondent status for the group chat",
        "promoted to lead gossip, pending good behavior",
      ],
      "mistrial": [
        "remanded for context (who was it)",
        "held in contempt until the name is revealed",
        "case sealed until a follow-up text arrives",
      ],
    },
  },
  {
    caption: "The matter of the dry reply",
    text: "ok",
    sender: "a close associate · 3 hours after last message",
    chips: {
      "guilty": [
        "sentenced to 'ok.' for life (the period is the punishment)",
        "must reply in full sentences for 30 days",
        "left on read in perpetuity",
        "banned from single-word replies",
      ],
      "not guilty": [
        "acquitted — 'ok' is a complete sentence",
        "restored to 'favorites' with full dry-texting privileges",
      ],
      "mistrial": [
        "remanded for tone clarification",
        "struck from the record pending a follow-up",
      ],
    },
  },
  {
    caption: "The matter of the excessive enthusiasm",
    text: "OMGGGG YESSS IM LITERALLY SO DOWN FOR THIS LETS GOOOOO 🥳🥳🥳",
    sender: "a party known for the reply-all · sunday 8:14 pm",
    chips: {
      "guilty": [
        "capslock privileges revoked for 14 days",
        "limited to one (1) exclamation point per message",
        "emoji allowance reduced to a single 🙂",
        "sentenced to dry texting for the remainder of the month",
      ],
      "not guilty": [
        "acquitted — the court is also literally so down",
        "awarded the bailiff's tambourine",
        "promoted to designated hype correspondent",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "remanded for energy-level assessment",
      ],
    },
  },
  {
    caption: "The matter of the soft-launch caption",
    text: "the way he just... gets it. unserious post coming.",
    sender: "witness A · ig story seen 14s ago",
    chips: {
      "guilty": [
        "must hard-launch within 48 hours or take it down",
        "demoted to close-friends story only",
        "soft-launch privileges suspended for 6 months",
        "required to tag the defendant",
      ],
      "not guilty": [
        "acquitted — the soft-launch is a protected art form",
        "granted one (1) additional cryptic caption per week",
      ],
      "mistrial": [
        "remanded pending a face reveal",
        "held until the unserious post actually arrives",
      ],
    },
  },
  {
    caption: "The matter of the corporate apology",
    text: "Hi! Just circling back on this — no rush at all, but wanted to make sure it didn't slip. :)",
    sender: "a colleague, allegedly · tuesday 4:58 pm",
    chips: {
      "guilty": [
        "forbidden from using 'circling back' for one fiscal year",
        "the ':)' is hereby admitted as evidence of passive aggression",
        "sentenced to an out-of-office through next quarter",
        "must send a direct message instead from now on",
      ],
      "not guilty": [
        "acquitted — the follow-up was professional and proper",
        "granted permission to circle back twice",
      ],
      "mistrial": [
        "remanded to HR for further review",
        "scheduled for a quick call (15 min, cameras off)",
      ],
    },
  },
  {
    caption: "The matter of the lowercase confession",
    text: "i think i might like you a normal amount",
    sender: "sender unknown · 1:11 am",
    chips: {
      "guilty": [
        "must define 'a normal amount' in writing",
        "banned from confessing after midnight",
        "required to say it again, but sober, and in person",
        "sentenced to being liked back a normal amount",
      ],
      "not guilty": [
        "acquitted, with a screenshot for the archive",
        "awarded one (1) good-morning text",
        "granted the status of protected crush",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "held until the feeling can be measured",
        "case sealed — this is a private matter",
      ],
    },
  },
  {
    caption: "The matter of the double-text",
    text: "hey! // also sorry for the double text // ok triple",
    sender: "a chronic offender · no context given",
    chips: {
      "guilty": [
        "limited to one message per hour for 7 days",
        "must consolidate all thoughts before sending",
        "typing indicator privileges revoked",
        "sentenced to wait for a reply (any reply)",
      ],
      "not guilty": [
        "acquitted — the chaos was endearing",
        "granted unlimited double-text rights in this chat only",
      ],
      "mistrial": [
        "remanded until the quadruple text arrives",
        "consolidated for the court's convenience",
      ],
    },
  },
  {
    caption: "The matter of the vague plans",
    text: "we should definitely get dinner soon!!!",
    sender: "a friend from college · last seen sept 2022",
    chips: {
      "guilty": [
        "must propose three (3) specific dates within 72 hours",
        "'soon' is hereby defined as 'within 14 days'",
        "banned from the word 'definitely' until plans are made",
        "sentenced to buy the first round when plans finally happen",
      ],
      "not guilty": [
        "acquitted — the sentiment was warm, if non-binding",
        "granted a 6-month extension on 'soon'",
      ],
      "mistrial": [
        "rescheduled indefinitely",
        "case held until a calendar invite materializes",
      ],
    },
  },
  {
    caption: "The matter of the astrology defense",
    text: "ok yeah i ghosted you but mercury was in gatorade babe",
    sender: "the accused · unsigned",
    chips: {
      "guilty": [
        "astrology defense struck from the record",
        "required to apologize without invoking a planet",
        "sentenced to ghosting's own medicine for 3 weeks",
        "babe privileges revoked",
      ],
      "not guilty": [
        "acquitted — mercury, in fact, was in gatorade",
        "granted one (1) celestial excuse per year",
      ],
      "mistrial": [
        "remanded to the astrologer",
        "postponed until mercury is direct",
      ],
    },
  },
  {
    caption: "The matter of the period at the end",
    text: "sounds good.",
    sender: "a party refusing to elaborate · thursday",
    chips: {
      "guilty": [
        "the period is ruled a hostile act",
        "sentenced to reply with exclamation points for 14 days",
        "must elaborate on every short reply for 30 days",
        "demoted from 'sounds good.' to 'ok.'",
      ],
      "not guilty": [
        "acquitted — the period was grammatically correct",
        "granted full rights to end sentences as they please",
      ],
      "mistrial": [
        "remanded for tone clarification",
        "case held until the elaboration arrives",
      ],
    },
  },
  {
    caption: "The matter of the 'k'",
    text: "k",
    sender: "a hostile witness · saturday 9:40 pm",
    chips: {
      "guilty": [
        "sentenced to 14 days of 'okay!' (with exclamation)",
        "single-letter replies banned from this chat",
        "must explain the 'k' in 200 words or more",
        "left on read until further notice",
      ],
      "not guilty": [
        "acquitted — the 'k' was efficient",
        "granted one (1) 'k' per day, for life",
      ],
      "mistrial": [
        "remanded for tone clarification",
        "struck from the record (but not from memory)",
      ],
    },
  },
  {
    caption: "The matter of the haha vs lol",
    text: "hahaha that's so funny, i actually do that too lol",
    sender: "an allegedly amused friend · noon",
    chips: {
      "guilty": [
        "must produce evidence they actually laughed",
        "'lol' banned from this chat for 30 days",
        "sentenced to 'LMAO' or nothing",
        "required to send a voice memo of the actual laugh",
      ],
      "not guilty": [
        "acquitted — the court also, actually, does that",
        "granted the rare dual-'haha'-'lol' honor",
      ],
      "mistrial": [
        "remanded for laughter verification",
        "held pending a follow-up haha",
      ],
    },
  },
  {
    caption: "The matter of the ellipsis storm",
    text: "so... about the other night... i don't know... maybe we talk...?",
    sender: "the complainant · 11:58 pm",
    chips: {
      "guilty": [
        "ellipsis privileges revoked for 30 days",
        "must commit to one (1) complete sentence",
        "sentenced to state the thing, out loud, in person",
        "forbidden from trailing off",
      ],
      "not guilty": [
        "acquitted — the ellipses were honest",
        "granted safe passage to 'maybe we talk'",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "case held until a period appears",
      ],
    },
  },
  {
    caption: "The matter of the accidental typo",
    text: "i lobe you",
    sender: "a first-time offender · autocorrect, allegedly",
    chips: {
      "guilty": [
        "must lobe the court back",
        "required to say it correctly, out loud, now",
        "autocorrect privileges suspended for 7 days",
        "sentenced to proofreading detail",
      ],
      "not guilty": [
        "acquitted — the lobe is now a legal declaration",
        "awarded the court's seal of lobe",
        "promoted to main character",
      ],
      "mistrial": [
        "remanded for clarification (lobe or love?)",
        "held until a follow-up correction arrives",
      ],
    },
  },
  {
    caption: "The matter of the screenshot request",
    text: "WAIT NO send me the screenshot i need to see this in court",
    sender: "the court's most-called witness · 7:22 pm",
    chips: {
      "guilty": [
        "sentenced to send all screenshots in chronological order",
        "must redact nothing (we want the full thread)",
        "screenshot privileges suspended for 30 days",
        "required to deliver hard copies to the bench",
      ],
      "not guilty": [
        "acquitted — the screenshot is admitted into evidence",
        "promoted to co-counsel for this proceeding",
      ],
      "mistrial": [
        "remanded pending the screenshot's arrival",
        "case sealed until the screenshot is received",
      ],
    },
  },
  {
    caption: "The matter of the one-word text",
    text: "thoughts?",
    sender: "the prosecution · without context, again",
    chips: {
      "guilty": [
        "must provide the context they themselves requested",
        "banned from open-ended one-word prompts for 30 days",
        "required to include a subject line from now on",
        "sentenced to explain themselves in full",
      ],
      "not guilty": [
        "acquitted — brevity is the soul of the chat",
        "granted unlimited 'thoughts?' privileges",
      ],
      "mistrial": [
        "remanded for context",
        "held until the follow-up arrives",
      ],
    },
  },
  {
    caption: "The matter of the birthday reminder",
    text: "hbd!! 🎂",
    sender: "a peripheral contact · 4 days late",
    chips: {
      "guilty": [
        "sentenced to a late-hbd stamp for one (1) year",
        "must send a full 'happy birthday' next year, minimum",
        "🎂 privileges suspended until further notice",
        "required to deliver an actual cake",
      ],
      "not guilty": [
        "acquitted — the thought, late as it was, counted",
        "granted a 7-day grace period on future birthdays",
      ],
      "mistrial": [
        "remanded to the calendar",
        "held pending an explanation for the delay",
      ],
    },
  },
  {
    caption: "The matter of the Sunday work text",
    text: "hey, sorry to bother on a sunday — could you hop on a quick call?",
    sender: "a superior · 10:47 am on the sabbath",
    chips: {
      "guilty": [
        "sunday communications hereby banned",
        "must reply on a monday, at the earliest",
        "'quick call' redefined as 'no call'",
        "sentenced to send the follow-up email instead",
      ],
      "not guilty": [
        "acquitted — the apology was noted",
        "granted one (1) emergency sunday call per quarter",
      ],
      "mistrial": [
        "scheduled for monday, 9am, camera optional",
        "held until business hours resume",
      ],
    },
  },
  {
    caption: "The matter of the cryptic caption",
    text: "some people know what they did 💅",
    sender: "the complainant · instagram story, 2h ago",
    chips: {
      "guilty": [
        "must name the people in question",
        "cryptic caption privileges revoked for 30 days",
        "required to post the receipts or take it down",
        "💅 privileges suspended pending clarity",
      ],
      "not guilty": [
        "acquitted — they know what they did",
        "granted one (1) additional subtweet per week",
      ],
      "mistrial": [
        "remanded pending a name",
        "held until a follow-up story drops",
      ],
    },
  },
  {
    caption: "The matter of the 'no worries if not'",
    text: "wanna grab a drink wed? no worries if not tho!!",
    sender: "a soft spoken friend · tuesday afternoon",
    chips: {
      "guilty": [
        "'no worries if not' hereby stricken from all future invites",
        "must ask with full confidence next time",
        "banned from softening every ask for 30 days",
        "sentenced to propose the plan assertively",
      ],
      "not guilty": [
        "acquitted — the escape hatch was polite",
        "granted standing permission to 'no worries if not'",
      ],
      "mistrial": [
        "postponed until wednesday, pending vibes",
        "remanded for scheduling",
      ],
    },
  },
  {
    caption: "The matter of the emoji-only response",
    text: "🤨",
    sender: "the jury of one · six minutes after your last message",
    chips: {
      "guilty": [
        "🤨 entered as evidence of hostile skepticism",
        "sentenced to explain the face in words",
        "emoji-only responses banned for 14 days",
        "must provide three (3) additional sentences per reply",
      ],
      "not guilty": [
        "acquitted — the 🤨 was warranted",
        "granted judicial eyebrow-raise privileges",
      ],
      "mistrial": [
        "remanded for emoji clarification",
        "held pending a follow-up",
      ],
    },
  },
  {
    caption: "The matter of the group chat silence",
    text: "[group chat has been quiet for 6 days after your last message]",
    sender: "the court's deafening silence · entered as evidence",
    chips: {
      "guilty": [
        "all members held in joint contempt",
        "group chat placed on probation for 30 days",
        "sentenced to reply with at minimum one 'lol' apiece",
        "the silence itself is ruled a collective hostile act",
      ],
      "not guilty": [
        "acquitted — the silence was restful",
        "granted a further 6 days of peace",
      ],
      "mistrial": [
        "held pending revival",
        "case sealed until someone sends a meme",
      ],
    },
  },
  {
    caption: "The matter of the paragraph apology",
    text: "hey so i've been thinking a lot and i wanted to say that i'm really sorry for what happened i know i've been distant and honestly you deserve better and if you want to talk i'm here and if you don't i totally understand no pressure at all",
    sender: "the accused · one long breath, 11:04 pm",
    chips: {
      "guilty": [
        "must deliver the apology in person, with punctuation",
        "sentenced to proofread all future texts",
        "required to wait 24 hours before any paragraph-text",
        "the run-on is hereby admitted as aggravating evidence",
      ],
      "not guilty": [
        "acquitted — the apology was sincere, if winded",
        "granted one (1) accepted apology, subject to future review",
      ],
      "mistrial": [
        "remanded for reflection",
        "case held until a follow-up, with punctuation, arrives",
      ],
    },
  },
  {
    caption: "The matter of the 'u free?'",
    text: "u free?",
    sender: "an ex, allegedly · after 14 months of silence",
    chips: {
      "guilty": [
        "no. permanently. next.",
        "left on read for the next 14 months",
        "banned from initiating contact for one (1) year",
        "sentenced to the blocked list",
      ],
      "not guilty": [
        "acquitted — curiosity is not a crime",
        "one (1) reply granted, strictly for closure",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "case sealed until further notice",
      ],
    },
  },
  {
    caption: "The matter of the 'pls read'",
    text: "ok pls don't freak out but read this whole thing before you respond",
    sender: "a defendant pleading for leniency · 1:33 am",
    chips: {
      "guilty": [
        "automatic freak-out, as requested not to",
        "required to lead with the point, not the plea",
        "late-night paragraphs banned for 30 days",
        "sentenced to send the next one before midnight",
      ],
      "not guilty": [
        "acquitted — the pre-emptive warning was considerate",
        "granted one (1) future 'pls read' without freakout",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "held until after a night's sleep",
      ],
    },
  },
  {
    caption: "The matter of the 'i miss you'",
    text: "i miss you btw",
    sender: "a sender with no follow-up · wednesday 12:18 am",
    chips: {
      "guilty": [
        "the 'btw' is ruled an aggravating factor",
        "sentenced to say it properly, without the qualifier",
        "required to follow up within 24 hours",
        "missed-you privileges suspended until daylight",
      ],
      "not guilty": [
        "acquitted — the court also, btw, misses them",
        "awarded one (1) returned 'i miss you too'",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "remanded for follow-up",
      ],
    },
  },
  {
    caption: "The matter of the read receipt",
    text: "[message read 2:07 pm · no reply for 48 hrs]",
    sender: "the jury, in silence · tuesday through thursday",
    chips: {
      "guilty": [
        "read receipts permanently disabled for the accused",
        "sentenced to reply within the hour for the next 30 days",
        "the 48-hour silence is entered as hostile evidence",
        "required to send a double-text in apology",
      ],
      "not guilty": [
        "acquitted — they were thinking about their reply",
        "granted up to 72 hours to reply in future",
      ],
      "mistrial": [
        "held pending the long-awaited reply",
        "remanded for explanation",
      ],
    },
  },
  {
    caption: "The matter of the sudden formality",
    text: "Hey, do you have a moment to talk?",
    sender: "a capitalizing stranger · friday 6:30 pm",
    chips: {
      "guilty": [
        "full capitalization ruled as ominous",
        "required to lead with the actual topic",
        "'do you have a moment' hereby banned from this chat",
        "sentenced to send the bad news in writing first",
      ],
      "not guilty": [
        "acquitted — the courtesy was appreciated",
        "granted one (1) formal check-in per month",
      ],
      "mistrial": [
        "scheduled for the moment in question",
        "postponed pending the topic",
      ],
    },
  },
  {
    caption: "The matter of the tipsy text",
    text: "i think ur like. actually one of my favorite ppl. not saying thjs cause im drunk",
    sender: "the accused · saturday 12:57 am",
    chips: {
      "guilty": [
        "must repeat, sober, on a weekday",
        "tipsy text privileges revoked for 30 days",
        "required to proofread before 2am",
        "sentenced to a follow-up brunch",
      ],
      "not guilty": [
        "acquitted — in vino veritas",
        "awarded honorary 'favorite person' status",
      ],
      "mistrial": [
        "postponed pending sobriety",
        "held until the sober confirmation arrives",
      ],
    },
  },
  {
    caption: "The matter of the Venmo request",
    text: "reqd u $4 for the uber!! love u 🫶",
    sender: "the complainant · 9:02 am",
    chips: {
      "guilty": [
        "must pay, immediately, with a passive-aggressive emoji",
        "Venmo description subpoenaed for inspection",
        "banned from requesting sums under $5 for 30 days",
        "sentenced to cover the next uber",
      ],
      "not guilty": [
        "acquitted — fair's fair",
        "🫶 entered as a valid softener",
      ],
      "mistrial": [
        "remanded for receipt review",
        "held pending a breakdown of the fare",
      ],
    },
  },
  {
    caption: "The matter of the 'we need to talk'",
    text: "can we talk?",
    sender: "a chilling 4-word affidavit · arrived during meeting",
    chips: {
      "guilty": [
        "must lead with the topic, not the summons",
        "'can we talk?' banned without context for 60 days",
        "sentenced to a full-sentence preview of the subject",
        "required to schedule it, in writing, with an agenda",
      ],
      "not guilty": [
        "acquitted — it's a reasonable ask",
        "granted a courtroom, a bailiff, and a cup of water",
      ],
      "mistrial": [
        "scheduled for immediately after the meeting",
        "held pending the topic",
      ],
    },
  },
];

/* ---------------- Fallback chip bank ---------------- */
// Generic chips — used only if a case somehow lacks tailored chips for a
// verdict, so the app never crashes. The per-case chips above are the norm.

const FALLBACK_CHIPS = {
  "guilty": [
    "muted for 7 days",
    "demoted to close-friends story",
    "sentenced to dry texting",
    "left on read in perpetuity",
  ],
  "not guilty": [
    "acquitted, with a screenshot",
    "promoted to main character",
    "granted speaking privileges",
  ],
  "mistrial": [
    "remanded for context",
    "struck from the record (but not from memory)",
    "postponed pending sobriety",
  ],
};

function chipsFor(caseObj, verdict) {
  if (caseObj && caseObj.chips && Array.isArray(caseObj.chips[verdict]) && caseObj.chips[verdict].length) {
    return caseObj.chips[verdict];
  }
  return FALLBACK_CHIPS[verdict] || FALLBACK_CHIPS["guilty"];
}

/* ---------------- Archetypes ---------------- */

const ARCHETYPES = [
  {
    name: "The Lowercase Judge",
    tag: "rules without capital letters. punishes capital crimes.",
    ordered: "so ordered, quietly, no period at the end",
  },
  {
    name: "Her Honor Ellipsis",
    tag: "always leaves the door slightly open… the sentence hanging… the defendant unsure.",
    ordered: "so ordered… probably… we'll see…",
  },
  {
    name: "The Capslock Constitutionalist",
    tag: "STRICT. ORIGINALIST. READS EVERY TEXT IN ALL CAPS EVEN WHEN IT ISN'T.",
    ordered: "SO ORDERED. NO FURTHER DISCUSSION.",
  },
  {
    name: "The Emoji Originalist",
    tag: "believes the true meaning of any text is in the emoji. a 🙂 is a criminal act.",
    ordered: "so ordered 🫡⚖️📎",
  },
  {
    name: "The Period-at-the-End Prosecutor",
    tag: "every message is evidence. every period is aggression. every 'ok.' is a confession.",
    ordered: "so ordered.",
  },
  {
    name: "The Merciful Moderator",
    tag: "believes context matters. grants continuances. suspects mercury, not malice.",
    ordered: "so ordered, with love",
  },
];

/* ---------------- Seeded randomness ---------------- */

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Mulberry32 seeded PRNG — deterministic, bit-stable across browsers.
function mulberry32(a) {
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- Docket number / seed ---------------- */

function generateDocketNo() {
  // 2 digits year-ish + 4 digits random — looks like "25-4871"
  const yy = 24 + Math.floor(Math.random() * 4); // 24-27
  const nnnn = String(Math.floor(1000 + Math.random() * 9000));
  return `${yy}-${nnnn}`;
}

function docketSeed(docketNo) {
  return hash("lowercase-court::" + docketNo);
}

function casesForDocket(docketNo) {
  const rng = mulberry32(docketSeed(docketNo));
  const shuffled = seededShuffle(CASES, rng);
  return shuffled.slice(0, 6);
}

/* ---------------- Archetype logic ---------------- */
// Deterministic: given the six rulings, always return the same archetype.

function archetypeFor(rulings) {
  const guilty = rulings.filter(r => r.verdict === "guilty").length;
  const notGuilty = rulings.filter(r => r.verdict === "not guilty").length;
  const mistrial = rulings.filter(r => r.verdict === "mistrial").length;

  // Signature concatenation — deterministic tiebreaker.
  const sig = rulings.map(r => r.verdict[0] + "|" + r.chip).join("::");
  const h = hash(sig);

  // Strong behavioral signals first.
  if (guilty >= 5) return ARCHETYPES[2]; // Capslock Constitutionalist
  if (notGuilty >= 5) return ARCHETYPES[5]; // Merciful Moderator
  if (mistrial >= 4) return ARCHETYPES[1]; // Her Honor Ellipsis
  if (guilty === 3 && notGuilty === 3) return ARCHETYPES[4]; // Period-at-the-End
  if (mistrial >= 2 && notGuilty >= 2) return ARCHETYPES[3]; // Emoji Originalist
  if (guilty >= 4 && mistrial === 0) return ARCHETYPES[0]; // Lowercase Judge

  // Soft fallback: hash-indexed so any ruling set gets a stable archetype.
  return ARCHETYPES[h % ARCHETYPES.length];
}

/* ---------------- State ---------------- */

const state = {
  docketNo: null,
  cases: [],
  idx: 0,
  rulings: [], // { caseIdx, verdict, chip, text, caption }
};

/* ---------------- URL fragment encode/decode ---------------- */
// Fragment format:
//   #d=25-4871              -> a fresh docket, no rulings yet (friend-mode)
//   #d=25-4871&r=g:0,n:2,m:1,g:4,g:3,n:5
//     where each entry is verdict-initial:chipIndex-into-this-case's-chips-for-that-verdict
//     verdict initials: g=guilty, n=not guilty, m=mistrial
// If the fragment contains 6 rulings, we skip straight to the docket screen.
// Note: chip indices are now per-case (since each case has its own pool),
// but the on-wire format is unchanged — friends with the share link see the
// same cases in the same order, so the same indices resolve.

function parseFragment() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const d = params.get("d");
  const r = params.get("r");
  const out = { d: null, r: null };
  if (d && /^[0-9]{2}-[0-9]{4}$/.test(d)) out.d = d;
  if (r) {
    // Don't resolve chips yet — we need the case order (from `d`) to map
    // chipIdx → chip label. Return the raw entries; callers resolve after
    // `state.cases` is populated.
    const entries = r.split(",").map(e => {
      const [v, c] = e.split(":");
      const verdict = { g: "guilty", n: "not guilty", m: "mistrial" }[v];
      const chipIdx = parseInt(c, 10);
      if (!verdict || isNaN(chipIdx)) return null;
      return { verdict, chipIdx };
    });
    if (entries.length === 6 && entries.every(Boolean)) out.r = entries;
  }
  return out;
}

function encodeRulingsToFragment(docketNo, rulings) {
  const vChar = { "guilty": "g", "not guilty": "n", "mistrial": "m" };
  const parts = rulings.map((r, i) => {
    const c = state.cases[i];
    const pool = chipsFor(c, r.verdict);
    const idx = pool.indexOf(r.chip);
    return `${vChar[r.verdict]}:${idx < 0 ? 0 : idx}`;
  });
  return `#d=${docketNo}&r=${parts.join(",")}`;
}

/* ---------------- DOM helpers ---------------- */

const $ = (id) => document.getElementById(id);

function show(id) {
  ["intro", "trial", "deliberating", "result"].forEach(s => {
    $(s).classList.toggle("hidden", s !== id);
  });
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* ---------------- Flow ---------------- */

function startFreshDocket() {
  state.docketNo = generateDocketNo();
  state.cases = casesForDocket(state.docketNo);
  state.idx = 0;
  state.rulings = [];
  history.replaceState(null, "", `#d=${state.docketNo}`);
  $("docket-no").textContent = state.docketNo;
  renderIntro();
}

function renderIntro() {
  $("docket-no").textContent = state.docketNo || generateDocketNo();
  show("intro");
}

function renderCase() {
  const c = state.cases[state.idx];
  $("case-num").textContent = (state.idx + 1);
  $("case-caption").textContent = c.caption;
  $("text-exhibit").textContent = "\u201c" + c.text + "\u201d";
  $("sender-meta").textContent = c.sender;

  // Reset verdict buttons
  document.querySelectorAll(".verdict-btn").forEach(btn => btn.classList.remove("selected"));

  // Hide punishment panel until a verdict is chosen
  $("punishment-panel").classList.add("hidden");
  $("chip-row").innerHTML = "";

  show("trial");
}

function chooseVerdict(verdict) {
  document.querySelectorAll(".verdict-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.verdict === verdict);
  });
  showChipsFor(verdict);
}

function showChipsFor(verdict) {
  const c = state.cases[state.idx];
  const pool = chipsFor(c, verdict);
  const row = $("chip-row");
  row.innerHTML = "";
  pool.forEach((chipLabel) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = chipLabel;
    b.addEventListener("click", () => recordRuling(verdict, chipLabel));
    row.appendChild(b);
  });
  $("punishment-panel").classList.remove("hidden");
}

function recordRuling(verdict, chip) {
  const c = state.cases[state.idx];
  state.rulings.push({
    caseIdx: state.idx,
    verdict,
    chip,
    text: c.text,
    caption: c.caption,
  });

  state.idx += 1;
  if (state.idx >= 6) {
    goToDeliberating();
  } else {
    renderCase();
  }
}

const DELIBERATING_COPY = [
  "the court is deliberating…",
  "the bench consults the group chat…",
  "weighing the evidence (and the vibes)…",
  "cross-referencing your screenshots folder…",
  "bailiff is fetching the docket…",
];

function goToDeliberating() {
  const copy = DELIBERATING_COPY[hash(state.rulings.map(r => r.verdict).join("")) % DELIBERATING_COPY.length];
  $("deliberating-copy").textContent = copy;
  show("deliberating");
  setTimeout(renderResult, 1100);
}

function escapeHtml(s) {
  return s.replace(/[&<>\"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[ch]));
}

function verdictClass(v) {
  return ({ "guilty": "guilty", "not guilty": "notguilty", "mistrial": "mistrial" })[v] || "guilty";
}

function renderResult() {
  const arch = archetypeFor(state.rulings);

  $("result-docket-no").textContent = state.docketNo;
  $("archetype-name").textContent = arch.name;
  $("archetype-tag").textContent = arch.tag;

  // Build each ruling line
  const rulings = $("rulings");
  rulings.innerHTML = "";
  state.rulings.forEach((r) => {
    const li = document.createElement("li");
    // Short-quote the text; it's already the exhibit the reader saw.
    const quote = r.text.length > 80 ? r.text.slice(0, 77) + "…" : r.text;
    li.innerHTML = `
      <div class="ruling-quote">&ldquo;${escapeHtml(quote)}&rdquo;</div>
      <div>
        <span class="ruling-verdict ${verdictClass(r.verdict)}">${r.verdict}</span>
        <span class="ruling-chip">${escapeHtml(r.chip)}</span>
      </div>
    `;
    rulings.appendChild(li);
  });

  $("so-ordered").textContent = arch.ordered;

  // Push the rulings into the URL fragment so the share link carries them.
  const frag = encodeRulingsToFragment(state.docketNo, state.rulings);
  history.replaceState(null, "", frag);

  $("share").style.display = "";
  show("result");
}

/* ---------------- Replay from fragment ---------------- */

function replayFromFragment(parsed) {
  // A friend opens a share link with 6 rulings encoded.
  state.docketNo = parsed.d;
  state.cases = casesForDocket(state.docketNo);
  state.rulings = parsed.r.map((entry, i) => {
    const c = state.cases[i];
    const pool = chipsFor(c, entry.verdict);
    const chip = pool[entry.chipIdx] != null ? pool[entry.chipIdx] : (pool[0] || "");
    return {
      caseIdx: i,
      verdict: entry.verdict,
      chip: chip,
      text: c.text,
      caption: c.caption,
    };
  });
  state.idx = 6;
  renderResult();
}

/* ---------------- Boot ---------------- */

function boot() {
  const parsed = parseFragment();

  if (parsed && parsed.d && parsed.r) {
    // Share link with full rulings — show docket immediately.
    replayFromFragment(parsed);
    return;
  }

  if (parsed && parsed.d) {
    // Share link without rulings — friend gets the same six cases.
    state.docketNo = parsed.d;
    state.cases = casesForDocket(state.docketNo);
    state.idx = 0;
    state.rulings = [];
    $("docket-no").textContent = state.docketNo;
    renderIntro();
    return;
  }

  // Fresh visit — mint a new docket.
  startFreshDocket();
}

document.addEventListener("DOMContentLoaded", () => {
  // Wire up buttons
  $("start-btn").addEventListener("click", () => {
    renderCase();
  });

  document.querySelectorAll(".verdict-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      chooseVerdict(btn.dataset.verdict);
    });
  });

  $("retry-btn").addEventListener("click", () => {
    // Fresh docket so the retry produces new cases for the same judge.
    startFreshDocket();
  });

  boot();
});

/* ---------------- Share ---------------- */

function share() {
  const title = document.title;
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert("Docket link copied! Your friends will get the same six cases."))
      .catch(() => alert(url));
  }
}
