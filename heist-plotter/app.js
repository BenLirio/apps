/* Heist Plotter v2 — Bureau of Notable Capers
   A real route-planning puzzle. Each floor has ENTRY, TARGET, EXIT.
   Tap the floor to add waypoints. Each leg is checked LIVE against:
     - walls (any leg crossing a wall = busted)
     - guard sight-lines (any leg entering a vision zone = busted)
   You must visit TARGET and finish at EXIT.  Fewer legs = cleaner job.
   Verdict is determined by observable rules — no hidden scoring. */

// ---------- floor plans ----------
// 320×320 viewBox. Each plan now has:
//   walls       — solid rectangles that block movement
//   props       — decorative pixel-art (vault, fountain, etc.)
//   sightlines  — vision zones (rectangles) that detect any leg passing through
//   entry       — fixed start point {x,y}
//   target      — the loot {x,y}; route must pass within RADIUS_TARGET of it
//   exit        — the way out {x,y}; route must finish within RADIUS_EXIT of it

const RADIUS_TARGET = 16; // a leg endpoint within this many px counts as visited
const RADIUS_EXIT   = 16;
const MAX_WAYPOINTS = 7;  // hard ceiling on intermediate taps

const FLOOR_PLANS = [
  {
    name: 'Sub-Basement Vault — Mercantile Trust',
    facility: 'VAULT',
    walls: [
      [0,0,320,16],[0,304,320,16],[0,0,16,320],[304,0,16,320],
      [80,16,16,120],[224,16,16,120],
      [16,160,80,16],[224,160,80,16],
      [120,180,80,16],
      [80,220,16,84],[224,220,16,84],
    ],
    props: [
      {type:'rect', x:140, y:140, w:40, h:40, fill:'#7a6957', stroke:'#2c241a'},
      {type:'rect', x:148, y:148, w:24, h:24, fill:'#c9b88a', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:160, r:5, fill:'#2c241a'},
      {type:'rect', x:40, y:40, w:32, h:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'rect', x:248, y:40, w:32, h:24, fill:'#a89770', stroke:'#2c241a'},
    ],
    sightlines: [
      {x:32, y:200, w:48, h:48},
      {x:240, y:200, w:48, h:48},
    ],
    entry:  { x:40,  y:40  },
    target: { x:160, y:160 },
    exit:   { x:280, y:280 },
    labels: [
      {x:160, y:30, text:'LOBBY'},
      {x:160, y:130, text:'VAULT'},
      {x:160, y:300, text:'TUNNELS'},
    ],
  },
  {
    name: 'Hilltop Penthouse — Apt. 38B',
    facility: 'PENTHOUSE',
    walls: [
      [0,0,320,16],[0,304,320,16],[0,0,16,320],[304,0,16,320],
      [16,140,140,16],[180,140,124,16],
      [120,16,16,80],
      [200,200,16,104],
    ],
    props: [
      {type:'rect', x:32, y:32, w:80, h:88, fill:'#5a8aa8', stroke:'#2c241a'},
      {type:'rect', x:36, y:36, w:72, h:80, fill:'#7ab0d0'},
      {type:'rect', x:240, y:200, w:40, h:30, fill:'#3a3128', stroke:'#2c241a'},
      {type:'circle', cx:260, cy:215, r:4, fill:'#c9b88a'},
      {type:'rect', x:200, y:36, w:64, h:80, fill:'#1a1612', stroke:'#2c241a'},
      {type:'rect', x:208, y:44, w:48, h:64, fill:'#2c241a'},
    ],
    sightlines: [
      {x:140, y:170, w:48, h:60},
      {x:32, y:240, w:60, h:48},
    ],
    entry:  { x:40,  y:280 },
    target: { x:260, y:215 },
    exit:   { x:60,  y:50  },
    labels: [
      {x:80, y:130, text:'POOL'},
      {x:240, y:130, text:'SALON'},
      {x:80, y:300, text:'FOYER'},
      {x:260, y:300, text:'BEDRM'},
    ],
  },
  {
    name: 'Municipal Museum — North Wing',
    facility: 'MUSEUM',
    walls: [
      [0,0,320,16],[0,304,320,16],[0,0,16,320],[304,0,16,320],
      [100,16,16,100],[204,16,16,100],
      [16,180,100,16],[204,180,100,16],
      [140,200,40,16],
    ],
    props: [
      {type:'rect', x:144, y:140, w:32, h:32, fill:'#a89770', stroke:'#2c241a'},
      {type:'rect', x:152, y:148, w:16, h:16, fill:'#3a8a5a'},
      {type:'rect', x:154, y:150, w:6, h:6, fill:'#9bf0c0'},
      {type:'rect', x:40, y:40, w:24, h:48, fill:'#c9b88a', stroke:'#2c241a'},
      {type:'rect', x:256, y:40, w:24, h:48, fill:'#c9b88a', stroke:'#2c241a'},
      {type:'rect', x:40, y:240, w:48, h:8, fill:'#6b3a1f'},
      {type:'rect', x:232, y:240, w:48, h:8, fill:'#6b3a1f'},
    ],
    sightlines: [
      {x:32, y:120, w:60, h:60},
      {x:228, y:120, w:60, h:60},
    ],
    entry:  { x:40,  y:280 },
    target: { x:160, y:156 },
    exit:   { x:280, y:50  },
    labels: [
      {x:60, y:30, text:'GALLERY 1'},
      {x:260, y:30, text:'GALLERY 2'},
      {x:160, y:128, text:'PEDESTAL'},
      {x:160, y:300, text:'ROTUNDA'},
    ],
  },
  {
    name: 'Confectionary Works — Loompa Annex',
    facility: 'CHOCOLATE FACTORY',
    walls: [
      [0,0,320,16],[0,304,320,16],[0,0,16,320],[304,0,16,320],
      [16,160,140,16],[180,160,124,16],
      [120,200,80,16],
    ],
    props: [
      {type:'rect', x:32, y:40, w:256, h:16, fill:'#5a2e10'},
      {type:'rect', x:32, y:56, w:16, h:60, fill:'#5a2e10'},
      {type:'rect', x:48, y:100, w:240, h:16, fill:'#5a2e10'},
      {type:'circle', cx:80, cy:240, r:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'circle', cx:240, cy:240, r:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'circle', cx:80, cy:240, r:14, fill:'#5a2e10'},
      {type:'circle', cx:240, cy:240, r:14, fill:'#5a2e10'},
      {type:'rect', x:144, y:128, w:32, h:24, fill:'#caa84a', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:140, r:4, fill:'#2c241a'},
    ],
    sightlines: [
      {x:120, y:60, w:80, h:36},
      {x:32, y:200, w:48, h:80},
    ],
    entry:  { x:40,  y:40  },
    target: { x:160, y:140 },
    exit:   { x:280, y:280 },
    labels: [
      {x:160, y:30, text:'PIPELINE'},
      {x:160, y:140, text:'TICKET'},
      {x:80, y:300, text:'VATS'},
      {x:240, y:300, text:'VATS'},
    ],
  },
  {
    name: 'Casino del Mar — Card Room',
    facility: 'CASINO',
    walls: [
      [0,0,320,16],[0,304,320,16],[0,0,16,320],[304,0,16,320],
      [80,16,16,80],[224,16,16,80],
      [16,180,80,16],[224,180,80,16],
      [140,160,40,16],
    ],
    props: [
      {type:'circle', cx:80, cy:240, r:28, fill:'#3a4a2a', stroke:'#2c241a'},
      {type:'circle', cx:80, cy:240, r:14, fill:'#caa84a'},
      {type:'rect', x:200, y:212, w:80, h:56, fill:'#3a4a2a', stroke:'#2c241a'},
      {type:'rect', x:140, y:40, w:14, h:48, fill:'#caa84a', stroke:'#2c241a'},
      {type:'rect', x:160, y:50, w:14, h:38, fill:'#b22222', stroke:'#2c241a'},
      {type:'rect', x:180, y:60, w:14, h:28, fill:'#1a3a8a', stroke:'#2c241a'},
      {type:'rect', x:140, y:120, w:40, h:30, fill:'#3a3128', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:135, r:5, fill:'#caa84a'},
    ],
    sightlines: [
      {x:32, y:140, w:48, h:60},
      {x:240, y:140, w:48, h:60},
    ],
    entry:  { x:280, y:280 },
    target: { x:160, y:135 },
    exit:   { x:40,  y:50  },
    labels: [
      {x:160, y:30, text:'CHIP TABLE'},
      {x:160, y:115, text:'COUNT'},
      {x:80, y:300, text:'ROULETTE'},
      {x:240, y:300, text:'BLACKJK'},
    ],
  },
];

