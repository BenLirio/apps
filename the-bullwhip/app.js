// The Bullwhip — solo Beer Game in 20 ticks.
// Deterministic. Same seed -> same demand curve. Replay via URL fragment.

// ============================================================
// CONFIG
// ============================================================
const TIERS = ['Retailer', 'Wholesaler', 'Distributor', 'Factory'];
// Tier 0 = Retailer (top, faces customer). Tier 3 = Factory (bottom).
const N_TIERS = 4;
const N_WEEKS = 20;
const SHIP_LAG = 2;     // weeks between order and arrival (incoming-shipment pipeline)
const ORDER_LAG = 1;    // info lag: downstream order takes 1 week to reach upstream
const START_INV = 12;
const START_ORDER = 4;
const TICK_MS = 1500;   // 1.5 seconds per week

// Today's seed: same demand curve for everyone today.
function todaySeed() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// ============================================================
// SEEDED RNG (mulberry32)
// ============================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================================
// CUSTOMER DEMAND CURVE
// Steady ~4 cases/wk, with one bump at week 3 (a viral moment for root beer).
// Same seed (today) -> same curve for everyone.
// ============================================================
function buildDemand(seed) {
  const rng = mulberry32(seed);
  const arr = [];
  for (let w = 0; w < N_WEEKS; w++) {
    let base = 4;
    // small noise (-1, 0, +1)
    const n = Math.floor(rng() * 3) - 1;
    let d = base + n;
    if (w === 2) d = 8;        // week 3 (index 2): the bump begins
    if (w === 3) d = 9;        // week 4: peak
    if (w === 4) d = 7;        // week 5: tailing off
    if (d < 0) d = 0;
    arr.push(d);
  }
  return arr;
}

// ============================================================
// AI AGENT — anchoring & adjustment
// Order = anchor (recent demand seen) + alpha*(target_inv - inv) - beta*pipeline
// Each agent has slightly different gains keyed off (seed, tier).
// ============================================================
function makeAgentParams(seed, tier) {
  const rng = mulberry32(seed * 73 + tier * 17 + 991);
  return {
    targetInv: 12 + Math.floor(rng() * 4),     // 12..15
    alpha: 0.28 + rng() * 0.22,                 // inventory gain
    beta:  0.18 + rng() * 0.18,                 // pipeline discount
    smooth: 0.55 + rng() * 0.25                 // demand-anchor smoothing
  };
}

function aiOrder(state, tier, params) {
  // demand seen = order placed by downstream tier this week
  const seen = state.demandSeen[tier];
  // smoothed demand anchor
  state.demandAnchor[tier] = params.smooth * state.demandAnchor[tier] + (1 - params.smooth) * seen;
  const anchor = state.demandAnchor[tier];

  const inv = state.inventory[tier];
  const back = state.backlog[tier];
  const pipeline = state.shipIn[tier].reduce((a, b) => a + b, 0);
  const onOrder = state.orderIn[tier].reduce((a, b) => a + b, 0);

  let order = anchor + params.alpha * (params.targetInv - (inv - back)) - params.beta * (pipeline + onOrder - 2 * anchor);
  order = Math.round(order);
  if (order < 0) order = 0;
  if (order > 24) order = 24;
  return order;
}

// ============================================================
// SIMULATION STATE
// inventory[i]:    cases on shelf at tier i
// backlog[i]:      cases owed to downstream
// shipIn[i]:       array (length SHIP_LAG) of pending shipments arriving from upstream
// orderIn[i]:      array (length ORDER_LAG) of orders from downstream that have not yet been seen
// orderHist[i][w]: order placed by tier i in week w
// demandSeen[i]:   last order from downstream this week
// ============================================================
function newState() {
  const s = {
    week: 0,
    inventory: Array(N_TIERS).fill(START_INV),
    backlog:   Array(N_TIERS).fill(0),
    shipIn:    Array.from({length: N_TIERS}, () => Array(SHIP_LAG).fill(START_ORDER)),
    orderIn:   Array.from({length: N_TIERS}, () => Array(ORDER_LAG).fill(START_ORDER)),
    orderHist: Array.from({length: N_TIERS}, () => []),
    demandSeen: Array(N_TIERS).fill(START_ORDER),
    demandAnchor: Array(N_TIERS).fill(START_ORDER),
    invHist: Array.from({length: N_TIERS}, () => []),
    stockoutHist: Array.from({length: N_TIERS}, () => []),
    cumPeak: 0,
    cumStockout: 0
  };
  return s;
}

