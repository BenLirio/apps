// Ministry of Minor Regrets — bureaucratic-audit calculator.
// One declaration at a time (no scrolling form). A short rotating subset of
// declarations chosen to feel like things that quietly affect your
// health/wellbeing but you don't usually audit yourself for — sunlight,
// hydration timing, the call you didn't make, the laugh you missed, the hug
// you didn't ask for. Fully deterministic — no LLM. Inputs are encoded into
// the URL fragment so shared links re-hydrate the exact receipt.
//
// Every line item is capped at LINE_CAP regret units (0–20) so the per-run
// total fits the standard 100-point bureaucratic scale (5 × 20). Each
// question's compute fn picks a `worstCase` input — the value at which the
// behavior is genuinely bad — and the line score rises linearly from 0
// (at the benchmark) to 20 (at the worst case). The receipt's formula text
// says "maximum penalty applied" when an input exceeds the worst case.

const LINE_CAP = 20;

function capUnits(raw, formula) {
  const r = Math.round(raw);
  if (r > LINE_CAP) return { units: LINE_CAP, formula: 'maximum penalty applied' };
  return { units: Math.max(0, r), formula };
}

// Linearly score `input` between (benchmark → 0 regret) and (worstCase → 20
// regret). worstCase < benchmark is a deficit-direction question (e.g.,
// hugs); worstCase > benchmark is excess-direction (e.g., screens). Inputs
// past the worst case overflow above 20, then capUnits clamps them.
function scoreLinear(input, benchmark, worstCase) {
  if (worstCase < benchmark) {
    if (input >= benchmark) return 0;
    return 20 * (benchmark - input) / (benchmark - worstCase);
  }
  if (input <= benchmark) return 0;
  return 20 * (input - benchmark) / (worstCase - benchmark);
}

// ---------- Ministry benchmarks & per-line metadata ----------

const BENCHMARKS = {
  sun:        { benchmark: 25,    unitLabel: 'min',     code: 'SUN-038', itemName: 'Solar Deficit Citation' },
  called:     { benchmark: 7,     unitLabel: 'days',    code: 'FAM-027', itemName: 'Filial Delay Assessment' },
  water:      { benchmark: 2,     unitLabel: 'hrs',     code: 'HYD-440', itemName: 'Hydration Lapse Penalty' },
  sit:        { benchmark: 60,    unitLabel: 'min',     code: 'POS-510', itemName: 'Sedentary Stretch Surcharge' },
  quiet:      { benchmark: 15,    unitLabel: 'min',     code: 'QTE-303', itemName: 'Unmet Quiet Allotment' },
  bed:        { benchmark: 0,     unitLabel: 'night',   code: 'SLP-309', itemName: 'Bedside Device Encroachment Fee' },
  meal:       { benchmark: 0,     unitLabel: 'meal',    code: 'NUT-180', itemName: 'Distracted Mastication Surcharge' },
  outside:    { benchmark: 1,     unitLabel: 'days',    code: 'OUT-444', itemName: 'Unmediated Air Deficit' },
  laugh:      { benchmark: 5,     unitLabel: 'laugh',   code: 'MTH-211', itemName: 'Mirth Quota Shortfall' },
  hugs:       { benchmark: 4,     unitLabel: 'hug',     code: 'TCH-808', itemName: 'Touch-Quota Shortfall' },
  screens:    { benchmark: 6,     unitLabel: 'hrs',     code: 'SCN-621', itemName: 'Glow-Surface Overrun Surcharge' },
  caffeine:   { benchmark: 3,     unitLabel: 'drink',   code: 'STM-115', itemName: 'Stimulant Excess Citation' },
  ground:     { benchmark: 7,     unitLabel: 'days',    code: 'GRD-401', itemName: 'Unbarefooted-Ground Lapse' },
  compliment: { benchmark: 12,    unitLabel: 'hrs',     code: 'CMP-242', itemName: 'Unspoken Compliment Backlog' },
  thanks:     { benchmark: 5,     unitLabel: 'thanks',  code: 'GRT-091', itemName: 'Gratitude Quota Shortfall' },
  write:      { benchmark: 5,     unitLabel: 'min',     code: 'PEN-330', itemName: 'Manual Inscription Deficit' },
  carry:      { benchmark: 10,    unitLabel: 'min',     code: 'HAU-216', itemName: 'Haulage Allotment Deficit' },
  read:       { benchmark: 10,    unitLabel: 'min',     code: 'PRT-512', itemName: 'Printed-Page Deficit' },
  eyes:       { benchmark: 4,     unitLabel: 'hrs',     code: 'OPT-074', itemName: 'Long-Focus Lapse Penalty' },
  sleep:      { benchmark: 7,     unitLabel: 'hrs',     code: 'SLP-007', itemName: 'Sleep Allotment Deficit' },
  prep:       { benchmark: 15,    unitLabel: 'min',     code: 'CKR-330', itemName: 'Hand-Prepared Meal Deficit' },
  refuse:     { benchmark: 1,     unitLabel: 'refusal', code: 'REF-101', itemName: 'Volitional Refusal Deficit' },
  steps:      { benchmark: 7500,  unitLabel: 'steps',   code: 'AMB-750', itemName: 'Ambulation Quota Shortfall' },
  stairs:     { benchmark: 4,     unitLabel: 'flights', code: 'STR-414', itemName: 'Vertical-Travel Deficit' },
  floss:      { benchmark: 1,     unitLabel: 'days',    code: 'DNT-505', itemName: 'Interdental Maintenance Lapse' },
  lift:       { benchmark: 3,     unitLabel: 'days',    code: 'LFT-303', itemName: 'Load-Bearing Allotment Deficit' },
  morning_sun:{ benchmark: 10,    unitLabel: 'min',     code: 'CRC-101', itemName: 'Circadian Anchor Deficit' },
  phone_first:{ benchmark: 30,    unitLabel: 'min',     code: 'DAW-022', itemName: 'Pre-Cognitive Glow Encroachment' },
  veg:        { benchmark: 3,     unitLabel: 'serving', code: 'VEG-555', itemName: 'Vegetal Quota Shortfall' },
  fruit:      { benchmark: 2,     unitLabel: 'piece',   code: 'FRT-220', itemName: 'Fruitarian Allotment Deficit' },
  processed:  { benchmark: 2,     unitLabel: 'snack',   code: 'UPF-909', itemName: 'Industrial-Snack Surcharge' },
  drinks:     { benchmark: 1,     unitLabel: 'drink',   code: 'ETH-101', itemName: 'Spirituous Surcharge' },
  meal_pace:  { benchmark: 20,    unitLabel: 'min',     code: 'TMP-200', itemName: 'Mealtime Tempo Deficit' },
  breath:     { benchmark: 3,     unitLabel: 'time',    code: 'RSP-505', itemName: 'Respiratory Mindfulness Deficit' },
  awe:        { benchmark: 1,     unitLabel: 'time',    code: 'AWE-101', itemName: 'Wonderment Allotment Deficit' },
  meditate:   { benchmark: 10,    unitLabel: 'min',     code: 'MED-606', itemName: 'Stillness Quota Shortfall' },
  single:     { benchmark: 30,    unitLabel: 'min',     code: 'TSK-101', itemName: 'Mono-Task Allotment Deficit' },
  stranger:   { benchmark: 1,     unitLabel: 'hello',   code: 'WTC-101', itemName: 'Weak-Tie Contact Deficit' },
  face_time:  { benchmark: 30,    unitLabel: 'min',     code: 'DSC-303', itemName: 'In-Person Discourse Deficit' },
  checkin:    { benchmark: 2,     unitLabel: 'days',    code: 'RCH-330', itemName: 'Unprompted-Outreach Lapse' },
  seen_friend:{ benchmark: 7,     unitLabel: 'days',    code: 'FRD-707', itemName: 'Embodied-Friendship Lapse' },
  play:       { benchmark: 15,    unitLabel: 'min',     code: 'PLY-150', itemName: 'Volitional Play Deficit' },
  learn:      { benchmark: 1,     unitLabel: 'thing',   code: 'CUR-101', itemName: 'Curiosity Quota Shortfall' },
  creative:   { benchmark: 15,    unitLabel: 'min',     code: 'CRT-150', itemName: 'Creative-Output Deficit' },
  deep_work:  { benchmark: 60,    unitLabel: 'min',     code: 'ATN-606', itemName: 'Sustained-Attention Deficit' },
  pages:      { benchmark: 10,    unitLabel: 'page',    code: 'PGE-101', itemName: 'Bookbound Page Deficit' },
  forself:    { benchmark: 30,    unitLabel: 'min',     code: 'SLF-303', itemName: 'Self-Stewardship Allotment Deficit' },
  dayoff:     { benchmark: 14,    unitLabel: 'days',    code: 'SAB-141', itemName: 'Sabbath-Equivalent Lapse' },
  askedhelp:  { benchmark: 7,     unitLabel: 'days',    code: 'ASK-077', itemName: 'Unrequested-Assistance Lapse' },
  doomscroll: { benchmark: 10,    unitLabel: 'min',     code: 'DRF-101', itemName: 'Algorithmic-Drift Surcharge' },
};

// ---------- Declaration pool ----------
//
// The full menu of declarations the Ministry tracks. Each run picks
// PER_RUN_STEPS from this pool weighted by community upvotes (see
// `voteWeights`/`pickStepsFromVotes`), so the declarations the user is
// asked to make rotate between sessions and gradually drift toward the
// declarations real users have voted up.

const PER_RUN_STEPS = 5;

