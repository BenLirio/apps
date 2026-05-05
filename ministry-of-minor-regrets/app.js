// Ministry of Minor Regrets — bureaucratic-audit calculator.
// One declaration at a time (no scrolling form). 10 questions chosen to feel
// like things that quietly affect your health/wellbeing but you don't usually
// audit yourself for — sunlight, hydration timing, the call you didn't make,
// the laugh you missed, the hug you didn't ask for. Core arithmetic is fully
// deterministic; an LLM generates only the closing signature line. Inputs +
// signature are encoded into the URL fragment so shared links re-hydrate the
// exact receipt without spending an LLM call.
//
// Every line item is capped at LINE_CAP regret units so no single declaration
// can drown out the others; the receipt's formula text says "maximum penalty
// applied" when the cap kicks in.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'ministry-of-minor-regrets';
const LINE_CAP = 250;

function capUnits(raw, formula) {
  const r = Math.round(raw);
  if (r > LINE_CAP) return { units: LINE_CAP, formula: 'maximum penalty applied' };
  return { units: r, formula };
}

// ---------- Ministry benchmarks & per-line metadata ----------

const BENCHMARKS = {
  sun:        { benchmark: 60, unitLabel: 'min',     code: 'SUN-038', itemName: 'Solar Deficit Citation' },
  called:     { benchmark: 7,  unitLabel: 'days',    code: 'FAM-027', itemName: 'Filial Delay Assessment' },
  water:      { benchmark: 2,  unitLabel: 'hrs',     code: 'HYD-440', itemName: 'Hydration Lapse Penalty' },
  sit:        { benchmark: 60, unitLabel: 'min',     code: 'POS-510', itemName: 'Sedentary Stretch Surcharge' },
  quiet:      { benchmark: 15, unitLabel: 'min',     code: 'QTE-303', itemName: 'Unmet Quiet Allotment' },
  bed:        { benchmark: 0,  unitLabel: 'night',   code: 'SLP-309', itemName: 'Bedside Device Encroachment Fee' },
  meal:       { benchmark: 0,  unitLabel: 'meal',    code: 'NUT-180', itemName: 'Distracted Mastication Surcharge' },
  outside:    { benchmark: 1,  unitLabel: 'days',    code: 'OUT-444', itemName: 'Unmediated Air Deficit' },
  laugh:      { benchmark: 4,  unitLabel: 'hrs',     code: 'MTH-211', itemName: 'Mirth Deficit Citation' },
  hugs:       { benchmark: 4,  unitLabel: 'hug',     code: 'TCH-808', itemName: 'Touch-Quota Shortfall' },
  screens:    { benchmark: 4,  unitLabel: 'hrs',     code: 'SCN-621', itemName: 'Glow-Surface Overrun Surcharge' },
  caffeine:   { benchmark: 1,  unitLabel: 'drink',   code: 'STM-115', itemName: 'Stimulant Excess Citation' },
  ground:     { benchmark: 7,  unitLabel: 'days',    code: 'GRD-401', itemName: 'Grounding Contact Lapse' },
  compliment: { benchmark: 12, unitLabel: 'hrs',     code: 'CMP-242', itemName: 'Unspoken Compliment Backlog' },
  thanks:     { benchmark: 5,  unitLabel: 'thanks',  code: 'GRT-091', itemName: 'Gratitude Quota Shortfall' },
  write:      { benchmark: 5,  unitLabel: 'min',     code: 'PEN-330', itemName: 'Manual Inscription Deficit' },
  carry:      { benchmark: 10, unitLabel: 'min',     code: 'HAU-216', itemName: 'Haulage Allotment Deficit' },
  read:       { benchmark: 10, unitLabel: 'min',     code: 'PRT-512', itemName: 'Printed-Page Deficit' },
  eyes:       { benchmark: 4,  unitLabel: 'hrs',     code: 'OPT-074', itemName: 'Long-Focus Lapse Penalty' },
  sleep:      { benchmark: 7,  unitLabel: 'hrs',     code: 'SLP-007', itemName: 'Sleep Allotment Deficit' },
  prep:       { benchmark: 15, unitLabel: 'min',     code: 'CKR-330', itemName: 'Hand-Prepared Meal Deficit' },
  refuse:     { benchmark: 1,  unitLabel: 'refusal', code: 'REF-101', itemName: 'Volitional Refusal Deficit' },
};

