/* Heist Plotter — Bureau of Notable Capers
   Path-as-input mock heist after-action generator.
   Fully deterministic from waypoint coords. */

// ---------- floor plans ----------
// 320x320 viewBox. Each plan is a tile grid (16x16 cells of 20px), with:
//   - walls (gray rects)
//   - rooms (cream)
//   - guard zones (red-tint rects, used in scoring)
//   - decorative pixel-art props (vault, fountain, etc.)

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
    rooms: [
      [16,16,288,288],
    ],
    props: [
      // vault door
      {type:'rect', x:140, y:140, w:40, h:40, fill:'#7a6957', stroke:'#2c241a'},
      {type:'rect', x:148, y:148, w:24, h:24, fill:'#c9b88a', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:160, r:5, fill:'#2c241a'},
      // chunky teller cages (top)
      {type:'rect', x:40, y:40, w:32, h:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'rect', x:248, y:40, w:32, h:24, fill:'#a89770', stroke:'#2c241a'},
    ],
    guards: [
      {x:32, y:200, w:48, h:48},
      {x:240, y:200, w:48, h:48},
      {x:128, y:240, w:64, h:48},
    ],
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
    rooms: [],
    props: [
      // pool
      {type:'rect', x:32, y:32, w:80, h:88, fill:'#5a8aa8', stroke:'#2c241a'},
      {type:'rect', x:36, y:36, w:72, h:80, fill:'#7ab0d0'},
      // safe in bedroom
      {type:'rect', x:240, y:200, w:40, h:30, fill:'#3a3128', stroke:'#2c241a'},
      {type:'circle', cx:260, cy:215, r:4, fill:'#c9b88a'},
      // grand piano
      {type:'rect', x:200, y:36, w:64, h:80, fill:'#1a1612', stroke:'#2c241a'},
      {type:'rect', x:208, y:44, w:48, h:64, fill:'#2c241a'},
    ],
    guards: [
      {x:140, y:48, w:48, h:64},
      {x:32, y:240, w:60, h:48},
      {x:230, y:260, w:60, h:36},
    ],
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
    rooms: [],
    props: [
      // pedestal w/ jewel (center)
      {type:'rect', x:144, y:140, w:32, h:32, fill:'#a89770', stroke:'#2c241a'},
      {type:'rect', x:152, y:148, w:16, h:16, fill:'#3a8a5a'},
      {type:'rect', x:154, y:150, w:6, h:6, fill:'#9bf0c0'},
      // statues (corners of north wing)
      {type:'rect', x:40, y:40, w:24, h:48, fill:'#c9b88a', stroke:'#2c241a'},
      {type:'rect', x:256, y:40, w:24, h:48, fill:'#c9b88a', stroke:'#2c241a'},
      // benches
      {type:'rect', x:40, y:240, w:48, h:8, fill:'#6b3a1f'},
      {type:'rect', x:232, y:240, w:48, h:8, fill:'#6b3a1f'},
    ],
    guards: [
      {x:32, y:120, w:60, h:60},
      {x:228, y:120, w:60, h:60},
      {x:130, y:240, w:60, h:48},
    ],
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
    rooms: [],
    props: [
      // chocolate river (snake)
      {type:'rect', x:32, y:40, w:256, h:16, fill:'#5a2e10'},
      {type:'rect', x:32, y:56, w:16, h:60, fill:'#5a2e10'},
      {type:'rect', x:48, y:100, w:240, h:16, fill:'#5a2e10'},
      // mixing vats
      {type:'circle', cx:80, cy:240, r:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'circle', cx:240, cy:240, r:24, fill:'#a89770', stroke:'#2c241a'},
      {type:'circle', cx:80, cy:240, r:14, fill:'#5a2e10'},
      {type:'circle', cx:240, cy:240, r:14, fill:'#5a2e10'},
      // golden ticket safe
      {type:'rect', x:144, y:128, w:32, h:24, fill:'#caa84a', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:140, r:4, fill:'#2c241a'},
    ],
    guards: [
      {x:120, y:40, w:80, h:48},
      {x:32, y:200, w:48, h:80},
      {x:240, y:200, w:48, h:80},
    ],
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
    rooms: [],
    props: [
      // roulette
      {type:'circle', cx:80, cy:240, r:28, fill:'#3a4a2a', stroke:'#2c241a'},
      {type:'circle', cx:80, cy:240, r:14, fill:'#caa84a'},
      // blackjack felt
      {type:'rect', x:200, y:212, w:80, h:56, fill:'#3a4a2a', stroke:'#2c241a'},
      // chip stacks
      {type:'rect', x:140, y:40, w:14, h:48, fill:'#caa84a', stroke:'#2c241a'},
      {type:'rect', x:160, y:50, w:14, h:38, fill:'#b22222', stroke:'#2c241a'},
      {type:'rect', x:180, y:60, w:14, h:28, fill:'#1a3a8a', stroke:'#2c241a'},
      // count room safe
      {type:'rect', x:140, y:120, w:40, h:30, fill:'#3a3128', stroke:'#2c241a'},
      {type:'circle', cx:160, cy:135, r:5, fill:'#caa84a'},
    ],
    guards: [
      {x:32, y:140, w:48, h:60},
      {x:240, y:140, w:48, h:60},
      {x:140, y:240, w:60, h:48},
    ],
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
  'The Cadastral Whisperer',
  'Master of the Velvet Rope',
  'Suspended Substitute Teacher',
  'The Gentle Cartographer',
  'Custodian of the Brass Tag',
  'The Returning Customer',
  'Permitted Loiterer',
  'The Twice-Forgotten Niece',
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
  "Sister Theresa Goldman — moral cover",
  'Brick DeLuca — crowbar consultant',
  'Lavinia Mooney-Coetzee — interior design',
  'Casper Yelm — handler',
  'Faye Tugwell — lockpick artisan',
  'Norbert Plover — pacing demonstrator',
];

