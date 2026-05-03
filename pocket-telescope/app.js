// Pocket Telescope — pure-client ephemeris + 12 historical eyepiece lenses.
// All celestial computation is local (Meeus low-precision); no API calls.
// Permalink (?lat&lon&obj&lens) IS the share — same params, same view, forever.

// ============================================================================
// 1. Ephemeris primitives (Meeus, Astronomical Algorithms — low-precision set)
// ============================================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function julianDay(date) {
  // Meeus Eq. 7.1
  let Y = date.getUTCFullYear();
  let M = date.getUTCMonth() + 1;
  const D = date.getUTCDate()
    + (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716))
    + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}

function gmst(jd) {
  // Meeus Eq. 12.4 — Greenwich Mean Sidereal Time, degrees
  const T = (jd - 2451545.0) / 36525;
  let g = 280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T
    - T * T * T / 38710000;
  g = ((g % 360) + 360) % 360;
  return g;
}

function obliquity(jd) {
  // mean obliquity of ecliptic, degrees
  const T = (jd - 2451545.0) / 36525;
  return 23.43929111 - 0.01300417 * T - 1.638889e-7 * T * T + 5.0361e-7 * T * T * T;
}

function normDeg(d) { return ((d % 360) + 360) % 360; }

function eqToHorizon(raDeg, decDeg, lat, lon, jd) {
  // Convert (RA, Dec) → (alt, az) for observer at lat/lon.
  const lst = normDeg(gmst(jd) + lon); // local sidereal, deg
  const H = normDeg(lst - raDeg) * DEG;
  const dec = decDeg * DEG, phi = lat * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(H) > 0) az = 2 * Math.PI - az;
  return { alt: alt * RAD, az: az * RAD };
}

// --- Sun ---
function sunPosition(jd) {
  // Meeus Ch. 25 low-precision; returns {ra, dec, lambda} deg, R AU
  const T = (jd - 2451545.0) / 36525;
  const L0 = normDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = normDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * DEG;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr);
  const lambda = normDeg(L0 + C);
  const eps = obliquity(jd) * DEG;
  const lr = lambda * DEG;
  const ra  = Math.atan2(Math.cos(eps) * Math.sin(lr), Math.cos(lr)) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lr)) * RAD;
  return { ra: normDeg(ra), dec, lambda };
}

// --- Moon (low-precision Meeus 47.x) ---
function moonPosition(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = normDeg(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D  = normDeg(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
  const M  = normDeg(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
  const Mp = normDeg(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
  const F  = normDeg( 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T);
  // Largest periodic terms only — accurate to ~0.5°, plenty for an eyepiece sketch.
  const lon = Lp
    + 6.289 * Math.sin(Mp * DEG)
    - 1.274 * Math.sin((2 * D - Mp) * DEG)
    + 0.658 * Math.sin(2 * D * DEG)
    - 0.186 * Math.sin(M * DEG)
    - 0.059 * Math.sin((2 * Mp - 2 * D) * DEG);
  const lat = 5.128 * Math.sin(F * DEG)
    + 0.281 * Math.sin((Mp + F) * DEG)
    - 0.278 * Math.sin((F - Mp) * DEG);
  const dist = 385000.56 - 20905.355 * Math.cos(Mp * DEG); // km, approx
  const eps = obliquity(jd) * DEG;
  const lr = lon * DEG, br = lat * DEG;
  const ra  = Math.atan2(Math.sin(lr) * Math.cos(eps) - Math.tan(br) * Math.sin(eps), Math.cos(lr)) * RAD;
  const dec = Math.asin(Math.sin(br) * Math.cos(eps) + Math.cos(br) * Math.sin(eps) * Math.sin(lr)) * RAD;
  // Phase angle from Sun
  const sun = sunPosition(jd);
  const cosPhase = Math.cos((lon - sun.lambda) * DEG) * Math.cos(br);
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1, cosPhase))) * RAD; // 0=full, 180=new
  const illum = (1 + Math.cos(phaseAngle * DEG)) / 2; // 0..1
  const elong = (lon - sun.lambda + 360) % 360;
  const waxing = elong < 180;
  return { ra: normDeg(ra), dec, dist, illum, waxing, phaseAngle };
}

// --- Planets (low-precision orbital-elements approximation, J2000) ---
// Mean elements + first-order rates, valid 1800–2050 to ~0.5° — fine for an eyepiece view.
const PLANETS = {
  Mercury: { a:0.387098,e:0.205635,i:7.0050,L0:252.2509,Lr:149474.0723,wbar:77.4561,wbarRate:0.1599,Om:48.3309,OmRate:-0.1254 },
  Venus:   { a:0.723330,e:0.006773,i:3.3947,L0:181.9798,Lr: 58519.2130,wbar:131.5637,wbarRate:0.0048,Om:76.6800,OmRate:-0.2780 },
  Mars:    { a:1.523688,e:0.093405,i:1.8497,L0:355.4330,Lr: 19141.6964,wbar:336.0602,wbarRate:0.4438,Om:49.5581,OmRate:-0.2950 },
  Jupiter: { a:5.202561,e:0.048498,i:1.3030,L0: 34.3515,Lr:  3036.3027,wbar: 14.3312,wbarRate:0.2155,Om:100.4644,OmRate:0.2076 },
  Saturn:  { a:9.554747,e:0.055546,i:2.4886,L0: 50.0775,Lr:  1223.5110,wbar: 93.0572,wbarRate:0.5664,Om:113.6634,OmRate:-0.2566 }
};
const EARTH = { a:1.000002,e:0.016709,L0:100.4664,Lr:36000.7698,wbar:102.9404,wbarRate:0.3225,Om:0,OmRate:0 };

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}

function planetHeliocentric(p, T) {
  // returns ecliptic heliocentric (x,y,z) AU
  const a = p.a;
  const e = p.e;
  const i = (p.i || 0) * DEG;
  const L = (p.L0 + p.Lr * T) * DEG;
  const wbar = (p.wbar + p.wbarRate * T) * DEG;
  const Om = (p.Om + p.OmRate * T) * DEG;
  const w = wbar - Om;
  let M = L - wbar;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  const E = solveKepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const u = v + w;
  const cosO = Math.cos(Om), sinO = Math.sin(Om);
  const cosI = Math.cos(i), sinI = Math.sin(i);
  const x = r * (cosO * Math.cos(u) - sinO * Math.sin(u) * cosI);
  const y = r * (sinO * Math.cos(u) + cosO * Math.sin(u) * cosI);
  const z = r * Math.sin(u) * sinI;
  return { x, y, z, r };
}

