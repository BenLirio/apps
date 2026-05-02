// Critter Cauldron — pick critters from a catalog, twist universe knobs,
// watch a tiny made-up ecosystem bubble away.
//
// All "creatures" are user-picked entries from CATALOG. Plants are universal.

// ─── CATALOG OF FANTASY CRITTERS ──────────────────────────────────────────────
// Each critter is fully specified — diet, behavior, looks. Pick any combo.
const CATALOG = [
  // PLANT-EATERS
  {
    id: 'fluffin', name: 'Fluffin', emoji: '🐰',
    eats: 'plants', size: 6, maxSpeed: 1.4, hungerTick: 0.0014, repro: 0.00045,
    senseRadius: 95, eatRadius: 11, maxPop: 70, color: '#ffd5e8', shape: 'puff',
    aggression: 0.05, flockRadius: 35, lifespan: 1100,
    blurb: 'Hopping pink puffs.',
  },
  {
    id: 'mossling', name: 'Mossling', emoji: '🐢',
    eats: 'plants', size: 8, maxSpeed: 0.55, hungerTick: 0.0009, repro: 0.0002,
    senseRadius: 70, eatRadius: 14, maxPop: 35, color: '#7be39f', shape: 'shell',
    aggression: 0, flockRadius: 0, lifespan: 1800,
    blurb: 'Slow, leafy, near-immortal.',
  },
  {
    id: 'sproutbug', name: 'Sproutbug', emoji: '🐛',
    eats: 'plants', size: 4, maxSpeed: 1.0, hungerTick: 0.0017, repro: 0.0006,
    senseRadius: 60, eatRadius: 8, maxPop: 90, color: '#a3e635', shape: 'wiggler',
    aggression: 0, flockRadius: 25, lifespan: 700,
    blurb: 'Tiny green grazers, breed fast.',
  },
  {
    id: 'glowdeer', name: 'Glowdeer', emoji: '🦌',
    eats: 'plants', size: 9, maxSpeed: 1.7, hungerTick: 0.0013, repro: 0.00022,
    senseRadius: 130, eatRadius: 14, maxPop: 30, color: '#fbbf24', shape: 'antlered',
    aggression: 0.1, flockRadius: 60, lifespan: 1400,
    blurb: 'Graceful glowing herd.',
  },
  // HUNTERS (eat herbivores)
  {
    id: 'velvox', name: 'Velvox', emoji: '🐺',
    eats: 'herbivores', size: 9, maxSpeed: 1.7, hungerTick: 0.0011, repro: 0.00014,
    senseRadius: 140, eatRadius: 14, maxPop: 18, color: '#a78bfa', shape: 'sleek',
    aggression: 0.7, flockRadius: 50, lifespan: 1500,
    blurb: 'Pack hunters, violet pelt.',
  },
  {
    id: 'sparrowhawk', name: 'Skyhawk', emoji: '🦅',
    eats: 'herbivores', size: 7, maxSpeed: 2.2, hungerTick: 0.0013, repro: 0.00012,
    senseRadius: 170, eatRadius: 12, maxPop: 14, color: '#f97316', shape: 'arrow',
    aggression: 0.8, flockRadius: 0, lifespan: 1300,
    blurb: 'Fast, far-seeing, solitary.',
  },
  {
    id: 'shadowmaw', name: 'Shadowmaw', emoji: '🦇',
    eats: 'herbivores', size: 8, maxSpeed: 1.4, hungerTick: 0.0009, repro: 0.0001,
    senseRadius: 110, eatRadius: 13, maxPop: 12, color: '#475569', shape: 'spike',
    aggression: 0.65, flockRadius: 0, lifespan: 1700, nocturnal: true,
    blurb: 'Stalks at night, sleeps by day.',
  },
  // APEX (eat predators)
  {
    id: 'behemoth', name: 'Behemoth', emoji: '🐉',
    eats: 'predators', size: 13, maxSpeed: 0.9, hungerTick: 0.0006, repro: 0.00005,
    senseRadius: 180, eatRadius: 18, maxPop: 5, color: '#dc2626', shape: 'tank',
    aggression: 0.9, flockRadius: 0, lifespan: 2400,
    blurb: 'Apex of apex. Picks off hunters.',
  },
  // OMNIVORES
  {
    id: 'oozekin', name: 'Oozekin', emoji: '🟢',
    eats: 'omnivore', size: 7, maxSpeed: 0.8, hungerTick: 0.0011, repro: 0.0002,
    senseRadius: 80, eatRadius: 12, maxPop: 25, color: '#22d3ee', shape: 'blob',
    aggression: 0.4, flockRadius: 0, lifespan: 1300,
    blurb: 'Bouncy blob, eats anything.',
  },
  {
    id: 'crackle', name: 'Crackle', emoji: '⚡',
    eats: 'omnivore', size: 5, maxSpeed: 2.0, hungerTick: 0.0017, repro: 0.0003,
    senseRadius: 100, eatRadius: 10, maxPop: 35, color: '#fde047', shape: 'star',
    aggression: 0.5, flockRadius: 0, lifespan: 900,
    blurb: 'Zippy electric scavenger.',
  },
  {
    id: 'mistmoth', name: 'Mistmoth', emoji: '🦋',
    eats: 'plants', size: 5, maxSpeed: 1.3, hungerTick: 0.0012, repro: 0.0004,
    senseRadius: 75, eatRadius: 9, maxPop: 60, color: '#c084fc', shape: 'wing',
    aggression: 0, flockRadius: 40, lifespan: 850,
    blurb: 'Dreamy purple flutter.',
  },
  {
    id: 'ironcrab', name: 'Ironcrab', emoji: '🦀',
    eats: 'herbivores', size: 7, maxSpeed: 0.7, hungerTick: 0.0007, repro: 0.00009,
    senseRadius: 90, eatRadius: 12, maxPop: 12, color: '#f87171', shape: 'shell',
    aggression: 0.5, flockRadius: 0, lifespan: 2000,
    blurb: 'Slow tank, never starves.',
  },
];

