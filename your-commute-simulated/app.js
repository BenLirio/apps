// Your Commute, Simulated — procedural pixel-art commute micro-drama

// ── Constants ──────────────────────────────────────────────────────────────

const SIM_DURATION_MS = 60000; // always runs 60 seconds regardless of real commute length
const CANVAS_W = 388;
const CANVAS_H = 200;

const COMMUTE_LABELS = {
  subway: 'SUBWAY',
  bus: 'BUS',
  walk: 'WALK',
  car: 'CAR',
  wfh: 'WFH'
};

// Character sprites (pixel-art via colored rectangles with details)
// Each sprite: { body, head, accent, quirk }
const SPRITE_PALETTE = [
  { body: '#4a90d9', head: '#f5c518', accent: '#ff6b6b' },
  { body: '#39ff14', head: '#e0e0ff', accent: '#f5c518' },
  { body: '#ff6b6b', head: '#f5c518', accent: '#4a90d9' },
  { body: '#b44fea', head: '#e0e0ff', accent: '#39ff14' },
  { body: '#f5c518', head: '#ff6b6b', accent: '#39ff14' },
  { body: '#e0e0ff', head: '#4a90d9', accent: '#b44fea' },
];

// Commuter archetypes per commute type
const COMMUTERS = {
  subway: [
    { id: 'podcast', emoji: '🎧', name: 'Podcast Guy', quirk: 'laughing at nothing', action: 'chuckles audibly at his earbuds' },
    { id: 'phone', emoji: '📱', name: 'Scroll Machine', quirk: 'endless doomscroll', action: 'double-taps something for the 40th time' },
    { id: 'sleeper', emoji: '😴', name: 'Head-Nodder', quirk: 'asleep standing up', action: 'almost head-butts a stranger' },
    { id: 'manspreader', emoji: '👑', name: 'Sovereign of Two Seats', quirk: 'territorial', action: 'sighs at a backpack as if personally wronged' },
    { id: 'bookworm', emoji: '📖', name: 'Physical Book Person', quirk: 'ostentatiously analog', action: 'turns a page with significant eye contact' },
    { id: 'snacker', emoji: '🥪', name: 'Audible Chewer', quirk: 'eating something crunchy', action: 'produces a third snack from a mystery bag' },
  ],
  bus: [
    { id: 'talker', emoji: '📞', name: 'Speakerphone Herald', quirk: 'no earbuds ever', action: 'announces someone\'s business to the whole bus' },
    { id: 'stander', emoji: '🧍', name: 'Doorway Pillar', quirk: 'blocks the exit', action: 'doesn\'t move when you say excuse me' },
    { id: 'driver', emoji: '🚌', name: 'Speed Bus Driver', quirk: 'no gradual stops', action: 'brakes at exactly 0.5g' },
    { id: 'watcher', emoji: '👀', name: 'Window Philosopher', quirk: 'silently judging', action: 'stares at a Walgreens with profound sorrow' },
    { id: 'luggage', emoji: '🧳', name: 'Overloaded Traveler', quirk: 'definitely moving', action: 'apologizes to a seat with a duffel bag' },
    { id: 'scanner', emoji: '🔍', name: 'Stop Name Reader', quirk: 'narrates each stop', action: 'checks the map app even though they take this every day' },
  ],
  walk: [
    { id: 'pacer', emoji: '🏃', name: 'Power Walker', quirk: 'treats sidewalk as track', action: 'overtakes you, sighs at your pace' },
    { id: 'tourist', emoji: '🗺️', name: 'Map Stopper', quirk: 'stops mid-sidewalk', action: 'halts without warning to photograph a fire hydrant' },
    { id: 'dog', emoji: '🐕', name: 'Leash Vector', quirk: 'diagonal leash trajectory', action: 'redirects foot traffic with an 8-foot retractable leash' },
    { id: 'phone_walker', emoji: '📲', name: 'Slow Texter', quirk: 'thumbs > eyes', action: 'walks at 0.3mph into your personal space' },
    { id: 'umbrella', emoji: '☂️', name: 'Umbrella Hazard', quirk: 'low-flying umbrella', action: 'nearly takes out your eye with a spoke' },
    { id: 'parallel', emoji: '👬', name: 'Side-by-Side Pair', quirk: 'full sidewalk coverage', action: 'forms an impenetrable two-person wall' },
  ],
  car: [
    { id: 'merger', emoji: '🚦', name: 'Last-Second Mercer', quirk: 'turn signal optional', action: 'merges with the confidence of someone who has never been wrong' },
    { id: 'phone_driver', emoji: '📵', name: 'Handheld Pilot', quirk: 'definitely texting', action: 'holds phone below window — very subtle' },
    { id: 'horn', emoji: '📯', name: 'Preemptive Honker', quirk: 'anticipates red lights', action: 'honks the millisecond the light changes' },
    { id: 'tailgater', emoji: '🔭', name: 'Draft Seeker', quirk: '0.5 car lengths back', action: 'is now part of your vehicle' },
    { id: 'blinker', emoji: '💡', name: 'Eternal Blinker', quirk: 'blinker since Tuesday', action: 'has been signaling a turn for 4 miles' },
    { id: 'slow_lane', emoji: '🐢', name: 'Left-Lane Philosopher', quirk: '45 in the fast lane', action: 'parks spiritually in the passing lane' },
  ],
  wfh: [
    { id: 'cat', emoji: '🐈', name: 'Cat Keyboard Walk', quirk: 'participates in all meetings', action: 'sends a very important email to a client' },
    { id: 'unmuted', emoji: '🔊', name: 'Unmuted Background', quirk: 'audible life', action: 'eats cereal at full volume on a call' },
    { id: 'couch', emoji: '🛋️', name: 'Ergonomic Skeptic', quirk: 'never at desk', action: 'joins standup from the couch, camera off' },
    { id: 'coffee', emoji: '☕', name: 'Third Cup Person', quirk: 'always refilling', action: 'brews another cup instead of responding to Slack' },
    { id: 'blur', emoji: '🔵', name: 'Background Blur Abuser', quirk: 'mysterious backdrop', action: 'is visually indistinguishable from the meeting thumbnail' },
    { id: 'reply_all', emoji: '📧', name: 'Reply-All Oracle', quirk: 'includes everyone', action: 'CCs 14 people on a one-sentence response' },
  ]
};

