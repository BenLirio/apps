// loop.js — pseudo-3D nebula corridor.
//
// Render model: each entity has a depth z that decreases toward 0 as it drifts
// at the camera. Project (x, y, z) to screen with x' = cx + x * (FOCAL/z),
// y' = cy + y * (FOCAL/z), size = (FOCAL/z) * radius3d. Cheap, fast, and
// reads as 3D without WebGL.
//
// Run terminates after RUN_SECONDS or on a hit.
//
// Stats accumulated for the Flight Recorder card:
//   - maxG          : peak G-load (input rate-of-change derivative)
//   - closestPass   : smallest |Δr| at z<near for any debris this run, in "metres"
//   - sectorIndex   : how many corridor segments the ship traversed
//   - beacons       : collected / spawned
//   - smoothness    : variance of input across the run (small = smoother)
//   - nearMisses    : count of debris that passed within 1.5 ship-radii

export const RUN_SECONDS = 60;
const FOCAL = 360;        // perspective focal length in CSS px
const FAR_Z = 18;
const NEAR_Z = 0.8;
const SHIP_R3D = 0.9;     // ship "radius" in world units
const DEBRIS_R3D = 1.1;
const BEACON_R3D = 1.2;
const CORRIDOR_R = 4.4;   // half-width of the corridor in world units

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');

  const game = {
    running: false,
    paused: false,
    t: 0,
    dt: 0,
    lastTs: 0,
    width: 0,
    height: 0,
    dpr: 1,
    debris: [],
    beacons: [],
    stars: [],            // distant nebula points
    rings: [],            // corridor segment rings
    ship: { x: 0, y: 0, vx: 0, vy: 0 },
    inputX: 0,
    inputY: 0,
    prevInputX: 0,
    prevInputY: 0,
    spawnTimer: 0,
    nextBeaconAt: 1.5,
    nextRingAt: 0,
    sectorIndex: 0,
    stats: makeStats(),
    runSeed: 0,
    onEnd: null,
    flashTime: 0,         // hit flash
    chrome: 0,            // small bloom timer for beacon pickup
  };

  function makeStats() {
    return {
      maxG: 0,
      closestPass: Infinity,
      sectorIndex: 0,
      beaconsTotal: 0,
      beaconsHit: 0,
      nearMisses: 0,
      grazes: 0,           // debris within 2.5 R
      inputXSum: 0,
      inputXSumSq: 0,
      inputYSum: 0,
      inputYSumSq: 0,
      samples: 0,
      hit: false,
      timeSurvived: 0,
    };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    game.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width  = Math.round(r.width  * game.dpr);
    canvas.height = Math.round(r.height * game.dpr);
    game.width  = r.width;
    game.height = r.height;
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  }

  // pre-load a fixed star/nebula layer so the parallax has texture
  function makeStars() {
    const out = [];
    // seeded so stars are stable per page-load
    let s = 1234567;
    const r = () => {
      s = (s * 1103515245 + 12345) | 0;
      return ((s >>> 0) % 1000000) / 1000000;
    };
    for (let i = 0; i < 90; i++) {
      out.push({
        x: (r() - 0.5) * 1.6,
        y: (r() - 0.5) * 1.6,
        z: 4 + r() * 14,
        b: 0.2 + r() * 0.6,
      });
    }
    return out;
  }

  function start(seedSeconds) {
    game.runSeed = (seedSeconds | 0) || Math.floor(performance.now());
    game.debris.length = 0;
    game.beacons.length = 0;
    game.stars = makeStars();
    game.rings.length = 0;
    game.ship = { x: 0, y: 0, vx: 0, vy: 0 };
    game.inputX = game.inputY = 0;
    game.prevInputX = game.prevInputY = 0;
    game.spawnTimer = 0;
    game.nextBeaconAt = 1.5;
    game.nextRingAt = 0;
    game.sectorIndex = 0;
    game.stats = makeStats();
    game.t = 0;
    game.lastTs = performance.now();
    game.running = true;
    game.flashTime = 0;
    game.chrome = 0;
    requestAnimationFrame(frame);
  }

  function stop(reason) {
    game.running = false;
    if (reason === 'hit') {
      game.stats.hit = true;
      game.flashTime = 0.8;
    }
    game.stats.timeSurvived = game.t;
    game.stats.sectorIndex = game.sectorIndex;
    if (game.onEnd) game.onEnd(game.stats);
  }

  function frame(ts) {
    if (!game.running) {
      // keep rendering the freeze frame for the hit-flash decay
      if (game.flashTime > 0) {
        const dt = Math.min(0.05, (ts - game.lastTs) / 1000);
        game.flashTime = Math.max(0, game.flashTime - dt);
        game.lastTs = ts;
        render();
        if (game.flashTime > 0) requestAnimationFrame(frame);
      }
      return;
    }
    const dtRaw = (ts - game.lastTs) / 1000;
    game.lastTs = ts;
    const dt = Math.min(0.05, dtRaw);    // cap so a tab-pause doesn't snowball
    game.dt = dt;
    game.t += dt;

    update(dt);
    render();

    if (game.t >= RUN_SECONDS) {
      stop('timeup');
      return;
    }
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // --- ship motion: target position from input, with light velocity smoothing
    const targetX = game.inputX * CORRIDOR_R * 0.85;
    const targetY = game.inputY * CORRIDOR_R * 0.85;
    const followK = 1 - Math.exp(-dt / 0.10);
    const newX = game.ship.x + (targetX - game.ship.x) * followK;
    const newY = game.ship.y + (targetY - game.ship.y) * followK;
    game.ship.vx = (newX - game.ship.x) / dt;
    game.ship.vy = (newY - game.ship.y) / dt;
    game.ship.x = newX;
    game.ship.y = newY;

    // --- G-load: derivative of input (rate of change of commanded input)
    const ddx = (game.inputX - game.prevInputX) / dt;
    const ddy = (game.inputY - game.prevInputY) / dt;
    const g = Math.hypot(ddx, ddy) * 0.55; // calibrate to a friendly 0–6 G range
    if (g > game.stats.maxG) game.stats.maxG = g;
    game.prevInputX = game.inputX;
    game.prevInputY = game.inputY;

    // --- input variance (smoothness)
    game.stats.samples++;
    game.stats.inputXSum   += game.inputX;
    game.stats.inputXSumSq += game.inputX * game.inputX;
    game.stats.inputYSum   += game.inputY;
    game.stats.inputYSumSq += game.inputY * game.inputY;

    // --- spawn debris (more frequent over time)
    game.spawnTimer -= dt;
    const spawnRate = 0.55 - Math.min(0.30, game.t * 0.006); // every ~0.55s → ~0.25s
    while (game.spawnTimer <= 0) {
      spawnDebris();
      game.spawnTimer += spawnRate;
    }

    // --- beacons every ~5s
    if (game.t >= game.nextBeaconAt) {
      spawnBeacon();
      game.nextBeaconAt += 5 + Math.random() * 2;
    }

    // --- corridor rings every 0.8s of travel — these are the sector markers
    if (game.t >= game.nextRingAt) {
      game.rings.push({ z: FAR_Z, idx: game.sectorIndex + 1 });
      game.nextRingAt += 0.85;
    }

    // --- advance entities; kill those that pass behind camera
    const speed = 12.5 + Math.min(7, game.t * 0.18);    // world units/sec along +z toward camera
    for (const d of game.debris) d.z -= speed * dt;
    for (const b of game.beacons) b.z -= speed * dt;
    for (const r of game.rings)   r.z -= speed * dt;
    for (const s of game.stars)   s.z -= speed * 0.05 * dt; // very slow parallax
    // pull stars back so the field feels infinite
    for (const s of game.stars) if (s.z < 1) s.z += 18;

    // collide / collect
    const sx = game.ship.x, sy = game.ship.y;
    for (let i = game.debris.length - 1; i >= 0; i--) {
      const d = game.debris[i];
      if (d.z < NEAR_Z) {
        // measure closest approach as we cross the near plane
        const dx = d.x - sx, dy = d.y - sy;
        const r2 = Math.hypot(dx, dy);
        const passDist = Math.max(0, r2 - SHIP_R3D - DEBRIS_R3D);
        if (passDist < game.stats.closestPass) game.stats.closestPass = passDist;
        if (r2 < SHIP_R3D + DEBRIS_R3D) {
          // hit
          stop('hit');
          return;
        }
        if (r2 < SHIP_R3D + DEBRIS_R3D + 1.2) game.stats.nearMisses++;
        if (r2 < SHIP_R3D + DEBRIS_R3D + 2.4) game.stats.grazes++;
        game.debris.splice(i, 1);
      } else {
        // tumble
        d.rot += d.vrot * dt;
      }
    }
    for (let i = game.beacons.length - 1; i >= 0; i--) {
      const b = game.beacons[i];
      if (b.z < NEAR_Z + 0.3) {
        const r2 = Math.hypot(b.x - sx, b.y - sy);
        if (r2 < SHIP_R3D + BEACON_R3D) {
          game.stats.beaconsHit++;
          game.chrome = 0.6;
        }
        // count as encountered either way
        game.beacons.splice(i, 1);
      }
    }
    for (let i = game.rings.length - 1; i >= 0; i--) {
      const r = game.rings[i];
      if (r.z < NEAR_Z) {
        game.sectorIndex = r.idx;
        game.rings.splice(i, 1);
      }
    }

    if (game.flashTime > 0) game.flashTime = Math.max(0, game.flashTime - dt);
    if (game.chrome > 0)    game.chrome    = Math.max(0, game.chrome    - dt);
  }

  function spawnDebris() {
    // weighted toward the sides as t increases
    const ang = Math.random() * Math.PI * 2;
    const r = (0.4 + Math.random() * 0.85) * CORRIDOR_R;
    game.debris.push({
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      z: FAR_Z + Math.random() * 2,
      r3d: DEBRIS_R3D * (0.7 + Math.random() * 0.7),
      kind: Math.random() < 0.5 ? 'rock' : 'shard',
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.2,
      hue: 130 + Math.random() * 60,
    });
  }
  function spawnBeacon() {
    const ang = Math.random() * Math.PI * 2;
    const r = (0.2 + Math.random() * 0.9) * CORRIDOR_R;
    game.beacons.push({
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      z: FAR_Z + 1,
      r3d: BEACON_R3D,
    });
    game.stats.beaconsTotal++;
  }

  // --- render -----------------------------------------------------------
  function render() {
    const W = game.width, H = game.height;
    if (W === 0 || H === 0) return;

    // background — phosphor void with a faint vignette
    ctx.fillStyle = '#02060a';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;

    // distant stars (cheap)
    for (const s of game.stars) {
      const k = FOCAL / s.z;
      const px = cx + s.x * k * 220;
      const py = cy + s.y * k * 220;
      const sz = Math.max(0.6, k * 0.04);
      const alpha = Math.max(0.05, Math.min(0.85, s.b * (1 - s.z / 18)));
      ctx.fillStyle = `rgba(116,255,182,${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, sz, sz);
    }

    // corridor: faint perspective grid lines + sector rings
    drawCorridor(cx, cy, W, H);

    // entities, draw far-to-near
    const sorted = [
      ...game.beacons.map(o => ({ ...o, _kind: 'beacon' })),
      ...game.debris.map(o => ({ ...o, _kind: 'debris' })),
    ].sort((a, b) => b.z - a.z);

    for (const o of sorted) {
      const k = FOCAL / o.z;
      const sx = cx + o.x * k;
      const sy = cy + o.y * k;
      const r  = o.r3d * k * 0.18; // tuned so far things look small
      if (o._kind === 'beacon') {
        drawBeacon(sx, sy, Math.max(2, r), o.z);
      } else {
        drawDebris(sx, sy, Math.max(2, r), o.rot, o.kind);
      }
    }

    // ship reticle (always at centre — the world moves around it)
    drawShip(cx + game.ship.x * (FOCAL / NEAR_Z) * 0.18,
             cy + game.ship.y * (FOCAL / NEAR_Z) * 0.18);

    // hit flash
    if (game.flashTime > 0) {
      const a = Math.min(0.7, game.flashTime);
      ctx.fillStyle = `rgba(255,90,69,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.chrome > 0) {
      const a = Math.min(0.5, game.chrome * 0.7);
      ctx.fillStyle = `rgba(116,255,182,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // crosshair guide overlay (subtle)
    ctx.strokeStyle = 'rgba(116,255,182,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy); ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy + 18);
    ctx.stroke();
  }

  function drawCorridor(cx, cy, W, H) {
    // 8 perspective lines from edges toward vanishing point
    ctx.strokeStyle = 'rgba(47,203,132,0.25)';
    ctx.lineWidth = 1;
    const N = 8;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ex = t * W, ey = t * H;
      ctx.moveTo(ex, 0); ctx.lineTo(cx, cy);
      ctx.moveTo(ex, H); ctx.lineTo(cx, cy);
      ctx.moveTo(0, ey); ctx.lineTo(cx, cy);
      ctx.moveTo(W, ey); ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // sector rings drift toward camera
    for (const r of game.rings) {
      if (r.z < NEAR_Z) continue;
      const k = FOCAL / r.z;
      const rad = CORRIDOR_R * k * 0.18;
      const a = Math.max(0.08, Math.min(0.55, 1 - r.z / FAR_Z));
      ctx.strokeStyle = `rgba(116,255,182,${a.toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDebris(x, y, r, rot, kind) {
    if (kind === 'rock') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(255,184,74,0.85)';
      ctx.fillStyle = 'rgba(80,40,12,0.85)';
      ctx.lineWidth = 1.5;
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const rr = r * (0.75 + (i % 2) * 0.4);
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(255,90,69,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.lineTo(0, -r * 0.4);
      ctx.lineTo(r, 0);  ctx.lineTo(0, r * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBeacon(x, y, r, z) {
    // pulsing diamond — green core, amber halo
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 220);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(116,255,182,${(0.6 * pulse).toFixed(3)})`;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeStyle = `rgba(255,184,74,${(0.9 * pulse).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
    ctx.restore();
  }

  function drawShip(x, y) {
    // crosshair / reticle: arrow chevron pointing forward + bracket
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(116,255,182,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // chevron
    ctx.moveTo(-12, 6);  ctx.lineTo(0, -10); ctx.lineTo(12, 6);
    ctx.moveTo(-7, 5);   ctx.lineTo(0, -3);  ctx.lineTo(7, 5);
    ctx.stroke();
    // brackets
    ctx.beginPath();
    ctx.moveTo(-22, -8); ctx.lineTo(-22, 12); ctx.lineTo(-14, 12);
    ctx.moveTo( 22, -8); ctx.lineTo( 22, 12); ctx.lineTo( 14, 12);
    ctx.stroke();
    ctx.restore();
  }

  // public API
  return {
    canvas,
    resize,
    start,
    stop,
    setInput(x, y) { game.inputX = x; game.inputY = y; },
    onEnd(cb) { game.onEnd = cb; },
    state: game,
  };
}
