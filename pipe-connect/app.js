// Pipe Connect — daily spatial puzzle
// Grid: 6x6, 5 colored pipe pairs, seeded by date

// ── CONFIG ──────────────────────────────────────────────────────────────────
const GRID = 6;
const CELL = 68; // px per cell (canvas)
const PAD  = 4;  // inner gap between cell edge and pipe body

const PIPE_COLORS = [
  { name: 'red',    hex: '#ff2a2a', emoji: '🟥' },
  { name: 'blue',   hex: '#2a7fff', emoji: '🟦' },
  { name: 'green',  hex: '#00d46a', emoji: '🟩' },
  { name: 'yellow', hex: '#ffcc00', emoji: '🟨' },
  { name: 'orange', hex: '#ff7700', emoji: '🟧' },
];
const EMPTY_COLOR  = '#1e1e38';
const HOVER_COLOR  = 'rgba(255,255,255,0.06)';
const BORDER_COLOR = '#3a3a6e';

// ── SEEDED RNG ───────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dateToSeed(dateStr) {
  // dateStr: "YYYY-MM-DD"
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── PUZZLE GENERATION ────────────────────────────────────────────────────────
function generatePuzzle(seed) {
  // Returns { endpoints: [{r,c,colorIdx}], solution: 2D array of colorIdx (-1=empty) }
  const rng = seededRng(seed);

  // Try up to 200 times to produce a fully-filled valid puzzle
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = tryGenerate(seededRng(seed + attempt * 1337));
    if (result) return result;
  }
  // Fallback: hardcoded known-good puzzle for robustness
  return hardcodedPuzzle();
}

function tryGenerate(rng) {
  const grid = Array.from({length: GRID}, () => new Array(GRID).fill(-1));
  const paths = []; // per-color path arrays

  // Pick 5 colors and carve random walks for each
  const numColors = 5;
  const endpoints = []; // {r1,c1,r2,c2,colorIdx}

  for (let ci = 0; ci < numColors; ci++) {
    const placed = placeColoredPath(grid, ci, rng);
    if (!placed) return null;
    paths.push(placed.path);
    endpoints.push({ r1: placed.path[0][0], c1: placed.path[0][1],
                     r2: placed.path[placed.path.length-1][0],
                     c2: placed.path[placed.path.length-1][1],
                     colorIdx: ci });
  }

  // Check all cells filled
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (grid[r][c] === -1) return null;

  return { endpoints, solution: grid };
}

function placeColoredPath(grid, colorIdx, rng) {
  // Random walk from a free cell, min length 5
  const freeCells = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (grid[r][c] === -1) freeCells.push([r, c]);

  if (freeCells.length < 5) return null;
  shuffleArr(freeCells, rng);

  for (const start of freeCells.slice(0, 10)) {
    const path = walk(grid, start, colorIdx, rng, 5);
    if (path && path.length >= 5) {
      for (const [r, c] of path) grid[r][c] = colorIdx;
      return { path };
    }
  }
  return null;
}

function walk(grid, start, colorIdx, rng, minLen) {
  const path = [start];
  const visited = new Set([`${start[0]},${start[1]}`]);
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  let [r, c] = start;
  for (let step = 0; step < GRID * GRID; step++) {
    const neighbors = dirs
      .map(([dr, dc]) => [r+dr, c+dc])
      .filter(([nr, nc]) =>
        nr >= 0 && nr < GRID && nc >= 0 && nc < GRID &&
        grid[nr][nc] === -1 &&
        !visited.has(`${nr},${nc}`)
      );
    if (neighbors.length === 0) break;
    shuffleArr(neighbors, rng);
    [r, c] = neighbors[0];
    path.push([r, c]);
    visited.add(`${r},${c}`);
  }
  return path.length >= minLen ? path : null;
}

