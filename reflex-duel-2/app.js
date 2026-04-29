// ── Config ────────────────────────────────────────────────────
const WSS_URL = 'wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod';
const SLUG    = 'reflex-duel-2';
const MAX_WINS = 4;              // best of 7
const SAFETY_TIMEOUT_MS = 6000;  // if you don't tap, you forfeit this round
const TIMEOUT_REACTION_MS = 9999;

// ── State ─────────────────────────────────────────────────────
let ws           = null;
let playerRole   = null;   // 'host' | 'guest'
let playerName   = '';
let opponentName = '';
let currentRoomCode = null;

let hostWins       = 0;
let guestWins      = 0;
let roundNum       = 0;
let bestReactionMs = Infinity;

// Per-round
let currentRoundId  = null;
let circleShownAt   = null;   // local ms when circle became visible
let tapLocked       = false;  // true once I've sent my tap (or false-started)
let showTimer       = null;
let safetyTimer     = null;

// ── Utils ─────────────────────────────────────────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function show(screenId) {
  ['screen-landing', 'screen-waiting', 'screen-game', 'screen-result']
    .forEach(id => {
      document.getElementById(id).style.display = (id === screenId) ? '' : 'none';
    });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = '';
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// ── WebSocket ─────────────────────────────────────────────────
function openWS(onOpen) {
  ws = new WebSocket(WSS_URL);
  ws.onopen    = onOpen;
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose   = () => {
    const mid = document.getElementById('screen-game').style.display   !== 'none' ||
                document.getElementById('screen-waiting').style.display !== 'none';
    if (mid) {
      show('screen-result');
      document.getElementById('result-headline').textContent = 'CONNECTION LOST';
      document.getElementById('result-detail').textContent =
        'the arena lights flickered out.\nblame the wifi, call it a draw.';
    }
  };
}

// ── Actions ───────────────────────────────────────────────────
function createRoom() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) { showError("can't fight without a name, champ"); return; }

  const roomCode  = generateRoomCode();
  currentRoomCode = roomCode;
  playerRole      = 'host';

  openWS(() => {
    send({ action: 'create_room', slug: SLUG, playerName, roomCode });
  });
}

function joinRoom() {
  playerName = document.getElementById('player-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!playerName) { showError("can't fight without a name, champ"); return; }
  if (code.length !== 6) { showError("that code looks wrong — 6 characters, all caps"); return; }

  currentRoomCode = code;
  playerRole      = 'guest';

  openWS(() => {
    send({ action: 'join_room', roomCode: code, playerName });
  });
}

// ── Message handler ───────────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {
    case 'room_created':
      document.getElementById('room-code-display').textContent = msg.roomCode;
      show('screen-waiting');
      break;

    case 'player_joined':
      opponentName = msg.guestName;
      show('screen-game');
      initGameUI();
      if (playerRole === 'host') startNextRound();
      break;

    case 'joined_room':
      opponentName = msg.hostName;
      currentRoomCode = msg.roomCode;
      show('screen-game');
      initGameUI();
      break;

    case 'reflex_round_ready':
      applyRoundReady(msg);
      break;

    case 'reflex_verdict':
      applyVerdict(msg);
      break;

    case 'opponent_disconnected':
      show('screen-result');
      document.getElementById('result-headline').textContent = 'OPPONENT LEFT';
      document.getElementById('result-detail').textContent =
        'they rage-quit. respect the cowardice.\nyou win by forfeit.';
      break;

    case 'error': {
      const copy = {
        room_not_found: "arena not found — double-check that code",
        room_full:      'that arena is full — ask them to start a fresh one'
      };
      showError(copy[msg.message] || 'something went wrong in the arena');
      break;
    }
  }
}

// ── Game init ─────────────────────────────────────────────────
function initGameUI() {
  document.getElementById('host-name-display').textContent =
    (playerRole === 'host' ? playerName : opponentName).toUpperCase();
  document.getElementById('guest-name-display').textContent =
    (playerRole === 'guest' ? playerName : opponentName).toUpperCase();

  updateScoreboard();
  setArenaMessage('get ready...', 'active');
  hideCircle();
  hideRoundResult();

  const arena = document.getElementById('arena');
  arena.addEventListener('click', onArenaTap);
  arena.addEventListener('touchstart', onArenaTap, { passive: false });
}