// ---------- catalog ----------

const ALIASES = [
  'Maestro of the Rear Stairwell',
  'The Lobby Whisperer',
  'The Quiet Intern',
  'Comptroller of Lost Things',
  'Last Honest Locksmith',
  'Vault Tourist',
  'Three-Door Margaret',
  'The Patient Custodian',
  'Tuesday Afternoon Bandit',
  'Hush of the Atrium',
  'The Off-Brand Phantom',
  'Sub-Basement Sociologist',
  'The Reluctant Heir',
  'Director of Discreet Acquisitions',
  'Provost of Loose Hinges',
  'Elevator Fluent',
  'The Kindly Auditor',
  'Pickpocket Laureate',
  'Counsel for the Defense (Disgraced)',
  'Honorary Cousin',
  'The Mayor\'s Other Mayor',
  'Janitorial Liaison',
  'The Off-Hours Concierge',
  'Stairwell Cantor',
  'Sergeant Major of Quiet Things',
  'The Unbothered Notary',
  'Fire Marshal Emeritus',
  'Receptionist of Shadow',
  'The Mild Inheritor',
  'The Insurance Reviewer',
  'Half-Speed Houdini',
  'Pawn Broker by Marriage',
];

const ACCOMPLICES = [
  'Renaldo Brindlemoss — exterior locksmith',
  "Dottie 'No-Knees' Marek — getaway",
  'P. Wesleyan Krupp Jr. — interior optics',
  'Margie Volpé — secondary distraction',
  'Augustus Trell — paperwork forger',
  'Bess Quigley — vibes',
  'Tomas Benesh — radio jammer',
  'Lula Espinal — uniform tailor',
  "Hank 'The Treasurer' Bregman — bookkeeping",
  'Cricket Halloran — backup driver',
  'Wally Sundgren — fire alarm',
  'Ines Tavárez — plumbing pretext',
  "Nora 'Two Sweaters' Lin — courier",
  'Brody Whittlesea — caterwaul',
  'Vera Boroughs — ledger forger',
  "Pete 'No Forwarding Address' Ruiz — wheelman",
  'Floribel Hsu — surveillance loop',
  'Roland Fitch — duct navigator',
  "Jeanine 'Yardstick' McAllister — measurements",
  'Otto Kalashnik — cigar boy',
  'Bex Rylander — pretext caller',
  'Coleman Vyse — sigh deployment',
  'Trudy Imperatore — coat-check accomplice',
  "Manny 'The Statement' Ortiz — alibi",
  'Brick DeLuca — crowbar consultant',
  'Faye Tugwell — lockpick artisan',
  'Norbert Plover — pacing demonstrator',
];