// ---------- Declaration pool ----------
//
// The full menu of declarations the Ministry tracks. Each run picks
// PER_RUN_STEPS from this pool weighted by community upvotes (see
// `voteWeights`/`pickStepsFromVotes`), so the ten declarations the user is
// asked to make rotate between sessions and gradually drift toward the
// declarations real users have voted up.

const PER_RUN_STEPS = 10;

const ALL_DECLARATIONS = [
  { key: 'sun',
    label: 'Minutes of direct sunlight on your skin today',
    hint: 'Ministry benchmark: 60 min — circadian & vitamin-D allotment',
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
    label: 'Hours since you last laughed out loud',
    hint: 'Ministry benchmark: 4 hrs — registered mirth allotment',
    placeholder: 'e.g. 9',
    step: 0.5, min: 0, max: 168, inputmode: 'decimal' },
  { key: 'hugs',
    label: 'Hugs given or received today',
    hint: 'Ministry benchmark: 4',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 99, inputmode: 'numeric' },
  { key: 'screens',
    label: 'Hours of total screen time today (phones, laptops, TVs combined)',
    hint: 'Ministry benchmark: 4 hrs — daily glow-surface allotment',
    placeholder: 'e.g. 9',
    step: 0.5, min: 0, max: 24, inputmode: 'decimal' },
  { key: 'caffeine',
    label: 'Caffeinated drinks consumed today',
    hint: 'Ministry benchmark: 1 drink — daily stimulant allotment',
    placeholder: 'e.g. 4',
    step: 1, min: 0, max: 30, inputmode: 'numeric' },
  { key: 'ground',
    label: 'Days since you stood barefoot on grass, dirt, or sand',
    hint: 'Ministry benchmark: 7 days — grounding-contact allowance',
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
    label: 'Hours since you focused on anything at least 50 feet away',
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
];

// Look up declaration metadata by `key`. Used by the fragment hydrator and
// when re-binding a fixed-set of declarations on first paint.
const DECLARATION_BY_KEY = {};
for (const d of ALL_DECLARATIONS) DECLARATION_BY_KEY[d.key] = d;

// The 10 declarations chosen for THIS run. Set during boot from
// `pickStepsFromVotes(...)` (or restored from a hydrated v=5 fragment).
// Kept as a `let` so boot can reassign before the stepper renders.
let STEPS = ALL_DECLARATIONS.slice(0, PER_RUN_STEPS);

// ---------- Deterministic line-item arithmetic ----------

function computeSun(min) {
  // Below 60 min = solar deficit. Above 240 min = excess (peeling clerk).
  const deficit = Math.max(0, 60 - min);
  const excess = Math.max(0, min - 240);
  const raw = deficit * 0.9 + excess * 0.4;
  const baseFormula = deficit > 0
    ? `${deficit} min below 60-min daily allotment × 0.9`
    : excess > 0
      ? `${excess} min above 240-min ceiling × 0.4`
      : 'within solar tolerance';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'sun',
    name: BENCHMARKS.sun.itemName,
    code: BENCHMARKS.sun.code,
    inputText: `${min} min sun`,
    formula,
    units,
  };
}

function computeCalled(days) {
  const b = BENCHMARKS.called.benchmark;
  const excess = Math.max(0, days - b);
  let raw = excess * 14;
  if (days > 30) raw += (days - 30) * 18;
  if (days > 90) raw += (days - 90) * 22;
  const baseFormula = days > 90
    ? `${excess}d × 14, +escalation 30+ and 90+`
    : days > 30
      ? `${excess}d × 14, +escalation 30+`
      : excess > 0
        ? `${excess}d past 7-day benchmark × 14`
        : 'filial contact current';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'called',
    name: BENCHMARKS.called.itemName,
    code: BENCHMARKS.called.code,
    inputText: `${days} day${days === 1 ? '' : 's'} since calling`,
    formula,
    units,
  };
}

