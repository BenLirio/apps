// Weather Maze — app.js
// Fetches weather via Open-Meteo + Nominatim, seeds a procedural maze

// ── State ──────────────────────────────────────────────────────────────────
let mazeGrid = [];
let cols = 0, rows = 0;
let cellSize = 30;
let playerCol = 0, playerRow = 0;
let goalCol = 0, goalRow = 0;
let visitedCells = new Set();
let startTime = null;
let timerInterval = null;
let currentCity = '';
let weatherInfo = { code: 0, temp: 0, label: '', theme: 'sunny' };
let isOffline = false;
let touchStartX = 0, touchStartY = 0;
let gameActive = false;
let finalTimeStr = '';
let rng;

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────
function makeSeed(city, dateStr, weathercode, tempRounded) {
  const raw = `${city.toLowerCase().trim()}|${dateStr}|${weathercode}|${tempRounded}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Weather helpers ────────────────────────────────────────────────────────
function classifyWeather(code, temp) {
  if (code >= 95) return { label: 'THUNDERSTORM', theme: 'stormy' };
  if (code >= 61) return { label: 'RAIN', theme: 'rainy' };
  if (code >= 71) return { label: 'SNOW', theme: 'snow' };
  if (code >= 51) return { label: 'DRIZZLE', theme: 'rainy' };
  if (code >= 45) return { label: 'FOG', theme: 'cloudy' };
  if (code >= 3)  return { label: 'OVERCAST', theme: 'cloudy' };
  if (temp > 15)  return { label: 'CLEAR & WARM', theme: 'sunny' };
  if (temp <= 5)  return { label: 'COLD & CLEAR', theme: 'snow' };
  return { label: 'PARTLY CLOUDY', theme: 'cloudy' };
}

function getCellSize(code, temp) {
  // Stormy/cold → small cells (dense maze); Sunny/warm → large cells (open maze)
  if (code >= 95 || temp < 5) return 20;
  if (code >= 61 || temp < 10) return 24;
  if (code < 3 && temp > 20) return 44;
  if (code < 3 && temp > 15) return 38;
  return 30;
}

function applyTheme(theme) {
  document.body.classList.remove('weather-sunny', 'weather-rainy', 'weather-stormy', 'weather-snow', 'weather-cloudy');
  document.body.classList.add('weather-' + theme);
}

// ── Maze generation (recursive backtracking / DFS) ─────────────────────────
// Cell flags: bit 0 = visited, bit 1 = wall N, bit 2 = wall E, bit 3 = wall S, bit 4 = wall W
const N = 1, E = 2, S = 4, W = 8;
const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };
const DIR_DELTA = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };

function generateMaze(c, r, randFn) {
  // Each cell stores open directions (passages)
  const grid = Array.from({ length: r }, () => new Array(c).fill(0));
  const stack = [];
  const visited = Array.from({ length: r }, () => new Array(c).fill(false));

  const startC = 0, startR = 0;
  visited[startR][startC] = true;
  stack.push([startC, startR]);

  while (stack.length > 0) {
    const [cc, cr] = stack[stack.length - 1];
    const dirs = [N, E, S, W].filter(d => {
      const [dc, dr] = DIR_DELTA[d];
      const nc = cc + dc, nr = cr + dr;
      return nc >= 0 && nc < c && nr >= 0 && nr < r && !visited[nr][nc];
    });

    if (dirs.length === 0) {
      stack.pop();
    } else {
      // Pick random direction
      const dir = dirs[Math.floor(randFn() * dirs.length)];
      const [dc, dr] = DIR_DELTA[dir];
      const nc = cc + dc, nr = cr + dr;
      // Carve passage
      grid[cr][cc] |= dir;
      grid[nr][nc] |= OPPOSITE[dir];
      visited[nr][nc] = true;
      stack.push([nc, nr]);
    }
  }
  return grid;
}

// ── Canvas rendering ───────────────────────────────────────────────────────
function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
}

function drawMaze() {
  const canvas = document.getElementById('maze-canvas');
  const ctx = canvas.getContext('2d');
  const cs = cellSize;

  ctx.fillStyle = '#0f0f1a'; // path color
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const wallColor = '#1a1a2e';
  const wallWidth = Math.max(2, Math.floor(cs / 10));

  ctx.strokeStyle = wallColor;
  ctx.lineWidth = wallWidth;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cs;
      const y = r * cs;
      const cell = mazeGrid[r][c];

      // Draw walls where there is NO passage
      ctx.beginPath();
      // North wall
      if (!(cell & N)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cs, y);
      }
      // East wall
      if (!(cell & E)) {
        ctx.moveTo(x + cs, y);
        ctx.lineTo(x + cs, y + cs);
      }
      // South wall
      if (!(cell & S)) {
        ctx.moveTo(x, y + cs);
        ctx.lineTo(x + cs, y + cs);
      }
      // West wall
      if (!(cell & W)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cs);
      }
      ctx.stroke();
    }
  }

  // Draw border
  ctx.strokeStyle = '#33335a';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Draw visited trail
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  visitedCells.forEach(key => {
    const [vc, vr] = key.split(',').map(Number);
    ctx.fillRect(vc * cs + wallWidth, vr * cs + wallWidth, cs - wallWidth * 2, cs - wallWidth * 2);
  });

  // Draw goal
  const gx = goalCol * cs + cs * 0.15;
  const gy = goalRow * cs + cs * 0.15;
  const gs = cs * 0.7;
  ctx.fillStyle = '#30f0a0';
  ctx.shadowColor = '#30f0a0';
  ctx.shadowBlur = 8;
  ctx.fillRect(gx, gy, gs, gs);
  ctx.shadowBlur = 0;

  // Draw player
  const accentColor = getAccentColor();
  const px = playerCol * cs + cs * 0.15;
  const py = playerRow * cs + cs * 0.15;
  const ps = cs * 0.7;
  ctx.fillStyle = accentColor;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 10;
  ctx.fillRect(px, py, ps, ps);
  ctx.shadowBlur = 0;
}

// ── Move player ────────────────────────────────────────────────────────────
function movePlayer(dir) {
  if (!gameActive) return;
  const cell = mazeGrid[playerRow][playerCol];
  if (!(cell & dir)) return; // wall blocks

  const [dc, dr] = DIR_DELTA[dir];
  playerCol += dc;
  playerRow += dr;
  visitedCells.add(`${playerCol},${playerRow}`);
  drawMaze();

  if (playerCol === goalCol && playerRow === goalRow) {
    onWin();
  }
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    document.getElementById('timer-display').textContent = formatTime(elapsed);
  }, 100);
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Win ────────────────────────────────────────────────────────────────────
function onWin() {
  gameActive = false;
  clearInterval(timerInterval);
  const elapsed = Date.now() - startTime;
  finalTimeStr = formatTime(elapsed);

  document.getElementById('win-time').textContent = finalTimeStr;
  document.getElementById('win-city').textContent =
    `${currentCity.toUpperCase()} · ${weatherInfo.label}`;

  document.getElementById('emoji-grid').textContent = buildEmojiGrid();

  show('win-screen');
  hide('game-screen');
}

function buildEmojiGrid() {
  const WALL = '⬛';
  const PATH = '⬜';
  const PLAYER_PATH = '🟨';

  const previewRows = Math.min(4, rows);
  const previewCols = Math.min(12, cols);
  const lines = [];

  for (let r = 0; r < previewRows; r++) {
    let line = '';
    for (let c = 0; c < previewCols; c++) {
      const key = `${c},${r}`;
      if (visitedCells.has(key) || (c === 0 && r === 0)) {
        line += PLAYER_PATH;
      } else {
        // Simplistic: open cell if it has multiple passages
        const cell = mazeGrid[r][c];
        const openCount = [N, E, S, W].filter(d => cell & d).length;
        line += openCount >= 2 ? PATH : WALL;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ── Main flow ──────────────────────────────────────────────────────────────
async function startMaze() {
  const cityInput = document.getElementById('city-input');
  const city = cityInput.value.trim();
  if (!city) {
    showError();
    return;
  }

  currentCity = city;
  hide('error-msg');
  show('loading-screen');
  hide('input-screen');

  // Loading messages cycle
  const messages = [
    'reading the atmosphere over your city...',
    'consulting the cloud formations...',
    'measuring the barometric pressure...',
    'converting weather data to labyrinth coordinates...',
  ];
  let msgIdx = 0;
  const msgEl = document.getElementById('loading-text');
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % messages.length;
    msgEl.textContent = messages[msgIdx];
  }, 800);

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let weathercode = 0, temp = 15;
  isOffline = false;

  try {
    // Geocode city
    const geoResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const geoData = await geoResp.json();
    if (!geoData || geoData.length === 0) throw new Error('City not found');

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);

    // Fetch weather
    const wxResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`
    );
    const wxData = await wxResp.json();
    weathercode = wxData.current.weathercode;
    temp = Math.round(wxData.current.temperature_2m);
  } catch (e) {
    // Fallback: date-seeded offline
    isOffline = true;
    weathercode = 0;
    // Temp derived from date (fake but deterministic)
    temp = 15;
  }

  clearInterval(msgInterval);
  await new Promise(r => setTimeout(r, 400)); // ensure min loading time

  const classified = classifyWeather(weathercode, temp);
  weatherInfo = { code: weathercode, temp, ...classified };

  const tempRounded = Math.round(temp / 5) * 5;
  const seed = makeSeed(city, dateStr, weathercode, tempRounded);
  rng = mulberry32(seed);

  cellSize = getCellSize(weathercode, temp);

  // Calculate maze dimensions to fit screen
  const maxW = Math.min(window.innerWidth - 32, 600);
  const maxH = Math.floor(window.innerHeight * 0.55);
  cols = Math.max(5, Math.floor(maxW / cellSize));
  rows = Math.max(5, Math.floor(maxH / cellSize));

  // Ensure odd-ish to have proper entry/exit feel
  if (cols > 25) cols = 25;
  if (rows > 20) rows = 20;

  mazeGrid = generateMaze(cols, rows, rng);
  playerCol = 0;
  playerRow = 0;
  goalCol = cols - 1;
  goalRow = rows - 1;
  visitedCells = new Set();
  visitedCells.add('0,0');
  gameActive = true;

  // Apply theme
  applyTheme(weatherInfo.theme);

  // Setup canvas
  const canvas = document.getElementById('maze-canvas');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;

  // Update UI
  document.getElementById('weather-banner').textContent =
    `${city.toUpperCase()} · ${temp}°C · ${weatherInfo.label}`;
  document.getElementById('weather-label').textContent =
    `cell: ${cellSize}px · ${cols}×${rows}`;

  if (isOffline) {
    show('offline-banner');
  } else {
    hide('offline-banner');
  }

  hide('loading-screen');
  show('game-screen');

  drawMaze();
  startTimer();
}