// Drama events (what happens between commuters during the simulation)
const DRAMA_EVENTS = {
  subway: [
    (a, b) => `${a.name} stares at ${b.name}'s phone screen. ${b.name} angles it away.`,
    (a, b) => `${a.name} and ${b.name} reach for the same pole. Brief eye contact. Nothing resolved.`,
    (a, b) => `${a.name} falls asleep on ${b.name}'s shoulder. ${b.name} goes rigid.`,
    (a, b) => `${a.name} plays audio. ${b.name} turns up their volume.`,
    (a) => `${a.name} misses the stop. Blames the driver.`,
    (a, b) => `${a.name} and ${b.name} both stand for the same empty seat. Standoff.`,
  ],
  bus: [
    (a, b) => `${a.name} and ${b.name} accidentally ring the stop bell at the same time.`,
    (a, b) => `${a.name} talks over ${b.name}'s speakerphone. Two conversations, zero listeners.`,
    (a, b) => `${a.name} swings into ${b.name} at a sudden stop. Neither acknowledges it.`,
    (a) => `${a.name} misses the stop. Driver doesn't notice.`,
    (a, b) => `${a.name} holds the door for ${b.name} who is 40 feet away and definitely not rushing.`,
  ],
  walk: [
    (a, b) => `${a.name} and ${b.name} do the sidewalk shuffle. Left. Right. Left. Freeze.`,
    (a, b) => `${a.name} clips ${b.name}'s heel. No one apologizes.`,
    (a, b) => `${a.name} forces ${b.name} into the street. ${b.name} pretends it was their idea.`,
    (a) => `${a.name} stops suddenly. The ripple effect continues for half a block.`,
    (a, b) => `${a.name} makes eye contact with ${b.name} 12 feet too early. Now stuck holding it.`,
  ],
  car: [
    (a, b) => `${a.name} cuts off ${b.name}. ${b.name} drives faster to maintain dignity.`,
    (a, b) => `${a.name} and ${b.name} both take the same exit ramp. Awkward merge choreography.`,
    (a, b) => `${a.name} brake-checks ${b.name}. Mutually assured tension.`,
    (a) => `${a.name} is in the wrong lane for 200 yards before admitting it.`,
    (a, b) => `${a.name} waves ${b.name} ahead. ${b.name} does not wave back. War is declared.`,
  ],
  wfh: [
    (a, b) => `${a.name} and ${b.name} both unmute at the same time. A chaos of audio.`,
    (a, b) => `${a.name} asks ${b.name} to repeat their whole statement. Clearly wasn't listening.`,
    (a, b) => `${a.name} sends ${b.name} a Slack. ${b.name} is three feet away.`,
    (a) => `${a.name} joins a meeting two minutes late. "Sorry, had a hard stop."`,
    (a, b) => `${a.name} and ${b.name} both say "you go" on a call. Three times.`,
  ],
};