function computeWater(hrs) {
  const b = BENCHMARKS.water.benchmark;
  const excess = Math.max(0, hrs - b);
  // 38 units per hour past 2-hour reach window.
  const raw = excess * 38;
  const baseFormula = excess > 0
    ? `${stripZeros(excess)}h past 2-hour reach window × 38`
    : 'hydration current';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'water',
    name: BENCHMARKS.water.itemName,
    code: BENCHMARKS.water.code,
    inputText: `${stripZeros(hrs)}h since glass`,
    formula,
    units,
  };
}

function computeSit(min) {
  const b = BENCHMARKS.sit.benchmark;
  const excess = Math.max(0, min - b);
  let raw = excess * 1.6;
  if (min > 120) raw += (min - 120) * 1.2;
  const baseFormula = excess > 0
    ? min > 120
      ? `${excess} min past 60 × 1.6, +escalation 120+`
      : `${excess} min past 60 × 1.6`
    : 'posture rotation acceptable';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'sit',
    name: BENCHMARKS.sit.itemName,
    code: BENCHMARKS.sit.code,
    inputText: `${min} min unbroken sit`,
    formula,
    units,
  };
}

function computeQuiet(min) {
  // Reverse — fewer minutes of silence = more regret.
  const deficit = Math.max(0, BENCHMARKS.quiet.benchmark - min);
  const raw = deficit * 8;
  const baseFormula = deficit > 0
    ? `${deficit} min below 15-min daily quiet allotment × 8`
    : 'sufficient ambient quiet logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'quiet',
    name: BENCHMARKS.quiet.itemName,
    code: BENCHMARKS.quiet.code,
    inputText: `${min} min silence`,
    formula,
    units,
  };
}

function computeBed(nights) {
  // Each phone-at-pillow night: 26 units, +12 escalation past 3 nights.
  let raw = nights * 26;
  if (nights > 3) raw += (nights - 3) * 12;
  const baseFormula = nights > 3
    ? `${nights} × 26, +escalation past 3 nights`
    : nights > 0
      ? `${nights} × 26`
      : 'bedside device-free';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'bed',
    name: BENCHMARKS.bed.itemName,
    code: BENCHMARKS.bed.code,
    inputText: `${nights} night${nights === 1 ? '' : 's'} phone-at-pillow`,
    formula,
    units,
  };
}

function computeMeal(n) {
  // Each distracted meal: 35 units flat.
  const raw = n * 35;
  const baseFormula = n > 0
    ? `${n} meal${n === 1 ? '' : 's'} eaten distracted × 35`
    : 'mealtime attention undivided';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'meal',
    name: BENCHMARKS.meal.itemName,
    code: BENCHMARKS.meal.code,
    inputText: `${n} distracted meal${n === 1 ? '' : 's'}`,
    formula,
    units,
  };
}

function computeOutside(days) {
  const b = BENCHMARKS.outside.benchmark;
  const excess = Math.max(0, days - b);
  let raw = excess * 22;
  if (days > 7) raw += (days - 7) * 16;
  const baseFormula = days > 7
    ? `${excess}d past 1-day allowance × 22, +escalation 7+`
    : excess > 0
      ? `${excess}d past 1-day allowance × 22`
      : 'outdoor exposure current';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'outside',
    name: BENCHMARKS.outside.itemName,
    code: BENCHMARKS.outside.code,
    inputText: `${days} day${days === 1 ? '' : 's'} unmediated air`,
    formula,
    units,
  };
}

