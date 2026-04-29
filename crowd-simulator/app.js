'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const CANVAS_W = 500;
const CANVAS_H = 500;
const AGENT_COUNT = 60;
const AGENT_RADIUS = 6;
const AGENT_SPEED = 2.0;
const EXIT_RADIUS = 18;
const WALL_THICKNESS = 10;
const SEPARATION_RADIUS = AGENT_RADIUS * 3;
const SEPARATION_FORCE = 0.6;
const STEER_FORCE = 0.18;
const MAX_SIM_TIME = 60;
const TICK_MS = 1000 / 60;

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let currentTool = 'wall';
let walls = [];        // {x1,y1,x2,y2}
let exits = [];        // {x,y}
let agents = [];
let isSimulating = false;
let simStartTime = 0;
let simElapsed = 0;
let rafId = null;
let escapedCount = 0;
let allEscaped = false;
let drawingWall = null; // {x1,y1}
let bestTime = parseFloat(localStorage.getItem('crowdSimBest') || 'Infinity');

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  // Set internal resolution
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  updateBestDisplay();
  renderEdit();

  // Mouse events
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);

  // Touch events
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(touchToMouse(e)); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); onPointerMove(touchToMouse(e)); }, { passive: false });
  canvas.addEventListener('touchend', e => { e.preventDefault(); onPointerUp(touchToMouse(e)); }, { passive: false });
});

function touchToMouse(e) {
  const touch = e.changedTouches[0];
  return { clientX: touch.clientX, clientY: touch.clientY };
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// ─── Tool selection ───────────────────────────────────────────────────────────
function setTool(tool) {
  if (isSimulating) return;
  currentTool = tool;
  document.getElementById('btn-wall').classList.toggle('active', tool === 'wall');
  document.getElementById('btn-exit').classList.toggle('active', tool === 'exit');
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
let isPointerDown = false;

function onPointerDown(e) {
  if (isSimulating) return;
  const pos = getCanvasPos(e);
  isPointerDown = true;

  if (currentTool === 'wall') {
    drawingWall = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
  } else if (currentTool === 'exit') {
    exits.push({ x: pos.x, y: pos.y });
    renderEdit();
  }
}

function onPointerMove(e) {
  if (!isPointerDown || isSimulating || currentTool !== 'wall') return;
  const pos = getCanvasPos(e);
  if (drawingWall) {
    drawingWall.x2 = pos.x;
    drawingWall.y2 = pos.y;
    renderEdit();
  }
}

function onPointerUp(e) {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (isSimulating) return;

  if (currentTool === 'wall' && drawingWall) {
    const dx = drawingWall.x2 - drawingWall.x1;
    const dy = drawingWall.y2 - drawingWall.y1;
    if (Math.sqrt(dx * dx + dy * dy) > 4) {
      walls.push({ ...drawingWall });
    }
    drawingWall = null;
    renderEdit();
  }
}

function clearCanvas() {
  if (isSimulating) return;
  walls = [];
  exits = [];
  drawingWall = null;
  renderEdit();
}

// ─── Render edit mode ─────────────────────────────────────────────────────────
function renderEdit() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 20; x < CANVAS_W; x += 20) {
    for (let y = 20; y < CANVAS_H; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pre-interaction hint
  if (walls.length === 0 && exits.length === 0) {
    ctx.fillStyle = 'rgba(245,196,0,0.12)';
    ctx.font = '700 18px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESIGN YOUR CROWD TRAP', CANVAS_W / 2, CANVAS_H / 2 - 14);
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(245,196,0,0.06)';
    ctx.fillText('drag to draw walls · tap EXIT to place exits', CANVAS_W / 2, CANVAS_H / 2 + 14);
    ctx.textAlign = 'left';
  }

  drawWalls(walls);
  if (drawingWall) drawWalls([drawingWall], true);
  drawExits(exits);
}

function drawWalls(wallList, preview = false) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = preview ? 'rgba(245,196,0,0.5)' : '#f5c400';
  ctx.lineWidth = WALL_THICKNESS;
  for (const w of wallList) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
}