function updateScoreboard() {
  document.getElementById('host-wins').textContent  = hostWins;
  document.getElementById('guest-wins').textContent = guestWins;
  const shown = Math.min(roundNum, 7);
  document.getElementById('round-counter').textContent = `R${Math.max(1, shown)}/7`;
}

function setArenaMessage(text, variant) {
  const el = document.getElementById('arena-message');
  el.textContent = text;
  el.className = 'arena-message' + (variant ? ' ' + variant : '');
  el.style.display = '';
}

function hideArenaMessage() {
  document.getElementById('arena-message').style.display = 'none';
}

function showCircle(nx, ny) {
  const arena  = document.getElementById('arena');
  const circle = document.getElementById('target-circle');
  const rect   = arena.getBoundingClientRect();

  const margin = 65;
  const clampedX = Math.min(Math.max(nx * rect.width,  margin), rect.width  - margin);
  const clampedY = Math.min(Math.max(ny * rect.height, margin), rect.height - margin);

  circle.style.left    = clampedX + 'px';
  circle.style.top     = clampedY + 'px';
  circle.style.display = '';
  circle.className     = 'target-circle';
}

function hideCircle() {
  document.getElementById('target-circle').style.display = 'none';
}

function hideRoundResult() {
  document.getElementById('round-result').style.display = 'none';
}

function showRoundResult(headline, reactionText, variant) {
  document.getElementById('round-result-text').textContent     = headline;
  document.getElementById('reaction-time-display').textContent = reactionText;
  document.getElementById('round-result').style.display        = '';
  const circle = document.getElementById('target-circle');
  if (variant) circle.className = 'target-circle ' + variant;
}

function flashFalseStart() {
  const el = document.getElementById('false-start-flash');
  el.style.display = '';
  // Re-trigger animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 600);
}

// ── Round flow: request from server (host only) ───────────────
function startNextRound() {
  if (playerRole !== 'host') return;
  send({ action: 'reflex_start_round', roomCode: currentRoomCode });
}

// ── Round ready: schedule reveal ──────────────────────────────
function applyRoundReady(msg) {
  const { roundId, circleX, circleY, delayMs } = msg;
  currentRoundId = roundId;
  tapLocked      = false;
  circleShownAt  = null;
  roundNum++;

  if (showTimer)   { clearTimeout(showTimer);   showTimer = null; }
  if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }

  hideCircle();
  hideRoundResult();
  updateScoreboard();
  setArenaMessage('FOCUS...', 'focus');

  showTimer = setTimeout(() => {
    showTimer = null;
    // If they false-started during the wait, tap is already locked. Still
    // reveal the circle so the opponent has something to aim at visually.
    circleShownAt = Date.now();
    showCircle(circleX, circleY);
    hideArenaMessage();

    // Safety: if neither player taps, forfeit after SAFETY_TIMEOUT_MS.
    safetyTimer = setTimeout(() => {
      safetyTimer = null;
      if (!tapLocked) sendTap(TIMEOUT_REACTION_MS);
    }, SAFETY_TIMEOUT_MS);
  }, Math.max(0, delayMs));
}

// ── Tap handler ───────────────────────────────────────────────
function onArenaTap(e) {
  if (!currentRoundId || tapLocked) return;
  // Swallow touchstart so it doesn't become a duplicate click
  if (e.type === 'touchstart') { e.preventDefault(); }

  // Pre-circle tap → false start, lose this round.
  if (circleShownAt === null) {
    tapLocked = true;
    flashFalseStart();
    setArenaMessage('TOO SOON', 'verdict-loss');
    sendTap(TIMEOUT_REACTION_MS);
    return;
  }

  // Only register taps on the circle once it's visible, to avoid
  // accidental thumb-drift-wins.
  const circle = document.getElementById('target-circle');
  const target = e.target || e.srcElement;
  if (target !== circle) return;

  const reactionMs = Math.max(0, Date.now() - circleShownAt);
  tapLocked = true;
  circle.className = 'target-circle pending';
  sendTap(reactionMs);
}

function sendTap(reactionMs) {
  tapLocked = true;
  if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
  send({
    action: 'reflex_tap',
    roomCode: currentRoomCode,
    roundId: currentRoundId,
    reactionMs
  });
}