// Advance one week.
//   - userTier: which tier the player controls (0..3)
//   - userOrder: the order the player placed for this week
//   - demand: customer demand for this week
//   - agentParams[]: AI params per tier (only consulted for non-user tiers)
function tick(state, userTier, userOrder, demand, agentParams) {
  // 1. Receive incoming shipments.
  for (let i = 0; i < N_TIERS; i++) {
    const arrived = state.shipIn[i].shift();
    state.inventory[i] += arrived;
  }

  // 2. Determine what each tier needs to ship out this week.
  //    Retailer (i=0) ships to customer (demand). Tier i>0 ships to tier i-1
  //    based on the order that just became visible (orderIn).
  const demandThisWeek = Array(N_TIERS).fill(0);
  demandThisWeek[0] = demand + state.backlog[0];
  for (let i = 1; i < N_TIERS; i++) {
    const incomingOrder = state.orderIn[i].shift();
    state.demandSeen[i] = incomingOrder;
    demandThisWeek[i] = incomingOrder + state.backlog[i];
  }
  // The Retailer sees raw customer demand directly.
  state.demandSeen[0] = demand;

  // 3. Ship: fulfill what we can; the rest becomes backlog at THIS tier;
  //    what we ship lands in the downstream tier's incoming-ship pipeline.
  const shipped = Array(N_TIERS).fill(0);
  for (let i = 0; i < N_TIERS; i++) {
    const want = demandThisWeek[i];
    const have = state.inventory[i];
    const give = Math.min(want, have);
    state.inventory[i] -= give;
    state.backlog[i] = want - give;
    shipped[i] = give;
  }

  // 4. Push shipments downstream into the SHIP_LAG pipeline of the tier below.
  //    Tier 0 ships to customer (out of system).
  //    Factory (last tier) brews — it gets its own "order" arriving as if there's
  //    an infinite raw-materials upstream; we treat factory orders as pipeline.
  for (let i = 1; i < N_TIERS; i++) {
    state.shipIn[i - 1].push(shipped[i]);
  }

  // 5. Each tier places an order to upstream.
  //    User tier uses userOrder. Others use AI.
  //    Factory's "upstream" is raw materials; its order goes straight into
  //    its own incoming-ship pipeline.
  const orders = Array(N_TIERS).fill(0);
  for (let i = 0; i < N_TIERS; i++) {
    if (i === userTier) {
      orders[i] = userOrder;
    } else {
      orders[i] = aiOrder(state, i, agentParams[i]);
    }
    state.orderHist[i].push(orders[i]);
  }

  // 6. Place orders into pipelines.
  for (let i = 0; i < N_TIERS; i++) {
    if (i === N_TIERS - 1) {
      // Factory orders go to its own ship pipeline (factory-to-self build lag)
      state.shipIn[i].push(orders[i]);
    } else {
      // i orders from i+1, that order takes ORDER_LAG to be seen by i+1
      state.orderIn[i + 1].push(orders[i]);
    }
  }

  // 7. Bookkeeping.
  for (let i = 0; i < N_TIERS; i++) {
    state.invHist[i].push(state.inventory[i]);
    state.stockoutHist[i].push(state.backlog[i] > 0 ? 1 : 0);
    if (state.inventory[i] > state.cumPeak) state.cumPeak = state.inventory[i];
    if (state.backlog[i] > 0) state.cumStockout += 1; // counts tier-weeks
  }

  state.week += 1;
}