// Commute archetypes (determined by commute type + cast interactions)
const ARCHETYPES = {
  subway: [
    { name: 'THE SEASONED DELAYER', desc: 'You\'ve made peace with being 4 minutes late. Your watch is set to subway time, a standard recognized only by you.' },
    { name: 'THE DOOR SENTINEL', desc: 'You always stand near the door. Not to exit — just to be ready. For what? You\'ll know when it happens.' },
    { name: 'THE SILENT JUDGE', desc: 'You\'ve ranked everyone in this car. You keep it to yourself. For now.' },
    { name: 'THE PHANTOM SEAT DETECTOR', desc: 'You feel empty seats opening before they open. A gift. A curse.' },
  ],
  bus: [
    { name: 'THE STOP FORECASTER', desc: 'You check the app even though you know the stop. You just need to see it confirmed in numbers.' },
    { name: 'THE AISLE DIPLOMAT', desc: 'You let six people past you to avoid conflict. The seat was yours. You don\'t mind. You do mind.' },
    { name: 'THE EARLY BELL RINGER', desc: 'You ring one stop early and walk. You say it\'s healthy. The truth is more complicated.' },
    { name: 'THE BACK ROW SOVEREIGN', desc: 'You sit in the back, not to be cool, but because the back is where no one talks to you.' },
  ],
  walk: [
    { name: 'THE ROUTE OPTIMIZER', desc: 'You have a B-route and a C-route. You have opinions about crosswalk timing that you share with no one.' },
    { name: 'THE SIDEWALK WEAVER', desc: 'You navigate the pedestrian stream with algorithmic precision. You have never broken stride.' },
    { name: 'THE AGGRESSIVE APOLOGIZER', desc: 'You say sorry when people bump into you. Even when it was them. Especially when it was them.' },
    { name: 'THE PACE VIGILANTE', desc: 'Slow walkers awaken something in you. You have said nothing. You have felt everything.' },
  ],
  car: [
    { name: 'THE MERGE STRATEGIST', desc: 'You plan your lane changes 0.3 miles in advance. You have been let down by last-second mergers. Repeatedly.' },
    { name: 'THE RADIO COMMANDER', desc: 'You have a commute playlist. Tampering with it ends relationships.' },
    { name: 'THE PARKING LOT MEMORY', desc: 'You remember every bad parking job you\'ve ever seen. You keep a mental archive.' },
    { name: 'THE YELLOW LIGHT PHILOSOPHER', desc: 'Every yellow light is a small test of your character. You have complicated feelings about how you\'ve done.' },
  ],
  wfh: [
    { name: 'THE COMMUTE NOSTALGIST', desc: 'Some days you miss the train. Not the commute — just the permission to stare out a window and not be productive.' },
    { name: 'THE PHANTOM COMMUTER', desc: 'You still get dressed. You still make the coffee at the same time. The ritual matters more than the journey.' },
    { name: 'THE HALLWAY WANDERER', desc: 'Your commute is 12 feet. You\'ve optimized it. You\'ve also clocked 8,000 steps just walking between rooms.' },
    { name: 'THE PERMANENT MEETING SURVIVOR', desc: 'Without a commute, your work and not-work have merged into one blurry, screen-lit continuum.' },
  ],
};

// ── Deterministic seed ─────────────────────────────────────────────────────

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

// ── State ──────────────────────────────────────────────────────────────────

let state = {
  commuteType: null,
  durationMin: 25,
  cast: [],
  events: [],
  archetype: null,
  simStart: null,
  simTimer: null,
  animFrame: null,
  seed: 0,
  rand: null,
};

// ── DOM references ─────────────────────────────────────────────────────────