function drawExits(exitList) {
  for (const ex of exitList) {
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, EXIT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(42, 212, 122, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#2ad47a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Arrow
    ctx.fillStyle = '#2ad47a';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', ex.x, ex.y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────
function startSimulation() {
  if (exits.length === 0) {
    showValidationError();
    return;
  }

  // Show loading overlay
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = 'flex';

  document.getElementById('result-panel').style.display = 'none';
  document.getElementById('share').style.display = 'none';

  setTimeout(() => {
    overlay.style.display = 'none';
    beginSim();
  }, 800);
}

function showValidationError() {
  const overlay = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');
  txt.textContent = 'WHERE ARE THEY SUPPOSED TO GO?! PLACE AN EXIT FIRST.';
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.style.display = 'none';
    txt.textContent = 'CALCULATING OPTIMAL PANIC ROUTES...';
  }, 1800);
}

function beginSim() {
  isSimulating = true;
  document.body.classList.add('simulating');
  document.getElementById('result-panel').style.display = 'none';

  // Spawn agents in a cluster away from exits
  agents = [];
  escapedCount = 0;
  allEscaped = false;

  for (let i = 0; i < AGENT_COUNT; i++) {
    let x, y, attempts = 0;
    do {
      x = 30 + Math.random() * (CANVAS_W - 60);
      y = 30 + Math.random() * (CANVAS_H - 60);
      attempts++;
    } while (attempts < 20 && isNearExit(x, y));

    agents.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      escaped: false,
      color: `hsl(${30 + Math.random() * 30},80%,${55 + Math.random() * 20}%)`
    });
  }

  updateHUD(0);
  simStartTime = performance.now();
  rafId = requestAnimationFrame(simLoop);
}

function isNearExit(x, y) {
  for (const ex of exits) {
    const dx = x - ex.x, dy = y - ex.y;
    if (dx * dx + dy * dy < (EXIT_RADIUS + 30) * (EXIT_RADIUS + 30)) return true;
  }
  return false;
}

function simLoop(ts) {
  simElapsed = (ts - simStartTime) / 1000;

  if (simElapsed >= MAX_SIM_TIME) {
    endSimulation(false);
    return;
  }

  updateAgents();
  renderSim();
  updateHUD(simElapsed);

  if (escapedCount === AGENT_COUNT) {
    endSimulation(true);
    return;
  }

  rafId = requestAnimationFrame(simLoop);
}

function updateAgents() {
  for (const agent of agents) {
    if (agent.escaped) continue;

    // Find nearest exit
    let nearestEx = null, nearestDist = Infinity;
    for (const ex of exits) {
      const dx = ex.x - agent.x, dy = ex.y - agent.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEx = ex;
      }
    }

    if (nearestEx) {
      // Check escape
      if (nearestDist < EXIT_RADIUS) {
        agent.escaped = true;
        escapedCount++;
        continue;
      }

      // Steer toward exit
      const dx = nearestEx.x - agent.x;
      const dy = nearestEx.y - agent.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      agent.vx += (dx / len) * STEER_FORCE;
      agent.vy += (dy / len) * STEER_FORCE;
    }

    // Separation from other agents
    let sx = 0, sy = 0;
    for (const other of agents) {
      if (other === agent || other.escaped) continue;
      const dx = agent.x - other.x, dy = agent.y - other.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < SEPARATION_RADIUS && d > 0.01) {
        sx += (dx / d) * (SEPARATION_RADIUS - d);
        sy += (dy / d) * (SEPARATION_RADIUS - d);
      }
    }
    agent.vx += sx * SEPARATION_FORCE * 0.01;
    agent.vy += sy * SEPARATION_FORCE * 0.01;

    // Clamp speed
    const speed = Math.sqrt(agent.vx * agent.vx + agent.vy * agent.vy);
    if (speed > AGENT_SPEED) {
      agent.vx = (agent.vx / speed) * AGENT_SPEED;
      agent.vy = (agent.vy / speed) * AGENT_SPEED;
    }

    // Propose new position
    let nx = agent.x + agent.vx;
    let ny = agent.y + agent.vy;

    // Wall collision - slide along walls
    for (const w of walls) {
      const result = resolveWallCollision(nx, ny, agent.vx, agent.vy, w);
      nx = result.x;
      ny = result.y;
      agent.vx = result.vx;
      agent.vy = result.vy;
    }

    // Canvas bounds
    nx = Math.max(AGENT_RADIUS, Math.min(CANVAS_W - AGENT_RADIUS, nx));
    ny = Math.max(AGENT_RADIUS, Math.min(CANVAS_H - AGENT_RADIUS, ny));
    if (nx <= AGENT_RADIUS || nx >= CANVAS_W - AGENT_RADIUS) agent.vx *= -0.5;
    if (ny <= AGENT_RADIUS || ny >= CANVAS_H - AGENT_RADIUS) agent.vy *= -0.5;

    agent.x = nx;
    agent.y = ny;
  }
}

function resolveWallCollision(px, py, vx, vy, wall) {
  // Find closest point on wall segment to agent center
  const wx = wall.x2 - wall.x1;
  const wy = wall.y2 - wall.y1;
  const len2 = wx * wx + wy * wy;
  if (len2 < 0.001) return { x: px, y: py, vx, vy };

  const t = Math.max(0, Math.min(1, ((px - wall.x1) * wx + (py - wall.y1) * wy) / len2));
  const cx = wall.x1 + t * wx;
  const cy = wall.y1 + t * wy;

  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = AGENT_RADIUS + WALL_THICKNESS / 2;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;
    // Push out
    const overlap = minDist - dist;
    const newX = px + nx * overlap;
    const newY = py + ny * overlap;
    // Reflect velocity component along normal (slide)
    const dot = vx * nx + vy * ny;
    const newVx = vx - dot * nx;
    const newVy = vy - dot * ny;
    return { x: newX, y: newY, vx: newVx * 0.85, vy: newVy * 0.85 };
  }

  return { x: px, y: py, vx, vy };
}

