// Weather By Hostage Note — magazine-clipping ransom-note forecast renderer
// Deterministic: same city + same date = same visible note. URL #fragment carries state.

/* ---------- 80 pinned world cities (hard-coded lat/lon) ---------- */
const CITIES = [
  ["Accra", "Ghana", 5.56, -0.20],
  ["Addis Ababa", "Ethiopia", 9.03, 38.74],
  ["Amsterdam", "Netherlands", 52.37, 4.90],
  ["Anchorage", "USA", 61.22, -149.90],
  ["Ankara", "Turkey", 39.93, 32.87],
  ["Asuncion", "Paraguay", -25.26, -57.58],
  ["Athens", "Greece", 37.98, 23.73],
  ["Auckland", "New Zealand", -36.85, 174.76],
  ["Baghdad", "Iraq", 33.32, 44.42],
  ["Bangkok", "Thailand", 13.76, 100.50],
  ["Beijing", "China", 39.90, 116.41],
  ["Berlin", "Germany", 52.52, 13.40],
  ["Bogota", "Colombia", 4.71, -74.07],
  ["Boston", "USA", 42.36, -71.06],
  ["Brasilia", "Brazil", -15.79, -47.88],
  ["Brussels", "Belgium", 50.85, 4.35],
  ["Bucharest", "Romania", 44.43, 26.10],
  ["Budapest", "Hungary", 47.50, 19.04],
  ["Buenos Aires", "Argentina", -34.60, -58.38],
  ["Cairo", "Egypt", 30.04, 31.24],
  ["Canberra", "Australia", -35.28, 149.13],
  ["Cape Town", "South Africa", -33.92, 18.42],
  ["Caracas", "Venezuela", 10.48, -66.90],
  ["Chicago", "USA", 41.88, -87.63],
  ["Copenhagen", "Denmark", 55.68, 12.57],
  ["Dakar", "Senegal", 14.72, -17.47],
  ["Dhaka", "Bangladesh", 23.81, 90.41],
  ["Doha", "Qatar", 25.29, 51.53],
  ["Dublin", "Ireland", 53.35, -6.26],
  ["Edinburgh", "UK", 55.95, -3.19],
  ["Hanoi", "Vietnam", 21.03, 105.85],
  ["Havana", "Cuba", 23.14, -82.36],
  ["Helsinki", "Finland", 60.17, 24.94],
  ["Ho Chi Minh City", "Vietnam", 10.82, 106.63],
  ["Hong Kong", "China", 22.32, 114.17],
  ["Honolulu", "USA", 21.31, -157.86],
  ["Istanbul", "Turkey", 41.01, 28.98],
  ["Jakarta", "Indonesia", -6.20, 106.85],
  ["Kabul", "Afghanistan", 34.53, 69.17],
  ["Karachi", "Pakistan", 24.86, 67.00],
  ["Kingston", "Jamaica", 17.97, -76.79],
  ["Kuala Lumpur", "Malaysia", 3.14, 101.69],
  ["Kyiv", "Ukraine", 50.45, 30.52],
  ["Lagos", "Nigeria", 6.52, 3.38],
  ["La Paz", "Bolivia", -16.49, -68.15],
  ["Lima", "Peru", -12.05, -77.04],
  ["Lisbon", "Portugal", 38.72, -9.14],
  ["London", "UK", 51.51, -0.13],
  ["Los Angeles", "USA", 34.05, -118.24],
  ["Madrid", "Spain", 40.42, -3.70],
  ["Manila", "Philippines", 14.60, 120.98],
  ["Mexico City", "Mexico", 19.43, -99.13],
  ["Miami", "USA", 25.76, -80.19],
  ["Montreal", "Canada", 45.50, -73.57],
  ["Moscow", "Russia", 55.76, 37.62],
  ["Mumbai", "India", 19.08, 72.88],
  ["Nairobi", "Kenya", -1.29, 36.82],
  ["New Delhi", "India", 28.61, 77.21],
  ["New York", "USA", 40.71, -74.01],
  ["Oslo", "Norway", 59.91, 10.75],
  ["Ottawa", "Canada", 45.42, -75.70],
  ["Panama City", "Panama", 8.98, -79.52],
  ["Paris", "France", 48.86, 2.35],
  ["Prague", "Czechia", 50.08, 14.44],
  ["Reykjavik", "Iceland", 64.15, -21.94],
  ["Rio de Janeiro", "Brazil", -22.91, -43.17],
  ["Riyadh", "Saudi Arabia", 24.71, 46.68],
  ["Rome", "Italy", 41.90, 12.50],
  ["San Francisco", "USA", 37.77, -122.42],
  ["Santiago", "Chile", -33.45, -70.67],
  ["Sao Paulo", "Brazil", -23.55, -46.63],
  ["Seattle", "USA", 47.61, -122.33],
  ["Seoul", "South Korea", 37.57, 126.98],
  ["Shanghai", "China", 31.23, 121.47],
  ["Singapore", "Singapore", 1.35, 103.82],
  ["Stockholm", "Sweden", 59.33, 18.07],
  ["Sydney", "Australia", -33.87, 151.21],
  ["Taipei", "Taiwan", 25.03, 121.57],
  ["Tehran", "Iran", 35.69, 51.39],
  ["Tokyo", "Japan", 35.68, 139.76],
  ["Toronto", "Canada", 43.65, -79.38],
  ["Vienna", "Austria", 48.21, 16.37],
  ["Warsaw", "Poland", 52.23, 21.01],
  ["Wellington", "New Zealand", -41.29, 174.78],
  ["Zurich", "Switzerland", 47.38, 8.54]
];