function shuffleArr(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function hardcodedPuzzle() {
  // A guaranteed-valid 6x6 puzzle (fallback)
  const S = [
    [0,0,0,1,1,1],
    [0,2,2,2,3,1],
    [0,2,4,3,3,1],
    [0,2,4,3,1,1],
    [0,2,4,4,1,3],
    [0,0,0,4,3,3],
  ];
  const endpoints = [
    { r1:0, c1:0, r2:5, c2:2, colorIdx:0 },
    { r1:0, c1:3, r2:1, c2:1, colorIdx:1 },
    { r1:1, c1:3, r2:5, c2:0, colorIdx:2 },
    { r1:1, c1:4, r2:5, c2:4, colorIdx:3 },
    { r1:2, c1:2, r2:5, c2:3, colorIdx:4 },
  ];
  return { endpoints, solution: S };
}

// ── STATE ────────────────────────────────────────────────────────────────────
let puzzle      = null;    // { endpoints, solution }
let userGrid    = null;    // 2D array of colorIdx (-1=empty)
let activePaths = null;    // per-color arrays of [r,c]
let dragging    = null;    // { colorIdx, path } while mouse/touch is down
let solved      = false;
let timerStart  = null;
let timerInterval = null;
let elapsed     = 0;
let hoverCell   = null;
let dateStr     = '';

const canvas = document.getElementById('grid-canvas');
const ctx    = canvas.getContext('2d');

// ── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  dateStr = getTodayStr();
  document.getElementById('date-label').textContent = dateStr;

  // Streak display
  updateStreakDisplay();

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('reset-btn').addEventListener('click', resetPuzzle);
  document.getElementById('play-again-btn').addEventListener('click', showSolution);
});

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function startGame() {
  document.getElementById('pre-game').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';

  const seed = dateToSeed(dateStr);
  puzzle = generatePuzzle(seed);

  initState();
  setupCanvas();
  drawAll();
  startTimer();
}

function initState() {
  userGrid    = Array.from({length: GRID}, () => new Array(GRID).fill(-1));
  activePaths = Array.from({length: PIPE_COLORS.length}, () => []);
  dragging    = null;
  solved      = false;
}

function setupCanvas() {
  const size = CELL * GRID;
  canvas.width  = size;
  canvas.height = size;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);

  canvas.addEventListener('touchstart', onTouchStart, {passive: false});
  canvas.addEventListener('touchmove',  onTouchMove,  {passive: false});
  canvas.addEventListener('touchend',   onTouchEnd,   {passive: false});
}

// ── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  timerStart = Date.now();
  timerInterval = setInterval(tickTimer, 500);
}
function tickTimer() {
  elapsed = Math.floor((Date.now() - timerStart) / 1000);
  document.getElementById('timer').textContent = formatTime(elapsed);
}
function stopTimer() {
  clearInterval(timerInterval);
  elapsed = Math.floor((Date.now() - timerStart) / 1000);
}
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ── DRAWING ───────────────────────────────────────────────────────────────────
function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPaths();
  drawEndpoints();
  drawGrid();
  if (hoverCell) drawHoverHighlight(hoverCell[0], hoverCell[1]);
  updateCellsFilled();
}

function drawBackground() {
  ctx.fillStyle = EMPTY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 1;
  for (let r = 0; r <= GRID; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(GRID * CELL, r * CELL);
    ctx.stroke();
  }
  for (let c = 0; c <= GRID; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, GRID * CELL);
    ctx.stroke();
  }
}

function drawPaths() {
  // Draw filled cells first
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const ci = userGrid[r][c];
      if (ci >= 0) {
        ctx.fillStyle = PIPE_COLORS[ci].hex + '44';
        ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2);
      }
    }
  }

  // Draw path lines
  for (let ci = 0; ci < PIPE_COLORS.length; ci++) {
    const path = activePaths[ci];
    if (path.length < 2) continue;
    ctx.strokeStyle = PIPE_COLORS[ci].hex;
    ctx.lineWidth = CELL * 0.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const [r, c] = path[i];
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawEndpoints() {
  for (const ep of puzzle.endpoints) {
    drawEndpointDot(ep.r1, ep.c1, ep.colorIdx);
    drawEndpointDot(ep.r2, ep.c2, ep.colorIdx);
  }
}

function drawEndpointDot(r, c, ci) {
  const x = c * CELL + CELL / 2;
  const y = r * CELL + CELL / 2;
  const radius = CELL * 0.3;

  ctx.fillStyle = PIPE_COLORS[ci].hex;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // inner highlight dot
  ctx.fillStyle = '#ffffff55';
  ctx.beginPath();
  ctx.arc(x - radius*0.25, y - radius*0.25, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHoverHighlight(r, c) {
  ctx.fillStyle = HOVER_COLOR;
  ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2);
}

function updateCellsFilled() {
  let filled = 0;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (userGrid[r][c] >= 0) filled++;
  document.getElementById('cells-filled').textContent = `${filled}/${GRID*GRID}`;
}

// ── INPUT HELPERS ─────────────────────────────────────────────────────────────
function canvasCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left)  * scaleX;
  const y = (clientY - rect.top)   * scaleY;
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
  return [r, c];
}