function renderSim() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 20; x < CANVAS_W; x += 20) {
    for (let y = 20; y < CANVAS_H; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWalls(walls);
  drawExits(exits);

  // Agents
  for (const agent of agents) {
    if (agent.escaped) continue;
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, AGENT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = agent.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Timer overlay
  if (!allEscaped) {
    const remaining = Math.max(0, MAX_SIM_TIME - simElapsed);
    const alpha = remaining < 10 ? 0.6 + 0.4 * Math.sin(performance.now() / 150) : 0.2;
    ctx.fillStyle = `rgba(245,196,0,${alpha})`;
    ctx.font = 'bold 14px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(simElapsed.toFixed(1) + 's', CANVAS_W - 10, 22);
    ctx.textAlign = 'left';
  }
}

function updateHUD(elapsed) {
  document.getElementById('hud-time').textContent = elapsed.toFixed(1) + 's';
  document.getElementById('hud-escaped').textContent = `${escapedCount} / ${AGENT_COUNT}`;
  updateBestDisplay();
}

function updateBestDisplay() {
  const best = parseFloat(localStorage.getItem('crowdSimBest') || 'Infinity');
  document.getElementById('hud-best').textContent = isFinite(best) ? best.toFixed(1) + 's' : '--';
}

function endSimulation(success) {
  cancelAnimationFrame(rafId);
  isSimulating = false;
  document.body.classList.remove('simulating');
  allEscaped = success;

  const panel = document.getElementById('result-panel');
  const titleEl = document.getElementById('result-title');
  const timeEl = document.getElementById('result-time');
  const copyEl = document.getElementById('result-copy');
  const bestEl = document.getElementById('result-best');

  const prevBest = parseFloat(localStorage.getItem('crowdSimBest') || 'Infinity');

  if (success) {
    const t = simElapsed;
    let isNewBest = false;

    if (t < prevBest) {
      localStorage.setItem('crowdSimBest', t.toFixed(2));
      isNewBest = true;
    }

    titleEl.style.color = '#2ad47a';
    titleEl.textContent = isNewBest ? 'NEW RECORD — EVERYONE MADE IT' : 'EVERYONE MADE IT';
    timeEl.textContent = t.toFixed(1) + 's';

    // Result micro-copy based on performance
    let copy;
    if (t < 5) copy = `${t.toFixed(1)}s? Your crowd barely had time to panic. Impressive.`;
    else if (t < 15) copy = `${t.toFixed(1)}s. Clean lines, clear exits. You've done this before.`;
    else if (t < 30) copy = `${t.toFixed(1)}s. Some bottlenecks. The safety inspector has notes.`;
    else copy = `${t.toFixed(1)}s. They made it, but only barely. Please report to HR.`;
    copyEl.textContent = copy;

    const currentBest = Math.min(t, prevBest);
    bestEl.textContent = isNewBest
      ? `⚡ NEW PERSONAL BEST! Previous: ${isFinite(prevBest) ? prevBest.toFixed(1) + 's' : 'none'}`
      : `Personal best: ${currentBest.toFixed(1)}s`;

    document.getElementById('share').style.display = 'block';
  } else {
    titleEl.style.color = '#d4342a';
    titleEl.textContent = 'TIME EXPIRED — CHAOS WINS';
    timeEl.textContent = `${escapedCount}/${AGENT_COUNT}`;
    copyEl.textContent = `Only ${escapedCount} of ${AGENT_COUNT} escaped. The bottleneck was definitely not your fault.`;
    bestEl.textContent = isFinite(prevBest) ? `Best time: ${prevBest.toFixed(1)}s` : 'No best time yet.';
  }

  panel.style.display = 'block';
  updateBestDisplay();
}

function resetToEdit() {
  isSimulating = false;
  agents = [];
  escapedCount = 0;
  allEscaped = false;
  cancelAnimationFrame(rafId);
  document.body.classList.remove('simulating');
  document.getElementById('result-panel').style.display = 'none';
  document.getElementById('share').style.display = 'none';
  document.getElementById('hud-time').textContent = '0.0s';
  document.getElementById('hud-escaped').textContent = `0 / ${AGENT_COUNT}`;
  renderEdit();
}

// ─── Share ────────────────────────────────────────────────────────────────────
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}