// ---------- hash + RNG ----------

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pickN(arr, seed, n) {
  const used = new Set();
  const out = [];
  let s = seed >>> 0;
  while (out.length < n && used.size < arr.length) {
    s = (Math.imul(s ^ (s >>> 13), 2654435761)) >>> 0;
    const i = s % arr.length;
    if (!used.has(i)) { used.add(i); out.push(arr[i]); }
  }
  return out;
}

// ---------- geometry ----------

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function pathLength(wps) {
  let L = 0;
  for (let i = 0; i < wps.length - 1; i++) L += dist(wps[i], wps[i+1]);
  return L;
}

// Segment vs axis-aligned rectangle intersection (Liang-Barsky-ish).
// Returns true if segment ab passes through the rect (touching counts).
function segmentIntersectsRect(a, b, r) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0, t1 = 1;

  // For each rect edge as a slab: solve `t` range where segment is inside.
  function clip(p, q) {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  }
  if (!clip(-dx, a.x - r.x))           return false; // left edge
  if (!clip( dx, (r.x + r.w) - a.x))   return false; // right edge
  if (!clip(-dy, a.y - r.y))           return false; // top edge
  if (!clip( dy, (r.y + r.h) - a.y))   return false; // bottom edge
  return t1 >= t0;
}

// Walls are stored as [x, y, w, h]. Convert to {x,y,w,h} for the same test.
function wallRect(w) { return { x: w[0], y: w[1], w: w[2], h: w[3] }; }