// ---------- hash ----------

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pickN(arr, seed, n) {
  // deterministic non-repeating pick of n items
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

// ---------- floor plan rendering ----------

function getTodayFloor() {
  const d = new Date();
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dayIndex = Math.floor(utc / 86400000);
  return FLOOR_PLANS[dayIndex % FLOOR_PLANS.length];
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderFloor(svg, plan, opts) {
  opts = opts || {};
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // background floor (cream tile texture)
  svg.appendChild(svgEl('rect', {x:0, y:0, width:320, height:320, fill:'#e8d8a8'}));

  // tile grid (subtle)
  for (let i = 0; i <= 320; i += 20) {
    svg.appendChild(svgEl('line', {x1:i, y1:0, x2:i, y2:320, stroke:'#c9b88a', 'stroke-width':1}));
    svg.appendChild(svgEl('line', {x1:0, y1:i, x2:320, y2:i, stroke:'#c9b88a', 'stroke-width':1}));
  }

  // guard zones (subtle red shading)
  plan.guards.forEach(g => {
    svg.appendChild(svgEl('rect', {
      x:g.x, y:g.y, width:g.w, height:g.h,
      fill:'#b22222', 'fill-opacity':0.18,
    }));
    // pixel "G" badge in corner
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
    t.textContent = 'G';
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
}

function renderWaypoints(svg, waypoints) {
  // remove old waypoints/path
  svg.querySelectorAll('.wp-overlay').forEach(n => n.remove());

  // path lines (dotted red between consecutive waypoints)
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i+1];
    const ln = svgEl('line', {
      x1:a.x, y1:a.y, x2:b.x, y2:b.y,
      stroke:'#b22222', 'stroke-width':3, 'stroke-dasharray':'5,4',
      class:'wp-overlay'
    });
    svg.appendChild(ln);
  }

  // markers
  waypoints.forEach((w, i) => {
    const g = svgEl('g', {class:'wp-overlay'});
    g.appendChild(svgEl('rect', {
      x:w.x-12, y:w.y-12, width:24, height:24,
      fill:'#b22222', stroke:'#2c241a', 'stroke-width':2
    }));
    const t = svgEl('text', {
      x:w.x, y:w.y+5,
      'text-anchor':'middle',
      'font-family':'Press Start 2P, monospace',
      'font-size':'12',
      fill:'#f1e7d1',
    });
    t.textContent = String(i+1);
    g.appendChild(t);
    svg.appendChild(g);
  });
}

// ---------- click handling ----------

const SLOT_LABELS = ['ENTRY','DISTRACTION','TARGET','SWITCH-BACK','EXFIL'];

let waypoints = [];
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
  // snap to 5px grid for crispness + URL stability
  return {
    x: Math.max(20, Math.min(300, Math.round(x / 5) * 5)),
    y: Math.max(20, Math.min(300, Math.round(y / 5) * 5)),
  };
}

function handleClick(evt) {
  if (waypoints.length >= 5) return;
  evt.preventDefault();
  const p = svgCoordsFromEvent(document.getElementById('floor'), evt);
  waypoints.push(p);
  renderWaypoints(document.getElementById('floor'), waypoints);
  updateNextSlot();
  if (waypoints.length === 5) {
    document.getElementById('file-btn').disabled = false;
  }
}

function updateNextSlot() {
  const el = document.getElementById('next-slot');
  if (waypoints.length >= 5) {
    el.innerHTML = 'ROUTE COMPLETE — <strong>FILE REPORT</strong>';
  } else {
    const nxt = waypoints.length + 1;
    el.innerHTML = 'NEXT MARK: <strong>' + nxt + ' — ' + SLOT_LABELS[waypoints.length] + '</strong>';
  }
}

function resetWaypoints() {
  waypoints = [];
  renderWaypoints(document.getElementById('floor'), waypoints);
  updateNextSlot();
  document.getElementById('file-btn').disabled = true;
}

// ---------- scoring ----------

function dist(a, b) { return Math.hypot(a.x-b.x, a.y-b.y); }

function pathLength(wps) {
  let L = 0;
  for (let i = 0; i < wps.length-1; i++) L += dist(wps[i], wps[i+1]);
  return L;
}

function segIntersects(a, b, c, d) {
  // returns true if segment ab and cd intersect (no endpoint share)
  function ccw(p, q, r) { return (r.y-p.y) * (q.x-p.x) > (q.y-p.y) * (r.x-p.x); }
  if (a===c||a===d||b===c||b===d) return false;
  return ccw(a,c,d) !== ccw(b,c,d) && ccw(a,b,c) !== ccw(a,b,d);
}

function crossings(wps) {
  let n = 0;
  for (let i = 0; i < wps.length-1; i++) {
    for (let j = i+2; j < wps.length-1; j++) {
      if (segIntersects(wps[i], wps[i+1], wps[j], wps[j+1])) n++;
    }
  }
  return n;
}

function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h;
}