const ALL_DECLARATIONS = [
  { key: 'sun',
    label: 'Minutes of direct sunlight on your skin today',
    hint: 'Ministry benchmark: 25 min — circadian & vitamin-D allotment',
    placeholder: 'e.g. 12',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'called',
    label: 'Days since you called someone you love',
    hint: 'Ministry benchmark: 7 days',
    placeholder: 'e.g. 22',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'water',
    label: 'Hours since your last full glass of plain water',
    hint: 'Ministry benchmark: 2 hrs',
    placeholder: 'e.g. 5',
    step: 0.5, min: 0, max: 48, inputmode: 'decimal' },
  { key: 'sit',
    label: 'Longest unbroken stretch sitting today (minutes)',
    hint: 'Ministry benchmark: 60 min — kindly stand up',
    placeholder: 'e.g. 180',
    step: 5, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'quiet',
    label: 'Minutes today in true silence (no music, no podcast, no speech)',
    hint: 'Ministry benchmark: 15 min',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'bed',
    label: "Nights this past week your phone slept within arm's reach",
    hint: 'Ministry benchmark: 0 nights',
    placeholder: 'e.g. 7',
    step: 1, min: 0, max: 7, inputmode: 'numeric' },
  { key: 'meal',
    label: 'Meals today eaten while doing something else (screen, walking, working)',
    hint: 'Ministry benchmark: 0 meals',
    placeholder: 'e.g. 2',
    step: 1, min: 0, max: 20, inputmode: 'numeric' },
  { key: 'outside',
    label: 'Days since you spent 30+ min outside with no earbuds in',
    hint: 'Ministry benchmark: 1 day',
    placeholder: 'e.g. 9',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'laugh',
    label: 'Times today you laughed out loud',
    hint: 'Ministry benchmark: 5 — daily mirth allotment',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'hugs',
    label: 'Hugs given or received today',
    hint: 'Ministry benchmark: 4',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'screens',
    label: 'Hours of total screen time today (phones, laptops, TVs combined)',
    hint: 'Ministry benchmark: 6 hrs — daily glow-surface allotment',
    placeholder: 'e.g. 9',
    step: 0.5, min: 0, max: 24, inputmode: 'decimal' },
  { key: 'caffeine',
    label: 'Caffeinated drinks consumed today',
    hint: 'Ministry benchmark: 3 drinks — daily stimulant allotment',
    placeholder: 'e.g. 5',
    step: 1, min: 0, max: 30, inputmode: 'numeric' },
  { key: 'ground',
    label: 'Days since you walked on grass, sand, or dirt without shoes',
    hint: 'Ministry benchmark: 7 days',
    placeholder: 'e.g. 60',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'compliment',
    label: 'Hours since you complimented someone out loud',
    hint: 'Ministry benchmark: 12 hrs',
    placeholder: 'e.g. 36',
    step: 0.5, min: 0, max: 168, inputmode: 'decimal' },
  { key: 'thanks',
    label: 'Times today you said "thank you" and meant it',
    hint: 'Ministry benchmark: 5 — daily gratitude allotment',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'write',
    label: 'Minutes you spent writing by hand today',
    hint: 'Ministry benchmark: 5 min — daily inscription allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'carry',
    label: 'Minutes today carrying anything heavier than your phone',
    hint: 'Ministry benchmark: 10 min',
    placeholder: 'e.g. 2',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'read',
    label: 'Minutes reading something printed on paper today',
    hint: 'Ministry benchmark: 10 min — printed-page allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'eyes',
    label: 'Hours since you last looked at something across a room or further away',
    hint: 'Ministry benchmark: 4 hrs — long-focus allotment',
    placeholder: 'e.g. 11',
    step: 0.5, min: 0, max: 168, inputmode: 'decimal' },
  { key: 'sleep',
    label: 'Hours of sleep last night',
    hint: 'Ministry benchmark: 7 hrs',
    placeholder: 'e.g. 5',
    step: 0.25, min: 0, max: 24, inputmode: 'decimal' },
  { key: 'prep',
    label: 'Minutes today preparing food with your own hands',
    hint: 'Ministry benchmark: 15 min — hand-prep allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'refuse',
    label: "Times today you declined something you didn't want",
    hint: 'Ministry benchmark: 1 — daily volitional minimum',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'steps',
    label: 'Steps your phone or watch logged today',
    hint: 'Ministry benchmark: 7,500 steps — ambulation allotment',
    placeholder: 'e.g. 3200',
    step: 100, min: 0, max: 100000, inputmode: 'numeric' },
  { key: 'stairs',
    label: 'Flights of stairs you climbed under your own power today',
    hint: 'Ministry benchmark: 4 flights',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 999, inputmode: 'numeric' },
  { key: 'floss',
    label: 'Days since you last flossed',
    hint: 'Ministry benchmark: 1 day',
    placeholder: 'e.g. 5',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'lift',
    label: 'Days since you lifted, pushed, or pulled something genuinely heavy',
    hint: 'Ministry benchmark: 3 days — load-bearing allotment',
    placeholder: 'e.g. 10',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'morning_sun',
    label: 'Minutes of outdoor light within the first hour of waking',
    hint: 'Ministry benchmark: 10 min — circadian-anchor allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 240, inputmode: 'numeric' },
  { key: 'phone_first',
    label: 'Minutes between waking and your first phone check today',
    hint: 'Ministry benchmark: 30 min',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'veg',
    label: 'Servings of vegetables eaten today',
    hint: 'Ministry benchmark: 3 servings',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 30, inputmode: 'numeric' },
  { key: 'fruit',
    label: 'Whole pieces of fruit eaten today',
    hint: 'Ministry benchmark: 2 pieces',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 30, inputmode: 'numeric' },
  { key: 'processed',
    label: 'Ultra-processed snacks eaten today (chips, candy, packaged sweets)',
    hint: 'Ministry benchmark: 2 snacks — industrial-snack allotment',
    placeholder: 'e.g. 4',
    step: 1, min: 0, max: 50, inputmode: 'numeric' },
  { key: 'drinks',
    label: 'Alcoholic drinks consumed last night',
    hint: 'Ministry benchmark: 1 drink — spirituous allotment',
    placeholder: 'e.g. 3',
    step: 1, min: 0, max: 30, inputmode: 'numeric' },
  { key: 'meal_pace',
    label: 'Minutes your last full meal lasted',
    hint: 'Ministry benchmark: 20 min — mealtime tempo',
    placeholder: 'e.g. 8',
    step: 1, min: 0, max: 240, inputmode: 'numeric' },
  { key: 'breath',
    label: 'Times today you took at least 5 slow conscious breaths in a row',
    hint: 'Ministry benchmark: 3',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'awe',
    label: 'Times today you stopped to look at something simply because it was beautiful',
    hint: 'Ministry benchmark: 1 — daily wonderment allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'meditate',
    label: 'Minutes of stillness, prayer, or meditation today',
    hint: 'Ministry benchmark: 10 min',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'single',
    label: 'Minutes today on your longest single-task stretch',
    hint: 'Ministry benchmark: 30 min — mono-task allotment',
    placeholder: 'e.g. 5',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'stranger',
    label: 'Brief friendly exchanges with strangers or near-strangers today (cashier, neighbor, dog walker)',
    hint: 'Ministry benchmark: 1 — daily weak-tie allotment',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'face_time',
    label: 'Minutes today in face-to-face conversation (not on a screen)',
    hint: 'Ministry benchmark: 30 min',
    placeholder: 'e.g. 5',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'checkin',
    label: 'Days since you texted a friend with no agenda',
    hint: 'Ministry benchmark: 2 days',
    placeholder: 'e.g. 9',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'seen_friend',
    label: 'Days since you saw a friend in person',
    hint: 'Ministry benchmark: 7 days',
    placeholder: 'e.g. 21',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'play',
    label: 'Minutes today on something purely playful (no goal, no output)',
    hint: 'Ministry benchmark: 15 min',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'learn',
    label: 'New things you learned today that genuinely surprised you',
    hint: 'Ministry benchmark: 1',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'creative',
    label: 'Minutes today you spent making something with your hands or voice',
    hint: 'Ministry benchmark: 15 min',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'deep_work',
    label: 'Minutes in your longest unbroken stretch on one chosen task today',
    hint: 'Ministry benchmark: 60 min — sustained-attention allotment',
    placeholder: 'e.g. 12',
    step: 5, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'pages',
    label: 'Pages of a book (paper or screen) read today',
    hint: 'Ministry benchmark: 10 pages',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'forself',
    label: 'Minutes today on something purely for you (not work, not chores, not duty)',
    hint: 'Ministry benchmark: 30 min',
    placeholder: 'e.g. 5',
    step: 1, min: 0, max: 1440, inputmode: 'numeric' },
  { key: 'dayoff',
    label: 'Days since you took a true day off (no work, no errands)',
    hint: 'Ministry benchmark: 14 days',
    placeholder: 'e.g. 30',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'askedhelp',
    label: 'Days since you asked another human for help',
    hint: 'Ministry benchmark: 7 days',
    placeholder: 'e.g. 14',
    step: 1, min: 0, max: 9999, inputmode: 'numeric' },
  { key: 'doomscroll',
    label: 'Minutes today scrolling a feed without a goal',
    hint: 'Ministry benchmark: 10 min — algorithmic-drift allotment',
    placeholder: 'e.g. 45',
    step: 5, min: 0, max: 1440, inputmode: 'numeric' },
];

// Look up declaration metadata by `key`. Used by the fragment hydrator and
// when re-binding a fixed-set of declarations on first paint.
const DECLARATION_BY_KEY = {};
for (const d of ALL_DECLARATIONS) DECLARATION_BY_KEY[d.key] = d;

// The PER_RUN_STEPS declarations chosen for THIS run. Set during boot from
// `pickStepsFromVotes(...)` (or restored from a hydrated v=5 fragment).
// Kept as a `let` so boot can reassign before the stepper renders.
let STEPS = ALL_DECLARATIONS.slice(0, PER_RUN_STEPS);

// ---------- Deterministic line-item arithmetic ----------

function computeSun(min) {
  let raw = 0;
  let baseFormula = 'within solar tolerance';
  if (min < 25) {
    raw = scoreLinear(min, 25, 0);
    baseFormula = `${25 - min} min below 25-min daily allotment`;
  } else if (min > 240) {
    raw = Math.min(5, (min - 240) * 0.05);
    baseFormula = `${min - 240} min above 240-min ceiling`;
  }
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'sun', name: BENCHMARKS.sun.itemName, code: BENCHMARKS.sun.code,
    inputText: `${min} min sun`, formula, units };
}