// Is endpoint `p` inside any wall? (used to forbid placing a waypoint on a wall)
function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// Inflate the wall slightly so a waypoint placed RIGHT on a wall edge
// doesn't accidentally count the next segment as "wall-crossing on entry."
function inflate(r, pad) {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

// ---------- live leg checking ----------

function legViolations(a, b, plan) {
  // Returns list of strings naming each violation on this leg.
  const v = [];
  // wall blocks
  for (const w of plan.walls) {
    // Skip the four outer-perimeter walls — endpoints can sit against them
    // (entry on a perimeter, etc.) without "crossing" being meaningful.
    const isPerimeter =
      (w[0] === 0 && w[1] === 0 && w[2] === 320) ||  // top
      (w[0] === 0 && w[1] === 304) ||                // bottom
      (w[0] === 0 && w[1] === 0 && w[3] === 320) ||  // left
      (w[0] === 304);                                // right
    const r = wallRect(w);
    // If either endpoint is inside the wall, that's a clear violation;
    // otherwise check segment intersection with a slightly-deflated rect
    // so a leg that grazes a wall edge isn't reported.
    if (pointInRect(a, r) || pointInRect(b, r)) {
      if (!isPerimeter) v.push('wall');
      continue;
    }
    if (isPerimeter) continue;
    const inner = inflate(r, -1);
    if (inner.w > 0 && inner.h > 0 && segmentIntersectsRect(a, b, inner)) {
      v.push('wall');
    }
  }
  // sight-lines
  for (const s of plan.sightlines) {
    if (segmentIntersectsRect(a, b, s)) v.push('sight');
  }
  return v;
}

function evaluateRoute(wps, plan) {
  // wps[0] is entry. Each leg checked independently. Returns:
  //   legs:        [{ from, to, violations: [] }]
  //   visitedTarget, reachedExit: bool
  //   anyViolation: bool
  //   length: total px
  const legs = [];
  let visitedTarget = dist(wps[0], plan.target) <= RADIUS_TARGET;
  let reachedExit = false;
  for (let i = 0; i < wps.length - 1; i++) {
    const v = legViolations(wps[i], wps[i+1], plan);
    legs.push({ from: wps[i], to: wps[i+1], violations: v });
  }
  for (let i = 1; i < wps.length; i++) {
    if (dist(wps[i], plan.target) <= RADIUS_TARGET) visitedTarget = true;
  }
  if (wps.length > 0) {
    reachedExit = dist(wps[wps.length - 1], plan.exit) <= RADIUS_EXIT;
  }
  const anyViolation = legs.some(l => l.violations.length > 0);
  return {
    legs,
    visitedTarget,
    reachedExit,
    anyViolation,
    length: pathLength(wps)
  };
}

// ---------- floor rendering ----------

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderFloor(svg, plan) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // background
  svg.appendChild(svgEl('rect', {x:0, y:0, width:320, height:320, fill:'#e8d8a8'}));

  // tile grid (subtle)
  for (let i = 0; i <= 320; i += 20) {
    svg.appendChild(svgEl('line', {x1:i, y1:0, x2:i, y2:320, stroke:'#c9b88a', 'stroke-width':1}));
    svg.appendChild(svgEl('line', {x1:0, y1:i, x2:320, y2:i, stroke:'#c9b88a', 'stroke-width':1}));
  }

  // sight-lines (vision zones)
  plan.sightlines.forEach(g => {
    svg.appendChild(svgEl('rect', {
      x:g.x, y:g.y, width:g.w, height:g.h,
      fill:'#b22222', 'fill-opacity':0.18,
    }));
    // hatched cross-pattern using inline lines so it reads as "vision/danger"
    for (let yy = g.y + 4; yy < g.y + g.h; yy += 6) {
      svg.appendChild(svgEl('line', {
        x1: g.x, y1: yy, x2: g.x + g.w, y2: yy,
        stroke: '#b22222', 'stroke-width': 1, 'stroke-opacity': 0.35
      }));
    }
    // pixel "eye" badge in corner
    svg.appendChild(svgEl('rect', {
      x:g.x+4, y:g.y+4, width:14, height:14, fill:'#b22222'
    }));
    const t = svgEl('text', {
      x:g.x+11, y:g.y+15,
      'text-anchor':'middle',
      'font-family':'Press Start 2P, monospace',
      'font-size':'8',
      fill:'#f1e7d1',
    });
    t.textContent = '◉';
    svg.appendChild(t);
  });

  // walls
  plan.walls.forEach(w => {
    svg.appendChild(svgEl('rect', {x:w[0], y:w[1], width:w[2], height:w[3], fill:'#2c241a'}));
  });

  // props
  plan.props.forEach(p => {
    if (p.type === 'rect') {
      svg.appendChild(svgEl('rect', {
        x:p.x, y:p.y, width:p.w, height:p.h,
        fill:p.fill, stroke:p.stroke || 'none', 'stroke-width': p.stroke ? 2 : 0
      }));
    } else if (p.type === 'circle') {
      svg.appendChild(svgEl('circle', {
        cx:p.cx, cy:p.cy, r:p.r,
        fill:p.fill, stroke:p.stroke || 'none', 'stroke-width': p.stroke ? 2 : 0
      }));
    }
  });

  // labels
  (plan.labels || []).forEach(l => {
    const t = svgEl('text', {
      x:l.x, y:l.y,
      'text-anchor':'middle',
      'font-family':'Press Start 2P, monospace',
      'font-size':'7',
      fill:'#3a3128',
    });
    t.textContent = l.text;
    svg.appendChild(t);
  });

  // ENTRY / TARGET / EXIT nodes — drawn LAST so the route can sit under markers
  drawNode(svg, plan.entry,  { glyph: 'A', color: '#1f6b3a' });  // green entry
  drawNode(svg, plan.target, { glyph: '★', color: '#caa84a', halo: RADIUS_TARGET });  // gold target
  drawNode(svg, plan.exit,   { glyph: 'Z', color: '#1a3a8a', halo: RADIUS_EXIT  });   // blue exit
}

