// Tonight's Sky — pure-client astronomy + sky-dome renderer.
// All positions computed in the browser; no API calls.
// Algorithms: Meeus (sun/moon), Schlyter (planets), classic horizontal projection.

// ============================================================
// (1) Math helpers
// ============================================================
const D = Math.PI / 180;
const R = 180 / Math.PI;
const wrap360 = (x) => ((x % 360) + 360) % 360;
const TAU = Math.PI * 2;

// ============================================================
// (2) Astronomy core
// ============================================================
function julianDate(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const day = date.getUTCDate()
    + (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const a = Math.floor(yy / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + day + b - 1524.5;
}

function gmst(jd) {
  const t = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  return wrap360(g);
}

function lst(jd, lonDeg) {
  return wrap360(gmst(jd) + lonDeg);
}

function eqToHorizon(raDeg, decDeg, latDeg, lstDeg) {
  const ha = (lstDeg - raDeg) * D;
  const dec = decDeg * D;
  const lat = latDeg * D;
  const sa = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(sa);
  let cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let az;
  if (Math.sin(ha) < 0) az = Math.acos(cosAz);
  else az = TAU - Math.acos(cosAz);
  return { alt: alt * R, az: wrap360(az * R) };
}

// Sun: Astronomical Almanac low-precision (USNO)
function sunPosition(jd) {
  const n = jd - 2451545.0;
  const L = wrap360(280.460 + 0.9856474 * n);
  const g = wrap360(357.528 + 0.9856003 * n) * D;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D;
  const eps = (23.439 - 0.0000004 * n) * D;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) * R;
  return { ra: wrap360(ra), dec, lambda: lambda * R };
}

// Moon: Meeus reduced (good to ~0.3°)
function moonPosition(jd) {
  const t = (jd - 2451545.0) / 36525;
  const Lp = wrap360(218.3164477 + 481267.88123421 * t);
  const Dl = wrap360(297.8501921 + 445267.1114034 * t);
  const M = wrap360(357.5291092 + 35999.0502909 * t);
  const Mp = wrap360(134.9633964 + 477198.8675055 * t);
  const F = wrap360(93.272095 + 483202.0175233 * t);
  const lon = Lp
    + 6.289 * Math.sin(Mp * D)
    - 1.274 * Math.sin((Mp - 2 * Dl) * D)
    + 0.658 * Math.sin(2 * Dl * D)
    - 0.186 * Math.sin(M * D)
    - 0.059 * Math.sin((2 * Mp - 2 * Dl) * D)
    - 0.057 * Math.sin((Mp - 2 * Dl + M) * D)
    + 0.053 * Math.sin((Mp + 2 * Dl) * D)
    + 0.046 * Math.sin((2 * Dl - M) * D)
    + 0.041 * Math.sin((Mp - M) * D)
    - 0.035 * Math.sin(Dl * D);
  const lat = 5.128 * Math.sin(F * D)
    + 0.281 * Math.sin((Mp + F) * D)
    + 0.278 * Math.sin((Mp - F) * D)
    + 0.173 * Math.sin((2 * Dl - F) * D);
  const eps = (23.4393 - 0.013 * t) * D;
  const lr = lon * D, br = lat * D;
  const ra = Math.atan2(Math.sin(lr) * Math.cos(eps) - Math.tan(br) * Math.sin(eps), Math.cos(lr)) * R;
  const dec = Math.asin(Math.sin(br) * Math.cos(eps) + Math.cos(br) * Math.sin(eps) * Math.sin(lr)) * R;
  const sun = sunPosition(jd);
  const elong = wrap360(lon - sun.lambda);
  const phase = (1 - Math.cos(elong * D)) / 2; // 0=new, 0.5=quarter, 1=full
  return { ra: wrap360(ra), dec, phase, elongation: elong, lon: wrap360(lon) };
}

// ----- Planets (Schlyter) -----
const PEL = {
  Mercury: [48.3313, 3.24587e-5, 7.0047, 5.0e-8, 29.1241, 1.01444e-5, 0.387098, 0.205635, 5.59e-10, 168.6562, 4.0923344368],
  Venus:   [76.6799, 2.46590e-5, 3.3946, 2.75e-8, 54.8910, 1.38374e-5, 0.723330, 0.006773, -1.302e-9, 48.0052, 1.6021302244],
  Mars:    [49.5574, 2.11081e-5, 1.8497, -1.78e-8, 286.5016, 2.92961e-5, 1.523688, 0.093405, 2.516e-9, 18.6021, 0.5240207766],
  Jupiter: [100.4542, 2.76854e-5, 1.3030, -1.557e-7, 273.8777, 1.64505e-5, 5.20256, 0.048498, 4.469e-9, 19.8950, 0.0830853001],
  Saturn:  [113.6634, 2.38980e-5, 2.4886, -1.081e-7, 339.3939, 2.97661e-5, 9.55475, 0.055546, -9.499e-9, 316.9670, 0.0334442282]
};
// magnitudes at ~mean opposition / inferior conjunction (loose; visual hint only)
const PMAG = { Mercury: -0.4, Venus: -4.4, Mars: -1.0, Jupiter: -2.5, Saturn: 0.3 };

function planetHelio(name, d) {
  const [N0, Nr, i0, ir, w0, wr, a, e0, er, M0_, Mr] = PEL[name];
  const N = (N0 + Nr * d) * D;
  const i = (i0 + ir * d) * D;
  const w = (w0 + wr * d) * D;
  const e = e0 + er * d;
  let M = wrap360(M0_ + Mr * d) * D;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * Math.sin(v + w) * Math.sin(i);
  return { x: xh, y: yh, z: zh };
}
function earthHelio(d) {
  const wDeg = 282.9404 + 4.70935e-5 * d;
  const e = 0.016709 - 1.151e-9 * d;
  let M = wrap360(356.0470 + 0.9856002585 * d) * D;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = (Math.cos(E) - e);
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  // Sun's position from Earth = -Earth's position from Sun
  const sx = r * Math.cos(v + wDeg * D);
  const sy = r * Math.sin(v + wDeg * D);
  return { x: -sx, y: -sy, z: 0 };
}
function planetEq(name, jd) {
  const d = jd - 2451543.5;
  const p = planetHelio(name, d);
  const e = earthHelio(d);
  const xg = p.x - e.x, yg = p.y - e.y, zg = p.z - e.z;
  const eps = (23.4393 - 3.563e-7 * d) * D;
  const xeq = xg;
  const yeq = yg * Math.cos(eps) - zg * Math.sin(eps);
  const zeq = yg * Math.sin(eps) + zg * Math.cos(eps);
  const ra = wrap360(Math.atan2(yeq, xeq) * R);
  const dec = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq)) * R;
  return { ra, dec, dist: Math.sqrt(xeq * xeq + yeq * yeq + zeq * zeq) };
}

