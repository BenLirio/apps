// Koi Coin Rally — 60s daily-seeded chibi koi pixel race.
// One mechanic: weave between three lanes to scoop coins, dodge lily pads & frogs.

(function () {
  'use strict';

  // ---------- Constants ----------
  const W = 360;
  const H = 640;
  const LANE_COUNT = 3;
  const LANE_W = W / LANE_COUNT;        // 120
  const LANE_X = [LANE_W * 0.5, LANE_W * 1.5, LANE_W * 2.5]; // lane centers
  const RACE_SECONDS = 60;
  const KOI_Y = H - 130;                 // koi sits near bottom
  const SCROLL_SPEED = 220;              // base pixels/sec — river flowing down
  const SPAWN_INTERVAL = 0.45;           // seconds between spawn rolls
  const FINISH_FLASH_SECONDS = 1.6;

  // ---------- Daily seed (UTC) ----------
  function todayUTC() {
    const d = new Date();
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32 — fast deterministic PRNG seeded from daily hash
  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SEED_STR = todayUTC();
  const SEED = hash32('koi-coin-rally:' + SEED_STR);

  // ---------- Pre-bake the daily course (deterministic, time-keyed) ----------
  // Course is a list of obstacles & coins keyed by spawn time t (in seconds).
  // Deterministic for everyone on this UTC day.
  function buildCourse() {
    const rng = makeRng(SEED);
    const events = [];
    let t = 0.8; // first event after a tiny grace period
    while (t < RACE_SECONDS) {
      // Each "row" picks one or two lanes for an obstacle, then scatters coins.
      const obstacleLanes = new Set();
      const obstacleCount = rng() < 0.55 ? 1 : (rng() < 0.7 ? 2 : 0);
      for (let i = 0; i < obstacleCount; i++) {
        obstacleLanes.add(Math.floor(rng() * LANE_COUNT));
      }
      // Avoid full-block: ensure at least one open lane.
      if (obstacleLanes.size >= LANE_COUNT) {
        // remove a random one
        const arr = Array.from(obstacleLanes);
        obstacleLanes.delete(arr[Math.floor(rng() * arr.length)]);
      }
      obstacleLanes.forEach((lane) => {
        const kind = rng() < 0.62 ? 'lily' : 'frog';
        events.push({ t, kind, lane });
      });
      // Coin patterns: a single coin in an open lane, sometimes a triplet.
      const openLanes = [0, 1, 2].filter((l) => !obstacleLanes.has(l));
      if (openLanes.length > 0) {
        const coinLane = openLanes[Math.floor(rng() * openLanes.length)];
        const triplet = rng() < 0.3;
        if (triplet) {
          for (let k = 0; k < 3; k++) {
            events.push({ t: t + k * 0.12, kind: 'coin', lane: coinLane });
          }
        } else {
          events.push({ t: t + 0.05, kind: 'coin', lane: coinLane });
        }
      }
      // pace
      t += SPAWN_INTERVAL + rng() * 0.25;
    }
    return events;
  }

  const COURSE = buildCourse();
  const TOTAL_COINS = COURSE.filter((e) => e.kind === 'coin').length;

  // ---------- Pixel art helpers ----------
  function drawPixelRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // 16x12 chibi koi sprite, drawn from a string grid.
  // Palette: . transparent, W white, R red-orange, K dark, P pink-blush, Y yellow eye glint
  const KOI_SPRITE = [
    '.....RRRRRR.....',
    '....RWWWWWR.RR..',
    '...RWWWWWWWRRRR.',
    '..RWWKWWWKWWWWRR',
    '..RWWWWWWWWWWWWR',
    '..RWWPPWWWWWWWR.',
    '...RWWWWWWWWRR..',
    '....RRWWWWRR....',
    '......RRRR......',
    '.......RR.......',
    '......R..R......',
    '.....RR..RR.....'
  ];
  const KOI_PALETTE = {
    '.': null,
    'W': '#fffafd',
    'R': '#ff5d8f',
    'K': '#3b1f3f',
    'P': '#ffd6e7',
    'Y': '#ffe066'
  };

  function drawKoi(ctx, cx, cy, scale, tilt) {
    const sprite = KOI_SPRITE;
    const sw = sprite[0].length;
    const sh = sprite.length;
    const px = scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    const ox = -Math.floor(sw / 2) * px;
    const oy = -Math.floor(sh / 2) * px;
    for (let y = 0; y < sh; y++) {
      const row = sprite[y];
      for (let x = 0; x < sw; x++) {
        const c = KOI_PALETTE[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * px, oy + y * px, px, px);
      }
    }
    ctx.restore();
  }

  // 12x10 lily pad
  function drawLily(ctx, cx, cy) {
    const px = 4;
    const sprite = [
      '...GGGGGGG..',
      '..GLLLLLLLG.',
      '.GLLLLLLLLLG',
      'GLLLDDDLLLLG',
      'GLLDDDDDLLLG',
      'GLLLDDDLLLLG',
      'GLLLLLLLLLLG',
      '.GLLLFFLLLG.',
      '..GLFFFFLG..',
      '...GGGGGG...'
    ];
    const palette = { '.': null, 'G': '#3a8f5a', 'L': '#7fc98f', 'D': '#2c6e44', 'F': '#fff0a0' };
    const sw = sprite[0].length;
    const sh = sprite.length;
    const ox = cx - (sw * px) / 2;
    const oy = cy - (sh * px) / 2;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = palette[sprite[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(ox + x * px), Math.round(oy + y * px), px, px);
      }
    }
  }

  // 10x10 cranky frog
  function drawFrog(ctx, cx, cy, frame) {
    const px = 5;
    const sprite = [
      '..GGGGGGGG',
      '.GWWGGGGWW',
      '.GBWGGGGBW',
      'GGGGGGGGGG',
      'GGgGGGGgGG',
      'GGGGRRGGGG',
      'GGGGGGGGGG',
      '.GGgggggG.',
      '..GGGGGG..',
      '...GG.GG..'
    ];
    const palette = {
      '.': null,
      'G': '#5cb85c',
      'g': '#3e8a3e',
      'W': '#fffafd',
      'B': '#1a1a1a',
      'R': '#c93a3a'
    };
    const sw = sprite[0].length;
    const sh = sprite.length;
    const wobble = (frame % 24 < 12) ? 0 : 2;
    const ox = cx - (sw * px) / 2;
    const oy = cy - (sh * px) / 2 + wobble;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = palette[sprite[y][x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(ox + x * px), Math.round(oy + y * px), px, px);
      }
    }
  }

  function drawCoin(ctx, cx, cy, t) {
    // simple shimmering coin: outer ring + inner shimmer that flips
    const phase = (t * 6) % (Math.PI * 2);
    const wScale = Math.abs(Math.cos(phase));
    const r = 14;
    const w = Math.max(4, r * 2 * (0.4 + 0.6 * wScale));
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(Math.round(cx - r), Math.round(cy - r), r * 2, r * 2);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - r + 2), Math.round(w), r * 2 - 4);
    ctx.fillStyle = '#fff5b8';
    ctx.fillRect(Math.round(cx - w / 2 + 2), Math.round(cy - r + 4), Math.max(2, Math.round(w * 0.35)), 4);
  }

  function drawSparkle(ctx, x, y, life) {
    const a = Math.max(0, Math.min(1, life));
    ctx.fillStyle = 'rgba(255, 245, 184,' + a.toFixed(2) + ')';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 4), 2, 8);
    ctx.fillRect(Math.round(x - 4), Math.round(y - 1), 8, 2);
  }

  function drawSplash(ctx, x, y, life) {
    const a = Math.max(0, Math.min(1, life));
    ctx.fillStyle = 'rgba(255, 180, 207,' + a.toFixed(2) + ')';
    const r = (1 - a) * 22 + 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke ? null : null;
    ctx.fill();
  }

  // ---------- License rules ----------
  // Deterministic mapping coins -> license title.
  function licenseFor(coins) {
    if (coins <= 0) return 'Disqualified Tadpole (no coins, but vibes)';
    if (coins < 12) return 'Koi Cadet Sumiko (' + coins + ' coins)';
    if (coins < 30) return 'Apprentice River-Sniffer (' + coins + ' coins)';
    if (coins < 50) return 'Reckless Sushi Express (' + coins + ' coins)';
    if (coins < 75) return 'Captain Bento of the Lily-Lane (' + coins + ' coins)';
    if (coins < 100) return 'Admiral Wasabi, Splashed in Glory (' + coins + ' coins)';
    if (coins < 120) return 'Shogun of the Three-Lane Stream (' + coins + ' coins)';
    return 'Lord Mochi of the Coursed Stream (' + coins + ' coins)';
  }

  // Loading-state copy / pre-game flavor for course hint.
  const COURSE_FLAVORS = [
    'frogs are extra grumpy this morning.',
    'lily pads have organized into clusters.',
    'someone scattered an obnoxious amount of coins.',
    'the river bends like a sleeping cat.',
    'three coin-rich shortcuts. one is a lie.',
    'today the frogs are practicing synchronized hopping.',
    'the river smells faintly of yuzu.',
    'a triplet of coins sits where a frog once was.'
  ];

  // ---------- Game state ----------
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const introEl = document.getElementById('intro');
  const courseHintEl = document.getElementById('course-hint');
  const startBtn = document.getElementById('start-btn');
  const hudEl = document.getElementById('hud');
  const coinCountEl = document.getElementById('coin-count');
  const timerEl = document.getElementById('timer');
  const endEl = document.getElementById('end');
  const licenseTitleEl = document.getElementById('license-title');
  const finalCoinsEl = document.getElementById('final-coins');
  const emojiGridEl = document.getElementById('emoji-grid');
  const replayBtn = document.getElementById('replay-btn');
  const fishPortraitEl = document.getElementById('fish-portrait');
  const touchZonesEl = document.getElementById('touch-zones');
  const zoneLeft = touchZonesEl.querySelector('.zone-left');
  const zoneRight = touchZonesEl.querySelector('.zone-right');

  // Pre-game flavor text — stable per day.
  (function setFlavor() {
    const flavor = COURSE_FLAVORS[hash32('flavor:' + SEED_STR) % COURSE_FLAVORS.length];
    courseHintEl.textContent = SEED_STR + ' &middot; ' + flavor;
    // Avoid HTML-injection from the &middot; — set as text and let it pass:
    courseHintEl.textContent = SEED_STR + ' · ' + flavor;
  })();

  let game;

  function newGame() {
    return {
      running: false,
      ended: false,
      startedAt: 0,
      elapsed: 0,
      lane: 1,                     // start in middle
      koiX: LANE_X[1],
      targetX: LANE_X[1],
      tilt: 0,
      coins: 0,
      coinsHit: [],                // array of booleans length TOTAL_COINS, in course order
      coinIndex: 0,                // next coin index in course order
      active: [],                  // active sprites scrolling on screen
      nextEvent: 0,                // index into COURSE
      streamOffset: 0,             // wave/offset for river animation
      sparkles: [],
      splashes: [],
      shake: 0,
      finishedAt: null
    };
  }

  function startGame() {
    game = newGame();
    introEl.classList.add('hidden');
    endEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    touchZonesEl.classList.remove('hidden');
    flashTouchHints();
    game.running = true;
    game.startedAt = performance.now();
    requestAnimationFrame(loop);
  }

  function flashTouchHints() {
    zoneLeft.classList.add('flash');
    zoneRight.classList.add('flash');
    setTimeout(() => {
      zoneLeft.classList.remove('flash');
      zoneRight.classList.remove('flash');
    }, 1200);
  }

  function endGame() {
    if (game.ended) return;
    game.ended = true;
    game.running = false;
    hudEl.classList.add('hidden');
    touchZonesEl.classList.add('hidden');

    finalCoinsEl.textContent = String(game.coins);
    licenseTitleEl.textContent = licenseFor(game.coins);
    emojiGridEl.textContent = buildEmojiGrid(game.coinsHit);

    // Vary the portrait slightly by score band.
    fishPortraitEl.textContent = game.coins >= 100 ? '\u{1F420}✨' : '\u{1F420}';

    endEl.classList.remove('hidden');
  }

  function buildEmojiGrid(hits) {
    // hits: array of true/false in course order (length TOTAL_COINS).
    // Build a roughly square grid, capped width 10.
    const cols = 10;
    const lines = [];
    let line = '';
    for (let i = 0; i < hits.length; i++) {
      line += hits[i] ? '\u{1FA99}' : '⚫'; // coin or black-circle (missed)
      if ((i + 1) % cols === 0) {
        lines.push(line);
        line = '';
      }
    }
    if (line.length > 0) lines.push(line);
    if (lines.length === 0) lines.push('(no coins on this river — try again)');
    // Header line
    return SEED_STR + ' · ' + game.coins + '/' + hits.length + ' \u{1FA99}\n' + lines.join('\n');
  }

  // ---------- Input ----------
  function moveLeft() {
    if (!game || !game.running) return;
    if (game.lane > 0) {
      game.lane--;
      game.targetX = LANE_X[game.lane];
    }
  }
  function moveRight() {
    if (!game || !game.running) return;
    if (game.lane < LANE_COUNT - 1) {
      game.lane++;
      game.targetX = LANE_X[game.lane];
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      moveLeft();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      moveRight();
      e.preventDefault();
    } else if ((e.key === ' ' || e.key === 'Enter') && game && game.ended) {
      startGame();
      e.preventDefault();
    } else if ((e.key === ' ' || e.key === 'Enter') && (!game || !game.running)) {
      startGame();
      e.preventDefault();
    }
  });

  // Tap left half / right half of the game-frame
  function tapHandler(ev) {
    if (!game || !game.running) return;
    const rect = canvas.getBoundingClientRect();
    let cx;
    if (ev.touches && ev.touches.length) {
      cx = ev.touches[0].clientX;
    } else if (ev.changedTouches && ev.changedTouches.length) {
      cx = ev.changedTouches[0].clientX;
    } else {
      cx = ev.clientX;
    }
    const local = cx - rect.left;
    if (local < rect.width / 2) {
      moveLeft();
      zoneLeft.classList.add('flash');
      setTimeout(() => zoneLeft.classList.remove('flash'), 120);
    } else {
      moveRight();
      zoneRight.classList.add('flash');
      setTimeout(() => zoneRight.classList.remove('flash'), 120);
    }
    ev.preventDefault();
  }

  canvas.addEventListener('touchstart', tapHandler, { passive: false });
  canvas.addEventListener('mousedown', tapHandler);

  startBtn.addEventListener('click', startGame);
  replayBtn.addEventListener('click', startGame);

  // ---------- Game loop ----------
  let lastT = 0;

  function loop(now) {
    if (!game || !game.running) return;
    if (!lastT) lastT = now;
    const dt = Math.min(0.05, (now - lastT) / 1000); // clamp big jumps
    lastT = now;

    update(dt);
    render(dt);

    if (game.running) {
      requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    game.elapsed += dt;
    const remaining = Math.max(0, RACE_SECONDS - game.elapsed);
    timerEl.textContent = remaining.toFixed(1);

    // Smooth lane glide
    const dx = game.targetX - game.koiX;
    const ease = 16 * dt;
    game.koiX += dx * Math.min(1, ease);
    game.tilt = Math.max(-0.35, Math.min(0.35, dx * 0.012));

    // River scroll offset (visual only)
    game.streamOffset = (game.streamOffset + SCROLL_SPEED * dt) % 32;

    // Spawn from course up to current elapsed time
    while (game.nextEvent < COURSE.length && COURSE[game.nextEvent].t <= game.elapsed) {
      const ev = COURSE[game.nextEvent++];
      const sprite = {
        kind: ev.kind,
        lane: ev.lane,
        x: LANE_X[ev.lane],
        y: -40,                  // spawn just above screen
        vy: SCROLL_SPEED,
        consumed: false,
        bornAt: game.elapsed,
        coinIndex: ev.kind === 'coin' ? game.coinIndex : -1,
        frame: 0
      };
      if (ev.kind === 'coin') {
        // also pre-fill the coinsHit slot with false
        game.coinsHit.push(false);
        game.coinIndex++;
      }
      game.active.push(sprite);
    }

    // Update active sprites, run collisions
    for (const s of game.active) {
      s.y += s.vy * dt;
      s.frame = (s.frame || 0) + 1;
      if (s.consumed) continue;

      const dxK = Math.abs(s.x - game.koiX);
      const dyK = Math.abs(s.y - KOI_Y);
      // hit boxes
      if (s.kind === 'coin') {
        if (dxK < 28 && dyK < 22) {
          s.consumed = true;
          game.coins++;
          if (s.coinIndex >= 0) game.coinsHit[s.coinIndex] = true;
          coinCountEl.textContent = String(game.coins);
          // sparkle
          for (let i = 0; i < 5; i++) {
            game.sparkles.push({ x: s.x + (Math.random() - 0.5) * 16, y: s.y + (Math.random() - 0.5) * 8, life: 1 });
          }
        }
      } else if (s.kind === 'lily' || s.kind === 'frog') {
        if (dxK < 32 && dyK < 26) {
          s.consumed = true;
          // coin penalty for hitting an obstacle (small, kind to player)
          const penalty = s.kind === 'frog' ? 4 : 2;
          game.coins = Math.max(0, game.coins - penalty);
          coinCountEl.textContent = String(game.coins);
          game.shake = 0.4;
          // splash
          game.splashes.push({ x: game.koiX, y: KOI_Y - 4, life: 1 });
        }
      }
    }

    // GC offscreen
    game.active = game.active.filter((s) => s.y < H + 60 && !(s.consumed && (s.kind === 'coin')));
    // also drop consumed obstacles after a tick
    game.active = game.active.filter((s) => !(s.consumed && s.kind !== 'coin' && (game.elapsed - s.bornAt) > 0.4));

    // Sparkles & splashes
    for (const sp of game.sparkles) sp.life -= dt * 2.4;
    for (const sp of game.splashes) sp.life -= dt * 1.6;
    game.sparkles = game.sparkles.filter((s) => s.life > 0);
    game.splashes = game.splashes.filter((s) => s.life > 0);

    if (game.shake > 0) game.shake -= dt;

    // Time up?
    if (game.elapsed >= RACE_SECONDS) {
      game.finishedAt = game.elapsed;
      // brief finish-line flash before showing end card
      setTimeout(endGame, 350);
      game.running = false;
    }
  }

  function render(dt) {
    // Camera shake
    let sx = 0, sy = 0;
    if (game.shake > 0) {
      sx = (Math.random() - 0.5) * 6;
      sy = (Math.random() - 0.5) * 6;
    }

    // Clear river background
    ctx.save();
    ctx.translate(sx, sy);

    // Base water
    ctx.fillStyle = '#9ddfd0';
    ctx.fillRect(0, 0, W, H);

    // Banks (left + right) — pastel sand
    drawBanks();

    // Lane rails (subtle dashed lines between lanes)
    drawLaneRails();

    // Ripples / scrolling stream waves
    drawRipples();

    // Sprites
    for (const s of game.active) {
      if (s.consumed) continue;
      if (s.kind === 'coin') {
        drawCoin(ctx, s.x, s.y, game.elapsed + s.bornAt);
      } else if (s.kind === 'lily') {
        drawLily(ctx, s.x, s.y);
      } else if (s.kind === 'frog') {
        drawFrog(ctx, s.x, s.y, s.frame);
      }
    }

    // Splashes
    for (const sp of game.splashes) {
      drawSplash(ctx, sp.x, sp.y, sp.life);
    }

    // Koi
    drawKoi(ctx, game.koiX, KOI_Y + Math.sin(game.elapsed * 4) * 2, 4, game.tilt);

    // Sparkles on top
    for (const sp of game.sparkles) {
      drawSparkle(ctx, sp.x, sp.y, sp.life);
    }

    // Finish-line gate when nearly done
    const remaining = RACE_SECONDS - game.elapsed;
    if (remaining < 4) {
      drawFinishGate(remaining);
    }

    ctx.restore();
  }

  function drawBanks() {
    // Soft sandy banks, a few px wide; sakura petals scrolling.
    const bankW = 8;
    ctx.fillStyle = '#f6d8b0';
    ctx.fillRect(0, 0, bankW, H);
    ctx.fillRect(W - bankW, 0, bankW, H);
    ctx.fillStyle = '#e7b98a';
    ctx.fillRect(0, 0, bankW, H);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 6; i++) {
      const py = (game.streamOffset * 1.2 + i * 110) % (H + 40) - 20;
      ctx.fillStyle = '#ffb3cf';
      ctx.fillRect(2, Math.round(py), 4, 4);
      ctx.fillRect(W - 6, Math.round(py + 50), 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawLaneRails() {
    ctx.fillStyle = 'rgba(255, 250, 253, 0.55)';
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = LANE_W * i;
      // dashed scrolling
      const dashLen = 14;
      const gap = 14;
      const offset = (game.streamOffset) % (dashLen + gap);
      for (let y = -dashLen + offset; y < H; y += dashLen + gap) {
        ctx.fillRect(Math.round(x - 1), Math.round(y), 2, dashLen);
      }
    }
  }

  function drawRipples() {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#bdebde';
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      const yy = ((r * 70) + game.streamOffset) % (H + 70) - 30;
      // Shifted rows for organic feel
      const baseX = (r % 2 === 0) ? 12 : 60;
      for (let x = baseX; x < W - 12; x += 100) {
        ctx.fillRect(Math.round(x), Math.round(yy), 28, 3);
        ctx.fillRect(Math.round(x + 8), Math.round(yy + 4), 14, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFinishGate(remaining) {
    // Approaching gate from top, settles near koi at remaining=0
    const t = 1 - Math.max(0, remaining) / 4;
    const gateY = -50 + t * (KOI_Y + 30);
    // Two posts + checker top
    ctx.fillStyle = '#ff5d8f';
    ctx.fillRect(8, Math.round(gateY), 14, 70);
    ctx.fillRect(W - 22, Math.round(gateY), 14, 70);
    // checker bar
    const barY = Math.round(gateY);
    const barH = 16;
    for (let x = 8; x < W - 8; x += 16) {
      ctx.fillStyle = ((x / 16) % 2 < 1) ? '#fffafd' : '#4a2c4f';
      ctx.fillRect(x, barY, 16, barH);
    }
    // banner
    ctx.fillStyle = '#4a2c4f';
    ctx.fillRect(W / 2 - 64, barY - 22, 128, 20);
    ctx.fillStyle = '#fff5b8';
    ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', W / 2, barY - 12);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- Initial paint of intro background under the overlay ----------
  function paintIdleScene() {
    ctx.fillStyle = '#9ddfd0';
    ctx.fillRect(0, 0, W, H);
    // Banks
    ctx.fillStyle = '#e7b98a';
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);
    // Calm ripples
    ctx.fillStyle = '#bdebde';
    for (let y = 30; y < H; y += 60) {
      ctx.fillRect(40, y, 36, 3);
      ctx.fillRect(160, y + 20, 24, 2);
      ctx.fillRect(240, y + 40, 30, 3);
    }
    // A demo koi
    drawKoi(ctx, W / 2, H / 2 + 40, 5, -0.1);
  }
  paintIdleScene();

  // ---------- Share helper ----------
  // Custom share that includes the license + emoji grid as the share text.
  window.share = function () {
    const text = 'Koi Coin Rally · ' + SEED_STR + '\n' +
      licenseFor(game.coins) + '\n' +
      buildEmojiGrid(game.coinsHit) + '\n' +
      location.href;
    if (navigator.share) {
      navigator.share({ title: 'Koi Coin Rally', text: text, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('koi license copied to clipboard');
      }).catch(() => {
        prompt('copy your license:', text);
      });
    } else {
      prompt('copy your license:', text);
    }
  };

  // Prevent the page from scrolling when tapping the canvas on mobile
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
})();