function computeLaugh(hrs) {
  // Hours since last laugh. 18 units per hour past 4-hr benchmark,
  // +12/hr escalation past the 12-hour mark.
  const b = BENCHMARKS.laugh.benchmark;
  const excess = Math.max(0, hrs - b);
  let raw = excess * 18;
  if (hrs > 12) raw += (hrs - 12) * 12;
  const baseFormula = hrs > 12
    ? `${stripZeros(excess)}h past 4-hr mirth allotment × 18, +escalation 12+`
    : excess > 0
      ? `${stripZeros(excess)}h past 4-hr mirth allotment × 18`
      : 'mirth allotment current';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'laugh',
    name: BENCHMARKS.laugh.itemName,
    code: BENCHMARKS.laugh.code,
    inputText: `${stripZeros(hrs)}h since laughter`,
    formula,
    units,
  };
}

function computeHugs(n) {
  // Reverse — fewer hugs = more regret. Benchmark 4.
  const deficit = Math.max(0, BENCHMARKS.hugs.benchmark - n);
  const raw = deficit * 28;
  const baseFormula = deficit > 0
    ? `${deficit} short of 4-hug daily allotment × 28`
    : 'tactile quota satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return {
    key: 'hugs',
    name: BENCHMARKS.hugs.itemName,
    code: BENCHMARKS.hugs.code,
    inputText: `${n} hug${n === 1 ? '' : 's'}`,
    formula,
    units,
  };
}

function computeScreens(hrs) {
  const b = BENCHMARKS.screens.benchmark; // 4
  const excess = Math.max(0, hrs - b);
  let raw = excess * 28;
  if (hrs > 8) raw += (hrs - 8) * 18;
  const baseFormula = hrs > 8
    ? `${stripZeros(excess)}h past 4-hr screen allotment × 28, +escalation 8+`
    : excess > 0
      ? `${stripZeros(excess)}h past 4-hr screen allotment × 28`
      : 'screen exposure within tolerance';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'screens', name: BENCHMARKS.screens.itemName, code: BENCHMARKS.screens.code,
    inputText: `${stripZeros(hrs)}h on screens`, formula, units };
}

function computeCaffeine(n) {
  const excess = Math.max(0, n - BENCHMARKS.caffeine.benchmark);
  let raw = excess * 32;
  if (n > 4) raw += (n - 4) * 22;
  const baseFormula = n > 4
    ? `${excess} past 1-cup allotment × 32, +escalation 4+`
    : excess > 0
      ? `${excess} past 1-cup daily allotment × 32`
      : 'caffeine quota observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'caffeine', name: BENCHMARKS.caffeine.itemName, code: BENCHMARKS.caffeine.code,
    inputText: `${n} caffeinated drink${n === 1 ? '' : 's'}`, formula, units };
}

function computeGround(days) {
  const excess = Math.max(0, days - BENCHMARKS.ground.benchmark);
  let raw = excess * 14;
  if (days > 30) raw += (days - 30) * 16;
  const baseFormula = days > 30
    ? `${excess}d past 7-day grounding allowance × 14, +escalation 30+`
    : excess > 0
      ? `${excess}d past 7-day grounding allowance × 14`
      : 'grounding contact current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'ground', name: BENCHMARKS.ground.itemName, code: BENCHMARKS.ground.code,
    inputText: `${days} day${days === 1 ? '' : 's'} unbarefoot`, formula, units };
}

function computeCompliment(hrs) {
  const excess = Math.max(0, hrs - BENCHMARKS.compliment.benchmark);
  const raw = excess * 12;
  const baseFormula = excess > 0
    ? `${stripZeros(excess)}h past 12-hr compliment allotment × 12`
    : 'compliment register current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'compliment', name: BENCHMARKS.compliment.itemName, code: BENCHMARKS.compliment.code,
    inputText: `${stripZeros(hrs)}h since compliment`, formula, units };
}

function computeThanks(n) {
  // Reverse — fewer thanks = more regret. Benchmark 5.
  const deficit = Math.max(0, BENCHMARKS.thanks.benchmark - n);
  const raw = deficit * 22;
  const baseFormula = deficit > 0
    ? `${deficit} short of 5-thanks daily allotment × 22`
    : 'gratitude utterances current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'thanks', name: BENCHMARKS.thanks.itemName, code: BENCHMARKS.thanks.code,
    inputText: `${n} thanks given`, formula, units };
}