// ============================================================
// REPLAY: simulate a full run given (seed, userTier, userOrders[20]).
// Used both for fresh play and for replay-from-fragment.
// ============================================================
function fullRun(seed, userTier, userOrders) {
  const demand = buildDemand(seed);
  const agentParams = TIERS.map((_, t) => makeAgentParams(seed, t));
  const state = newState();
  for (let w = 0; w < N_WEEKS; w++) {
    tick(state, userTier, userOrders[w] | 0, demand[w], agentParams);
  }
  return { state, demand, agentParams };
}

// ============================================================
// ARCHETYPE — keyed off (variance, lag, peak) of USER tier's orders
// Same metrics -> same archetype name -> reproducible verdicts.
// ============================================================
const ARCHETYPES = [
  // [name, blurb]
  ['The Lighthouse Keeper', 'Steady. Boring. Quietly correct. The rest of the chain owes you and they will not say it.'],
  ['The Zen Hoarder', 'You over-anchored on calm. Inventory grew slow and certain. Capital is patient, and so are you.'],
  ['The Panic Restocker', 'You felt the wave the customer felt and you tripled it. Everyone downstream had a great week. Everyone upstream wept.'],
  ['The Whip-Cracker', 'You amplified every twitch into a snap. The chain rang for weeks. Your spreadsheet looks like an EKG.'],
  ['The Stockout Saint', 'You ran lean. You ran out. You did not blink. Customers are unsentimental. The audit is also unsentimental.'],
  ['The Lagging Indicator', 'You ordered last week\'s problem this week. Reliable. Late. Reliable about being late.'],
  ['The Quiet Optimizer', 'Small adjustments, often. The demand bump barely showed up in your numbers. The Bureau is mildly impressed.'],
  ['The Fire-Sale Mystic', 'You over-shot the bump and then under-shot the recovery. Two stories of pain in one ledger.']
];

function pickArchetype(metrics) {
  const { variance, lagCorr, peak, stockoutWeeks, totalOrdered } = metrics;
  // Order matters: most-distinctive first.
  if (variance > 24 && peak > 28) return 3; // Whip-Cracker
  if (variance > 16) return 2; // Panic Restocker
  if (peak > 32) return 1; // Zen Hoarder (very high inv, low variance)
  if (stockoutWeeks >= 6) return 4; // Stockout Saint
  if (stockoutWeeks >= 4) return 4; // Stockout Saint
  if (lagCorr >= 2) return 5; // Lagging Indicator
  if (variance < 4 && peak < 24) return 0; // Lighthouse Keeper
  if (variance < 9) return 6; // Quiet Optimizer
  return 7; // Fire-Sale Mystic
}

// ============================================================
// METRICS for the user tier
// ============================================================
function userMetrics(state, userTier) {
  const orders = state.orderHist[userTier];
  const inv = state.invHist[userTier];
  const stockouts = state.stockoutHist[userTier];

  // variance of orders
  const mean = orders.reduce((a, b) => a + b, 0) / orders.length;
  const variance = orders.reduce((a, b) => a + (b - mean) ** 2, 0) / orders.length;
  const peak = Math.max(...inv);
  const stockoutWeeks = stockouts.reduce((a, b) => a + b, 0);
  const totalOrdered = orders.reduce((a, b) => a + b, 0);

  // crude "lag correlation": did your orders peak well after demand peaked?
  let argmax = 0;
  for (let i = 1; i < orders.length; i++) if (orders[i] > orders[argmax]) argmax = i;
  const lagCorr = Math.max(0, argmax - 3); // demand peak is at week 4 (index 3)

  return { variance, peak, stockoutWeeks, totalOrdered, lagCorr, mean, orders, inv, stockouts };
}

// ============================================================
// URL FRAGMENT: encode/decode (seed, tier, 20 orders 0..24)
// Compact: "s.t.o" where o is base36 of orders packed 5 bits each.
// ============================================================
function encodeFragment(seed, tier, orders) {
  // Pack each order into 5 bits (0..31). 20*5 = 100 bits. Fits in a BigInt.
  let packed = 0n;
  for (let i = 0; i < N_WEEKS; i++) {
    const v = Math.max(0, Math.min(31, orders[i] | 0));
    packed = (packed << 5n) | BigInt(v);
  }
  const ordersStr = packed.toString(36);
  return `${seed.toString(36)}.${tier}.${ordersStr}`;
}