function endpointColorAt(r, c) {
  for (const ep of puzzle.endpoints) {
    if ((ep.r1 === r && ep.c1 === c) || (ep.r2 === r && ep.c2 === c)) return ep.colorIdx;
  }
  return -1;
}

function isEndpoint(r, c) {
  return endpointColorAt(r, c) >= 0;
}

function isEndpointOfColor(r, c, ci) {
  const ep = puzzle.endpoints[ci];
  return (ep.r1 === r && ep.c1 === c) || (ep.r2 === r && ep.c2 === c);
}

function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1-r2) + Math.abs(c1-c2) === 1;
}

// ── DRAG LOGIC ────────────────────────────────────────────────────────────────
function startDrag(r, c) {
  if (solved) return;

  const ci = endpointColorAt(r, c);
  if (ci === -1) {
    // Maybe start from existing path cell
    const existing = userGrid[r][c];
    if (existing === -1) return;
    // Truncate path at this cell and continue from here
    const path = activePaths[existing];
    const idx = path.findIndex(([pr, pc]) => pr === r && pc === c);
    if (idx === -1) return;
    // Clear cells after idx
    for (let i = idx + 1; i < path.length; i++) {
      const [pr, pc] = path[i];
      userGrid[pr][pc] = -1;
    }
    activePaths[existing] = path.slice(0, idx + 1);
    dragging = { colorIdx: existing, path: activePaths[existing] };
  } else {
    // Starting from an endpoint: clear existing path for this color
    clearPath(ci);
    activePaths[ci] = [[r, c]];
    userGrid[r][c] = ci;
    dragging = { colorIdx: ci, path: activePaths[ci] };
  }
  drawAll();
}

function continueDrag(r, c) {
  if (!dragging) return;
  const { colorIdx, path } = dragging;
  const [lr, lc] = path[path.length - 1];
  if (lr === r && lc === c) return; // same cell

  // Check adjacency
  if (!isAdjacent(lr, lc, r, c)) return;

  // Check if we're walking backwards along our own path (undo)
  if (path.length >= 2) {
    const [pr, pc] = path[path.length - 2];
    if (pr === r && pc === c) {
      // Undo last step
      userGrid[lr][lc] = -1;
      path.pop();
      drawAll();
      return;
    }
  }

  // Check if cell is occupied by another color
  const occupant = userGrid[r][c];
  if (occupant >= 0 && occupant !== colorIdx) {
    // If it's an endpoint of another color, stop
    if (isEndpoint(r, c)) return;
    // Otherwise clear that color's path from here
    clearPathFromCell(occupant, r, c);
  }

  // Check if target is an endpoint of THIS color (completing the pipe)
  // Allow stepping there even if already in path (completing the loop)
  if (!path.some(([pr, pc]) => pr === r && pc === c)) {
    path.push([r, c]);
    userGrid[r][c] = colorIdx;
  }

  drawAll();
  checkSolved();
}

function endDrag() {
  dragging = null;
}

function clearPath(ci) {
  for (const [r, c] of activePaths[ci]) {
    userGrid[r][c] = -1;
  }
  activePaths[ci] = [];
}

function clearPathFromCell(ci, r, c) {
  const path = activePaths[ci];
  const idx = path.findIndex(([pr, pc]) => pr === r && pc === c);
  if (idx === -1) return;
  for (let i = idx; i < path.length; i++) {
    const [pr, pc] = path[i];
    // Don't clear if it's an endpoint — endpoints stay colored
    if (!isEndpointOfColor(pr, pc, ci)) userGrid[pr][pc] = -1;
  }
  activePaths[ci] = path.slice(0, idx);
}

// ── MOUSE EVENTS ──────────────────────────────────────────────────────────────
function onMouseDown(e) {
  const cell = canvasCell(e.clientX, e.clientY);
  if (!cell) return;
  startDrag(cell[0], cell[1]);
}

function onMouseMove(e) {
  const cell = canvasCell(e.clientX, e.clientY);
  hoverCell = cell;
  if (dragging && cell) continueDrag(cell[0], cell[1]);
  else drawAll();
}

function onMouseUp(e) {
  endDrag();
}

function onMouseLeave(e) {
  hoverCell = null;
  endDrag();
  drawAll();
}

// ── TOUCH EVENTS ──────────────────────────────────────────────────────────────
function onTouchStart(e) {
  e.preventDefault();
  const t = e.touches[0];
  const cell = canvasCell(t.clientX, t.clientY);
  if (!cell) return;
  startDrag(cell[0], cell[1]);
}

function onTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  const cell = canvasCell(t.clientX, t.clientY);
  if (dragging && cell) continueDrag(cell[0], cell[1]);
}

function onTouchEnd(e) {
  e.preventDefault();
  endDrag();
}

// ── SOLVED CHECK ──────────────────────────────────────────────────────────────
function checkSolved() {
  // All cells filled?
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (userGrid[r][c] === -1) return;

  // All pipes complete (each path starts AND ends at an endpoint)?
  for (let ci = 0; ci < PIPE_COLORS.length; ci++) {
    const path = activePaths[ci];
    if (path.length < 2) return;
    const [sr, sc] = path[0];
    const [er, ec] = path[path.length - 1];
    const ep = puzzle.endpoints[ci];
    const startsOk = (sr === ep.r1 && sc === ep.c1) || (sr === ep.r2 && sc === ep.c2);
    const endsOk   = (er === ep.r1 && ec === ep.c1) || (er === ep.r2 && ec === ep.c2);
    if (!startsOk || !endsOk) return;
  }

  winGame();
}

// ── WIN ───────────────────────────────────────────────────────────────────────
function winGame() {
  solved = true;
  stopTimer();
  dragging = null;

  // Persist streak
  const streakData = loadStreak();
  const newStreak = bumpStreak(streakData, dateStr);
  saveStreak(newStreak);

  // Build emoji grid
  const emojiGrid = buildEmojiGrid();

  // Show win screen
  document.getElementById('game-screen').style.display = 'none';
  const winScreen = document.getElementById('win-screen');
  winScreen.style.display = 'flex';

  document.getElementById('win-time').textContent  = `solved in ${formatTime(elapsed)}`;
  document.getElementById('win-streak').textContent = newStreak.count > 1
    ? `🔥 ${newStreak.count}-day streak`
    : 'first solve!';

  const emojiEl = document.getElementById('emoji-grid');
  emojiEl.textContent = emojiGrid;

  // Show share section
  const shareSection = document.getElementById('share');
  shareSection.style.display = 'flex';

  // Store for share()
  window._shareText = `Pipe Connect ${dateStr}\n${formatTime(elapsed)}\n\n${emojiGrid}\n\nhttps://benlirio.com/pipe-connect/`;
}

function buildEmojiGrid() {
  const rows = [];
  for (let r = 0; r < GRID; r++) {
    let row = '';
    for (let c = 0; c < GRID; c++) {
      const ci = userGrid[r][c];
      row += ci >= 0 ? PIPE_COLORS[ci].emoji : '⬛';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

// ── STREAK ────────────────────────────────────────────────────────────────────
const STREAK_KEY = 'pipe-connect-streak';

function loadStreak() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: '' };
  } catch { return { count: 0, lastDate: '' }; }
}

function saveStreak(s) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
}

function bumpStreak(s, today) {
  if (s.lastDate === today) return s; // already solved today
  const yesterday = offsetDate(today, -1);
  const newCount = s.lastDate === yesterday ? s.count + 1 : 1;
  return { count: newCount, lastDate: today };
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function updateStreakDisplay() {
  const s = loadStreak();
  const el = document.getElementById('streak-display');
  if (s.count > 0) {
    el.textContent = `🔥 ${s.count}`;
  }
}

// ── RESET ─────────────────────────────────────────────────────────────────────
function resetPuzzle() {
  initState();
  drawAll();
}

// ── SHOW SOLUTION (after win) ─────────────────────────────────────────────────
function showSolution() {
  document.getElementById('win-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';

  // Fill userGrid with solution
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      userGrid[r][c] = puzzle.solution[r][c];

  // Rebuild paths from solution for drawing
  for (let ci = 0; ci < PIPE_COLORS.length; ci++) {
    activePaths[ci] = [];
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (puzzle.solution[r][c] === ci) activePaths[ci].push([r, c]);
  }

  drawAll();
}

// ── SHARE ─────────────────────────────────────────────────────────────────────
function share() {
  const text = window._shareText || `Pipe Connect ${dateStr}\nhttps://benlirio.com/pipe-connect/`;
  if (navigator.share) {
    navigator.share({ title: 'Pipe Connect', text, url: 'https://benlirio.com/pipe-connect/' })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => alert('Result copied! Paste it anywhere to share.'))
      .catch(() => alert('Share:\n\n' + text));
  }
}