/* ---------- seeded PRNG (mulberry32) ---------- */
function seedFromString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickInt(r, a, b) { return Math.floor(r() * (b - a + 1)) + a; }

/* ---------- URL fragment codec ---------- */
function encodeFrag(obj) {
  try {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch { return ""; }
}
function decodeFrag(s) {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(b + pad))));
  } catch { return null; }
}

/* ---------- weather-code lexicon (ransom-note vocabulary) ---------- */
// Maps WMO weather codes to a pair: [adjective, noun-verbphrase]
const WCODE = {
  0:  ["CLEAR", "STARING DOWN AT YOU"],
  1:  ["MOSTLY CLEAR", "PRETENDING TO BE NICE"],
  2:  ["PARTLY CLOUDY", "HIDING SOMETHING"],
  3:  ["OVERCAST", "SULKING"],
  45: ["FOGGY", "REFUSING TO BE SEEN"],
  48: ["FROSTY FOG", "FREEZING THE WINDOWS SHUT"],
  51: ["DRIZZLING", "SPITTING"],
  53: ["DRIZZLING", "SPITTING HARDER"],
  55: ["DRIZZLING", "SPITTING ON YOUR HEAD"],
  56: ["FREEZING DRIZZLE", "SEALING THE SIDEWALK"],
  57: ["FREEZING DRIZZLE", "GLAZING EVERYTHING"],
  61: ["RAINY", "WET AND UNBOTHERED"],
  63: ["RAINING", "SOAKING YOUR SHOES"],
  65: ["RAINING HARD", "FLOODING THE GUTTERS"],
  66: ["FREEZING RAIN", "TURNING THE ROAD TO GLASS"],
  67: ["FREEZING RAIN", "COATING EVERYTHING"],
  71: ["SNOWING", "QUIETLY TAKING OVER"],
  73: ["SNOWING HARD", "BURYING YOUR CAR"],
  75: ["SNOW-DUMPING", "OWNING THIS TOWN NOW"],
  77: ["SNOW GRAINS", "PEPPERING THE AIR"],
  80: ["RAIN SHOWERS", "AMBUSHING PEDESTRIANS"],
  81: ["RAIN SHOWERS", "DROWNING UMBRELLAS"],
  82: ["VIOLENT RAIN", "FURIOUS AND WET"],
  85: ["SNOW SHOWERS", "FLURRYING"],
  86: ["SNOW SHOWERS", "DUMPING FLAKES"],
  95: ["STORMY", "ANGRY AND LOUD"],
  96: ["THUNDERSTORM", "ANGRY WITH HAIL"],
  99: ["SEVERE THUNDERSTORM", "THROWING HAIL AT YOU"]
};
function wlex(code) { return WCODE[code] || ["MYSTERIOUS", "UP TO SOMETHING"]; }

function dayName(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][d.getUTCDay()];
}

