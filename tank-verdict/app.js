// Tank Verdict — a 60-second nano-aquarium personality oracle.
// The tank is deterministic. Same seed -> same fish -> same verdict.

(function () {
  'use strict';

  // ---------- seeded RNG ----------

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  // ---------- DOM ----------

  const canvas = document.getElementById('tank');
  const ctx = canvas.getContext('2d');
  const meterFill = document.getElementById('meter-fill');
  const meterLabel = document.getElementById('meter-label');
  const statusEl = document.getElementById('status');
  const plaque = document.getElementById('plaque');
  const plaqueTitle = document.getElementById('plaque-title');
  const plaqueFine = document.getElementById('plaque-fine');
  const captionEl = document.getElementById('caption');
  const apexEl = document.getElementById('apex');
  const microEl = document.getElementById('microcopy');
  const shakeBtn = document.getElementById('shake');
  const shareDiv = document.getElementById('share');

  // ---------- DPR aware canvas ----------

  let W = canvas.width;
  let H = canvas.height;

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 540;
    const ratio = 660 / 540;
    const cssH = cssW * ratio;
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    W = canvas.width;
    H = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // logical drawing units = CSS pixels
    W = cssW;
    H = cssH;
  }

  // ---------- ethologist baselines ----------
  // Empirical baselines (mean, std) for z-scoring metrics.
  // Tuned by hand so that "average" runs land near zero and outliers cross 0.6.
  const BASELINES = {
    shoalTight:  { mean: 110, std: 35 },  // avg pairwise dist (px). LOWER = tighter shoal
    surface:     { mean: 0.50, std: 0.18 }, // avg y / H. LOWER = surface-loving
    pacing:      { mean: 0.18, std: 0.12 }, // edge-frame ratio
    fights:      { mean: 26,  std: 18 },   // close-encounter flashes
    hideTime:    { mean: 0.22, std: 0.13 }, // hide-zone frame ratio
    chase:       { mean: 0.32, std: 0.20 }  // food-chase intensity ratio
  };

  // ---------- verdicts ----------
  // Each entry: predicate(z) -> boolean ; if multiple match, the one with
  // the highest "specificity" wins (sum of |z| across mentioned axes).
  // Verdicts are deadpan museum-plaque names.
  const VERDICTS = [
    {
      title: 'A Quiet Zen Pool',
      fine: 'Specimen #017 · Sub-threshold across all axes',
      score: z => -Math.max(Math.abs(z.pacing), Math.abs(z.fights), Math.abs(z.chase)) - Math.abs(z.shoalTight),
      // wins when everything is small in magnitude
      pred: z => Math.abs(z.pacing) < 0.5 && Math.abs(z.fights) < 0.5 && Math.abs(z.chase) < 0.6
    },
    {
      title: 'The Glass-Pacing Dynasty',
      fine: 'Specimen #482 · Persistent perimeter syndrome',
      score: z => z.pacing * 2,
      pred: z => z.pacing > 0.7
    },
    {
      title: 'The Shrimp Mafia',
      fine: 'Specimen #209 · Driftwood-aligned, low aggression',
      score: z => z.hideTime * 1.4 - z.pacing * 0.8,
      pred: z => z.hideTime > 0.6 && z.pacing < 0.3
    },
    {
      title: 'Cathedral of the Dawn Patrol',
      fine: 'Specimen #061 · Surface-dwelling congregation',
      score: z => -z.surface * 1.6 + z.shoalTight * -0.4,
      pred: z => z.surface < -0.7
    },
    {
      title: 'The Hierarchy Wars',
      fine: 'Specimen #888 · Repeated dyadic flash events',
      score: z => z.fights * 1.6,
      pred: z => z.fights > 0.7
    },
    {
      title: 'Famine Refugees',
      fine: 'Specimen #404 · High flake-aggression, low cohesion',
      score: z => z.chase * 1.4 + Math.max(0, z.shoalTight * 0.6),
      pred: z => z.chase > 0.7 && z.shoalTight > 0.3
    },
    {
      title: 'Cult of the Driftwood Saint',
      fine: 'Specimen #033 · Cohesive shelter habit',
      score: z => z.hideTime * 1.2 - z.shoalTight * 0.8,
      pred: z => z.hideTime > 0.5 && z.shoalTight < -0.3
    },
    {
      title: 'The Insomnia Tank',
      fine: 'Specimen #002 · Pacing & fights both elevated',
      score: z => z.pacing + z.fights,
      pred: z => z.pacing > 0.5 && z.fights > 0.5
    },
    {
      title: 'A Loose Confederacy',
      fine: 'Specimen #144 · Wide spacing, mild aggression',
      score: z => z.shoalTight * 1.0 - Math.abs(z.fights) * 0.3,
      pred: z => z.shoalTight > 0.7
    },
    {
      title: 'The Tight Coin',
      fine: 'Specimen #099 · Hyper-cohesive shoaling event',
      score: z => -z.shoalTight * 1.2,
      pred: z => z.shoalTight < -0.7
    },
    {
      title: 'The Benthic Lodge',
      fine: 'Specimen #311 · Substrate-bound, anti-light',
      score: z => z.surface * 1.4,
      pred: z => z.surface > 0.7
    },
    {
      title: 'A Polite Disagreement',
      fine: 'Specimen #051 · Modest hierarchy, otherwise calm',
      score: z => z.fights * 0.8 - Math.abs(z.pacing) * 0.4,
      pred: z => z.fights > 0.4 && z.fights < 0.8 && Math.abs(z.pacing) < 0.5
    },
    {
      title: 'The Velvet Syndicate',
      fine: 'Specimen #777 · Hide-aligned with quiet patrols',
      score: z => z.hideTime * 0.9 + z.pacing * 0.4,
      pred: z => z.hideTime > 0.4 && z.pacing > 0.3 && z.fights < 0.4
    },
    {
      title: 'A Middle-Class Aquarium',
      fine: 'Specimen #100 · Statistically unremarkable',
      score: z => -Math.abs(z.shoalTight) - Math.abs(z.fights) - Math.abs(z.chase),
      pred: z => true // fallback
    },
    {
      title: 'The Flake Riots',
      fine: 'Specimen #013 · Erratic resource pursuit',
      score: z => z.chase * 1.3,
      pred: z => z.chase > 0.6
    },
    {
      title: 'Diaspora Tank',
      fine: 'Specimen #220 · Loose spacing, surface preference',
      score: z => z.shoalTight * 0.9 - z.surface * 0.7,
      pred: z => z.shoalTight > 0.4 && z.surface < -0.3
    },
    {
      title: 'The Driftwood Senate',
      fine: 'Specimen #500 · Quorum convened in hide zone',
      score: z => z.hideTime * 1.1 + Math.max(0, -z.shoalTight) * 0.5,
      pred: z => z.hideTime > 0.6 && z.shoalTight < 0
    },
    {
      title: 'A Civilized Drowsiness',
      fine: 'Specimen #008 · Mid-column, mid-everything',
      score: z => -Math.abs(z.surface) * 1.1 - Math.abs(z.pacing) * 0.5,
      pred: z => Math.abs(z.surface) < 0.3 && Math.abs(z.pacing) < 0.3 && z.hideTime < 0.4
    }
  ];

  // ---------- Latin-ish binomial generator (deterministic) ----------
  const GENERA = ['Tankus','Vitreus','Aqualis','Limnophilus','Riparius','Pelagius','Stagnus','Driftwoodia','Atricola','Hyalinus','Algivorus','Specularis'];
  const SPECIES = {
    pacing:    ['impatiens','perimetri','glassbreaker','vagans','infinitus','marathoni'],
    fights:    ['belliger','duelistris','flagrans','agitator','rixor','crestus'],
    hideTime:  ['umbraticus','pudicus','abditus','sub-driftwoodensis','timidus','lateralis'],
    surfaceUp: ['solaris','epi-pelagicus','dawnward','meniscus','aurifex','luminis'],
    surfaceDn: ['benthicus','substrati','cryptus','sediment-domus','infraluminis','umbra'],
    chase:     ['flakefoeder','rapax','famelicus','crumbis','mendicans','intercept'],
    shoalLoose:['solitarius','separatus','exilis','distantis','peregrinus'],
    shoalTight:['concordia','agglomeratus','close-orbis','pacti','fasciatus'],
    quiet:     ['quietus','dormiens','nullus','aequus','medianus']
  };

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ---------- main state ----------

  let seed = 0;
  let rng = makeRng(1);
  let fish = [];
  let flakes = [];
  let algae = [];
  let driftwood = null;
  let dust = [];
  let lightFlicker = 0;

  let metrics = null;
  let lastT = 0;
  let elapsed = 0; // ms
  const DURATION = 60000;
  let observationActive = true;
  let verdictDelivered = false;
  let runId = 0;

  const statusLines = [
    'the ethologist is taking notes…',
    'logging behavior at 40Hz…',
    'the algae considers its options…',
    'noting glass-touch events…',
    'measuring pairwise distance…',
    'dyad number three is restless…'
  ];
  let statusIdx = 0;
  let statusTimer = 0;

  // ---------- world layout ----------

  function buildWorld() {
    fitCanvas();
    // Driftwood: a horizontal piece in the lower-third with a hide zone.
    const wx = W * (0.18 + rng() * 0.1);
    const wy = H * (0.66 + rng() * 0.06);
    const ww = W * (0.55 + rng() * 0.08);
    const wh = 22 + rng() * 6;
    driftwood = {
      x: wx, y: wy, w: ww, h: wh,
      // Hide zone is the cylinder under the wood
      hide: { x: wx + ww * 0.2, y: wy + wh, w: ww * 0.6, h: 70 }
    };

    // Dust motes
    dust = [];
    for (let i = 0; i < 38; i++) {
      dust.push({
        x: rng() * W,
        y: rng() * H,
        v: 4 + rng() * 8,
        s: 0.4 + rng() * 0.9,
        a: 0.04 + rng() * 0.18
      });
    }

    // Algae starts empty; grows during run
    algae = [];

    // Fish — 6, each with a personality from seed
    fish = [];
    for (let i = 0; i < 6; i++) {
      const boldness    = rng();        // 0 = shy, 1 = bold
      const sociability = rng();        // 0 = loner, 1 = shoal-y
      const surfacePref = rng();        // 0 = bottom, 1 = surface
      const aggression  = rng();        // 0 = peaceful, 1 = scrappy
      const pacingBias  = rng();        // 0 = no glass interest, 1 = glass addict
      const hideBias    = 1 - boldness; // shy fish hide

      // Pick a riso-green tone with occasional warm accent
      const greenT = rng();
      let body, fin;
      if (i === 0 && rng() < 0.7) {
        // one warm accent fish
        body = '#d99a3a';
        fin  = '#a76b1a';
      } else if (greenT < 0.45) {
        body = '#5a8b3e';
        fin  = '#3f6a26';
      } else if (greenT < 0.85) {
        body = '#7fb155';
        fin  = '#4a7332';
      } else {
        body = '#bcd07a';
        fin  = '#7d9646';
      }

      fish.push({
        id: i,
        x: 40 + rng() * (W - 80),
        y: H * (0.2 + rng() * 0.55),
        vx: (rng() - 0.5) * 30,
        vy: (rng() - 0.5) * 18,
        size: 11 + rng() * 5,
        body, fin,
        // personality
        boldness, sociability, surfacePref, aggression, pacingBias, hideBias,
        // metric accumulators
        glassFrames: 0,
        hideFrames: 0,
        flashes: 0,
        chases: 0,
        ySum: 0,
        active: 0,
        // visual
        flashTimer: 0,
        targetFlake: null,
        wig: rng() * Math.PI * 2
      });
    }

    flakes = [];

    metrics = {
      pairsSum: 0,
      pairsCount: 0,
      ySum: 0,
      yCount: 0,
      glassFrames: 0,
      hideFrames: 0,
      fights: 0,
      flakeChases: 0,
      flakeSpawns: 0,
      frames: 0
    };
  }

  // ---------- spawn flakes (food events) ----------

  function maybeSpawnFlake(dt) {
    // Probability scales gently over time, capped.
    // Roughly 4-7 flakes per 60s run at average rng.
    if (flakes.length > 2) return;
    const p = 0.0015 * dt; // dt in ms
    if (rng() < p) {
      flakes.push({
        x: 40 + rng() * (W - 80),
        y: -10,
        vx: (rng() - 0.5) * 8,
        vy: 16 + rng() * 10,
        life: 10000,
        eaten: false
      });
      metrics.flakeSpawns++;
    }
  }

  // ---------- physics step ----------

  function stepFish(dt) {
    const dts = dt / 1000; // seconds

    // Compute pairwise spacing for shoaling metric
    let pairsSum = 0, pairsCount = 0;
    for (let i = 0; i < fish.length; i++) {
      for (let j = i + 1; j < fish.length; j++) {
        const dx = fish[i].x - fish[j].x;
        const dy = fish[i].y - fish[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        pairsSum += d; pairsCount++;
      }
    }
    metrics.pairsSum += pairsSum / pairsCount;
    metrics.pairsCount += 1;

    // Update each fish
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];

      // Boids-ish forces
      let sepX = 0, sepY = 0;
      let aliX = 0, aliY = 0, aliN = 0;
      let cohX = 0, cohY = 0, cohN = 0;

      for (let j = 0; j < fish.length; j++) {
        if (i === j) continue;
        const o = fish[j];
        const dx = f.x - o.x;
        const dy = f.y - o.y;
        const d2 = dx*dx + dy*dy;
        const d = Math.sqrt(d2) + 0.001;

        // separation (close)
        if (d < 22) {
          sepX += dx / d;
          sepY += dy / d;
        }
        // alignment + cohesion (medium)
        if (d < 100) {
          aliX += o.vx; aliY += o.vy; aliN++;
          cohX += o.x;  cohY += o.y;  cohN++;
        }
        // hierarchy fights — close encounter pulse
        if (d < 26 && f.aggression > 0.55 && o.aggression > 0.4) {
          // count once per pair encounter via flashTimer cooldown
          if (f.flashTimer <= 0) {
            f.flashes++;
            f.flashTimer = 800; // ms
            metrics.fights++;
          }
        }
      }

      // Apply forces (scaled by personality)
      const sepK = 60;
      const aliK = 0.6 * f.sociability;
      const cohK = 0.18 * f.sociability;

      f.vx += sepX * sepK * dts;
      f.vy += sepY * sepK * dts;

      if (aliN > 0) {
        f.vx += ((aliX/aliN) - f.vx) * aliK * dts;
        f.vy += ((aliY/aliN) - f.vy) * aliK * dts;
      }
      if (cohN > 0) {
        f.vx += ((cohX/cohN) - f.x) * cohK * dts;
        f.vy += ((cohY/cohN) - f.y) * cohK * dts;
      }

      // Surface/bottom bias: pull toward preferred y
      const targetY = H * (0.18 + (1 - f.surfacePref) * 0.6);
      f.vy += (targetY - f.y) * 0.6 * dts;

      // Glass-pacing bias: bold fish with high pacing seek edges
      if (f.pacingBias > 0.55) {
        const nearestEdge = (f.x < W/2) ? 14 : (W - 14);
        f.vx += (nearestEdge - f.x) * 0.5 * dts * (f.pacingBias - 0.4);
      }

      // Hide bias: shy fish toward driftwood hide
      if (f.hideBias > 0.55) {
        const cx = driftwood.hide.x + driftwood.hide.w/2;
        const cy = driftwood.hide.y + driftwood.hide.h/2;
        f.vx += (cx - f.x) * 0.4 * dts * (f.hideBias - 0.4);
        f.vy += (cy - f.y) * 0.4 * dts * (f.hideBias - 0.4);
      }

      // Flake chase
      if (flakes.length > 0) {
        // pick nearest flake within range, weighted by aggression
        let best = null, bestD = 1e9;
        for (const fl of flakes) {
          if (fl.eaten) continue;
          const dx = fl.x - f.x, dy = fl.y - f.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 220 && d < bestD) { best = fl; bestD = d; }
        }
        if (best) {
          const chaseStrength = 60 * (0.3 + f.aggression);
          const dx = best.x - f.x, dy = best.y - f.y;
          const d = Math.sqrt(dx*dx + dy*dy) + 0.001;
          f.vx += (dx/d) * chaseStrength * dts;
          f.vy += (dy/d) * chaseStrength * dts;
          if (d < 14 && !best.eaten) {
            best.eaten = true;
            f.chases++;
            metrics.flakeChases++;
          }
        }
      }

      // Random wiggle (deterministic from rng)
      f.wig += dts * (2 + f.aggression * 2);
      f.vx += Math.cos(f.wig) * 6 * dts;
      f.vy += Math.sin(f.wig * 1.3) * 4 * dts;

      // Speed cap
      const speed = Math.sqrt(f.vx*f.vx + f.vy*f.vy);
      const maxSpeed = 38 + f.boldness * 24;
      if (speed > maxSpeed) {
        f.vx *= maxSpeed/speed;
        f.vy *= maxSpeed/speed;
      }

      // Integrate
      f.x += f.vx * dts;
      f.y += f.vy * dts;

      // Glass collisions + pacing metric
      let touching = false;
      if (f.x < 14) { f.x = 14; f.vx = Math.abs(f.vx) * 0.6; touching = true; }
      if (f.x > W - 14) { f.x = W - 14; f.vx = -Math.abs(f.vx) * 0.6; touching = true; }
      if (f.y < 18) { f.y = 18; f.vy = Math.abs(f.vy) * 0.6; touching = true; }
      if (f.y > H - 14) { f.y = H - 14; f.vy = -Math.abs(f.vy) * 0.6; touching = true; }
      if (touching) {
        f.glassFrames++;
        metrics.glassFrames++;
      }

      // Hide zone presence
      const hz = driftwood.hide;
      if (f.x > hz.x && f.x < hz.x + hz.w && f.y > hz.y && f.y < hz.y + hz.h) {
        f.hideFrames++;
        metrics.hideFrames++;
      }

      f.ySum += f.y;
      f.active += Math.abs(f.vx) + Math.abs(f.vy);

      if (f.flashTimer > 0) f.flashTimer -= dt;
    }

    metrics.ySum = 0;
    metrics.yCount = 0;
    for (const f of fish) {
      metrics.ySum += f.ySum;
      metrics.yCount += metrics.frames + 1;
    }

    metrics.frames++;
  }

  function stepFlakes(dt) {
    const dts = dt / 1000;
    for (const fl of flakes) {
      if (fl.eaten) { fl.life = -1; continue; }
      fl.x += fl.vx * dts;
      fl.y += fl.vy * dts;
      fl.vx *= 0.99;
      fl.vy *= 0.985;
      fl.life -= dt;
    }
    for (let i = flakes.length - 1; i >= 0; i--) {
      if (flakes[i].life < 0 || flakes[i].y > H + 10) flakes.splice(i, 1);
    }
  }

  function stepDust(dt) {
    const dts = dt / 1000;
    for (const d of dust) {
      d.y += d.v * dts;
      d.x += Math.sin((d.y + d.s * 100) * 0.01) * 0.4;
      if (d.y > H) { d.y = -2; d.x = rng() * W; }
    }
  }

  function stepAlgae(dt) {
    // grow slowly. Probability per ms.
    if (algae.length > 220) return;
    const p = 0.0035 * dt;
    if (rng() < p) {
      const x = rng() * W;
      const y = H - 6 - rng() * 12;
      algae.push({ x, y, r: 0.8 + rng() * 1.6, t: 0, hue: rng() < 0.5 ? '#4a7a3a' : '#6fa84d' });
    }
    for (const a of algae) a.t += dt;
  }

  // ---------- rendering ----------

  function draw() {
    // Background — deep blackwater
    ctx.fillStyle = '#050706';
    ctx.fillRect(0, 0, W, H);

    // Warm overhead light gradient
    const grd = ctx.createRadialGradient(W * 0.5, -H * 0.15, 0, W * 0.5, -H * 0.05, H * 0.95);
    grd.addColorStop(0, 'rgba(240,200,120,0.18)');
    grd.addColorStop(0.35, 'rgba(240,200,120,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Subtle bottom moss tint
    const grd2 = ctx.createLinearGradient(0, H * 0.6, 0, H);
    grd2.addColorStop(0, 'rgba(74,122,58,0)');
    grd2.addColorStop(1, 'rgba(74,122,58,0.08)');
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, W, H);

    // Dust motes (off-register feel — slight green ghost)
    for (const d of dust) {
      ctx.globalAlpha = d.a;
      ctx.fillStyle = '#c8d97a';
      ctx.fillRect(d.x + 0.5, d.y, d.s, d.s);
      ctx.globalAlpha = d.a * 0.6;
      ctx.fillStyle = '#f0c878';
      ctx.fillRect(d.x, d.y, d.s, d.s);
    }
    ctx.globalAlpha = 1;

    // Algae (bottom)
    for (const a of algae) {
      const grow = Math.min(1, a.t / 4000);
      ctx.fillStyle = a.hue;
      ctx.globalAlpha = 0.55 * grow;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * grow, 0, Math.PI * 2);
      ctx.fill();
      // off-register ghost
      ctx.fillStyle = '#c8d97a';
      ctx.globalAlpha = 0.18 * grow;
      ctx.beginPath();
      ctx.arc(a.x + 1.5, a.y - 0.5, a.r * grow * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Driftwood
    drawDriftwood();

    // Flakes
    for (const fl of flakes) {
      if (fl.eaten) continue;
      ctx.fillStyle = 'rgba(240,200,120,0.85)';
      ctx.fillRect(fl.x - 1.5, fl.y - 1.5, 3, 3);
      ctx.fillStyle = 'rgba(240,200,120,0.25)';
      ctx.fillRect(fl.x - 2.5, fl.y - 2.5, 5, 5);
    }

    // Fish
    for (const f of fish) drawFish(f);

    // Subtle scanline of riso noise on top
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = (y & 1) ? '#0e1410' : '#000000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;

    // Glass edge inner shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function drawDriftwood() {
    const w = driftwood;
    // body: slanted dark bar with a riso-green ghost
    ctx.save();
    ctx.translate(w.x + w.w/2, w.y + w.h/2);
    ctx.rotate(-0.04);
    // ghost
    ctx.fillStyle = '#2a3a26';
    ctx.fillRect(-w.w/2 + 2, -w.h/2 + 2, w.w, w.h);
    // body
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(-w.w/2, -w.h/2, w.w, w.h);
    // top grain
    ctx.fillStyle = '#2a201a';
    ctx.fillRect(-w.w/2, -w.h/2, w.w, 2);
    // a knot
    ctx.fillStyle = '#0c0908';
    ctx.beginPath();
    ctx.arc(-w.w/4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFish(f) {
    const angle = Math.atan2(f.vy, f.vx);
    const flash = f.flashTimer > 0 ? Math.min(1, f.flashTimer / 800) : 0;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(angle);

    const len = f.size;
    const wide = f.size * 0.42;

    // off-register ghost (riso bleed)
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#c8d97a';
    ctx.beginPath();
    ctx.ellipse(1.2, 0.8, len, wide, 0, 0, Math.PI * 2);
    ctx.fill();

    // tail wedge ghost
    ctx.beginPath();
    ctx.moveTo(-len * 0.95 + 1.2, 0.8);
    ctx.lineTo(-len * 1.6 + 1.2, -wide * 0.9 + 0.8);
    ctx.lineTo(-len * 1.6 + 1.2, wide * 0.9 + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // body
    ctx.fillStyle = flash > 0 ? '#f0c878' : f.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, wide, 0, 0, Math.PI * 2);
    ctx.fill();

    // tail
    ctx.fillStyle = f.fin;
    ctx.beginPath();
    ctx.moveTo(-len * 0.95, 0);
    ctx.lineTo(-len * 1.6, -wide * 0.9);
    ctx.lineTo(-len * 1.6, wide * 0.9);
    ctx.closePath();
    ctx.fill();

    // dorsal fin
    ctx.beginPath();
    ctx.moveTo(-len * 0.1, -wide * 0.85);
    ctx.lineTo(len * 0.15, -wide * 1.4);
    ctx.lineTo(len * 0.5, -wide * 0.85);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(len * 0.55, -wide * 0.25, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c878';
    ctx.fillRect(len * 0.6, -wide * 0.32, 0.6, 0.6);

    ctx.restore();
  }

  // ---------- per-frame ----------

  function frame(t) {
    if (!lastT) lastT = t;
    let dt = t - lastT;
    lastT = t;
    if (dt > 80) dt = 80; // tab-switch guard

    if (observationActive) {
      elapsed += dt;
      maybeSpawnFlake(dt);
      stepFish(dt);
      stepFlakes(dt);
      stepDust(dt);
      stepAlgae(dt);

      // Update meter
      const pct = Math.min(1, elapsed / DURATION);
      meterFill.style.width = (pct * 100) + '%';

      // Cycle status line every ~10s
      statusTimer += dt;
      if (statusTimer > 10000) {
        statusTimer = 0;
        statusEl.classList.add('fading');
        const localId = runId;
        setTimeout(() => {
          if (localId !== runId) return;
          statusIdx = (statusIdx + 1) % statusLines.length;
          statusEl.innerHTML = '<em>' + statusLines[statusIdx] + '</em>';
          statusEl.classList.remove('fading');
        }, 600);
      }

      if (elapsed >= DURATION) {
        observationActive = false;
        deliverVerdict();
      }
    } else {
      // Continue gentle motion after verdict (tank keeps swimming)
      stepFish(dt * 0.85);
      stepFlakes(dt);
      stepDust(dt);
      // (no metric updates — they're frozen)
    }

    draw();
    requestAnimationFrame(frame);
  }

  // ---------- verdict ----------

  function computeMetrics() {
    const avgPair = metrics.pairsSum / Math.max(1, metrics.pairsCount);
    const surface = (() => {
      let total = 0, count = 0;
      for (const f of fish) {
        total += f.ySum;
        count += metrics.frames;
      }
      return (total / Math.max(1, count)) / H;
    })();
    const pacing = metrics.glassFrames / Math.max(1, metrics.frames * fish.length);
    const fights = metrics.fights;
    const hide = metrics.hideFrames / Math.max(1, metrics.frames * fish.length);
    const chase = metrics.flakeSpawns > 0
      ? metrics.flakeChases / Math.max(1, metrics.flakeSpawns)
      : BASELINES.chase.mean; // no flakes = neutral, not extreme

    const z = {
      shoalTight: (avgPair - BASELINES.shoalTight.mean) / BASELINES.shoalTight.std,
      surface:    (surface - BASELINES.surface.mean) / BASELINES.surface.std,
      pacing:     (pacing - BASELINES.pacing.mean) / BASELINES.pacing.std,
      fights:     (fights - BASELINES.fights.mean) / BASELINES.fights.std,
      hideTime:   (hide - BASELINES.hideTime.mean) / BASELINES.hideTime.std,
      chase:      (chase - BASELINES.chase.mean) / BASELINES.chase.std
    };

    return { raw: { avgPair, surface, pacing, fights, hide, chase }, z };
  }

  function pickVerdict(z) {
    let best = null, bestScore = -Infinity;
    for (const v of VERDICTS) {
      if (!v.pred(z)) continue;
      const s = v.score(z);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best || VERDICTS[VERDICTS.length - 4]; // fallback "A Middle-Class Aquarium"
  }

  function pickApex() {
    // dominant fish = highest .active sum, with personality tag
    let apex = fish[0];
    for (const f of fish) if (f.active > apex.active) apex = f;

    // build a binomial reflecting personality
    let speciesPool;
    if (apex.pacingBias > 0.7) speciesPool = SPECIES.pacing;
    else if (apex.aggression > 0.7) speciesPool = SPECIES.fights;
    else if (apex.hideBias > 0.7) speciesPool = SPECIES.hideTime;
    else if (apex.surfacePref > 0.7) speciesPool = SPECIES.surfaceUp;
    else if (apex.surfacePref < 0.3) speciesPool = SPECIES.surfaceDn;
    else if (apex.aggression > 0.5 && apex.boldness > 0.5) speciesPool = SPECIES.chase;
    else if (apex.sociability < 0.3) speciesPool = SPECIES.shoalLoose;
    else if (apex.sociability > 0.7) speciesPool = SPECIES.shoalTight;
    else speciesPool = SPECIES.quiet;

    const genus = pick(rng, GENERA);
    const species = pick(rng, speciesPool);
    return { apex, name: genus + ' ' + species };
  }

  function microcopy(z, raw) {
    // 1-2 lines referencing actual computed metrics.
    const glassTouches = metrics.glassFrames;
    const fightsN = metrics.fights;
    const flakesN = metrics.flakeSpawns;
    const eaten = metrics.flakeChases;
    const dom = (() => {
      const arr = [
        ['pacing', Math.abs(z.pacing)],
        ['fights', Math.abs(z.fights)],
        ['hideTime', Math.abs(z.hideTime)],
        ['shoalTight', Math.abs(z.shoalTight)],
        ['chase', Math.abs(z.chase)],
        ['surface', Math.abs(z.surface)]
      ];
      arr.sort((a,b) => b[1] - a[1]);
      return arr[0][0];
    })();

    // Hide-zone resident count
    let hiders = 0;
    for (const f of fish) if (f.hideFrames > metrics.frames * 0.35) hiders++;

    const lines = {
      pacing: glassTouches + ' glass-touches. The perimeter is the prison.',
      fights: fightsN + ' close-encounter flashes. The tank kept score.',
      hideTime: hiders + ' fish never left the driftwood. The other ' + (6 - hiders) + ' never approached it.',
      shoalTight: z.shoalTight < 0
        ? 'They swam as one body. Average pair-distance was ' + Math.round(raw.avgPair) + ' pixels.'
        : 'They drifted apart. Average pair-distance was ' + Math.round(raw.avgPair) + ' pixels.',
      chase: flakesN > 0
        ? eaten + ' of ' + flakesN + ' flakes were intercepted. The substrate kept the rest.'
        : 'No flakes fell. They learned nothing of hunger.',
      surface: z.surface < 0
        ? 'Their preferred altitude was the meniscus. Light was a destination.'
        : 'Their preferred altitude was the substrate. Light was a rumor.'
    };

    return lines[dom] || 'Statistically unremarkable. The ethologist closed the notebook.';
  }

  function deliverVerdict() {
    const m = computeMetrics();
    const v = pickVerdict(m.z);
    const apex = pickApex();
    const micro = microcopy(m.z, m.raw);

    // Plaque
    plaqueTitle.textContent = v.title;
    // Build the fine-print line with seed, runtime, and one metric value
    const seedHex = (seed >>> 0).toString(16).padStart(8, '0').slice(0, 6).toUpperCase();
    plaqueFine.textContent = v.fine + ' · #' + seedHex + ' · 60s · WARM 2700K';
    plaque.classList.add('show');
    plaque.setAttribute('aria-hidden', 'false');

    // Caption under canvas
    apexEl.innerHTML = 'Apex: <em>' + apex.name + '</em>';
    microEl.textContent = micro;
    captionEl.classList.add('show');

    // Hide status line
    statusEl.style.display = 'none';
    meterLabel.textContent = 'observation complete';

    // Show share
    shareDiv.style.display = 'block';

    verdictDelivered = true;
  }

  // ---------- run lifecycle ----------

  function startRun(newSeed) {
    runId++;
    seed = newSeed >>> 0;
    rng = makeRng(seed || 1);

    elapsed = 0;
    lastT = 0;
    observationActive = true;
    verdictDelivered = false;
    statusIdx = 0;
    statusTimer = 0;

    plaque.classList.remove('show');
    plaque.setAttribute('aria-hidden', 'true');
    plaqueTitle.textContent = '';
    plaqueFine.textContent = '';
    captionEl.classList.remove('show');
    apexEl.textContent = '';
    microEl.textContent = '';
    shareDiv.style.display = 'none';
    statusEl.style.display = 'block';
    statusEl.classList.remove('fading');
    statusEl.innerHTML = '<em>' + statusLines[0] + '</em>';
    meterFill.style.width = '0%';
    meterLabel.textContent = '60-second observation underway';

    buildWorld();
  }

  // ---------- share ----------

  window.share = function () {
    const title = document.title;
    const url = location.href;
    const text = (plaqueTitle.textContent || 'Tank Verdict') + ' — ' + (microEl.textContent || '');
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url + ' — ' + text)
        .then(() => alert('Link copied!'))
        .catch(() => alert(url));
    } else {
      alert(url);
    }
  };

  // ---------- error fallback ----------

  function failClosed() {
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<em>the glass is fogged. try refreshing.</em>';
  }

  // ---------- boot ----------

  try {
    if (!ctx) { failClosed(); return; }

    shakeBtn.addEventListener('click', () => {
      // reseed from current time + entropy
      const newSeed = hash(String(Date.now()) + ':' + Math.floor(performance.now() * 1000));
      startRun(newSeed);
    });

    window.addEventListener('resize', () => {
      // Re-fit canvas resolution; keep simulation state.
      // We rebuild driftwood / world dimensions only on a fresh run, so
      // for now just adjust the backing store and keep going.
      const oldW = W, oldH = H;
      fitCanvas();
      const sx = W / oldW, sy = H / oldH;
      if (driftwood) {
        driftwood.x *= sx; driftwood.y *= sy;
        driftwood.w *= sx; driftwood.h *= sy;
        driftwood.hide.x *= sx; driftwood.hide.y *= sy;
        driftwood.hide.w *= sx; driftwood.hide.h *= sy;
      }
      for (const f of fish) { f.x *= sx; f.y *= sy; }
      for (const fl of flakes) { fl.x *= sx; fl.y *= sy; }
      for (const a of algae) { a.x *= sx; a.y *= sy; }
      for (const d of dust) { d.x *= sx; d.y *= sy; }
    });

    // Initial seed: current Date.now()
    startRun(hash(String(Date.now())));
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    failClosed();
  }
})();