function computeCalled(days) {
  const raw = scoreLinear(days, 7, 50);
  const baseFormula = days > 7
    ? `${days - 7}d past 7-day benchmark`
    : 'filial contact current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'called', name: BENCHMARKS.called.itemName, code: BENCHMARKS.called.code,
    inputText: `${days} day${days === 1 ? '' : 's'} since calling`, formula, units };
}

function computeWater(hrs) {
  const raw = scoreLinear(hrs, 2, 10);
  const baseFormula = hrs > 2
    ? `${stripZeros(hrs - 2)}h past 2-hour reach window`
    : 'hydration current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'water', name: BENCHMARKS.water.itemName, code: BENCHMARKS.water.code,
    inputText: `${stripZeros(hrs)}h since glass`, formula, units };
}

function computeSit(min) {
  const raw = scoreLinear(min, 60, 300);
  const baseFormula = min > 60
    ? `${min - 60} min past 60-min posture allotment`
    : 'posture rotation acceptable';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'sit', name: BENCHMARKS.sit.itemName, code: BENCHMARKS.sit.code,
    inputText: `${min} min unbroken sit`, formula, units };
}

function computeQuiet(min) {
  const raw = scoreLinear(min, 15, 0);
  const baseFormula = min < 15
    ? `${15 - min} min below 15-min daily quiet allotment`
    : 'sufficient ambient quiet logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'quiet', name: BENCHMARKS.quiet.itemName, code: BENCHMARKS.quiet.code,
    inputText: `${min} min silence`, formula, units };
}

function computeBed(nights) {
  const raw = scoreLinear(nights, 0, 7);
  const baseFormula = nights > 0
    ? `${nights} night${nights === 1 ? '' : 's'} phone-at-pillow`
    : 'bedside device-free';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'bed', name: BENCHMARKS.bed.itemName, code: BENCHMARKS.bed.code,
    inputText: `${nights} night${nights === 1 ? '' : 's'} phone-at-pillow`, formula, units };
}

function computeMeal(n) {
  const raw = scoreLinear(n, 0, 3);
  const baseFormula = n > 0
    ? `${n} meal${n === 1 ? '' : 's'} eaten distracted`
    : 'mealtime attention undivided';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'meal', name: BENCHMARKS.meal.itemName, code: BENCHMARKS.meal.code,
    inputText: `${n} distracted meal${n === 1 ? '' : 's'}`, formula, units };
}

function computeOutside(days) {
  const raw = scoreLinear(days, 1, 14);
  const baseFormula = days > 1
    ? `${days - 1}d past 1-day allowance`
    : 'outdoor exposure current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'outside', name: BENCHMARKS.outside.itemName, code: BENCHMARKS.outside.code,
    inputText: `${days} day${days === 1 ? '' : 's'} unmediated air`, formula, units };
}

function computeLaugh(n) {
  const raw = scoreLinear(n, 5, 0);
  const baseFormula = n < 5
    ? `${5 - n} short of 5-laugh daily allotment`
    : 'mirth allotment current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'laugh', name: BENCHMARKS.laugh.itemName, code: BENCHMARKS.laugh.code,
    inputText: `${n} laugh${n === 1 ? '' : 's'}`, formula, units };
}

function computeHugs(n) {
  const raw = scoreLinear(n, 4, 0);
  const baseFormula = n < 4
    ? `${4 - n} short of 4-hug daily allotment`
    : 'tactile quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'hugs', name: BENCHMARKS.hugs.itemName, code: BENCHMARKS.hugs.code,
    inputText: `${n} hug${n === 1 ? '' : 's'}`, formula, units };
}

function computeScreens(hrs) {
  const raw = scoreLinear(hrs, 6, 16);
  const baseFormula = hrs > 6
    ? `${stripZeros(hrs - 6)}h past 6-hr screen allotment`
    : 'screen exposure within tolerance';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'screens', name: BENCHMARKS.screens.itemName, code: BENCHMARKS.screens.code,
    inputText: `${stripZeros(hrs)}h on screens`, formula, units };
}

function computeCaffeine(n) {
  const raw = scoreLinear(n, 3, 8);
  const baseFormula = n > 3
    ? `${n - 3} past 3-cup daily allotment`
    : 'caffeine quota observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'caffeine', name: BENCHMARKS.caffeine.itemName, code: BENCHMARKS.caffeine.code,
    inputText: `${n} caffeinated drink${n === 1 ? '' : 's'}`, formula, units };
}

function computeGround(days) {
  const raw = scoreLinear(days, 7, 90);
  const baseFormula = days > 7
    ? `${days - 7}d past 7-day grounding allowance`
    : 'grounding contact current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'ground', name: BENCHMARKS.ground.itemName, code: BENCHMARKS.ground.code,
    inputText: `${days} day${days === 1 ? '' : 's'} unbarefoot`, formula, units };
}

function computeCompliment(hrs) {
  const raw = scoreLinear(hrs, 12, 48);
  const baseFormula = hrs > 12
    ? `${stripZeros(hrs - 12)}h past 12-hr compliment allotment`
    : 'compliment register current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'compliment', name: BENCHMARKS.compliment.itemName, code: BENCHMARKS.compliment.code,
    inputText: `${stripZeros(hrs)}h since compliment`, formula, units };
}

function computeThanks(n) {
  const raw = scoreLinear(n, 5, 0);
  const baseFormula = n < 5
    ? `${5 - n} short of 5-thanks daily allotment`
    : 'gratitude utterances current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'thanks', name: BENCHMARKS.thanks.itemName, code: BENCHMARKS.thanks.code,
    inputText: `${n} thanks given`, formula, units };
}

function computeWrite(min) {
  const raw = scoreLinear(min, 5, 0);
  const baseFormula = min < 5
    ? `${5 - min} min below 5-min handwriting allotment`
    : 'manual longhand observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'write', name: BENCHMARKS.write.itemName, code: BENCHMARKS.write.code,
    inputText: `${min} min handwritten`, formula, units };
}

function computeCarry(min) {
  const raw = scoreLinear(min, 10, 0);
  const baseFormula = min < 10
    ? `${10 - min} min below 10-min haulage allotment`
    : 'physical haulage logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'carry', name: BENCHMARKS.carry.itemName, code: BENCHMARKS.carry.code,
    inputText: `${min} min carrying`, formula, units };
}

function computeRead(min) {
  const raw = scoreLinear(min, 10, 0);
  const baseFormula = min < 10
    ? `${10 - min} min below 10-min printed-page allotment`
    : 'paper-page reading observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'read', name: BENCHMARKS.read.itemName, code: BENCHMARKS.read.code,
    inputText: `${min} min on paper`, formula, units };
}

function computeEyes(hrs) {
  const raw = scoreLinear(hrs, 4, 16);
  const baseFormula = hrs > 4
    ? `${stripZeros(hrs - 4)}h past 4-hr distance-focus allotment`
    : 'long-focus exposure current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'eyes', name: BENCHMARKS.eyes.itemName, code: BENCHMARKS.eyes.code,
    inputText: `${stripZeros(hrs)}h since long glance`, formula, units };
}

function computeSleep(hrs) {
  const raw = scoreLinear(hrs, 7, 2);
  const baseFormula = hrs < 7
    ? `${stripZeros(7 - hrs)}h below 7-hr sleep allotment`
    : 'sleep allotment satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'sleep', name: BENCHMARKS.sleep.itemName, code: BENCHMARKS.sleep.code,
    inputText: `${stripZeros(hrs)}h slept`, formula, units };
}

function computePrep(min) {
  const raw = scoreLinear(min, 15, 0);
  const baseFormula = min < 15
    ? `${15 - min} min below 15-min hand-prep allotment`
    : 'hand-prepared meal logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'prep', name: BENCHMARKS.prep.itemName, code: BENCHMARKS.prep.code,
    inputText: `${min} min hand-prep`, formula, units };
}

function computeRefuse(n) {
  const raw = scoreLinear(n, 1, 0);
  const baseFormula = n < 1
    ? '0 declined today; minimum is 1 daily refusal'
    : 'volitional refusals exercised';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'refuse', name: BENCHMARKS.refuse.itemName, code: BENCHMARKS.refuse.code,
    inputText: `${n} refusal${n === 1 ? '' : 's'}`, formula, units };
}

function computeSteps(n) {
  const raw = scoreLinear(n, 7500, 0);
  const baseFormula = n < 7500
    ? `${(7500 - n).toLocaleString('en-US')} steps below 7,500 daily allotment`
    : 'ambulation quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'steps', name: BENCHMARKS.steps.itemName, code: BENCHMARKS.steps.code,
    inputText: `${n.toLocaleString('en-US')} steps`, formula, units };
}

function computeStairs(n) {
  const raw = scoreLinear(n, 4, 0);
  const baseFormula = n < 4
    ? `${4 - n} short of 4-flight daily allotment`
    : 'vertical-travel quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'stairs', name: BENCHMARKS.stairs.itemName, code: BENCHMARKS.stairs.code,
    inputText: `${n} flight${n === 1 ? '' : 's'}`, formula, units };
}

function computeFloss(d) {
  const raw = scoreLinear(d, 1, 14);
  const baseFormula = d > 1
    ? `${d - 1}d past 1-day floss allotment`
    : 'interdental maintenance current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'floss', name: BENCHMARKS.floss.itemName, code: BENCHMARKS.floss.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since flossing`, formula, units };
}

function computeLift(d) {
  const raw = scoreLinear(d, 3, 30);
  const baseFormula = d > 3
    ? `${d - 3}d past 3-day load-bearing allowance`
    : 'load-bearing observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'lift', name: BENCHMARKS.lift.itemName, code: BENCHMARKS.lift.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since lifting`, formula, units };
}