// ============================================================
// (3) Star catalog (J2000) — bright named stars, ra deg, dec deg, mag
// ============================================================
const STARS = [
  ["Sirius", 101.287, -16.716, -1.46],
  ["Canopus", 95.988, -52.696, -0.74],
  ["Arcturus", 213.915, 19.182, -0.05],
  ["Rigil Kentaurus", 219.900, -60.835, -0.27],
  ["Vega", 279.234, 38.784, 0.03],
  ["Capella", 79.172, 45.998, 0.08],
  ["Rigel", 78.634, -8.202, 0.13],
  ["Procyon", 114.825, 5.225, 0.34],
  ["Achernar", 24.429, -57.237, 0.46],
  ["Betelgeuse", 88.793, 7.407, 0.50],
  ["Hadar", 210.956, -60.373, 0.61],
  ["Altair", 297.696, 8.868, 0.77],
  ["Acrux", 186.650, -63.099, 0.77],
  ["Aldebaran", 68.980, 16.509, 0.85],
  ["Antares", 247.352, -26.432, 1.09],
  ["Spica", 201.298, -11.161, 1.04],
  ["Pollux", 116.329, 28.026, 1.14],
  ["Fomalhaut", 344.413, -29.622, 1.16],
  ["Deneb", 310.358, 45.280, 1.25],
  ["Mimosa", 191.930, -59.689, 1.25],
  ["Regulus", 152.093, 11.967, 1.35],
  ["Adhara", 104.656, -28.972, 1.50],
  ["Castor", 113.649, 31.888, 1.58],
  ["Gacrux", 187.791, -57.113, 1.59],
  ["Shaula", 263.402, -37.104, 1.62],
  ["Bellatrix", 81.283, 6.350, 1.64],
  ["Elnath", 81.573, 28.608, 1.65],
  ["Miaplacidus", 138.300, -69.717, 1.67],
  ["Alnilam", 84.053, -1.202, 1.69],
  ["Alnitak", 85.190, -1.943, 1.74],
  ["Alioth", 193.507, 55.960, 1.76],
  ["Dubhe", 165.932, 61.751, 1.81],
  ["Mirfak", 51.081, 49.861, 1.82],
  ["Wezen", 107.098, -26.394, 1.83],
  ["Kaus Australis", 276.043, -34.385, 1.85],
  ["Avior", 125.628, -59.510, 1.86],
  ["Alkaid", 206.885, 49.313, 1.86],
  ["Sargas", 264.330, -42.998, 1.87],
  ["Menkalinan", 89.882, 44.947, 1.90],
  ["Atria", 252.166, -69.028, 1.91],
  ["Alhena", 99.428, 16.399, 1.93],
  ["Peacock", 306.412, -56.735, 1.94],
  ["Polaris", 37.954, 89.264, 1.97],
  ["Mirzam", 95.674, -17.956, 1.98],
  ["Alphard", 141.897, -8.659, 1.98],
  ["Hamal", 31.793, 23.462, 2.00],
  ["Diphda", 10.897, -17.987, 2.04],
  ["Alpheratz", 2.097, 29.090, 2.06],
  ["Mirach", 17.433, 35.621, 2.06],
  ["Saiph", 86.939, -9.670, 2.07],
  ["Rasalhague", 263.733, 12.560, 2.07],
  ["Almach", 30.975, 42.330, 2.10],
  ["Algol", 47.042, 40.956, 2.12],
  ["Denebola", 177.265, 14.572, 2.14],
  ["Sadr", 305.557, 40.257, 2.20],
  ["Mintaka", 83.001, -0.299, 2.23],
  ["Mizar", 200.981, 54.925, 2.23],
  ["Eltanin", 269.152, 51.489, 2.23],
  ["Schedar", 10.127, 56.537, 2.24],
  ["Caph", 2.295, 59.150, 2.27],
  ["Markab", 346.190, 15.205, 2.49],
  ["Algenib", 3.309, 15.184, 2.83],
  ["Scheat", 345.944, 28.083, 2.42],
  ["Enif", 326.046, 9.875, 2.39],
  ["Albireo", 292.680, 27.960, 3.18],
  ["Tsih", 14.177, 60.717, 2.47],
  ["Ruchbah", 21.454, 60.235, 2.68],
  ["Menkar", 45.570, 4.090, 2.53],
  ["Rastaban", 262.608, 52.301, 2.79],
  ["Vindemiatrix", 195.544, 10.959, 2.85],
  ["Cor Caroli", 194.007, 38.318, 2.89],
  ["Izar", 221.247, 27.074, 2.37],
  ["Merak", 165.460, 56.382, 2.34],
  ["Phecda", 178.458, 53.695, 2.41],
  ["Megrez", 183.857, 57.033, 3.31],
  ["Sabik", 257.594, -15.725, 2.43],
  ["Unukalhai", 236.067, 6.426, 2.65],
  ["Ras Algethi", 258.662, 14.390, 3.06],
  ["Nunki", 283.816, -26.297, 2.05],
  ["Algieba", 154.993, 19.842, 2.61],
  ["Nashira", 326.760, -16.662, 3.68],
  ["Atlas", 56.872, 24.054, 3.62],
  ["Electra", 56.218, 24.113, 3.70],
  ["Maia", 56.583, 24.367, 3.86],
  ["Alcyone", 56.871, 24.105, 2.87] // Pleiades brightest
];
const STAR_IDX = new Map(STARS.map((s, i) => [s[0], i]));