function computeWrite(min) {
  const deficit = Math.max(0, BENCHMARKS.write.benchmark - min);
  const raw = deficit * 18;
  const baseFormula = deficit > 0
    ? `${deficit} min below 5-min handwriting allotment × 18`
    : 'manual longhand observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'write', name: BENCHMARKS.write.itemName, code: BENCHMARKS.write.code,
    inputText: `${min} min handwritten`, formula, units };
}

function computeCarry(min) {
  const deficit = Math.max(0, BENCHMARKS.carry.benchmark - min);
  const raw = deficit * 16;
  const baseFormula = deficit > 0
    ? `${deficit} min below 10-min haulage allotment × 16`
    : 'physical haulage logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'carry', name: BENCHMARKS.carry.itemName, code: BENCHMARKS.carry.code,
    inputText: `${min} min carrying`, formula, units };
}

function computeRead(min) {
  const deficit = Math.max(0, BENCHMARKS.read.benchmark - min);
  const raw = deficit * 18;
  const baseFormula = deficit > 0
    ? `${deficit} min below 10-min printed-page allotment × 18`
    : 'paper-page reading observed';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'read', name: BENCHMARKS.read.itemName, code: BENCHMARKS.read.code,
    inputText: `${min} min on paper`, formula, units };
}

function computeEyes(hrs) {
  const excess = Math.max(0, hrs - BENCHMARKS.eyes.benchmark);
  let raw = excess * 22;
  if (hrs > 12) raw += (hrs - 12) * 14;
  const baseFormula = hrs > 12
    ? `${stripZeros(excess)}h past 4-hr distance-focus allotment × 22, +escalation 12+`
    : excess > 0
      ? `${stripZeros(excess)}h past 4-hr distance-focus allotment × 22`
      : 'long-focus exposure current';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'eyes', name: BENCHMARKS.eyes.itemName, code: BENCHMARKS.eyes.code,
    inputText: `${stripZeros(hrs)}h since 50ft+ glance`, formula, units };
}

function computeSleep(hrs) {
  const deficit = Math.max(0, BENCHMARKS.sleep.benchmark - hrs);
  let raw = deficit * 30;
  if (hrs < 5) raw += (5 - hrs) * 24;
  const baseFormula = hrs < 5
    ? `${stripZeros(deficit)}h below 7-hr sleep allotment × 30, +escalation under 5h`
    : deficit > 0
      ? `${stripZeros(deficit)}h below 7-hr sleep allotment × 30`
      : 'sleep allotment satisfied';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'sleep', name: BENCHMARKS.sleep.itemName, code: BENCHMARKS.sleep.code,
    inputText: `${stripZeros(hrs)}h slept`, formula, units };
}

function computePrep(min) {
  const deficit = Math.max(0, BENCHMARKS.prep.benchmark - min);
  const raw = deficit * 14;
  const baseFormula = deficit > 0
    ? `${deficit} min below 15-min hand-prep allotment × 14`
    : 'hand-prepared meal logged';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'prep', name: BENCHMARKS.prep.itemName, code: BENCHMARKS.prep.code,
    inputText: `${min} min hand-prep`, formula, units };
}

function computeRefuse(n) {
  const deficit = Math.max(0, BENCHMARKS.refuse.benchmark - n);
  const raw = deficit * 24;
  const baseFormula = deficit > 0
    ? '0 declined today; minimum is 1 daily refusal × 24'
    : 'volitional refusals exercised';
  const { units, formula } = capUnits(raw, baseFormula);
  return { key: 'refuse', name: BENCHMARKS.refuse.itemName, code: BENCHMARKS.refuse.code,
    inputText: `${n} refusal${n === 1 ? '' : 's'}`, formula, units };
}