function decodeFragment(frag) {
  if (!frag) return null;
  const parts = frag.replace(/^#/, '').split('.');
  if (parts.length !== 3) return null;
  try {
    const seed = parseInt(parts[0], 36);
    const tier = parseInt(parts[1], 10);
    let packed = BigInt(0);
    const s = parts[2];
    // BigInt has no fromString radix. Build it.
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      let d;
      if (c >= 48 && c <= 57) d = c - 48;
      else if (c >= 97 && c <= 122) d = c - 97 + 10;
      else if (c >= 65 && c <= 90) d = c - 65 + 10;
      else return null;
      packed = packed * 36n + BigInt(d);
    }
    const orders = Array(N_WEEKS).fill(0);
    for (let i = N_WEEKS - 1; i >= 0; i--) {
      orders[i] = Number(packed & 31n);
      packed >>= 5n;
    }
    if (Number.isNaN(seed) || tier < 0 || tier > 3) return null;
    return { seed, tier, orders };
  } catch (e) {
    return null;
  }
}

// ============================================================
// PIXEL-ART WAREHOUSE RENDERER (Canvas)
// One stack of four warehouses connected by a conveyor of cardboard cases.
// ============================================================
const WH_W = 320;
const WH_H = 420;
const ROW_H = 96; // 4 rows = 384, + a 36-px header strip
const HEADER_H = 36;

const TIER_COLORS = ['#1a1814', '#d94a17', '#1d3a6b', '#2f6b3f'];

function drawWarehouseScene(ctx, state, demand, userTier) {
  ctx.fillStyle = '#e3d6b8';
  ctx.fillRect(0, 0, WH_W, WH_H);

  // header banner
  ctx.fillStyle = '#1a1814';
  ctx.fillRect(0, 0, WH_W, HEADER_H);
  ctx.fillStyle = '#efe5cf';
  ctx.font = '14px "VT323", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUPPLY CHAIN — WK ' + String(state.week).padStart(2,'0') + '/20', 8, HEADER_H/2);
  // mini demand bump indicator
  if (state.week >= 2 && state.week <= 5) {
    ctx.fillStyle = '#d94a17';
    ctx.fillRect(WH_W - 96, 6, 88, 24);
    ctx.fillStyle = '#1a1814';
    ctx.font = '12px "VT323", monospace';
    ctx.fillText('!! BUMP !!', WH_W - 88, HEADER_H/2);
  }

  // Four warehouse rows
  for (let i = 0; i < N_TIERS; i++) {
    const y = HEADER_H + i * ROW_H;
    drawWarehouseRow(ctx, i, y, state, userTier);
  }

  // Conveyor belt: vertical line on right side connecting all four
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WH_W - 30, HEADER_H + 12);
  ctx.lineTo(WH_W - 30, WH_H - 12);
  ctx.stroke();
  // small "case" boxes moving on the belt — animate by week parity
  for (let i = 0; i < N_TIERS - 1; i++) {
    const y = HEADER_H + i * ROW_H + ROW_H - 16;
    const phase = (state.week % 2 === 0) ? 0 : 6;
    ctx.fillStyle = '#a83410';
    ctx.fillRect(WH_W - 36, y + phase, 12, 8);
    ctx.strokeStyle = '#1a1814';
    ctx.strokeRect(WH_W - 36, y + phase, 12, 8);
  }
}