function drawNode(svg, p, opts) {
  // halo (faint ring) so the player sees the target/exit's snap-radius
  if (opts.halo) {
    svg.appendChild(svgEl('circle', {
      cx: p.x, cy: p.y, r: opts.halo,
      fill: opts.color, 'fill-opacity': 0.16,
      stroke: opts.color, 'stroke-opacity': 0.35, 'stroke-dasharray': '3,3'
    }));
  }
  svg.appendChild(svgEl('rect', {
    x: p.x - 12, y: p.y - 12, width: 24, height: 24,
    fill: opts.color, stroke: '#2c241a', 'stroke-width': 2
  }));
  const t = svgEl('text', {
    x: p.x, y: p.y + 5,
    'text-anchor': 'middle',
    'font-family': 'Press Start 2P, monospace',
    'font-size': '12',
    fill: '#f1e7d1'
  });
  t.textContent = opts.glyph;
  svg.appendChild(t);
}

function renderRoute(svg, wps, plan) {
  // Remove any existing route overlay
  svg.querySelectorAll('.route-overlay').forEach(n => n.remove());
  if (wps.length < 2) return;

  const evalResult = evaluateRoute(wps, plan);

  // Draw each leg in green or red based on per-leg violations
  evalResult.legs.forEach(leg => {
    const isBad = leg.violations.length > 0;
    svg.appendChild(svgEl('line', {
      x1: leg.from.x, y1: leg.from.y, x2: leg.to.x, y2: leg.to.y,
      stroke: isBad ? '#b22222' : '#1f6b3a',
      'stroke-width': 3,
      'stroke-dasharray': isBad ? '4,3' : '0',
      'stroke-linecap': 'round',
      class: 'route-overlay'
    }));
  });

  // Number each user-placed waypoint (skip the entry, which already shows "A")
  for (let i = 1; i < wps.length; i++) {
    const w = wps[i];
    // Don't double-draw if this waypoint coincides with the target/exit node
    const onTarget = dist(w, plan.target) <= 6;
    const onExit   = dist(w, plan.exit)   <= 6;
    if (onTarget || onExit) continue;

    const g = svgEl('g', { class: 'route-overlay' });
    g.appendChild(svgEl('circle', {
      cx: w.x, cy: w.y, r: 9,
      fill: '#f1e7d1', stroke: '#2c241a', 'stroke-width': 2
    }));
    const t = svgEl('text', {
      x: w.x, y: w.y + 4,
      'text-anchor': 'middle',
      'font-family': 'Press Start 2P, monospace',
      'font-size': '9',
      fill: '#2c241a'
    });
    t.textContent = String(i);
    g.appendChild(t);
    svg.appendChild(g);
  }
}