function segmentInGuard(a, b, g) {
  // sample 12 points along segment, check if any is inside guard zone
  for (let t = 0; t <= 1; t += 1/12) {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= g.x && x <= g.x+g.w && y >= g.y && y <= g.y+g.h) return true;
  }
  return false;
}

function guardPasses(wps, plan) {
  let n = 0;
  for (let i = 0; i < wps.length-1; i++) {
    plan.guards.forEach(g => {
      if (segmentInGuard(wps[i], wps[i+1], g)) n++;
    });
  }
  return n;
}

function paces(L) {
  // 320px ≈ 80 paces of stride
  return Math.round(L * 0.25);
}

function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US');
}

// ---------- dossier generation ----------

function buildDossier(wps, plan) {
  const seedStr = wps.map(w => w.x + ',' + w.y).join('|') + '|' + plan.facility;
  const seed = hashStr(seedStr);
  const L = pathLength(wps);
  const X = crossings(wps);
  const G = guardPasses(wps, plan);

  // verdict logic
  // CLEAN: low guards, low crossings
  // BOTCHED: high guards (>=3) or many crossings (>=2)
  // LEGENDARY: rare combo of long path + zero guards + zero crossings
  let verdict = 'CLEAN';
  if (G >= 3 || X >= 3) verdict = 'BOTCHED';
  if (G === 0 && X === 0 && L > 600) verdict = 'LEGENDARY';
  if (G === 0 && X <= 1 && L > 800) verdict = 'LEGENDARY';

  // loot scaling
  const baseHaul = Math.floor(L * 1700) + ((seed % 350000) + 50000);
  let loot;
  if (verdict === 'LEGENDARY') loot = baseHaul * 4 + 1000000;
  else if (verdict === 'BOTCHED') loot = Math.floor(baseHaul * 0.18);
  else loot = baseHaul;
  loot = Math.round(loot / 10) * 10;

  // alias and accomplices
  const alias = ALIASES[seed % ALIASES.length];
  const accs = pickN(ACCOMPLICES, seed ^ 0x9e3779b9, 3);

  // assessment line — references actual metrics
  const paceCount = paces(L);
  let assessmentTone;
  if (verdict === 'LEGENDARY') {
    assessmentTone = "the Bureau is reluctantly impressed";
  } else if (verdict === 'BOTCHED') {
    assessmentTone = "the Bureau finds this regrettable";
  } else {
    assessmentTone = "the Bureau finds this... acceptable";
  }
  const guardPhrase = G === 0
    ? 'no detected proximity to security'
    : G === 1
      ? 'one close pass with a patrol'
      : G + ' close passes with security';
  const crossPhrase = X === 0
    ? 'no doubled-back segments'
    : X === 1
      ? 'one self-crossing maneuver'
      : X + ' self-crossing maneuvers';
  const assessment = 'Route length ' + paceCount + ' paces, ' + guardPhrase + ', ' + crossPhrase + '. ' + assessmentTone + '.';

  // case file no — short hex
  const caseNo = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);

  return { verdict, loot, alias, accs, assessment, caseNo, paceCount, G, X, L };
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

  // exhibit svg — re-render the floor and overlay path
  const exSvg = document.getElementById('exhibit-svg');
  renderFloor(exSvg, plan);
  renderWaypoints(exSvg, wps);

  // alias + caseNo + date
  document.getElementById('alias-value').textContent = d.alias;
  document.getElementById('case-no').textContent = 'CASE FILE NO. ' + d.caseNo;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'2-digit' }).toUpperCase();
  document.getElementById('case-date').textContent = dateStr;

  // haul
  document.getElementById('haul-value').textContent = fmtMoney(d.loot);

  // accomplices
  const list = document.getElementById('accomplice-list');
  list.innerHTML = '';
  d.accs.forEach(a => {
    const li = document.createElement('li');
    li.textContent = a;
    list.appendChild(li);
  });

  // assessment
  document.getElementById('assessment-text').textContent = d.assessment;

  // exhibit caption — mood line referencing actual metrics
  let caption;
  if (d.verdict === 'LEGENDARY') {
    caption = 'Filed by hand. Recommended for the framed wall.';
  } else if (d.verdict === 'BOTCHED') {
    caption = 'Filed under "case studies — what not to do."';
  } else {
    caption = 'Submitted in triplicate. Carbon to the broom closet.';
  }
  document.getElementById('exhibit-caption').textContent = caption;

  // verdict stamp
  const stamp = document.getElementById('verdict-stamp');
  stamp.textContent = 'CASE: ' + d.verdict;
  stamp.classList.remove('legendary', 'botched');
  if (d.verdict === 'LEGENDARY') stamp.classList.add('legendary');
  if (d.verdict === 'BOTCHED') stamp.classList.add('botched');
}