// Constellation stick figures: arrays of star-name pairs
const CONSTELLATIONS = {
  "Orion": [
    ["Betelgeuse","Bellatrix"],["Bellatrix","Mintaka"],["Mintaka","Alnilam"],
    ["Alnilam","Alnitak"],["Alnitak","Saiph"],["Saiph","Rigel"],
    ["Rigel","Mintaka"],["Betelgeuse","Alnitak"]
  ],
  "Ursa Major": [
    ["Dubhe","Merak"],["Merak","Phecda"],["Phecda","Megrez"],
    ["Megrez","Alioth"],["Alioth","Mizar"],["Mizar","Alkaid"],["Megrez","Dubhe"]
  ],
  "Cassiopeia": [["Caph","Schedar"],["Schedar","Tsih"],["Tsih","Ruchbah"]],
  "Cygnus": [["Deneb","Sadr"],["Sadr","Albireo"],["Sadr","Gacrux"]],
  "Lyra": [["Vega","Albireo"]],
  "Leo": [["Regulus","Algieba"],["Algieba","Denebola"]],
  "Boötes": [["Arcturus","Izar"]],
  "Scorpius": [["Antares","Shaula"],["Antares","Sargas"]],
  "Pegasus": [["Markab","Scheat"],["Scheat","Alpheratz"],["Alpheratz","Algenib"],["Algenib","Markab"]],
  "Andromeda": [["Alpheratz","Mirach"],["Mirach","Almach"]],
  "Cassiopeia W": [["Tsih","Caph"]],
  "Crux": [["Acrux","Gacrux"],["Mimosa","Acrux"]],
  "Canis Major": [["Sirius","Adhara"],["Sirius","Mirzam"],["Sirius","Wezen"]],
  "Gemini": [["Castor","Pollux"]],
  "Taurus": [["Aldebaran","Elnath"]]
};

// ============================================================
// (4) Messier deep-sky targets — name, ra, dec, mag, kind
// ============================================================
const MESSIER = [
  ["M31 Andromeda", 10.685, 41.269, 3.4, "galaxy"],
  ["M42 Orion Neb", 83.822, -5.391, 4.0, "nebula"],
  ["M45 Pleiades", 56.871, 24.105, 1.6, "cluster"],
  ["M44 Beehive", 130.025, 19.667, 3.7, "cluster"],
  ["M51 Whirlpool", 202.469, 47.195, 8.4, "galaxy"],
  ["M81 Bode's", 148.888, 69.065, 6.9, "galaxy"],
  ["M13 Hercules", 250.422, 36.460, 5.8, "cluster"],
  ["M22 Sagittarius", 279.100, -23.905, 5.1, "cluster"],
  ["M27 Dumbbell", 299.901, 22.721, 7.4, "nebula"],
  ["M57 Ring", 283.396, 33.029, 8.8, "nebula"],
  ["M101 Pinwheel", 210.802, 54.349, 7.9, "galaxy"],
  ["M16 Eagle", 274.700, -13.807, 6.0, "nebula"],
  ["M8 Lagoon", 271.100, -24.380, 5.8, "nebula"],
  ["M104 Sombrero", 189.998, -11.624, 8.0, "galaxy"],
  ["M33 Triangulum", 23.462, 30.660, 5.7, "galaxy"],
  ["M11 Wild Duck", 282.770, -6.270, 6.3, "cluster"],
  ["M17 Omega Neb", 275.196, -16.171, 6.0, "nebula"],
  ["M20 Trifid", 270.625, -23.030, 6.3, "nebula"],
  ["M3 Globular", 205.548, 28.378, 6.2, "cluster"],
  ["M5 Globular", 229.638, 2.081, 5.7, "cluster"],
  ["M82 Cigar", 148.969, 69.679, 8.4, "galaxy"],
  ["M24 Sgr Cloud", 274.200, -18.500, 4.6, "cluster"],
  ["M7 Ptolemy", 268.450, -34.793, 3.3, "cluster"],
  ["M6 Butterfly", 265.083, -32.217, 4.2, "cluster"],
  ["M35 Gemini", 92.250, 24.333, 5.1, "cluster"]
];

// ============================================================
// (5) Meteor showers — name, peak month/day, radiant ra, dec, ZHR
// ============================================================
const SHOWERS = [
  ["Quadrantids", 1, 3, 230.1, 49.5, 110],
  ["Lyrids", 4, 22, 271.4, 33.3, 18],
  ["Eta Aquariids", 5, 6, 338.0, -1.0, 50],
  ["Southern Delta Aquariids", 7, 30, 339.0, -16.4, 25],
  ["Perseids", 8, 12, 48.0, 58.0, 100],
  ["Draconids", 10, 8, 262.0, 54.0, 10],
  ["Orionids", 10, 21, 95.0, 16.0, 20],
  ["Leonids", 11, 17, 152.0, 22.0, 15],
  ["Geminids", 12, 14, 112.0, 32.5, 120],
  ["Ursids", 12, 22, 217.0, 76.0, 10]
];

// ============================================================
// (6) Cities (light-pollution proxy) — name, lat, lon, population (M)
// ============================================================
const CITIES = [
  ["New York, US", 40.7128, -74.0060, 8.4],
  ["Los Angeles, US", 34.0522, -118.2437, 4.0],
  ["Chicago, US", 41.8781, -87.6298, 2.7],
  ["Toronto, CA", 43.6532, -79.3832, 2.9],
  ["Mexico City, MX", 19.4326, -99.1332, 9.2],
  ["São Paulo, BR", -23.5505, -46.6333, 12.3],
  ["Buenos Aires, AR", -34.6037, -58.3816, 3.0],
  ["Lima, PE", -12.0464, -77.0428, 9.7],
  ["Bogotá, CO", 4.7110, -74.0721, 7.7],
  ["London, UK", 51.5074, -0.1278, 9.0],
  ["Paris, FR", 48.8566, 2.3522, 2.1],
  ["Berlin, DE", 52.5200, 13.4050, 3.7],
  ["Madrid, ES", 40.4168, -3.7038, 3.3],
  ["Rome, IT", 41.9028, 12.4964, 2.8],
  ["Moscow, RU", 55.7558, 37.6173, 12.5],
  ["Istanbul, TR", 41.0082, 28.9784, 15.5],
  ["Cairo, EG", 30.0444, 31.2357, 9.5],
  ["Lagos, NG", 6.5244, 3.3792, 14.0],
  ["Johannesburg, ZA", -26.2041, 28.0473, 5.6],
  ["Cape Town, ZA", -33.9249, 18.4241, 4.6],
  ["Tehran, IR", 35.6892, 51.3890, 8.7],
  ["Dubai, AE", 25.2048, 55.2708, 3.4],
  ["Karachi, PK", 24.8607, 67.0011, 16.0],
  ["Mumbai, IN", 19.0760, 72.8777, 20.7],
  ["Delhi, IN", 28.6139, 77.2090, 28.5],
  ["Bangalore, IN", 12.9716, 77.5946, 12.3],
  ["Bangkok, TH", 13.7563, 100.5018, 10.5],
  ["Jakarta, ID", -6.2088, 106.8456, 10.6],
  ["Manila, PH", 14.5995, 120.9842, 13.5],
  ["Beijing, CN", 39.9042, 116.4074, 21.5],
  ["Shanghai, CN", 31.2304, 121.4737, 24.2],
  ["Hong Kong, CN", 22.3193, 114.1694, 7.5],
  ["Seoul, KR", 37.5665, 126.9780, 9.7],
  ["Tokyo, JP", 35.6762, 139.6503, 13.9],
  ["Osaka, JP", 34.6937, 135.5023, 2.7],
  ["Sydney, AU", -33.8688, 151.2093, 5.3],
  ["Melbourne, AU", -37.8136, 144.9631, 5.0],
  ["Auckland, NZ", -36.8485, 174.7633, 1.7],
  ["San Francisco, US", 37.7749, -122.4194, 0.9],
  ["Seattle, US", 47.6062, -122.3321, 0.7],
  ["Vancouver, CA", 49.2827, -123.1207, 0.7],
  ["Honolulu, US", 21.3069, -157.8583, 0.4],
  ["Anchorage, US", 61.2181, -149.9003, 0.3],
  ["Reykjavík, IS", 64.1466, -21.9426, 0.13],
  ["Stockholm, SE", 59.3293, 18.0686, 1.0],
  ["Helsinki, FI", 60.1699, 24.9384, 0.65],
  ["Atlanta, US", 33.7490, -84.3880, 0.5],
  ["Miami, US", 25.7617, -80.1918, 0.5],
  ["Denver, US", 39.7392, -104.9903, 0.7],
  ["Phoenix, US", 33.4484, -112.0740, 1.6],
  ["Dallas, US", 32.7767, -96.7970, 1.3]
];