// ---------- click → add waypoint ----------

let waypoints = [];   // first entry is plan.entry (auto-pushed)
let currentPlan = null;

function svgCoordsFromEvent(svg, evt) {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  let clientX, clientY;
  if (evt.touches && evt.touches.length) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else if (evt.changedTouches && evt.changedTouches.length) {
    clientX = evt.changedTouches[0].clientX;
    clientY = evt.changedTouches[0].clientY;
  } else {
    clientX = evt.clientX; clientY = evt.clientY;
  }
  const x = ((clientX - rect.left) / rect.width) * vb.width;
  const y = ((clientY - rect.top) / rect.height) * vb.height;
  return {
    x: Math.max(20, Math.min(300, Math.round(x / 5) * 5)),
    y: Math.max(20, Math.min(300, Math.round(y / 5) * 5)),
  };
}

function handleClick(evt) {
  evt.preventDefault();
  if (!currentPlan) return;
  if (waypoints.length - 1 >= MAX_WAYPOINTS) return; // leg cap

  let p = svgCoordsFromEvent(document.getElementById('floor'), evt);

  // Snap-to-target / snap-to-exit if click lands inside the halo
  if (dist(p, currentPlan.target) <= RADIUS_TARGET) p = { ...currentPlan.target };
  else if (dist(p, currentPlan.exit) <= RADIUS_EXIT) p = { ...currentPlan.exit };

  // Reject placing a waypoint inside a wall (gives confusing legs)
  for (const w of currentPlan.walls) {
    const r = wallRect(w);
    // ignore the perimeter walls
    if (r.x === 0 && r.y === 0 && r.w === 320) continue;
    if (r.x === 0 && r.y === 304) continue;
    if (r.x === 0 && r.y === 0 && r.h === 320) continue;
    if (r.x === 304) continue;
    if (pointInRect(p, r)) {
      flashStatus('cannot drop a waypoint inside a wall');
      return;
    }
  }

  waypoints.push(p);
  redraw();
}

function redraw() {
  if (!currentPlan) return;
  const svg = document.getElementById('floor');
  renderRoute(svg, waypoints, currentPlan);
  refreshHud();
}

function refreshHud() {
  const ev = evaluateRoute(waypoints, currentPlan);
  const legs = waypoints.length - 1;

  // status pills
  setPill('status-target', 'TARGET', ev.visitedTarget ? '✓' : '○', ev.visitedTarget);
  setPill('status-exit',   'EXIT',   ev.reachedExit  ? '✓' : '○', ev.reachedExit);
  setPill('status-legs',   'LEGS',   String(legs), false);

  // next-slot prompt
  const slot = document.getElementById('next-slot');
  if (legs === 0) {
    slot.innerHTML = 'TAP THE FLOOR TO PLOT YOUR FIRST LEG';
  } else if (ev.anyViolation) {
    const lastBad = ev.legs.filter(l => l.violations.length).slice(-1)[0];
    const what = lastBad.violations.includes('wall') ? 'a wall' : 'a guard sight-line';
    slot.innerHTML = `LAST LEG SPOTTED — crossed ${what}. Try <strong>UNDO</strong> and route around.`;
  } else if (!ev.visitedTarget) {
    slot.innerHTML = 'NEXT: route to the <strong>TARGET ★</strong>';
  } else if (!ev.reachedExit) {
    slot.innerHTML = 'GOT THE TARGET. Now make for the <strong>EXIT Z</strong>';
  } else {
    slot.innerHTML = 'ROUTE COMPLETE — <strong>FILE REPORT</strong>';
  }

  // FILE REPORT enabled iff we visited target AND reached exit AND no violations
  const canFile = ev.visitedTarget && ev.reachedExit && !ev.anyViolation;
  document.getElementById('file-btn').disabled = !canFile;
  // Even if violations exist you can still file a botched dossier — but only
  // after you've made it to the exit. This keeps the user from filing nothing.
  if (!canFile && ev.reachedExit) {
    document.getElementById('file-btn').disabled = false;
  }

  document.getElementById('undo-btn').disabled = waypoints.length <= 1;
}

