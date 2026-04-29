// Snowglobe Photographer — daily silhouette fill puzzle.
// Tilt/shake your phone (or drag the globe) to rearrange physics objects
// inside a circular snowglobe until they overlap today's seeded silhouette.
// Tap "Take the photograph" when the match is highest. Local best + emoji share.

(function () {
  'use strict';

  // ---------- Config ----------
  const LOGICAL = 700;          // canvas logical size (square)
  const PARTICLE_COUNT = 44;    // number of objects in the globe
  const MIN_R = 10;             // min particle radius (logical px)
  const MAX_R = 18;             // max particle radius (logical px)
  const WALL_INSET = 16;        // gap between canvas edge and glass
  const SAMPLE_EVERY_MS = 60;   // how often to re-sample score

  // ---------- Shape catalog for silhouette ----------
  // Each entry is a function that draws the filled silhouette onto a 2D
  // context whose coordinate space is [0..W] x [0..H]. Kept stylized and
  // bold so small particles can fill them convincingly.
  const SHAPES = [
    { key: 'RABBIT', draw: drawRabbit },
    { key: 'HEART', draw: drawHeart },
    { key: 'SKULL', draw: drawSkull },
    { key: 'STAR', draw: drawStar },
    { key: 'CAT', draw: drawCat },
    { key: 'TREE', draw: drawTree },
    { key: 'FISH', draw: drawFish },
    { key: 'MOON', draw: drawMoon },
    { key: 'KEY', draw: drawKey },
    { key: 'BIRD', draw: drawBird },
    { key: 'MUSHROOM', draw: drawMushroom },
    { key: 'GHOST', draw: drawGhost }
  ];

  // ---------- State ----------
  let engine, world, runner;
  let particles = [];
  let walls = [];
  let canvas, ctx;
  let silhouetteCanvas;   // offscreen; draws the filled silhouette
  let silhouetteMask;     // Uint8Array of inside(1)/outside(0) at sample grid
  let silhouetteKey;
  let maskW = 0, maskH = 0;
  let dpr = 1;
  let cssSize = 360;

  let running = false;
  let started = false;
  let lastSample = 0;
  let currentPct = 0;
  let peakPct = 0;
  let lastGravity = { x: 0, y: 1 };
  let dragging = false;
  let dragLastX = 0, dragLastY = 0, dragLastT = 0;
  let dragVel = { x: 0, y: 0 };
  let motionEnabled = false;

  // ---------- Utility: deterministic daily seed ----------
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function prettyDate() {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = new Date();
    return months[d.getMonth()] + ' ' + String(d.getDate()).padStart(2,'0') + ' ' + d.getFullYear();
  }

  // ---------- Silhouette drawing routines ----------
  // All draw functions assume a 1x1 viewport; we scale by W,H before calling.
  // They draw with black fill which will later become the alpha channel.

  function drawRabbit(c, W, H) {
    c.fillStyle = '#000';
    // body
    c.beginPath();
    c.ellipse(0.50*W, 0.72*H, 0.26*W, 0.20*H, 0, 0, Math.PI*2);
    c.fill();
    // head
    c.beginPath();
    c.ellipse(0.50*W, 0.50*H, 0.19*W, 0.17*H, 0, 0, Math.PI*2);
    c.fill();
    // ears
    c.beginPath();
    c.ellipse(0.42*W, 0.26*H, 0.055*W, 0.17*H, -0.12, 0, Math.PI*2);
    c.fill();
    c.beginPath();
    c.ellipse(0.58*W, 0.26*H, 0.055*W, 0.17*H, 0.12, 0, Math.PI*2);
    c.fill();
    // tail
    c.beginPath();
    c.arc(0.76*W, 0.72*H, 0.06*W, 0, Math.PI*2); c.fill();
    // feet
    c.beginPath();
    c.ellipse(0.37*W, 0.88*H, 0.07*W, 0.04*H, 0, 0, Math.PI*2); c.fill();
    c.beginPath();
    c.ellipse(0.58*W, 0.88*H, 0.07*W, 0.04*H, 0, 0, Math.PI*2); c.fill();
  }

  function drawHeart(c, W, H) {
    c.fillStyle = '#000';
    c.beginPath();
    const cx = 0.5*W, top = 0.24*H;
    c.moveTo(cx, top + 0.08*H);
    c.bezierCurveTo(cx + 0.02*W, top - 0.05*H, cx + 0.34*W, top - 0.02*H, cx + 0.30*W, top + 0.18*H);
    c.bezierCurveTo(cx + 0.24*W, top + 0.40*H, cx + 0.08*W, top + 0.50*H, cx, top + 0.60*H);
    c.bezierCurveTo(cx - 0.08*W, top + 0.50*H, cx - 0.24*W, top + 0.40*H, cx - 0.30*W, top + 0.18*H);
    c.bezierCurveTo(cx - 0.34*W, top - 0.02*H, cx - 0.02*W, top - 0.05*H, cx, top + 0.08*H);
    c.closePath();
    c.fill();
  }

  function drawSkull(c, W, H) {
    c.fillStyle = '#000';
    // cranium
    c.beginPath();
    c.ellipse(0.5*W, 0.46*H, 0.28*W, 0.28*H, 0, 0, Math.PI*2);
    c.fill();
    // jaw
    c.beginPath();
    c.moveTo(0.32*W, 0.60*H);
    c.lineTo(0.68*W, 0.60*H);
    c.lineTo(0.62*W, 0.80*H);
    c.quadraticCurveTo(0.5*W, 0.86*H, 0.38*W, 0.80*H);
    c.closePath();
    c.fill();
    // knock out eye sockets (to paper color later via compositing inside inside-test — leave solid; silhouette is a solid fill)
    // triangle nose hole — skip; solid silhouette reads cleaner
  }

  function drawStar(c, W, H) {
    c.fillStyle = '#000';
    const cx = 0.5*W, cy = 0.52*H, R = 0.34*W, r = 0.16*W;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI/2 + i * Math.PI/5;
      const rad = (i % 2 === 0) ? R : r;
      const x = cx + Math.cos(ang)*rad;
      const y = cy + Math.sin(ang)*rad;
      if (i === 0) c.moveTo(x,y); else c.lineTo(x,y);
    }
    c.closePath();
    c.fill();
  }

  function drawCat(c, W, H) {
    c.fillStyle = '#000';
    // body
    c.beginPath();
    c.ellipse(0.50*W, 0.70*H, 0.26*W, 0.20*H, 0, 0, Math.PI*2); c.fill();
    // head
    c.beginPath();
    c.arc(0.50*W, 0.45*H, 0.18*W, 0, Math.PI*2); c.fill();
    // ears (triangles)
    c.beginPath();
    c.moveTo(0.34*W, 0.40*H); c.lineTo(0.38*W, 0.22*H); c.lineTo(0.46*W, 0.34*H); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(0.66*W, 0.40*H); c.lineTo(0.62*W, 0.22*H); c.lineTo(0.54*W, 0.34*H); c.closePath(); c.fill();
    // tail (curved)
    c.beginPath();
    c.moveTo(0.74*W, 0.70*H);
    c.quadraticCurveTo(0.88*W, 0.58*H, 0.82*W, 0.38*H);
    c.quadraticCurveTo(0.92*W, 0.34*H, 0.86*W, 0.28*H);
    c.quadraticCurveTo(0.78*W, 0.46*H, 0.72*W, 0.66*H);
    c.closePath(); c.fill();
  }

  function drawTree(c, W, H) {
    c.fillStyle = '#000';
    // trunk
    c.fillRect(0.46*W, 0.62*H, 0.08*W, 0.24*H);
    // layers (three triangles)
    function tri(cx, cy, half, height) {
      c.beginPath();
      c.moveTo(cx, cy - height);
      c.lineTo(cx + half, cy);
      c.lineTo(cx - half, cy);
      c.closePath();
      c.fill();
    }
    tri(0.50*W, 0.62*H, 0.30*W, 0.22*H);
    tri(0.50*W, 0.50*H, 0.26*W, 0.20*H);
    tri(0.50*W, 0.38*H, 0.22*W, 0.18*H);
  }

  function drawFish(c, W, H) {
    c.fillStyle = '#000';
    // body
    c.beginPath();
    c.ellipse(0.48*W, 0.52*H, 0.28*W, 0.16*H, 0, 0, Math.PI*2); c.fill();
    // tail
    c.beginPath();
    c.moveTo(0.76*W, 0.52*H);
    c.lineTo(0.92*W, 0.36*H);
    c.lineTo(0.92*W, 0.68*H);
    c.closePath(); c.fill();
    // top fin
    c.beginPath();
    c.moveTo(0.44*W, 0.38*H); c.lineTo(0.58*W, 0.28*H); c.lineTo(0.62*W, 0.42*H);
    c.closePath(); c.fill();
  }

  function drawMoon(c, W, H) {
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0.52*W, 0.50*H, 0.32*W, 0, Math.PI*2);
    c.arc(0.64*W, 0.44*H, 0.28*W, 0, Math.PI*2, true);
    c.fill('evenodd');
  }

  function drawKey(c, W, H) {
    c.fillStyle = '#000';
    // ring
    c.beginPath();
    c.arc(0.28*W, 0.50*H, 0.16*W, 0, Math.PI*2);
    c.arc(0.28*W, 0.50*H, 0.08*W, 0, Math.PI*2, true);
    c.fill('evenodd');
    // shaft
    c.fillRect(0.42*W, 0.46*H, 0.40*W, 0.08*H);
    // teeth
    c.fillRect(0.70*W, 0.54*H, 0.05*W, 0.10*H);
    c.fillRect(0.78*W, 0.54*H, 0.05*W, 0.06*H);
  }

  function drawBird(c, W, H) {
    c.fillStyle = '#000';
    // body
    c.beginPath();
    c.ellipse(0.48*W, 0.58*H, 0.24*W, 0.18*H, 0.1, 0, Math.PI*2); c.fill();
    // head
    c.beginPath();
    c.arc(0.70*W, 0.46*H, 0.11*W, 0, Math.PI*2); c.fill();
    // beak
    c.beginPath();
    c.moveTo(0.80*W, 0.46*H); c.lineTo(0.90*W, 0.48*H); c.lineTo(0.80*W, 0.50*H);
    c.closePath(); c.fill();
    // wing
    c.beginPath();
    c.ellipse(0.46*W, 0.54*H, 0.14*W, 0.08*H, -0.3, 0, Math.PI*2); c.fill();
    // tail
    c.beginPath();
    c.moveTo(0.24*W, 0.56*H); c.lineTo(0.10*W, 0.44*H); c.lineTo(0.18*W, 0.62*H);
    c.closePath(); c.fill();
  }

  function drawMushroom(c, W, H) {
    c.fillStyle = '#000';
    // cap
    c.beginPath();
    c.arc(0.5*W, 0.50*H, 0.30*W, Math.PI, 0);
    c.closePath();
    c.fill();
    // stem
    c.fillRect(0.40*W, 0.50*H, 0.20*W, 0.30*H);
    // base
    c.beginPath();
    c.ellipse(0.50*W, 0.82*H, 0.14*W, 0.04*H, 0, 0, Math.PI*2); c.fill();
  }

  function drawGhost(c, W, H) {
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0.5*W, 0.42*H, 0.26*W, Math.PI, 0);
    c.lineTo(0.76*W, 0.80*H);
    // wavy bottom
    c.lineTo(0.68*W, 0.72*H);
    c.lineTo(0.60*W, 0.82*H);
    c.lineTo(0.52*W, 0.72*H);
    c.lineTo(0.44*W, 0.82*H);
    c.lineTo(0.36*W, 0.72*H);
    c.lineTo(0.28*W, 0.82*H);
    c.lineTo(0.24*W, 0.80*H);
    c.closePath();
    c.fill();
  }

  // ---------- Build silhouette + sample into bitmask ----------
  function buildSilhouette(shape) {
    const size = LOGICAL; // match physics coords
    silhouetteCanvas = document.createElement('canvas');
    silhouetteCanvas.width = size; silhouetteCanvas.height = size;
    const sc = silhouetteCanvas.getContext('2d');
    sc.clearRect(0,0,size,size);
    shape.draw(sc, size, size);

    // Sample into a coarse mask (resolution 200x200) for point-in-shape tests.
    maskW = 200; maskH = 200;
    const tmp = document.createElement('canvas');
    tmp.width = maskW; tmp.height = maskH;
    const tc = tmp.getContext('2d');
    tc.drawImage(silhouetteCanvas, 0, 0, maskW, maskH);
    const data = tc.getImageData(0,0,maskW,maskH).data;
    silhouetteMask = new Uint8Array(maskW * maskH);
    let filled = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const a = data[i+3];
      if (a > 40) { silhouetteMask[j] = 1; filled++; }
    }
    silhouetteMask.area = filled;
  }

  function pointInSilhouette(xLogical, yLogical) {
    if (!silhouetteMask) return false;
    const mx = Math.floor((xLogical / LOGICAL) * maskW);
    const my = Math.floor((yLogical / LOGICAL) * maskH);
    if (mx < 0 || my < 0 || mx >= maskW || my >= maskH) return false;
    return silhouetteMask[my * maskW + mx] === 1;
  }

  // ---------- Canvas sizing ----------
  function resizeCanvas() {
    canvas = document.getElementById('globe');
    const rect = canvas.getBoundingClientRect();
    cssSize = Math.round(rect.width);
    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx = canvas.getContext('2d');
  }

  // Convert between logical and screen space.
  function l2s(val) { return (val / LOGICAL) * canvas.width; }

  // ---------- Matter setup ----------
  function buildWorld() {
    engine = Matter.Engine.create();
    world = engine.world;
    engine.gravity.x = 0;
    engine.gravity.y = 1.0;

    // Circular dome: use a ring of many small static rectangles around the inside
    const cx = LOGICAL / 2, cy = LOGICAL / 2;
    const R = LOGICAL / 2 - WALL_INSET;
    const N_SEG = 64;
    const segLen = (2 * Math.PI * R) / N_SEG * 1.05;
    const segW = 14;
    for (let i = 0; i < N_SEG; i++) {
      const a = (i / N_SEG) * Math.PI * 2;
      const x = cx + Math.cos(a) * (R + segW/2);
      const y = cy + Math.sin(a) * (R + segW/2);
      const wall = Matter.Bodies.rectangle(x, y, segLen, segW, {
        isStatic: true,
        angle: a + Math.PI/2,
        restitution: 0.35,
        friction: 0.02
      });
      walls.push(wall);
    }
    Matter.World.add(world, walls);

    // Seeded particle spawn
    const seed = hashStr(todayKey()) ^ 0xC0FFEE;
    const rng = mulberry32(seed);
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = MIN_R + rng() * (MAX_R - MIN_R);
      // place within inner circle
      let px, py;
      for (let tries = 0; tries < 10; tries++) {
        const ang = rng() * Math.PI * 2;
        const rr = rng() * (R - r - 8);
        px = cx + Math.cos(ang) * rr;
        py = cy + Math.sin(ang) * rr;
        break;
      }
      const shapeKind = rng() < 0.55 ? 'circle' : 'box';
      let body;
      if (shapeKind === 'circle') {
        body = Matter.Bodies.circle(px, py, r, {
          restitution: 0.45, friction: 0.02, frictionAir: 0.018, density: 0.0016
        });
      } else {
        const s = r * 1.7;
        body = Matter.Bodies.rectangle(px, py, s, s, {
          restitution: 0.38, friction: 0.04, frictionAir: 0.02, density: 0.0016, angle: rng()*Math.PI
        });
        body._boxSize = s;
      }
      body._radius = r;
      body._hue = pickHue(rng);
      particles.push(body);
    }
    Matter.World.add(world, particles);

    runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
  }

  function pickHue(rng) {
    // warm muted palette
    const palette = [
      '#f6c77a', // amber
      '#e8a84a',
      '#c37e2a',
      '#e7d6a8', // cream
      '#b98a55',
      '#a26a3c', // walnut highlight
      '#d4b683',
      '#9a5a2b',
      '#efe4cc', // paper
      '#7a4a2c'
    ];
    return palette[Math.floor(rng() * palette.length)];
  }

  // ---------- Render ----------
  function draw() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const cx = W/2, cy = H/2;
    const R = (LOGICAL/2 - WALL_INSET) * (W / LOGICAL);

    // Outer dark behind the glass (scene sky)
    const sky = ctx.createRadialGradient(cx, cy - R*0.2, R*0.1, cx, cy, R*1.1);
    sky.addColorStop(0, '#1a2744');
    sky.addColorStop(0.7, '#0c1528');
    sky.addColorStop(1, '#06090f');
    ctx.beginPath();
    ctx.arc(cx, cy, R + l2s(WALL_INSET), 0, Math.PI*2);
    ctx.fillStyle = sky;
    ctx.fill();

    // Silhouette (warm tungsten glow) — draw as soft amber behind particles
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.clip();
    // draw silhouette image scaled
    if (silhouetteCanvas) {
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      // tungsten amber tint: draw silhouette, then recolor via multiply
      // We'll draw a tinted version using a temp approach:
      ctx.save();
      ctx.translate(0,0);
      // Draw silhouette in amber glow
      drawSilhouetteTinted(ctx, W, H);
      ctx.restore();
    }
    ctx.restore();

    // Inner vignette
    const vg = ctx.createRadialGradient(cx, cy, R*0.4, cx, cy, R);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);
    ctx.restore();

    // Particles
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.clip();
    for (const p of particles) {
      const x = l2s(p.position.x);
      const y = l2s(p.position.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p._hue;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = Math.max(1, l2s(1));
      if (p._boxSize) {
        const s = l2s(p._boxSize);
        ctx.fillRect(-s/2, -s/2, s, s);
        ctx.strokeRect(-s/2, -s/2, s, s);
        // top highlight
        ctx.fillStyle = 'rgba(255,235,200,0.18)';
        ctx.fillRect(-s/2, -s/2, s, s*0.25);
      } else {
        const r = l2s(p._radius);
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
        // highlight
        const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0,0, r);
        grad.addColorStop(0, 'rgba(255,245,220,0.55)');
        grad.addColorStop(0.4, 'rgba(255,235,200,0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    // Tungsten lights — top-left and top-right soft glows
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.clip();
    const l1 = ctx.createRadialGradient(cx - R*0.6, cy - R*0.65, 0, cx - R*0.6, cy - R*0.65, R*0.55);
    l1.addColorStop(0, 'rgba(255,210,140,0.35)');
    l1.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = l1; ctx.fillRect(0,0,W,H);
    const l2 = ctx.createRadialGradient(cx + R*0.55, cy - R*0.7, 0, cx + R*0.55, cy - R*0.7, R*0.5);
    l2.addColorStop(0, 'rgba(255,190,110,0.25)');
    l2.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = l2; ctx.fillRect(0,0,W,H);
    ctx.restore();

    // Glass rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(246,199,122,0.35)';
    ctx.lineWidth = Math.max(2, l2s(2));
    ctx.stroke();

    // Glass shine (top-left arc)
    ctx.beginPath();
    ctx.arc(cx, cy, R*0.92, Math.PI*1.1, Math.PI*1.45);
    ctx.strokeStyle = 'rgba(255,245,220,0.45)';
    ctx.lineWidth = Math.max(2, l2s(4));
    ctx.stroke();

    // subtle bottom highlight
    ctx.beginPath();
    ctx.arc(cx, cy, R*0.95, Math.PI*0.35, Math.PI*0.55);
    ctx.strokeStyle = 'rgba(255,245,220,0.12)';
    ctx.lineWidth = Math.max(1, l2s(2));
    ctx.stroke();
    ctx.restore();
  }

  function drawSilhouetteTinted(target, W, H) {
    // Draw silhouette as amber glow: first big soft blur via shadow, then solid tinted fill.
    // Use offscreen tinted canvas.
    const tinted = getTintedSilhouette(W, H);
    target.globalCompositeOperation = 'lighter';
    target.globalAlpha = 0.92;
    target.drawImage(tinted, 0, 0, W, H);
    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1.0;
  }

  let _tintedCache = null;
  let _tintedCacheKey = '';
  function getTintedSilhouette(W, H) {
    const key = silhouetteKey + ':' + W + 'x' + H;
    if (_tintedCache && _tintedCacheKey === key) return _tintedCache;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // Soft glow behind silhouette
    c.save();
    c.filter = 'blur(12px)';
    c.globalAlpha = 0.35;
    c.fillStyle = '#f6c77a';
    // draw silhouette shape scaled
    c.save();
    c.translate(0,0);
    c.scale(W / silhouetteCanvas.width, H / silhouetteCanvas.height);
    drawMaskedFill(c, silhouetteCanvas.width, silhouetteCanvas.height, '#f6c77a');
    c.restore();
    c.restore();

    // Solid tinted silhouette (a faint inner body)
    c.save();
    c.globalAlpha = 0.20;
    c.fillStyle = '#f6c77a';
    c.save();
    c.scale(W / silhouetteCanvas.width, H / silhouetteCanvas.height);
    drawMaskedFill(c, silhouetteCanvas.width, silhouetteCanvas.height, '#f6c77a');
    c.restore();
    c.restore();

    // Edge stroke from silhouette shape
    c.save();
    c.globalAlpha = 0.55;
    c.strokeStyle = 'rgba(246,199,122,0.9)';
    c.lineWidth = 2;
    c.save();
    c.scale(W / silhouetteCanvas.width, H / silhouetteCanvas.height);
    strokeMask(c, silhouetteCanvas, '#f6c77a');
    c.restore();
    c.restore();

    _tintedCache = cv;
    _tintedCacheKey = key;
    return cv;
  }

  function drawMaskedFill(c, w, h, color) {
    // Use the alpha from silhouetteCanvas as a mask
    c.save();
    c.drawImage(silhouetteCanvas, 0, 0, w, h);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0,0,w,h);
    c.restore();
  }
  function strokeMask(c, src, color) {
    // Extract edge via drawImage + difference is overkill; just draw silhouette outline by
    // drawing shape twice at small offsets.
    c.save();
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0,0,src.width,src.height);
    c.restore();
  }

  // ---------- Scoring ----------
  function sampleScore() {
    if (!silhouetteMask || !particles.length) return 0;
    let inside = 0;
    for (const p of particles) {
      if (pointInSilhouette(p.position.x, p.position.y)) inside++;
    }
    return Math.round((inside / particles.length) * 100);
  }

  // ---------- Input: device motion & drag ----------
  function applyGravityFromTilt(ax, ay) {
    // ax: device x acceleration (positive = right tilt), ay: y
    // Normalize to moderate gravity magnitude
    const g = 1.1;
    const mag = Math.hypot(ax, ay) || 1;
    const nx = (ax / mag) * g;
    const ny = (ay / mag) * g;
    engine.gravity.x = nx;
    engine.gravity.y = ny;
    lastGravity.x = nx;
    lastGravity.y = ny;
  }

  function applyShakeImpulse(ix, iy, strength) {
    for (const p of particles) {
      const jitter = 0.3 + Math.random() * 0.9;
      Matter.Body.applyForce(p, p.position, {
        x: ix * strength * jitter * p.mass,
        y: iy * strength * jitter * p.mass
      });
    }
  }

  function setupMotion() {
    // iOS 13+ requires permission flow (from a user gesture — our "start" button)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        DeviceMotionEvent.requestPermission().then(res => {
          if (res === 'granted') bindMotion();
        }).catch(() => {});
      } catch (_) { /* ignore */ }
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      bindMotion();
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        DeviceOrientationEvent.requestPermission().then(res => {
          if (res === 'granted') bindOrientation();
        }).catch(() => {});
      } catch (_) {}
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      bindOrientation();
    }
  }

  function bindOrientation() {
    motionEnabled = true;
    let lastT = 0;
    window.addEventListener('deviceorientation', (e) => {
      if (!running) return;
      // beta = front-back tilt [-180..180], gamma = left-right [-90..90]
      const beta = e.beta || 0;
      const gamma = e.gamma || 0;
      // convert to gravity vector roughly (in screen space)
      const gx = Math.max(-1, Math.min(1, gamma / 45));
      const gy = Math.max(-1, Math.min(1, beta / 45));
      applyGravityFromTilt(gx, gy);
      const now = performance.now();
      lastT = now;
    });
  }

  function bindMotion() {
    motionEnabled = true;
    let lastAccel = { x: 0, y: 0, z: 0 };
    let lastShakeT = 0;
    window.addEventListener('devicemotion', (e) => {
      if (!running) return;
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;
      const dx = acc.x - lastAccel.x;
      const dy = acc.y - lastAccel.y;
      const dz = (acc.z || 0) - lastAccel.z;
      const jerk = Math.hypot(dx, dy, dz);
      lastAccel = { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 };
      const now = performance.now();
      if (jerk > 18 && now - lastShakeT > 80) {
        // strong shake → random impulse
        const ang = Math.random() * Math.PI * 2;
        const s = Math.min(0.0035, 0.0008 + jerk * 0.00008);
        applyShakeImpulse(Math.cos(ang), Math.sin(ang), s);
        lastShakeT = now;
      }
    });
  }

  // Drag fallback (works on desktop + mobile)
  function bindDrag() {
    const canvasEl = document.getElementById('globe');
    function toLocal(evt) {
      const r = canvasEl.getBoundingClientRect();
      const t = evt.touches ? evt.touches[0] : evt;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function onDown(evt) {
      if (!running) return;
      dragging = true;
      canvasEl.classList.add('dragging');
      const p = toLocal(evt);
      dragLastX = p.x; dragLastY = p.y; dragLastT = performance.now();
      evt.preventDefault();
    }
    function onMove(evt) {
      if (!dragging) return;
      const p = toLocal(evt);
      const now = performance.now();
      const dt = Math.max(8, now - dragLastT);
      const vx = (p.x - dragLastX) / dt;
      const vy = (p.y - dragLastY) / dt;
      dragVel.x = vx; dragVel.y = vy;
      // Apply tilt-like gravity while dragging
      const g = 1.1;
      const mag = Math.hypot(vx, vy);
      if (mag > 0.04) {
        applyGravityFromTilt(vx * 2.5, vy * 2.5);
      }
      // If swipe is fast, apply a shake impulse
      if (mag > 1.2) {
        const ang = Math.atan2(vy, vx);
        applyShakeImpulse(Math.cos(ang), Math.sin(ang), 0.0016);
      }
      dragLastX = p.x; dragLastY = p.y; dragLastT = now;
      evt.preventDefault();
    }
    function onUp(evt) {
      if (!dragging) return;
      dragging = false;
      canvasEl.classList.remove('dragging');
      // decay gravity back toward down over time
      setTimeout(() => {
        if (!motionEnabled) {
          engine.gravity.x = 0;
          engine.gravity.y = 1.0;
        }
      }, 350);
    }
    canvasEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvasEl.addEventListener('touchstart', onDown, { passive: false });
    canvasEl.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    // tap-to-burst (double-tap)
    let lastTap = 0;
    canvasEl.addEventListener('click', () => {
      const now = performance.now();
      if (now - lastTap < 280) {
        // big burst
        const ang = Math.random() * Math.PI * 2;
        applyShakeImpulse(Math.cos(ang), Math.sin(ang), 0.0025);
      }
      lastTap = now;
    });
  }

  // ---------- Main loop ----------
  function loop(ts) {
    draw();
    if (running && ts - lastSample > SAMPLE_EVERY_MS) {
      lastSample = ts;
      currentPct = sampleScore();
      if (currentPct > peakPct) peakPct = currentPct;
      updateMeter();
    }
    requestAnimationFrame(loop);
  }

  function updateMeter() {
    const nowEl = document.getElementById('nowPct');
    const peakEl = document.getElementById('peakPct');
    const fill = document.getElementById('meterFill');
    const mark = document.getElementById('meterPeakMark');
    if (nowEl) nowEl.textContent = currentPct + '%';
    if (peakEl) peakEl.textContent = peakPct + '%';
    if (fill) fill.style.width = currentPct + '%';
    if (mark) {
      mark.style.left = peakPct + '%';
      mark.style.opacity = peakPct > 2 ? '1' : '0';
    }
  }

  // ---------- Photo capture / result ----------
  function captureToPhoto() {
    // Compose: silhouette tinted ghost + particles, into a paper-framed square.
    const pc = document.getElementById('photoCanvas');
    const W = pc.width, H = pc.height;
    const c = pc.getContext('2d');

    // paper warm background
    const bg = c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, '#f2e6cb');
    bg.addColorStop(1, '#d9c79f');
    c.fillStyle = bg;
    c.fillRect(0,0,W,H);

    // warm vignette + grain-ish specks
    const vg = c.createRadialGradient(W/2,H/2,W*0.2,W/2,H/2,W*0.7);
    vg.addColorStop(0,'rgba(255,240,210,0)');
    vg.addColorStop(1,'rgba(60,35,15,0.45)');
    c.fillStyle = vg; c.fillRect(0,0,W,H);

    // Silhouette as dark walnut ink
    c.save();
    c.globalAlpha = 0.22;
    c.save();
    c.scale(W / silhouetteCanvas.width, H / silhouetteCanvas.height);
    drawMaskedFill(c, silhouetteCanvas.width, silhouetteCanvas.height, '#3b2418');
    c.restore();
    c.restore();

    // Outline of silhouette
    c.save();
    c.globalAlpha = 0.55;
    c.lineWidth = 2;
    c.strokeStyle = '#3b2418';
    c.save();
    c.scale(W / silhouetteCanvas.width, H / silhouetteCanvas.height);
    c.drawImage(silhouetteCanvas, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#3b2418';
    c.fillRect(0,0,silhouetteCanvas.width, silhouetteCanvas.height);
    c.restore();
    c.restore();

    // Particles, warm-toned
    const cx = W/2, cy = H/2;
    const R = W/2 - 10;
    c.save();
    c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.clip();
    for (const p of particles) {
      const x = (p.position.x / LOGICAL) * W;
      const y = (p.position.y / LOGICAL) * H;
      const r = (p._radius / LOGICAL) * W;
      c.save();
      c.translate(x, y);
      c.rotate(p.angle);
      // ink-bleed colored dots
      c.fillStyle = p._hue;
      c.strokeStyle = 'rgba(40,20,10,0.6)';
      c.lineWidth = 1.5;
      if (p._boxSize) {
        const s = (p._boxSize / LOGICAL) * W;
        c.fillRect(-s/2,-s/2,s,s);
        c.strokeRect(-s/2,-s/2,s,s);
      } else {
        c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill(); c.stroke();
      }
      c.restore();
    }
    c.restore();

    // Frame ring
    c.save();
    c.strokeStyle = 'rgba(60,35,15,0.85)';
    c.lineWidth = 4;
    c.beginPath(); c.arc(cx,cy,R,0,Math.PI*2); c.stroke();
    c.restore();

    // Stamp: subject + pct + date
    c.save();
    c.fillStyle = 'rgba(40,20,10,0.85)';
    c.font = 'bold 20px "Special Elite", monospace';
    c.textAlign = 'left';
    c.fillText('SUBJECT: ' + silhouetteKey, 24, H - 56);
    c.fillText(prettyDate(), 24, H - 30);
    c.textAlign = 'right';
    c.font = 'bold 42px "Cormorant Garamond", Georgia, serif';
    c.fillText(peakPct + '%', W - 24, H - 30);
    c.restore();
  }

  // ---------- Emoji grid share ----------
  function bucket(pct) {
    // 5 tiers → colored squares
    if (pct < 20) return '⬛';
    if (pct < 40) return '⬜';
    if (pct < 60) return '🟩';
    if (pct < 80) return '🟨';
    return '🟥';
  }
  function buildEmojiGrid(pct) {
    // 5 rows x 8 cols, filled proportionally with the top-tier emoji on the left,
    // fading to dark squares on the right — visually communicates score without
    // revealing the silhouette.
    const total = 40;
    const filled = Math.round((pct / 100) * total);
    const top = bucket(pct);
    const low = '⬛';
    let out = '';
    for (let r = 0; r < 5; r++) {
      let row = '';
      for (let col = 0; col < 8; col++) {
        const idx = r * 8 + col;
        row += (idx < filled) ? top : low;
      }
      out += row + '\n';
    }
    return out.trim();
  }
  function ribbonFor(pct) {
    if (pct >= 90) return '“Astonishingly lifelike.”';
    if (pct >= 75) return '“A steady hand.”';
    if (pct >= 60) return '“Unmistakable.”';
    if (pct >= 45) return '“A passable likeness.”';
    if (pct >= 30) return '“More suggestion than portrait.”';
    if (pct >= 15) return '“A spirited attempt.”';
    return '“Largely abstract.”';
  }

  // ---------- Local best ----------
  function bestKey() { return 'sgp:best:' + silhouetteKey + ':' + todayKey(); }
  function getBest() {
    try { return parseInt(localStorage.getItem(bestKey()) || '0', 10) || 0; } catch(_) { return 0; }
  }
  function setBest(v) {
    try { localStorage.setItem(bestKey(), String(v)); } catch(_) {}
  }

  // ---------- Start / shoot flow ----------
  function start() {
    if (started) return;
    started = true;
    running = true;
    const intro = document.getElementById('intro');
    if (intro) intro.classList.add('hidden');
    setTimeout(() => { if (intro) intro.style.display = 'none'; }, 400);
    const btn = document.getElementById('shootBtn');
    if (btn) btn.disabled = false;
    setupMotion();

    // give an initial stir so something is always moving
    const ang = Math.random() * Math.PI * 2;
    applyShakeImpulse(Math.cos(ang), Math.sin(ang), 0.0018);
  }

  function shoot() {
    if (!started) return;
    // freeze
    running = false;
    // flash
    let flash = document.getElementById('flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'flash';
      document.body.appendChild(flash);
    }
    flash.classList.add('go');
    setTimeout(() => flash.classList.remove('go'), 140);

    const finalPct = Math.max(peakPct, currentPct); // "peak observed %"
    peakPct = finalPct;
    const best = getBest();
    const newBest = Math.max(best, finalPct);
    if (newBest > best) setBest(newBest);

    // build photo
    captureToPhoto();

    // populate result
    document.getElementById('resultDate').textContent = prettyDate();
    document.getElementById('resultSubject').textContent = silhouetteKey.toLowerCase();
    document.getElementById('resultPct').textContent = finalPct;
    document.getElementById('resultRibbon').textContent = ribbonFor(finalPct);
    document.getElementById('bestPct').textContent = newBest + '%';
    const grid = buildEmojiGrid(finalPct);
    const gridEl = document.getElementById('emojiGrid');
    gridEl.textContent = grid;

    const card = document.getElementById('result');
    card.classList.add('visible');
    card.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function retake() {
    // Re-enable session, but keep peak% as tracked locally — we give them a fresh
    // peak for the retake so they can try to beat it; best is persisted separately.
    peakPct = 0;
    currentPct = 0;
    updateMeter();
    const card = document.getElementById('result');
    card.classList.remove('visible');
    running = true;
    // stir
    const ang = Math.random() * Math.PI * 2;
    applyShakeImpulse(Math.cos(ang), Math.sin(ang), 0.0018);
    document.getElementById('globeScene').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Boot ----------
  function pickShape() {
    const seed = hashStr('snowglobe-photographer:' + todayKey());
    const rng = mulberry32(seed);
    // pick one shape deterministically
    const idx = Math.floor(rng() * SHAPES.length);
    return SHAPES[idx];
  }

  function init() {
    resizeCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); });

    const shape = pickShape();
    silhouetteKey = shape.key;
    buildSilhouette(shape);

    document.getElementById('subjectName').textContent = shape.key;
    document.getElementById('dateStamp').textContent = prettyDate();

    buildWorld();
    bindDrag();

    document.getElementById('startBtn').addEventListener('click', start);
    document.getElementById('shootBtn').addEventListener('click', shoot);
    document.getElementById('againBtn').addEventListener('click', retake);

    // Desktop: press space to shoot
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && started && running) {
        e.preventDefault();
        shoot();
      } else if ((e.key === 'Enter' || e.key === ' ') && !started) {
        start();
      }
    });

    requestAnimationFrame(loop);
    updateMeter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Required standard share function (lives at module scope per skill spec)
function share() {
  // Try to include score + emoji grid if available
  let text = document.title;
  try {
    const subject = document.getElementById('resultSubject');
    const pct = document.getElementById('resultPct');
    const grid = document.getElementById('emojiGrid');
    if (subject && pct && grid && subject.textContent && pct.textContent) {
      text = 'Snowglobe Photographer — today\'s subject: ' + subject.textContent.toUpperCase() +
             '\nMatch: ' + pct.textContent + '%\n\n' + grid.textContent;
    }
  } catch (_) {}
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, text: text, url: url }).catch(() => {});
  } else {
    const payload = text + '\n' + url;
    navigator.clipboard.writeText(payload).then(() => {
      alert('Copied your photograph to clipboard — paste anywhere.');
    }).catch(() => {
      alert(payload);
    });
  }
}
