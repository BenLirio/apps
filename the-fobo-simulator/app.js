// The FOBO Simulator — pixel-art job displacement tap game

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// Game state
let jobTitle = '';
let humanPct = 100;
let robotPct = 0;
let gameRunning = false;
let gameInterval = null;
let upskillCooldown = false;
let upskillCount = 0;
let animFrame = null;

// Canvas & pixel art
let canvas, ctx;
const CANVAS_W = 480;
const CANVAS_H = 260;
const PIXEL = 8; // pixel art grid unit

// Pixel art sprites (as grid arrays — 1=color, 0=transparent)
// Human worker sprite (8x12 pixels)
const HUMAN_SPRITE = [
  [0,0,1,1,1,0,0,0],
  [0,0,1,2,1,0,0,0],
  [0,0,1,1,1,0,0,0],
  [0,1,3,3,3,1,0,0],
  [0,0,3,3,3,0,0,0],
  [0,0,3,3,3,0,0,0],
  [0,1,0,0,0,1,0,0],
  [0,1,0,0,0,1,0,0],
  [0,1,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0],
];
const HUMAN_COLORS = { 1: '#e8c98a', 2: '#b08040', 3: '#3399cc', 0: null };

// Robot sprite (8x10 pixels)
const ROBOT_SPRITE = [
  [0,1,1,1,1,1,0,0],
  [0,1,2,1,2,1,0,0],
  [0,1,1,1,1,1,0,0],
  [0,1,3,3,3,1,0,0],
  [1,3,3,3,3,3,1,0],
  [1,3,3,3,3,3,1,0],
  [0,1,3,3,3,1,0,0],
  [0,1,0,0,0,1,0,0],
  [0,1,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0],
];
const ROBOT_COLORS = { 1: '#888', 2: '#ff4444', 3: '#cc3333', 0: null };

// Desk sprite (16x4 pixels)
const DESK_ROW = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];

// Upskill messages — shown while tapping
const UPSKILL_MSGS = [
  'Enrolled in "AI Prompting 101"...',
  'Added "blockchain" to resume...',
  'Bought a Udemy course...',
  'Attended a networking event...',
  'Made a LinkedIn post about pivoting...',
  'Learned to code (HTML)...',
  'Hired a career coach...',
  'Completed a "Future of Work" webinar...',
  'Rebranded as a "Thought Leader"...',
  'Downloaded Duolingo...',
  'Got certified in something...',
  'Pivoted to consulting...',
  'Started a newsletter...',
  'Added "AI-adjacent" to bio...',
  'Filed a complaint with HR...',
  'Watched a TED talk...',
  'Updated headshot to look "dynamic"...',
  'Requested "upskilling budget"...',
];

// Robot takeover taunts
const ROBOT_MSGS = [
  'ROBOT: Optimizing your workflow...',
  'ROBOT: Your tasks have been automated.',
  'ROBOT: Error 404: Your value not found.',
  'ROBOT: I work 24/7 for $0.',
  'ROBOT: Synergizing without you.',
  'ROBOT: Your password has been reset.',
  'ROBOT: Your desk has been reassigned.',
  'ROBOT: Please return your badge.',
];

// Animation particles
let particles = [];

function initCanvas() {
  canvas = document.getElementById('game-canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
}

function drawSprite(sprite, colors, x, y, scale) {
  const s = scale || PIXEL;
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const c = sprite[row][col];
      if (c !== 0 && colors[c]) {
        ctx.fillStyle = colors[c];
        ctx.fillRect(x + col * s, y + row * s, s, s);
      }
    }
  }
}

function drawDesk(x, y, w) {
  // Draw a pixel-art desk
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x, y, w, PIXEL);
  ctx.fillStyle = '#5a3a18';
  ctx.fillRect(x, y + PIXEL, w, PIXEL * 0.5);
  // Monitor
  ctx.fillStyle = '#222';
  ctx.fillRect(x + w / 2 - PIXEL * 2, y - PIXEL * 5, PIXEL * 4, PIXEL * 3.5);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(x + w / 2 - PIXEL * 1.5, y - PIXEL * 4.5, PIXEL * 3, PIXEL * 2.5);
  // Monitor stand
  ctx.fillStyle = '#333';
  ctx.fillRect(x + w / 2 - PIXEL * 0.5, y - PIXEL * 1.5, PIXEL, PIXEL * 1.5);
}