function drawWarehouseRow(ctx, tier, y, state, userTier) {
  const x0 = 8;
  const w = WH_W - 50;
  const h = ROW_H - 6;
  const isUser = (tier === userTier);
  const accent = TIER_COLORS[tier];

  // base building
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(x0, y + 4, w, h - 4);
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = isUser ? 3 : 2;
  ctx.strokeRect(x0, y + 4, w, h - 4);

  // saw-tooth roof (3 peaks)
  const roofY = y + 4;
  ctx.fillStyle = accent;
  ctx.beginPath();
  const peaks = 3;
  for (let p = 0; p < peaks; p++) {
    const px = x0 + (w / peaks) * p;
    const pw = w / peaks;
    ctx.moveTo(px, roofY);
    ctx.lineTo(px + pw / 2, roofY - 12);
    ctx.lineTo(px + pw, roofY);
  }
  ctx.fill();
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 1;
  for (let p = 0; p < peaks; p++) {
    const px = x0 + (w / peaks) * p;
    const pw = w / peaks;
    ctx.beginPath();
    ctx.moveTo(px, roofY);
    ctx.lineTo(px + pw / 2, roofY - 12);
    ctx.lineTo(px + pw, roofY);
    ctx.stroke();
  }

  // tier name & stats
  ctx.fillStyle = '#1a1814';
  ctx.font = 'bold 13px "Special Elite", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(TIERS[tier].toUpperCase() + (isUser ? '  <YOU>' : ''), x0 + 8, y + 8);
  ctx.font = '13px "VT323", monospace';
  const inv = state.inventory[tier];
  const back = state.backlog[tier];
  ctx.fillText('INV ' + String(inv).padStart(2, '0'), x0 + 8, y + 24);
  if (back > 0) {
    ctx.fillStyle = '#a83410';
    ctx.fillText('BAK ' + String(back).padStart(2, '0'), x0 + 60, y + 24);
    ctx.fillStyle = '#1a1814';
  }

  // crates: draw up to 12 small cases, scaled by inventory
  const caseY = y + h - 22;
  const maxShow = 12;
  const showN = Math.min(maxShow, Math.max(0, inv));
  for (let c = 0; c < showN; c++) {
    const cx = x0 + 8 + c * 12;
    ctx.fillStyle = (c % 2 === 0) ? '#a83410' : '#d94a17';
    ctx.fillRect(cx, caseY, 10, 12);
    ctx.strokeStyle = '#1a1814';
    ctx.strokeRect(cx, caseY, 10, 12);
  }
  if (inv > maxShow) {
    ctx.fillStyle = '#1a1814';
    ctx.font = '12px "VT323", monospace';
    ctx.fillText('+' + (inv - maxShow), x0 + 8 + maxShow * 12 + 4, caseY + 2);
  }

  // door
  ctx.fillStyle = '#1a1814';
  ctx.fillRect(x0 + w - 24, y + h - 24, 14, 22);

  // tier number badge
  ctx.fillStyle = accent;
  ctx.fillRect(x0 + w - 50, y + 8, 18, 18);
  ctx.strokeStyle = '#1a1814';
  ctx.strokeRect(x0 + w - 50, y + 8, 18, 18);
  ctx.fillStyle = '#efe5cf';
  ctx.font = '14px "VT323", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('0' + (tier + 1), x0 + w - 47, y + 17);
  ctx.textBaseline = 'top';
}