// Bortle estimate: distance to nearest city (km), modulated by city size
function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = (lat2 - lat1) * D;
  const dLon = (lon2 - lon1) * D;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
function estimateBortle(lat, lon) {
  // simple distance-to-city + population blend
  let nearestKm = Infinity, nearestPop = 0;
  for (const [, clat, clon, pop] of CITIES) {
    const d = haversineKm(lat, lon, clat, clon);
    if (d < nearestKm) { nearestKm = d; nearestPop = pop; }
  }
  // Inside major city → 8-9; suburb → 5-7; rural → 2-4; remote → 1
  // effective distance scales by population radius
  const popRadius = 12 * Math.sqrt(nearestPop); // ~km of dome influence
  const ratio = nearestKm / Math.max(popRadius, 8);
  let bortle;
  if (ratio < 0.3) bortle = 9;
  else if (ratio < 0.6) bortle = 8;
  else if (ratio < 1.0) bortle = 7;
  else if (ratio < 1.6) bortle = 6;
  else if (ratio < 2.5) bortle = 5;
  else if (ratio < 4.0) bortle = 4;
  else if (ratio < 7.0) bortle = 3;
  else if (ratio < 14.0) bortle = 2;
  else bortle = 1;
  return { bortle, nearestKm, nearestPop };
}

// ============================================================
// (7) UI state
// ============================================================
const STATE = {
  lat: 40.7128,
  lon: -74.0060,
  locName: "New York, US",
  lens: "VISIBLE",
  date: null,    // Date object representing 22:00 local of "tonight"
};
const LENSES = [
  ["VISIBLE", "naked-eye stars + named planets"],
  ["CONSTELLATIONS", "stick figures + names"],
  ["PLANETS", "ecliptic line + planet labels"],
  ["MOON", "phase glyph + position halo"],
  ["MILKY WAY", "galactic equator band"],
  ["BORTLE", "light-pollution radial overlay"],
  ["TARGETS", "Messier deep-sky markers"],
  ["METEORS", "active radiants tonight + ZHR"],
  ["SATELLITES", "geostationary belt + LEO band"],
  ["GRID", "RA/Dec equatorial circles"],
  ["SUN PATH", "today's sun arc + rise/set az"],
  ["BARE", "stars only — no labels"]
];

// ============================================================
// (8) Time helpers
// ============================================================
function tonightAt22() {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  return d;
}
function dateAt22(yyyy, mm, dd) {
  const d = new Date(yyyy, mm - 1, dd, 22, 0, 0, 0);
  return d;
}

// ============================================================
// (9) Renderer
// ============================================================
const MOON_GLYPHS = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
function moonGlyph(phaseFrac, waxing) {
  // phaseFrac: 0=new, 1=full
  // waxing: true if 0→1 phase, false if 1→0
  const idx = Math.round(phaseFrac * 8) % 8;
  if (waxing) return MOON_GLYPHS[idx]; // 0=new through 4=full through ...
  return MOON_GLYPHS[(8 - idx) % 8];
}
function moonGlyphFromElong(elong) {
  // 0 = new (sun-side), 180 = full (opposite); waxing 0→180, waning 180→360
  if (elong < 22.5) return "🌑";
  if (elong < 67.5) return "🌒";
  if (elong < 112.5) return "🌓";
  if (elong < 157.5) return "🌔";
  if (elong < 202.5) return "🌕";
  if (elong < 247.5) return "🌖";
  if (elong < 292.5) return "🌗";
  if (elong < 337.5) return "🌘";
  return "🌑";
}

function projAltAz(alt, az, R0) {
  // fisheye: r = R0 * (90 - alt) / 90
  if (alt < 0) return null;
  const r = R0 * (90 - alt) / 90;
  // canvas: (cx + r*sin(az), cy - r*cos(az))   (north = up = -y)
  return { x: r * Math.sin(az * D), y: -r * Math.cos(az * D) };
}

function setupCanvas() {
  const cv = document.getElementById('dome');
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const cssSize = cv.clientWidth || cv.offsetWidth;
  cv.width = Math.round(cssSize * dpr);
  cv.height = Math.round(cssSize * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv, ctx, size: cssSize };
}

function starRadius(mag) {
  // mag 0 → 2.6 px, mag 4 → 0.7 px
  const r = Math.max(0.6, 3.0 - mag * 0.5);
  return r;
}