function showError() {
  const errEl = document.getElementById('error-msg');
  errEl.style.display = 'block';
}

function resetToStart() {
  hide('win-screen');
  hide('game-screen');
  hide('loading-screen');
  show('input-screen');
  document.getElementById('city-input').value = '';
  document.body.className = '';
  clearInterval(timerInterval);
  gameActive = false;
}

// ── Keyboard controls ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); movePlayer(N); break;
    case 'ArrowRight': e.preventDefault(); movePlayer(E); break;
    case 'ArrowDown':  e.preventDefault(); movePlayer(S); break;
    case 'ArrowLeft':  e.preventDefault(); movePlayer(W); break;
  }
});

// ── Touch / swipe controls ─────────────────────────────────────────────────
const canvas = document.getElementById('maze-canvas');
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const minSwipe = 30;
  if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    movePlayer(dx > 0 ? E : W);
  } else {
    movePlayer(dy > 0 ? S : N);
  }
}, { passive: true });

// ── On-screen button controls ──────────────────────────────────────────────
document.getElementById('btn-up').addEventListener('click', () => movePlayer(N));
document.getElementById('btn-down').addEventListener('click', () => movePlayer(S));
document.getElementById('btn-left').addEventListener('click', () => movePlayer(W));
document.getElementById('btn-right').addEventListener('click', () => movePlayer(E));

// ── Enter key on input ─────────────────────────────────────────────────────
document.getElementById('city-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startMaze();
});

// ── Helpers ────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

// ── Share ──────────────────────────────────────────────────────────────────
function share() {
  const emojiGrid = document.getElementById('emoji-grid').textContent;
  const shareText = `Weather Maze — ${currentCity.toUpperCase()} · ${weatherInfo.label}\n⏱ ${finalTimeStr}\n\n${emojiGrid}\n\n${location.href}`;

  if (navigator.share) {
    navigator.share({
      title: 'Weather Maze',
      text: shareText,
      url: location.href,
    });
  } else {
    navigator.clipboard.writeText(shareText)
      .then(() => alert('Copied to clipboard! Challenge your friends.'));
  }
}