function setPill(id, label, value, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `${label} <span>${value}</span>`;
  el.classList.toggle('pill-ok', !!ok);
}

function flashStatus(msg) {
  const el = document.getElementById('next-slot');
  const prev = el.innerHTML;
  el.innerHTML = `<span style="color:#b22222;">${msg}</span>`;
  setTimeout(refreshHud, 1800);
}

function undoWaypoint() {
  if (waypoints.length <= 1) return;
  waypoints.pop();
  redraw();
}

function resetWaypoints() {
  waypoints = currentPlan ? [{ ...currentPlan.entry }] : [];
  redraw();
}

// ---------- dossier scoring ----------

function paces(L) { return Math.round(L * 0.25); }
function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }

function buildDossier(wps, plan) {
  const seedStr = wps.map(w => w.x + ',' + w.y).join('|') + '|' + plan.facility;
  const seed = hashStr(seedStr);
  const ev = evaluateRoute(wps, plan);
  const legs = wps.length - 1;
  const wallHits  = ev.legs.reduce((s, l) => s + l.violations.filter(v => v === 'wall').length,  0);
  const sightHits = ev.legs.reduce((s, l) => s + l.violations.filter(v => v === 'sight').length, 0);

  // Verdict — fully determined by the rules the user can see on the board.
  let verdict;
  if (!ev.visitedTarget || !ev.reachedExit || ev.anyViolation) {
    verdict = 'BOTCHED';
  } else if (legs <= 3) {
    verdict = 'LEGENDARY';      // direct route, fewest possible legs
  } else if (legs <= 5) {
    verdict = 'CLEAN';
  } else {
    verdict = 'CLEAN';          // many legs but still clean — Bureau still files it
  }

  // loot
  const baseHaul = Math.floor(ev.length * 1700) + ((seed % 350000) + 50000);
  let loot;
  if (verdict === 'LEGENDARY') loot = baseHaul * 4 + 1000000;
  else if (verdict === 'BOTCHED') loot = Math.max(0, Math.floor(baseHaul * 0.10));
  else loot = baseHaul;
  loot = Math.round(loot / 10) * 10;

  // alias + accomplices
  const alias = ALIASES[seed % ALIASES.length];
  const accs  = pickN(ACCOMPLICES, seed ^ 0x9e3779b9, 3);

  // legible assessment that names what actually happened
  const paceCount = paces(ev.length);
  const bits = [];
  bits.push(`Route ran ${paceCount} paces across ${legs} ${legs === 1 ? 'leg' : 'legs'}`);
  if (sightHits > 0) bits.push(`tripped ${sightHits} guard sight-line${sightHits > 1 ? 's' : ''}`);
  if (wallHits  > 0) bits.push(`forced ${wallHits} wall crossing${wallHits > 1 ? 's' : ''}`);
  if (!ev.visitedTarget) bits.push('the target was never reached');
  if (!ev.reachedExit)   bits.push('the operative did not reach the exit');
  let tone;
  if (verdict === 'LEGENDARY') tone = 'the Bureau is reluctantly impressed';
  else if (verdict === 'BOTCHED') tone = 'the Bureau finds this regrettable';
  else tone = 'the Bureau finds this... acceptable';
  const assessment = bits.join('; ') + '. ' + tone + '.';

  const caseNo = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);

  return { verdict, loot, alias, accs, assessment, caseNo, paceCount, legs, sightHits, wallHits };
}

// ---------- screens ----------

