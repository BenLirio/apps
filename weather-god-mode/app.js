// Weather God Mode — pixel-art coastal town under a tappable sky.
// Pure JS / Canvas2D. No LLM. Deterministic verdict from session stats.
// 60-second reign → Meteorological Society Divinity Audit.

(() => {
  'use strict';

  // ---------- Constants ----------
  const SESSION_SECONDS = 60;
  const VIRTUAL_W = 192;            // logical pixel-art width (scaled up)
  const VIRTUAL_H = 320;            // logical pixel-art height (scaled to canvas)
  const HORIZON_Y = 168;            // sea level in virtual coords
  const GROUND_Y = 196;             // top of grass in virtual coords (after beach)
  const SKY_BAND_TOP = 8;
  const SKY_BAND_BOTTOM = 130;
  // Cloud growth caps. Escalation goes puff → cloud → thunderhead.
  // Past STORM_THRESHOLD a cloud locks into stormForm: anvil shape, thunder
  // on hold-lightning, hail on double-tap (instead of rain).
  const MAX_TARGET_SIZE = 2.4;
  const MAX_CLOUD_R = 18;
  const STORM_THRESHOLD = 2.2;

  const PALETTE = {
    skyTop:    '#f3c46a',
    skyMid:    '#f1a04a',
    skyBottom: '#e08a3c',
    sea:       '#3a6f8f',
    seaLight:  '#5a8fa8',
    sand:      '#e7c98a',
    grass:     '#67a04a',
    grassDk:   '#3f7a32',
    soil:      '#5a3b22',
    cloudHi:   '#fbf6e9',
    cloudMid:  '#dfd4b8',
    cloudLo:   '#a89a76',
    cloudDark: '#5a4f38',
    rain:      '#9fc8e8',
    bolt:      '#fff5b8',
    fire:      '#ff7038',
    ember:     '#ffc24a',
    smoke:     '#7a7468',
    crop:      '#3f7a32',
    cropRipe:  '#ffd166',
    woodLite:  '#c89a6a',
    woodDark:  '#7a4f2a',
    roof:      '#8b3a2e',
    roofDk:    '#5a2418',
    light:     '#ffe28a',
    person:    '#f1d4a0',
    coat1:     '#c0392b',
    coat2:     '#1f4d8a',
    coat3:     '#2e7d32',
    coat4:     '#7a3aa3',
    umbrella1: '#c0392b',
    umbrella2: '#1f4d8a',
    umbrella3: '#2e7d32',
    umbrella4: '#000000',
    night:     'rgba(20, 30, 60, 0.35)',
    starlight: '#ffffff'
  };

  const CLOUD_TYPES = {
    PUFF:   { id: 'puff',   maxSize: 1.0, baseR: 8 },
    GROW:   { id: 'grow',   maxSize: 1.6, baseR: 12 },
    BIG:    { id: 'big',    maxSize: 2.4, baseR: 16 },
    STORM:  { id: 'storm',  maxSize: 3.2, baseR: 22 }
  };

  const TOWNSFOLK_PROFESSIONS = [
    { id: 'farmer',    coat: PALETTE.coat3, name: 'farmer' },
    { id: 'picnicker', coat: PALETTE.coat1, name: 'picnicker' },
    { id: 'sailor',    coat: PALETTE.coat2, name: 'sailor' },
    { id: 'keeper',    coat: PALETTE.coat4, name: 'keeper' },
    { id: 'farmer',    coat: PALETTE.coat3, name: 'farmer' },
    { id: 'picnicker', coat: PALETTE.coat1, name: 'picnicker' }
  ];

  // ---------- Seeded RNG (Mulberry32) ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Verdict archetypes ----------
  // Score signature -> archetype. Decision tree below selects one.
  // Each verdict has: name, caption (deadpan one-liner), stamp text.
  const VERDICTS = [
    // -- No-action / minimal -- (idle gods)
    { id: 'absentee',
      name: 'The Absentee, On Coffee Break',
      caption: 'Reign was largely vibes. Town reports zero anomalies and a faint feeling of being overlooked.',
      stamp: 'INACTIVE' },
    { id: 'lightning_shy',
      name: 'The Lightning-Shy Mercy God',
      caption: 'Hovered. Considered. Did not strike. The townsfolk are touched, mildly underwhelmed.',
      stamp: 'CLEMENT' },

    // -- Drought heavy --
    { id: 'petty_drought',
      name: 'Petty Drought-Lord of the Tomato Patch',
      caption: 'Withheld rain on principle. The crops noticed. The principle was unclear.',
      stamp: 'PARCHED' },
    { id: 'sun_tyrant',
      name: 'The Solar Hard-Liner',
      caption: 'Believes shade is a moral failing. Sunburn rate within historical norms for a wrathful sky.',
      stamp: 'SCORCHED' },

    // -- Rain heavy / no lightning --
    { id: 'baptismal',
      name: 'Baptismal Flooder, 3rd Class',
      caption: 'Generous with the watering. Excessive with the watering. Crops thank you. Picnickers do not.',
      stamp: 'SOAKED' },
    { id: 'gentle_rain',
      name: 'The Gentle Drizzle Saint',
      caption: 'A measured benevolence. Crops sprouted on schedule. The lighthouse keeper waves thanks.',
      stamp: 'BLESSED' },
    { id: 'drowner',
      name: 'The Patient Drowner',
      caption: 'Refused to stop. The bay rose. The town remembers what dry was. They are filing about it.',
      stamp: 'INUNDATED' },

    // -- Lightning heavy / no rain --
    { id: 'arsonist_god',
      name: 'The Quiet Arsonist',
      caption: 'Three roofs. No apology. The fire brigade has logged a complaint with the heavens.',
      stamp: 'IGNITED' },
    { id: 'theatrical_zeus',
      name: 'Theatrical Zeus, Off-Broadway',
      caption: 'Lightning for the show. Lightning for the encore. Town clapped politely, then fled.',
      stamp: 'STRUCK' },
    { id: 'spite_smiter',
      name: 'Pointed Smiter of the Innocent Beach Day',
      caption: 'Skipped the wet stuff. Went straight to grievance. Picnic baskets identified, neutralized.',
      stamp: 'SMITTEN' },

    // -- Lightning + rain (storm) --
    { id: 'stormbringer_apol',
      name: 'Stormbringer With Apologies',
      caption: 'Cried, struck, cried again. The town is wet, scorched, and oddly moved by the gesture.',
      stamp: 'TURBULENT' },
    { id: 'biblical',
      name: 'Old Testament Recreationist',
      caption: 'Two-day weather event compressed to 60 seconds. Townsfolk consulting older, stricter texts.',
      stamp: 'JUDGEMENT' },
    { id: 'tempest_chef',
      name: 'Tempest Chef, Heavy on the Garnish',
      caption: 'Recipe called for a sprinkle. You delivered the entire pantry. Adequate plating.',
      stamp: 'OVERSEASONED' },

    // -- Sustained pressure / micromanager --
    { id: 'micromanager',
      name: 'The Micromanaging Cumulus Auditor',
      caption: 'Touched every cloud personally. Multiple times. Productivity unverified. Anxiety: notable.',
      stamp: 'INSPECTED' },
    { id: 'patron_saint',
      name: 'Patron Saint of the Reasonable Forecast',
      caption: 'Distributed weather like rations. Fair. Boring. Meteorologically sound. The crops verified.',
      stamp: 'COMMENDED' },

    // -- Wide coverage / chaos --
    { id: 'cumulus_anarchist',
      name: 'The Cumulus Anarchist',
      caption: 'No region spared. No theme detected. Townsfolk report an aesthetic of "maximum sky, all options on."',
      stamp: 'CHAOTIC' },
    { id: 'carpet_bomber',
      name: 'The Carpet-Bomber of Mild Weather',
      caption: 'Every tile got something. None got the right thing. A historic reign of approximately fine.',
      stamp: 'DISTRIBUTED' },

    // -- Edge cases --
    { id: 'lighthouse_friend',
      name: 'Friend of the Lighthouse Keeper',
      caption: 'Rained after a long dry spell. The keeper waved, twice. This is the entire arc of the story.',
      stamp: 'WAVED-AT' },
    { id: 'reluctant_god',
      name: 'The Reluctant Acting Deity',
      caption: 'Did the bare minimum required to discharge the office. Filed paperwork. Kept receipts.',
      stamp: 'PROCEDURAL' },
    { id: 'beach_redeemer',
      name: 'Redeemer of the Beach Day',
      caption: 'Skipped the storms. Skipped the smiting. The picnic concluded uninterrupted. The town is suspicious.',
      stamp: 'PARDONED' },

    // -- Hail / thunderhead specialists (post-escalation tier) --
    { id: 'hail_marshal',
      name: 'Marshal of Sudden Hail',
      caption: 'Skipped warning, skipped rain, went straight to ice. Tomatoes flattened, picnic dignity reduced to gravel.',
      stamp: 'PELTED' },
    { id: 'thunderhead_diva',
      name: 'Thunderhead Diva, Encore Demanded',
      caption: 'Every spare cloud became a thunderhead. The sky cracked on cue. The town has begun praying selectively.',
      stamp: 'RUMBLED' },
    { id: 'apocalyptic_combo',
      name: 'Quartermaster of the Apocalypse',
      caption: 'Lightning, hail, rain — the full sampler platter. The town would like a word, possibly several.',
      stamp: 'OBLITERATED' },
    { id: 'restraint_thunderhead',
      name: 'The Thunderhead That Thought Better Of It',
      caption: 'Massed a storm. Held the storm. Dispersed the storm. Townsfolk will not stop thanking the wind.',
      stamp: 'MERCIFUL' }
  ];

  function pickVerdict(stats) {
    const L = stats.lightning_count;
    const R = stats.rain_volume_units;
    const H = stats.hail_volume_units;
    const Th = stats.thunder_pulses;
    const Hd = stats.thunderheads_summoned;
    const T = stats.taps_count;
    const D = stats.drought_seconds;
    const cov = stats.percent_townsfolk_affected; // 0..1
    const fires = stats.fires_started;
    const sustained = stats.sustained_pressure_seconds;
    const keeperWaved = stats.keeper_waved;
    const picnicSurvived = stats.picnic_survived;

    // Priority decision tree — most specific first.

    // Escalation-tier verdicts (hail / thunderhead) — most specific.
    if (H >= 3 && L >= 2 && R >= 3) return VERDICTS.find(v => v.id === 'apocalyptic_combo');
    if (H >= 4 && L <= 1 && R < 4) return VERDICTS.find(v => v.id === 'hail_marshal');
    if (Th >= 4) return VERDICTS.find(v => v.id === 'thunderhead_diva');
    if (Hd >= 2 && Th === 0 && H === 0 && L === 0) return VERDICTS.find(v => v.id === 'restraint_thunderhead');

    if (T < 4 && L === 0 && R < 2) return VERDICTS.find(v => v.id === 'absentee');
    if (L === 0 && R === 0 && T >= 4) return VERDICTS.find(v => v.id === 'lightning_shy');

    if (D >= 35 && R < 3) {
      return VERDICTS.find(v => v.id === (R === 0 ? 'sun_tyrant' : 'petty_drought'));
    }

    if (keeperWaved && R >= 4 && L <= 1) return VERDICTS.find(v => v.id === 'lighthouse_friend');

    if (L >= 8 && R < 3) return VERDICTS.find(v => v.id === 'theatrical_zeus');
    if (L >= 4 && fires >= 2) return VERDICTS.find(v => v.id === 'arsonist_god');
    if (L >= 3 && R < 2) return VERDICTS.find(v => v.id === 'spite_smiter');

    if (R >= 14 && L === 0) return VERDICTS.find(v => v.id === 'drowner');
    if (R >= 8 && L === 0) return VERDICTS.find(v => v.id === 'baptismal');
    if (R >= 3 && R < 8 && L === 0) return VERDICTS.find(v => v.id === 'gentle_rain');

    if (L >= 4 && R >= 6 && cov >= 0.6) return VERDICTS.find(v => v.id === 'biblical');
    if (L >= 2 && R >= 4) return VERDICTS.find(v => v.id === 'stormbringer_apol');
    if (L >= 1 && R >= 2) return VERDICTS.find(v => v.id === 'tempest_chef');

    // sustained_pressure_seconds is roughly avg cloud_count * play_seconds,
    // typically 200-1200 over a 60s session. >800 means heavy continuous tinkering.
    if (sustained >= 800 && cov < 0.5 && T >= 12) return VERDICTS.find(v => v.id === 'micromanager');
    if (cov >= 0.75) return VERDICTS.find(v => v.id === 'cumulus_anarchist');
    if (cov >= 0.5) return VERDICTS.find(v => v.id === 'carpet_bomber');

    if (picnicSurvived && L === 0 && R < 4) return VERDICTS.find(v => v.id === 'beach_redeemer');
    if (L <= 1 && R >= 1 && R < 5) return VERDICTS.find(v => v.id === 'patron_saint');

    return VERDICTS.find(v => v.id === 'reluctant_god');
  }

  // ---------- Game state ----------
  let canvas, ctx;
  let cssW = 0, cssH = 0;
  let scaleX = 1, scaleY = 1; // virtual -> css
  let dpr = 1;
  let rng;
  let sessionSeed = 0;
  let sessionStarted = false;
  let sessionEnded = false;
  let timeRemaining = SESSION_SECONDS;
  let lastFrameMs = 0;
  let runStartMs = 0;
  let rafHandle = 0;

  let clouds = [];
  let raindrops = [];
  let hailstones = [];
  let bolts = [];
  let fires = [];
  let smokes = [];
  let townsfolk = [];
  let crops = [];
  let stars = [];
  let lighthouseFlash = 0;
  let thunderRumble = 0; // 0..1, decays over ~0.6s, drives screen shake + dim

  // Stats
  let stats = freshStats();

  // Per-frame transient counters
  let driedSecondsAccum = 0;       // since last rain
  let pressureAccum = 0;           // total cloud-mass-seconds
  let affectedTownsfolk = new Set();

  // Touch / pointer tracking
  let activePointer = null;       // { id, x, y, startMs, cloud, holdActive, holdStartMs, lastUpMs }
  let lastTapMs = 0;
  let lastTapPos = null;
  const HOLD_MS = 420;            // time before lightning fires
  const DOUBLE_TAP_MS = 320;      // window for double-tap rain
  const DOUBLE_TAP_DIST = 22;     // virtual px

  function freshStats() {
    return {
      taps_count: 0,
      lightning_count: 0,
      rain_volume_units: 0,
      hail_volume_units: 0,
      thunder_pulses: 0,
      thunderheads_summoned: 0,
      crops_hailed: 0,
      drought_seconds: 0,
      sustained_pressure_seconds: 0,
      percent_townsfolk_affected: 0,
      fires_started: 0,
      keeper_waved: false,
      picnic_survived: true
    };
  }

  // ---------- Coordinate helpers ----------
  function eventToVirtual(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    // canvas.width / height already at virtual scale (we draw at virtual then scale via CSS via canvas internal)
    return { x: cx, y: cy };
  }

  // ---------- Initialization ----------
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || (window.innerHeight - 92);
    if (cssW < 100) cssW = window.innerWidth;
    if (cssH < 100) cssH = Math.max(300, window.innerHeight - 92);

    // Maintain aspect — keep virtual canvas at fixed VIRTUAL_W x VIRTUAL_H,
    // but stretch backing buffer to fit container while preserving pixel-art look.
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    canvas.width = targetW;
    canvas.height = targetH;
    scaleX = canvas.width / VIRTUAL_W;
    scaleY = canvas.height / VIRTUAL_H;
  }

  function seedSession(extra) {
    // Combine wall-clock with optional extra so replay is fresh.
    const t = Date.now();
    sessionSeed = ((t & 0xffffffff) ^ ((extra || 0) * 2654435761)) >>> 0;
    rng = makeRng(sessionSeed || 1);
  }

  function buildWorld() {
    // Stars (visible faintly during storm-darkening)
    stars = [];
    for (let i = 0; i < 30; i++) {
      stars.push({ x: Math.floor(rng() * VIRTUAL_W), y: Math.floor(rng() * 90) + 6, b: 0.3 + rng() * 0.7 });
    }

    // Townsfolk — 6 distinct figures with pixel-accurate paths
    townsfolk = [];
    const profiles = TOWNSFOLK_PROFESSIONS;
    // Crop area: center field; picnic on beach; sailor at dock; keeper at lighthouse
    townsfolk.push({ id: 'farmer-1', kind: 'farmer', x: 60, y: 218, vx: 0.05, baseY: 218, coat: PALETTE.coat3,
                     state: 'work', umbrella: false, fled: false, anim: 0 });
    townsfolk.push({ id: 'farmer-2', kind: 'farmer', x: 95, y: 222, vx: -0.04, baseY: 222, coat: PALETTE.coat3,
                     state: 'work', umbrella: false, fled: false, anim: 0 });
    townsfolk.push({ id: 'picnic-1', kind: 'picnicker', x: 28, y: 238, vx: 0.0, baseY: 238, coat: PALETTE.coat1,
                     state: 'picnic', umbrella: false, fled: false, anim: 0 });
    townsfolk.push({ id: 'picnic-2', kind: 'picnicker', x: 38, y: 240, vx: 0.0, baseY: 240, coat: PALETTE.coat2,
                     state: 'picnic', umbrella: false, fled: false, anim: 0 });
    townsfolk.push({ id: 'sailor-1', kind: 'sailor', x: 138, y: 230, vx: 0.0, baseY: 230, coat: PALETTE.coat2,
                     state: 'dock', umbrella: false, fled: false, anim: 0 });
    townsfolk.push({ id: 'keeper-1', kind: 'keeper', x: 170, y: 192, vx: 0.0, baseY: 192, coat: PALETTE.coat4,
                     state: 'keep', umbrella: false, fled: false, anim: 0, waveAccum: 0 });

    // Crops — small grid in field area
    crops = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        crops.push({ x: 50 + col * 8, y: 230 + row * 6, growth: 0, ripe: false, burned: false });
      }
    }

    // Initial clouds — between 3 and 5
    clouds = [];
    const initialCount = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < initialCount; i++) {
      spawnCloud();
    }

    raindrops = [];
    hailstones = [];
    bolts = [];
    fires = [];
    smokes = [];
    affectedTownsfolk = new Set();
    driedSecondsAccum = 0;
    pressureAccum = 0;
    lighthouseFlash = 0;
    thunderRumble = 0;
    stats = freshStats();
  }

  function spawnCloud() {
    const x = 12 + rng() * (VIRTUAL_W - 24);
    const y = 22 + rng() * 70;
    const vx = (rng() - 0.5) * 0.18;
    const size = 0.6 + rng() * 0.5;
    const seedOffset = Math.floor(rng() * 1024);
    clouds.push({
      x, y, vx,
      size,                // current scale (grows on tap)
      targetSize: size,
      r: 10 + rng() * 6,   // base radius
      raining: false,
      rainAccum: 0,
      hailing: false,
      hailExpire: 0,
      stormForm: false,    // becomes true when targetSize >= STORM_THRESHOLD
      lifeMs: 0,
      seedOffset,
      darkening: 0,        // 0..1, increases with size
      lastChargeMs: 0,
      lastTapMs: 0,
      rainExpire: 0
    });
  }

  // ---------- Game loop ----------
  function frame(nowMs) {
    if (!sessionStarted || sessionEnded) {
      rafHandle = requestAnimationFrame(frame);
      drawScene(0);
      return;
    }
    const dt = Math.min(0.05, (nowMs - lastFrameMs) / 1000); // cap dt for sanity
    lastFrameMs = nowMs;

    timeRemaining = Math.max(0, SESSION_SECONDS - (nowMs - runStartMs) / 1000);
    document.getElementById('timer').textContent = Math.ceil(timeRemaining).toString();
    if (timeRemaining <= 10) document.getElementById('hud').querySelector('.hud-timer').classList.add('warn');

    update(dt, nowMs);
    drawScene(nowMs);

    if (timeRemaining <= 0) {
      endSession();
      return;
    }

    rafHandle = requestAnimationFrame(frame);
  }

  function update(dt, nowMs) {
    // Hold-to-lightning detection
    if (activePointer && activePointer.cloud && !activePointer.holdActive) {
      if (nowMs - activePointer.startMs >= HOLD_MS) {
        // Fire lightning if cloud is big enough
        const c = activePointer.cloud;
        if (c.size >= 1.0) {
          spawnLightning(c, nowMs);
          activePointer.holdActive = true;
        }
      }
    }

    // Clouds
    let totalMass = 0;
    let cloudsCovering = 0;
    for (const c of clouds) {
      c.lifeMs += dt * 1000;
      c.x += c.vx * dt * 60;
      // Wrap around
      if (c.x < -30) c.x = VIRTUAL_W + 20;
      if (c.x > VIRTUAL_W + 30) c.x = -20;

      // Smoothly approach target size
      c.size += (c.targetSize - c.size) * Math.min(1, dt * 2.4);

      // Cloud darkening proportional to size
      c.darkening = Math.min(1, Math.max(0, (c.size - 1) / 2.2));

      // Rain mechanics
      if (c.raining) {
        c.rainAccum += dt;
        // Drop spawn rate scales with cloud size
        const dropsThisFrame = Math.floor(c.size * 8 * dt + rng() * 0.7);
        for (let i = 0; i < dropsThisFrame; i++) {
          raindrops.push({
            x: c.x + (rng() - 0.5) * c.r * c.size * 1.6,
            y: c.y + 6,
            vy: 90 + rng() * 40,
            life: 0
          });
        }
        stats.rain_volume_units += dropsThisFrame * 0.05;
        if (nowMs > c.rainExpire) c.raining = false;
      }

      // Hail mechanics — thunderheads only. Heavier, slower, bigger than rain.
      if (c.hailing) {
        const stonesThisFrame = Math.floor(c.size * 5 * dt + rng() * 0.6);
        for (let i = 0; i < stonesThisFrame; i++) {
          hailstones.push({
            x: c.x + (rng() - 0.5) * c.r * c.size * 1.4,
            y: c.y + 6,
            vy: 70 + rng() * 30,
            r: 1.2 + rng() * 0.8,
            life: 0
          });
        }
        stats.hail_volume_units += stonesThisFrame * 0.07;
        if (nowMs > c.hailExpire) c.hailing = false;
      }

      totalMass += c.size;
      if (c.size > 1.0) cloudsCovering++;
    }

    pressureAccum += totalMass * dt;
    stats.sustained_pressure_seconds = pressureAccum;

    // Drought tracking — increment if no rain anywhere
    const isAnyRaining = clouds.some(c => c.raining);
    if (!isAnyRaining) {
      driedSecondsAccum += dt;
      stats.drought_seconds = driedSecondsAccum;
    } else {
      driedSecondsAccum = 0;
    }

    // Raindrops
    for (let i = raindrops.length - 1; i >= 0; i--) {
      const d = raindrops[i];
      d.y += d.vy * dt;
      d.life += dt;
      if (d.y >= GROUND_Y - 2) {
        // Splash effect — also affects local entities
        affectByRain(d.x, d.y);
        raindrops.splice(i, 1);
      } else if (d.y >= HORIZON_Y && d.y < GROUND_Y - 2) {
        // Splashes on sea
        if (rng() < 0.6) raindrops.splice(i, 1);
      } else if (d.life > 6) {
        raindrops.splice(i, 1);
      }
    }

    // Hailstones — heavier, gravity-accelerated, damaging on impact
    for (let i = hailstones.length - 1; i >= 0; i--) {
      const h = hailstones[i];
      h.vy += 60 * dt; // gravity
      h.y += h.vy * dt;
      h.life += dt;
      if (h.y >= GROUND_Y - 2) {
        affectByHail(h.x, h.y);
        hailstones.splice(i, 1);
      } else if (h.y >= HORIZON_Y && h.y < GROUND_Y - 2) {
        if (rng() < 0.5) hailstones.splice(i, 1);
      } else if (h.life > 6) {
        hailstones.splice(i, 1);
      }
    }

    // Thunder rumble decay
    if (thunderRumble > 0) thunderRumble = Math.max(0, thunderRumble - dt * 1.6);

    // Bolts decay
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life += dt;
      if (b.life > 0.4) bolts.splice(i, 1);
    }

    // Fires
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.life += dt;
      f.flicker = (f.flicker + dt * 12) % (Math.PI * 2);
      // Fire dims if it has rained recently in this column
      let extinguish = false;
      for (const d of raindrops) {
        if (Math.abs(d.x - f.x) < 6 && d.y > f.y - 6) { extinguish = true; break; }
      }
      if (extinguish) f.life += dt * 5;
      if (f.life > 6) fires.splice(i, 1);
      else {
        // Smoke
        if (Math.random() < 0.2) smokes.push({ x: f.x + (rng()-0.5)*4, y: f.y - 6, vy: -8, life: 0, alpha: 0.6 });
      }
    }

    // Smoke
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.y += s.vy * dt;
      s.life += dt;
      s.alpha -= dt * 0.18;
      if (s.alpha <= 0) smokes.splice(i, 1);
    }

    // Townsfolk
    for (const p of townsfolk) {
      p.anim += dt;
      // Movement (farmers wander, others mostly stationary)
      if (p.kind === 'farmer' && !p.fled) {
        p.x += p.vx * dt * 60;
        if (p.x < 50 || p.x > 110) p.vx *= -1;
      }

      // Lighthouse keeper waveAccum
      if (p.kind === 'keeper') {
        if (p.waveAccum > 0) {
          p.waveAccum = Math.max(0, p.waveAccum - dt);
        }
      }
    }

    // Lighthouse flash decay
    lighthouseFlash = Math.max(0, lighthouseFlash - dt * 0.6);

    // Coverage stat
    stats.percent_townsfolk_affected = affectedTownsfolk.size / townsfolk.length;

    // Picnic survival check — picnickers fled means picnic did not survive
    const picnickers = townsfolk.filter(p => p.kind === 'picnicker');
    if (picnickers.some(p => p.fled)) stats.picnic_survived = false;
  }

  function affectByRain(x, y) {
    // Mark townsfolk near this drop as affected (umbrella)
    for (const p of townsfolk) {
      if (Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 16) {
        if (!affectedTownsfolk.has(p.id)) affectedTownsfolk.add(p.id);
        if (p.kind === 'picnicker' || p.kind === 'sailor' || p.kind === 'farmer') {
          p.umbrella = true;
        }
        if (p.kind === 'keeper' && stats.drought_seconds > 8 && !stats.keeper_waved) {
          stats.keeper_waved = true;
          p.waveAccum = 1.5;
        }
      }
    }
    // Crops near this drop
    for (const c of crops) {
      if (Math.abs(c.x - x) < 5 && !c.burned) {
        c.growth = Math.min(1, c.growth + 0.04);
        if (c.growth >= 1) c.ripe = true;
      }
    }
  }

  function affectByHail(x, y) {
    // Hail is brutal — umbrellas don't help, picnickers flee, crops crushed.
    for (const p of townsfolk) {
      if (Math.abs(p.x - x) < 9 && Math.abs(p.y - y) < 18) {
        affectedTownsfolk.add(p.id);
        if (p.kind === 'picnicker') {
          p.fled = true;
          p.x += (p.x < VIRTUAL_W / 2) ? -8 : 8;
        }
        if (p.kind === 'farmer' && rng() < 0.4) {
          p.fled = true;
          p.x += (rng() - 0.5) * 10;
        }
      }
    }
    for (const c of crops) {
      if (Math.abs(c.x - x) < 5 && !c.burned) {
        // Crush — knocks growth back, ripe crops get flattened outright
        if (c.ripe || c.growth > 0.6) {
          c.burned = true;
          c.ripe = false;
          stats.crops_hailed++;
        } else {
          c.growth = Math.max(0, c.growth - 0.25);
        }
      }
    }
  }

  function spawnLightning(cloud, nowMs) {
    stats.lightning_count++;
    bumpInterventionsHud();
    // Lightning drains cloud — but storm clouds keep their stormForm flag,
    // they just shrink back to threshold so re-tapping re-arms quickly.
    cloud.size = Math.max(0.6, cloud.size - 0.3);
    cloud.targetSize = Math.max(0.6, cloud.targetSize - 0.3);
    if (cloud.targetSize < STORM_THRESHOLD) cloud.stormForm = false;

    const isThunder = cloud.stormForm || cloud.size >= STORM_THRESHOLD;
    if (isThunder) {
      stats.thunder_pulses++;
      thunderRumble = 1.0;
    }

    // Build jagged bolt path from cloud to ground
    const sx = cloud.x;
    const sy = cloud.y + 4;
    const ex = sx + (rng() - 0.5) * 14;
    const ey = GROUND_Y + 2 + rng() * 6;
    const segments = [];
    let cx = sx, cy = sy;
    while (cy < ey) {
      const nx = cx + (rng() - 0.5) * 6;
      const ny = cy + 6 + rng() * 6;
      segments.push({ x1: cx, y1: cy, x2: nx, y2: Math.min(ey, ny) });
      cx = nx; cy = ny;
    }
    bolts.push({ segments, life: 0, x: ex, y: ey, thunder: isThunder });

    // Effects on impact
    handleLightningImpact(ex, ey);
  }

  function handleLightningImpact(x, y) {
    // Townsfolk near impact: picnickers flee, others mark affected
    for (const p of townsfolk) {
      if (Math.abs(p.x - x) < 14 && Math.abs(p.y - y) < 24) {
        affectedTownsfolk.add(p.id);
        if (p.kind === 'picnicker') {
          p.fled = true;
          // Drift toward edges
          p.x += (p.x < VIRTUAL_W / 2) ? -10 : 10;
        }
        if (p.kind === 'farmer') {
          p.fled = true;
          p.x += (rng() - 0.5) * 14;
        }
      }
    }
    // Burn crops on dry tiles
    let burnedAny = false;
    for (const c of crops) {
      if (Math.abs(c.x - x) < 8 && !c.burned) {
        // Only burn if the area is dry (no recent rain near)
        const wet = raindrops.some(d => Math.abs(d.x - c.x) < 10);
        if (!wet) {
          c.burned = true;
          c.ripe = false;
          burnedAny = true;
        }
      }
    }
    // Roof fires near houses
    if (x > 110 && x < 165 && y > GROUND_Y - 4) {
      // Possible roof hit; check if rain recent — if dry, start fire
      const wet = raindrops.some(d => Math.abs(d.x - x) < 12);
      if (!wet) {
        fires.push({ x, y: GROUND_Y - 6, life: 0, flicker: rng() * Math.PI * 2 });
        stats.fires_started++;
      }
    }
    if (burnedAny) {
      // Visual fire on burned crop
      fires.push({ x, y: GROUND_Y - 2, life: 0, flicker: rng() * Math.PI * 2 });
      stats.fires_started++;
    }
    lighthouseFlash = 1;
  }

  // ---------- Input ----------
  function findCloudAt(vx, vy) {
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      const dx = vx - c.x;
      const dy = vy - c.y;
      const r = c.r * c.size + 6;
      if (dx * dx + dy * dy < r * r) return c;
    }
    return null;
  }

  function canvasPointToVirtual(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    // canvas internal is sized to backing buffer (virtual * scaleX). Convert back.
    const vx = px / scaleX;
    const vy = py / scaleY;
    return { x: vx, y: vy };
  }

  function onPointerDown(e) {
    if (!sessionStarted || sessionEnded) return;
    e.preventDefault();
    const v = canvasPointToVirtual(e.clientX, e.clientY);
    const cloud = findCloudAt(v.x, v.y);

    activePointer = {
      id: e.pointerId,
      x: v.x, y: v.y,
      startMs: performance.now(),
      cloud,
      holdActive: false
    };

    // Detect double-tap on a cloud → release rain (or hail if it's a thunderhead)
    const now = performance.now();
    if (cloud && lastTapPos && (now - lastTapMs) < DOUBLE_TAP_MS) {
      const dx = v.x - lastTapPos.x;
      const dy = v.y - lastTapPos.y;
      if (dx * dx + dy * dy < DOUBLE_TAP_DIST * DOUBLE_TAP_DIST) {
        if (cloud.stormForm) triggerHail(cloud, now);
        else triggerRain(cloud, now);
        lastTapMs = 0; // consume
        lastTapPos = null;
        return;
      }
    }
  }

  function onPointerUp(e) {
    if (!sessionStarted || sessionEnded) return;
    e.preventDefault();
    if (!activePointer || activePointer.id !== e.pointerId) {
      activePointer = null;
      return;
    }
    const now = performance.now();
    const heldMs = now - activePointer.startMs;
    const v = canvasPointToVirtual(e.clientX, e.clientY);

    if (!activePointer.holdActive) {
      // Short tap behaviors
      if (activePointer.cloud) {
        // Grow the cloud
        growCloud(activePointer.cloud);
        stats.taps_count++;
        bumpInterventionsHud();
        // Track for double-tap
        lastTapMs = now;
        lastTapPos = { x: v.x, y: v.y };
      } else {
        // Tap on empty sky: spawn a small puff there if in sky band
        if (v.y < SKY_BAND_BOTTOM && v.y > SKY_BAND_TOP && clouds.length < 12) {
          clouds.push({
            x: v.x, y: v.y,
            vx: (rng() - 0.5) * 0.15,
            size: 0.6, targetSize: 0.8,
            r: 9 + rng() * 4,
            raining: false, rainAccum: 0,
            lifeMs: 0, seedOffset: Math.floor(rng() * 1024),
            darkening: 0, lastChargeMs: 0, lastTapMs: 0, rainExpire: 0
          });
          stats.taps_count++;
          bumpInterventionsHud();
        }
      }
    }

    activePointer = null;
  }

  function onPointerCancel(e) {
    activePointer = null;
  }

  function growCloud(c) {
    c.targetSize = Math.min(MAX_TARGET_SIZE, c.targetSize + 0.45);
    c.r = Math.min(MAX_CLOUD_R, c.r + 0.2);
    if (!c.stormForm && c.targetSize >= STORM_THRESHOLD) {
      c.stormForm = true;
      stats.thunderheads_summoned++;
      // Visual cue: a brief charged flash on transformation
      thunderRumble = Math.max(thunderRumble, 0.4);
    }
  }

  function triggerRain(c, nowMs) {
    if (c.size < 0.85) {
      // Force a small grow first
      c.targetSize = Math.max(c.targetSize, 1.0);
    }
    c.raining = true;
    // Bigger clouds rain longer
    c.rainExpire = nowMs + 1200 + c.size * 800;
    bumpInterventionsHud();
  }

  function triggerHail(c, nowMs) {
    // Only thunderheads drop hail. Caller (double-tap handler) decides routing.
    c.hailing = true;
    c.hailExpire = nowMs + 1300 + c.size * 600;
    bumpInterventionsHud();
  }

  function bumpInterventionsHud() {
    const el = document.getElementById('intervention-count');
    if (el) el.textContent = (++statsInterventions).toString();
  }

  // ---------- Drawing ----------
  function drawScene(nowMs) {
    if (!ctx) return;

    // Compute average darkening for sky tint
    let avgDark = 0;
    for (const c of clouds) avgDark += c.darkening;
    avgDark = clouds.length ? Math.min(0.7, avgDark / Math.max(1, clouds.length)) : 0;

    // Thunder shake — translate the whole scene a few pixels.
    const shakeMag = thunderRumble * thunderRumble * 7;
    const shakeX = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    const shakeY = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    if (shakeMag) {
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // Background sky
    drawSky(avgDark);
    drawStars(avgDark);
    drawSea();
    drawIsland();
    drawCrops();
    drawHouses();
    drawLighthouse();
    drawTownsfolk();

    // Rain (drawn over town but under bolts)
    drawRain();
    drawHail();

    // Clouds
    drawClouds();

    // Bolts
    drawBolts();

    // Fires & smoke
    drawFires();
    drawSmoke();

    // Storm darkening (whole scene)
    if (avgDark > 0.05) {
      ctx.fillStyle = `rgba(20, 30, 60, ${avgDark * 0.35})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Thunder dim flash (independent of cloud cover — felt during rumble)
    if (thunderRumble > 0.05) {
      ctx.fillStyle = `rgba(20, 22, 48, ${thunderRumble * 0.22})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Lighthouse flash overlay
    if (lighthouseFlash > 0.02) {
      ctx.fillStyle = `rgba(255, 245, 184, ${lighthouseFlash * 0.18})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (shakeMag) ctx.restore();
  }

  // helper: draw a virtual rect
  function vRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * scaleX), Math.round(y * scaleY),
                 Math.ceil(w * scaleX), Math.ceil(h * scaleY));
  }

  function drawSky(avgDark) {
    // Sky gradient — fixed per session
    const grad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y * scaleY);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.6, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y * scaleY);
  }

  function drawStars(avgDark) {
    if (avgDark < 0.2) return;
    const alpha = (avgDark - 0.2) * 1.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.9, alpha)})`;
    for (const s of stars) {
      ctx.fillRect(Math.round(s.x * scaleX), Math.round(s.y * scaleY), Math.ceil(scaleX * 1), Math.ceil(scaleY * 1));
    }
  }

  function drawSea() {
    vRect(0, HORIZON_Y, VIRTUAL_W, GROUND_Y - HORIZON_Y, PALETTE.sea);
    // Wave bands
    for (let y = HORIZON_Y + 4; y < GROUND_Y; y += 4) {
      for (let x = 0; x < VIRTUAL_W; x += 6) {
        const off = ((x + Math.floor((Date.now() / 220) % 6)) % 6);
        if (off < 3) vRect(x, y, 3, 1, PALETTE.seaLight);
      }
    }
  }

  function drawIsland() {
    // Sand strip
    vRect(0, GROUND_Y - 4, VIRTUAL_W, 4, PALETTE.sand);
    // Grass field
    vRect(0, GROUND_Y, VIRTUAL_W, VIRTUAL_H - GROUND_Y, PALETTE.grass);
    // Darker grass tufts
    for (let x = 0; x < VIRTUAL_W; x += 5) {
      vRect(x + ((x * 13) % 3), GROUND_Y + 2 + ((x * 7) % 3), 1, 1, PALETTE.grassDk);
    }
  }

  function drawCrops() {
    for (const c of crops) {
      if (c.burned) {
        vRect(c.x - 1, GROUND_Y - 2, 2, 2, PALETTE.cloudDark);
      } else {
        const h = Math.round(2 + c.growth * 4);
        const color = c.ripe ? PALETTE.cropRipe : PALETTE.crop;
        vRect(c.x - 1, GROUND_Y - h, 2, h, color);
        if (c.ripe) {
          vRect(c.x - 2, GROUND_Y - h, 1, 1, PALETTE.cropRipe);
          vRect(c.x + 1, GROUND_Y - h, 1, 1, PALETTE.cropRipe);
        }
      }
    }
  }

  function drawHouses() {
    // Two houses in town center-right
    drawHouse(118, GROUND_Y - 14, PALETTE.woodLite, PALETTE.roof);
    drawHouse(140, GROUND_Y - 16, PALETTE.woodDark, PALETTE.roofDk);
    drawHouse(158, GROUND_Y - 12, PALETTE.woodLite, PALETTE.roof);
  }

  function drawHouse(x, y, wallColor, roofColor) {
    // walls
    vRect(x, y, 14, GROUND_Y - y, wallColor);
    // roof (triangle approximated with stair-step)
    const rh = 5;
    for (let i = 0; i < rh; i++) {
      vRect(x - 1 + i, y - rh + i, 14 - 2 * i + 2, 1, roofColor);
    }
    // door
    vRect(x + 5, GROUND_Y - 5, 4, 5, PALETTE.cloudDark);
    // window
    vRect(x + 2, y + 2, 3, 3, PALETTE.light);
    vRect(x + 9, y + 2, 3, 3, PALETTE.light);
  }

  function drawLighthouse() {
    const lx = 175, ly = GROUND_Y - 28;
    // Tower
    vRect(lx, ly, 6, 28, PALETTE.cloudHi);
    vRect(lx, ly + 8, 6, 4, '#c0392b');
    // Lamp room
    vRect(lx - 1, ly - 4, 8, 4, PALETTE.cloudDark);
    vRect(lx, ly - 3, 6, 2, PALETTE.bolt);
    // Beacon
    if ((Date.now() % 1400) < 400) {
      vRect(lx - 2, ly - 2, 10, 1, 'rgba(255, 226, 138, 0.5)');
    }
  }

  function drawTownsfolk() {
    for (const p of townsfolk) {
      drawPerson(p);
    }
  }

  function drawPerson(p) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    // bob
    const bob = (p.kind === 'farmer' && !p.fled) ? Math.floor(Math.sin(p.anim * 6) * 1) : 0;
    // body
    vRect(px - 1, py - 4 + bob, 3, 4, p.coat);
    // head
    vRect(px - 1, py - 6 + bob, 3, 2, PALETTE.person);
    // umbrella?
    if (p.umbrella && (p.kind === 'picnicker' || p.kind === 'sailor' || p.kind === 'farmer')) {
      const uColor = p.kind === 'picnicker' ? PALETTE.umbrella1
                  : p.kind === 'sailor'    ? PALETTE.umbrella2
                  : PALETTE.umbrella3;
      vRect(px - 3, py - 9 + bob, 7, 1, uColor);
      vRect(px - 2, py - 10 + bob, 5, 1, uColor);
      vRect(px, py - 8 + bob, 1, 2, PALETTE.cloudDark);
    }
    // Picnic basket if picnic and not fled
    if (p.kind === 'picnicker' && !p.fled) {
      vRect(px - 4, py - 1, 3, 2, PALETTE.cropRipe);
    }
    // Lighthouse keeper wave
    if (p.kind === 'keeper' && p.waveAccum > 0) {
      const wave = Math.sin(p.waveAccum * 8);
      vRect(px + 2, py - 5 + Math.floor(wave * 1), 1, 2, PALETTE.person);
    }
    // Fled marker — sweat
    if (p.fled) {
      vRect(px + 2, py - 7 + bob, 1, 1, PALETTE.rain);
    }
  }

  function drawRain() {
    ctx.fillStyle = PALETTE.rain;
    for (const d of raindrops) {
      ctx.fillRect(Math.round(d.x * scaleX), Math.round(d.y * scaleY),
                   Math.max(1, Math.round(scaleX * 0.8)), Math.max(2, Math.round(scaleY * 2)));
    }
  }

  function drawHail() {
    if (!hailstones.length) return;
    for (const h of hailstones) {
      const r = Math.max(1, Math.round(h.r * scaleX));
      // White core
      ctx.fillStyle = PALETTE.cloudHi;
      ctx.fillRect(Math.round((h.x - h.r) * scaleX), Math.round((h.y - h.r) * scaleY), r * 2, r * 2);
      // Cool blue rim hint
      ctx.fillStyle = PALETTE.rain;
      ctx.fillRect(Math.round((h.x - h.r) * scaleX), Math.round((h.y + h.r * 0.4) * scaleY), r * 2, Math.max(1, Math.round(scaleY * 0.6)));
    }
  }

  function drawClouds() {
    for (const c of clouds) {
      drawCloud(c);
    }
  }

  function drawCloud(c) {
    const cx = c.x;
    const cy = c.y;
    const r = c.r * c.size;
    const dark = c.darkening;
    const isStorm = c.stormForm;
    const baseColor = isStorm ? PALETTE.cloudLo : (dark > 0.5 ? PALETTE.cloudLo : (dark > 0.2 ? PALETTE.cloudMid : PALETTE.cloudHi));
    const shadow = isStorm ? PALETTE.cloudDark : (dark > 0.5 ? PALETTE.cloudDark : PALETTE.cloudLo);

    // Build pixel-art cloud from a deterministic blob pattern.
    // Thunderheads get an anvil top — wider blobs above the base.
    const blobs = isStorm ? [
      { dx: 0, dy: 0, rr: r * 1.0 },
      { dx: -r * 0.8, dy: 2, rr: r * 0.75 },
      { dx: r * 0.8, dy: 2, rr: r * 0.75 },
      { dx: -r * 1.0, dy: -3, rr: r * 0.6 },
      { dx: r * 1.0, dy: -3, rr: r * 0.6 },
      { dx: 0, dy: -5, rr: r * 0.7 },
    ] : [
      { dx: 0, dy: 0, rr: r * 1.0 },
      { dx: -r * 0.7, dy: 1, rr: r * 0.7 },
      { dx: r * 0.7, dy: 1, rr: r * 0.7 },
      { dx: -r * 0.4, dy: -2, rr: r * 0.55 },
      { dx: r * 0.4, dy: -2, rr: r * 0.55 },
    ];
    // bottom shadow
    for (const b of blobs) {
      drawPixelCircle(cx + b.dx, cy + b.dy + 1, b.rr, shadow);
    }
    for (const b of blobs) {
      drawPixelCircle(cx + b.dx, cy + b.dy - 1, b.rr, baseColor);
    }
    // Charge glow when held
    if (activePointer && activePointer.cloud === c && !activePointer.holdActive) {
      const heldMs = performance.now() - activePointer.startMs;
      const charge = Math.min(1, heldMs / HOLD_MS);
      ctx.fillStyle = `rgba(255, 245, 184, ${charge * 0.6})`;
      ctx.fillRect(Math.round((cx - r) * scaleX), Math.round((cy - r) * scaleY),
                   Math.ceil(r * 2 * scaleX), Math.ceil(r * 2 * scaleY));
    }
  }

  function drawPixelCircle(cx, cy, r, color) {
    ctx.fillStyle = color;
    const steps = Math.max(4, Math.ceil(r / 1.2));
    for (let dy = -steps; dy <= steps; dy++) {
      const y = cy + dy;
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w <= 0) continue;
      ctx.fillRect(Math.round((cx - w) * scaleX), Math.round((y) * scaleY),
                   Math.ceil(w * 2 * scaleX), Math.ceil(scaleY));
    }
  }

  function drawBolts() {
    for (const b of bolts) {
      const intensity = 1 - (b.life / 0.4);
      const coreScale = b.thunder ? 1.8 : 1.2;
      const glowScale = b.thunder ? 4.0 : 2.4;
      ctx.strokeStyle = `rgba(255, 245, 184, ${Math.max(0, intensity)})`;
      ctx.lineWidth = Math.max(1, Math.round(scaleX * coreScale));
      ctx.beginPath();
      for (const seg of b.segments) {
        ctx.moveTo(seg.x1 * scaleX, seg.y1 * scaleY);
        ctx.lineTo(seg.x2 * scaleX, seg.y2 * scaleY);
      }
      ctx.stroke();
      // Glow
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, intensity * (b.thunder ? 0.55 : 0.4))})`;
      ctx.lineWidth = Math.max(2, Math.round(scaleX * glowScale));
      ctx.beginPath();
      for (const seg of b.segments) {
        ctx.moveTo(seg.x1 * scaleX, seg.y1 * scaleY);
        ctx.lineTo(seg.x2 * scaleX, seg.y2 * scaleY);
      }
      ctx.stroke();
    }
  }

  function drawFires() {
    for (const f of fires) {
      const flick = Math.sin(f.flicker) * 0.5 + 1;
      const baseW = 3 + flick;
      const baseH = 4 + flick;
      vRect(f.x - baseW / 2, f.y - baseH, baseW, baseH, PALETTE.fire);
      vRect(f.x - baseW / 4, f.y - baseH - 1, baseW / 2, 1, PALETTE.ember);
    }
  }

  function drawSmoke() {
    for (const s of smokes) {
      ctx.fillStyle = `rgba(122, 116, 104, ${Math.max(0, s.alpha)})`;
      ctx.fillRect(Math.round(s.x * scaleX), Math.round(s.y * scaleY),
                   Math.ceil(2 * scaleX), Math.ceil(2 * scaleY));
    }
  }

  // ---------- Session lifecycle ----------
  let statsInterventions = 0;

  function startSession(seedExtra) {
    sessionStarted = false;
    sessionEnded = false;
    timeRemaining = SESSION_SECONDS;
    statsInterventions = 0;
    document.getElementById('intervention-count').textContent = '0';
    document.getElementById('timer').textContent = SESSION_SECONDS.toString();
    document.getElementById('hud').querySelector('.hud-timer').classList.remove('warn');

    seedSession(seedExtra);
    sizeCanvas();
    buildWorld();

    document.getElementById('splash').hidden = true;
    document.getElementById('verdict').hidden = true;

    sessionStarted = true;
    runStartMs = performance.now();
    lastFrameMs = runStartMs;
    if (!rafHandle) rafHandle = requestAnimationFrame(frame);
  }

  function endSession() {
    sessionEnded = true;
    sessionStarted = false;
    cancelAnimationFrame(rafHandle);
    rafHandle = 0;
    showVerdict();
  }

  // ---------- Verdict UI ----------
  function showVerdict() {
    const verdict = pickVerdict(stats);

    // Capture frozen scene as background of verdict card later if needed.
    document.getElementById('verdict-name').textContent = verdict.name;
    document.getElementById('verdict-caption').textContent = '"' + verdict.caption + '"';
    document.getElementById('verdict-stamp').textContent = verdict.stamp;

    const statsBox = document.getElementById('verdict-stats');
    statsBox.innerHTML = '';
    const rows = [
      ['LIGHTNING STRUCK',  stats.lightning_count],
      ['THUNDER PULSES',    stats.thunder_pulses],
      ['RAIN VOLUME',       stats.rain_volume_units.toFixed(1) + ' units'],
      ['HAIL VOLUME',       stats.hail_volume_units.toFixed(1) + ' units'],
      ['THUNDERHEADS',      stats.thunderheads_summoned],
      ['DROUGHT WINDOW',    Math.round(stats.drought_seconds) + 's'],
      ['PRESSURE INDEX',    Math.round(stats.sustained_pressure_seconds)],
      ['TOWN AFFECTED',     Math.round(stats.percent_townsfolk_affected * 100) + '%'],
      ['ROOFS / CROPS LIT', stats.fires_started],
      ['CROPS HAILED',      stats.crops_hailed],
      ['LIGHTHOUSE WAVE',   stats.keeper_waved ? 'YES' : 'no'],
      ['PICNIC SURVIVED',   stats.picnic_survived ? 'yes' : 'NO']
    ];
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span>${k}</span><span>${v}</span>`;
      statsBox.appendChild(row);
    }

    // Case ID — derived from seed and verdict
    const cid = ((sessionSeed ^ (verdict.id.charCodeAt(0) * 7919)) % 999999).toString().padStart(6, '0');
    document.getElementById('case-id').textContent = cid.slice(0, 3) + '-' + cid.slice(3);
    const dt = new Date();
    const opts = { year: 'numeric', month: 'short', day: '2-digit' };
    document.getElementById('audit-date').textContent = dt.toLocaleDateString('en-US', opts).toLowerCase();

    document.getElementById('verdict').hidden = false;
  }

  // ---------- Share PNG ----------
  window.share = function share() {
    // Compose share PNG: frozen sky (canvas) on top, verdict card overlay below
    try {
      const w = 1080;
      const h = 1350;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const octx = out.getContext('2d');

      // Background paper
      octx.fillStyle = PALETTE.paper || '#f4ecd8';
      octx.fillStyle = '#f4ecd8';
      octx.fillRect(0, 0, w, h);

      // Top half — frozen scene
      const sceneH = Math.floor(h * 0.55);
      octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 24, 24, w - 48, sceneH);
      // border
      octx.strokeStyle = '#1a1410';
      octx.lineWidth = 6;
      octx.strokeRect(24, 24, w - 48, sceneH);

      // Bottom — verdict text composition
      const vy = sceneH + 60;
      // Letterhead
      octx.fillStyle = '#1f4d8a';
      octx.font = 'bold 26px "Press Start 2P", monospace';
      octx.fillText('METEOROLOGICAL SOCIETY', 48, vy);
      octx.fillStyle = '#1a1410';
      octx.font = '20px "Press Start 2P", monospace';
      octx.fillText('OF THE IMAGINED COAST', 48, vy + 32);
      octx.font = '20px VT323, monospace';
      octx.fillStyle = '#4a3b28';
      octx.fillText('// DIVINITY AUDIT — FILED IMMEDIATELY', 48, vy + 60);

      // Verdict
      octx.fillStyle = '#4a3b28';
      octx.font = '18px "Press Start 2P", monospace';
      octx.fillText('VERDICT', 48, vy + 110);

      const verdict = pickVerdict(stats);
      octx.fillStyle = '#1a1410';
      octx.font = 'bold 32px "Press Start 2P", monospace';
      wrapText(octx, verdict.name.toUpperCase(), 48, vy + 152, w - 96, 40);

      // Caption
      octx.fillStyle = '#1a1410';
      octx.font = 'italic 32px "VT323", monospace';
      const capY = wrapText(octx, '"' + verdict.caption + '"', 48, vy + 260, w - 96, 36);

      // Stamp
      octx.save();
      octx.translate(w - 200, vy + 120);
      octx.rotate(0.14);
      octx.strokeStyle = '#c0392b';
      octx.lineWidth = 6;
      octx.strokeRect(-90, -28, 180, 56);
      octx.fillStyle = '#c0392b';
      octx.font = 'bold 22px "Press Start 2P", monospace';
      octx.textAlign = 'center';
      octx.fillText(verdict.stamp, 0, 8);
      octx.restore();
      octx.textAlign = 'left';

      // Footer
      octx.fillStyle = '#4a3b28';
      octx.font = '24px "VT323", monospace';
      const cid = ((sessionSeed ^ (verdict.id.charCodeAt(0) * 7919)) % 999999).toString().padStart(6, '0');
      octx.fillText('case #' + cid.slice(0, 3) + '-' + cid.slice(3) + '  ·  weather god mode', 48, h - 48);
      octx.textAlign = 'right';
      octx.fillText('benlirio.com/apps/weather-god-mode', w - 48, h - 48);

      out.toBlob(blob => {
        if (!blob) { fallbackShare(); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'divinity-audit-' + cid + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        // Also copy URL to clipboard for share-link convenience
        if (navigator.clipboard) {
          navigator.clipboard.writeText(location.href).catch(() => {});
        }
      }, 'image/png');
    } catch (e) {
      console.error('share failed', e);
      fallbackShare();
    }
  };

  function fallbackShare() {
    if (navigator.share) {
      navigator.share({ title: document.title, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href).then(() => alert('Link copied!'));
    } else {
      alert(location.href);
    }
  }

  function wrapText(octx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (octx.measureText(test).width > maxWidth && line.length) {
        octx.fillText(line, x, cy);
        line = words[i] + ' ';
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    octx.fillText(line, x, cy);
    return cy;
  }

  // ---------- Boot ----------
  function boot() {
    canvas = document.getElementById('sky');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Pre-size & seed an initial scene to draw under splash
    seedSession(0);
    // Defer canvas sizing to after first layout
    requestAnimationFrame(() => {
      sizeCanvas();
      buildWorld();
      drawScene(0);
    });

    window.addEventListener('resize', () => {
      sizeCanvas();
      drawScene(performance.now());
    });

    // Pointer events
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Buttons
    document.getElementById('begin-btn').addEventListener('click', () => startSession(0));
    document.getElementById('replay-btn').addEventListener('click', () => startSession(Date.now() & 0xffff));

    // Idle render loop until session begins
    function idleFrame(t) {
      if (!sessionStarted) {
        // Animate clouds gently
        for (const c of clouds) {
          c.x += c.vx * 0.5;
          if (c.x < -30) c.x = VIRTUAL_W + 20;
          if (c.x > VIRTUAL_W + 30) c.x = -20;
        }
        drawScene(t);
        requestAnimationFrame(idleFrame);
      }
    }
    requestAnimationFrame(idleFrame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