function computeMorningSun(min) {
  const raw = scoreLinear(min, 10, 0);
  const baseFormula = min < 10
    ? `${10 - min} min below 10-min circadian-anchor allotment`
    : 'circadian anchor secured';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'morning_sun', name: BENCHMARKS.morning_sun.itemName, code: BENCHMARKS.morning_sun.code,
    inputText: `${min} min morning light`, formula, units };
}

function computePhoneFirst(min) {
  const raw = scoreLinear(min, 30, 0);
  const baseFormula = min < 30
    ? `${30 - min} min below 30-min wake-buffer allotment`
    : 'pre-cognitive buffer observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'phone_first', name: BENCHMARKS.phone_first.itemName, code: BENCHMARKS.phone_first.code,
    inputText: `${min} min before first phone check`, formula, units };
}

function computeVeg(n) {
  const raw = scoreLinear(n, 3, 0);
  const baseFormula = n < 3
    ? `${3 - n} short of 3-serving vegetable allotment`
    : 'vegetal quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'veg', name: BENCHMARKS.veg.itemName, code: BENCHMARKS.veg.code,
    inputText: `${n} vegetable serving${n === 1 ? '' : 's'}`, formula, units };
}

function computeFruit(n) {
  const raw = scoreLinear(n, 2, 0);
  const baseFormula = n < 2
    ? `${2 - n} short of 2-piece fruit allotment`
    : 'fruit allotment satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'fruit', name: BENCHMARKS.fruit.itemName, code: BENCHMARKS.fruit.code,
    inputText: `${n} piece${n === 1 ? '' : 's'} of fruit`, formula, units };
}

function computeProcessed(n) {
  const raw = scoreLinear(n, 2, 10);
  const baseFormula = n > 2
    ? `${n - 2} past 2-snack daily allotment`
    : 'industrial-snack tolerance observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'processed', name: BENCHMARKS.processed.itemName, code: BENCHMARKS.processed.code,
    inputText: `${n} ultra-processed snack${n === 1 ? '' : 's'}`, formula, units };
}

function computeDrinks(n) {
  const raw = scoreLinear(n, 1, 6);
  const baseFormula = n > 1
    ? `${n - 1} past 1-drink allotment`
    : 'spirituous tolerance observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'drinks', name: BENCHMARKS.drinks.itemName, code: BENCHMARKS.drinks.code,
    inputText: `${n} drink${n === 1 ? '' : 's'} last night`, formula, units };
}

function computeMealPace(min) {
  const raw = scoreLinear(min, 20, 0);
  const baseFormula = min < 20
    ? `${20 - min} min below 20-min mealtime allotment`
    : 'mealtime tempo observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'meal_pace', name: BENCHMARKS.meal_pace.itemName, code: BENCHMARKS.meal_pace.code,
    inputText: `${min} min last meal`, formula, units };
}

function computeBreath(n) {
  const raw = scoreLinear(n, 3, 0);
  const baseFormula = n < 3
    ? `${3 - n} short of 3 daily conscious-breath sessions`
    : 'respiratory mindfulness observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'breath', name: BENCHMARKS.breath.itemName, code: BENCHMARKS.breath.code,
    inputText: `${n} breath session${n === 1 ? '' : 's'}`, formula, units };
}

function computeAwe(n) {
  const raw = scoreLinear(n, 1, 0);
  const baseFormula = n < 1
    ? '0 wonderments declared; minimum is 1 daily'
    : 'wonderment quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'awe', name: BENCHMARKS.awe.itemName, code: BENCHMARKS.awe.code,
    inputText: `${n} wonderment${n === 1 ? '' : 's'}`, formula, units };
}

function computeMeditate(min) {
  const raw = scoreLinear(min, 10, 0);
  const baseFormula = min < 10
    ? `${10 - min} min below 10-min stillness allotment`
    : 'stillness allotment satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'meditate', name: BENCHMARKS.meditate.itemName, code: BENCHMARKS.meditate.code,
    inputText: `${min} min stillness`, formula, units };
}

function computeSingle(min) {
  const raw = scoreLinear(min, 30, 0);
  const baseFormula = min < 30
    ? `${30 - min} min below 30-min mono-task allotment`
    : 'mono-task allotment observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'single', name: BENCHMARKS.single.itemName, code: BENCHMARKS.single.code,
    inputText: `${min} min single-tasked`, formula, units };
}

function computeStranger(n) {
  const raw = scoreLinear(n, 1, 0);
  const baseFormula = n < 1
    ? '0 weak-tie hellos exchanged; minimum is 1 daily'
    : 'weak-tie contact registered';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'stranger', name: BENCHMARKS.stranger.itemName, code: BENCHMARKS.stranger.code,
    inputText: `${n} weak-tie hello${n === 1 ? '' : 's'}`, formula, units };
}

function computeFaceTime(min) {
  const raw = scoreLinear(min, 30, 0);
  const baseFormula = min < 30
    ? `${30 - min} min below 30-min in-person allotment`
    : 'in-person discourse observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'face_time', name: BENCHMARKS.face_time.itemName, code: BENCHMARKS.face_time.code,
    inputText: `${min} min face-to-face`, formula, units };
}

function computeCheckin(d) {
  const raw = scoreLinear(d, 2, 14);
  const baseFormula = d > 2
    ? `${d - 2}d past 2-day outreach allotment`
    : 'outreach current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'checkin', name: BENCHMARKS.checkin.itemName, code: BENCHMARKS.checkin.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since unprompted text`, formula, units };
}

function computeSeenFriend(d) {
  const raw = scoreLinear(d, 7, 45);
  const baseFormula = d > 7
    ? `${d - 7}d past 7-day in-person allowance`
    : 'embodied friendship current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'seen_friend', name: BENCHMARKS.seen_friend.itemName, code: BENCHMARKS.seen_friend.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since seeing a friend`, formula, units };
}

function computePlay(min) {
  const raw = scoreLinear(min, 15, 0);
  const baseFormula = min < 15
    ? `${15 - min} min below 15-min play allotment`
    : 'play allotment observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'play', name: BENCHMARKS.play.itemName, code: BENCHMARKS.play.code,
    inputText: `${min} min playful`, formula, units };
}

function computeLearn(n) {
  const raw = scoreLinear(n, 1, 0);
  const baseFormula = n < 1
    ? '0 surprises declared; minimum is 1 daily'
    : 'curiosity quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'learn', name: BENCHMARKS.learn.itemName, code: BENCHMARKS.learn.code,
    inputText: `${n} new thing${n === 1 ? '' : 's'} learned`, formula, units };
}

function computeCreative(min) {
  const raw = scoreLinear(min, 15, 0);
  const baseFormula = min < 15
    ? `${15 - min} min below 15-min making allotment`
    : 'creative output observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'creative', name: BENCHMARKS.creative.itemName, code: BENCHMARKS.creative.code,
    inputText: `${min} min making`, formula, units };
}

function computeDeepWork(min) {
  const raw = scoreLinear(min, 60, 0);
  const baseFormula = min < 60
    ? `${60 - min} min below 60-min sustained-attention allotment`
    : 'sustained-attention allotment observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'deep_work', name: BENCHMARKS.deep_work.itemName, code: BENCHMARKS.deep_work.code,
    inputText: `${min} min unbroken focus`, formula, units };
}

function computePages(n) {
  const raw = scoreLinear(n, 10, 0);
  const baseFormula = n < 10
    ? `${10 - n} short of 10-page reading allotment`
    : 'page-turning observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'pages', name: BENCHMARKS.pages.itemName, code: BENCHMARKS.pages.code,
    inputText: `${n} page${n === 1 ? '' : 's'} read`, formula, units };
}

function computeForself(min) {
  const raw = scoreLinear(min, 30, 0);
  const baseFormula = min < 30
    ? `${30 - min} min below 30-min self-stewardship allotment`
    : 'self-stewardship allotment observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'forself', name: BENCHMARKS.forself.itemName, code: BENCHMARKS.forself.code,
    inputText: `${min} min for yourself`, formula, units };
}