function render() {
  const { ctx, size } = setupCanvas();
  const cx = size / 2, cy = size / 2;
  const R0 = size / 2 - 12;
  const jd = julianDate(STATE.date);
  const lstDeg = lst(jd, STATE.lon);

  // background: deeper near zenith, fading at horizon
  ctx.clearRect(0, 0, size, size);
  // Ring
  ctx.save();
  ctx.translate(cx, cy);

  // Bortle radial overlay (drawn first as bg if lens=BORTLE)
  if (STATE.lens === "BORTLE") {
    const b = estimateBortle(STATE.lat, STATE.lon);
    const tone = Math.max(0, Math.min(1, (9 - b.bortle) / 8)); // 0=urban (tinted) → 1=remote (dark)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R0);
    grad.addColorStop(0, "rgba(232,160,64,0)");
    grad.addColorStop(0.65, `rgba(232,160,64,${(1 - tone) * 0.18})`);
    grad.addColorStop(1, `rgba(232,160,64,${(1 - tone) * 0.45})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU); ctx.fill();
  }

  // Horizon ring
  ctx.strokeStyle = "#1a212a";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU); ctx.stroke();
  // Altitude rings: 30° and 60°
  for (const a of [30, 60]) {
    const r = R0 * (90 - a) / 90;
    ctx.strokeStyle = "rgba(58,68,81,0.4)";
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  }
  // Zenith mark
  ctx.fillStyle = "#3a4451";
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, TAU); ctx.fill();

  // GRID: equatorial RA/Dec mesh
  if (STATE.lens === "GRID") {
    ctx.strokeStyle = "rgba(52,194,210,0.32)";
    ctx.lineWidth = 0.8;
    // Dec circles every 30°
    for (let dec = -60; dec <= 60; dec += 30) {
      ctx.beginPath();
      let started = false;
      for (let ra = 0; ra <= 360; ra += 4) {
        const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
        const p = projAltAz(h.alt, h.az, R0);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // RA hour circles every 30° (= 2h)
    for (let ra = 0; ra < 360; ra += 30) {
      ctx.beginPath();
      let started = false;
      for (let dec = -85; dec <= 85; dec += 4) {
        const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
        const p = projAltAz(h.alt, h.az, R0);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // Milky way arc — approximate as a band around galactic equator (rough RA/Dec curve)
  if (STATE.lens === "MILKY WAY") {
    ctx.strokeStyle = "rgba(216,228,236,0.10)";
    ctx.lineWidth = 18;
    drawGalacticBand(ctx, R0, lstDeg);
  }

  // Ecliptic (drawn for PLANETS & SUN PATH)
  if (STATE.lens === "PLANETS" || STATE.lens === "SUN PATH") {
    ctx.strokeStyle = "rgba(232,160,64,0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let started = false;
    const eps = 23.4393;
    for (let elong = 0; elong <= 360; elong += 3) {
      const lonR = elong * D;
      const ra = wrap360(Math.atan2(Math.cos(eps * D) * Math.sin(lonR), Math.cos(lonR)) * R);
      const dec = Math.asin(Math.sin(eps * D) * Math.sin(lonR)) * R;
      const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // SATELLITES: geostationary belt at dec=0 (full ring) + ISS-band approximation (51.6° inclination)
  if (STATE.lens === "SATELLITES") {
    ctx.strokeStyle = "rgba(52,194,210,0.55)";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    // GEO belt approximation: subsatellite points all at dec ≈ 0
    ctx.beginPath();
    let started = false;
    for (let ra = 0; ra <= 360; ra += 3) {
      const h = eqToHorizon(ra, -7, STATE.lat, lstDeg); // GEO appears slightly below celestial equator from N hemisphere
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // ISS band (inclination 51.6°): trace lat ±51.6° max
    ctx.strokeStyle = "rgba(111,222,154,0.35)";
    ctx.beginPath();
    started = false;
    for (let lon = 0; lon <= 360; lon += 3) {
      const lonR = lon * D, incR = 51.6 * D;
      const dec = Math.asin(Math.sin(incR) * Math.sin(lonR)) * R;
      const ra = wrap360(Math.atan2(Math.cos(incR) * Math.sin(lonR), Math.cos(lonR)) * R);
      const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // SUN PATH — today's sun across sky from sunrise to sunset
  if (STATE.lens === "SUN PATH") {
    ctx.strokeStyle = "rgba(232,160,64,0.85)";
    ctx.lineWidth = 1.5;
    const noon = new Date(STATE.date.getFullYear(), STATE.date.getMonth(), STATE.date.getDate(), 12, 0, 0);
    let started = false;
    ctx.beginPath();
    for (let h = 0; h <= 24; h += 0.25) {
      const t = new Date(noon.getTime() + (h - 12) * 3600 * 1000);
      const jdt = julianDate(t);
      const lt = lst(jdt, STATE.lon);
      const sun = sunPosition(jdt);
      const horiz = eqToHorizon(sun.ra, sun.dec, STATE.lat, lt);
      const p = projAltAz(horiz.alt, horiz.az, R0);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // METEORS: radiants for showers active within ±15 days of peak
  let activeShowers = [];
  if (STATE.lens === "METEORS") {
    const now = STATE.date;
    for (const [name, mo, da, ra, dec, zhr] of SHOWERS) {
      const peak = new Date(now.getFullYear(), mo - 1, da, 22, 0);
      let dDays = Math.abs((now - peak) / 86400000);
      // wrap year
      if (dDays > 180) dDays = 365 - dDays;
      if (dDays <= 15) {
        const hh = eqToHorizon(ra, dec, STATE.lat, lstDeg);
        const p = projAltAz(hh.alt, hh.az, R0);
        activeShowers.push({ name, ra, dec, zhr, dDays, p });
      }
    }
    for (const s of activeShowers) {
      if (!s.p) continue;
      ctx.strokeStyle = "#ef6160";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(s.p.x, s.p.y, 14, 0, TAU);
      ctx.stroke();
      // crosshair
      ctx.beginPath();
      ctx.moveTo(s.p.x - 6, s.p.y); ctx.lineTo(s.p.x + 6, s.p.y);
      ctx.moveTo(s.p.x, s.p.y - 6); ctx.lineTo(s.p.x, s.p.y + 6);
      ctx.stroke();
    }
  }

  // CONSTELLATIONS: stick lines
  if (STATE.lens === "CONSTELLATIONS") {
    ctx.strokeStyle = "rgba(52,194,210,0.45)";
    ctx.lineWidth = 0.9;
    for (const [, lines] of Object.entries(CONSTELLATIONS)) {
      for (const [a, b] of lines) {
        const sa = STAR_IDX.get(a), sb = STAR_IDX.get(b);
        if (sa == null || sb == null) continue;
        const ha = eqToHorizon(STARS[sa][1], STARS[sa][2], STATE.lat, lstDeg);
        const hb = eqToHorizon(STARS[sb][1], STARS[sb][2], STATE.lat, lstDeg);
        const pa = projAltAz(ha.alt, ha.az, R0);
        const pb = projAltAz(hb.alt, hb.az, R0);
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
  }

  // STARS — always rendered
  for (let i = 0; i < STARS.length; i++) {
    const [name, ra, dec, mag] = STARS[i];
    const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
    const p = projAltAz(h.alt, h.az, R0);
    if (!p) continue;
    const sr = starRadius(mag);
    ctx.fillStyle = "#d8e4ec";
    ctx.beginPath(); ctx.arc(p.x, p.y, sr, 0, TAU); ctx.fill();
    if (mag <= 1.6 && STATE.lens !== "BARE") {
      // glow halo
      ctx.fillStyle = "rgba(216,228,236,0.18)";
      ctx.beginPath(); ctx.arc(p.x, p.y, sr * 2.5, 0, TAU); ctx.fill();
    }
  }

  // TARGETS: Messier markers
  let visibleMessiers = 0;
  if (STATE.lens === "TARGETS") {
    ctx.strokeStyle = "rgba(111,222,154,0.85)";
    ctx.lineWidth = 1;
    ctx.font = "10px JetBrains Mono, monospace";
    for (const [name, ra, dec, mag, kind] of MESSIER) {
      const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) continue;
      visibleMessiers++;
      ctx.beginPath();
      if (kind === "galaxy") {
        // ellipse
        ctx.ellipse(p.x, p.y, 7, 3, 0, 0, TAU);
      } else if (kind === "nebula") {
        ctx.rect(p.x - 5, p.y - 5, 10, 10);
      } else {
        // cluster: dotted circle
        ctx.arc(p.x, p.y, 6, 0, TAU);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(111,222,154,0.85)";
      const label = name.split(" ")[0];
      ctx.fillText(label, p.x + 9, p.y + 3);
    }
  }

  // PLANETS — drawn for VISIBLE, PLANETS lenses (not BARE)
  let visiblePlanets = [];
  if (STATE.lens !== "BARE") {
    for (const name of Object.keys(PEL)) {
      const eq = planetEq(name, jd);
      const h = eqToHorizon(eq.ra, eq.dec, STATE.lat, lstDeg);
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) continue;
      visiblePlanets.push({ name, alt: h.alt, az: h.az, p, mag: PMAG[name] });
      ctx.fillStyle = name === "Mars" ? "#ef6160" : (name === "Venus" ? "#fff3c4" : "#e8a040");
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(232,160,64,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.stroke();
      if (STATE.lens !== "BARE") {
        ctx.fillStyle = "#e8a040";
        ctx.font = "11px JetBrains Mono, monospace";
        ctx.fillText(name, p.x + 10, p.y + 3);
      }
    }
  }

  // MOON
  const moon = moonPosition(jd);
  const mh = eqToHorizon(moon.ra, moon.dec, STATE.lat, lstDeg);
  const mp = projAltAz(mh.alt, mh.az, R0);
  if (mp) {
    if (STATE.lens === "MOON") {
      // detailed moon — draw a circle with a phase shadow
      drawMoonDetail(ctx, mp.x, mp.y, 18, moon.elongation);
      ctx.fillStyle = "#d8e4ec";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText("MOON", mp.x + 22, mp.y + 4);
    } else if (STATE.lens !== "BARE") {
      ctx.fillStyle = "#d8e4ec";
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(216,228,236,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 9, 0, TAU); ctx.stroke();
    }
  }

  // SUN dot if above horizon (rare at 22:00 local but possible at high lat)
  const sun = sunPosition(jd);
  const sh = eqToHorizon(sun.ra, sun.dec, STATE.lat, lstDeg);
  if (sh.alt > 0 && STATE.lens !== "BARE") {
    const sp = projAltAz(sh.alt, sh.az, R0);
    if (sp) {
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = "#e8a040";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText("☉ sun above horizon", sp.x + 10, sp.y - 6);
    }
  }

  // Star labels for the brightest if in VISIBLE/PLANETS/CONSTELLATIONS
  if (STATE.lens === "VISIBLE" || STATE.lens === "CONSTELLATIONS") {
    ctx.fillStyle = "rgba(216,228,236,0.65)";
    ctx.font = "10px JetBrains Mono, monospace";
    for (const [name, ra, dec, mag] of STARS) {
      if (mag > 1.5) continue;
      const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
      const p = projAltAz(h.alt, h.az, R0);
      if (!p) continue;
      ctx.fillText(name, p.x + 6, p.y - 6);
    }
  }

  ctx.restore();

  // === Update readout strip ===
  document.getElementById('rvJd').textContent = jd.toFixed(3);
  document.getElementById('rvLst').textContent = (lstDeg / 15).toFixed(2) + "h";
  document.getElementById('rvMoon').textContent =
    moonGlyphFromElong(moon.elongation) + " " + Math.round(moon.phase * 100) + "%";
  document.getElementById('rvSun').textContent =
    "alt " + sh.alt.toFixed(0) + "°";
  const b = estimateBortle(STATE.lat, STATE.lon);
  document.getElementById('rvBortle').textContent = "B" + b.bortle;
  // Count visible naked-eye stars (mag <= 4 is typical naked-eye limit, 6 is dark-sky)
  let visStars = 0;
  for (const [, ra, dec, mag] of STARS) {
    if (mag > 4) continue;
    const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
    if (h.alt > 0) visStars++;
  }
  document.getElementById('rvVisible').textContent = visStars + "★";

  // === Caption ===
  const cap = buildCaption({
    lstDeg, jd, moon, sun, moonAlt: mh.alt, sunAlt: sh.alt,
    visiblePlanets, visibleMessiers, activeShowers,
    bortle: b.bortle
  });
  document.getElementById('caption').textContent = cap;
  document.getElementById('domeStamp').textContent = "// LENS · " + STATE.lens;
}

function buildCaption(x) {
  const moonGlyph = moonGlyphFromElong(x.moon.elongation);
  const phasePct = Math.round(x.moon.phase * 100);
  const phaseName = phaseNameFor(x.moon.elongation);
  switch (STATE.lens) {
    case "VISIBLE": {
      const top = x.visiblePlanets.sort((a,b) => a.mag - b.mag)[0];
      if (top) return `// brightest above you · ${top.name.toUpperCase()} · alt ${top.alt.toFixed(0)}° · az ${top.az.toFixed(0)}° · mag ${top.mag.toFixed(1)}`;
      return `// no planets above the horizon · ${moonGlyph} ${phaseName} ${phasePct}% · B${x.bortle} sky`;
    }
    case "CONSTELLATIONS":
      return `// stick figures drawn from ${STARS.length} bright stars · ${Object.keys(CONSTELLATIONS).length} constellations linked`;
    case "PLANETS":
      if (x.visiblePlanets.length === 0) return `// ecliptic charted · no planets above horizon at this hour`;
      return `// ecliptic + ${x.visiblePlanets.length} planets above horizon · ${x.visiblePlanets.map(p => p.name[0]).join("")}`;
    case "MOON":
      return `// ${moonGlyph} ${phaseName} · ${phasePct}% illuminated · alt ${x.moonAlt.toFixed(0)}°`;
    case "MILKY WAY":
      return `// galactic equator overlaid · band visibility depends on B${x.bortle} sky and altitude`;
    case "BORTLE": {
      const b = estimateBortle(STATE.lat, STATE.lon);
      return `// estimated B${b.bortle} · nearest large city ~${Math.round(b.nearestKm)} km`;
    }
    case "TARGETS":
      return `// ${x.visibleMessiers} of ${MESSIER.length} Messier targets above horizon now`;
    case "METEORS":
      if (x.activeShowers.length === 0) return `// no major showers within ±15 days · next: see calendar`;
      return `// active: ${x.activeShowers.map(s => `${s.name} (zhr~${s.zhr})`).join(" · ")}`;
    case "SATELLITES":
      return `// geostationary belt @ dec≈−7° + ISS LEO band (incl 51.6°)`;
    case "GRID":
      return `// equatorial grid · LST ${(x.lstDeg / 15).toFixed(2)}h · obs lat ${STATE.lat.toFixed(2)}°`;
    case "SUN PATH":
      return `// today's sun arc · noon alt ${maxSunAltToday().toFixed(0)}° · sunrise/sunset az tracked`;
    case "BARE":
      return `// stars only · ${STARS.length} catalog entries · no labels`;
    default:
      return "";
  }
}

