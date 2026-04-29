// Boids Flock Painter — p5.js interactive art
// The core appeal is WATCHING the boids move. We aim for:
//   1. Vibrant, clean neon trails that fade cleanly (no muddy grey residue).
//   2. Multiple distinct flocks even on a phone screen — smaller attractor radius
//      so two taps on a small viewport form two separate swarms, not one.
//   3. No save/export framing. It's a live ballet, not a painting tool.

// ------- Tunables --------
// Attractor reach: how far a beacon pulls boids from. We express it as a fraction
// of the smaller viewport dimension so phones get proportionally smaller reach,
// which is what enables multi-flock behavior on small screens.
function computeAttractorRadius() {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  // ~28% of the short side. On a 400px phone this is ~112px, small enough that
  // two taps 200px apart reliably form two distinct flocks.
  return Math.max(90, Math.round(minDim * 0.28));
}

// Boid count scales with viewport area so mobile stays lively without being
// cramped. We raise the floor (vs the old 60) so there are always enough boids
// to form 2-3 visible sub-flocks even on small screens.
function computeBoidCount() {
  const area = window.innerWidth * window.innerHeight;
  return Math.max(90, Math.min(240, Math.round(area / 5500)));
}

let NUM_BOIDS = computeBoidCount();
let ATTRACTOR_REACH = computeAttractorRadius();
const ATTRACTOR_LIFETIME = 3600; // ms before an attractor fades out
const MAX_LIVE_ATTRACTORS = 6;   // cap so beacons don't overlap into one mega-flock

// Vibrant neon palette (HSB hues) — no muted/grey hues, so trails stay alive
const ATTRACTOR_HUES = [320, 180, 50, 15, 140, 270, 200, 350];

let boids = [];
let attractors = [];
let hueIndex = 0;
let _p; // reference to p5 instance

// Persistent trail buffer. We draw a matching *opaque* backdrop color onto it
// every frame at low alpha — this fades old trails toward the deep-space bg
// cleanly instead of accumulating the grey haze the old version had.
let pg;
// Backdrop color (must match the CSS gradient's mid tone to avoid a visible seam)
const BG_H = 235, BG_S = 72, BG_V = 8;

// -- Boid class --
class Boid {
  constructor(p) {
    this.pos = p.createVector(p.random(p.width), p.random(p.height));
    this.vel = p5.Vector.random2D().mult(p.random(1.5, 3));
    this.acc = p.createVector(0, 0);
    this.hue = p.random(360);
    this.maxSpeed = p.random(2.4, 4.0);
    this.maxForce = 0.13;
    this.trailWeight = p.random(0.7, 1.5);
    this.size = p.random(3, 5);
  }

  flock(boids, attractors, p) {
    const sep = this._separate(boids, p);
    const ali = this._align(boids, p);
    const coh = this._cohere(boids, p);
    const att = this._attract(attractors, p);

    sep.mult(1.7);
    ali.mult(1.0);
    coh.mult(0.9);
    att.mult(2.4);

    this.acc.add(sep).add(ali).add(coh).add(att);

    // Nudge hue toward the nearest attractor — but only if actually within reach.
    // This is what gives each flock its own distinct color.
    if (attractors.length > 0) {
      let closest = null;
      let minD = ATTRACTOR_REACH;
      for (const a of attractors) {
        const d = p.dist(this.pos.x, this.pos.y, a.x, a.y);
        if (d < minD) { minD = d; closest = a; }
      }
      if (closest) {
        const diff = ((closest.hue - this.hue) + 360) % 360;
        const delta = diff > 180 ? diff - 360 : diff;
        this.hue = (this.hue + delta * 0.06 + 360) % 360;
      }
    }
  }

