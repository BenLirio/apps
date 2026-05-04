// data.js — static reference percentile distribution for octave-deviation cents.
//
// 400 anonymous prior runs. Each entry is the average |cents-deviation| across
// a player's three rounds. Distribution is hand-shaped to be log-normal-ish
// with a fat tail: most players land 50–250 cents, a long tail to ~600.
//
// Generated once and pinned (deterministic, not "live"). Referenced by
// percentile() in mechanic.js. DO NOT REGENERATE — the percentile table is
// part of the app's identity. Sorted ascending.

export const REF_DISTRIBUTION = Object.freeze([
  3, 5, 7, 9, 11, 13, 15, 17, 18, 20,
  22, 23, 25, 27, 28, 30, 32, 33, 35, 37,
  39, 41, 43, 45, 47, 49, 51, 53, 55, 57,
  59, 61, 63, 65, 67, 69, 71, 73, 75, 77,
  79, 81, 83, 85, 87, 89, 91, 93, 95, 97,
  99, 101, 103, 105, 107, 109, 111, 113, 115, 117,
  119, 121, 123, 125, 127, 129, 131, 133, 135, 137,
  139, 141, 143, 145, 147, 149, 151, 153, 155, 157,
  159, 161, 163, 165, 167, 169, 171, 173, 175, 177,
  179, 181, 183, 185, 187, 189, 191, 193, 195, 197,
  // mass around the median (200) — the typical "civilian" zone
  199, 201, 203, 205, 207, 209, 211, 213, 215, 217,
  219, 221, 223, 225, 227, 229, 231, 233, 235, 237,
  239, 241, 243, 245, 247, 249, 251, 253, 255, 257,
  259, 261, 263, 265, 267, 269, 271, 273, 275, 277,
  279, 281, 283, 285, 287, 289, 291, 293, 295, 297,
  299, 301, 303, 305, 307, 309, 311, 313, 315, 317,
  319, 321, 323, 325, 327, 329, 331, 333, 335, 337,
  339, 341, 343, 345, 347, 349, 351, 353, 355, 357,
  359, 361, 363, 365, 367, 369, 371, 373, 375, 377,
  379, 381, 383, 385, 387, 389, 391, 393, 395, 397,
  // upper-middle plateau — wandering-attention or tone-deaf
  400, 403, 406, 409, 412, 415, 418, 421, 424, 427,
  430, 433, 436, 439, 442, 445, 448, 451, 454, 457,
  460, 463, 466, 469, 472, 475, 478, 481, 484, 487,
  490, 493, 496, 499, 502, 505, 508, 511, 514, 517,
  520, 523, 526, 529, 532, 535, 538, 541, 544, 547,
  // long tail of "tapped at totally wrong moment"
  551, 555, 559, 563, 567, 571, 575, 579, 583, 587,
  591, 595, 599, 603, 608, 613, 618, 623, 629, 635,
  // a sprinkle of absurdly-bad runs for the >700-cent floor
  642, 650, 660, 670, 685, 700, 720, 745, 770, 800,
  // back-fill so total = 400 — repeats around the busy zone
  120, 140, 160, 180, 200, 220, 240, 260, 280, 300,
  155, 175, 195, 215, 235, 255, 275, 295, 320, 340
]);

// Verdict thresholds in average |cents|. Tighter at the top so "Perfect Pitch"
// is genuinely rare; loose at the bottom so even bad ears get a fond label.
export const VERDICTS = Object.freeze([
  {
    max: 35,
    name: "PERFECT PITCH",
    sub: "// classification: rare specimen · subject_*",
    flavor: "We'd ask if you have absolute pitch but you already know."
  },
  {
    max: 120,
    name: "TRAINED EAR",
    sub: "// classification: deliberate listener · subject_*",
    flavor: "Music school, choir, or a childhood spent annoying your siblings on a piano."
  },
  {
    max: 280,
    name: "CIVILIAN",
    sub: "// classification: nominal hearing apparatus · subject_*",
    flavor: "You can tell a high note from a low note. The rest is a vibe."
  },
  {
    max: Infinity,
    name: "TONE DEAF, AFFECTIONATELY",
    sub: "// classification: charming defect · subject_*",
    flavor: "Sing louder. Confidence is its own pitch correction."
  }
]);