const setupScreen = document.getElementById('setup-screen');
const simScreen = document.getElementById('sim-screen');
const resultScreen = document.getElementById('result-screen');
const typeGrid = document.getElementById('type-grid');
const durDisplay = document.getElementById('dur-display');
const durMinus = document.getElementById('dur-minus');
const durPlus = document.getElementById('dur-plus');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');
const simTypeLabel = document.getElementById('sim-type-label');
const simTimerEl = document.getElementById('sim-timer');
const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');
const eventLog = document.getElementById('event-log');
const computingMsg = document.getElementById('computing-msg');
const archetypeName = document.getElementById('archetype-name');
const archetypeDesc = document.getElementById('archetype-desc');
const commuteStats = document.getElementById('commute-stats');

// ── Setup UI ───────────────────────────────────────────────────────────────

typeGrid.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    typeGrid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.commuteType = btn.dataset.type;
    errorMsg.textContent = '';
  });
});

durMinus.addEventListener('click', () => {
  if (state.durationMin > 5) {
    state.durationMin -= 5;
    durDisplay.textContent = state.durationMin;
  }
});

durPlus.addEventListener('click', () => {
  if (state.durationMin < 120) {
    state.durationMin += 5;
    durDisplay.textContent = state.durationMin;
  }
});

startBtn.addEventListener('click', () => {
  if (!state.commuteType) {
    errorMsg.textContent = 'pick a commute type first — we need to know who you\'re suffering with';
    return;
  }
  errorMsg.textContent = '';
  startSimulation();
});

// ── URL fragment state ─────────────────────────────────────────────────────

function encodeFragment(type, duration) {
  return `${type}-${duration}`;
}

function decodeFragment(frag) {
  const parts = frag.replace('#', '').split('-');
  if (parts.length >= 2) {
    const type = parts[0];
    const duration = parseInt(parts[1], 10);
    if (COMMUTERS[type] && !isNaN(duration) && duration >= 5 && duration <= 120) {
      return { type, duration };
    }
  }
  return null;
}

// ── Simulation ─────────────────────────────────────────────────────────────

function buildCast(type, seed) {
  const pool = [...COMMUTERS[type]];
  const rand = seededRand(seed);
  // Pick 4 commuters deterministically
  const cast = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(rand() * pool.length);
    cast.push(pool.splice(idx, 1)[0]);
  }
  return cast;
}

function buildEvents(type, cast, seed) {
  const dramaPool = DRAMA_EVENTS[type];
  const rand = seededRand(seed + 9999);
  const events = [];
  // Schedule 6 events at random times spread across 60 seconds
  const times = [4, 10, 18, 28, 40, 52];
  for (let i = 0; i < 6; i++) {
    const drama = dramaPool[Math.floor(rand() * dramaPool.length)];
    const a = cast[Math.floor(rand() * cast.length)];
    const b = cast[Math.floor(rand() * cast.length)];
    events.push({
      time: times[i],
      text: drama(a, b !== a ? b : cast[(cast.indexOf(a) + 1) % cast.length]),
      fired: false,
    });
  }
  return events;
}

function pickArchetype(type, seed) {
  const pool = ARCHETYPES[type];
  return pool[hash(String(seed)) % pool.length];
}

function startSimulation() {
  // Compute seed from type + duration
  state.seed = hash(state.commuteType + ':' + state.durationMin);
  state.rand = seededRand(state.seed);

  // Build cast and events
  state.cast = buildCast(state.commuteType, state.seed);
  state.events = buildEvents(state.commuteType, state.cast, state.seed);
  state.archetype = pickArchetype(state.commuteType, state.seed);

  // Update URL fragment
  location.hash = encodeFragment(state.commuteType, state.durationMin);

  // Show sim screen
  setupScreen.style.display = 'none';
  simScreen.style.display = 'flex';
  simTypeLabel.textContent = COMMUTE_LABELS[state.commuteType];

  // Set up canvas
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // Clear log
  eventLog.innerHTML = '';
  computingMsg.style.display = 'none';

  // Log cast intro
  addLogEntry(`PASSENGERS: ${state.cast.map(c => c.emoji + ' ' + c.name).join(', ')}`, false);

  // Start animation
  state.simStart = performance.now();
  state.animFrame = requestAnimationFrame(simLoop);
}

let lastEventCheck = -1;