/* ---------- build note lines from forecast data ---------- */
function buildLines(city, data, r) {
  const todayCode = (data.daily.weather_code && data.daily.weather_code[0]) ?? (data.current && data.current.weather_code) ?? 0;
  const [adj0, verb0] = wlex(todayCode);
  const today = data.daily.time[0];
  const todayName = dayName(today);
  const hi0 = Math.round(data.daily.temperature_2m_max[0]);
  const lo0 = Math.round(data.daily.temperature_2m_min[0]);
  const units = (data.daily_units && data.daily_units.temperature_2m_max) || "°C";

  // pick "notable" upcoming day: max precip day 1..3, else largest hi-lo swing
  let notableIdx = 1;
  const precips = data.daily.precipitation_sum || [0,0,0,0];
  let maxP = -1;
  for (let i = 1; i < Math.min(data.daily.time.length, 4); i++) {
    if (precips[i] > maxP) { maxP = precips[i]; notableIdx = i; }
  }
  const notableDay = dayName(data.daily.time[notableIdx]);
  const nCode = data.daily.weather_code[notableIdx];
  const [adjN, verbN] = wlex(nCode);

  // demands
  const demands = [];
  if (precips[0] > 1 || precips[1] > 1 || maxP > 1) {
    const n = pickInt(r, 1, 3);
    demands.push(`BRING ${n} (${["one","two","three"][n-1].toUpperCase()}) UMBRELLAS`);
  }
  if (hi0 >= 28) demands.push("HYDRATE OR ELSE");
  if (lo0 <= 5) demands.push("WEAR LAYERS — NO NEGOTIATION");
  if (todayCode >= 95) demands.push("CANCEL ANYTHING OUTDOORS");
  if (todayCode === 0 || todayCode === 1) demands.push(`GO OUTSIDE ON ${todayName}`);
  if (todayCode >= 71 && todayCode <= 77) demands.push("SHOVEL THE WALK BY DAWN");
  if (maxP > 3) demands.push(`CANCEL THE PICNIC BY ${notableDay}`);
  if (demands.length < 2) demands.push("PAY ATTENTION TO THE SKY");
  if (demands.length < 3) demands.push("OR THE WEEKEND GETS IT");
  while (demands.length > 4) demands.pop();

  const line1 = `THE SKY WILL BE ${adj0} AND ${verb0} ON ${todayName}`;
  const line2 = `YOU MUST ENDURE BETWEEN ${lo0}${units} AND ${hi0}${units}`;
  const line3 = `BY ${notableDay}, EXPECT ${adjN} SKIES — ${verbN}`;
  const cityLine = `HOSTAGE CITY: ${city.toUpperCase()}`;

  return {
    cityLine,
    sentences: [line1, line2, line3],
    demands,
    signed: "— THE ATMOSPHERE"
  };
}

/* ---------- render text as ransom-note spans ---------- */
function renderLetterRun(text, r, paletteBias) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      const s = document.createElement("span");
      s.className = "space";
      s.textContent = " ";
      frag.appendChild(s);
      continue;
    }
    if (ch === "\n") {
      frag.appendChild(document.createElement("br"));
      continue;
    }
    const span = document.createElement("span");
    // palette: bias allowed (for demands-tag-like), but mostly random
    const p = paletteBias && r() < 0.25 ? paletteBias : pickInt(r, 1, 8);
    span.className = `letter p-${p}`;
    const rot = (pickInt(r, -80, 80) / 10).toFixed(1);
    const ty = pickInt(r, -3, 3);
    const tx = pickInt(r, -2, 2);
    span.style.transform = `rotate(${rot}deg) translate(${tx}px, ${ty}px)`;
    // alternate casing in ransom-note fashion (~40% lower)
    const displayCh = (r() < 0.40 && ch.toLowerCase() !== ch.toUpperCase())
      ? (r() < 0.5 ? ch.toLowerCase() : ch.toUpperCase())
      : ch;
    span.textContent = displayCh;
    frag.appendChild(span);
  }
  return frag;
}