const FIELD_COMPUTE = {
  sun:        computeSun,
  called:     computeCalled,
  water:      computeWater,
  sit:        computeSit,
  quiet:      computeQuiet,
  bed:        computeBed,
  meal:       computeMeal,
  outside:    computeOutside,
  laugh:      computeLaugh,
  hugs:       computeHugs,
  screens:    computeScreens,
  caffeine:   computeCaffeine,
  ground:     computeGround,
  compliment: computeCompliment,
  thanks:     computeThanks,
  write:      computeWrite,
  carry:      computeCarry,
  read:       computeRead,
  eyes:       computeEyes,
  sleep:      computeSleep,
  prep:       computePrep,
  refuse:     computeRefuse,
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
// v=5 schema: per-run rotation means the 10 declarations differ between
// sessions, so the fragment encodes both WHICH declarations were asked and
// the user's values. Format:
//   v=5
//   ids=<comma-separated declaration keys, in order asked>
//   vals=<comma-separated numeric values, parallel to ids>
//   sig=<base64-encoded signature line>
// Older fragments (v=4 fixed-keys schema) fall through and the user starts
// a fresh declaration.

function encodeFragment(declarations, inputs, signature) {
  const p = new URLSearchParams();
  p.set('v', '5');
  p.set('ids', declarations.map(d => d.key).join(','));
  p.set('vals', declarations.map(d => String(inputs[d.key])).join(','));
  if (signature) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(signature))).replace(/=+$/, '');
      p.set('sig', b64);
    } catch (_) {}
  }
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
  let signature = null;
  const sig = p.get('sig');
  if (sig) {
    try {
      signature = decodeURIComponent(escape(atob(sig)));
    } catch (_) { signature = null; }
  }
  return { declarations, inputs, signature };
}

// ---------- Deterministic fallback signatures (if LLM fails) ----------

const FALLBACK_SIG = {
  sun:        'A small portion of light has been requisitioned in your name today, and the Ministry has filed the deficit on parchment.',
  called:     'Somewhere a phone rings in a kitchen you used to know the smell of, and nobody has logged the silence.',
  water:      'The Ministry observed your throat and finds it dry; a memo to the kitchen has been issued in triplicate.',
  sit:        'The chair has begun to mistake you for furniture, and the Ministry will not contradict the chair.',
  quiet:      'The Ministry has registered a backlog of unmet quiet, and recommends one (1) unaccompanied minute before bed.',
  bed:        'Your phone slept beside you again, and now both of you are tired in slightly different ways.',
  meal:       'A meal occurred, the Ministry confirms, but no one in the room can describe the flavor.',
  outside:    'The doorway has filed a missing-person report on your behalf; please respond to the open air at your earliest.',
  laugh:      'A registered laugh has not crossed your lips in some time, and the Ministry has formally noted the silence.',
  hugs:       'A small backlog of unembraced hellos has accumulated; the Ministry recommends gentle correction.',
  screens:    'A great deal of light has crossed your face today and very little of it was the sun; the Ministry has noted the discrepancy.',
  caffeine:   'Your bloodstream submits a request for a moment of stillness; the Ministry has forwarded it to the appropriate desk.',
  ground:     'The earth files a polite reminder that it is still down there, and remains willing to be stood upon at your convenience.',
  compliment: 'A compliment, fully drafted, sits unsent in the outbox of your throat; the Ministry recommends transmission before close of business.',
  thanks:     'Several quiet thanks went unspoken today, and the Ministry has logged each one against the daily allotment.',
  write:      'A pen, somewhere on your desk, awaits its formal commission; the Ministry believes its appointment is overdue.',
  carry:      'You moved nothing of consequence today, and the Ministry observes that the world remained in roughly the same place.',
  read:       'A page of plain paper has not turned beneath your hand in some time; the Ministry has been keeping count.',
  eyes:       'Your gaze has settled at arm’s length for the better part of the day; the Ministry suggests a horizon, gently.',
  sleep:      'Sleep was rationed last night and the Ministry has filed a complaint on your behalf with the appropriate hour.',
  prep:       'No food passed under your own knife today, and the Ministry has discreetly noted the absence of crumbs.',
  refuse:     'You declined nothing today, and the Ministry observes that the calendar therefore continues to fill.',
};