function phaseNameFor(elong) {
  if (elong < 22.5) return "new moon";
  if (elong < 67.5) return "waxing crescent";
  if (elong < 112.5) return "first quarter";
  if (elong < 157.5) return "waxing gibbous";
  if (elong < 202.5) return "full moon";
  if (elong < 247.5) return "waning gibbous";
  if (elong < 292.5) return "last quarter";
  if (elong < 337.5) return "waning crescent";
  return "new moon";
}

function maxSunAltToday() {
  // sun max altitude at noon: alt = 90 - |lat - dec|
  const noon = new Date(STATE.date.getFullYear(), STATE.date.getMonth(), STATE.date.getDate(), 12, 0, 0);
  const sun = sunPosition(julianDate(noon));
  return 90 - Math.abs(STATE.lat - sun.dec);
}

// Galactic band: approximate galactic equator → equatorial → horizontal
function drawGalacticBand(ctx, R0, lstDeg) {
  // Galactic pole RA=192.86°, Dec=+27.13° (J2000)
  const gpRA = 192.86 * D, gpDec = 27.13 * D;
  // Sample a great circle perpendicular to galactic pole (the galactic equator)
  // Generate by parametrizing along the celestial equator perpendicular to the pole
  ctx.beginPath();
  let started = false;
  for (let phi = 0; phi <= 360; phi += 3) {
    // Sample point on galactic equator: rotate from pole by 90°
    // Use spherical formula: point at galactic lon phi, lat 0 → equatorial
    // Simplification: bouncing-circle approximation
    const phiR = phi * D;
    // direction in galactic frame: (cos phi, sin phi, 0)
    // rotate to equatorial: orient z toward galactic pole
    const sinDecP = Math.sin(gpDec), cosDecP = Math.cos(gpDec);
    // build basis: ẑ_g = (cos gpDec cos gpRA, cos gpDec sin gpRA, sin gpDec)
    const zx = cosDecP * Math.cos(gpRA), zy = cosDecP * Math.sin(gpRA), zz = sinDecP;
    // x̂_g pick = perpendicular, in equatorial xy plane
    const xx = -Math.sin(gpRA), xy = Math.cos(gpRA), xz = 0;
    // ŷ_g = ẑ_g × x̂_g
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    // point: cos(phi) x̂_g + sin(phi) ŷ_g
    const px = Math.cos(phiR) * xx + Math.sin(phiR) * yx;
    const py = Math.cos(phiR) * xy + Math.sin(phiR) * yy;
    const pz = Math.cos(phiR) * xz + Math.sin(phiR) * yz;
    const ra = wrap360(Math.atan2(py, px) * R);
    const dec = Math.asin(pz) * R;
    const h = eqToHorizon(ra, dec, STATE.lat, lstDeg);
    const p = projAltAz(h.alt, h.az, R0);
    if (!p) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawMoonDetail(ctx, x, y, r, elong) {
  // draw a moon disc with a phase shadow
  ctx.save();
  ctx.translate(x, y);
  // disc
  ctx.fillStyle = "#e8eef3";
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // phase shadow: elong 0 = new (full shadow), 180 = full (no shadow)
  // Angle from new
  const fraction = (1 - Math.cos(elong * D)) / 2; // 0..1 illuminated
  const waxing = elong <= 180;
  // Draw shadow as ellipse over the dark side
  ctx.fillStyle = "#0c1117";
  ctx.beginPath();
  if (fraction < 0.5) {
    // crescent: dark covers most. Two arcs.
    const k = 1 - fraction * 2; // 1..0
    if (waxing) {
      // dark covers right side initially? Actually for waxing 0→0.5, dark is on the LEFT.
      // We approximate phase as: light side is hemisphere oriented away from sun.
      // For simplicity render shadow as ellipse on dark side
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, false);
    } else {
      ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(0, 0, r * k, r, 0, -Math.PI / 2, Math.PI / 2, false);
    }
  } else {
    const k = (fraction - 0.5) * 2; // 0..1
    if (waxing) {
      ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(0, 0, r * k, r, 0, -Math.PI / 2, Math.PI / 2, true);
    } else {
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, true);
    }
  }
  ctx.fill();
  // limb ring
  ctx.strokeStyle = "rgba(216,228,236,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  // libration tick
  ctx.fillStyle = "rgba(216,228,236,0.7)";
  ctx.font = "9px JetBrains Mono, monospace";
  ctx.fillText("⊙", -3, 3);
  ctx.restore();
}