function computeDayoff(d) {
  const raw = scoreLinear(d, 14, 60);
  const baseFormula = d > 14
    ? `${d - 14}d past 14-day day-off allowance`
    : 'rest allotment honored';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'dayoff', name: BENCHMARKS.dayoff.itemName, code: BENCHMARKS.dayoff.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since day off`, formula, units };
}

function computeAskedhelp(d) {
  const raw = scoreLinear(d, 7, 60);
  const baseFormula = d > 7
    ? `${d - 7}d past 7-day help-request allowance`
    : 'request for assistance observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'askedhelp', name: BENCHMARKS.askedhelp.itemName, code: BENCHMARKS.askedhelp.code,
    inputText: `${d} day${d === 1 ? '' : 's'} since asking for help`, formula, units };
}

function computeDoomscroll(min) {
  const raw = scoreLinear(min, 10, 90);
  const baseFormula = min > 10
    ? `${min - 10} min past 10-min algorithmic-drift allotment`
    : 'feed exposure within tolerance';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'doomscroll', name: BENCHMARKS.doomscroll.itemName, code: BENCHMARKS.doomscroll.code,
    inputText: `${min} min on feeds`, formula, units };
}

const FIELD_COMPUTE = {
  sun:         computeSun,
  called:      computeCalled,
  water:       computeWater,
  sit:         computeSit,
  quiet:       computeQuiet,
  bed:         computeBed,
  meal:        computeMeal,
  outside:     computeOutside,
  laugh:       computeLaugh,
  hugs:        computeHugs,
  screens:     computeScreens,
  caffeine:    computeCaffeine,
  ground:      computeGround,
  compliment:  computeCompliment,
  thanks:      computeThanks,
  write:       computeWrite,
  carry:       computeCarry,
  read:        computeRead,
  eyes:        computeEyes,
  sleep:       computeSleep,
  prep:        computePrep,
  refuse:      computeRefuse,
  steps:       computeSteps,
  stairs:      computeStairs,
  floss:       computeFloss,
  lift:        computeLift,
  morning_sun: computeMorningSun,
  phone_first: computePhoneFirst,
  veg:         computeVeg,
  fruit:       computeFruit,
  processed:   computeProcessed,
  drinks:      computeDrinks,
  meal_pace:   computeMealPace,
  breath:      computeBreath,
  awe:         computeAwe,
  meditate:    computeMeditate,
  single:      computeSingle,
  stranger:    computeStranger,
  face_time:   computeFaceTime,
  checkin:     computeCheckin,
  seen_friend: computeSeenFriend,
  play:        computePlay,
  learn:       computeLearn,
  creative:    computeCreative,
  deep_work:   computeDeepWork,
  pages:       computePages,
  forself:     computeForself,
  dayoff:      computeDayoff,
  askedhelp:   computeAskedhelp,
  doomscroll:  computeDoomscroll,
};

function computeAll(inputs) {
  return STEPS.map(s => FIELD_COMPUTE[s.key](inputs[s.key]));
}

function stripZeros(n) {
  return Number(n.toFixed(2)).toString();
}

// ---------- Deterministic archetype from the input pattern ----------

function pickArchetype(items) {
  const sorted = [...items].sort((a, b) => b.units - a.units);
  const total = items.reduce((s, x) => s + x.units, 0);
  const top = sorted[0];

  if (total < 60) {
    return {
      name: 'The Exemplary Citizen of Tuesday Nights',
      stampLine: 'ASSESSED: COMMENDATION ISSUED',
      heaviest: top,
    };
  }

  const second = sorted[1];
  const pair = [top.key, second.key].sort().join('+');

  const ARCHETYPES = {
    sun: [
      'The Pale Cartographer of the Inner Office',
      'The Reluctant Subject of the Lampshade Sun',
      'The Vitamin-D Refugee of Sub-Basement 4',
    ],
    called: [
      "The Estranged Attaché of Somebody Else's Landline",
      'The Distant Nephew of a Neglected Rotary',
      'The Reluctant Correspondent to Mothers Everywhere',
    ],
    water: [
      'The Parched Notary of the Desk Drawer',
      'The Salted Clerk of the Late Afternoon',
      'The Dried-Throat Diplomat of the Standing Pitcher',
    ],
    sit: [
      'The Petrified Archivist of the Adjustable Chair',
      'The Stationary Envoy of Hour Three',
      'The Calcified Steward of the Lumbar Cushion',
    ],
    quiet: [
      'The Sound-Saturated Magistrate of the Always-On Headphone',
      'The Unsoothed Custodian of the Background Hum',
      'The Audio Refugee of the Permanent Podcast',
    ],
    bed: [
      'The Bedside Vigil-Keeper of the Sleeping Phone',
      'The Pillow-Adjacent Sentry of the Notification Glow',
      'The Nocturnal Diplomat to a Charging Cable',
    ],
    meal: [
      'The Multitasking Mastication Specialist',
      'The Inattentive Diner of the Lit Screen',
      'The Distracted Forkkeeper of the Lunchtime Tab',
    ],
    outside: [
      'The Soundproofed Pilgrim of the Sidewalk',
      'The Earbudded Observer of the Untouched Park',
      'The Indoor Plant of Sub-Basement 4',
    ],
    laugh: [
      'The Mirth-Deficient Magistrate of the Long Tuesday',
      'The Unsmiling Notary of the Conference Room',
      'The Solemn Custodian of the Unlaughing Hour',
    ],
    hugs: [
      'The Touch-Starved Undersecretary of the Side Hug',
      'The Embrace-Deficient Magistrate of Tuesday',
      'The Tactile Refugee of the Remote Office',
    ],
    screens: [
      'The Glow-Bound Overseer of the Endless Tab',
      'The Backlit Notary of the 11-Hour Display',
      'The Pixel-Drenched Steward of the Browser Forest',
    ],
    caffeine: [
      'The Over-Stimulated Magistrate of the Fourth Cup',
      'The Tachycardiac Undersecretary of the Espresso Window',
      'The Jittery Custodian of the Adjacent Mug',
    ],
    ground: [
      'The Well-Soled Pilgrim of the Treated Floor',
      'The Footwear-Bound Steward of the Concrete Apron',
      'The Unbarefooted Diplomat of the Carpeted Era',
    ],
    compliment: [
      'The Thrifty Custodian of the Unspoken Kindness',
      'The Reluctant Compliments Clerk of the Side Office',
      'The Tight-Lipped Notary of the Withheld Approval',
    ],
    thanks: [
      'The Distracted Notary of the Unutterred Thanks',
      'The Brisk Magistrate of the Unsaid Gratitude',
      'The Hurry-Stricken Diplomat of the Quiet Door',
    ],
    write: [
      'The Pen-Forsaken Steward of the Empty Notebook',
      'The Typed Custodian of the Stilled Hand',
      'The Cursive-Refugee of the All-Caps Reply',
    ],
    carry: [
      'The Featherweight Diplomat of the Unloaded Hour',
      'The Burden-Free Magistrate of the Skipped Errand',
      'The Idle-Limbed Custodian of the Empty Forearm',
    ],
    read: [
      'The Unbookmarked Pilgrim of the Glowing Feed',
      'The Page-Forsaken Notary of the Spineless Day',
      'The Margin-Free Steward of the Scroll-Long Tuesday',
    ],
    eyes: [
      'The Near-Focus Magistrate of the Adjacent Wall',
      'The Unwidened Steward of the Two-Foot Horizon',
      'The Strained-Pupil Custodian of the Close-Range Hour',
    ],
    sleep: [
      'The Bleary Steward of the Five-Hour Night',
      'The Under-Rested Magistrate of the Early Alarm',
      'The Yawn-Hardened Custodian of the Late Reply',
    ],
    prep: [
      'The Microwave-Inclined Diner of the Pre-Packaged Hour',
      'The Knife-Avoidant Steward of the Unsliced Onion',
      'The Hands-Free Magistrate of the Heated Carton',
    ],
    refuse: [
      'The Yes-Saying Magistrate of the Crowded Calendar',
      'The Over-Committed Diplomat of the Reluctant Sigh',
      'The Compliant Notary of the Unrefused Request',
    ],
    steps: [
      'The Sedentary Notary of the Adjacent Carpet',
      'The Stationary Pilgrim of the Door-to-Desk Commute',
      'The Step-Counter Refugee of the Three-Hundred Block',
    ],
    stairs: [
      'The Elevator-Bound Magistrate of the Single Floor',
      'The Vertical-Avoidant Custodian of the Ground Tier',
      'The Escalator-Reliant Diplomat of the Lobby',
    ],
    floss: [
      'The Thread-Forsaken Steward of the Back Molar',
      'The Interdental Refugee of the Once-a-Week Reminder',
      'The Dental Diplomat to a Lonely Floss Pick',
    ],
    lift: [
      'The Resistance-Free Steward of the Unloaded Hour',
      'The Sarcopenia-Adjacent Notary of the Empty Gym Bag',
      'The Muscle-Forsaken Custodian of the Cushioned Chair',
    ],
    morning_sun: [
      'The Dawn-Avoidant Custodian of the Closed Blind',
      'The Sunless Magistrate of the Late Wake',
      'The Pale Notary of the Pre-Coffee Hour',
    ],
    phone_first: [
      'The Pre-Coffee Refresh-Tapper of the Bedside Glow',
      'The Inbox-Bound Diplomat of the First Conscious Minute',
      'The Glow-Greeted Magistrate of the Unrisen Sun',
    ],
    veg: [
      'The Salad-Forsaken Steward of the Beige Plate',
      'The Greens-Avoidant Notary of the Lunchtime Tray',
      'The Vegetable Refugee of the Convenience Aisle',
    ],
    fruit: [
      'The Fruit-Avoidant Custodian of the Empty Bowl',
      'The Apple-Forsaken Diplomat of the Snack Drawer',
      'The Pectin-Deficient Magistrate of the Beige Day',
    ],
    processed: [
      'The Foil-Packet Notary of the Late-Afternoon Vending',
      'The Snack-Saturated Diplomat of the Office Drawer',
      'The Industrially-Inclined Custodian of the Crinkly Wrapper',
    ],
    drinks: [
      'The Spirits-Saturated Magistrate of the Tuesday Pour',
      'The Glass-Reaching Notary of the One More Round',
      'The Cork-Pulling Diplomat of the After-Work Window',
    ],
    meal_pace: [
      'The Hasty Forkkeeper of the Five-Minute Lunch',
      'The Inhaled-Calorie Magistrate of the Standing Meal',
      'The Tempo-Stricken Diplomat of the Working Bowl',
    ],
    breath: [
      'The Shallow-Inhalation Magistrate of the Held-In Sigh',
      'The Autopilot Custodian of the Unconscious Lung',
      'The Breath-Forgetting Steward of the Tense Shoulder',
    ],
    awe: [
      'The Wonder-Forsaken Magistrate of the Unraised Eye',
      'The Sky-Avoidant Notary of the Phone-First Walk',
      'The Marvel-Deficient Custodian of the Standard Tuesday',
    ],
    meditate: [
      'The Stillness-Forsaken Magistrate of the Always-Buzzing Mind',
      'The Cushion-Avoidant Notary of the Restless Hour',
      'The Quiet-Hour Refugee of the Open Tab',
    ],
    single: [
      'The Many-Tabbed Magistrate of the Sliced Attention',
      'The Multi-Channel Diplomat of the Adjacent Notification',
      'The Fragment-Stricken Custodian of the Half-Started Hour',
    ],
    stranger: [
      'The Hood-Pulled Pilgrim of the Wordless Errand',
      'The Earbudded Custodian of the Silent Cashier',
      'The Eye-Avoidant Diplomat of the Shared Sidewalk',
    ],
    face_time: [
      'The Screen-Mediated Magistrate of the Glowing Conversation',
      'The In-Person Refugee of the Telephone Era',
      'The Pixel-Bound Diplomat of the Paragraph Reply',
    ],
    checkin: [
      'The Unprompted-Outreach Notary of the Quiet Inbox',
      'The Hello-Forsaken Custodian of the Last-Read Receipt',
      'The Backlog Diplomat of Unsent Affection',
    ],
    seen_friend: [
      'The In-Person Pilgrim of the Postponed Coffee',
      'The Calendar-Avoidant Magistrate of the Friendly Plan',
      'The Embodiment-Refugee of the Group Chat',
    ],
    play: [
      'The Goal-Bound Magistrate of the Unwasted Minute',
      'The Productivity-Saturated Custodian of the Optimized Tuesday',
      'The Frivolity-Avoidant Diplomat of the Scheduled Hour',
    ],
    learn: [
      'The Unsurprised Magistrate of the Familiar Tuesday',
      'The Curiosity-Forsaken Notary of the Settled Opinion',
      'The Information-Saturated Custodian of the Already-Known',
    ],
    creative: [
      'The Output-Forsaken Magistrate of the Empty Hand',
      'The Make-Avoidant Custodian of the Idle Implement',
      'The Consumption-Bound Diplomat of the Watched Tab',
    ],
    deep_work: [
      'The Five-Minute Magistrate of the Sliced Hour',
      'The Notification-Bound Custodian of the Half-Begun Task',
      'The Tab-Switching Diplomat of the Unfinished Page',
    ],
    pages: [
      'The Page-Forsaken Pilgrim of the Spineless Day',
      'The Bookmark-Bound Magistrate of the Frozen Chapter',
      'The Volume-Avoidant Custodian of the Half-Read Stack',
    ],
    forself: [
      'The Self-Forsaken Magistrate of the Other-Bound Tuesday',
      'The Allotment-Skipping Custodian of the Borrowed Hour',
      'The Self-Stewardship Refugee of the Pleased Calendar',
    ],
    dayoff: [
      'The Sabbath-Forsaken Magistrate of the Eternal Tuesday',
      'The Day-Off-Avoidant Custodian of the Continuous Inbox',
      'The Rest-Refugee of the Overstuffed Calendar',
    ],
    askedhelp: [
      'The Self-Sufficient Magistrate of the Silent Question',
      'The Help-Forsaken Custodian of the Solo Lift',
      'The Aid-Avoidant Diplomat of the Quiet Struggle',
    ],
    doomscroll: [
      'The Algorithmically-Anchored Magistrate of the Glowing Feed',
      'The Scroll-Bound Custodian of the Bottomless Tab',
      'The Feed-Saturated Diplomat of the Lost Half-Hour',
    ],
  };

  const PAIR_OVERRIDES = {
    'called+hugs':    'The Estranged Embrace-Keeper of an Unmade Phone Call',
    'sit+sun':        'The Petrified Pale Magistrate of the Inner Window',
    'bed+laugh':      'The Unsmiling Bedside Sentry of the Notification Glow',
    'outside+quiet':  'The Indoor Plant of the Always-On Soundtrack',
    'meal+sit':       'The Stationary Diner of the Lit Lunchtime Screen',
    'laugh+water':    'The Parched, Solemn Clerk of the Late Memo',
    'called+outside': 'The Estranged Indoor Diplomat of the Long Silence',
    'hugs+quiet':     'The Touch-Starved Audio Refugee of the Always-On Headphone',
    'laugh+sit':      'The Unsmiling Stationary Steward of the Forgotten Posture',
    'sun+water':      'The Pale, Parched Cartographer of the Inner Office',
    'bed+meal':       'The Bedside Diner of the Glowing Late Snack',
    'hugs+outside':   'The Touch-Starved Indoor Observer of the Untouched Park',
    'called+meal':    'The Distracted Forkkeeper of an Unmade Phone Call',
    'sun+outside':    'The Pale Indoor Plant of Sub-Basement 4',
    'hugs+laugh':     'The Unembraced Magistrate of the Joyless Tuesday',
    'called+laugh':   'The Estranged Notary of an Unringing Phone',
  };

  if (PAIR_OVERRIDES[pair] && top.units > 0 && second.units > 0) {
    return {
      name: PAIR_OVERRIDES[pair],
      stampLine: 'ASSESSED: PENALTIES APPLIED',
      heaviest: top,
    };
  }

  const magnitude = Math.abs(Math.round(top.units)) % 3;
  const name = (ARCHETYPES[top.key] || ARCHETYPES.sun)[magnitude];

  return {
    name,
    stampLine: 'ASSESSED: PENALTIES APPLIED',
    heaviest: top,
  };
}

// ---------- URL fragment encode/decode ----------
// v=5 schema: per-run rotation means the declarations differ between
// sessions, so the fragment encodes both WHICH declarations were asked and
// the user's values. Format:
//   v=5
//   ids=<comma-separated declaration keys, in order asked>
//   vals=<comma-separated numeric values, parallel to ids>
// Older fragments (v=4 fixed-keys schema) fall through and the user starts
// a fresh declaration. Older v=5 fragments may include a `sig=` param from
// the LLM-era; it's silently ignored — the signature is recomputed
// deterministically from the heaviest line item.

function encodeFragment(declarations, inputs) {
  const p = new URLSearchParams();
  p.set('v', '5');
  p.set('ids', declarations.map(d => d.key).join(','));
  p.set('vals', declarations.map(d => String(inputs[d.key])).join(','));
  return p.toString();
}

function decodeFragment(frag) {
  if (!frag || frag.length < 2) return null;
  const raw = frag.startsWith('#') ? frag.slice(1) : frag;
  const p = new URLSearchParams(raw);
  if (p.get('v') !== '5') return null;
  const ids = (p.get('ids') || '').split(',').filter(Boolean);
  const vals = (p.get('vals') || '').split(',');
  if (ids.length !== vals.length || ids.length === 0) return null;
  const declarations = [];
  const inputs = {};
  for (let i = 0; i < ids.length; i++) {
    const d = DECLARATION_BY_KEY[ids[i]];
    if (!d) return null;
    const n = Number(vals[i]);
    if (!Number.isFinite(n)) return null;
    declarations.push(d);
    inputs[d.key] = n;
  }
  return { declarations, inputs };
}

// ---------- Deterministic signatures (one per heaviest-line key) ----------

const SIGNATURES = {
  sun:         'A small portion of light has been requisitioned in your name today, and the Ministry has filed the deficit on parchment.',
  called:      'Somewhere a phone rings in a kitchen you used to know the smell of, and nobody has logged the silence.',
  water:       'The Ministry observed your throat and finds it dry; a memo to the kitchen has been issued in triplicate.',
  sit:         'The chair has begun to mistake you for furniture, and the Ministry will not contradict the chair.',
  quiet:       'The Ministry has registered a backlog of unmet quiet, and recommends one (1) unaccompanied minute before bed.',
  bed:         'Your phone slept beside you again, and now both of you are tired in slightly different ways.',
  meal:        'A meal occurred, the Ministry confirms, but no one in the room can describe the flavor.',
  outside:     'The doorway has filed a missing-person report on your behalf; please respond to the open air at your earliest.',
  laugh:       'The mirth ledger remained shamefully thin today, and the Ministry has noted each unthrown laugh against the daily allotment.',
  hugs:        'A small backlog of unembraced hellos has accumulated; the Ministry recommends gentle correction.',
  screens:     'A great deal of light has crossed your face today and very little of it was the sun; the Ministry has noted the discrepancy.',
  caffeine:    'Your bloodstream submits a request for a moment of stillness; the Ministry has forwarded it to the appropriate desk.',
  ground:      'The earth files a polite reminder that it is still down there, and remains willing to be stood upon at your convenience.',
  compliment:  'A compliment, fully drafted, sits unsent in the outbox of your throat; the Ministry recommends transmission before close of business.',
  thanks:      'Several quiet thanks went unspoken today, and the Ministry has logged each one against the daily allotment.',
  write:       'A pen, somewhere on your desk, awaits its formal commission; the Ministry believes its appointment is overdue.',
  carry:       'You moved nothing of consequence today, and the Ministry observes that the world remained in roughly the same place.',
  read:        'A page of plain paper has not turned beneath your hand in some time; the Ministry has been keeping count.',
  eyes:        'Your gaze has settled at arm’s length for the better part of the day; the Ministry suggests a horizon, gently.',
  sleep:       'Sleep was rationed last night and the Ministry has filed a complaint on your behalf with the appropriate hour.',
  prep:        'No food passed under your own knife today, and the Ministry has discreetly noted the absence of crumbs.',
  refuse:      'You declined nothing today, and the Ministry observes that the calendar therefore continues to fill.',
  steps:       'The Ministry’s pedometer rounded down on your behalf today; a memo has been issued reminding you that legs are, in principle, ambulatory.',
  stairs:      'You have moved chiefly on the horizontal plane today; the Ministry observes that vertical travel remains, technically, an option.',
  floss:       'A small diplomatic incident has been brewing in the back molars; the Ministry recommends a thread-based intervention before nightfall.',
  lift:        'You moved nothing of muscular consequence today, and the Ministry notes that the world remained where you left it.',
  morning_sun: 'The dawn was conducted without you; the Ministry has filed a polite suggestion that tomorrow you arrive in person.',
  phone_first: 'The first cognitive transmission of your day arrived from a glowing rectangle, and the Ministry has noted the priority order.',
  veg:         'No green of consequence has crossed your plate today, and the Ministry has discreetly logged the leafy absence.',
  fruit:       'The fruit register remains unmoved today, and the Ministry awaits the arrival of an apple, a banana, or a representative thereof.',
  processed:   'A small fleet of foil packets passed through you today, and the Ministry has noted the industrial provenance of each.',
  drinks:      'Last night you toasted in excess of the Ministry-approved allotment, and a gentle reminder has been forwarded to your liver.',
  meal_pace:   'Your last meal concluded with unseemly haste, and the Ministry has filed a note recommending a more deliberate fork.',
  breath:      'Your respiratory practice was conducted on autopilot today; the Ministry suggests a deliberate inhalation before close of business.',
  awe:         'Nothing struck you as quietly miraculous today, and the Ministry has filed the wonderment quota in arrears.',
  meditate:    'No registered stillness was logged today, and the Ministry’s quiet-hours register remains, regrettably, blank.',
  single:      'Your attention was sliced rather thin today, and the Ministry has declined to certify any uninterrupted minute.',
  stranger:    'No casual hellos were exchanged with the world at large today, and the Ministry has noted the conspicuous social silence.',
  face_time:   'Today’s conversations were conducted exclusively through screens, and the Ministry has formally registered the absence of vowels in shared air.',
  checkin:     'A small constellation of friends remains untexted, and the Ministry has logged each unsent hello in good standing.',
  seen_friend: 'You have not occupied the same room as a friend in some time, and the Ministry has been keeping a respectful tally.',
  play:        'No purposeless minutes were declared today, and the Ministry has noted the absence of any activity undertaken for its own sake.',
  learn:       'No new information of consequence was acquired today, and the Ministry has filed the curiosity quota in arrears.',
  creative:    'Nothing was made by your hand today, and the Ministry observes the surrounding silence of unbuilt things.',
  deep_work:   'Your attention was rented in five-minute increments to several tabs, and the Ministry has declined to consolidate.',
  pages:       'Few pages were turned today under your supervision, and the Ministry has logged the unread chapters in a sealed envelope.',
  forself:     'No portion of the day was reserved exclusively for your own person, and the Ministry has filed the omission with sympathy.',
  dayoff:      'No genuine day of rest has been observed in some while, and the Ministry recommends one (1) before the next equinox.',
  askedhelp:   'You have transacted today entirely under your own steam; the Ministry has noted the conspicuous absence of any request for assistance.',
  doomscroll:  'A great deal of feed was consumed today, and the Ministry confirms that none of it was, in any meaningful sense, nourishing.',
};

function buildSignature(heaviest) {
  return SIGNATURES[heaviest.key]
    || 'Your regrets have been quantified and filed in good standing. Kindly return tomorrow.';
}

// ---------- Loading messages ----------

const LOADING_MSGS = [
  'sharpening the regret pencil...',
  'stamping in triplicate...',
  'locating the correct form...',
  'routing your file to Sub-Basement 4...',
  'consulting the schedule of minor offenses...',
  'inking the fiscal seal...',
  'shuffling carbon copies...',
  'waking the night clerk...',
];

function pickLoadingMsg(seed) {
  const h = hashStr(String(seed || Date.now()));
  return LOADING_MSGS[h % LOADING_MSGS.length];
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------- Community vote signal (declaration popularity) ----------
//
// We piggy-back on the shared `distribution` lambda (a slug-keyed bin
// counter) under TWO slugs — one for upvotes ("recommend"), one for
// downvotes ("dumb question"). Each declaration index maps to a unique
// 5-ms bin (idx * 5) within each slug, well inside the proxy's [0, 10000]
// ms range and 5-ms bin width. POSTing a vote increments that bin; GET
// returns all bins, which we read back into `voteCounts` / `downCounts`
// keyed by declaration key.
//
// Selection at boot draws PER_RUN_STEPS declarations weighted by
// max(0.25, 1 + upvotes - downvotes). The 0.25 floor keeps a heavily
// downvoted question rare but not extinct (so re-votes can still pull it
// back), while still letting the community visibly punish dumb prompts.
// Without replacement.

const VOTE_ENDPOINT = 'https://7uhtm126ve.execute-api.us-east-1.amazonaws.com';
const VOTE_SLUG_UP = 'ministry-of-minor-regrets-votes';
const VOTE_SLUG_DOWN = 'ministry-of-minor-regrets-downvotes';

const voteCounts = {};
const downCounts = {};
const votedThisRun = new Set();
// Per-key direction record so re-renders (back/next within the same run)
// show the correct stamped label without needing to re-derive from DOM.
const voteDirThisRun = {}; // key -> 'up' | 'down'

function voteCountFor(key) {
  return voteCounts[key] || 0;
}
function downCountFor(key) {
  return downCounts[key] || 0;
}

function declarationIndex(key) {
  for (let i = 0; i < ALL_DECLARATIONS.length; i++) {
    if (ALL_DECLARATIONS[i].key === key) return i;
  }
  return -1;
}

async function fetchOneSlug(slug, target) {
  try {
    const r = await fetch(`${VOTE_ENDPOINT}/hold/${slug}`, { method: 'GET' });
    if (!r.ok) return;
    const data = await r.json();
    if (!data || !Array.isArray(data.bins)) return;
    for (const [bin, count] of data.bins) {
      const idx = Math.round(bin / 5);
      if (idx >= 0 && idx < ALL_DECLARATIONS.length) {
        target[ALL_DECLARATIONS[idx].key] = count;
      }
    }
  } catch (_) {
    // Proxy unreachable — selection falls back to uniform random; user
    // votes still POST OK when the network recovers.
  }
}

async function fetchVotes() {
  await Promise.all([
    fetchOneSlug(VOTE_SLUG_UP, voteCounts),
    fetchOneSlug(VOTE_SLUG_DOWN, downCounts),
  ]);
}

function postVoteRaw(slug, key) {
  const idx = declarationIndex(key);
  if (idx < 0) return;
  const dur = idx * 5;
  try {
    fetch(`${VOTE_ENDPOINT}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, durationMs: dur })
    }).catch(() => {});
  } catch (_) { /* fire-and-forget */ }
}