// ---------- url state ----------

function encodeWaypoints(wps, planIndex) {
  // f<planIndex>:x1,y1;x2,y2;...
  return 'f' + planIndex + ':' + wps.map(w => w.x + ',' + w.y).join(';');
}

function decodeWaypoints(hash) {
  if (!hash) return null;
  const m = hash.match(/^#?f(\d+):(.+)$/);
  if (!m) return null;
  const idx = parseInt(m[1], 10);
  if (!FLOOR_PLANS[idx]) return null;
  const parts = m[2].split(';');
  if (parts.length !== 5) return null;
  const wps = parts.map(p => {
    const [x, y] = p.split(',').map(n => parseInt(n, 10));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  });
  if (wps.some(w => !w)) return null;
  return { planIndex: idx, waypoints: wps };
}

function todayPlanIndex() {
  const d = new Date();
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor(utc / 86400000) % FLOOR_PLANS.length;
}

// ---------- file report flow ----------

function fileReport() {
  if (waypoints.length !== 5) {
    showError('the Bureau requires a complete operational sequence — please mark all five waypoints');
    return;
  }
  const planIndex = FLOOR_PLANS.indexOf(currentPlan);
  // update url so this is shareable / back-button-able
  history.replaceState(null, '', '#' + encodeWaypoints(waypoints, planIndex));
  showLoading();
  setTimeout(() => {
    renderReport(waypoints, currentPlan);
    showReport();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 1200);
}

function showError(msg) {
  const el = document.getElementById('next-slot');
  const prev = el.innerHTML;
  el.innerHTML = '<span style="color:#b22222;font-family:Press Start 2P,monospace;font-size:10px;">' + msg + '</span>';
  setTimeout(() => { updateNextSlot(); }, 3500);
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
    renderWaypoints(document.getElementById('floor'), waypoints);
    document.getElementById('file-btn').disabled = false;
    updateNextSlot();
    // auto-show report on load when arriving from a share link
    setTimeout(() => {
      renderReport(waypoints, currentPlan);
      showReport();
    }, 100);
  } else {
    const idx = todayPlanIndex();
    currentPlan = FLOOR_PLANS[idx];
    document.getElementById('floor-label').textContent = 'FACILITY: ' + currentPlan.name;
    renderFloor(document.getElementById('floor'), currentPlan);
    updateNextSlot();
  }

  const floor = document.getElementById('floor');
  floor.addEventListener('click', handleClick);

  document.getElementById('reset-btn').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    resetWaypoints();
  });
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