function buildFallbackSignature(heaviest) {
  return FALLBACK_SIG[heaviest.key]
    || 'Your regrets have been quantified and filed in good standing. Kindly return tomorrow.';
}

// ---------- LLM call for the signature line ----------

async function generateSignature(archetype, heaviest, total, inputs) {
  const system =
    "You write ONE closing line for a fictional bureaucratic audit receipt from the 'Ministry of Minor Regrets'. " +
    "The tone is dry, slightly theatrical, faintly absurd — bureaucratic prose with a literary edge. " +
    "Hard rules: ONE sentence, under 30 words, no emojis, no hashtags, no quotation marks, no meta-commentary. " +
    "You MUST naturally reference the heaviest line item by its NAME (not its code). " +
    "Do not start with 'The Ministry'. Write as if a weary civil servant sealed the document.";

  const inputDigest = STEPS
    .map(s => `${s.key}=${inputs[s.key]}`)
    .join(', ');

  const userMsg =
    `Archetype verdict: ${archetype.name}\n` +
    `Heaviest line item name: ${heaviest.name}\n` +
    `Heaviest input context: ${heaviest.inputText} (${heaviest.units} regret units)\n` +
    `Total regret units: ${total}\n` +
    `All inputs: ${inputDigest}\n` +
    `Write the closing sentence now. Reference "${heaviest.name}" in your sentence.`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 90,
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let text = (data && data.content || '').trim();
    text = text.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0];
    if (!text || text.length < 8) throw new Error('empty');
    return text;
  } catch (_) {
    return buildFallbackSignature(heaviest);
  }
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
// counter) under a separate slug so future hold-time histograms for this
// app can coexist. Each declaration index maps to a unique 5-ms bin
// (idx * 5), well inside the proxy's [0, 10000] ms range and 5-ms bin
// width. POSTing a vote increments that bin; GET returns all bins, which
// we read back into `voteCounts` keyed by declaration key.
//
// Selection at boot draws PER_RUN_STEPS declarations weighted by
// (1 + voteCount), Laplace-smoothed so newly-added declarations still get
// surfaced even at zero votes. Without replacement.

const VOTE_ENDPOINT = 'https://7uhtm126ve.execute-api.us-east-1.amazonaws.com';
const VOTE_SLUG = 'ministry-of-minor-regrets-votes';

const voteCounts = {};
const votedThisRun = new Set();

function voteCountFor(key) {
  return voteCounts[key] || 0;
}

function declarationIndex(key) {
  for (let i = 0; i < ALL_DECLARATIONS.length; i++) {
    if (ALL_DECLARATIONS[i].key === key) return i;
  }
  return -1;
}

async function fetchVotes() {
  try {
    const r = await fetch(`${VOTE_ENDPOINT}/hold/${VOTE_SLUG}`, { method: 'GET' });
    if (!r.ok) return;
    const data = await r.json();
    if (!data || !Array.isArray(data.bins)) return;
    for (const [bin, count] of data.bins) {
      const idx = Math.round(bin / 5);
      if (idx >= 0 && idx < ALL_DECLARATIONS.length) {
        voteCounts[ALL_DECLARATIONS[idx].key] = count;
      }
    }
  } catch (_) {
    // Proxy unreachable — selection falls back to uniform random and the
    // receipt shows (0) for every declaration; user votes still POST OK
    // when the network recovers.
  }
}