// ============================================================
// (10) Calendar
// ============================================================
function buildCalendar() {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = "";
  const today = new Date(); today.setHours(22, 0, 0, 0);
  const todayKey = today.toDateString();
  // Pad to start on weekday Sunday (0) for visual sense
  const firstDow = today.getDay();
  for (let i = 0; i < firstDow; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (d.toDateString() === todayKey) cell.classList.add('today');
    const jd = julianDate(d);
    const moon = moonPosition(jd);
    const tag = bestTagFor(d, jd, moon);
    cell.innerHTML = `<span class="cal-day">${d.getDate()}</span>` +
                     `<span class="cal-moon">${moonGlyphFromElong(moon.elongation)}</span>` +
                     `<span class="cal-tag">${tag}</span>`;
    cell.title = d.toDateString() + " · " + phaseNameFor(moon.elongation);
    grid.appendChild(cell);
  }
}

function bestTagFor(d, jd, moon) {
  // Rank: meteor shower peak day > new-moon dark-sky window > planet at opposition
  for (const [name, mo, da, ra, dec, zhr] of SHOWERS) {
    if (d.getMonth() + 1 === mo && d.getDate() === da) return "☄";
  }
  if (moon.elongation < 15 || moon.elongation > 345) return "★"; // new-moon dark sky
  if (Math.abs(moon.elongation - 180) < 5) return "○"; // full moon
  // Brightest planet visible above horizon at 22:00
  const lstDeg = lst(jd, STATE.lon);
  let best = null;
  for (const name of Object.keys(PEL)) {
    const eq = planetEq(name, jd);
    const h = eqToHorizon(eq.ra, eq.dec, STATE.lat, lstDeg);
    if (h.alt > 25) {
      if (!best || PMAG[name] < best.mag) best = { name, mag: PMAG[name] };
    }
  }
  if (best) return best.name[0];
  return "·";
}