function showPlot() {
  document.getElementById('plotter-screen').classList.remove('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('report-screen').classList.add('hidden');
}
function showLoading() {
  document.getElementById('plotter-screen').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
  document.getElementById('report-screen').classList.add('hidden');
}
function showReport() {
  document.getElementById('plotter-screen').classList.add('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('report-screen').classList.remove('hidden');
}

function renderReport(wps, plan) {
  const d = buildDossier(wps, plan);

  const exSvg = document.getElementById('exhibit-svg');
  renderFloor(exSvg, plan);
  renderRoute(exSvg, wps, plan);

  document.getElementById('alias-value').textContent = d.alias;
  document.getElementById('case-no').textContent = 'CASE FILE NO. ' + d.caseNo;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'2-digit' }).toUpperCase();
  document.getElementById('case-date').textContent = dateStr;

  document.getElementById('haul-value').textContent = fmtMoney(d.loot);

  const list = document.getElementById('accomplice-list');
  list.innerHTML = '';
  d.accs.forEach(a => {
    const li = document.createElement('li');
    li.textContent = a;
    list.appendChild(li);
  });

  document.getElementById('assessment-text').textContent = d.assessment;

  let caption;
  if (d.verdict === 'LEGENDARY') caption = 'Filed by hand. Recommended for the framed wall.';
  else if (d.verdict === 'BOTCHED') caption = 'Filed under "case studies — what not to do."';
  else caption = 'Submitted in triplicate. Carbon to the broom closet.';
  document.getElementById('exhibit-caption').textContent = caption;

  const stamp = document.getElementById('verdict-stamp');
  stamp.textContent = 'CASE: ' + d.verdict;
  stamp.classList.remove('legendary', 'botched');
  if (d.verdict === 'LEGENDARY') stamp.classList.add('legendary');
  if (d.verdict === 'BOTCHED')   stamp.classList.add('botched');
}

// ---------- url state ----------
// New format `g<idx>:x1,y1;x2,y2;...` so legacy `f...` share-links from v1 are
// ignored (the v1 format had no entry/target/exit semantics).

function encodeWaypoints(wps, planIndex) {
  return 'g' + planIndex + ':' + wps.map(w => w.x + ',' + w.y).join(';');
}
function decodeWaypoints(hash) {
  if (!hash) return null;
  const m = hash.match(/^#?g(\d+):(.+)$/);
  if (!m) return null;
  const idx = parseInt(m[1], 10);
  if (!FLOOR_PLANS[idx]) return null;
  const parts = m[2].split(';');
  const wps = parts.map(p => {
    const [x, y] = p.split(',').map(n => parseInt(n, 10));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  });
  if (wps.some(w => !w) || wps.length < 2) return null;
  return { planIndex: idx, waypoints: wps };
}

function todayPlanIndex() {
  const d = new Date();
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor(utc / 86400000) % FLOOR_PLANS.length;
}

// ---------- file report flow ----------

function fileReport() {
  if (waypoints.length < 2) { flashStatus('plot at least one leg first'); return; }
  const planIndex = FLOOR_PLANS.indexOf(currentPlan);
  history.replaceState(null, '', '#' + encodeWaypoints(waypoints, planIndex));
  showLoading();
  setTimeout(() => {
    renderReport(waypoints, currentPlan);
    showReport();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 1100);
}

// ---------- share ----------

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Dossier link copied — pass it to a collaborator.'))
      .catch(() => prompt('Copy your dossier link:', location.href));
  } else {
    prompt('Copy your dossier link:', location.href);
  }
}

// ---------- init ----------

function init() {
  const incoming = decodeWaypoints(location.hash);
  if (incoming) {
    currentPlan = FLOOR_PLANS[incoming.planIndex];
    waypoints = incoming.waypoints.slice();
    document.getElementById('floor-label').textContent = 'FACILITY: ' + currentPlan.name;
    renderFloor(document.getElementById('floor'), currentPlan);
    redraw();
    setTimeout(() => {
      renderReport(waypoints, currentPlan);
      showReport();
    }, 100);
  } else {
    const idx = todayPlanIndex();
    currentPlan = FLOOR_PLANS[idx];
    document.getElementById('floor-label').textContent = 'FACILITY: ' + currentPlan.name;
    renderFloor(document.getElementById('floor'), currentPlan);
    waypoints = [{ ...currentPlan.entry }];
    redraw();
  }

  const floor = document.getElementById('floor');
  floor.addEventListener('click', handleClick);

  document.getElementById('reset-btn').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    resetWaypoints();
  });
  document.getElementById('undo-btn').addEventListener('click', undoWaypoint);
  document.getElementById('file-btn').addEventListener('click', fileReport);
  document.getElementById('replot-btn').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    resetWaypoints();
    showPlot();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
