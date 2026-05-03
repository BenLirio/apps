/* cafe.js — static catalog of seats, tables, fragments, and the proximity map.
 * No runtime state lives here. Pure data. Imported by mechanic.js.
 *
 * Floor plan (7 cols × 6 rows):
 *
 *   col:  0   1   2   3   4   5   6
 *   row 0 W   W   W   W   W   W   W      ← back wall
 *   row 1 W   T1·     T2·     T3·  W     ← three small tables along back wall
 *   row 2 W   ·   ·   ·   ·   ·   W      ← walking lane
 *   row 3 W   T4·     B   ·   ·   W      ← table 4 left of bar; bar mid-floor
 *   row 4 W   ·   ·   B   ·   T5· W      ← bar continues; table 5 right
 *   row 5 W   D   ·   ·   ·   ·   W      ← entry door bottom-left
 *
 *  T1..T5 are tables (each with two strangers conversing).
 *  B is the espresso bar (one barista monologuing softly).
 *  Six "open chairs" are the candidate seats — each sits adjacent to 1-2 tables.
 */

export const TABLES = {
  t1: {
    id: 't1',
    name: 'Table 1',
    label: 'window seat / two coats',
    speakers: ['the older woman', 'her grown son'],
    voice: 'a mother and her grown son. she is gentle, careful with words. he is half-distracted, scrolling. their conversation is the kind that pretends to be about nothing.',
    fragments: [
      "I'm not asking you to call your sister, I'm just saying her birthday is on a Sunday this year.",
      "He left the porch light on for me every night I was at the hospital. Every single night.",
      "You don't have to be hungry to eat, you know. Sometimes you eat because you're tired.",
      "I dreamed about the house in Vermont again. The one with the broken screen door.",
      "Honestly, I think the saddest thing about your father was that he was never bored. Not once in his life.",
      "I'm not telling you what to do. I'm telling you what I'd do, and you're welcome to do something else.",
      "She sent me a photo of the dog wearing a sweater. I cried in the parking lot.",
      "Don't apologize for being late. I was early on purpose. I wanted the chair by the window.",
    ],
    closing: 'leaves first, with a long touch on her son\'s shoulder before standing.',
  },

  t2: {
    id: 't2',
    name: 'Table 2',
    label: 'two laptops / cold flat whites',
    speakers: ['the freelancer', 'her old college friend'],
    voice: 'two women in their early thirties catching up. one is a freelance designer in a slow month. the other is visiting from out of town. the conversation oscillates between competitive small-talk and accidental honesty.',
    fragments: [
      "I keep telling people I'm 'between projects,' which is both true and a lie I am paying for.",
      "Do you remember the night we slept on the kitchen floor because the heat was off?",
      "I bought a plant called a calathea and I've been talking to it. I think it hates me.",
      "He proposed in a way that made me want to say yes to a different person.",
      "I started saying 'I'll get back to you' like it's a personality trait.",
      "When I'm anxious I read recipes. Just read them. I haven't cooked anything in five months.",
      "I think the version of me you knew would have taken the job. The version of me now wouldn't even open the email.",
      "Has anyone in your life ever loved you in a way that made you want to lie down and be quiet?",
    ],
    closing: 'they hug for slightly too long at the door. neither says goodbye.',
  },

  t3: {
    id: 't3',
    name: 'Table 3',
    label: 'wedding-band guy / nobody yet',
    speakers: ['the man at the back-corner table', 'the empty chair across from him'],
    voice: 'a man waiting for someone who is twenty minutes late. he is on the phone with a person who is not the one he is waiting for. he keeps the phone tilted toward the empty chair like an excuse.',
    fragments: [
      "She said seven. I'm reading the text. It says seven. I'm not making this up.",
      "No, I don't want to leave. If I leave and she shows up I'll feel like an asshole.",
      "I keep ordering things so the staff don't think I'm a guy waiting alone. I've had three pastries.",
      "I rehearsed this. I actually rehearsed it. In the car. Out loud. I sounded insane.",
      "Tell mom I'm fine. Don't tell her I'm here. Tell her I'm at the grocery store.",
      "If she comes I'm going to act surprised that she came. I think that's the move.",
      "We met at a wedding. Hers, technically. It is a long story and I am a worse person than the story makes me sound.",
      "I am going to wait one more song. If the next song is a sad one I'm leaving.",
    ],
    closing: 'eventually puts down a twenty, leaves the pastry crumbs, walks out without looking back.',
  },

  t4: {
    id: 't4',
    name: 'Table 4',
    label: 'four-top by the plant / first date',
    speakers: ['the first-date couple'],
    voice: 'two people on what is clearly a first date, both pretending to be more relaxed than they are. one is a teacher, the other is a cellist. they over-laugh, then over-correct, then settle.',
    fragments: [
      "I've never told anyone this, which is a weird thing to say on a first date but here we are.",
      "When I was nine I memorized every constellation in the northern hemisphere because I was scared of the dark.",
      "I don't believe in love at first sight, but I do believe in love at fourteenth sight, which is annoying because it means you have to keep showing up.",
      "I want to ask you a question that's a little intense. Is that okay? Okay. Have you ever been the cause of someone's worst day?",
      "My therapist says I narrate my own life like it's a documentary, which is true and also, observably, what I am doing right now.",
      "I rented this jacket. That's the truth. I rented it from my brother for the evening for ten dollars and a promise.",
      "I almost canceled tonight. I'm so glad I didn't. I'm trying to say that without it sounding like a line.",
      "If this goes well, do you want to walk to the bridge? I won't push you in. Probably. I'm 78 percent sure.",
    ],
    closing: 'they leave together, talking with their whole hands, missing the door once and laughing about it.',
  },

  t5: {
    id: 't5',
    name: 'Table 5',
    label: 'small two-top / paperback open',
    speakers: ['the woman reading alone'],
    voice: 'a woman in her late fifties, alone, reading a paperback she has clearly read before. occasionally she speaks under her breath at the book. she also writes a single-line note in the margin every few minutes.',
    fragments: [
      "Oh, you again, you difficult sentence. I missed you.",
      "(She underlines a line and whispers to no one in particular: 'this is the only true thing in this book.')",
      "I'm going to stop telling people I 'reread' things. I'm visiting them. They're old friends and I am visiting them.",
      "(She closes the book on her thumb and stares at the door for a full minute, as if expecting someone, then opens it again.)",
      "There's a man at the next table waiting for someone. He's been here since I started chapter four. He's about to leave.",
      "(In her margin she writes: 'the boy in chapter eleven is my brother, even though he isn't.')",
      "I came here on the worst day of my life and a stranger gave me their last cinnamon bun. I have come every Tuesday since. They are never the same stranger.",
      "(She mouths the words 'I forgive you' to no one. Then she resumes reading.)",
    ],
    closing: 'closes the book carefully, leaves a much-too-large tip in coins, and exits without checking if anyone noticed her.',
  },

  bar: {
    id: 'bar',
    name: 'the bar',
    label: 'espresso bar / barista alone',
    speakers: ['the barista'],
    voice: 'the barista, mid-twenties, not actually talking to anyone but humming and occasionally muttering. they are training a new espresso machine. they sing under their breath. once or twice they answer a customer.',
    fragments: [
      "(quietly, while tamping) okay, baby. show me what you got.",
      "Someone left a paperback here last summer and the same woman comes back every Tuesday like she's waiting for the book.",
      "(humming the same four bars of a song, slightly off-key)",
      "I once put oat milk in a cappuccino for a guy who ordered an Americano and he tipped me forty dollars. I never told him.",
      "(to a customer:) yeah, the Wi-Fi password is 'breakup2017' — long story, don't ask.",
      "I think I'm going to ask out the woman with the green coat. The one who orders the same thing and never sits.",
      "(to the espresso machine:) you and me, we are going to have a long quiet life together.",
      "If you sit at the bar long enough, I will eventually tell you a secret about everyone in this room.",
    ],
    closing: 'wipes the counter the way a piano player closes a fallboard.',
  },
};