// ============================================================
// (11) UI wiring
// ============================================================
function buildLensStrip() {
  const strip = document.getElementById('lensStrip');
  strip.innerHTML = "";
  for (const [key, sub] of LENSES) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'tab');
    b.textContent = key;
    b.title = sub;
    b.dataset.lens = key;
    b.setAttribute('aria-selected', STATE.lens === key ? 'true' : 'false');
    b.addEventListener('click', () => {
      STATE.lens = key;
      Array.from(strip.children).forEach(el => el.setAttribute('aria-selected', el.dataset.lens === key ? 'true' : 'false'));
      render();
      writeHash();
    });
    strip.appendChild(b);
  }
}

function setLocLabel() {
  document.getElementById('locLabel').textContent =
    (STATE.locName || 'observer') + ' · ' + STATE.lat.toFixed(2) + '°,' + STATE.lon.toFixed(2) + '°';
  document.getElementById('kicker').textContent =
    'tonight at 22:00 local · ' + STATE.date.toDateString().toLowerCase();
}

function readHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  const params = new URLSearchParams(h);
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const lens = params.get('lens');
  const loc = params.get('loc');
  if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    STATE.lat = lat; STATE.lon = lon;
    if (loc) STATE.locName = decodeURIComponent(loc);
    else STATE.locName = lat.toFixed(2) + '°,' + lon.toFixed(2) + '°';
  }
  if (lens && LENSES.some(([k]) => k === lens)) STATE.lens = lens;
  return true;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set('lat', STATE.lat.toFixed(4));
  params.set('lon', STATE.lon.toFixed(4));
  params.set('lens', STATE.lens);
  if (STATE.locName) params.set('loc', encodeURIComponent(STATE.locName));
  history.replaceState(null, '', '#' + params.toString());
}

function setupCityPicker() {
  const sel = document.getElementById('cityPick');
  for (const [name, lat, lon] of CITIES) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
}

function setupDialog() {
  const dlg = document.getElementById('locDialog');
  const open = () => {
    document.getElementById('latIn').value = STATE.lat.toFixed(4);
    document.getElementById('lonIn').value = STATE.lon.toFixed(4);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  };
  const close = () => { dlg.close(); };
  document.getElementById('locBtn').addEventListener('click', open);
  document.getElementById('dlgCancel').addEventListener('click', close);
  document.getElementById('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { alert('your browser has no geolocation api · try the city picker'); return; }
    document.getElementById('geoBtn').textContent = 'pinging satellites…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        STATE.lat = pos.coords.latitude;
        STATE.lon = pos.coords.longitude;
        STATE.locName = STATE.lat.toFixed(2) + '°,' + STATE.lon.toFixed(2) + '°';
        applyAndClose();
      },
      (err) => {
        document.getElementById('geoBtn').textContent = 'denied · pick a city instead';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
  document.getElementById('cityPick').addEventListener('change', (e) => {
    const v = e.target.value;
    const c = CITIES.find(c => c[0] === v);
    if (c) {
      STATE.lat = c[1]; STATE.lon = c[2]; STATE.locName = c[0];
      document.getElementById('latIn').value = STATE.lat.toFixed(4);
      document.getElementById('lonIn').value = STATE.lon.toFixed(4);
    }
  });
  document.getElementById('locForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = parseFloat(document.getElementById('latIn').value);
    const lon = parseFloat(document.getElementById('lonIn').value);
    if (!isNaN(lat) && !isNaN(lon)) {
      STATE.lat = lat; STATE.lon = lon;
      const sel = document.getElementById('cityPick');
      if (sel.value) STATE.locName = sel.value;
      else STATE.locName = lat.toFixed(2) + '°,' + lon.toFixed(2) + '°';
    }
    applyAndClose();
  });
  function applyAndClose() {
    setLocLabel(); render(); buildCalendar(); writeHash(); close();
  }
}

function setupCopyLink() {
  document.getElementById('copyLink').addEventListener('click', async () => {
    writeHash();
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      document.getElementById('copyStatus').textContent = '· copied';
    } catch {
      document.getElementById('copyStatus').textContent = '· select the URL bar';
    }
    setTimeout(() => { document.getElementById('copyStatus').textContent = ''; }, 2400);
  });
}

// ============================================================
// (12) Init
// ============================================================
function init() {
  STATE.date = tonightAt22();
  readHash();
  setupCityPicker();
  setupDialog();
  setupCopyLink();
  buildLensStrip();
  setLocLabel();
  buildCalendar();
  // Defer first render past first layout to avoid the canvas pre-layout sizing race
  // (see ai-pitfalls.md "Canvas pre-layout sizing race").
  requestAnimationFrame(() => render());
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => render());
    ro.observe(document.getElementById('dome'));
  } else {
    window.addEventListener('resize', () => render());
  }
}

// Generic share stub — kept for skill template compliance even though the
// dashboard pattern (live-data-substrate.md) uses a permalink rather than a
// share button. Not wired into the UI.
function share() {
  if (navigator.share) navigator.share({ title: document.title, url: location.href });
  else if (navigator.clipboard) navigator.clipboard.writeText(location.href);
}

document.addEventListener('DOMContentLoaded', init);