function planetGeocentric(name, jd) {
  const T = (jd - 2451545.0) / 36525;
  const p = PLANETS[name];
  const ph = planetHeliocentric(p, T);
  const eh = planetHeliocentric(EARTH, T);
  const x = ph.x - eh.x, y = ph.y - eh.y, z = ph.z - eh.z;
  const lon = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const eps = obliquity(jd) * DEG;
  const ra  = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)) * RAD;
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon)) * RAD;
  const dist = Math.sqrt(x * x + y * y + z * z); // AU
  const r = ph.r, R = eh.r;
  // Phase angle — Sun-Planet-Earth
  const cosPhase = (r * r + dist * dist - R * R) / (2 * r * dist);
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1, cosPhase))) * RAD;
  const illum = (1 + Math.cos(phaseAngle * DEG)) / 2;
  return { ra: normDeg(ra), dec, dist, phaseAngle, illum };
}

// ============================================================================
// 2. Tonight's targets — assemble + score by altitude
// ============================================================================

const TARGETS = [
  { id: 'moon',    name: 'Moon',    type: 'moon',
    diamArcmin: 31, baseMag: -12, blurb: 'illuminated · phase varies nightly' },
  { id: 'jupiter', name: 'Jupiter', type: 'planet', planet: 'Jupiter',
    diamArcmin: 0.7, baseMag: -2.5, blurb: 'four Galilean moons · cloud bands' },
  { id: 'saturn',  name: 'Saturn',  type: 'planet', planet: 'Saturn',
    diamArcmin: 0.3, baseMag: 0.5, blurb: 'rings · Cassini division' },
  { id: 'venus',   name: 'Venus',   type: 'planet', planet: 'Venus',
    diamArcmin: 0.3, baseMag: -4, blurb: 'crescent phase · cloud-bright' },
  { id: 'mars',    name: 'Mars',    type: 'planet', planet: 'Mars',
    diamArcmin: 0.15, baseMag: -1, blurb: 'rust globe · polar cap' },
  // Composite — always present, sky-fixed approximations.
  { id: 'iss',     name: 'ISS pass', type: 'iss',
    diamArcmin: 1.2, baseMag: -3, blurb: 'low-orbit station · sunlit pass' },
  { id: 'comet',   name: 'C/2026 K2', type: 'comet',
    diamArcmin: 4, baseMag: 7, blurb: 'current bright comet · fan tail' },
  { id: 'meteors', name: 'η-Aquariids', type: 'meteors',
    diamArcmin: 0, baseMag: 99, blurb: 'tonight\'s strongest active radiant' }
];

function computeTargets(lat, lon, date) {
  const jd = julianDay(date);
  return TARGETS.map(t => {
    let ra, dec, distLabel = '', mag = t.baseMag, extra = {};
    if (t.type === 'moon') {
      const m = moonPosition(jd);
      ra = m.ra; dec = m.dec;
      distLabel = `${(m.dist/1000).toFixed(0)}×10³ km`;
      extra = { illum: m.illum, waxing: m.waxing, phaseAngle: m.phaseAngle };
    } else if (t.type === 'planet') {
      const p = planetGeocentric(t.planet, jd);
      ra = p.ra; dec = p.dec;
      distLabel = `${p.dist.toFixed(2)} AU`;
      mag = t.baseMag - 2.5 * Math.log10(Math.max(0.01, p.illum));
      extra = { illum: p.illum, phaseAngle: p.phaseAngle };
    } else if (t.type === 'iss') {
      // Approximate sky-position fixture: ISS sweeps the sky; for a static eyepiece
      // we anchor it just east of the meridian, ~50° alt, derived from JD so it
      // visibly drifts day to day. Permalink stays deterministic.
      const drift = (jd * 360) % 360;
      ra = normDeg(gmst(jd) + lon + 30 + drift * 0.07);
      dec = lat * 0.6 + 10 * Math.sin(jd * 0.1);
      distLabel = '~408 km';
      extra = { speed: 'fast' };
    } else if (t.type === 'comet') {
      // Synthetic but date-stable position so the lens demo is consistent.
      const ang = (jd % 365.25) / 365.25 * 360;
      ra = normDeg(150 + ang * 0.5);
      dec = 18 + 12 * Math.sin(ang * DEG);
      distLabel = '1.7 AU';
      extra = { tailPA: 240 + ang * 0.3 };
    } else if (t.type === 'meteors') {
      // Use η-Aquariid radiant as a fixed annual standard (RA 22h32m, Dec −1°).
      ra = 338.0; dec = -1.0;
      distLabel = '— · radiant';
      extra = { peak: 'May 5' };
    }
    const horizon = eqToHorizon(ra, dec, lat, lon, jd);
    return Object.assign({}, t, {
      ra, dec, distLabel, mag,
      alt: horizon.alt, az: horizon.az,
      visible: horizon.alt > 0,
      jd, extra
    });
  });
}

// ============================================================================
// 3. Locations
// ============================================================================

const CITIES = [
  { id: 'nyc',    name: 'New York',     lat: 40.713, lon: -74.006 },
  { id: 'la',     name: 'Los Angeles',  lat: 34.052, lon: -118.243 },
  { id: 'chi',    name: 'Chicago',      lat: 41.878, lon: -87.630 },
  { id: 'london', name: 'London',       lat: 51.507, lon: -0.128 },
  { id: 'paris',  name: 'Paris',        lat: 48.857, lon: 2.352 },
  { id: 'berlin', name: 'Berlin',       lat: 52.520, lon: 13.405 },
  { id: 'tokyo',  name: 'Tokyo',        lat: 35.690, lon: 139.692 },
  { id: 'sydney', name: 'Sydney',       lat: -33.868, lon: 151.209 },
  { id: 'spo',    name: 'São Paulo',    lat: -23.551, lon: -46.633 },
  { id: 'mum',    name: 'Mumbai',       lat: 19.076, lon: 72.878 },
  { id: 'cpt',    name: 'Cape Town',    lat: -33.925, lon: 18.424 },
  { id: 'rey',    name: 'Reykjavík',    lat: 64.146, lon: -21.942 }
];

// ============================================================================
// 4. Twelve historical lenses
//    Each is a (ctx, target, t) renderer — same object position+phase, rendered
//    in the registered visual style of the named historical observer.
//    Code-comment header: `// after Galileo, 1610-01-07`
// ============================================================================

const LENSES = [
  { id: 'galileo',   name: 'Galileo',         year: 1610, instrument: 'refractor 20×',         note: 'quill on paper'      },
  { id: 'cassini',   name: 'Cassini',         year: 1675, instrument: 'aerial refractor',      note: 'sepia wash'          },
  { id: 'herschel',  name: 'Herschel',        year: 1789, instrument: '40-ft reflector',       note: 'graphite hatch'      },
  { id: 'lyot',      name: 'Lyot',            year: 1939, instrument: 'coronagraph',           note: 'occulted plate'      },
  { id: 'lowell',    name: 'Lowell',          year: 1894, instrument: 'Clark refractor 24"',   note: 'pen-and-ink canals'  },
  { id: 'voyager',   name: 'Voyager',         year: 1980, instrument: 'ISS narrow-angle',      note: '8-bit grayscale'     },
  { id: 'jwst',      name: 'JWST',            year: 2022, instrument: 'NIRCam',                note: 'false-color IR'      },
  { id: 'sdo',       name: 'SDO',             year: 2010, instrument: 'AIA 304 Å',             note: 'extreme-UV monochrome' },
  { id: 'goldstone', name: 'Goldstone',       year: 1989, instrument: '70-m radar',            note: 'doppler colormap'    },
  { id: 'palomar',   name: 'Palomar POSS',    year: 1957, instrument: '48" Schmidt',           note: 'photo-plate negative' },
  { id: 'messier',   name: 'Messier',         year: 1781, instrument: 'naked-eye + 3" refractor', note: 'almanac chart'    },
  { id: 'modern',    name: 'amateur CMOS',    year: 2024, instrument: 'small-aperture stack',  note: 'aligned RGB stack'   }
];