/* ---- Seats: each is one of six candidate "open chairs" with a position
   on the floor plan and a proximity map (which tables/sources you can hear
   well, faintly, or barely). The proximity weights condition the fragment
   stream — the seat changes which conversations dominate. ---- */

export const SEATS = {
  s_window: {
    id: 's_window',
    label: 'window seat (front-left)',
    where: 'front-left, by the window. soft afternoon light. a draft.',
    grid: { col: 1, row: 5 },
    proximity: { t1: 0.85, t2: 0.45, t3: 0.10, t4: 0.55, t5: 0.05, bar: 0.30 },
  },
  s_corner: {
    id: 's_corner',
    label: 'back-corner armchair',
    where: 'the back corner. a soft armchair that has eaten coins. you can see the whole room.',
    grid: { col: 5, row: 1 },
    proximity: { t1: 0.40, t2: 0.55, t3: 0.95, t4: 0.30, t5: 0.50, bar: 0.20 },
  },
  s_bar: {
    id: 's_bar',
    label: 'bar stool',
    where: 'the espresso bar. one stool. you can hear the machine breathe.',
    grid: { col: 4, row: 3 },
    proximity: { t1: 0.20, t2: 0.30, t3: 0.20, t4: 0.55, t5: 0.45, bar: 1.00 },
  },
  s_plant: {
    id: 's_plant',
    label: 'two-top by the fiddle-leaf fig',
    where: 'a small two-top half-hidden by a fiddle-leaf fig. you can see almost no one. you can hear everyone.',
    grid: { col: 1, row: 3 },
    proximity: { t1: 0.55, t2: 0.45, t3: 0.20, t4: 0.95, t5: 0.15, bar: 0.40 },
  },
  s_long: {
    id: 's_long',
    label: 'communal long-table seat',
    where: 'the long communal table down the middle. you are next to a stranger who never speaks.',
    grid: { col: 3, row: 2 },
    proximity: { t1: 0.55, t2: 0.65, t3: 0.55, t4: 0.55, t5: 0.55, bar: 0.55 },
  },
  s_quiet: {
    id: 's_quiet',
    label: 'quiet two-top by the back hallway',
    where: 'the back hallway, near the bathrooms. quieter. the world feels distant.',
    grid: { col: 5, row: 4 },
    proximity: { t1: 0.10, t2: 0.20, t3: 0.40, t4: 0.30, t5: 0.95, bar: 0.45 },
  },
};