// ── Verdict: server is the authority ──────────────────────────
function applyVerdict(msg) {
  if (msg.roundId !== currentRoundId) return; // stale

  // Lock further taps and stop all timers
  tapLocked = true;
  if (showTimer)   { clearTimeout(showTimer);   showTimer = null; }
  if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }

  const { winnerRole, hostMs, guestMs } = msg;
  if (winnerRole === 'host') hostWins++; else guestWins++;

  const myMs  = playerRole === 'host' ? hostMs  : guestMs;
  const oppMs = playerRole === 'host' ? guestMs : hostMs;
  const iWon  = (winnerRole === playerRole);

  if (iWon && myMs < bestReactionMs && myMs < TIMEOUT_REACTION_MS) {
    bestReactionMs = myMs;
  }

  updateScoreboard();

  // Make sure the circle is visible for the result flash even if we
  // verdict'd before it was drawn (edge: both timeout).
  if (document.getElementById('target-circle').style.display === 'none') {
    // Show a neutral circle in the center so the result has somewhere to land.
    const c = document.getElementById('target-circle');
    const rect = document.getElementById('arena').getBoundingClientRect();
    c.style.left = (rect.width / 2) + 'px';
    c.style.top  = (rect.height / 2) + 'px';
    c.style.display = '';
  }
  const variant = iWon ? 'hit' : 'missed';

  // Headline copy
  const myLabel  = playerName.toUpperCase();
  const oppLabel = opponentName.toUpperCase();
  const winLabel = iWon ? myLabel : oppLabel;

  const reactionText = (() => {
    const winnerMs = (winnerRole === 'host') ? hostMs : guestMs;
    if (winnerMs >= TIMEOUT_REACTION_MS) return 'won by forfeit';
    const mineText = myMs >= TIMEOUT_REACTION_MS ? 'no tap' : `${myMs}ms`;
    const oppText  = oppMs >= TIMEOUT_REACTION_MS ? 'no tap' : `${oppMs}ms`;
    const zap = (iWon && myMs < 200) ? ' ⚡' : '';
    return `you ${mineText}${zap} · ${opponentName.toLowerCase()} ${oppText}`;
  })();

  const headline = iWon ? 'YOU WIN' : `${winLabel} WINS`;
  showRoundResult(headline, reactionText, variant);

  // Game over?
  if (hostWins >= MAX_WINS || guestWins >= MAX_WINS) {
    setTimeout(endGame, 1200);
    return;
  }

  // Host queues up the next round after a beat
  if (playerRole === 'host') {
    setTimeout(() => {
      if (hostWins < MAX_WINS && guestWins < MAX_WINS) startNextRound();
    }, 1500);
  }
}

// ── Game over ─────────────────────────────────────────────────
function endGame() {
  const iWon = (playerRole === 'host'  && hostWins  > guestWins) ||
               (playerRole === 'guest' && guestWins > hostWins);

  const myWins  = playerRole === 'host' ? hostWins : guestWins;
  const oppWins = playerRole === 'host' ? guestWins : hostWins;

  show('screen-result');

  if (iWon) {
    document.getElementById('result-headline').textContent = 'YOU WIN';
    document.getElementById('result-detail').textContent =
      `${myWins} – ${oppWins} over ${opponentName}\nbest reaction: ${bestReactionMs === Infinity ? '—' : bestReactionMs + 'ms'}`;
  } else {
    document.getElementById('result-headline').textContent = `${opponentName.toUpperCase()} WINS`;
    document.getElementById('result-detail').textContent =
      `${oppWins} – ${myWins} — outreflexed.\nbest reaction: ${bestReactionMs === Infinity ? '—' : bestReactionMs + 'ms'}`;
  }

  if (bestReactionMs < 200) {
    document.getElementById('result-badge').style.display = '';
  }
}

// ── Share ─────────────────────────────────────────────────────
function shareChallenge() {
  const myWins  = playerRole === 'host' ? hostWins : guestWins;
  const oppWins = playerRole === 'host' ? guestWins : hostWins;
  const bestStr = bestReactionMs < Infinity ? `${bestReactionMs}ms` : '—';
  const badge   = bestReactionMs < 200 ? ' ⚡ Superhuman' : '';

  const text = `I beat ${opponentName} ${myWins}–${oppWins} in Reflex Duel II — best reaction ${bestStr}${badge}. Think you're faster? ${location.href}`;

  if (navigator.share) {
    navigator.share({ title: 'Reflex Duel II', text, url: location.href });
  } else {
    navigator.clipboard.writeText(text).then(() => alert('Challenge copied — send it to a friend.'));
  }
}

function share() { shareChallenge(); }