function simLoop(now) {
  const elapsed = (now - state.simStart) / 1000; // seconds
  const progress = Math.min(elapsed / 60, 1);

  // Update timer
  const sec = Math.floor(elapsed);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  simTimerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;

  // Draw frame
  drawFrame(progress);

  // Fire events
  state.events.forEach(ev => {
    if (!ev.fired && elapsed >= ev.time) {
      ev.fired = true;
      addLogEntry(ev.text, true);
    }
  });

  if (progress < 1) {
    state.animFrame = requestAnimationFrame(simLoop);
  } else {
    // Done — show computing message then reveal
    computingMsg.style.display = 'block';
    setTimeout(revealResult, 1000);
  }
}

function addLogEntry(text, isEvent) {
  const line = document.createElement('div');
  line.className = 'event-line' + (isEvent ? '' : ' dim');
  line.textContent = (isEvent ? '> ' : '  ') + text;
  eventLog.appendChild(line);
  eventLog.scrollTop = eventLog.scrollHeight;
  // Keep max 8 lines
  while (eventLog.children.length > 8) {
    eventLog.removeChild(eventLog.firstChild);
  }
}

// ── Canvas rendering ───────────────────────────────────────────────────────

function drawFrame(progress) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (state.commuteType === 'subway') drawSubwayScene(progress);
  else if (state.commuteType === 'bus') drawBusScene(progress);
  else if (state.commuteType === 'walk') drawWalkScene(progress);
  else if (state.commuteType === 'car') drawCarScene(progress);
  else if (state.commuteType === 'wfh') drawWfhScene(progress);
}

function drawBackground(colors, scrollX) {
  // Sky / wall
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// Scrolling pixel offset
function scrollOff(progress, speed) {
  return Math.floor(progress * speed) % CANVAS_W;
}

function drawSubwayScene(progress) {
  const off = scrollOff(progress, 2400);

  // Dark tunnel walls
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Floor
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 160, CANVAS_W, 40);

  // Rails
  ctx.fillStyle = '#4a4e8c';
  for (let x = -off; x < CANVAS_W + 32; x += 32) {
    ctx.fillRect(x, 170, 20, 4);
  }

  // Tunnel walls (dark columns)
  ctx.fillStyle = '#2a2a3e';
  for (let x = (-off * 0.5) % 80 - 80; x < CANVAS_W + 80; x += 80) {
    ctx.fillRect(x, 0, 8, 160);
  }

  // Window flashes
  ctx.fillStyle = '#f5c51822';
  for (let x = (-off * 0.3) % 120 - 120; x < CANVAS_W + 120; x += 120) {
    ctx.fillRect(x + 20, 30, 60, 100);
  }

  // Ceiling bar / poles
  ctx.fillStyle = '#4a4e8c';
  ctx.fillRect(0, 20, CANVAS_W, 6);

  // Grab poles
  for (let x = 60; x < CANVAS_W; x += 90) {
    ctx.fillStyle = '#7a7aaa';
    ctx.fillRect(x, 20, 4, 140);
  }

  drawCommuterCast(state.cast, progress, 100, 140, 'subway');
}

function drawBusScene(progress) {
  const off = scrollOff(progress, 1800);

  // Interior
  ctx.fillStyle = '#1c1010';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Window row
  ctx.fillStyle = '#1a2a3a';
  for (let x = -off % 80; x < CANVAS_W; x += 80) {
    ctx.fillRect(x, 10, 55, 50);
    // moving scenery inside window
    ctx.fillStyle = '#39ff1422';
    ctx.fillRect(x + 5, 20, 20, 5);
    ctx.fillStyle = '#1a2a3a';
  }

  // Seats
  ctx.fillStyle = '#3a1010';
  for (let x = 10; x < CANVAS_W; x += 80) {
    ctx.fillRect(x, 120, 50, 40);
    ctx.fillRect(x, 110, 50, 14);
  }

  // Floor
  ctx.fillStyle = '#2a1818';
  ctx.fillRect(0, 160, CANVAS_W, 40);

  // Aisle line
  ctx.fillStyle = '#4a2828';
  ctx.fillRect(0, 158, CANVAS_W, 4);

  drawCommuterCast(state.cast, progress, 70, 130, 'bus');
}