// ============================================================
// RIPPLE CHART (audit screen) — line chart of all four tiers' orders
// ============================================================
function drawRippleChart(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(0, 0, W, H);

  const padL = 36, padR = 12, padT = 16, padB = 28;
  const cw = W - padL - padR;
  const ch = H - padT - padB;

  // Find y-max
  let yMax = 1;
  for (let i = 0; i < N_TIERS; i++) {
    for (const v of state.orderHist[i]) if (v > yMax) yMax = v;
  }
  yMax = Math.ceil(yMax / 4) * 4;
  if (yMax < 8) yMax = 8;

  // grid
  ctx.strokeStyle = '#c4b696';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (let g = 0; g <= 4; g++) {
    const y = padT + (ch * g / 4);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // axes
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();

  // y labels
  ctx.fillStyle = '#1a1814';
  ctx.font = '11px "VT323", monospace';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const y = padT + (ch * g / 4);
    const v = Math.round(yMax * (1 - g / 4));
    ctx.fillText(String(v).padStart(2, ' '), 6, y);
  }
  // x labels
  ctx.textBaseline = 'top';
  for (let w = 0; w < N_WEEKS; w += 4) {
    const x = padL + (cw * w / (N_WEEKS - 1));
    ctx.fillText('w' + (w + 1), x - 6, H - padB + 4);
  }

  // lines
  const colors = ['#1a1814', '#d94a17', '#1d3a6b', '#2f6b3f'];
  for (let i = 0; i < N_TIERS; i++) {
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = (i === STATE.userTier) ? 3 : 1.5;
    ctx.beginPath();
    for (let w = 0; w < N_WEEKS; w++) {
      const x = padL + (cw * w / (N_WEEKS - 1));
      const v = state.orderHist[i][w] || 0;
      const y = padT + ch * (1 - v / yMax);
      if (w === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // dots on user line
    if (i === STATE.userTier) {
      ctx.fillStyle = colors[i];
      for (let w = 0; w < N_WEEKS; w++) {
        const x = padL + (cw * w / (N_WEEKS - 1));
        const v = state.orderHist[i][w] || 0;
        const y = padT + ch * (1 - v / yMax);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // legend already in HTML
}

// ============================================================
// APP STATE & FLOW
// ============================================================
const STATE = {
  seed: todaySeed(),
  userTier: 1,
  userOrders: [],
  currentOrder: 4,
  sim: null,           // newState()
  agentParams: null,
  demand: null,
  finished: false,
  replay: false        // if true, we're rerunning a shared fragment
};

function $(id) { return document.getElementById(id); }
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ---------- Title ----------
function bindTitle() {
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = parseInt(btn.dataset.tier, 10);
      startRun(STATE.seed, tier);
    });
  });
}

// ---------- Play ----------
function startRun(seed, tier) {
  STATE.seed = seed;
  STATE.userTier = tier;
  STATE.userOrders = [];
  STATE.currentOrder = START_ORDER;
  STATE.demand = buildDemand(seed);
  STATE.agentParams = TIERS.map((_, t) => makeAgentParams(seed, t));
  STATE.sim = newState();
  STATE.finished = false;
  STATE.replay = false;

  $('hudTier').textContent = TIERS[tier];
  $('orderPrompt').textContent = (tier === N_TIERS - 1)
    ? 'Production order (Factory):'
    : 'Order from upstream (' + TIERS[tier + 1] + '):';
  updateHud();
  drawScene();
  show('play');
}

function updateHud() {
  const w = STATE.sim.week;
  const t = STATE.userTier;
  $('hudWeek').textContent = String(w + 1).padStart(2, '0') + ' / 20';
  $('hudInv').textContent = STATE.sim.inventory[t];
  $('hudBack').textContent = STATE.sim.backlog[t];
  $('orderValue').textContent = STATE.currentOrder;
}

function drawScene() {
  const c = $('warehouseCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  drawWarehouseScene(ctx, STATE.sim, STATE.demand, STATE.userTier);
}

function bindPlay() {
  const minus = $('minusBtn');
  const plus = $('plusBtn');
  const submit = $('submitBtn');

  attachOrderButton(minus, -1);
  attachOrderButton(plus, +1);

  submit.addEventListener('click', (e) => {
    e.stopPropagation();
    submitOrder();
  });

  // Keyboard support — stopPropagation so the feedback widget (which
  // listens on textareas) doesn't swallow our keys, and so window-level
  // listeners on the host page can't swallow ours either. See commit 7a02b8e.
  document.addEventListener('keydown', (e) => {
    if (!$('play').classList.contains('active')) return;
    if (STATE.finished) return;
    // Don't hijack typing in the feedback textarea.
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT')) return;
    if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
      nudgeFromKey(+1, e);
    } else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
      nudgeFromKey(-1, e);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      submitOrder();
    }
  });
}

function nudgeFromKey(delta, e) {
  e.preventDefault();
  e.stopPropagation();
  STATE.currentOrder = Math.max(0, Math.min(31, STATE.currentOrder + delta));
  $('orderValue').textContent = STATE.currentOrder;
}