function renderNote(city, data, seedStr) {
  const seed = seedFromString(seedStr);
  const r = mulberry32(seed);
  const lines = buildLines(city, data, r);
  const note = document.getElementById("note");
  note.innerHTML = "";

  // header: HOSTAGE CITY line
  const l0 = document.createElement("div");
  l0.className = "line";
  l0.appendChild(renderLetterRun(lines.cityLine, r));
  note.appendChild(l0);

  // main sentences
  for (const sentence of lines.sentences) {
    const div = document.createElement("div");
    div.className = "line";
    div.appendChild(renderLetterRun(sentence, r));
    note.appendChild(div);
  }

  // DEMANDS section
  const demandHeader = document.createElement("div");
  demandHeader.className = "line demands-header";
  const tag = document.createElement("span");
  tag.className = "demands-tag";
  tag.textContent = "DEMANDS";
  demandHeader.appendChild(tag);
  note.appendChild(demandHeader);

  lines.demands.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "demand-line";
    row.appendChild(renderLetterRun(`${i + 1}. ${d}`, r));
    note.appendChild(row);
  });

  // signed
  const signed = document.createElement("div");
  signed.className = "signed";
  signed.textContent = lines.signed;
  note.appendChild(signed);

  // meta line (plain text — shows input visibility in the artifact)
  const meta = document.createElement("div");
  meta.className = "meta-line";
  meta.textContent = `${city} · ${data.daily.time[0]} · seed ${(seed % 100000).toString().padStart(5, "0")}`;
  note.appendChild(meta);

  // tape strips — 3-5 seeded positions
  const tapeLayer = document.getElementById("tape-layer");
  tapeLayer.innerHTML = "";
  const tapeCount = pickInt(r, 3, 5);
  for (let i = 0; i < tapeCount; i++) {
    const t = document.createElement("div");
    t.className = "tape";
    const corner = pickInt(r, 0, 3);
    const rot = (pickInt(r, -200, 200) / 10).toFixed(1);
    const offX = pickInt(r, -8, 24);
    const offY = pickInt(r, -8, 16);
    if (corner === 0) { t.style.top = offY + "px"; t.style.left = offX + "px"; }
    else if (corner === 1) { t.style.top = offY + "px"; t.style.right = offX + "px"; }
    else if (corner === 2) { t.style.bottom = offY + "px"; t.style.left = offX + "px"; }
    else { t.style.bottom = offY + "px"; t.style.right = offX + "px"; }
    t.style.transform = `rotate(${rot}deg)`;
    tapeLayer.appendChild(t);
  }
}

/* ---------- state ---------- */
const state = {
  city: null,   // [name, country, lat, lon]
  date: null,   // YYYY-MM-DD
  data: null
};

/* ---------- city picker ---------- */
function renderCityList(filter) {
  const list = document.getElementById("city-list");
  list.innerHTML = "";
  const f = (filter || "").trim().toLowerCase();
  const items = CITIES
    .filter(c => !f || c[0].toLowerCase().includes(f) || c[1].toLowerCase().includes(f))
    .slice(0, 60);
  for (const c of items) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.innerHTML = `${c[0]}<span class="country">· ${c[1]}</span>`;
    li.addEventListener("click", () => selectCity(c));
    if (state.city && c[0] === state.city[0]) li.classList.add("sel");
    list.appendChild(li);
  }
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "no match. try another spelling.";
    li.style.color = "#7a5c32";
    list.appendChild(li);
  }
}

function selectCity(c) {
  state.city = c;
  const inp = document.getElementById("city-search");
  inp.value = c[0];
  renderCityList(c[0]);
  document.getElementById("demand").disabled = false;
  document.getElementById("picker-hint").textContent = `locked on ${c[0]}, ${c[1]}. now press the button.`;
}