function drawWalkScene(progress) {
  const off = scrollOff(progress, 1600);

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 100);
  skyGrad.addColorStop(0, '#0d0d2a');
  skyGrad.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, 120);

  // Buildings (scrolling)
  const buildColors = ['#1a1a2e', '#2a1a3e', '#1a2a2e'];
  for (let i = 0; i < 6; i++) {
    const bx = ((i * 90 - off * 0.6) % (CANVAS_W + 90) + CANVAS_W + 90) % (CANVAS_W + 90) - 90;
    const bh = 40 + (i * 23 % 60);
    ctx.fillStyle = buildColors[i % 3];
    ctx.fillRect(bx, 120 - bh, 70, bh);
    // windows
    ctx.fillStyle = '#f5c51833';
    for (let wy = 6; wy < bh - 6; wy += 14) {
      for (let wx = 6; wx < 60; wx += 14) {
        if ((i + wy + wx) % 3 !== 0) ctx.fillRect(bx + wx, 120 - bh + wy, 8, 8);
      }
    }
  }

  // Sidewalk
  ctx.fillStyle = '#2e2e2e';
  ctx.fillRect(0, 120, CANVAS_W, 80);

  // Sidewalk cracks
  ctx.fillStyle = '#1a1a1a';
  for (let x = (-off * 0.8) % 60; x < CANVAS_W; x += 60) {
    ctx.fillRect(x, 120, 2, 80);
  }

  // Curb
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 120, CANVAS_W, 4);

  drawCommuterCast(state.cast, progress, 120, 160, 'walk');
}

function drawCarScene(progress) {
  const off = scrollOff(progress, 3000);

  // Road
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Lane markings
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(0, 95, CANVAS_W, 4);

  ctx.fillStyle = '#ffffffaa';
  for (let x = -off % 80; x < CANVAS_W; x += 80) {
    ctx.fillRect(x, 45, 50, 6);
    ctx.fillRect(x, 150, 50, 6);
  }

  // Road edges
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, CANVAS_W, 10);
  ctx.fillRect(0, CANVAS_H - 10, CANVAS_W, 10);

  // Other cars (background, scrolling fast)
  drawCar(ctx, ((CANVAS_W * 0.2 - off * 2.1) % CANVAS_W + CANVAS_W) % CANVAS_W, 20, '#4a90d9');
  drawCar(ctx, ((CANVAS_W * 0.6 - off * 1.7) % CANVAS_W + CANVAS_W) % CANVAS_W, 155, '#ff6b6b');
  drawCar(ctx, ((CANVAS_W * 0.85 - off * 2.3) % CANVAS_W + CANVAS_W) % CANVAS_W, 20, '#39ff14');

  // Player car (center lane, stationary)
  drawCar(ctx, 160, 95, '#f5c518', true);
}

function drawCar(ctx, x, y, color, isPlayer) {
  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 10, 56, 24);
  // Cabin
  ctx.fillStyle = isPlayer ? '#fff' : '#aaa';
  ctx.fillRect(x + 10, y + 4, 36, 14);
  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 6, y + 30, 14, 8);
  ctx.fillRect(x + 36, y + 30, 14, 8);
  if (isPlayer) {
    ctx.fillStyle = '#f5c51866';
    ctx.fillRect(x - 20, y + 14, 20, 8);
  }
}

function drawWfhScene(progress) {
  // Room background
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Wall
  ctx.fillStyle = '#22223a';
  ctx.fillRect(0, 0, CANVAS_W, 130);

  // Floor
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(0, 130, CANVAS_W, 70);

  // Window
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(30, 20, 80, 60);
  // Daylight outside
  const t = progress;
  const skyR = Math.floor(20 + t * 40);
  const skyB = Math.floor(60 + t * 80);
  ctx.fillStyle = `rgb(${skyR},${skyR + 10},${skyB})`;
  ctx.fillRect(34, 24, 72, 52);
  // Window cross
  ctx.fillStyle = '#22223a';
  ctx.fillRect(34, 48, 72, 4);
  ctx.fillRect(68, 24, 4, 52);

  // Desk
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(100, 120, 260, 16);
  ctx.fillRect(100, 136, 12, 40);
  ctx.fillRect(348, 136, 12, 40);

  // Monitor
  ctx.fillStyle = '#111';
  ctx.fillRect(180, 72, 100, 50);
  ctx.fillStyle = '#0d0d3a';
  ctx.fillRect(184, 76, 92, 42);
  // Screen glow (pulse with progress)
  ctx.fillStyle = `rgba(74,144,217,${0.3 + Math.sin(progress * Math.PI * 8) * 0.1})`;
  ctx.fillRect(184, 76, 92, 42);
  // Monitor stand
  ctx.fillStyle = '#333';
  ctx.fillRect(224, 122, 12, 6);

  // Cat (wfh only)
  if (state.commuteType === 'wfh') {
    const catX = Math.floor(30 + Math.sin(progress * Math.PI * 2) * 10);
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(catX + 130, 108, 22, 14);
    ctx.fillRect(catX + 134, 100, 14, 12);
    // Ears
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(catX + 134, 96, 4, 6);
    ctx.fillRect(catX + 144, 96, 4, 6);
    // Eyes
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(catX + 137, 103, 3, 3);
    ctx.fillRect(catX + 144, 103, 3, 3);
  }

  // Person at desk
  const blink = Math.floor(progress * 60) % 40 === 0;
  drawDesktopPerson(ctx, 220, 90, blink);
}