function dateStrFor(lens, target) {
  // For the lens stamp — historical date for the observer.
  const obj = target.id;
  const map = {
    galileo:   { moon: '1609-12-01', jupiter: '1610-01-07', saturn: '1610-07-30', mars: '1610-08-15', venus: '1610-09-15', iss: '— · n/a', comet: '— · n/a', meteors: '— · n/a' },
    cassini:   { moon: '1672-04-22', jupiter: '1675-09-02', saturn: '1675-09-08', mars: '1666-08-13', venus: '1672-04-22', iss: '— · n/a', comet: '— · n/a', meteors: '— · n/a' },
    herschel:  { moon: '1787-02-11', jupiter: '1789-04-23', saturn: '1789-08-28', mars: '1783-09-15', venus: '1793-12-19', iss: '— · n/a', comet: '— · n/a', meteors: '1799-11-12' },
    lyot:      { moon: '1939-08-12', jupiter: '1939-10-22', saturn: '1939-11-15', mars: '1939-09-30', venus: '1937-06-08', iss: '— · n/a', comet: '— · n/a', meteors: '— · n/a' },
    lowell:    { moon: '1896-02-15', jupiter: '1894-08-30', saturn: '1894-09-12', mars: '1894-10-26', venus: '1896-12-08', iss: '— · n/a', comet: '— · n/a', meteors: '— · n/a' },
    voyager:   { moon: '— · n/a',     jupiter: '1979-03-05', saturn: '1980-11-12', mars: '— · n/a', venus: '— · n/a', iss: '— · n/a', comet: '1986-03-09', meteors: '— · n/a' },
    jwst:      { moon: '— · n/a',     jupiter: '2022-07-27', saturn: '2023-06-25', mars: '2022-09-05', venus: '— · safety mode', iss: '— · n/a', comet: '2022-09-15', meteors: '— · n/a' },
    sdo:       { moon: '2010-04-21', jupiter: '— · n/a',     saturn: '— · n/a',     mars: '— · n/a', venus: '2012-06-05', iss: '2010-06-13', comet: '2011-12-15', meteors: '— · n/a' },
    goldstone: { moon: '1972-04-29', jupiter: '— · n/a',     saturn: '— · n/a',     mars: '1992-12-30', venus: '1990-08-10', iss: '— · n/a', comet: '1996-03-25', meteors: '— · n/a' },
    palomar:   { moon: '1957-03-14', jupiter: '1957-09-22', saturn: '1957-11-10', mars: '1957-04-19', venus: '1957-06-30', iss: '— · n/a', comet: '1957-08-11', meteors: '— · n/a' },
    messier:   { moon: '1781-02-04', jupiter: '1781-03-14', saturn: '1781-09-08', mars: '1781-04-26', venus: '1781-06-12', iss: '— · n/a', comet: '1781-04-29', meteors: '1781-08-12' },
    modern:    { moon: '2024-09-17', jupiter: '2024-11-03', saturn: '2024-08-22', mars: '2025-01-15', venus: '2024-03-30', iss: '2024-12-12', comet: '2025-01-18', meteors: '2024-08-12' }
  };
  return (map[lens.id] && map[lens.id][obj]) || `${lens.year}-—-—`;
}

// ---- Lens renderers ---------------------------------------------------------
// Conventions:
//   ctx is sized 900x900 in CSS px (DPR-scaled in setupCanvas).
//   center = (450,450), eyepiece radius ≈ 430.
//   target.id ∈ {moon,jupiter,saturn,venus,mars,iss,comet,meteors}.

const C = 450; // center
const R = 430; // eyepiece radius

function withEyepiece(ctx, render) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  render();
  ctx.restore();
}

function bgFill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 900, 900);
}

function paperGrain(ctx, hue, amount = 0.06) {
  // tiny noise to sell paper / plate texture
  const w = 900, h = 900, img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 255;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function drawCrosshair(ctx, color, alpha = 0.4) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(C - R, C); ctx.lineTo(C + R, C);
  ctx.moveTo(C, C - R); ctx.lineTo(C, C + R);
  ctx.stroke();
  ctx.restore();
}