// ─── WORLD VIBES (palette presets) ────────────────────────────────────────────
const VIBES = {
  meadow: {
    label: 'Sun Meadow',
    skyDay: [255, 213, 128], skyNight: [80, 40, 110], ground: [80, 160, 90],
    plantHue: [100, 220, 140],
  },
  reef: {
    label: 'Coral Reef',
    skyDay: [80, 200, 230], skyNight: [10, 40, 90], ground: [40, 120, 160],
    plantHue: [255, 130, 200],
  },
  dusk: {
    label: 'Neon Dusk',
    skyDay: [200, 100, 200], skyNight: [25, 10, 60], ground: [50, 30, 90],
    plantHue: [180, 255, 220],
  },
  frost: {
    label: 'Frost Garden',
    skyDay: [200, 230, 255], skyNight: [30, 50, 110], ground: [180, 200, 220],
    plantHue: [180, 230, 240],
  },
  lava: {
    label: 'Ember Lands',
    skyDay: [255, 140, 60], skyNight: [80, 20, 0], ground: [120, 50, 30],
    plantHue: [255, 200, 100],
  },
  dream: {
    label: 'Dream Static',
    skyDay: [180, 150, 255], skyNight: [40, 20, 80], ground: [80, 60, 130],
    plantHue: [255, 210, 240],
  },
};

// ─── CONFIG / DEFAULT WORLD ───────────────────────────────────────────────────
// The default starts with three plant-eaters + one hunter, deliberately
// prey-heavy so the food web has time to settle before predation pressure.
const DEFAULT_WORLD = {
  selected: ['sproutbug', 'fluffin', 'mossling', 'velvox'],
  knobs: {
    plants: 1.0,
    day: 1.0,
    weather: 1.0,
    metabolism: 1.0,
    fertility: 1.0,
    vibe: 'meadow',
  },
};

const CFG = {
  basePlantMax: 240,
  basePlantGrowRate: 0.08,
  milestoneSeconds: 90,
};

