// Rhythm Tap — Neon Arcade rhythm game
// Web Audio API procedural beat + canvas tile fall + lane tap scoring

(function () {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────────────────────

  const LANE_COLORS     = ['#00fff7', '#ff00cc', '#ffee00', '#00ff88']; // cyan, magenta, yellow, green
  const LANE_KEYS       = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  const HIT_ZONE_Y_FRAC = 0.82;   // fraction of canvas height
  const HIT_ZONE_H      = 6;      // px — the glowing bar
  const TILE_H          = 52;
  const PERFECT_WINDOW  = 15;
  const GOOD_WINDOW     = 30;
  const MAX_MISSES      = 10;
  const GAME_DURATION   = 60;     // seconds
  const BPM_START       = 120;
  const BPM_STEP        = 10;
  const BPM_INTERVAL    = 15;     // seconds between BPM bumps

  // Beat pattern: for each beat in a 4/4 bar, which lanes spawn tiles?
  // 1 = spawn, 0 = skip. Rows = beat index (0-3), columns = lane (0-3)
  const BEAT_PATTERN = [
    [1, 0, 0, 1],  // beat 1 (kick)
    [0, 1, 1, 0],  // beat 2
    [1, 0, 1, 0],  // beat 3 (kick)
    [0, 1, 0, 1],  // beat 4
  ];

  // ── STATE ────────────────────────────────────────────────────────────────────

  let canvas, ctx;
  let audioCtx = null;
  let animId   = null;

  let tiles      = [];
  let score      = 0;
  let combo      = 0;
  let bestCombo  = 0;
  let misses     = 0;
  let totalNotes = 0;   // notes that crossed the deadline
  let hitNotes   = 0;   // notes hit (perfect or good)
  let gameRunning = false;
  let startTime  = 0;
  let lastBpmBump = 0;
  let currentBpm = BPM_START;
  let beatIndex  = 0;   // current beat within 4/4 pattern
  let nextBeatTime = 0; // AudioContext time for next beat
  let highScore  = parseInt(localStorage.getItem('rhythmTap_hs') || '0', 10);
  let scheduledBeats = []; // { audioTime, beatIdx }

  // ── UTILITY ──────────────────────────────────────────────────────────────────

  function beatInterval(bpm) { return 60 / bpm; }

  function getComboMultiplier(c) {
    if (c >= 20) return 5;
    if (c >= 10) return 3;
    if (c >= 5)  return 2;
    return 1;
  }

  function calcGrade(acc) {
    if (acc >= 90) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 55) return 'B';
    return 'C';
  }

  function tileSpeed(bpm) {
    // pixels/second — tiles should travel canvas height in ~1.5 beats
    return (canvas.height / (1.5 * beatInterval(bpm)));
  }

  // ── CANVAS SETUP ─────────────────────────────────────────────────────────────

  function resizeCanvas() {
    const gameScreen = document.getElementById('game-screen');
    const hud        = document.getElementById('hud');
    const maxW       = Math.min(gameScreen.clientWidth, 480);
    const maxH       = gameScreen.clientHeight - hud.offsetHeight;
    canvas.width     = maxW;
    canvas.height    = maxH;
  }

  // ── AUDIO ────────────────────────────────────────────────────────────────────

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playKick(when) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(80, when);
    osc.frequency.exponentialRampToValueAtTime(30, when + 0.08);
    gain.gain.setValueAtTime(1.2, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    osc.start(when);
    osc.stop(when + 0.14);
  }

  function playHihat(when, open) {
    const bufSize = audioCtx.sampleRate * 0.05;
    const buffer  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain   = audioCtx.createGain();
    src.buffer   = buffer;
    filter.type  = 'highpass';
    filter.frequency.value = 7000;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(open ? 0.4 : 0.25, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + (open ? 0.06 : 0.04));
    src.start(when);
    src.stop(when + 0.07);
  }

  function playSnare(when) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(200, when);
    gain.gain.setValueAtTime(0.6, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.09);
    osc.start(when);
    osc.stop(when + 0.1);

    // noise layer
    const nb   = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
    const nd   = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns   = audioCtx.createBufferSource();
    const ng   = audioCtx.createGain();
    ns.buffer  = nb;
    ns.connect(ng);
    ng.connect(audioCtx.destination);
    ng.gain.setValueAtTime(0.35, when);
    ng.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    ns.start(when);
    ns.stop(when + 0.11);
  }

  function scheduleBeats(lookahead) {
    // lookahead in seconds — schedule beats up to this far in the future
    while (nextBeatTime < audioCtx.currentTime + lookahead) {
      const bi = beatIndex % 4;
      // Drum sounds
      if (bi === 0 || bi === 2) playKick(nextBeatTime);
      if (bi === 1 || bi === 3) playSnare(nextBeatTime);
      playHihat(nextBeatTime, bi % 2 === 0);

      // Record beat for tile spawning
      scheduledBeats.push({ audioTime: nextBeatTime, beatIdx: bi });

      nextBeatTime += beatInterval(currentBpm);
      beatIndex++;
    }
  }

  // ── TILE MANAGEMENT ──────────────────────────────────────────────────────────

  function spawnTilesForBeat(bi) {
    const pattern = BEAT_PATTERN[bi];
    const hitZoneY = canvas.height * HIT_ZONE_Y_FRAC;
    // We want tiles to arrive at hitZoneY exactly when the beat fires.
    // startY = hitZoneY - distance_to_travel = -(TILE_H + some top buffer)
    // We spawn them 1 beat early, so they fall (tileSpeed * beatInterval) pixels per beat.
    const speed = tileSpeed(currentBpm);
    const travelTime = beatInterval(currentBpm); // 1 beat = exactly 1 beat interval
    const startY = hitZoneY - speed * travelTime;

    pattern.forEach((active, lane) => {
      if (!active) return;
      // Slight per-lane variation — add beat subdivisions
      // (use beatInterval * 0.5 offset for off-beat lanes on beat 1/3)
      tiles.push({
        lane,
        x: 0,        // computed in draw
        y: startY,
        w: 0,        // computed in draw
        h: TILE_H,
        speed,
        alive: true,
        judged: false,
        hitEffect: 0,  // 0=none, 1=perfect, 2=good
        color: LANE_COLORS[lane],
      });
    });
  }

  function updateTiles(dt) {
    const hitZoneY = canvas.height * HIT_ZONE_Y_FRAC;
    const deadline = hitZoneY + TILE_H + 20;

    tiles.forEach(tile => {
      if (!tile.alive) return;
      tile.y += tile.speed * dt;
      tile.speed = tileSpeed(currentBpm); // live BPM tracking

      // Auto-miss: tile passed deadline without being judged
      if (!tile.judged && tile.y > deadline) {
        tile.judged = true;
        tile.alive  = false;
        totalNotes++;
        misses++;
        combo = 0;
        spawnHitLabel('MISS', '#ff4444', tile.lane);
        updateHud();
      }
    });

    // Remove dead tiles that are fully off screen
    tiles = tiles.filter(t => t.alive || t.y <= deadline + 60);
  }

  // ── HIT DETECTION ────────────────────────────────────────────────────────────

  function judgeLane(lane) {
    if (!gameRunning) return;
    const hitZoneY = canvas.height * HIT_ZONE_Y_FRAC;
    // Find closest tile in this lane that hasn't been judged
    let best = null;
    let bestDist = Infinity;

    tiles.forEach(tile => {
      if (tile.lane !== lane || tile.judged) return;
      const tileCenter = tile.y + tile.h / 2;
      const dist = Math.abs(tileCenter - hitZoneY);
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    });

    if (!best || bestDist > GOOD_WINDOW + 30) {
      // Early press or no tile nearby — count as miss
      misses++;
      combo = 0;
      spawnHitLabel('MISS', '#ff4444', lane);
      updateHud();
      return;
    }

    best.judged = true;
    best.alive  = false;
    totalNotes++;
    hitNotes++;

    const multiplier = getComboMultiplier(combo);
    if (bestDist <= PERFECT_WINDOW) {
      score += 3 * multiplier;
      combo++;
      best.hitEffect = 1;
      spawnHitLabel('PERFECT', LANE_COLORS[lane], lane);
    } else if (bestDist <= GOOD_WINDOW) {
      score += 1 * multiplier;
      combo++;
      best.hitEffect = 2;
      spawnHitLabel('GOOD', '#aaaaff', lane);
    } else {
      // Hit but too early/late
      misses++;
      combo = 0;
      spawnHitLabel('MISS', '#ff4444', lane);
    }

    if (combo > bestCombo) bestCombo = combo;
    updateHud();
  }

  // ── RENDERING ────────────────────────────────────────────────────────────────

  function drawFrame() {
    const W = canvas.width;
    const H = canvas.height;
    const laneW = W / 4;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Lane separators
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    for (let l = 1; l < 4; l++) {
      ctx.beginPath();
      ctx.moveTo(l * laneW, 0);
      ctx.lineTo(l * laneW, H);
      ctx.stroke();
    }

    // Lane labels at bottom
    const labelY = H - 14;
    const labels = ['D', 'F', 'J', 'K'];
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((lbl, i) => {
      ctx.fillStyle = LANE_COLORS[i] + '66';
      ctx.fillText(lbl, i * laneW + laneW / 2, labelY);
    });

    // Hit zone bar
    const hitZoneY = H * HIT_ZONE_Y_FRAC;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffffff44';
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(0, hitZoneY - HIT_ZONE_H / 2, W, HIT_ZONE_H);
    // Per-lane glow on hit zone
    LANE_COLORS.forEach((c, i) => {
      ctx.shadowColor = c;
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = c + '55';
      ctx.fillRect(i * laneW + 2, hitZoneY - HIT_ZONE_H / 2, laneW - 4, HIT_ZONE_H);
    });
    ctx.restore();

    // Tiles
    tiles.forEach(tile => {
      if (!tile.alive && tile.hitEffect === 0) return;
      const x = tile.lane * laneW + 4;
      const w = laneW - 8;
      const y = tile.y;
      const c = tile.color;

      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = c;
      // Tile body
      ctx.fillStyle = c + 'cc';
      ctx.fillRect(x, y, w, tile.h);
      // Top highlight stripe
      ctx.fillStyle = '#ffffff33';
      ctx.fillRect(x, y, w, 5);
      ctx.restore();
    });

    // Touch zone indicators at bottom
    const touchZoneH = 52;
    LANE_COLORS.forEach((c, i) => {
      ctx.save();
      ctx.shadowBlur  = 14;
      ctx.shadowColor = c;
      ctx.fillStyle   = c + '22';
      ctx.fillRect(i * laneW + 2, H - touchZoneH - 26, laneW - 4, touchZoneH);
      ctx.strokeStyle = c + '88';
      ctx.lineWidth   = 2;
      ctx.strokeRect(i * laneW + 2, H - touchZoneH - 26, laneW - 4, touchZoneH);
      ctx.restore();
    });
  }

  // ── HIT LABEL (DOM overlay) ───────────────────────────────────────────────────

  function spawnHitLabel(text, color, lane) {
    const el = document.createElement('div');
    el.className = 'hit-flash';
    el.textContent = text;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;

    const laneW = canvas.getBoundingClientRect().width / 4;
    const rect  = canvas.getBoundingClientRect();
    const cx    = rect.left + lane * laneW + laneW / 2;
    const cy    = rect.top  + canvas.height * HIT_ZONE_Y_FRAC - 30;
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // ── HUD UPDATE ────────────────────────────────────────────────────────────────

  function updateHud() {
    document.getElementById('hud-score').textContent  = score;
    document.getElementById('hud-combo').textContent  = '×' + combo;
    document.getElementById('hud-misses').textContent = misses + '/' + MAX_MISSES;
    document.getElementById('hud-bpm').textContent    = currentBpm;
  }

  // ── GAME LOOP ─────────────────────────────────────────────────────────────────

  let lastTs = 0;

  function gameLoop(ts) {
    if (!gameRunning) return;
    const dt = Math.min((ts - lastTs) / 1000, 0.1); // cap at 100ms to avoid spiral
    lastTs = ts;

    const elapsed = (ts - startTime) / 1000;

    // BPM ramp
    const bumpCount = Math.floor(elapsed / BPM_INTERVAL);
    currentBpm = BPM_START + bumpCount * BPM_STEP;
    document.getElementById('hud-bpm').textContent = currentBpm;

    // Beat scheduling (lookahead = 0.2s)
    scheduleBeats(0.2);

    // Process scheduled beats for tile spawning
    const now = audioCtx.currentTime;
    scheduledBeats = scheduledBeats.filter(b => {
      // Spawn when we're within one beat of that audio time
      if (b.audioTime <= now + beatInterval(currentBpm)) {
        spawnTilesForBeat(b.beatIdx);
        return false;
      }
      return true;
    });

    updateTiles(dt);
    drawFrame();

    // Check game-over conditions
    if (misses >= MAX_MISSES || elapsed >= GAME_DURATION) {
      endGame();
      return;
    }

    animId = requestAnimationFrame(gameLoop);
  }

  // ── GAME START / END ──────────────────────────────────────────────────────────

  function startGame() {
    ensureAudio();

    tiles        = [];
    score        = 0;
    combo        = 0;
    bestCombo    = 0;
    misses       = 0;
    totalNotes   = 0;
    hitNotes     = 0;
    currentBpm   = BPM_START;
    beatIndex    = 0;
    scheduledBeats = [];
    gameRunning  = true;

    updateHud();
    resizeCanvas();

    nextBeatTime = audioCtx.currentTime + 0.3; // slight delay before first beat
    lastTs = performance.now();
    startTime = performance.now();
    lastBpmBump = 0;

    animId = requestAnimationFrame(gameLoop);
  }

  function endGame() {
    gameRunning = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }

    const accuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 0;
    const grade    = calcGrade(accuracy);

    if (score > highScore) {
      highScore = score;
      localStorage.setItem('rhythmTap_hs', highScore);
    }

    const gradeEl = document.getElementById('grade-display');
    gradeEl.textContent = grade;
    gradeEl.className   = 'grade-display grade-' + grade;

    document.getElementById('result-accuracy').textContent = accuracy + '%';
    document.getElementById('result-combo').textContent    = bestCombo + 'x';
    document.getElementById('result-score').textContent    = score;
    document.getElementById('result-high').textContent     = highScore;

    const hsMsg = score >= highScore && score > 0 ? 'NEW HIGH SCORE!' : 'Best: ' + highScore;
    document.getElementById('result-micro').textContent =
      `Grade ${grade} — ${accuracy}% accuracy, ${bestCombo} best combo. ${hsMsg}`;

    showScreen('gameover-screen');
  }

  // ── SHARE ─────────────────────────────────────────────────────────────────────

  function share() {
    const accuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 0;
    const grade    = calcGrade(accuracy);
    const url      = window.location.href;
    const text     = `Rhythm Tap: ${accuracy}% accuracy, ${bestCombo}-combo, Grade ${grade} — beat my score! ${url}`;

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('share-btn');
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }).catch(() => {});
    }
  }

  // ── SCREEN MANAGEMENT ─────────────────────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function showLoadingThenStart() {
    showScreen('loading-screen');
    const bar = document.getElementById('loading-bar');
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = '100%';
      });
    });
    setTimeout(() => {
      showScreen('game-screen');
      resizeCanvas();
      startGame();
    }, 900);
  }

  // ── INPUT HANDLING ────────────────────────────────────────────────────────────

  function setupInput() {
    // Keyboard
    document.addEventListener('keydown', e => {
      if (!gameRunning) return;
      const lane = LANE_KEYS.indexOf(e.code);
      if (lane !== -1) { e.preventDefault(); judgeLane(lane); }
    });

    // Touch / click on canvas
    function handleCanvasInput(e) {
      if (!gameRunning) return;
      e.preventDefault();
      const rect  = canvas.getBoundingClientRect();
      const laneW = rect.width / 4;

      const points = e.changedTouches
        ? Array.from(e.changedTouches)
        : [e];

      points.forEach(pt => {
        const x    = (pt.clientX || pt.pageX) - rect.left;
        const lane = Math.floor(x / laneW);
        if (lane >= 0 && lane < 4) judgeLane(lane);
      });
    }

    canvas.addEventListener('touchstart', handleCanvasInput, { passive: false });
    canvas.addEventListener('mousedown',  handleCanvasInput);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────────

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');

    setupInput();

    document.getElementById('start-btn').addEventListener('click', () => {
      showLoadingThenStart();
    });

    document.getElementById('retry-btn').addEventListener('click', () => {
      showLoadingThenStart();
    });

    document.getElementById('share-btn').addEventListener('click', share);

    window.addEventListener('resize', () => {
      if (gameRunning) resizeCanvas();
    });

    // Initial canvas draw (blank)
    resizeCanvas();
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose share globally for potential inline calls
  window.share = share;

})();