// Weighted-without-replacement draw of PER_RUN_STEPS declarations.
// weight = max(0.25, 1 + upvotes - downvotes). Uniform when all counts
// are zero; biased toward popular declarations and away from
// downvoted-as-dumb ones as votes accumulate. The 0.25 floor keeps a
// heavily downvoted question rare but recoverable.
function pickStepsFromVotes() {
  const candidates = ALL_DECLARATIONS.slice();
  const weights = candidates.map(d =>
    Math.max(0.25, 1 + (voteCounts[d.key] || 0) - (downCounts[d.key] || 0))
  );
  const picked = [];
  for (let i = 0; i < PER_RUN_STEPS && candidates.length > 0; i++) {
    let total = 0;
    for (const w of weights) total += w;
    let r = Math.random() * total;
    let chosen = 0;
    for (let j = 0; j < weights.length; j++) {
      r -= weights[j];
      if (r <= 0) { chosen = j; break; }
    }
    picked.push(candidates[chosen]);
    candidates.splice(chosen, 1);
    weights.splice(chosen, 1);
  }
  return picked;
}

// Cast an upvote ("recommend") on the current question. Local optimistic
// increment + fire-and-forget POST. Recommend and downvote are mutually
// exclusive within a single run (votedThisRun is shared).
function castVote(key, upBtn, downBtn) {
  if (!key || votedThisRun.has(key)) return;
  votedThisRun.add(key);
  voteDirThisRun[key] = 'up';
  voteCounts[key] = (voteCounts[key] || 0) + 1;
  upBtn.disabled = true;
  upBtn.classList.add('voted');
  upBtn.innerHTML = `RECOMMENDED ✓ <span class="vote-count">(${voteCounts[key].toLocaleString('en-US')})</span>`;
  if (downBtn) {
    downBtn.disabled = true;
    downBtn.classList.add('locked');
  }
  postVoteRaw(VOTE_SLUG_UP, key);
}