function micrometer(ctx, color, n = 24, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r1 = R - 4, r2 = i % 4 === 0 ? R - 18 : R - 10;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
    ctx.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

// --- crescent / phase helper (for moon, venus) -------------------------------
function drawPhaseDisc(ctx, x, y, r, illum, waxing, lit, dark, terminatorColor) {
  // Strategy: draw the full disc in `dark`. Then clip to the disc and fill the
  // lit-side rectangle with `lit`. Then carve the terminator with an ellipse
  // (positive ellipse adds to lit, negative subtracts from lit).
  ctx.save();
  // 1. dark base disc
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 2. clip to disc
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // 3. paint the lit half (left if waning, right if waxing)
  ctx.fillStyle = lit;
  if (waxing) {
    ctx.fillRect(x, y - r, r, r * 2);
  } else {
    ctx.fillRect(x - r, y - r, r, r * 2);
  }
  // 4. terminator ellipse — semi-minor = r * |1 - 2*illum|
  const k = 1 - 2 * illum;
  const eW = r * Math.abs(k);
  // sign(k) > 0 → crescent (lit < half) → ellipse is `dark` covering inner edge of lit half
  // sign(k) < 0 → gibbous (lit > half) → ellipse is `lit` extending into dark half
  const ellipseFill = (k > 0) ? dark : lit;
  if (eW > 0.5) {
    ctx.fillStyle = ellipseFill;
    ctx.beginPath();
    ctx.ellipse(x, y, eW, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 5. terminator glow line
  if (terminatorColor && eW > 0.5) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = terminatorColor;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(x, y, eW, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// --- per-target generic shape ------------------------------------------------
// Each lens overrides palette + decoration but uses these primitives so the
// "same object" reads across lenses.

function drawMoonShape(ctx, ink, dark, terminator, illum, waxing) {
  drawPhaseDisc(ctx, C, C, 230, illum, waxing, ink, dark, terminator);
  // maria spots — same positions across all lenses, only color changes
  ctx.save();
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.55;
  const maria = [
    [-60,-40,55,38], [40,-50,42,30], [10,30,70,42], [-90,30,28,22],
    [70,40,28,18], [80,-30,18,14]
  ];
  maria.forEach(([dx,dy,rx,ry]) => {
    ctx.beginPath();
    ctx.ellipse(C+dx, C+dy, rx, ry, 0.3, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

function drawJupiterShape(ctx, base, bands, gradient) {
  // base disc
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(C, C, 230, 215, 0, 0, Math.PI*2);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(C - 230, C - 215, 460, 430);
  // belts — drawn inside the clip
  const beltSpec = [
    [-180,-120, bands[0]], [-110,-60, bands[1]], [-30,40, bands[2]],
    [50,110, bands[3]], [120,180, bands[4]]
  ];
  beltSpec.forEach(([y1,y2,col]) => {
    ctx.fillStyle = col;
    ctx.fillRect(C-230, C+y1, 460, y2-y1);
  });
  // Great Red Spot
  ctx.fillStyle = bands[5] || '#8b3a2a';
  ctx.beginPath();
  ctx.ellipse(C+60, C+50, 32, 18, -0.2, 0, Math.PI*2);
  ctx.fill();
  // limb darkening
  if (gradient) {
    const g = ctx.createRadialGradient(C, C, 100, C, C, 240);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(C - 230, C - 215, 460, 430);
  }
  ctx.restore();
  // Galilean moons (outside disc) — small dots in a row
  ctx.save();
  ctx.fillStyle = base;
  const moons = [[-340, -2],[-300, 2],[270, -2],[330, 1]];
  moons.forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.arc(C+dx, C+dy, 4, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function drawSaturnShape(ctx, body, ringInner, ringOuter, gap) {
  ctx.save();
  // ring back arc (behind globe)
  ctx.strokeStyle = ringOuter;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(C, C, 320, 90, -0.3, Math.PI, Math.PI*2);
  ctx.stroke();
  ctx.strokeStyle = ringInner;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(C, C, 280, 78, -0.3, Math.PI, Math.PI*2);
  ctx.stroke();
  // globe
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(C, C, 150, 138, 0, 0, Math.PI*2);
  ctx.fill();
  // ring front arc (in front)
  ctx.strokeStyle = ringOuter;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(C, C, 320, 90, -0.3, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = ringInner;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(C, C, 280, 78, -0.3, 0, Math.PI);
  ctx.stroke();
  // Cassini division — thin gap
  if (gap) {
    ctx.strokeStyle = gap;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(C, C, 300, 84, -0.3, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVenusShape(ctx, lit, dark, terminator, illum, waxing) {
  drawPhaseDisc(ctx, C, C, 200, illum, waxing, lit, dark, terminator);
}

function drawMarsShape(ctx, base, dark, polar) {
  ctx.save();
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(C, C, 200, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.6;
  // Syrtis Major-ish dark patches — same positions across lenses
  const patches = [[-30,-20,80,50,0.3],[70,40,40,25,-0.4],[-80,40,30,20,0.1]];
  patches.forEach(([dx,dy,rx,ry,r]) => {
    ctx.beginPath();
    ctx.ellipse(C+dx, C+dy, rx, ry, r, 0, Math.PI*2);
    ctx.fill();
  });
  // polar ice
  ctx.globalAlpha = 1;
  ctx.fillStyle = polar;
  ctx.beginPath(); ctx.ellipse(C, C-180, 50, 20, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawIssShape(ctx, body, panel) {
  ctx.save();
  ctx.translate(C, C);
  ctx.rotate(-0.4);
  // bus
  ctx.fillStyle = body;
  ctx.fillRect(-180, -10, 360, 20);
  // truss segments
  for (let i = -160; i <= 160; i += 30) {
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i, 10); ctx.stroke();
  }
  // solar panels (4 wings)
  ctx.fillStyle = panel;
  ctx.fillRect(-220, -110, 80, 90);
  ctx.fillRect(-220, 20, 80, 90);
  ctx.fillRect(140, -110, 80, 90);
  ctx.fillRect(140, 20, 80, 90);
  // panel cell grid
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.5;
  [[-220,-110],[-220,20],[140,-110],[140,20]].forEach(([px,py]) => {
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(px + i*16, py); ctx.lineTo(px + i*16, py + 90); ctx.stroke();
    }
    for (let j = 1; j < 6; j++) {
      ctx.beginPath(); ctx.moveTo(px, py + j*15); ctx.lineTo(px + 80, py + j*15); ctx.stroke();
    }
  });
  // modules
  ctx.fillStyle = body;
  ctx.fillRect(-30, -30, 60, 60);
  ctx.restore();
}

function drawCometShape(ctx, head, tail, tailPA, headSize = 60) {
  // tail vector PA in degrees from up=0
  const ang = (tailPA - 90) * DEG;
  const tx = Math.cos(ang), ty = Math.sin(ang);
  // tail (gaussian-falloff cone)
  const grad = ctx.createLinearGradient(C, C, C + tx * 380, C + ty * 380);
  grad.addColorStop(0, tail);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(C - ty * 35, C + tx * 35);
  ctx.lineTo(C + ty * 35, C - tx * 35);
  ctx.lineTo(C + tx * 380 + ty * 70, C + ty * 380 - tx * 70);
  ctx.lineTo(C + tx * 380 - ty * 70, C + ty * 380 + tx * 70);
  ctx.closePath();
  ctx.fill();
  // ion sub-tail (slightly off-axis, narrower)
  const ang2 = ang + 0.18;
  const tx2 = Math.cos(ang2), ty2 = Math.sin(ang2);
  const grad2 = ctx.createLinearGradient(C, C, C + tx2 * 360, C + ty2 * 360);
  grad2.addColorStop(0, tail);
  grad2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.moveTo(C - ty2 * 14, C + tx2 * 14);
  ctx.lineTo(C + ty2 * 14, C - tx2 * 14);
  ctx.lineTo(C + tx2 * 360 + ty2 * 24, C + ty2 * 360 - tx2 * 24);
  ctx.lineTo(C + tx2 * 360 - ty2 * 24, C + ty2 * 360 + tx2 * 24);
  ctx.closePath();
  ctx.fill();
  // coma
  const cg = ctx.createRadialGradient(C, C, 0, C, C, headSize);
  cg.addColorStop(0, head);
  cg.addColorStop(0.5, head);
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(C, C, headSize, 0, Math.PI*2); ctx.fill();
  // nucleus
  ctx.fillStyle = head;
  ctx.beginPath(); ctx.arc(C, C, 5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawMeteorRadiantShape(ctx, ink, faint, jdSeed) {
  // a star field with meteor streaks emanating from radiant at center
  ctx.save();
  // pseudo-random reproducible stars
  const rng = mulberry32(Math.floor(jdSeed * 1000));
  ctx.fillStyle = faint;
  for (let i = 0; i < 180; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (R - 30);
    const sz = rng() * 1.6 + 0.4;
    ctx.beginPath();
    ctx.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, sz, 0, Math.PI*2);
    ctx.fill();
  }
  // radiant cross
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.4;
  for (let s = 0; s < 12; s++) {
    const a = rng() * Math.PI * 2;
    const r0 = 30 + rng() * 60;
    const r1 = 120 + rng() * 240;
    const x0 = C + Math.cos(a) * r0;
    const y0 = C + Math.sin(a) * r0;
    const x1 = C + Math.cos(a) * r1;
    const y1 = C + Math.sin(a) * r1;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, ink);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // radiant marker — small + symbol
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(C-10, C); ctx.lineTo(C+10, C);
  ctx.moveTo(C, C-10); ctx.lineTo(C, C+10);
  ctx.stroke();
  ctx.restore();
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- 12 lens implementations -----------------------------------------------

function lensGalileo(ctx, t) {
  bgFill(ctx, '#e9dfc7');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#e9dfc7');
    paperGrain(ctx, 'cream', 0.08);
    if (t.id === 'moon')    drawMoonShape(ctx, '#e9dfc7', '#5d4a2c', '#7a5e35', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#dcc99a', ['#7a5e35','#a78b56','#7a5e35','#a78b56','#7a5e35','#5d4a2c'], false);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#c9b070', '#7a5e35', '#5d4a2c');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#e9dfc7', '#5d4a2c', '#7a5e35', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#c4a35b', '#5d4a2c', '#e9dfc7');
    else if (t.id === 'iss')     drawIssShape(ctx, '#3a2a14', '#5d4a2c');
    else if (t.id === 'comet')   drawCometShape(ctx, '#3a2a14', '#7a5e35', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#3a2a14', '#a78b56', t.jd);
  });
  drawCrosshair(ctx, '#5d4a2c', 0.25);
  // Italian script-style label, hand-feel
  ctx.fillStyle = '#3a2a14';
  ctx.font = 'italic 18px "JetBrains Mono", serif';
  ctx.textAlign = 'left';
  ctx.fillText('Sidereus Nuncius', 60, 80);
  ctx.font = 'italic 13px "JetBrains Mono", serif';
  ctx.fillText('· quill on paper, 20× refractor', 60, 100);
}

function lensCassini(ctx, t) {
  bgFill(ctx, '#d8c094');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#d8c094');
    paperGrain(ctx, 'sepia', 0.06);
    if (t.id === 'moon')    drawMoonShape(ctx, '#e2cc9d', '#3e2a14', '#624022', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#c8a86f', ['#5b3c1d','#8a6438','#5b3c1d','#8a6438','#5b3c1d','#793c1c'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#b48b56', '#5b3c1d', '#3e2a14', '#d8c094');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#e2cc9d', '#3e2a14', '#624022', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#a86b3a', '#5b3c1d', '#e2cc9d');
    else if (t.id === 'iss')     drawIssShape(ctx, '#3e2a14', '#5b3c1d');
    else if (t.id === 'comet')   drawCometShape(ctx, '#3e2a14', '#8a6438', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#3e2a14', '#8a6438', t.jd);
  });
  // wash gradient inside the eyepiece edge
  const g = ctx.createRadialGradient(C, C, R*0.7, C, C, R);
  g.addColorStop(0, 'rgba(62,42,20,0)');
  g.addColorStop(1, 'rgba(62,42,20,0.7)');
  ctx.save();
  ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(0,0,900,900);
  ctx.restore();
  drawCrosshair(ctx, '#3e2a14', 0.2);
  ctx.fillStyle = '#3e2a14';
  ctx.font = '15px "JetBrains Mono", monospace';
  ctx.fillText('Observatoire de Paris', 60, 80);
}

function lensHerschel(ctx, t) {
  bgFill(ctx, '#1e1d1a');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#1e1d1a');
    if (t.id === 'moon')    drawMoonShape(ctx, '#cfc8b8', '#0c0b09', '#7a7567', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#9a9180', ['#1e1d1a','#5d574a','#1e1d1a','#5d574a','#1e1d1a','#3a352d'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#9a9180', '#5d574a', '#1e1d1a');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#cfc8b8', '#0c0b09', '#7a7567', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#9a9180', '#1e1d1a', '#cfc8b8');
    else if (t.id === 'iss')     drawIssShape(ctx, '#cfc8b8', '#7a7567');
    else if (t.id === 'comet')   drawCometShape(ctx, '#cfc8b8', '#9a9180', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#cfc8b8', '#5d574a', t.jd);
  });
  // hatch overlay everywhere
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI*2); ctx.clip();
  ctx.strokeStyle = 'rgba(207,200,184,0.10)';
  ctx.lineWidth = 0.8;
  for (let i = -1200; i < 1200; i += 6) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 900, 900); ctx.stroke();
  }
  ctx.restore();
  drawCrosshair(ctx, '#cfc8b8', 0.18);
  micrometer(ctx, '#cfc8b8', 36, 0.35);
  ctx.fillStyle = '#cfc8b8';
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText('Observatorium Slough', 60, 80);
  ctx.fillText('· 40-ft reflector', 60, 98);
}

function lensLyot(ctx, t) {
  bgFill(ctx, '#000');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#02060c');
    // occulting mask for sun-adjacent objects, otherwise standard
    if (t.id === 'moon')    drawMoonShape(ctx, '#dee5ee', '#000', '#7e96b6', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#9caac4', ['#000','#5b6a85','#000','#5b6a85','#000','#7e96b6'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#7e96b6', '#5b6a85', '#000');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#dee5ee', '#000', '#7e96b6', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#7e6660', '#000', '#dee5ee');
    else if (t.id === 'iss')     drawIssShape(ctx, '#dee5ee', '#5b6a85');
    else if (t.id === 'comet')   drawCometShape(ctx, '#dee5ee', '#9caac4', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#dee5ee', '#5b6a85', t.jd);
    // central occulting disc — Lyot's signature
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(C, C, 70, 0, Math.PI*2); ctx.fill();
    // diffraction halo
    const g = ctx.createRadialGradient(C, C, 70, C, C, 200);
    g.addColorStop(0, 'rgba(126,150,182,0.35)');
    g.addColorStop(1, 'rgba(126,150,182,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(C, C, 200, 0, Math.PI*2); ctx.fill();
  });
  drawCrosshair(ctx, '#7e96b6', 0.3);
  ctx.fillStyle = '#7e96b6';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('Pic du Midi · coronograph plate', 60, 80);
}

function lensLowell(ctx, t) {
  bgFill(ctx, '#f1e8d2');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#f1e8d2');
    paperGrain(ctx, 'cream', 0.04);
    if (t.id === 'moon')    drawMoonShape(ctx, '#f1e8d2', '#1a1407', '#7d5a25', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#dcc89a', ['#7d5a25','#bf9a59','#7d5a25','#bf9a59','#7d5a25','#9c2620'], false);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#bf9a59', '#7d5a25', '#1a1407');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#f1e8d2', '#1a1407', '#7d5a25', t.extra.illum, true);
    else if (t.id === 'mars')    {
      drawMarsShape(ctx, '#c97640', '#7d2615', '#f1e8d2');
      // canals — Lowell's hallmark
      ctx.save();
      ctx.strokeStyle = '#7d2615';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(C, C, 200, 0, Math.PI*2); ctx.clip();
      const lines = [[-180,-40,180,80],[-160,30,170,-50],[-120,-110,120,150],[-80,-180,80,170],[-200,0,200,0]];
      lines.forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath();
        ctx.moveTo(C+x1, C+y1); ctx.lineTo(C+x2, C+y2); ctx.stroke();
      });
      ctx.restore();
    }
    else if (t.id === 'iss')     drawIssShape(ctx, '#1a1407', '#7d5a25');
    else if (t.id === 'comet')   drawCometShape(ctx, '#1a1407', '#7d5a25', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#1a1407', '#7d5a25', t.jd);
  });
  drawCrosshair(ctx, '#1a1407', 0.2);
  ctx.fillStyle = '#1a1407';
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText('Lowell Observatory', 60, 80);
  ctx.fillText('· Flagstaff, Arizona', 60, 98);
}

function lensVoyager(ctx, t) {
  bgFill(ctx, '#000');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#000');
    if (t.id === 'moon')    drawMoonShape(ctx, '#cccccc', '#0a0a0a', '#666', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#a8a8a8', ['#222','#666','#222','#666','#222','#888'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#aaa', '#666', '#222', '#000');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#cccccc', '#0a0a0a', '#666', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#888', '#222', '#cccccc');
    else if (t.id === 'iss')     drawIssShape(ctx, '#cccccc', '#666');
    else if (t.id === 'comet')   drawCometShape(ctx, '#cccccc', '#aaa', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#cccccc', '#666', t.jd);
    // 8-bit posterize via overlay of a small dithered grid
    ctx.save();
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
    ctx.globalAlpha = 0.16;
    for (let y = 0; y < 900; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? '#000' : '#fff';
      ctx.fillRect(0, y, 900, 1);
    }
    ctx.restore();
  });
  // tick marks like spacecraft fiducials
  ctx.save();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillRect(C + Math.cos(a) * (R-12) - 3, C + Math.sin(a) * (R-12) - 3, 6, 6);
  }
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('VOYAGER ISS-NA · raw frame', 60, 80);
}

function lensJwst(ctx, t) {
  bgFill(ctx, '#070210');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#070210');
    // false-color IR — magenta/teal/orange
    if (t.id === 'moon')    drawMoonShape(ctx, '#ff8a3a', '#311047', '#ff5fbf', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#3aa8d1', ['#7c2bb1','#1a89c4','#7c2bb1','#1a89c4','#7c2bb1','#ff5fbf'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#16b9b3', '#7c2bb1', '#311047');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#ffaa3a', '#311047', '#ff5fbf', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#a8e0c2', '#3a1233', '#ffe0b3');
    else if (t.id === 'iss')     drawIssShape(ctx, '#3aa8d1', '#7c2bb1');
    else if (t.id === 'comet')   drawCometShape(ctx, '#a0e0ff', '#3aa8d1', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#3aa8d1', '#7c2bb1', t.jd);
    // diffraction spikes (six-pointed) from any bright point
    ctx.save();
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(C - Math.cos(a) * R, C - Math.sin(a) * R);
      ctx.lineTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.fillStyle = '#a0e0ff';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('JWST · NIRCam (F200W,F356W,F444W → BGR)', 60, 80);
}

function lensSdo(ctx, t) {
  bgFill(ctx, '#0a0203');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#1a0307');
    // EUV monochrome — orange-red 304 Å palette
    if (t.id === 'moon')    drawMoonShape(ctx, '#ffb87c', '#3a0507', '#ff6e3a', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#ff924a', ['#7a1a14','#c44226','#7a1a14','#c44226','#7a1a14','#ffe0a8'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#ff924a', '#7a1a14', '#3a0507');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#ffb87c', '#3a0507', '#ff6e3a', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#ff6e3a', '#7a1a14', '#ffe0a8');
    else if (t.id === 'iss')     drawIssShape(ctx, '#ffb87c', '#7a1a14');
    else if (t.id === 'comet')   drawCometShape(ctx, '#ffe0a8', '#ff924a', t.extra.tailPA, 80);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#ff924a', '#7a1a14', t.jd);
    // chromosphere granulation glow
    const g = ctx.createRadialGradient(C, C, 0, C, C, R);
    g.addColorStop(0, 'rgba(255,180,90,0)');
    g.addColorStop(0.6, 'rgba(255,90,30,0.15)');
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = '#ffb87c';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('SDO · AIA 304 Å', 60, 80);
}

function lensGoldstone(ctx, t) {
  bgFill(ctx, '#000');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#000');
    // doppler colormap: blue (approaching) → green → red (receding)
    const dopplerEdge = (id) => {
      ctx.save();
      ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
      const w = ctx.createLinearGradient(C - 230, C, C + 230, C);
      w.addColorStop(0, 'rgba(40,120,255,0.7)');
      w.addColorStop(0.5, 'rgba(80,255,140,0.7)');
      w.addColorStop(1, 'rgba(255,80,80,0.7)');
      ctx.fillStyle = w;
      ctx.globalCompositeOperation = 'multiply';
      ctx.beginPath(); ctx.arc(C, C, 230, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    };
    if (t.id === 'moon')    { drawMoonShape(ctx, '#80ff8e', '#020a02', '#0c180c', t.extra.illum, t.extra.waxing); dopplerEdge(); }
    else if (t.id === 'jupiter') { drawJupiterShape(ctx, '#80ff8e', ['#020a02','#0c4a18','#020a02','#0c4a18','#020a02','#1a8a3a'], false); dopplerEdge(); }
    else if (t.id === 'saturn')  { drawSaturnShape(ctx, '#80ff8e', '#0c4a18', '#020a02'); dopplerEdge(); }
    else if (t.id === 'venus')   { drawVenusShape(ctx, '#80ff8e', '#020a02', '#0c180c', t.extra.illum, true); dopplerEdge(); }
    else if (t.id === 'mars')    { drawMarsShape(ctx, '#80ff8e', '#020a02', '#caffd6'); dopplerEdge(); }
    else if (t.id === 'iss')     drawIssShape(ctx, '#80ff8e', '#0c4a18');
    else if (t.id === 'comet')   drawCometShape(ctx, '#80ff8e', '#1a8a3a', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#80ff8e', '#0c4a18', t.jd);
    // raster scanlines
    ctx.save();
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 900; y += 4) ctx.fillRect(0, y, 900, 2);
    ctx.restore();
  });
  ctx.fillStyle = '#80ff8e';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('Goldstone DSS-14 · 8.56 GHz radar', 60, 80);
}

function lensPalomar(ctx, t) {
  // photo-plate negative — bright sky, dark stars
  bgFill(ctx, '#e3dccf');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#e3dccf');
    paperGrain(ctx, 'plate', 0.07);
    if (t.id === 'moon')    drawMoonShape(ctx, '#1d1a14', '#cfc7b1', '#3a3527', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#1d1a14', ['#cfc7b1','#3a3527','#cfc7b1','#3a3527','#cfc7b1','#0a0905'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#1d1a14', '#3a3527', '#cfc7b1');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#1d1a14', '#cfc7b1', '#3a3527', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#1d1a14', '#0a0905', '#3a3527');
    else if (t.id === 'iss')     drawIssShape(ctx, '#1d1a14', '#3a3527');
    else if (t.id === 'comet')   drawCometShape(ctx, '#1d1a14', '#3a3527', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#1d1a14', '#3a3527', t.jd);
  });
  // plate corner fiducials
  ctx.fillStyle = '#1d1a14';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText('POSS-I · 48-inch Schmidt · Palomar', 60, 80);
  ctx.fillText('plate · negative', 60, 96);
  drawCrosshair(ctx, '#1d1a14', 0.2);
}

function lensMessier(ctx, t) {
  // almanac chart aesthetic — pale blue paper, fine engraved lines
  bgFill(ctx, '#e2e6dc');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#e2e6dc');
    paperGrain(ctx, 'almanac', 0.04);
    // fine concentric rings
    ctx.strokeStyle = 'rgba(30,30,30,0.18)';
    ctx.lineWidth = 0.6;
    for (let r = 60; r < R - 10; r += 40) {
      ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI*2); ctx.stroke();
    }
    if (t.id === 'moon')    drawMoonShape(ctx, '#e2e6dc', '#15171a', '#5b5e54', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#a8a89e', ['#15171a','#5b5e54','#15171a','#5b5e54','#15171a','#15171a'], false);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#a8a89e', '#5b5e54', '#15171a');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#e2e6dc', '#15171a', '#5b5e54', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#a8a89e', '#15171a', '#e2e6dc');
    else if (t.id === 'iss')     drawIssShape(ctx, '#15171a', '#5b5e54');
    else if (t.id === 'comet')   drawCometShape(ctx, '#15171a', '#5b5e54', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#15171a', '#5b5e54', t.jd);
  });
  drawCrosshair(ctx, '#15171a', 0.3);
  ctx.fillStyle = '#15171a';
  ctx.font = '14px "JetBrains Mono", serif';
  ctx.fillText('Connoissance des Temps', 60, 80);
}

function lensModern(ctx, t) {
  bgFill(ctx, '#02030a');
  withEyepiece(ctx, () => {
    bgFill(ctx, '#02030a');
    if (t.id === 'moon')    drawMoonShape(ctx, '#cdd1da', '#0c0e14', '#5e6168', t.extra.illum, t.extra.waxing);
    else if (t.id === 'jupiter') drawJupiterShape(ctx, '#d6b88a', ['#7a4f2e','#b88456','#7a4f2e','#b88456','#7a4f2e','#9c3826'], true);
    else if (t.id === 'saturn')  drawSaturnShape(ctx, '#dabd80', '#7a4f2e', '#3a200f', '#02030a');
    else if (t.id === 'venus')   drawVenusShape(ctx, '#e7d6a4', '#0c0e14', '#5e6168', t.extra.illum, true);
    else if (t.id === 'mars')    drawMarsShape(ctx, '#c4633a', '#3a1a0c', '#e2e7ee');
    else if (t.id === 'iss')     drawIssShape(ctx, '#cdd1da', '#7a4f2e');
    else if (t.id === 'comet')   drawCometShape(ctx, '#cdd1da', '#83a6c4', t.extra.tailPA);
    else if (t.id === 'meteors') drawMeteorRadiantShape(ctx, '#cdd1da', '#5e6168', t.jd);
    // RGB stack tri-color slight chromatic offset
    ctx.save();
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#ff5050';
    ctx.fillRect(2, 0, 900, 900);
    ctx.fillStyle = '#50a0ff';
    ctx.fillRect(-2, 0, 900, 900);
    ctx.restore();
  });
  ctx.fillStyle = '#83a6c4';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText('amateur CMOS · 256× stack · DSO mode', 60, 80);
}

const RENDERERS = {
  galileo: lensGalileo, cassini: lensCassini, herschel: lensHerschel,
  lyot: lensLyot, lowell: lensLowell, voyager: lensVoyager,
  jwst: lensJwst, sdo: lensSdo, goldstone: lensGoldstone,
  palomar: lensPalomar, messier: lensMessier, modern: lensModern
};

// ============================================================================
// 5. State + URL permalink
// ============================================================================

const STATE = {
  lat: null, lon: null, locName: null,
  objId: null, lensId: null,
  targets: [], date: new Date(),
};

function parseQuery() {
  const u = new URL(location.href);
  const lat = parseFloat(u.searchParams.get('lat'));
  const lon = parseFloat(u.searchParams.get('lon'));
  const obj = u.searchParams.get('obj');
  const lens = u.searchParams.get('lens');
  const loc = u.searchParams.get('loc');
  const out = {};
  if (Number.isFinite(lat) && Number.isFinite(lon)) { out.lat = lat; out.lon = lon; }
  if (obj && TARGETS.find(t => t.id === obj)) out.objId = obj;
  if (lens && LENSES.find(l => l.id === lens)) out.lensId = lens;
  if (loc) out.locName = loc;
  return out;
}

function writePermalink() {
  const u = new URL(location.href);
  u.searchParams.set('lat', STATE.lat.toFixed(3));
  u.searchParams.set('lon', STATE.lon.toFixed(3));
  if (STATE.locName) u.searchParams.set('loc', STATE.locName);
  if (STATE.objId)  u.searchParams.set('obj', STATE.objId);
  if (STATE.lensId) u.searchParams.set('lens', STATE.lensId);
  history.replaceState(null, '', u.toString());
  document.getElementById('permaUrl').textContent = u.toString();
}

function defaultLocation() {
  // Try saved
  try {
    const saved = JSON.parse(localStorage.getItem('pt-loc') || 'null');
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) return saved;
  } catch {}
  // Default — Greenwich, neutral global anchor
  return { lat: 51.477, lon: -0.001, name: 'Greenwich' };
}

// ============================================================================
// 6. Render — DPR-safe canvas + lens dispatch
// ============================================================================

function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(900 * dpr);
  canvas.height = Math.round(900 * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function renderLens() {
  const target = STATE.targets.find(t => t.id === STATE.objId);
  const lens = LENSES.find(l => l.id === STATE.lensId);
  if (!target || !lens) return;
  const canvas = document.getElementById('lens');
  const ctx = setupCanvas(canvas);
  const fn = RENDERERS[lens.id] || lensModern;
  fn(ctx, target);
  // stamp
  const stamp = `// after ${lens.name}, ${dateStrFor(lens, target)}`;
  document.getElementById('lensStamp').textContent = stamp;
  // caption
  const altS = `${target.alt.toFixed(1)}° alt`;
  const azS = `${target.az.toFixed(0)}° az`;
  const utc = STATE.date.toISOString().replace('T',' ').slice(0,16) + 'Z';
  document.getElementById('caption').textContent =
    `// ${lens.name} · ${lens.instrument} · ${target.distLabel} · ${altS} · ${azS} · ${utc}`;
}

function renderObjectMeta() {
  const target = STATE.targets.find(t => t.id === STATE.objId);
  if (!target) return;
  document.getElementById('targetName').textContent = `> ${target.name.toLowerCase()}`;
  document.getElementById('targetAlt').textContent = target.visible ?
    `alt ${target.alt.toFixed(1)}°` : `alt ${target.alt.toFixed(1)}° · below horizon`;
  document.getElementById('targetMag').textContent = `mag ${target.mag.toFixed(1)}`;
}

function renderObjectGrid() {
  const grid = document.getElementById('objectGrid');
  grid.innerHTML = '';
  // sort: visible-by-altitude desc, then non-visible
  const sorted = [...STATE.targets].sort((a, b) => {
    if (a.visible !== b.visible) return a.visible ? -1 : 1;
    return b.alt - a.alt;
  });
  sorted.forEach(t => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'object-card' + (t.id === STATE.objId ? ' active' : '') + (t.visible ? '' : ' invisible');
    const altLabel = t.visible ? `${t.alt.toFixed(0)}° alt` : `below`;
    card.innerHTML = `<span class="obj-name">${t.name}</span><span class="obj-meta">${altLabel} · m${t.mag.toFixed(1)}</span>`;
    card.addEventListener('click', () => { STATE.objId = t.id; afterChange(); });
    grid.appendChild(card);
  });
}

function renderLensGrid() {
  const grid = document.getElementById('lensGrid');
  grid.innerHTML = '';
  LENSES.forEach(l => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lens-card' + (l.id === STATE.lensId ? ' active' : '');
    card.innerHTML = `<span class="lens-name">// ${l.name}</span>` +
      `<span class="lens-meta">${l.year} · ${l.instrument}</span>` +
      `<span class="lens-meta">${l.note}</span>`;
    card.addEventListener('click', () => { STATE.lensId = l.id; afterChange(); });
    grid.appendChild(card);
  });
}

function recompute() {
  STATE.targets = computeTargets(STATE.lat, STATE.lon, STATE.date);
  // Auto-pick brightest visible if no obj selected, or current obj is below horizon
  if (!STATE.objId) {
    const visible = STATE.targets.filter(t => t.visible).sort((a,b) => a.mag - b.mag);
    STATE.objId = (visible[0] || STATE.targets[0]).id;
  }
}

function afterChange() {
  recompute(); // refresh alt/az
  renderObjectGrid();
  renderObjectMeta();
  renderLensGrid();
  renderLens();
  writePermalink();
}

// ============================================================================
// 7. Location dialog
// ============================================================================

function setupLocationDialog() {
  const dlg = document.getElementById('locDialog');
  const sel = document.getElementById('citySel');
  CITIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°)`;
    sel.appendChild(opt);
  });
  document.getElementById('locBtn').addEventListener('click', () => {
    document.getElementById('latInput').value = STATE.lat.toFixed(3);
    document.getElementById('lonInput').value = STATE.lon.toFixed(3);
    dlg.showModal();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => dlg.close());
  document.getElementById('saveBtn').addEventListener('click', () => {
    const cityId = sel.value;
    const city = CITIES.find(c => c.id === cityId);
    const latV = parseFloat(document.getElementById('latInput').value);
    const lonV = parseFloat(document.getElementById('lonInput').value);
    if (Number.isFinite(latV) && Number.isFinite(lonV) &&
        (Math.abs(latV - STATE.lat) > 0.01 || Math.abs(lonV - STATE.lon) > 0.01)) {
      STATE.lat = latV; STATE.lon = lonV; STATE.locName = `lat${latV.toFixed(2)}_lon${lonV.toFixed(2)}`;
    } else if (city) {
      STATE.lat = city.lat; STATE.lon = city.lon; STATE.locName = city.name;
    }
    persistLoc();
    afterChange();
    dlg.close();
    updateLocLabel();
  });
  document.getElementById('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { alert('// no geolocation API in this browser'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        STATE.lat = pos.coords.latitude; STATE.lon = pos.coords.longitude;
        STATE.locName = `gps_${STATE.lat.toFixed(2)}_${STATE.lon.toFixed(2)}`;
        persistLoc();
        afterChange();
        dlg.close();
        updateLocLabel();
      },
      () => alert('// gps refused — pick a city instead'),
      { timeout: 10000 }
    );
  });
}

function persistLoc() {
  try { localStorage.setItem('pt-loc', JSON.stringify({ lat: STATE.lat, lon: STATE.lon, name: STATE.locName })); } catch {}
}

function updateLocLabel() {
  const lbl = STATE.locName || `lat ${STATE.lat.toFixed(2)} · lon ${STATE.lon.toFixed(2)}`;
  document.getElementById('locLabel').textContent = lbl;
  document.getElementById('kicker').textContent = `// ${STATE.date.toISOString().slice(0,10)} · ${lbl}`;
}

// ============================================================================
// 8. Cycle button + copy + boot
// ============================================================================

function setupCycle() {
  let cycling = false, idx = 0, timer = null;
  document.getElementById('cycleBtn').addEventListener('click', () => {
    if (cycling) {
      cycling = false; clearInterval(timer);
      document.getElementById('cycleBtn').textContent = '▶ cycle all';
      return;
    }
    cycling = true;
    idx = LENSES.findIndex(l => l.id === STATE.lensId);
    document.getElementById('cycleBtn').textContent = '◼ stop cycling';
    timer = setInterval(() => {
      idx = (idx + 1) % LENSES.length;
      STATE.lensId = LENSES[idx].id;
      afterChange();
    }, 1400);
  });
}

function setupCopy() {
  document.getElementById('copyBtn').addEventListener('click', () => {
    const url = location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyBtn');
        const old = btn.textContent;
        btn.textContent = '✓ copied';
        setTimeout(() => btn.textContent = old, 1400);
      });
    }
  });
}

// Standard share fn — required by SKILL.md scaffold
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('// link copied — same params, same eyepiece view'));
  }
}
window.share = share;

function boot() {
  // Resolve location
  const q = parseQuery();
  if (q.lat !== undefined) {
    STATE.lat = q.lat; STATE.lon = q.lon; STATE.locName = q.locName || `lat${q.lat.toFixed(2)}_lon${q.lon.toFixed(2)}`;
  } else {
    const d = defaultLocation();
    STATE.lat = d.lat; STATE.lon = d.lon; STATE.locName = d.name;
  }
  STATE.date = new Date();
  recompute();
  // Apply object + lens from URL if present
  if (q.objId) STATE.objId = q.objId;
  if (q.lensId) STATE.lensId = q.lensId;
  if (!STATE.lensId) STATE.lensId = 'galileo';

  setupLocationDialog();
  setupCycle();
  setupCopy();
  updateLocLabel();
  afterChange();
}

document.addEventListener('DOMContentLoaded', boot);