function drawScene() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background grid floor
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid lines (pixel art perspective)
  ctx.strokeStyle = '#151525';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += PIXEL * 4) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += PIXEL * 4) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Calculate positions based on robotPct (robot advances from right)
  const humanX = 40;
  const deskX = 120;
  const deskY = CANVAS_H - 80;
  const deskW = CANVAS_W - 160;

  // Robot position: starts at right edge, advances to desk
  const robotAdvance = (robotPct / 100) * (deskW - 30);
  const robotX = CANVAS_W - 60 - robotAdvance;

  // Draw desk
  drawDesk(deskX, deskY, deskW);

  // Draw human — fades/moves left as robot advances
  const humanOpacity = Math.max(0.15, (humanPct / 100));
  const humanShift = (robotPct / 100) * (-30);
  ctx.globalAlpha = humanOpacity;
  drawSprite(HUMAN_SPRITE, HUMAN_COLORS, humanX + humanShift, deskY - PIXEL * 10, PIXEL);
  ctx.globalAlpha = 1.0;

  // Draw robot
  if (robotPct > 5) {
    const robotOpacity = Math.min(1.0, robotPct / 30);
    ctx.globalAlpha = robotOpacity;
    drawSprite(ROBOT_SPRITE, ROBOT_COLORS, robotX, deskY - PIXEL * 10, PIXEL);

    // Robot glow effect
    if (robotPct > 50) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(robotX - 4, deskY - PIXEL * 11, PIXEL * 9, PIXEL * 12);
    }
    ctx.globalAlpha = 1.0;
  }

  // Progress line showing territory
  const territoryX = deskX + deskW - (robotPct / 100) * deskW;
  if (robotPct > 10) {
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(territoryX, 0);
    ctx.lineTo(territoryX, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  // Draw particles
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, PIXEL, PIXEL);
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life--;
    ctx.globalAlpha = 1.0;
  }

  // GAME OVER overlay
  if (!gameRunning && robotPct >= 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ff2222';
    ctx.font = `bold ${PIXEL * 4}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('REPLACED', CANVAS_W / 2, CANVAS_H / 2 - PIXEL * 3);
    ctx.fillStyle = '#ffe900';
    ctx.font = `${PIXEL * 2}px "Press Start 2P", monospace`;
    ctx.fillText('generating certificate...', CANVAS_W / 2, CANVAS_H / 2 + PIXEL * 2);
  }
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 5 - 1,
      color,
      life: 20 + Math.random() * 20,
      maxLife: 40,
    });
  }
}

function gameLoop() {
  drawScene();
  if (gameRunning) animFrame = requestAnimationFrame(gameLoop);
}

function startGame() {
  jobTitle = document.getElementById('job-input').value.trim();
  if (!jobTitle) {
    const input = document.getElementById('job-input');
    input.placeholder = 'c\'mon, you have a job title right??';
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
    return;
  }

  showScreen('game');
  humanPct = 100;
  robotPct = 0;
  upskillCount = 0;
  particles = [];
  gameRunning = true;
  upskillCooldown = false;

  initCanvas();
  animFrame = requestAnimationFrame(gameLoop);

  // Robot advances on interval
  gameInterval = setInterval(() => {
    if (!gameRunning) return;

    const advance = 0.8 + (robotPct / 100) * 1.2; // accelerates
    robotPct = Math.min(100, robotPct + advance);
    humanPct = Math.max(0, 100 - robotPct);

    updateHUD();

    // Random robot taunt
    if (Math.random() < 0.12) {
      showStatus(ROBOT_MSGS[Math.floor(Math.random() * ROBOT_MSGS.length)], '#ff4444');
    }

    if (robotPct >= 100) {
      endGame();
    }
  }, 300);
}

function updateHUD() {
  document.getElementById('humanity-bar').style.width = humanPct + '%';
  document.getElementById('robot-bar').style.width = robotPct + '%';
}

function doUpskill() {
  if (!gameRunning || upskillCooldown) return;

  upskillCount++;
  upskillCooldown = true;

  const btn = document.getElementById('upskill-btn');
  btn.disabled = true;
  btn.textContent = 'LEARNING...';

  // Slow robot BRIEFLY
  robotPct = Math.max(0, robotPct - 3);
  humanPct = Math.min(100, humanPct + 3);
  updateHUD();

  // Particles at canvas center-ish
  spawnParticles(200, 120, '#00e5ff', 8);

  const msg = UPSKILL_MSGS[upskillCount % UPSKILL_MSGS.length];
  showStatus(msg, '#00e5ff');

  // Cooldown 1.5 seconds — upskilling only delays the inevitable
  const cooldown = 1500 + upskillCount * 200; // gets longer each time
  setTimeout(() => {
    upskillCooldown = false;
    if (gameRunning) {
      btn.disabled = false;
      btn.textContent = 'UPSKILL!';
    }
  }, cooldown);
}

function showStatus(msg, color) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.color = color || '#ffe900';
}

function endGame() {
  gameRunning = false;
  clearInterval(gameInterval);

  const btn = document.getElementById('upskill-btn');
  btn.disabled = true;
  btn.textContent = 'TOO LATE';

  robotPct = 100;
  humanPct = 0;
  updateHUD();
  drawScene();

  setTimeout(() => {
    showScreen('cert');
    generateCertificate();
  }, 1800);
}

async function generateCertificate() {
  document.getElementById('generating-msg').style.display = 'block';
  document.getElementById('certificate').style.display = 'none';
  document.getElementById('share').style.display = 'none';

  const prompt = `You are issuing an official Obsolescence Certificate to someone whose job has been automated away.

Their job title: "${jobTitle}"

Respond with ONLY valid JSON in this exact format, no other text:
{
  "ai_name": "A funny, specific AI product name (like 'TaskMaster Pro 9000' or 'SynergyBot Quantum' — make it absurd and corporate-sounding, 8-25 chars)",
  "cause": "A single absurdly specific and funny cause of displacement (20-60 chars, e.g. 'learned to write emails 0.003% faster')"
}`;

  let aiName = 'AUTOMATE-O-TRON 3000';
  let cause = 'performed your entire job for $0.0002 per task';

  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        system: 'You are a darkly comedic HR automation system. Always respond with valid JSON only.',
        max_tokens: 120,
        model: 'gpt-5.4-mini',
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = (data.text || data.content || data.response || '').trim();
      // Extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.ai_name) aiName = parsed.ai_name;
        if (parsed.cause) cause = parsed.cause;
      }
    }
  } catch (e) {
    // Use fallbacks silently
  }

  // Build certificate
  document.getElementById('cert-job').textContent = jobTitle.toUpperCase();
  document.getElementById('cert-ai').textContent = aiName.toUpperCase();
  document.getElementById('cert-cause').textContent = cause;
  document.getElementById('cert-date').textContent =
    'DATE: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();

  document.getElementById('generating-msg').style.display = 'none';
  document.getElementById('certificate').style.display = 'flex';
  document.getElementById('share').style.display = 'flex';
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.getElementById('screen-' + name).style.display = '';
}

function share() {
  const aiEl = document.getElementById('cert-ai');
  const causeEl = document.getElementById('cert-cause');
  const aiName = aiEl ? aiEl.textContent : 'an AI';
  const cause = causeEl ? causeEl.textContent : '';
  const shareText = `I just got FOBO'd! My job as ${jobTitle} was replaced by ${aiName} because it "${cause}". Get your Obsolescence Certificate:`;

  if (navigator.share) {
    navigator.share({
      title: 'The FOBO Simulator — My Obsolescence Certificate',
      text: shareText,
      url: location.href,
    });
  } else {
    navigator.clipboard.writeText(shareText + '\n' + location.href)
      .then(() => alert('Certificate + link copied!'));
  }
}

// Wire up events
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('upskill-btn').addEventListener('click', doUpskill);

  document.getElementById('job-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    clearInterval(gameInterval);
    showScreen('intro');
    document.getElementById('job-input').value = '';
    document.getElementById('job-input').placeholder = 'e.g. Senior Synergy Manager';
  });
});
