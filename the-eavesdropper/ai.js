/* ai.js — single AI call per user journey: write the letter from the
 * stranger to "you," conditioned on (seat, dwell vector, lingered-on
 * fragments). Includes a per-leader deterministic fallback so the app
 * never dead-ends on a network or rate-limit failure.
 *
 * One image call per journey would have been wasted budget here — the
 * letter is the artifact. We keep the proxy-call count to one (text). */

import { TABLES, NAME_BANK } from './cafe.js';

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'the-eavesdropper';

/* ---------- Build the prompt ---------- */
export function buildLetterPrompt({
  seatId,
  seatLabel,
  seatWhere,
  leaderTableId,
  signerName,
  letterSelfDescriptor,
  dwellPctVector,
  lingeredFragments,    // [{tableId, fragmentText}]
  letterSeed,
}) {
  const leader = TABLES[leaderTableId];
  const voice = leader?.voice || 'a stranger from a cafe.';
  const closing = leader?.closing || '';

  const dwellLine = Object.entries(dwellPctVector)
    .filter(([, v]) => v > 0.02)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${TABLES[k]?.name || k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const lingerLines = lingeredFragments
    .filter(f => f.tableId === leaderTableId)
    .slice(0, 4)
    .map(f => `  · "${f.fragmentText.replace(/"/g, '”')}"`)
    .join('\n');

  const otherLines = lingeredFragments
    .filter(f => f.tableId !== leaderTableId)
    .slice(0, 3)
    .map(f => `  · ${TABLES[f.tableId]?.name || f.tableId}: "${f.fragmentText.replace(/"/g, '”')}"`)
    .join('\n');

  const system = [
    `You are ${signerName}, ${letterSelfDescriptor}.`,
    `Voice: ${voice}`,
    `Tone: hand-typed, on a typewriter, on cafe paper, addressed to a stranger you noticed listening to you.`,
    `You are writing a short letter to a person you call only "you." You don't know their name.`,
    `Length: between 90 and 140 words. Three short paragraphs.`,
    `Do NOT use the words "dear," "letter," "eavesdrop," "overheard," "AI." Do NOT begin with "I am writing." Do NOT include a date or address line.`,
    `Reference at least one specific thing the listener could have heard you say (paraphrased, not quoted exactly — the listener should feel it landed but not feel surveilled).`,
    `End the body of the letter without a sign-off. The signature is added separately.`,
    `Output only the letter body, separated into three paragraphs by blank lines. No preface, no explanation, no quotation marks around the letter.`,
    `Reproducibility seed: ${letterSeed}. Same seed should yield similar letters.`,
  ].join('\n');

  const userPrompt = [
    `The listener sat at: ${seatLabel}. (${seatWhere})`,
    `Dwell-time across the room: ${dwellLine}.`,
    `What they lingered on, from your table:`,
    lingerLines || '  (they only caught a stray phrase)',
    otherLines ? `What else passed through their attention:\n${otherLines}` : '',
    `Closing detail you can choose to allude to (or not): ${closing}`,
    ``,
    `Now write the letter. Three short paragraphs. ~90–140 words. Address the reader as "you." End without a sign-off line.`,
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user',   content: userPrompt },
  ];
}

/* ---------- Call the AI proxy ----------
 * Returns the raw letter text. On any failure, returns deterministic
 * fallback text from the per-leader bank. */
export async function generateLetter(input) {
  const messages = buildLetterPrompt(input);
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 320 }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const txt = (data.content || '').trim();
    if (!txt || txt.length < 40) throw new Error('too_short');
    return { text: txt, source: 'ai' };
  } catch (_) {
    return { text: fallbackLetter(input), source: 'fallback' };
  }
}

/* ---------- Deterministic fallback letters ----------
 * One per table-leader. Each is a short, voice-matched 3-paragraph note.
 * Used on network failure / rate-limit / parse failure. */
const FALLBACK_LETTERS = {
  t1: `you didn't say anything to me, but you were listening like you'd known me a long time, and i felt that. it's a strange thing — when a room is full of strangers and one of them turns the right ear toward you, it changes the air.

i was talking about my son and i was pretending to talk about something smaller. i think you knew that. that's the part i wanted to tell you. you understood the size of what i was saying and you let it pass without making a face about it.

if i ever come back to this cafe and you are still here, i'll bring you a small thing — a postcard, maybe, or a story i never told my son. thank you for the kindness of your attention. it was a real thing, and i felt it.`,

  t2: `i kept catching your attention drift over and i kept choosing slightly truer sentences each time. that is not a thing i normally do in public. you were a small good influence on a tuesday afternoon.

the thing about the calathea — you laughed in the right place. you didn't make me feel pathetic for talking to a houseplant. people don't always know which jokes you tell on yourself are jokes. you did. that mattered more than i can explain in this little type-stretched paragraph.

if you tell anyone about this letter, please don't say "the freelancer at the cafe wrote me a letter." say it was a friend. for fifteen minutes that's what you almost were. i am keeping that.`,

  t3: `she didn't come. you already know that. you watched the way the door kept being not her. i suspect we both kept score for a while, in different rooms of the same room.

i don't know who you are. i know you ordered something small and made it last. i know you didn't look at me the way the staff did near the end. for that i am writing this on the back of the receipt for the third pastry, which is a level of melodrama i can no longer be embarrassed about, given everything.

if you see me here next tuesday, you are allowed to nod. you are also allowed to not. either is the right answer. i hope you are loved by someone who is on time.`,

  t4: `i could feel your attention from across the room and it made me braver than i would have been. that is an embarrassing sentence to type, and yet, here it is. you were the third person at the table and you didn't know it.

there is a version of tonight where i didn't say the thing about the rented jacket. that version is more careful and less true. you were partly responsible for the version that happened. when i tell this story later, you will not be in it, but you will be the reason a few of the lines were less guarded than they could have been.

thank you. i am, as it turns out, the kind of person who writes a letter to a stranger from a cafe. so are you, apparently. we were briefly the same kind of person. that's a generous, surprising thing.`,

  t5: `you noticed i was talking to the book. most people don't, and the ones who do mostly look away. you didn't. that is a small kindness with a long shape.

i am old enough to know that a stranger paying close attention to me for forty seconds is, on certain tuesdays, the same as being briefly accompanied. i don't need more than that, most of the time. today i did, and you were there, and i am writing this in the margin of chapter eleven before i forget.

i will leave this letter under the saucer when i go. if it finds you, take it as a sign that the room was, for a moment, on your side. you were on mine.`,

  bar: `you sat at the bar and you didn't talk and that is the highest compliment a person can pay a barista on a slow tuesday. thank you.

i told the espresso machine some things while you were there. you heard most of them. you have my permission to keep them. i am, as it turns out, training a machine to be quieter than i am, and i think you understood the assignment before i did.

if you come back, sit at the bar again. i'll make whatever you order with one extra degree of care. you will be able to taste the difference, but you will not be able to prove it. that's the deal. that's the whole deal.`,
};

function fallbackLetter({ leaderTableId }) {
  return FALLBACK_LETTERS[leaderTableId] || FALLBACK_LETTERS.bar;
}