// Cast a downvote ("dumb question") on the current question. Same
// optimistic + fire-and-forget pattern. Locks out recommend for this run.
function castDownvote(key, downBtn, upBtn) {
  if (!key || votedThisRun.has(key)) return;
  votedThisRun.add(key);
  voteDirThisRun[key] = 'down';
  downCounts[key] = (downCounts[key] || 0) + 1;
  downBtn.disabled = true;
  downBtn.classList.add('downvoted');
  downBtn.innerHTML = `FLAGGED DUMB ✓ <span class="vote-count">(${downCounts[key].toLocaleString('en-US')})</span>`;
  if (upBtn) {
    upBtn.disabled = true;
    upBtn.classList.add('locked');
  }
  postVoteRaw(VOTE_SLUG_DOWN, key);
}

// ---------- Render the receipt ----------

function fmtUnits(n) {
  return n.toLocaleString('en-US') + ' REGRET';
}

function renderReceipt(inputs, items, archetype, total, signatureText) {
  const heaviest = archetype.heaviest;
  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const fileId =
    'MR-' + stamp + '-' + String(hashStr(JSON.stringify(inputs)) % 100000).padStart(5, '0');

  const lines = items.map((it) => {
    const isHeavy = it.key === heaviest.key && heaviest.units > 0;
    return `
      <div class="r-line${isHeavy ? ' heavy' : ''}">
        <div class="lbl">
          <span>[${it.code}] ${it.name}</span>
          <small>${escapeHTML(it.inputText)} · ${escapeHTML(it.formula)}</small>
        </div>
        <div class="val">${fmtUnits(it.units)}</div>
      </div>
    `;
  }).join('');

  const sigSafe = escapeHTML(signatureText);

  const html = `
    <div class="corner-stamp">FILED ${stamp}</div>
    <header class="r-header">
      <div class="r-title">Ministry of Minor Regrets</div>
      <div class="r-sub">Daily Audit · Form MR-17/B</div>
      <div class="r-id">FILE № ${fileId}</div>
    </header>

    <section class="r-section">
      <div class="r-section-title">Itemized Penalties</div>
      ${lines}
    </section>

    <div class="r-total">
      <div>TOTAL REGRET POINTS</div>
      <div>${total.toLocaleString('en-US')} / ${PER_RUN_STEPS * LINE_CAP}</div>
    </div>

    <div class="r-archetype">
      <div class="stamp-verdict">
        <small>${escapeHTML(archetype.stampLine)}</small>
        ${escapeHTML(archetype.name)}
      </div>
    </div>

    <div class="r-signature">
      <span class="sig-caret">§</span>${sigSafe}
      <span class="sig-line">Dep. Undersecretary, Minor Regrets Division</span>
    </div>

    <div class="r-footer">
      <div class="r-barcode" aria-hidden="true"></div>
      Retain this audit for your records. This is the only copy.<br>
      Appeals accepted: Tue/Thu, by candlelight only.
    </div>
  `;

  document.getElementById('receipt').innerHTML = html;
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Stepper UX ----------

let stepIdx = 0;
const answers = {};

function renderStep(idx) {
  const step = STEPS[idx];
  const total = STEPS.length;
  const card = document.getElementById('step-card');
  const existing = answers[step.key];
  const valAttr = (existing !== undefined && existing !== null && Number.isFinite(existing))
    ? `value="${existing}"` : '';

  const votes = voteCountFor(step.key);
  const downs = downCountFor(step.key);
  const dir = voteDirThisRun[step.key]; // 'up' | 'down' | undefined
  const voted = votedThisRun.has(step.key);
  const upLabel = dir === 'up' ? 'RECOMMENDED ✓' : '+ RECOMMEND';
  const downLabel = dir === 'down' ? 'FLAGGED DUMB ✓' : '× FLAG AS DUMB';
  const upClasses = ['vote-btn', 'step-vote-btn'];
  if (dir === 'up') upClasses.push('voted');
  else if (dir === 'down') upClasses.push('locked');
  const downClasses = ['vote-btn', 'vote-btn-down', 'step-vote-btn'];
  if (dir === 'down') downClasses.push('downvoted');
  else if (dir === 'up') downClasses.push('locked');

  card.innerHTML = `
    <div class="step-num">DECLARATION ${String(idx + 1).padStart(2, '0')} OF ${String(total).padStart(2, '0')}</div>
    <label class="step-q-label" for="step-input">${escapeHTML(step.label)}</label>
    <div class="step-hint">${escapeHTML(step.hint)}</div>
    <input
      type="number"
      class="step-input"
      id="step-input"
      inputmode="${step.inputmode}"
      step="${step.step}"
      min="${step.min}"
      max="${step.max}"
      placeholder="${escapeHTML(step.placeholder)}"
      autocomplete="off"
      ${valAttr}
    >
    <div class="step-stamp" id="step-stamp" aria-live="polite"></div>
    <div class="step-vote-row">
      <div class="step-vote-btns">
        <button
          type="button"
          id="step-vote-btn"
          class="${upClasses.join(' ')}"
          data-key="${escapeHTML(step.key)}"
          ${voted ? 'disabled' : ''}
        >${upLabel} <span class="vote-count">(${votes.toLocaleString('en-US')})</span></button>
        <button
          type="button"
          id="step-down-btn"
          class="${downClasses.join(' ')}"
          data-key="${escapeHTML(step.key)}"
          ${voted ? 'disabled' : ''}
        >${downLabel} <span class="vote-count">(${downs.toLocaleString('en-US')})</span></button>
      </div>
      <span class="step-vote-hint">Optional · biases the question pool for future audits (recommend = more often, dumb = less often).</span>
    </div>
  `;

  document.getElementById('step-counter').textContent =
    `DECLARATION ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  const prog = document.getElementById('step-progress');
  prog.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'progress-dot';
    if (i < idx) dot.classList.add('done');
    else if (i === idx) dot.classList.add('current');
    prog.appendChild(dot);
  }

  document.getElementById('back-btn').disabled = idx === 0;
  document.getElementById('next-btn').textContent =
    idx === total - 1 ? 'SUBMIT FOR ASSESSMENT' : 'FILE & CONTINUE →';
  document.getElementById('error-line').textContent = '';

  const inputEl = document.getElementById('step-input');
  inputEl.addEventListener('input', () => {
    refreshStepStamp();
    refreshCumulative();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextStep();
    }
  });

  const voteBtn = document.getElementById('step-vote-btn');
  const downBtn = document.getElementById('step-down-btn');
  if (voteBtn) {
    voteBtn.addEventListener('click', () => castVote(step.key, voteBtn, downBtn));
  }
  if (downBtn) {
    downBtn.addEventListener('click', () => castDownvote(step.key, downBtn, voteBtn));
  }

  refreshStepStamp();
  refreshCumulative();

  // Focus on desktop only — autofocus on mobile pops the keyboard which can
  // jitter the layout. Browsers without matchMedia get the desktop path.
  try {
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarse) setTimeout(() => inputEl.focus(), 0);
  } catch (_) {
    setTimeout(() => inputEl.focus(), 0);
  }
}

function readStepValue() {
  const inputEl = document.getElementById('step-input');
  if (!inputEl) return null;
  const raw = inputEl.value;
  if (raw === '' || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

function refreshStepStamp() {
  const step = STEPS[stepIdx];
  const stampEl = document.getElementById('step-stamp');
  if (!stampEl) return;
  const v = readStepValue();
  if (v === null) {
    stampEl.className = 'step-stamp';
    stampEl.textContent = '';
    return;
  }
  const item = FIELD_COMPUTE[step.key](v);
  if (item.units > 0) {
    stampEl.className = 'step-stamp heavy';
    stampEl.textContent = '+ ' + item.units.toLocaleString('en-US') + ' REGRET — ' + item.formula;
  } else {
    stampEl.className = 'step-stamp within';
    stampEl.textContent = 'WITHIN TOLERANCE — ' + item.formula;
  }
}

function refreshCumulative() {
  let total = 0;
  let filled = 0;
  for (const s of STEPS) {
    let v;
    if (s.key === STEPS[stepIdx].key) {
      v = readStepValue();
    } else if (answers[s.key] !== undefined && answers[s.key] !== null && Number.isFinite(answers[s.key])) {
      v = answers[s.key];
    }
    if (v !== undefined && v !== null) {
      total += FIELD_COMPUTE[s.key](v).units;
      filled++;
    }
  }
  const el = document.getElementById('cumulative');
  if (!el) return;
  const cap = PER_RUN_STEPS * LINE_CAP;
  el.textContent = filled === 0
    ? `RUNNING TOTAL: 0 / ${cap}`
    : `RUNNING TOTAL: ${total.toLocaleString('en-US')} / ${cap} REGRET (${filled}/${STEPS.length} declared)`;
  el.classList.toggle('hot', total >= cap * 0.4);
}

function nextStep() {
  const step = STEPS[stepIdx];
  const v = readStepValue();
  if (v === null || v < step.min || v > step.max) {
    document.getElementById('error-line').textContent =
      `the Ministry requires a number between ${step.min} and ${step.max}.`;
    return;
  }
  answers[step.key] = v;
  if (stepIdx === STEPS.length - 1) {
    runAssessment(answers);
    return;
  }
  stepIdx++;
  renderStep(stepIdx);
  scrollAppToTop();
}

function backStep() {
  if (stepIdx === 0) return;
  const v = readStepValue();
  if (v !== null) answers[STEPS[stepIdx].key] = v;
  stepIdx--;
  renderStep(stepIdx);
  scrollAppToTop();
}

function scrollAppToTop() {
  try {
    document.getElementById('intake').scrollIntoView({ block: 'start', behavior: 'instant' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
}

// ---------- Orchestration ----------

function showLoading(msg) {
  document.getElementById('intake').hidden = true;
  document.getElementById('receipt-wrap').hidden = true;
  const l = document.getElementById('loading');
  l.hidden = false;
  document.getElementById('loading-msg').textContent = msg;
}

function showReceipt() {
  document.getElementById('intake').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('receipt-wrap').hidden = false;
  const share = document.getElementById('share');
  if (share) share.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showIntake(resetIdx) {
  document.getElementById('receipt-wrap').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('intake').hidden = false;
  const share = document.getElementById('share');
  if (share) share.style.display = 'none';
  if (resetIdx) stepIdx = 0;
  renderStep(stepIdx);
  scrollAppToTop();
}

function inputsAllValid(declarations, inputs) {
  for (const s of declarations) {
    const v = inputs[s.key];
    if (!Number.isFinite(v) || v < s.min || v > s.max) return false;
  }
  return true;
}

function runAssessment(inputs) {
  const items = computeAll(inputs);
  const total = items.reduce((s, x) => s + x.units, 0);
  const archetype = pickArchetype(items);
  const signature = buildSignature(archetype.heaviest);

  showLoading(pickLoadingMsg(JSON.stringify(inputs)));

  // Brief theatrical pause — the bureaucratic stamping is part of the vibe.
  setTimeout(() => {
    renderReceipt(inputs, items, archetype, total, signature);
    showReceipt();

    const frag = encodeFragment(STEPS, inputs);
    try {
      history.replaceState(null, '', '#' + frag);
    } catch (_) {
      location.hash = frag;
    }
  }, 800);
}

// ---------- Boot ----------

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('next-btn').addEventListener('click', nextStep);
  document.getElementById('back-btn').addEventListener('click', backStep);
  document.getElementById('redo-btn').addEventListener('click', () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    for (const k of Object.keys(answers)) delete answers[k];
    votedThisRun.clear();
    for (const k of Object.keys(voteDirThisRun)) delete voteDirThisRun[k];
    // Re-pick a fresh PER_RUN_STEPS-sized batch — different each redo.
    STEPS = pickStepsFromVotes();
    showIntake(true);
  });

  // Fetch community vote signal before deciding which 10 declarations to
  // ask. Best-effort: if the proxy is empty/unreachable, selection falls
  // back to uniform random.
  await fetchVotes();

  // Re-hydrate from a v=5 fragment if present (skips stepper entirely and
  // re-uses the EXACT declarations the share-link author was asked).
  const hydrated = decodeFragment(location.hash);
  if (hydrated && inputsAllValid(hydrated.declarations, hydrated.inputs)) {
    STEPS = hydrated.declarations;
    Object.assign(answers, hydrated.inputs);
    runAssessment(hydrated.inputs);
    return;
  }

  // Fresh visit: pick declarations weighted by community votes (uniform
  // when voteCounts is empty).
  STEPS = pickStepsFromVotes();
  renderStep(0);
});

// ---------- Share (required) ----------

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Audit link copied. The Ministry thanks you.'))
      .catch(() => alert(location.href));
  }
}