function attachOrderButton(btn, delta) {
  let timer = null;
  let interval = null;
  let triggered = false;

  function nudge() {
    if (STATE.finished) return;
    STATE.currentOrder = Math.max(0, Math.min(31, STATE.currentOrder + delta));
    $('orderValue').textContent = STATE.currentOrder;
  }
  function start(e) {
    e.preventDefault();
    e.stopPropagation();
    triggered = true;
    nudge();
    timer = setTimeout(() => {
      interval = setInterval(nudge, 80);
    }, 350);
  }
  function stop(e) {
    if (e) e.stopPropagation();
    if (timer) { clearTimeout(timer); timer = null; }
    if (interval) { clearInterval(interval); interval = null; }
  }
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

function submitOrder() {
  if (STATE.finished) return;
  if (STATE.sim.week >= N_WEEKS) return;
  const o = STATE.currentOrder | 0;
  STATE.userOrders.push(o);
  tick(STATE.sim, STATE.userTier, o, STATE.demand[STATE.sim.week], STATE.agentParams);
  drawScene();
  updateHud();

  if (STATE.sim.week >= N_WEEKS) {
    STATE.finished = true;
    setTimeout(showAudit, 380);
  }
}

// ---------- Audit ----------
function showAudit() {
  // metrics
  const metrics = userMetrics(STATE.sim, STATE.userTier);
  const archIdx = pickArchetype(metrics);
  const arch = ARCHETYPES[archIdx];

  // file number = seed + tier (deterministic)
  const fileNo = String((STATE.seed + STATE.userTier * 7) % 10000).padStart(4, '0');
  $('auditMeta').textContent = 'Operator: ' + TIERS[STATE.userTier] + ' · File ' + fileNo;
  $('archetypeName').textContent = arch[0];
  $('archetypeBlurb').textContent = arch[1];

  $('metricPeak').textContent = metrics.peak;
  $('metricStockout').textContent = metrics.stockoutWeeks;
  $('metricVar').textContent = metrics.variance.toFixed(1);

  $('verdictLine').textContent = verdictLine(metrics, archIdx);

  // chart
  drawRippleChart($('rippleChart'), STATE.sim);

  // update fragment so this exact run is shareable
  const frag = encodeFragment(STATE.seed, STATE.userTier, STATE.userOrders);
  history.replaceState(null, '', '#' + frag);

  show('audit');
}

function verdictLine(m, idx) {
  // small flavor based on metrics
  const peak = m.peak;
  const so = m.stockoutWeeks;
  const v = m.variance;
  let s = 'You ordered ' + m.totalOrdered + ' cases across 20 weeks. ';
  if (so === 0) s += 'No stockouts. ';
  else if (so <= 2) s += 'A whiff of stockout (' + so + ' wk). ';
  else s += 'Stockouts on ' + so + ' weeks. ';
  if (peak > 30) s += 'Inventory peaked at ' + peak + ' — the warehouse groaned.';
  else if (peak < 6) s += 'You ran the chain on fumes (peak ' + peak + ').';
  else s += 'Inventory peaked at ' + peak + '.';
  return s;
}

// ---------- Share & Restart ----------
function share() {
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: 'My Bullwhip Audit', url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => {
      prompt('Copy this URL:', url);
    });
  } else {
    prompt('Copy this URL:', url);
  }
}

function restart() {
  history.replaceState(null, '', location.pathname);
  STATE.finished = false;
  STATE.userOrders = [];
  show('title');
}

window.share = share;
window.restart = restart;

// ---------- Replay from fragment ----------
function tryReplay() {
  const decoded = decodeFragment(location.hash);
  if (!decoded) return false;
  const { seed, tier, orders } = decoded;
  STATE.seed = seed;
  STATE.userTier = tier;
  STATE.userOrders = orders.slice();
  STATE.demand = buildDemand(seed);
  STATE.agentParams = TIERS.map((_, t) => makeAgentParams(seed, t));
  STATE.sim = newState();
  for (let w = 0; w < N_WEEKS; w++) {
    tick(STATE.sim, tier, orders[w], STATE.demand[w], STATE.agentParams);
  }
  STATE.finished = true;
  STATE.replay = true;
  showAudit();
  return true;
}

// ---------- Boot ----------
function boot() {
  bindTitle();
  bindPlay();
  if (!tryReplay()) {
    show('title');
  }
}

document.addEventListener('DOMContentLoaded', boot);
