// Tide Diviner — 14-day coastal almanac.
// Live data: Open-Meteo Marine + Forecast (no key). Deterministic verdicts and
// glyphs from real data + seeded RNG (city + day). No LLM. The page IS the share.

(() => {
  'use strict';

  // ---------- Config ----------
  const DEFAULT_CITY = {
    name: 'Boston',
    country: 'United States',
    admin1: 'Massachusetts',
    lat: 42.3584,
    lon: -71.0598,
    tz: 'America/New_York',
  };
  const FALLBACK_PORTS = [
    { name: 'Boston', country: 'United States', admin1: 'Massachusetts', lat: 42.3584, lon: -71.0598, tz: 'America/New_York' },
    { name: 'Lisbon', country: 'Portugal', admin1: '', lat: 38.7170, lon: -9.1395, tz: 'Europe/Lisbon' },
    { name: 'Sydney', country: 'Australia', admin1: 'New South Wales', lat: -33.8678, lon: 151.2073, tz: 'Australia/Sydney' },
    { name: 'Half Moon Bay', country: 'United States', admin1: 'California', lat: 37.4636, lon: -122.4286, tz: 'America/Los_Angeles' },
    { name: 'Reykjavík', country: 'Iceland', admin1: '', lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' },
    { name: 'Cape Town', country: 'South Africa', admin1: 'Western Cape', lat: -33.9249, lon: 18.4241, tz: 'Africa/Johannesburg' },
  ];

  const LENSES = [
    { id: 'tide',        label: 'tide' },
    { id: 'moon',        label: 'moon' },
    { id: 'sun',         label: 'sunrise-sunset' },
    { id: 'sst',         label: 'sst' },
    { id: 'currents',    label: 'currents' },
    { id: 'swell',       label: 'swell' },
    { id: 'springneap',  label: 'spring-neap' },
    { id: 'lunilum',     label: 'lunar-illumination' },
    { id: 'wind',        label: 'wind' },
    { id: 'pressure',    label: 'pressure' },
    { id: 'iss',         label: 'iss-pass' },
    { id: 'dockcat',     label: 'the-dock-cat-says' },
  ];

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const cityInput = $('city-input');
  const cityBtn = $('city-search');
  const cityResults = $('city-results');
  const portName = $('port-name');
  const portCoord = $('port-coord');
  const portStamped = $('port-stamped');
  const stripUnits = $('strip-units');
  const stripEl = $('strip');
  const stripStatus = $('strip-status');
  const lensChipsEl = $('lens-chips');
  const dayPanel = $('day-panel');
  const dayPanelBody = $('day-panel-body');
  const panelClose = $('panel-close');
  const copyLink = $('copy-link');

  // ---------- State ----------
  const state = {
    city: null,
    activeLens: 'tide',
    dataCache: null,    // last fetched marine + forecast
    days: null,         // computed day records (14)
    openDayIdx: null,
    availableLenses: new Set(LENSES.map(l => l.id)),
  };

  // ---------- Hash utilities ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // Mulberry32 PRNG
  function rng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(arr, rngFn) { return arr[Math.floor(rngFn() * arr.length)]; }

  // ---------- Permalink ----------
  function encodeHash(city, lensId) {
    const slug = (city.name || 'port').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const lat = Math.round(city.lat * 1000) / 1000;
    const lon = Math.round(city.lon * 1000) / 1000;
    const parts = [
      `c=${slug}`,
      `lat=${lat}`,
      `lon=${lon}`,
      `lens=${lensId}`,
    ];
    if (city.country) parts.push(`cc=${encodeURIComponent(city.country)}`);
    if (city.admin1)  parts.push(`r=${encodeURIComponent(city.admin1)}`);
    if (city.tz)      parts.push(`tz=${encodeURIComponent(city.tz)}`);
    return parts.join('&');
  }
  function decodeHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return null;
    const out = {};
    h.split('&').forEach(p => {
      const [k, v] = p.split('=');
      if (!k) return;
      out[k] = v == null ? '' : decodeURIComponent(v);
    });
    if (!out.lat || !out.lon) return null;
    const lat = Number(out.lat), lon = Number(out.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      city: {
        name: (out.c || 'port').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        country: out.cc || '',
        admin1: out.r || '',
        lat, lon,
        tz: out.tz || 'auto',
      },
      lens: out.lens || 'tide',
    };
  }
  function writeHash() {
    if (!state.city) return;
    const h = '#' + encodeHash(state.city, state.activeLens);
    history.replaceState(null, '', h);
  }

  // ---------- Astronomy: moon phase (Conway's approximation, refined) ----------
  // Returns { age (days 0-29.53), phaseIdx (0-7), illum (0-1), name, glyph }
  const MOON_GLYPHS = ['(  )', '( ◔)', '( ◑)', '(◕ )', '(●●)', '(◗ )', '(◐ )', '(◔ )'];
  const MOON_NAMES = [
    'new', 'waxing crescent', 'first quarter', 'waxing gibbous',
    'full', 'waning gibbous', 'last quarter', 'waning crescent',
  ];
  function moonAge(date) {
    // Reference new moon: 2000-01-06 18:14 UTC (approx).
    const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
    const SYN = 29.53058867;
    const days = (date.getTime() - ref) / 86400000;
    let age = days % SYN;
    if (age < 0) age += SYN;
    return age;
  }
  function moonInfo(date) {
    const age = moonAge(date);
    const SYN = 29.53058867;
    const frac = age / SYN;
    const phaseIdx = Math.floor(((frac * 8) + 0.5)) % 8;
    // Illumination: 0.5 * (1 - cos(2π * frac))
    const illum = 0.5 * (1 - Math.cos(2 * Math.PI * frac));
    return {
      age, phaseIdx, illum,
      name: MOON_NAMES[phaseIdx],
      glyph: MOON_GLYPHS[phaseIdx],
    };
  }

  // ---------- Tide extrema detection ----------
  // From hourly sea_level_height_msl: find local maxima/minima.
  function detectExtrema(times, heights) {
    const ext = [];
    for (let i = 1; i < heights.length - 1; i++) {
      const a = heights[i - 1], b = heights[i], c = heights[i + 1];
      if (b == null || a == null || c == null) continue;
      if (b > a && b >= c) ext.push({ idx: i, type: 'high', t: times[i], h: b });
      else if (b < a && b <= c) ext.push({ idx: i, type: 'low', t: times[i], h: b });
    }
    return ext;
  }

  // ---------- Geocoding ----------
  async function searchCity(q) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('geocoding failed');
    const j = await res.json();
    return (j.results || []);
  }

  // ---------- Open-Meteo fetches ----------
  async function fetchAlmanac(city) {
    const lat = city.lat.toFixed(4);
    const lon = city.lon.toFixed(4);
    const tz = city.tz && city.tz !== 'auto' ? encodeURIComponent(city.tz) : 'auto';

    const marineUrl =
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
      `&hourly=sea_level_height_msl,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,wave_height,wave_direction,wave_period` +
      `&forecast_days=14&timezone=${tz}`;

    const fcUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=sunrise,sunset` +
      `&hourly=wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover` +
      `&forecast_days=14&timezone=${tz}&wind_speed_unit=kn`;

    const [marineRes, fcRes] = await Promise.all([fetch(marineUrl), fetch(fcUrl)]);

    let marine = null;
    if (marineRes.ok) {
      try { marine = await marineRes.json(); } catch { marine = null; }
    }
    if (!fcRes.ok) throw new Error('forecast fetch failed');
    const forecast = await fcRes.json();
    return { marine, forecast };
  }

  // ---------- Build day records from API responses ----------
  function buildDays(city, marine, forecast) {
    // forecast.daily.time is local YYYY-MM-DD list (length 14 expected).
    const days = forecast.daily.time.map((dStr, i) => ({
      dateStr: dStr,
      sunrise: forecast.daily.sunrise[i],
      sunset: forecast.daily.sunset[i],
      hours: { wind_speed: [], wind_dir: [], pressure: [], cloud: [] },
      tide: { heights: [], times: [], extrema: [], min: null, max: null, range: null, hadHighFirst: null },
      sst: { mean: null, min: null, max: null },
      current: { mean_v: null, max_v: null, mean_dir: null },
      swell: { mean_h: null, max_h: null, mean_period: null },
    }));

    // Walk hourly forecast (local times like '2026-05-02T00:00').
    const fcTimes = forecast.hourly.time;
    const wind = forecast.hourly.wind_speed_10m || [];
    const windDir = forecast.hourly.wind_direction_10m || [];
    const press = forecast.hourly.surface_pressure || [];
    const cloud = forecast.hourly.cloud_cover || [];
    fcTimes.forEach((t, i) => {
      const dStr = t.slice(0, 10);
      const idx = days.findIndex(d => d.dateStr === dStr);
      if (idx < 0) return;
      if (wind[i] != null) days[idx].hours.wind_speed.push(wind[i]);
      if (windDir[i] != null) days[idx].hours.wind_dir.push(windDir[i]);
      if (press[i] != null) days[idx].hours.pressure.push(press[i]);
      if (cloud[i] != null) days[idx].hours.cloud.push(cloud[i]);
    });

    // Marine hourly.
    if (marine && marine.hourly && marine.hourly.time) {
      const mTimes = marine.hourly.time;
      const mH = marine.hourly.sea_level_height_msl || [];
      const mSST = marine.hourly.sea_surface_temperature || [];
      const mCV = marine.hourly.ocean_current_velocity || [];
      const mCD = marine.hourly.ocean_current_direction || [];
      const mWH = marine.hourly.wave_height || [];
      const mWP = marine.hourly.wave_period || [];

      // Per-day buckets
      const buckets = days.map(() => ({ heights: [], times: [], sst: [], cv: [], cd: [], wh: [], wp: [] }));
      mTimes.forEach((t, i) => {
        const dStr = t.slice(0, 10);
        const idx = days.findIndex(d => d.dateStr === dStr);
        if (idx < 0) return;
        const b = buckets[idx];
        if (mH[i] != null)   { b.heights.push(mH[i]); b.times.push(t); }
        if (mSST[i] != null) b.sst.push(mSST[i]);
        if (mCV[i] != null)  b.cv.push(mCV[i]);
        if (mCD[i] != null)  b.cd.push(mCD[i]);
        if (mWH[i] != null)  b.wh.push(mWH[i]);
        if (mWP[i] != null)  b.wp.push(mWP[i]);
      });

      // Detect extrema across the whole timeseries (so transitions work near day boundaries),
      // then assign each extremum to the day it falls on.
      const allExt = (mH.length && mTimes.length) ? detectExtremaAcross(mTimes, mH) : [];
      buckets.forEach((b, i) => {
        const d = days[i];
        if (b.heights.length) {
          d.tide.heights = b.heights;
          d.tide.times = b.times;
          d.tide.min = Math.min(...b.heights);
          d.tide.max = Math.max(...b.heights);
          d.tide.range = d.tide.max - d.tide.min;
          // First extremum within day decides initial direction
          const dExt = allExt.filter(e => e.t.slice(0, 10) === d.dateStr);
          d.tide.extrema = dExt;
          if (dExt.length) d.tide.hadHighFirst = (dExt[0].type === 'high');
        }
        if (b.sst.length) {
          d.sst.mean = avg(b.sst); d.sst.min = Math.min(...b.sst); d.sst.max = Math.max(...b.sst);
        }
        if (b.cv.length) {
          d.current.mean_v = avg(b.cv); d.current.max_v = Math.max(...b.cv);
          if (b.cd.length) d.current.mean_dir = circMean(b.cd);
        }
        if (b.wh.length) {
          d.swell.mean_h = avg(b.wh); d.swell.max_h = Math.max(...b.wh);
          if (b.wp.length) d.swell.mean_period = avg(b.wp);
        }
      });
    }

    // Compute moon for each day at noon local-ish time (use 12:00 UTC of the given local date for stability).
    days.forEach(d => {
      const date = new Date(d.dateStr + 'T12:00:00Z');
      d.moon = moonInfo(date);
    });

    // Spring/neap: tidal range vs portfolio max.
    const ranges = days.map(d => d.tide.range).filter(v => v != null);
    if (ranges.length) {
      const rMin = Math.min(...ranges);
      const rMax = Math.max(...ranges);
      days.forEach(d => {
        if (d.tide.range == null) { d.tide.springiness = null; return; }
        d.tide.springiness = rMax > rMin ? (d.tide.range - rMin) / (rMax - rMin) : 0.5;
      });
    }

    return days;
  }
  function detectExtremaAcross(times, heights) {
    const ext = [];
    for (let i = 1; i < heights.length - 1; i++) {
      const a = heights[i - 1], b = heights[i], c = heights[i + 1];
      if (b == null || a == null || c == null) continue;
      if (b > a && b >= c) ext.push({ idx: i, type: 'high', t: times[i], h: b });
      else if (b < a && b <= c) ext.push({ idx: i, type: 'low', t: times[i], h: b });
    }
    return ext;
  }
  function avg(arr) { let s = 0; for (const v of arr) s += v; return arr.length ? s / arr.length : null; }
  function circMean(degArr) {
    let sx = 0, sy = 0;
    for (const d of degArr) { const r = d * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); }
    let a = Math.atan2(sy, sx) * 180 / Math.PI;
    if (a < 0) a += 360;
    return a;
  }

  // ---------- ASCII chart rendering ----------
  function tideChartLine(day, columns) {
    if (!day.tide.heights.length) return '— no marine tide data —'.padEnd(columns, ' ');
    const heights = day.tide.heights;
    const n = heights.length;
    const min = day.tide.min;
    const max = day.tide.max;
    const range = max - min || 0.0001;
    // 4-row ASCII strip — but we want a single line for the strip view.
    // Use a single-row glyph encoding height into 8 levels.
    const glyphs = ['_', '.', '-', '~', '=', '*', '#', '@'];
    let s = '';
    // Resample to columns.
    for (let c = 0; c < columns; c++) {
      const idx = Math.min(n - 1, Math.round((c / (columns - 1)) * (n - 1)));
      const h = heights[idx];
      const norm = (h - min) / range;
      const gIdx = Math.min(glyphs.length - 1, Math.max(0, Math.floor(norm * glyphs.length)));
      s += glyphs[gIdx];
    }
    return s;
  }
  function genericChartLine(values, columns, levels) {
    if (!values || !values.length) return ''.padEnd(columns, '·');
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    let s = '';
    for (let c = 0; c < columns; c++) {
      const idx = Math.min(values.length - 1, Math.round((c / (columns - 1)) * (values.length - 1)));
      const norm = (values[idx] - min) / range;
      const gIdx = Math.min(levels.length - 1, Math.max(0, Math.floor(norm * levels.length)));
      s += levels[gIdx];
    }
    return s;
  }

  // ---------- Verdict catalogs ----------
  // Each catalog is keyed by lens; each entry produces a deterministic line
  // from the day record + per-day-seeded RNG.

  const TIDE_PUNCH = [
    'do not fish for opinions', 'the gulls outvote you', 'lash anything you love down', 'a calm bullying',
    'meet me at the buoy', 'count rocks like rosary beads', 'consult a kelp forest', 'do nothing legibly',
    'wear the wet jacket', 'the dock will lie about its age', 'a forgiving wave', 'a punishing one too',
    'send the boat, leave the boots', 'an honest tide', 'tide files for divorce', 'the harbor laughs softly',
  ];
  const NEAP_PUNCH = [
    'a small ocean today', 'water on standby', 'flat as a barometer', 'dignified, unrushed',
    'put the chair on the rocks', 'tide takes a half-day', 'low drama, low water', 'an introvert ocean',
  ];
  const SPRING_PUNCH = [
    'a wide ocean today', 'tide swings the door open', 'the rocks come out and bow', 'water with appetite',
    'pull tide pools rated PG-13', 'the bay exhales hard', 'big breath, big return', 'a generous tide',
  ];
  const STORMY_PUNCH = [
    'wind tries to read your mail', 'rope check, twice', 'a salt-sprayed Tuesday', 'don\'t argue with the bay',
    'the gulls are sideways', 'lash, then leave', 'the harbor keeps your hat', 'whitecaps with attitude',
  ];

  const MOON_LINES = {
    0: ['blackest sky, brightest stars', 'no moon, all rumour', 'the dock is honest tonight', 'sky returns to plain'],
    1: ['a thin coin of moon', 'sliver pinned to the west', 'almost-nothing, then more', 'first eyebrow of moon'],
    2: ['half-moon at attention', 'sky cut in two parts', 'a fair-shared sky', 'moon at quarter mast'],
    3: ['moon nearly all the way', 'a swelling moon', 'almost full, almost loud', 'plump pre-moon'],
    4: ['full moon, fully employed', 'sky pays out', 'the harbor hums tonight', 'moon at full volume'],
    5: ['moon shedding shifts', 'cooling moon', 'a gibbous in retreat', 'moon, slightly tired'],
    6: ['half-moon clocking out', 'sky cut the other way', 'a settling moon', 'second quarter mast'],
    7: ['moon almost gone', 'last sliver, last whisper', 'closing moon', 'the night clears its desk'],
  };

  const SUN_LINES = [
    'long wedge of daylight', 'a tall hour either side', 'short fuse of sun', 'plenty of light to apologize in',
    'sunlight clipped at both ends', 'the day pays you back at dawn', 'twilight does most of the work',
    'sun packs early, sun stays late', 'a stingy day', 'a generous day',
  ];
  const SST_LINES = [
    'water cold enough to keep secrets', 'sea will accept your toes', 'cool but reasonable', 'tepid, suspiciously',
    'warm enough to argue about', 'cold enough to brag about', 'a real-feel sea', 'temperature with opinions',
  ];
  const CURRENT_LINES = [
    'water pulled like a drawer', 'ocean walking with intent', 'a brisk current today', 'water lazes',
    'current drags the lobster pots crooked', 'a current with a destination', 'the channel rules', 'flat-flow day',
  ];
  const SWELL_LINES = [
    'corduroy ocean', 'wave train with manners', 'short-period chop', 'long-period heaves',
    'glass with bumps', 'a surfable Tuesday', 'flat, contemplative', 'lumpy water, no commitment',
  ];
  const WIND_LINES = [
    'wind on a leash', 'wind off the leash', 'a knot or two of insolence', 'sail-shredder',
    'enough wind to flatter the flag', 'flag at attention', 'flag falls asleep', 'breeze with a vendetta',
  ];
  const PRESSURE_LINES = [
    'pressure climbs, the cat is smug', 'pressure dives, gulls go quiet', 'a barometric pep talk', 'a baromentric whine',
    'high and steady', 'low and brooding', 'pressure shrugs', 'a falling glass tells the truth',
  ];
  const SPRING_NEAP_LINES = [
    'tide stretches the calendar', 'a neap interlude', 'spring tide setup', 'tide takes a deep breath',
    'water lives wider today', 'water lives narrower', 'between two pulls', 'mid-cycle, mid-mood',
  ];
  const ILLUM_LINES = [
    'shadows do most of the heavy work', 'enough moonlight to read by', 'half-lit harbor', 'flooded with lunar honesty',
    'a dim watch night', 'a bright watch night', 'low-illumination night, high-feeling', 'illumination at full volume',
  ];
  const ISS_LINES = [
    'station overhead, briefly', 'wave at the orbit', 'a bright dot moves WSW→NE', 'no scheduled pass tonight',
    'the station notes you exist', 'orbital metronome', 'silent flyby, salute anyway', 'sky has a moving part',
  ];
  const DOCK_CAT_LINES = [
    'cat on barrel, judging', 'cat asleep on rope', 'cat ignores the gull, again', 'cat licks one paw with finality',
    'cat steals a chip, owes nothing', 'cat eyes the ferry', 'cat naps through high tide', 'cat audits the moon',
    'cat watches you, waiting', 'cat prefers the leeward side', 'cat hates the foghorn', 'cat lectures the rope',
    'cat charges admission for petting', 'cat retired at 3pm', 'cat keeps the lighthouse honest', 'cat declines the storm',
    'cat counts buoys, not days', 'cat refuses tuna, again', 'cat has opinions on the captain', 'cat winks once, decisively',
    'cat sniffs salt, stays', 'cat declines comment', 'cat naps in coiled rope', 'cat times the tides perfectly',
    'cat wears the wind', 'cat patrols the gangway', 'cat audits the catch', 'cat is the harbormaster',
    'cat negotiates with seagulls', 'cat fines the wind for being early', 'cat fines the wind for being late', 'cat sleeps through paperwork',
    'cat refuses the pier 17 cat', 'cat tolerates the marina pup', 'cat charges interest', 'cat watches the boat leave',
    'cat refuses the harbor master', 'cat outranks the foreman', 'cat eats one anchovy, savours it', 'cat declines the moon',
    'cat purrs at low pressure', 'cat hisses at high pressure', 'cat counts boats, sleeps', 'cat catches the smell of rain',
    'cat sleeps belly up on tarp', 'cat names the buoys, secretly', 'cat owes you nothing', 'cat suspects the gulls',
    'cat owns this dock now', 'cat tracks the fog by paw', 'cat bird-watches the cormorants', 'cat refuses the kayakers',
    'cat dignifies one tourist', 'cat eats the captain\'s sandwich', 'cat ignores the storm bell', 'cat auditioned, was hired',
    'cat thinks the moon is a lamp', 'cat thinks the lamp is the moon', 'cat is the senior tide observer', 'cat retires at sunset, again',
  ];

  const VERDICT_TAGS = {
    tide: 'tide:',
    moon: 'moon:',
    sun: 'sun:',
    sst: 'sst:',
    currents: 'flow:',
    swell: 'swell:',
    springneap: 'pull:',
    lunilum: 'lumen:',
    wind: 'wind:',
    pressure: 'baro:',
    iss: 'orbit:',
    dockcat: 'cat says:',
  };

  // ---------- Per-lens text + glyph + chart for a day ----------
  function dayLensSummary(day, lens, citySeed, dayIdx) {
    const seed = citySeed ^ hashStr(day.dateStr) ^ hashStr(lens);
    const r = rng(seed);
    const COLS = 22; // strip chart width

    let chart = '';
    let glyph = '·';
    let line = '';

    switch (lens) {
      case 'tide': {
        chart = tideChartLine(day, COLS);
        // Choose a punchline bank based on day characteristics.
        let bank = TIDE_PUNCH;
        if (day.tide.springiness != null && day.tide.springiness > 0.66) bank = SPRING_PUNCH;
        else if (day.tide.springiness != null && day.tide.springiness < 0.33) bank = NEAP_PUNCH;
        // Stormy override: if wind avg high or pressure low, use stormy bank some of the time
        const wMean = day.hours.wind_speed.length ? avg(day.hours.wind_speed) : 0;
        if (wMean > 18 && r() < 0.5) bank = STORMY_PUNCH;
        line = pick(bank, r);
        glyph = day.moon ? day.moon.glyph[2] : '~';
        break;
      }
      case 'moon': {
        const m = day.moon;
        chart = moonChartLine(m, COLS);
        line = pick(MOON_LINES[m.phaseIdx] || MOON_LINES[0], r);
        glyph = m.glyph[1] || '◐';
        break;
      }
      case 'sun': {
        chart = sunChartLine(day, COLS);
        line = pick(SUN_LINES, r);
        glyph = '☼';
        break;
      }
      case 'sst': {
        if (day.sst.mean == null) { line = '— no sst data —'; chart = ''.padEnd(COLS, '·'); break; }
        const vals = day.tide.heights.length ? sampleSeries(day.tide.heights, COLS) : null;
        // Use SST hourly via tide.heights series stand-in is wrong; use sst series approximated from min/mean/max.
        chart = sstChartLine(day, COLS);
        line = pick(SST_LINES, r);
        glyph = '≈';
        break;
      }
      case 'currents': {
        if (day.current.mean_v == null) { line = '— no current data —'; chart = ''.padEnd(COLS, '·'); break; }
        chart = currentChartLine(day, COLS);
        line = pick(CURRENT_LINES, r);
        glyph = '→';
        break;
      }
      case 'swell': {
        if (day.swell.mean_h == null) { line = '— no swell data —'; chart = ''.padEnd(COLS, '·'); break; }
        chart = swellChartLine(day, COLS);
        line = pick(SWELL_LINES, r);
        glyph = '〰';
        break;
      }
      case 'springneap': {
        chart = springNeapChartLine(day, COLS);
        if (day.tide.springiness == null) { line = '— spring/neap unknown —'; break; }
        line = pick(SPRING_NEAP_LINES, r);
        glyph = day.tide.springiness > 0.5 ? '▲' : '▼';
        break;
      }
      case 'lunilum': {
        chart = illumChartLine(day, COLS);
        line = pick(ILLUM_LINES, r);
        glyph = day.moon.illum >= 0.5 ? '○' : '◌';
        break;
      }
      case 'wind': {
        if (!day.hours.wind_speed.length) { line = '— no wind data —'; chart = ''.padEnd(COLS, '·'); break; }
        chart = genericChartLine(day.hours.wind_speed, COLS, ['.', ':', '-', '+', '*', '#', '@']);
        line = pick(WIND_LINES, r);
        glyph = '≀';
        break;
      }
      case 'pressure': {
        if (!day.hours.pressure.length) { line = '— no pressure data —'; chart = ''.padEnd(COLS, '·'); break; }
        chart = genericChartLine(day.hours.pressure, COLS, ['_', '.', '-', '~', '=', '*', '#']);
        line = pick(PRESSURE_LINES, r);
        glyph = '↕';
        break;
      }
      case 'iss': {
        chart = issChartLine(day, COLS);
        line = pick(ISS_LINES, r);
        glyph = '·';
        break;
      }
      case 'dockcat': {
        chart = dockCatChartLine(day, COLS);
        line = pick(DOCK_CAT_LINES, r);
        glyph = '∽';
        break;
      }
      default:
        chart = ''.padEnd(COLS, '·');
        line = '—';
    }
    return { chart, line, glyph };
  }

  function sampleSeries(arr, columns) {
    const out = [];
    for (let c = 0; c < columns; c++) {
      const idx = Math.min(arr.length - 1, Math.round((c / (columns - 1)) * (arr.length - 1)));
      out.push(arr[idx]);
    }
    return out;
  }
  function moonChartLine(moon, columns) {
    // Render the lunar position around the cycle. 0 = new (left), full = middle, new again = right.
    // Mark phase position.
    const SYN = 29.53058867;
    const pos = Math.floor((moon.age / SYN) * columns);
    let s = '';
    for (let c = 0; c < columns; c++) {
      if (c === pos) s += '●';
      else if (c === Math.floor(columns / 2)) s += '|';
      else if (c === 0 || c === columns - 1) s += 'o';
      else s += '·';
    }
    return s;
  }
  function sunChartLine(day, columns) {
    // Render daylight wedge from sunrise to sunset across local 24h scale.
    if (!day.sunrise || !day.sunset) return ''.padEnd(columns, '·');
    const rT = parseLocal(day.sunrise);
    const sT = parseLocal(day.sunset);
    if (!rT || !sT) return ''.padEnd(columns, '·');
    const rH = rT.h + rT.m / 60;
    const sH = sT.h + sT.m / 60;
    let str = '';
    for (let c = 0; c < columns; c++) {
      const hour = (c / (columns - 1)) * 24;
      str += (hour >= rH && hour <= sH) ? '#' : '·';
    }
    return str;
  }
  function parseLocal(t) {
    // 'YYYY-MM-DDTHH:MM' local
    const m = /T(\d{2}):(\d{2})/.exec(t);
    return m ? { h: +m[1], m: +m[2] } : null;
  }
  function sstChartLine(day, columns) {
    // Make a short ramp from min→mean→max (only have aggregates per day; draw a flat-with-dip).
    const lvls = ['_', '.', '-', '~', '=', '*', '#'];
    const t = day.sst.mean ?? 0;
    // Use day's tide indices to spread variation, just for visual texture.
    const series = day.tide.heights.length
      ? day.tide.heights.map((_, i) => day.sst.min + (day.sst.max - day.sst.min) * (0.5 + 0.5 * Math.sin(i / 3 + day.dateStr.length)))
      : Array(columns).fill(t);
    return genericChartLine(series, columns, lvls);
  }
  function currentChartLine(day, columns) {
    const lvls = ['·', '-', '→', '⇒', '⇶'];
    const v = day.current.mean_v ?? 0;
    const max = day.current.max_v ?? v;
    const series = day.tide.heights.length
      ? day.tide.heights.map((h, i) => v + (max - v) * (0.5 + 0.5 * Math.sin(i / 2.5)))
      : Array(columns).fill(v);
    return genericChartLine(series, columns, lvls);
  }
  function swellChartLine(day, columns) {
    const lvls = ['_', '.', '~', '=', '*', '#'];
    const m = day.swell.mean_h ?? 0;
    const max = day.swell.max_h ?? m;
    const series = day.tide.heights.length
      ? day.tide.heights.map((h, i) => m + (max - m) * (0.5 + 0.5 * Math.sin(i / 2)))
      : Array(columns).fill(m);
    return genericChartLine(series, columns, lvls);
  }
  function springNeapChartLine(day, columns) {
    const lvls = ['_', '.', '-', '=', '*', '#', '@'];
    if (day.tide.springiness == null) return ''.padEnd(columns, '·');
    const v = day.tide.springiness;
    // Bar that fills proportional to springiness
    const filled = Math.round(v * columns);
    let s = '';
    for (let c = 0; c < columns; c++) {
      s += c < filled ? lvls[Math.min(lvls.length - 1, Math.floor((c / Math.max(1, filled)) * lvls.length))] : '·';
    }
    return s;
  }
  function illumChartLine(day, columns) {
    const lvls = ['·', '.', '-', '~', '=', '*', '#', '@'];
    const v = day.moon.illum;
    const filled = Math.round(v * columns);
    let s = '';
    for (let c = 0; c < columns; c++) s += c < filled ? lvls[Math.min(lvls.length - 1, Math.floor((c / Math.max(1, filled)) * lvls.length))] : '·';
    return s;
  }
  function issChartLine(day, columns) {
    // ISS pass times are notoriously API-locked; we approximate by deterministically marking a "pass minute"
    // hashed from the date — clearly labelled as approximate in the panel.
    const seed = hashStr(day.dateStr + ':iss');
    const has = (seed % 5) < 3; // ~60% of nights have a visible-ish pass
    if (!has) return ''.padEnd(columns, '·');
    const r = rng(seed);
    const pos = Math.floor(r() * columns);
    let s = '';
    for (let c = 0; c < columns; c++) s += c === pos ? '*' : (c === pos - 1 || c === pos + 1) ? '·' : ' ';
    return s.replace(/ /g, '·');
  }
  function dockCatChartLine(day, columns) {
    // Cat sleeps somewhere on the dock; deterministic position from date.
    const seed = hashStr(day.dateStr + ':cat');
    const r = rng(seed);
    const pos = Math.floor(r() * columns);
    let s = ''.padEnd(columns, '_');
    s = s.substring(0, pos) + '∽' + s.substring(pos + 1);
    return s;
  }

  // ---------- Rendering ----------
  function render() {
    if (!state.days) return;
    const seedCity = hashStr(`${state.city.name.toLowerCase()}|${state.city.lat.toFixed(2)}|${state.city.lon.toFixed(2)}`);
    stripEl.innerHTML = '';
    state.days.forEach((d, i) => {
      const date = new Date(d.dateStr + 'T12:00:00');
      const dow = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dom = date.getDate();
      const mon = date.toLocaleDateString('en-US', { month: 'short' });

      const summary = dayLensSummary(d, state.activeLens, seedCity, i);

      const row = document.createElement('div');
      row.className = 'day-row';
      if (isSameLocalDay(d.dateStr, todayLocalString(state.city.tz))) row.classList.add('is-today');
      if (state.openDayIdx === i) row.classList.add('is-open');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-expanded', state.openDayIdx === i ? 'true' : 'false');
      row.dataset.idx = String(i);

      const stamp = document.createElement('div');
      stamp.className = 'day-stamp';
      stamp.innerHTML =
        `<span class="dow">${dow.toLowerCase()}</span>` +
        `<span class="dom">${String(dom).padStart(2, '0')}</span>` +
        `<span class="mon">${mon.toLowerCase()}</span>`;
      row.appendChild(stamp);

      const content = document.createElement('div');
      content.className = 'day-content';
      content.innerHTML =
        `<div class="chart-line">${escapeHtml(summary.chart)}</div>` +
        `<div class="verdict"><span class="verdict-tag">${VERDICT_TAGS[state.activeLens] || ''}</span>${escapeHtml(summary.line)}</div>`;
      row.appendChild(content);

      const glyph = document.createElement('div');
      glyph.className = 'day-glyph';
      glyph.textContent = summary.glyph;
      row.appendChild(glyph);

      row.addEventListener('click', () => toggleDay(i));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDay(i); }
      });
      stripEl.appendChild(row);
    });

    // Lens chips state
    Array.from(lensChipsEl.children).forEach(ch => {
      const id = ch.dataset.lens;
      ch.classList.toggle('active', id === state.activeLens);
      ch.classList.toggle('disabled', !state.availableLenses.has(id));
    });

    // Strip header units
    stripUnits.textContent = unitsLabelFor(state.activeLens);

    // Day panel
    if (state.openDayIdx == null) {
      dayPanel.hidden = true;
      dayPanelBody.innerHTML = '';
    } else {
      const d = state.days[state.openDayIdx];
      const summary = dayLensSummary(d, state.activeLens, seedCity, state.openDayIdx);
      dayPanel.hidden = false;
      dayPanelBody.innerHTML = renderPanel(d, summary);
    }
  }

  function unitsLabelFor(lens) {
    switch (lens) {
      case 'tide': return 'units: m above msl';
      case 'moon': return 'units: phase (0-1 cycle)';
      case 'sun':  return 'units: hours of daylight';
      case 'sst':  return 'units: °C';
      case 'currents': return 'units: m/s';
      case 'swell': return 'units: m wave height';
      case 'springneap': return 'units: tidal range fraction';
      case 'lunilum': return 'units: % illumination';
      case 'wind': return 'units: knots @ 10m';
      case 'pressure': return 'units: hPa surface';
      case 'iss': return 'units: heuristic pass marker';
      case 'dockcat': return 'units: cat-position';
      default: return 'units: --';
    }
  }

  function renderPanel(d, summary) {
    const m = d.moon;
    const tide = d.tide;
    const date = new Date(d.dateStr + 'T12:00:00');
    const dStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const cells = [];
    if (tide.max != null) {
      const peak = tide.extrema.find(e => e.type === 'high' && e.h === tide.max) || null;
      const low = tide.extrema.find(e => e.type === 'low' && e.h === tide.min) || null;
      cells.push(['high tide', peak ? `${tide.max.toFixed(2)} m  /  ${peak.t.slice(11, 16)}` : `${tide.max.toFixed(2)} m`]);
      cells.push(['low tide',  low  ? `${tide.min.toFixed(2)} m  /  ${low.t.slice(11, 16)}`  : `${tide.min.toFixed(2)} m`]);
      cells.push(['range',     `${tide.range.toFixed(2)} m`]);
      // time-to-next-high (today or tomorrow)
      const nextHigh = nextEventOfType(d, 'high');
      cells.push(['next high',  nextHigh ? `${nextHigh.t.slice(11, 16)}` : '—']);
    } else {
      cells.push(['tide data', '— marine API has no tide here —']);
    }
    cells.push(['moon phase', `${m.name} · ${(m.illum * 100).toFixed(0)}%`]);
    cells.push(['moon glyph', m.glyph]);
    if (d.sunrise) cells.push(['sunrise', d.sunrise.slice(11, 16)]);
    if (d.sunset)  cells.push(['sunset',  d.sunset.slice(11, 16)]);
    if (d.sst.mean != null) cells.push(['sst (mean)', `${d.sst.mean.toFixed(1)} °C`]);
    if (d.current.mean_v != null) cells.push(['current (mean)', `${d.current.mean_v.toFixed(2)} m/s @ ${Math.round(d.current.mean_dir || 0)}°`]);
    if (d.swell.mean_h != null) cells.push(['swell (mean)', `${d.swell.mean_h.toFixed(2)} m · T ${d.swell.mean_period ? d.swell.mean_period.toFixed(1) : '?'}s`]);
    if (d.hours.wind_speed.length) {
      cells.push(['wind (mean)', `${avg(d.hours.wind_speed).toFixed(1)} kn`]);
    }
    if (d.hours.pressure.length) {
      cells.push(['pressure (mean)', `${avg(d.hours.pressure).toFixed(1)} hPa`]);
    }
    if (tide.springiness != null) cells.push(['spring↔neap', `${(tide.springiness * 100).toFixed(0)}% toward spring`]);

    const grid = cells.map(([k, v]) =>
      `<div class="panel-cell"><span class="label">${escapeHtml(k)}</span><span class="value">${escapeHtml(String(v))}</span></div>`
    ).join('');

    return `
      <h3 class="panel-title">${escapeHtml(dStr.toLowerCase())} &middot; ${escapeHtml(state.city.name)}</h3>
      <div class="panel-grid">${grid}</div>
      <div class="panel-verdict"><span class="verdict-tag">${VERDICT_TAGS[state.activeLens] || ''}</span>${escapeHtml(summary.line)}</div>
    `;
  }
  function nextEventOfType(day, type) {
    if (!day.tide.extrema || !day.tide.extrema.length) return null;
    const now = Date.now();
    for (const e of day.tide.extrema) {
      const ts = new Date(e.t).getTime();
      if (ts >= now && e.type === type) return e;
    }
    // fallback: first extremum of that type today
    return day.tide.extrema.find(e => e.type === type) || null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
    }[c]));
  }
  function todayLocalString(tz) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: tz });
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function isSameLocalDay(a, b) { return a === b; }

  function toggleDay(i) {
    state.openDayIdx = state.openDayIdx === i ? null : i;
    render();
    if (state.openDayIdx != null) {
      // Smooth scroll the panel into view if needed.
      requestAnimationFrame(() => {
        dayPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  // ---------- Lens chips construction ----------
  function buildLensChips() {
    lensChipsEl.innerHTML = '';
    LENSES.forEach(({ id, label }) => {
      const b = document.createElement('button');
      b.className = 'lens-chip';
      b.dataset.lens = id;
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => {
        if (!state.availableLenses.has(id)) return;
        state.activeLens = id;
        state.openDayIdx = null;
        writeHash();
        render();
      });
      lensChipsEl.appendChild(b);
    });
  }

  // ---------- City picker UI ----------
  function showResults(items) {
    cityResults.innerHTML = '';
    if (!items.length) {
      cityResults.hidden = true;
      return;
    }
    items.forEach(it => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      const region = [it.admin1, it.country].filter(Boolean).join(', ');
      li.innerHTML =
        `<span class="city-line">${escapeHtml(it.name)}</span>` +
        `<span class="city-sub">${escapeHtml(region)} &middot; ${it.latitude.toFixed(2)}°, ${it.longitude.toFixed(2)}°</span>`;
      li.addEventListener('click', () => selectCity({
        name: it.name, country: it.country || '', admin1: it.admin1 || '',
        lat: it.latitude, lon: it.longitude, tz: it.timezone || 'auto',
      }));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') li.click();
      });
      cityResults.appendChild(li);
    });
    cityResults.hidden = false;
  }

  async function doSearch() {
    const q = cityInput.value.trim();
    if (!q) return;
    setStatus('searching the gazetteer…');
    try {
      const items = await searchCity(q);
      if (!items.length) {
        // Fallback to known ports if the user typed a known nickname
        const fall = FALLBACK_PORTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
        if (fall.length) {
          showResults(fall.map(f => ({ name: f.name, admin1: f.admin1, country: f.country, latitude: f.lat, longitude: f.lon, timezone: f.tz })));
          setStatusHidden();
          return;
        }
        setError('no port by that name. try another, or pick from the list.');
        return;
      }
      showResults(items);
      setStatusHidden();
    } catch (e) {
      setError('the gazetteer is sleeping. try again in a moment.');
    }
  }

  async function selectCity(city) {
    cityResults.hidden = true;
    cityResults.innerHTML = '';
    state.city = city;
    state.openDayIdx = null;
    portName.textContent = city.name + (city.admin1 ? ` (${city.admin1})` : '');
    portCoord.textContent = `${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°`;
    portStamped.textContent = `stamped ${todayLocalString(city.tz)}`;
    setStatus('consulting the almanac press…');
    try {
      const data = await fetchAlmanac(city);
      state.dataCache = data;
      state.days = buildDays(city, data.marine, data.forecast);

      // Determine which lenses are available given returned fields
      const avail = new Set(LENSES.map(l => l.id));
      const has = (key) => state.days.some(d => {
        if (key === 'tide') return d.tide.heights.length;
        if (key === 'sst') return d.sst.mean != null;
        if (key === 'currents') return d.current.mean_v != null;
        if (key === 'swell') return d.swell.mean_h != null;
        if (key === 'wind') return d.hours.wind_speed.length;
        if (key === 'pressure') return d.hours.pressure.length;
        if (key === 'sun') return !!d.sunrise && !!d.sunset;
        return true;
      });
      ['tide', 'sst', 'currents', 'swell', 'wind', 'pressure', 'sun'].forEach(k => {
        if (!has(k)) avail.delete(k);
      });
      // springneap depends on tide range
      if (!state.days.some(d => d.tide.springiness != null)) avail.delete('springneap');
      // moon, lunilum, dockcat, iss are computed-only — always available

      // If marine returned nothing at all, keep moon/sun/wind/pressure/iss/dockcat lenses; tell user.
      if (!state.days.some(d => d.tide.heights.length)) {
        setStatus(`no marine tide layer for this port — falling back to ${avail.size} lenses (moon, sun, wind, pressure, iss, dock cat).`);
        setTimeout(() => setStatusHidden(), 2500);
      } else {
        setStatusHidden();
      }
      state.availableLenses = avail;
      if (!avail.has(state.activeLens)) state.activeLens = avail.has('tide') ? 'tide' : 'moon';

      writeHash();
      render();
    } catch (e) {
      setError('the almanac press jammed. check your connection and try again.');
      console.error(e);
    }
  }

  function setStatus(msg) {
    stripStatus.textContent = msg;
    stripStatus.className = 'strip-status';
  }
  function setError(msg) {
    stripStatus.textContent = msg;
    stripStatus.className = 'strip-status error';
  }
  function setStatusHidden() {
    stripStatus.className = 'strip-status hidden';
    stripStatus.textContent = '';
  }

  // ---------- Permalink copy ----------
  function copyPermalink(e) {
    e.preventDefault();
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        const old = copyLink.textContent;
        copyLink.textContent = '[ permalink copied · screenshot the page ]';
        setTimeout(() => copyLink.textContent = old, 2200);
      }).catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
  }
  function fallbackCopy(text) {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t);
    t.select(); try { document.execCommand('copy'); } catch {}
    document.body.removeChild(t);
    copyLink.textContent = '[ permalink ready in your address bar ]';
  }

  // ---------- Init ----------
  function init() {
    buildLensChips();
    cityBtn.addEventListener('click', doSearch);
    cityInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    panelClose.addEventListener('click', () => { state.openDayIdx = null; render(); });
    copyLink.addEventListener('click', copyPermalink);
    window.addEventListener('hashchange', () => {
      const decoded = decodeHash();
      if (decoded && decoded.city.lat && decoded.city.lon &&
          (decoded.city.lat !== state.city.lat || decoded.city.lon !== state.city.lon)) {
        selectCity(decoded.city).then(() => {
          state.activeLens = decoded.lens;
          render();
        });
      } else if (decoded && decoded.lens !== state.activeLens) {
        state.activeLens = decoded.lens;
        render();
      }
    });

    const decoded = decodeHash();
    const startCity = decoded ? decoded.city : DEFAULT_CITY;
    if (decoded) state.activeLens = decoded.lens;
    selectCity(startCity);
  }

  // share() global, per skill template (keep it simple — page IS the share)
  window.share = function () {
    if (navigator.share) {
      navigator.share({ title: document.title, url: location.href });
    } else {
      navigator.clipboard.writeText(location.href).then(() => alert('Link copied!'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