  update(p) {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Wrap edges
    if (this.pos.x < 0) this.pos.x = p.width;
    if (this.pos.x > p.width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = p.height;
    if (this.pos.y > p.height) this.pos.y = 0;
  }

  paintTrail(pg, p) {
    const speed = this.vel.mag();
    // Higher-saturation, higher-brightness strokes — no dull desaturated core.
    const alpha = p.map(speed, 0, 4, 10, 28);
    // Core trail dot — fully saturated neon
    pg.stroke(this.hue, 90, 100, alpha);
    pg.strokeWeight(this.trailWeight);
    pg.point(this.pos.x, this.pos.y);
    // Ink-bleed glow halo — same hue, slightly softer
    pg.stroke(this.hue, 70, 100, alpha * 0.4);
    pg.strokeWeight(this.trailWeight * 3.5);
    pg.point(this.pos.x, this.pos.y);
  }

  draw(p) {
    p.noStroke();
    p.fill(this.hue, 80, 100, 90);
    p.circle(this.pos.x, this.pos.y, this.size);
  }

  _separate(boids, p) {
    const desiredSep = 26;
    const steer = p.createVector(0, 0);
    let count = 0;
    for (const other of boids) {
      const d = p.dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (d > 0 && d < desiredSep) {
        const diff = p5.Vector.sub(this.pos, other.pos).normalize().div(d);
        steer.add(diff);
        count++;
      }
    }
    if (count > 0) steer.div(count);
    if (steer.mag() > 0) {
      steer.normalize().mult(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    }
    return steer;
  }

  _align(boids, p) {
    const neighborDist = 55;
    const sum = p.createVector(0, 0);
    let count = 0;
    for (const other of boids) {
      const d = p.dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (d > 0 && d < neighborDist) { sum.add(other.vel); count++; }
    }
    if (count > 0) {
      sum.div(count).normalize().mult(this.maxSpeed);
      return sum.sub(this.vel).limit(this.maxForce);
    }
    return p.createVector(0, 0);
  }

  _cohere(boids, p) {
    const neighborDist = 70;
    const sum = p.createVector(0, 0);
    let count = 0;
    for (const other of boids) {
      const d = p.dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (d > 0 && d < neighborDist) { sum.add(other.pos); count++; }
    }
    if (count > 0) {
      sum.div(count);
      return this._seek(sum, p);
    }
    return p.createVector(0, 0);
  }

  _attract(attractors, p) {
    if (attractors.length === 0) return p.createVector(0, 0);
    let nearest = null;
    let minD = Infinity;
    for (const a of attractors) {
      const d = p.dist(this.pos.x, this.pos.y, a.x, a.y);
      if (d < minD) { minD = d; nearest = a; }
    }
    // Hard cutoff at ATTRACTOR_REACH so two beacons on a small screen don't
    // both pull on the same boids — this is how we get distinct flocks.
    if (nearest && minD < ATTRACTOR_REACH) {
      // Falloff so boids at the edge of reach feel gentler, stronger near center
      const pull = p.map(minD, 0, ATTRACTOR_REACH, 1.0, 0.3);
      return this._seek(p.createVector(nearest.x, nearest.y), p).mult(pull);
    }
    return p.createVector(0, 0);
  }

  _seek(target, p) {
    const desired = p5.Vector.sub(target, this.pos).normalize().mult(this.maxSpeed);
    return desired.sub(this.vel).limit(this.maxForce);
  }
}

function initBoids(p) {
  NUM_BOIDS = computeBoidCount();
  boids = [];
  for (let i = 0; i < NUM_BOIDS; i++) {
    boids.push(new Boid(p));
  }
}

function placeAttractor(x, y, p) {
  // Keep live attractors bounded so the canvas never collapses to one mega-flock
  if (attractors.length >= MAX_LIVE_ATTRACTORS) {
    attractors.shift();
  }
  const hue = ATTRACTOR_HUES[hueIndex % ATTRACTOR_HUES.length];
  hueIndex++;
  attractors.push({ x, y, hue, born: p.millis() });
}

// -- p5 sketch --
new p5(function (p) {
  _p = p;

  p.setup = function () {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
    cnv.style('position', 'fixed');
    cnv.style('top', '0');
    cnv.style('left', '0');
    cnv.style('z-index', '0');
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.pixelDensity(1);

    pg = p.createGraphics(p.width, p.height);
    pg.colorMode(p.HSB, 360, 100, 100, 100);
    pg.pixelDensity(1);
    pg.background(BG_H, BG_S, BG_V);

    initBoids(p);
  };

  p.draw = function () {
    // Clean trail decay: fade toward the backdrop each frame. Because we fade
    // toward the *same* color as the background (not a blended neutral),
    // trails retire to deep indigo/black instead of the grey haze the previous
    // version left behind.
    pg.noStroke();
    pg.fill(BG_H, BG_S, BG_V, 3.5);
    pg.rect(0, 0, pg.width, pg.height);

    // Render persistent paint buffer as backdrop
    p.image(pg, 0, 0);

    const now = p.millis();
    attractors = attractors.filter(a => now - a.born < ATTRACTOR_LIFETIME);

    // Draw attractor halos (live layer) — bolder, more satisfying tap feedback
    for (const a of attractors) {
      const age = (now - a.born) / ATTRACTOR_LIFETIME;

      // Expanding shockwave ring in the first ~260ms after tap
      const pulseAge = (now - a.born) / 260;
      if (pulseAge < 1) {
        const r = p.map(pulseAge, 0, 1, 8, 110);
        const a2 = p.map(pulseAge, 0, 1, 95, 0);
        p.noFill();
        p.stroke(a.hue, 70, 100, a2);
        p.strokeWeight(2.5);
        p.circle(a.x, a.y, r * 2);
      }

      // Bright solid core dot
      const coreAlpha = p.map(age, 0, 1, 95, 0);
      p.noStroke();
      p.fill(a.hue, 25, 100, coreAlpha);
      p.circle(a.x, a.y, 10);
      p.fill(a.hue, 85, 100, coreAlpha * 0.75);
      p.circle(a.x, a.y, 6);

      // Slow halo rings — breathing outward, scaled to actual attractor reach
      // so users can see the flock boundary
      const alpha = p.map(age, 0, 1, 70, 0);
      const reachRing = ATTRACTOR_REACH * 0.55;
      p.noFill();
      p.stroke(a.hue, 80, 100, alpha * 0.9);
      p.strokeWeight(2);
      p.circle(a.x, a.y, reachRing * 2);
      p.stroke(a.hue, 50, 100, alpha * 0.3);
      p.strokeWeight(1.2);
      p.circle(a.x, a.y, ATTRACTOR_REACH * 2);
    }

    // Update and draw boids
    for (const b of boids) {
      b.flock(boids, attractors, p);
      b.update(p);
      b.paintTrail(pg, p);
      b.draw(p);
    }
  };

  p.mousePressed = function () {
    // Ignore clicks on UI buttons
    const target = document.elementFromPoint(p.mouseX, p.mouseY);
    if (target && target.tagName === 'BUTTON') return;
    if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
    placeAttractor(p.mouseX, p.mouseY, p);
  };

  p.touchStarted = function () {
    for (const t of p.touches) {
      const target = document.elementFromPoint(t.x, t.y);
      if (target && target.tagName === 'BUTTON') continue;
      placeAttractor(t.x, t.y, p);
    }
    return false;
  };

  p.windowResized = function () {
    const oldPg = pg;
    pg = p.createGraphics(p.windowWidth, p.windowHeight);
    pg.colorMode(p.HSB, 360, 100, 100, 100);
    pg.pixelDensity(1);
    pg.background(BG_H, BG_S, BG_V);
    pg.image(oldPg, 0, 0);
    oldPg.remove();
    p.resizeCanvas(p.windowWidth, p.windowHeight);

    // Rebalance boid density and attractor reach for the new viewport
    ATTRACTOR_REACH = computeAttractorRadius();
    const target = computeBoidCount();
    while (boids.length > target) boids.pop();
    while (boids.length < target) boids.push(new Boid(p));
    NUM_BOIDS = target;
  };
});

// -- Global controls (called from HTML) --
window.resetCanvas = function () {
  if (!pg || !_p) return;
  pg.background(BG_H, BG_S, BG_V);
  attractors = [];
  hueIndex = 0;
  initBoids(_p);
};