// Initial population per species — scaled to maxPop and trophic role so
// hunters and apex don't outnumber the prey they need to survive on.
// Previously every species started at 9, which let predators wipe out prey
// before the simulation had a chance to find equilibrium.
function initialCountFor(spec) {
  let frac;
  switch (spec.eats) {
    case 'plants':     frac = 0.25; break;  // most prey
    case 'omnivore':   frac = 0.18; break;
    case 'herbivores': frac = 0.18; break;  // hunters — clearly fewer than prey
    case 'predators':  frac = 0.40; break;  // apex (already capped tiny)
    default:           frac = 0.20;
  }
  const minByRole = (spec.eats === 'predators' || spec.eats === 'herbivores') ? 2 : 6;
  return Math.max(minByRole, Math.round(spec.maxPop * frac));
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let canvas, ctx, W, H;
let plants = [], critters = [];
let simTime = 0, realTime = 0, lastMilestone = -1;
let speed = 1, paused = false;
let weather = 'sun', weatherTimer = 0, weatherDuration = 0;
let skyBrightness = 1, dayTimer = 0;
let world = JSON.parse(JSON.stringify(DEFAULT_WORLD));
let rng;
let pendingWorld = null;

// ─── SEEDED RNG ───────────────────────────────────────────────────────────────
function mkRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── ENTITY FACTORIES ─────────────────────────────────────────────────────────
function mkPlant(x, y) {
  return {
    x, y,
    age: rng() * 30,
    size: 4 + rng() * 3,
    variant: Math.floor(rng() * 4),
    wobble: rng() * Math.PI * 2,
  };
}

function mkCritter(x, y, spec) {
  return {
    x, y,
    vx: (rng() - 0.5) * spec.maxSpeed,
    vy: (rng() - 0.5) * spec.maxSpeed,
    hunger: rng() * 0.3,
    age: 0,
    spec,
  };
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function plantMax() {
  return Math.floor(CFG.basePlantMax * world.knobs.plants);
}

function plantGrowRate() {
  return CFG.basePlantGrowRate * world.knobs.plants * world.knobs.fertility;
}

function getActiveSpecs() {
  return world.selected.map(id => CATALOG.find(c => c.id === id)).filter(Boolean);
}

function initSim(seed) {
  rng = mkRng(seed >>> 0);
  plants = [];
  critters = [];
  simTime = 0; realTime = 0; lastMilestone = -1;
  weatherTimer = 0; weatherDuration = 30 + rng() * 60;
  weather = 'sun'; skyBrightness = 1; dayTimer = 0;

  const pm = plantMax();
  // Start full of plants so herbivores have plenty
  for (let i = 0; i < Math.floor(pm * 0.9); i++)
    plants.push(mkPlant(rng() * W, rng() * H));

  // Spawn each selected species — counts scale by trophic role so prey
  // outnumber hunters (and hunters outnumber apex) at start.
  for (const spec of getActiveSpecs()) {
    const init = initialCountFor(spec);
    for (let i = 0; i < init; i++)
      critters.push(mkCritter(rng() * W, rng() * H, spec));
  }
}

// ─── WEATHER ──────────────────────────────────────────────────────────────────
const WEATHER_LABELS = { sun: '☀ SUN', rain: '🌧 RAIN', drought: '🌵 DRY', storm: '⛈ STORM' };

function tickWeather(dt) {
  weatherTimer += dt;
  if (weatherTimer >= weatherDuration) {
    weatherTimer = 0;
    const chaos = world.knobs.weather;
    weatherDuration = (60 + rng() * 100) / Math.max(0.3, chaos);
    const roll = rng();
    if (chaos === 0) weather = 'sun';
    else if (roll < 0.5) weather = 'sun';
    else if (roll < 0.78) weather = 'rain';
    else if (roll < 0.92) weather = 'drought';
    else weather = 'storm';
    document.getElementById('weather-label').textContent = WEATHER_LABELS[weather];
  }
}

function tickDayNight(dt) {
  dayTimer += dt * world.knobs.day;
  const period = 200;
  const phase = (dayTimer % period) / period;
  skyBrightness = Math.max(0.1, Math.sin(phase * Math.PI * 2) * 0.5 + 0.6);
}

// ─── DIST / STEER ─────────────────────────────────────────────────────────────
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function steer(entity, tx, ty, sp) {
  const dx = tx - entity.x, dy = ty - entity.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  entity.vx += (dx / d) * sp * 0.22;
  entity.vy += (dy / d) * sp * 0.22;
}

function clampSpeed(e, maxSpd) {
  const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
  if (spd > maxSpd) { e.vx = e.vx / spd * maxSpd; e.vy = e.vy / spd * maxSpd; }
}

function wrap(e) {
  if (e.x < 0) e.x += W;
  if (e.x > W) e.x -= W;
  if (e.y < 0) e.y += H;
  if (e.y > H) e.y -= H;
}

// ─── SIM TICK ─────────────────────────────────────────────────────────────────
function tick(dt) {
  simTime += dt;
  realTime += dt;

  tickWeather(dt);
  tickDayNight(dt);

  const pm = plantMax();
  const pgr = plantGrowRate();

  // Plant growth: more rolls when low, weather modifies
  const growMod = weather === 'rain' ? 2.5 : weather === 'drought' ? 0.25 : weather === 'storm' ? 0.7 : 1;
  const growNight = 0.45 + skyBrightness * 0.55;
  const scarcityBonus = plants.length < pm * 0.15 ? 4.5 : plants.length < pm * 0.35 ? 2.0 : 1.0;
  const rolls = Math.ceil(pm / 8);
  for (let i = 0; i < rolls; i++) {
    if (plants.length >= pm) break;
    if (rng() < pgr * dt * 60 * growMod * growNight * scarcityBonus) {
      const parent = plants.length ? plants[Math.floor(rng() * plants.length)] : { x: rng() * W, y: rng() * H };
      plants.push(mkPlant(
        ((parent.x + (rng() - 0.5) * 60) + W) % W,
        ((parent.y + (rng() - 0.5) * 60) + H) % H
      ));
    }
  }

  // Critters
  const next = [];
  // Pre-bucket by species id for flock + repro counts
  const speciesCounts = {};
  for (const c of critters) speciesCounts[c.spec.id] = (speciesCounts[c.spec.id] || 0) + 1;

  for (const c of critters) {
    c.age += dt;
    const isActiveNow = c.spec.nocturnal ? skyBrightness < 0.5 : true;
    const speedMult = isActiveNow ? 1.0 : 0.35;
    const hungerMod = (weather === 'storm' ? 1.15 : 1) * world.knobs.metabolism;
    c.hunger += c.spec.hungerTick * dt * 60 * (isActiveNow ? 1.0 : 0.45) * hungerMod;

    // Choose prey list
    let preyList = [];
    if (c.spec.eats === 'plants') preyList = plants;
    else if (c.spec.eats === 'herbivores') preyList = critters.filter(o => o.spec.eats === 'plants');
    else if (c.spec.eats === 'predators') preyList = critters.filter(o => o.spec.eats === 'herbivores');
    else if (c.spec.eats === 'omnivore') preyList = [...plants, ...critters.filter(o => o.spec.eats === 'plants')];

    let prey = null, preyDist = c.spec.senseRadius;
    for (const p of preyList) {
      if (p === c) continue;
      const d = dist(c, p);
      if (d < preyDist) { preyDist = d; prey = p; }
    }
    // Hungry critters can search wider
    if (!prey && c.hunger > 0.55) {
      let bestD = c.spec.senseRadius * 3;
      for (const p of preyList) {
        if (p === c) continue;
        const d = dist(c, p);
        if (d < bestD) { bestD = d; prey = p; }
      }
      preyDist = bestD;
    }

    // Flee if something eats us
    let flee = false;
    let preyOfWhom = null;
    if (c.spec.eats === 'plants') preyOfWhom = ['herbivores', 'omnivore'];
    else if (c.spec.eats === 'herbivores') preyOfWhom = ['predators'];
    if (preyOfWhom) {
      for (const o of critters) {
        if (preyOfWhom.includes(o.spec.eats) && dist(c, o) < c.spec.senseRadius) {
          steer(c, c.x - (o.x - c.x), c.y - (o.y - c.y), c.spec.maxSpeed * 1.6 * speedMult);
          flee = true; break;
        }
      }
    }

    // Flocking
    if (!flee && c.spec.flockRadius > 0) {
      let nx = 0, ny = 0, n = 0;
      for (const o of critters) {
        if (o === c || o.spec.id !== c.spec.id) continue;
        if (dist(c, o) < c.spec.flockRadius) {
          nx += o.x; ny += o.y; n++;
        }
      }
      if (n > 0) {
        steer(c, nx / n, ny / n, c.spec.maxSpeed * 0.25 * speedMult);
      }
    }

    if (!flee && prey) {
      steer(c, prey.x, prey.y, c.spec.maxSpeed * speedMult);
    } else if (!flee) {
      c.vx += (rng() - 0.5) * 0.3;
      c.vy += (rng() - 0.5) * 0.3;
    }

    clampSpeed(c, c.spec.maxSpeed * speedMult);
    c.x += c.vx; c.y += c.vy;
    wrap(c);

    // Eat
    if (prey && preyDist < c.spec.eatRadius) {
      if (c.spec.eats === 'plants') {
        const i = plants.indexOf(prey);
        if (i !== -1) { plants.splice(i, 1); c.hunger = Math.max(0, c.hunger - 0.55); }
      } else if (c.spec.eats === 'omnivore') {
        const ip = plants.indexOf(prey);
        if (ip !== -1) { plants.splice(ip, 1); c.hunger = Math.max(0, c.hunger - 0.4); }
        else {
          prey._dead = true;
          c.hunger = Math.max(0, c.hunger - 0.65);
        }
      } else {
        prey._dead = true;
        c.hunger = Math.max(0, c.hunger - 0.72);
      }
    }

    // Death
    if (c._dead || c.hunger >= 1 || c.age > c.spec.lifespan) continue;

    // Reproduction (capped per species, knobs.fertility scales)
    const cap = c.spec.maxPop;
    const cnt = speciesCounts[c.spec.id] || 0;
    if (c.hunger < 0.5 && cnt < cap && rng() < c.spec.repro * dt * 60 * world.knobs.fertility) {
      next.push(mkCritter(c.x + (rng() - 0.5) * 12, c.y + (rng() - 0.5) * 12, c.spec));
      speciesCounts[c.spec.id] = cnt + 1;
    }

    next.push(c);
  }
  critters = next;

  updatePopCounts();

  const milestoneIndex = Math.floor(simTime / CFG.milestoneSeconds);
  if (milestoneIndex > lastMilestone) {
    lastMilestone = milestoneIndex;
    if (milestoneIndex > 0) showReport(milestoneIndex);
  }
}

function updatePopCounts() {
  const counts = {};
  for (const c of critters) counts[c.spec.id] = (counts[c.spec.id] || 0) + 1;
  let txt = `🌿${plants.length}`;
  for (const spec of getActiveSpecs()) {
    const n = counts[spec.id] || 0;
    txt += ` ${spec.emoji}${n}`;
  }
  document.getElementById('pop-counts').textContent = txt;
  renderFoodWeb(counts);
}

// ─── FOOD WEB PANEL ───────────────────────────────────────────────────────────
// Compact view of the trophic structure: who eats whom, with current
// populations. Throttled to a few refreshes per second so we're not
// rebuilding DOM on every animation frame.
let _fwLastRender = 0;
function renderFoodWeb(counts) {
  const body = document.getElementById('foodweb-body');
  if (!body) return;
  const panel = document.getElementById('foodweb-panel');
  if (!panel || !panel.classList.contains('open')) return;
  const now = performance.now();
  if (now - _fwLastRender < 250) return; // throttle
  _fwLastRender = now;

  const active = getActiveSpecs();
  const byTier = {
    plants:     [],
    omnivore:   [],
    herbivores: [],
    predators:  [],
  };
  for (const sp of active) {
    if (byTier[sp.eats]) byTier[sp.eats].push(sp);
  }

  const renderRow = (tierLabel, entries, plantCount) => {
    if (entries.length === 0 && plantCount === undefined) return '';
    const items = plantCount !== undefined
      ? `<span class="fw-cell plant"><span class="fw-emoji">🌿</span><span class="fw-count">${plantCount}</span></span>`
      : entries.map(sp => {
          const n = counts[sp.id] || 0;
          const dim = n === 0 ? ' empty' : '';
          return `<span class="fw-cell${dim}" title="${sp.name}: ${n}"><span class="fw-emoji">${sp.emoji}</span><span class="fw-count">${n}</span></span>`;
        }).join('');
    return `<div class="fw-tier"><span class="fw-tier-label">${tierLabel}</span><span class="fw-row">${items}</span></div>`;
  };

  const eatsArrow = '<div class="fw-arrow">↑ eaten by</div>';
  const parts = [];
  parts.push(renderRow('Plants', [], plants.length));
  // Plant-eaters tier (always show even if empty so the structure is visible)
  if (byTier.plants.length || byTier.omnivore.length) {
    parts.push(eatsArrow);
    const grazers = [...byTier.plants];
    parts.push(renderRow('Grazers', grazers));
  }
  if (byTier.omnivore.length) {
    // Omnivores eat plants AND herbivores — slot them between tiers
    parts.push(`<div class="fw-tier"><span class="fw-tier-label">Omnivores</span><span class="fw-row">${
      byTier.omnivore.map(sp => {
        const n = counts[sp.id] || 0;
        const dim = n === 0 ? ' empty' : '';
        return `<span class="fw-cell${dim}" title="${sp.name}: ${n}"><span class="fw-emoji">${sp.emoji}</span><span class="fw-count">${n}</span></span>`;
      }).join('')
    }</span></div>`);
  }
  if (byTier.herbivores.length) {
    parts.push(eatsArrow);
    parts.push(renderRow('Hunters', byTier.herbivores));
  }
  if (byTier.predators.length) {
    parts.push(eatsArrow);
    parts.push(renderRow('Apex', byTier.predators));
  }

  body.innerHTML = parts.join('');
}

function toggleFoodWeb() {
  const panel = document.getElementById('foodweb-panel');
  const btn = document.getElementById('fw-toggle');
  panel.classList.toggle('open');
  if (btn) btn.textContent = panel.classList.contains('open') ? '−' : '+';
  if (panel.classList.contains('open')) {
    _fwLastRender = 0; // force refresh on reopen
    updatePopCounts();
  }
}

// ─── STATE LABELS ─────────────────────────────────────────────────────────────
function classifyState() {
  const counts = {};
  for (const c of critters) counts[c.spec.id] = (counts[c.spec.id] || 0) + 1;

  const total = critters.length;
  const live = Object.keys(counts).length;
  const expected = world.selected.length;
  const extinct = expected - live;

  if (total === 0)
    return { title: 'Hush.', body: `Every critter has gone. Only ${plants.length} plants remain — the world rests.` };

  if (extinct >= Math.ceil(expected / 2) && expected > 1)
    return { title: 'Half-Empty World', body: `${extinct} of ${expected} species are gone. The survivors carry on.` };

  // Find dominant + struggling
  let topId = null, topN = -1;
  for (const [id, n] of Object.entries(counts)) {
    if (n > topN) { topN = n; topId = id; }
  }
  const top = CATALOG.find(c => c.id === topId);

  if (top && topN > 40)
    return { title: `${top.name} Bloom`, body: `${topN} ${top.name}s rule the diorama. Everyone else makes do around them.` };

  if (weather === 'storm' && total < 12)
    return { title: 'Storm Survivors', body: `Just ${total} critters tough out the gale. ${plants.length} plants bend low.` };

  if (weather === 'drought' && plants.length < 30)
    return { title: 'Long Dry', body: `Plants down to ${plants.length}. Critters press together in shrinking green.` };

  if (total > 60 && plants.length > 100)
    return { title: 'Quiet Hum', body: `${total} critters, ${plants.length} plants — a rich, busy hum.` };

  if (total < 12)
    return { title: 'Thin Air', body: `Only ${total} critters left. The world feels paused, listening.` };

  return { title: 'World Ticking Along', body: `${total} critters across ${live} species; ${plants.length} plants. The cauldron simmers.` };
}

function fmtT(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

// ─── REPORT OVERLAY ───────────────────────────────────────────────────────────
function showReport(idx) {
  const { title, body } = classifyState();
  document.getElementById('report-time').textContent = `T+${fmtT(simTime)} · NOTE #${idx}`;
  document.getElementById('report-title').textContent = title;
  document.getElementById('report-body').textContent = body;
  document.getElementById('report-overlay').style.display = 'flex';
  paused = true;
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function vibe() { return VIBES[world.knobs.vibe] || VIBES.meadow; }

function skyColor() {
  const t = skyBrightness;
  const v = vibe();
  const r = Math.round(v.skyNight[0] + (v.skyDay[0] - v.skyNight[0]) * t);
  const g = Math.round(v.skyNight[1] + (v.skyDay[1] - v.skyNight[1]) * t);
  const b = Math.round(v.skyNight[2] + (v.skyDay[2] - v.skyNight[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function groundColor() {
  const v = vibe();
  const t = 0.4 + skyBrightness * 0.6;
  const r = Math.round(v.ground[0] * t);
  const g = Math.round(v.ground[1] * t);
  const b = Math.round(v.ground[2] * t);
  return `rgb(${r},${g},${b})`;
}

// ─── DRAW ─────────────────────────────────────────────────────────────────────
function drawPlant(p) {
  const v = vibe();
  const t = 0.55 + skyBrightness * 0.45;
  const r = Math.round(v.plantHue[0] * t);
  const g = Math.round(v.plantHue[1] * t);
  const b = Math.round(v.plantHue[2] * t);
  const s = p.size;
  const wob = Math.sin(simTime * 1.2 + p.wobble) * 0.5;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.variant === 0) {
    // Round bush with little sparkle
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${Math.min(255,r+50)},${Math.min(255,g+50)},${Math.min(255,b+50)},0.6)`;
    ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.4, 0, Math.PI * 2); ctx.fill();
  } else if (p.variant === 1) {
    // Star flower
    ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + wob * 0.2;
      const r2 = i % 2 === 0 ? s * 1.3 : s * 0.55;
      if (i === 0) ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2);
      else ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (p.variant === 2) {
    // Mushroom
    ctx.fillStyle = `rgba(${Math.min(255,r+30)},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 1.1, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff8e7';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.5, -s * 0.4, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,248,231,0.85)`;
    ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.6, s * 1.1);
  } else {
    // Reedy fronds
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2.5, s * 1.5);
      ctx.quadraticCurveTo(i * 4 + wob, 0, i * 2, -s * 1.3);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)},0.9)`;
    ctx.beginPath(); ctx.arc(0, -s * 1.3, s * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCritter(c) {
  const { spec } = c;
  const s = spec.size;
  const rgb = hexToRgb(spec.color);
  const hunger = c.hunger;
  const alpha = 0.85 + 0.15 * (1 - hunger);
  const darken = (1 - hunger * 0.32);
  const nocFade = (spec.nocturnal && skyBrightness > 0.55) ? 0.5 : 1;

  ctx.save();
  ctx.translate(c.x, c.y);
  const angle = Math.atan2(c.vy, c.vx);

  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, s * 0.7, s * 0.9, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();

  const fill = `rgba(${Math.round(rgb.r * darken)},${Math.round(rgb.g * darken)},${Math.round(rgb.b * darken)},${alpha * nocFade})`;
  const stroke = `rgba(255,248,231,${0.45 * nocFade})`;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;

  if (spec.shape === 'puff') {
    // round body + ears
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-s * 0.5, -s * 0.9, s * 0.25, s * 0.55, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.5, -s * 0.9, s * 0.25, s * 0.55, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.1, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.1, 1.3, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'shell') {
    // dome shell
    ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(${Math.round(rgb.r * 0.6)},${Math.round(rgb.g * 0.6)},${Math.round(rgb.b * 0.6)},${alpha * nocFade})`;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(i * s * 0.45, -s * 0.1, s * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    // head
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(s * 1.1, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'wiggler') {
    ctx.rotate(angle);
    for (let i = 0; i < 3; i++) {
      const wob = Math.sin(simTime * 4 + i) * s * 0.3;
      ctx.beginPath();
      ctx.arc(-i * s * 0.6, wob, s * 0.7, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.1, 1, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'antlered') {
    ctx.rotate(angle);
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head
    ctx.beginPath(); ctx.ellipse(s * 1.2, -s * 0.4, s * 0.5, s * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
    // antlers
    ctx.strokeStyle = `rgba(${Math.round(rgb.r * 0.6)},${Math.round(rgb.g * 0.6)},${Math.round(rgb.b * 0.6)},${alpha * nocFade})`;
    ctx.lineWidth = 1.6;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.3, -s * 0.7);
      ctx.lineTo(s * (1.0 + dir * 0.1), -s * 1.5);
      ctx.lineTo(s * (1.4 + dir * 0.2), -s * 1.7);
      ctx.stroke();
    }
    // glow
    ctx.fillStyle = `rgba(255,255,180,${0.5 * nocFade})`;
    ctx.beginPath(); ctx.arc(s * 1.4, -s * 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'sleek') {
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(s * 1.4, 0);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.9, -s, -s * 0.5);
    ctx.quadraticCurveTo(-s * 1.4, 0, -s, s * 0.5);
    ctx.quadraticCurveTo(s * 0.5, s * 0.9, s * 1.4, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.6); ctx.lineTo(s * 0.85, -s * 1.1); ctx.lineTo(s * 1.0, -s * 0.55);
    ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.2, 1.5, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'arrow') {
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(s * 1.7, 0);
    ctx.lineTo(-s, -s * 0.85);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s, s * 0.85);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(s * 0.85, -s * 0.25, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'spike') {
    ctx.rotate(angle);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r2 = i % 2 === 0 ? s * 1.5 : s * 0.6;
      if (i === 0) ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2);
      else ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(s * 0.4, 0, 1.3, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'tank') {
    ctx.rotate(angle);
    // big body
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.8, s * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // spikes
    ctx.fillStyle = `rgba(${Math.round(rgb.r * 0.6)},${Math.round(rgb.g * 0.6)},${Math.round(rgb.b * 0.6)},${alpha * nocFade})`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.6);
      ctx.lineTo(Math.cos(a + 0.2) * s, Math.sin(a + 0.2) * s);
      ctx.closePath(); ctx.fill();
    }
    // eye
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(s * 1.2, -s * 0.2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'blob') {
    ctx.rotate(angle);
    const wob = simTime * 2.2;
    ctx.beginPath();
    ctx.moveTo(s * 1.3, 0);
    ctx.bezierCurveTo(
      s * 0.6, -s * (1.2 + Math.sin(wob) * 0.2),
      -s * 0.6, -s * (1.1 + Math.cos(wob * 1.3) * 0.2),
      -s * 1.2, 0
    );
    ctx.bezierCurveTo(
      -s * 0.6, s * (1.1 + Math.sin(wob * 0.9) * 0.2),
      s * 0.6, s * (1.2 + Math.cos(wob) * 0.2),
      s * 1.3, 0
    );
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,0.35)`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'star') {
    ctx.rotate(angle + simTime * 4);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r2 = i % 2 === 0 ? s * 1.4 : s * 0.55;
      if (i === 0) ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2);
      else ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // glow
    ctx.fillStyle = `rgba(255,255,200,${0.5 * nocFade})`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill();
  } else if (spec.shape === 'wing') {
    ctx.rotate(angle);
    const flap = Math.sin(simTime * 8) * 0.35;
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    // wings
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.rotate(dir * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(0, dir * s * 0.7, s * 1.1, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else {
    // default circle
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, skyColor());
  grad.addColorStop(0.55, skyColor());
  grad.addColorStop(1, groundColor());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // stars at night
  if (skyBrightness < 0.55) {
    const starAlpha = (0.55 - skyBrightness) * 1.6;
    ctx.fillStyle = `rgba(255,255,210,${starAlpha})`;
    const starRng = mkRng(99);
    for (let i = 0; i < 80; i++) {
      const sx = starRng() * W;
      const sy = starRng() * H * 0.6;
      const sr = 0.5 + starRng() * 1.2;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // weather particles
  if (weather === 'rain' || weather === 'storm') {
    ctx.strokeStyle = `rgba(180,210,255,${weather === 'storm' ? 0.55 : 0.32})`;
    ctx.lineWidth = 1;
    const drops = weather === 'storm' ? 90 : 40;
    for (let i = 0; i < drops; i++) {
      const x = ((rng() * W + simTime * 30) % W);
      const y = ((rng() * H + simTime * 65) % H);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 9); ctx.stroke();
    }
  }

  if (weather === 'drought') {
    ctx.fillStyle = 'rgba(255,170,80,0.10)';
    ctx.fillRect(0, 0, W, H);
  }

  if (weather === 'storm') {
    if (Math.random() < 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  for (const p of plants) drawPlant(p);
  for (const c of critters) drawCritter(c);

  // HUD clock — show "DAY N · time-of-day"
  const period = 200;
  const dayN = Math.floor(dayTimer / period) + 1;
  const phase = (dayTimer % period) / period;
  const tod = phase < 0.25 ? 'DAWN' : phase < 0.5 ? 'NOON' : phase < 0.75 ? 'DUSK' : 'NIGHT';
  document.getElementById('clock').textContent = `DAY ${dayN} · ${tod}`;
}

// ─── SNAPSHOT ─────────────────────────────────────────────────────────────────
function snapshotCanvas() {
  const oc = document.createElement('canvas');
  oc.width = W; oc.height = H;
  const oc2 = oc.getContext('2d');
  oc2.drawImage(canvas, 0, 0);
  const { title } = classifyState();
  oc2.fillStyle = 'rgba(26,11,46,0.85)';
  oc2.fillRect(0, H - 64, W, 64);
  oc2.fillStyle = '#fff8e7';
  oc2.font = `bold ${Math.min(28, W / 14)}px "Bungee", sans-serif`;
  oc2.textAlign = 'center';
  oc2.fillText(title, W / 2, H - 36);
  oc2.font = `${Math.min(13, W / 30)}px monospace`;
  oc2.fillStyle = 'rgba(216,200,240,0.85)';
  oc2.fillText(`Critter Cauldron · T+${fmtT(simTime)}`, W / 2, H - 14);
  return oc.toDataURL('image/png');
}

function share() {
  if (navigator.share) {
    navigator.share({ title: 'Critter Cauldron', url: location.href });
  } else {
    navigator.clipboard.writeText(location.href).then(() => alert('Link copied!'));
  }
}

// ─── BUILDER UI ───────────────────────────────────────────────────────────────
function buildCatalog() {
  const wrap = document.getElementById('critter-catalog');
  wrap.innerHTML = '';
  for (const spec of CATALOG) {
    const card = document.createElement('div');
    card.className = 'critter-card';
    card.dataset.id = spec.id;
    const dietClass = `diet-${spec.eats}`;
    const dietLabel = spec.eats === 'plants' ? 'GRAZER'
      : spec.eats === 'herbivores' ? 'HUNTER'
      : spec.eats === 'predators' ? 'APEX'
      : 'OMNIVORE';
    card.innerHTML = `
      <div class="crit-check">✓</div>
      <span class="crit-emoji">${spec.emoji}</span>
      <span class="crit-name">${spec.name}</span>
      <span class="crit-role ${dietClass}">${dietLabel}</span>
    `;
    card.title = spec.blurb;
    card.addEventListener('click', () => toggleSelected(spec.id));
    wrap.appendChild(card);
  }
  refreshCatalogSelection();
}

function refreshCatalogSelection() {
  const w = pendingWorld || world;
  for (const card of document.querySelectorAll('.critter-card')) {
    if (w.selected.includes(card.dataset.id)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  }
}

function toggleSelected(id) {
  const i = pendingWorld.selected.indexOf(id);
  if (i === -1) pendingWorld.selected.push(id);
  else pendingWorld.selected.splice(i, 1);
  refreshCatalogSelection();
}

function refreshKnobsUI() {
  document.getElementById('knob-plants').value = pendingWorld.knobs.plants;
  document.getElementById('knob-day').value = pendingWorld.knobs.day;
  document.getElementById('knob-weather').value = pendingWorld.knobs.weather;
  document.getElementById('knob-metabolism').value = pendingWorld.knobs.metabolism;
  document.getElementById('knob-fertility').value = pendingWorld.knobs.fertility;
  document.getElementById('knob-vibe').value = pendingWorld.knobs.vibe;
  for (const k of ['plants', 'day', 'weather', 'metabolism', 'fertility']) {
    document.getElementById(`knob-${k}-val`).textContent = pendingWorld.knobs[k].toFixed(1) + '×';
  }
}

function bindKnob(id, key) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id + '-val');
  el.addEventListener('input', () => {
    pendingWorld.knobs[key] = parseFloat(el.value);
    if (valEl) valEl.textContent = parseFloat(el.value).toFixed(1) + '×';
  });
}

function openBuilder() {
  pendingWorld = JSON.parse(JSON.stringify(world));
  refreshCatalogSelection();
  refreshKnobsUI();
  document.getElementById('builder-overlay').classList.add('open');
}

function closeBuilder() {
  document.getElementById('builder-overlay').classList.remove('open');
}

function launchWorld() {
  if (pendingWorld.selected.length === 0) {
    pendingWorld.selected = ['fluffin'];
  }
  world = pendingWorld;
  pendingWorld = null;
  initSim(Date.now());
  document.getElementById('report-overlay').style.display = 'none';
  paused = false;
  closeBuilder();
}

function randomizeWorld() {
  // Pick 2-5 species, with at least one grazer and ideally one hunter
  const grazers = CATALOG.filter(c => c.eats === 'plants' || c.eats === 'omnivore');
  const hunters = CATALOG.filter(c => c.eats === 'herbivores');
  const apex = CATALOG.filter(c => c.eats === 'predators');

  const pick = (arr, n) => {
    const out = [];
    const pool = [...arr];
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  };

  const sel = [
    ...pick(grazers, 2 + Math.floor(Math.random() * 2)),
    ...pick(hunters, 1 + Math.floor(Math.random() * 2)),
    ...(Math.random() < 0.4 ? pick(apex, 1) : []),
  ].map(s => s.id);

  pendingWorld.selected = sel;
  pendingWorld.knobs.plants = 0.6 + Math.random() * 1.4;
  pendingWorld.knobs.day = 0.5 + Math.random() * 1.8;
  pendingWorld.knobs.weather = Math.random() * 1.8;
  pendingWorld.knobs.metabolism = 0.6 + Math.random() * 1.0;
  pendingWorld.knobs.fertility = 0.7 + Math.random() * 1.0;
  const vibes = Object.keys(VIBES);
  pendingWorld.knobs.vibe = vibes[Math.floor(Math.random() * vibes.length)];

  refreshCatalogSelection();
  refreshKnobsUI();
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
let lastTs = null;

function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTs) { lastTs = ts; return; }
  const rawDt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  if (!paused) {
    const steps = Math.max(1, Math.round(speed));
    const dt = rawDt * speed / steps;
    for (let i = 0; i < steps; i++) tick(dt);
  }

  draw();
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function resize() {
  const wrap = document.getElementById('canvas-wrap');
  W = canvas.width = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('world');
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  buildCatalog();

  // Knob bindings
  bindKnob('knob-plants', 'plants');
  bindKnob('knob-day', 'day');
  bindKnob('knob-weather', 'weather');
  bindKnob('knob-metabolism', 'metabolism');
  bindKnob('knob-fertility', 'fertility');
  document.getElementById('knob-vibe').addEventListener('change', e => {
    pendingWorld.knobs.vibe = e.target.value;
  });

  // Bind all the buttons
  document.getElementById('open-builder').addEventListener('click', openBuilder);
  document.getElementById('btn-builder').addEventListener('click', openBuilder);
  document.getElementById('builder-cancel').addEventListener('click', closeBuilder);
  document.getElementById('builder-launch').addEventListener('click', launchWorld);
  document.getElementById('builder-randomize').addEventListener('click', randomizeWorld);
  document.getElementById('builder-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBuilder();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    initSim(Date.now());
    document.getElementById('report-overlay').style.display = 'none';
    paused = false;
  });

  document.getElementById('speed-slider').addEventListener('input', e => {
    speed = parseFloat(e.target.value);
    document.getElementById('speed-val').textContent = speed + '×';
  });

  document.getElementById('btn-snapshot').addEventListener('click', () => {
    const dataURL = snapshotCanvas();
    const a = document.createElement('a');
    a.download = `critter-cauldron-${Date.now()}.png`;
    a.href = dataURL;
    a.click();
  });

  document.getElementById('report-dismiss').addEventListener('click', () => {
    document.getElementById('report-overlay').style.display = 'none';
    paused = false;
  });

  const fwToggleBtn = document.getElementById('fw-toggle');
  if (fwToggleBtn) fwToggleBtn.addEventListener('click', toggleFoodWeb);

  // Initial sim
  initSim(Date.now());
  requestAnimationFrame(loop);
});