/* The floor-plan glyphs the seat-picker grid renders. Each cell describes
   what to draw at that (col,row). 'seat:<id>' is rendered as an interactive
   chair tile mapped to SEATS[id]. */
export const FLOOR_GRID = [
  // row 0 — back wall
  ['wall:▤','wall:▤','wall:▤','wall:▤','wall:▤','wall:▤','wall:▤'],
  // row 1 — back wall tables T1, T2, T3
  ['wall:▤','table:1','empty', 'table:2','empty', 'table:3','wall:▤'],
  // row 2 — walking lane + middle
  ['wall:▤','empty', 'empty', 'seat:s_long','empty', 'seat:s_corner','wall:▤'],
  // row 3 — table 4 + bar
  ['wall:▤','seat:s_plant','table:4','bar:▭','seat:s_bar','empty', 'wall:▤'],
  // row 4 — bar continues + table 5
  ['wall:▤','plant:♣','empty', 'bar:▭','empty', 'table:5','wall:▤'],
  // row 5 — door at bottom-left, window seat
  ['wall:▤','seat:s_window','empty', 'empty', 'empty', 'seat:s_quiet','wall:▤'],
];

/* For each table id, an ordered list of "first-name candidates + last-name
   candidates + table label" that the letter signature draws from. The
   signature is deterministic from the seat id + dwell vector hash, so the
   same listening pattern always yields the same name. */
export const NAME_BANK = {
  t1: {
    firsts: ['Marisol', 'Nan', 'Beatrice', 'Helene', 'Greta', 'Ramona', 'Adelaide'],
    lasts:  ['Whitfield', 'Pell', 'Costa', 'Quinn', 'Mendel', 'Ash', 'Brevard'],
    sigSuffix: 'table 1 · the woman in the navy coat',
    selfDescriptor: 'the woman at the window, the one with the navy coat and the soft voice',
  },
  t2: {
    firsts: ['Iris', 'Devon', 'Mara', 'Saoirse', 'Pen', 'Joa', 'Linnea'],
    lasts:  ['Hadley', 'Choi', 'Vance', 'Ortega', 'Flynn', 'Park', 'Levy'],
    sigSuffix: 'table 2 · the freelancer with the cold flat white',
    selfDescriptor: 'the freelancer at table two, the one who said the thing about the calathea',
  },
  t3: {
    firsts: ['Mateo', 'Wyn', 'Owen', 'August', 'Joaquim', 'Theo', 'Roan'],
    lasts:  ['Bellamy', 'Suh', 'Tanaka', 'Drum', 'Pérez', 'Khoury', 'Larsson'],
    sigSuffix: 'table 3 · the man who waited and waited',
    selfDescriptor: 'the man at table three, the one waiting for someone who never came',
  },
  t4: {
    firsts: ['Wren', 'Cal', 'Sully', 'Ines', 'Eli', 'Jules', 'Avery'],
    lasts:  ['Okafor', 'Ross', 'Ji', 'Brevoort', 'Marin', 'Fraser', 'Ahmadi'],
    sigSuffix: 'table 4 · the one who rented the jacket',
    selfDescriptor: 'one of the people at the four-top by the plant — yes, the one who rented the jacket',
  },
  t5: {
    firsts: ['Ottilie', 'Frances', 'Pearl', 'Dolores', 'Margit', 'Rosalind', 'Coraline'],
    lasts:  ['Vargas', 'Fenn', 'Holcomb', 'Beirne', 'Ashby', 'Pell', 'Rourke'],
    sigSuffix: 'table 5 · the woman with the much-read paperback',
    selfDescriptor: 'the woman at the small two-top with the paperback, the one you saw mouth a forgiveness',
  },
  bar: {
    firsts: ['Sage', 'Jules', 'Bram', 'Theo', 'Rio', 'Wren', 'Niko'],
    lasts:  ['the barista', '— at the bar', 'of the espresso machine', 'of cafe halcyon', 'of the back-bar', 'of the morning shift'],
    sigSuffix: 'the bar · the one training the espresso machine',
    selfDescriptor: 'the barista, the one who hummed off-key and tamped like a prayer',
  },
};