function drawDesktopPerson(ctx, x, y, blink) {
  // Head
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(x, y, 20, 22);
  // Eyes
  if (!blink) {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(x + 4, y + 7, 4, 4);
    ctx.fillRect(x + 12, y + 7, 4, 4);
  } else {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(x + 4, y + 9, 4, 1);
    ctx.fillRect(x + 12, y + 9, 4, 1);
  }
  // Body
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(x - 6, y + 22, 32, 28);
  // Arms
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(x - 14, y + 22, 10, 20);
  ctx.fillRect(x + 30, y + 22, 10, 20);
}

function drawCommuterCast(cast, progress, groundY, maxY, type) {
  // Place 4 commuters along the scene
  const spacing = CANVAS_W / (cast.length + 1);
  cast.forEach((commuter, i) => {
    const baseX = spacing * (i + 1);
    // Subtle bobbing
    const bob = Math.sin(progress * Math.PI * 4 + i) * 3;
    const pal = SPRITE_PALETTE[i % SPRITE_PALETTE.length];
    drawPixelPerson(ctx, baseX - 12, groundY - 56 + bob, pal, commuter);
  });
}

function drawPixelPerson(ctx, x, y, pal, commuter) {
  // Head
  ctx.fillStyle = pal.head;
  ctx.fillRect(x + 4, y, 16, 16);
  // Eyes
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(x + 7, y + 5, 3, 3);
  ctx.fillRect(x + 14, y + 5, 3, 3);
  // Body
  ctx.fillStyle = pal.body;
  ctx.fillRect(x, y + 16, 24, 22);
  // Arms
  ctx.fillStyle = pal.body;
  ctx.fillRect(x - 6, y + 16, 8, 16);
  ctx.fillRect(x + 22, y + 16, 8, 16);
  // Legs
  ctx.fillStyle = pal.accent;
  ctx.fillRect(x + 2, y + 38, 8, 18);
  ctx.fillRect(x + 14, y + 38, 8, 18);
  // Feet
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y + 54, 10, 6);
  ctx.fillRect(x + 12, y + 54, 10, 6);
  // Emoji label above
  ctx.font = '12px serif';
  ctx.fillText(commuter.emoji, x + 3, y - 4);
}

// ── Result reveal ──────────────────────────────────────────────────────────

function revealResult() {
  cancelAnimationFrame(state.animFrame);
  simScreen.style.display = 'none';
  resultScreen.style.display = 'flex';

  archetypeName.textContent = state.archetype.name;
  archetypeDesc.textContent = state.archetype.desc;

  const castNames = state.cast.map(c => c.emoji + ' ' + c.name).join('  ·  ');
  commuteStats.innerHTML = `${state.durationMin}-MIN ${COMMUTE_LABELS[state.commuteType]}<br>CAST: ${castNames}`;
}

// ── Share & restart ────────────────────────────────────────────────────────

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}

function restartApp() {
  location.hash = '';
  resultScreen.style.display = 'none';
  setupScreen.style.display = 'flex';
  // Reset type selection
  typeGrid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  state.commuteType = null;
}

// ── Init from URL fragment ─────────────────────────────────────────────────

(function init() {
  if (location.hash) {
    const parsed = decodeFragment(location.hash);
    if (parsed) {
      state.commuteType = parsed.type;
      state.durationMin = parsed.duration;
      durDisplay.textContent = state.durationMin;
      // Highlight the correct type button
      const btn = typeGrid.querySelector(`[data-type="${parsed.type}"]`);
      if (btn) btn.classList.add('selected');
      // Auto-start
      startSimulation();
      return;
    }
  }
})();