function postVote(key) {
  const idx = declarationIndex(key);
  if (idx < 0) return;
  const dur = idx * 5;
  try {
    fetch(`${VOTE_ENDPOINT}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: VOTE_SLUG, durationMs: dur })
    }).catch(() => {});
  } catch (_) { /* fire-and-forget */ }
}

// Weighted-without-replacement draw of PER_RUN_STEPS declarations.
// weights[i] = 1 + voteCount[i] gives uniform random when all counts are
// zero, and progressively biases toward popular declarations as community
// votes accumulate.
function pickStepsFromVotes() {
  const candidates = ALL_DECLARATIONS.slice();
  const weights = candidates.map(d => 1 + (voteCounts[d.key] || 0));
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

function onReceiptClick(ev) {
  const btn = ev.target.closest && ev.target.closest('.vote-btn');
  if (!btn) return;
  const key = btn.dataset.key;
  if (!key || votedThisRun.has(key)) return;
  votedThisRun.add(key);
  // Optimistic local increment for immediate UI feedback.
  voteCounts[key] = (voteCounts[key] || 0) + 1;
  btn.disabled = true;
  btn.classList.add('voted');
  btn.innerHTML = `FILED ✓ <span class="vote-count">(${voteCounts[key].toLocaleString('en-US')})</span>`;
  postVote(key);
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
    const votes = voteCountFor(it.key);
    const voted = votedThisRun.has(it.key);
    const voteLabel = voted ? 'FILED ✓' : '+ FILE COMMENDATION';
    return `
      <div class="r-line${isHeavy ? ' heavy' : ''}">
        <div class="lbl">
          <span>[${it.code}] ${it.name}</span>
          <small>${escapeHTML(it.inputText)} · ${escapeHTML(it.formula)}</small>
          <button
            class="vote-btn${voted ? ' voted' : ''}"
            type="button"
            data-key="${escapeHTML(it.key)}"
            ${voted ? 'disabled' : ''}
          >${voteLabel} <span class="vote-count">(${votes.toLocaleString('en-US')})</span></button>
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
      <div>TOTAL REGRET UNITS</div>
      <div>${total.toLocaleString('en-US')}</div>
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
  el.textContent = filled === 0
    ? 'RUNNING TOTAL: 0 REGRET'
    : `RUNNING TOTAL: ${total.toLocaleString('en-US')} REGRET (${filled}/${STEPS.length} declared)`;
  el.classList.toggle('hot', total >= 400);
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
    runAssessment(answers, null);
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

async function runAssessment(inputs, providedSignature) {
  const items = computeAll(inputs);
  const total = items.reduce((s, x) => s + x.units, 0);
  const archetype = pickArchetype(items);

  showLoading(pickLoadingMsg(JSON.stringify(inputs)));

  const minDelay = new Promise((r) => setTimeout(r, 800));

  let signature;
  if (providedSignature && providedSignature.length > 4) {
    signature = providedSignature;
    await minDelay;
  } else {
    const [sig] = await Promise.all([
      generateSignature(archetype, archetype.heaviest, total, inputs),
      minDelay,
    ]);
    signature = sig;
  }

  renderReceipt(inputs, items, archetype, total, signature);
  showReceipt();

  const frag = encodeFragment(STEPS, inputs, signature);
  try {
    history.replaceState(null, '', '#' + frag);
  } catch (_) {
    location.hash = frag;
  }
}

// ---------- Boot ----------

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('next-btn').addEventListener('click', nextStep);
  document.getElementById('back-btn').addEventListener('click', backStep);
  document.getElementById('redo-btn').addEventListener('click', () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    for (const k of Object.keys(answers)) delete answers[k];
    votedThisRun.clear();
    // Re-pick a fresh 10 from the pool — different each redo.
    STEPS = pickStepsFromVotes();
    showIntake(true);
  });

  // Delegated click handler so dynamically-rendered vote buttons work.
  document.getElementById('receipt').addEventListener('click', onReceiptClick);

  // Fetch community vote signal before deciding which 10 declarations to
  // ask. Best-effort: if the proxy is empty/unreachable, selection falls
  // back to uniform random.
  await fetchVotes();

  // Re-hydrate from a v=5 fragment if present (skips stepper entirely and
  // re-uses the EXACT 10 declarations the share-link author was asked).
  const hydrated = decodeFragment(location.hash);
  if (hydrated && inputsAllValid(hydrated.declarations, hydrated.inputs)) {
    STEPS = hydrated.declarations;
    Object.assign(answers, hydrated.inputs);
    runAssessment(hydrated.inputs, hydrated.signature);
    return;
  }

  // Fresh visit: pick 10 weighted by community votes (uniform when
  // voteCounts is empty).
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