/* ---------- Open-Meteo fetch ---------- */
async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&current=weather_code&forecast_days=4&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("http_" + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------- cached fallback data (pre-baked "it's a mystery out there") ---------- */
function fallbackData(city) {
  const d0 = todayIso();
  const d = new Date(d0 + "T12:00:00Z");
  const days = [];
  for (let i = 0; i < 4; i++) {
    const dd = new Date(d.getTime() + i * 86400000);
    const y = dd.getUTCFullYear();
    const m = String(dd.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dd.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return {
    daily_units: { temperature_2m_max: "°C" },
    current: { weather_code: 3 },
    daily: {
      time: days,
      weather_code: [3, 61, 2, 80],
      temperature_2m_max: [18, 15, 20, 17],
      temperature_2m_min: [9, 8, 11, 10],
      precipitation_sum: [0.4, 4.1, 0.0, 2.3]
    },
    _fallback: true
  };
}

/* ---------- orchestration ---------- */
async function demandForecast() {
  if (!state.city) return;
  showLoader();
  const [name, country, lat, lon] = state.city;
  const date = todayIso();
  state.date = date;

  // artificial 900ms hold for the loader drama
  const started = Date.now();
  let data;
  try {
    data = await fetchForecast(lat, lon);
  } catch (e) {
    data = fallbackData(name);
  }
  const elapsed = Date.now() - started;
  if (elapsed < 900) await new Promise(r => setTimeout(r, 900 - elapsed));
  state.data = data;
  if (!data || !data.daily || !data.daily.time || !data.daily.time.length) {
    showError();
    return;
  }
  showNote();
  // update URL fragment
  const frag = encodeFrag({ c: name, d: date });
  history.replaceState(null, "", `${location.pathname}${location.search}#s=${frag}`);
}

function showLoader() {
  document.getElementById("picker").hidden = true;
  document.getElementById("error").hidden = true;
  document.getElementById("note-wrap").hidden = true;
  document.getElementById("loader").hidden = false;
}

function showNote() {
  document.getElementById("loader").hidden = true;
  document.getElementById("error").hidden = true;
  document.getElementById("picker").hidden = true;
  document.getElementById("note-wrap").hidden = false;
  const seedStr = `${state.city[0]}|${state.date}`;
  renderNote(state.city[0], state.data, seedStr);
}

function showError() {
  document.getElementById("loader").hidden = true;
  document.getElementById("picker").hidden = true;
  document.getElementById("note-wrap").hidden = true;
  document.getElementById("error").hidden = false;
}

function resetToPicker() {
  document.getElementById("loader").hidden = true;
  document.getElementById("note-wrap").hidden = true;
  document.getElementById("error").hidden = true;
  document.getElementById("picker").hidden = false;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

/* ---------- share ---------- */
function share() {
  const url = location.href;
  const title = document.title;
  const text = state.city
    ? `${state.city[0]}'s weather, delivered as a hostage note.`
    : "The sky has demands.";
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => toast("link copied — send it fast"))
      .catch(() => toast("couldn't copy — address bar is over there ↑"));
  } else {
    prompt("copy this link:", url);
  }
}
window.share = share;

function toast(msg) {
  let t = document.getElementById("ef-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "ef-toast";
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff9e0;padding:10px 14px;border-radius:4px;font:600 13px/1 \"Archivo Black\",sans-serif;letter-spacing:0.08em;z-index:99999;box-shadow:3px 3px 0 #e8344e";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.5s"; }, 1800);
}

/* ---------- boot ---------- */
function boot() {
  renderCityList("");
  const inp = document.getElementById("city-search");
  inp.addEventListener("input", () => {
    renderCityList(inp.value);
    // if user types exact name, auto-select
    const exact = CITIES.find(c => c[0].toLowerCase() === inp.value.trim().toLowerCase());
    if (exact) selectCity(exact);
    else {
      state.city = null;
      document.getElementById("demand").disabled = true;
    }
  });

  document.getElementById("surprise").addEventListener("click", () => {
    const c = CITIES[Math.floor(Math.random() * CITIES.length)];
    selectCity(c);
  });
  document.getElementById("demand").addEventListener("click", demandForecast);
  document.getElementById("reset").addEventListener("click", resetToPicker);
  document.getElementById("error-retry").addEventListener("click", resetToPicker);

  // handle incoming #s=... fragment (replay)
  const frag = location.hash.match(/#s=([A-Za-z0-9_\-]+)/);
  if (frag) {
    const payload = decodeFrag(frag[1]);
    if (payload && payload.c) {
      const match = CITIES.find(c => c[0].toLowerCase() === String(payload.c).toLowerCase());
      if (match) {
        state.city = match;
        // if they also passed a date, we respect it for seeding but still fetch live weather
        if (payload.d) state.date = payload.d;
        document.getElementById("demand").disabled = false;
        document.getElementById("city-search").value = match[0];
        // auto-run
        demandForecast();
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
