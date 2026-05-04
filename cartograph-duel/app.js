// app.js — entry point. Wires landing screen, room creation/join, and share.
// Game logic lives in loop.js, network in net.js.

import * as net from './net.js';
import { init as initGame, show, setError } from './loop.js';

let role = null;
let playerName = '';

const $ = (id) => document.getElementById(id);

function showWaiting(roomCode) {
  show('screen-waiting');
  $('room-code-display').textContent = roomCode;

  // Build join URL + QR (multiplayer.md "QR + invite-link")
  const joinUrl = `${location.origin}${location.pathname}?room=${roomCode}`;
  $('join-link-display').textContent = joinUrl;
  $('qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}`;
  $('copy-link-btn').onclick = () => {
    navigator.clipboard?.writeText(joinUrl);
    $('copy-link-btn').textContent = 'copied — paste it to a friend';
  };
}

function createRoom() {
  setError('');
  playerName = ($('player-name').value || '').trim();
  if (!playerName) { setError('what should we call you on the leaderboard?'); return; }
  role = 'host';
  net.createRoom(playerName);
}

function joinRoom() {
  setError('');
  playerName = ($('player-name').value || '').trim();
  const code = ($('join-code').value || '').trim().toUpperCase();
  if (!playerName) { setError('what should we call you on the leaderboard?'); return; }
  if (code.length !== 4) { setError('room codes are 4 letters — check it again'); return; }
  role = 'guest';
  net.joinRoom(code, playerName);
}

net.on('room_created', ({ roomCode }) => {
  showWaiting(roomCode);
});

net.on('player_joined', ({ guestName }) => {
  initGame({ role, playerName, opponentName: guestName, roomCode: net.getRoomCode() });
});

net.on('joined_room', ({ roomCode, hostName }) => {
  initGame({ role, playerName, opponentName: hostName, roomCode });
});

net.on('error', ({ message }) => {
  const errorCopy = {
    room_not_found: "no atlas under that code — double-check it",
    room_full:      'two cartographers already in there — start a fresh room',
    connection_error: "the courier dropped the message — try again"
  };
  setError(errorCopy[message] || 'something jammed in the press');
});

net.on('disconnected', () => {
  // loop.js handles in-game disconnect; here we only show pre-game drops
  if ($('screen-waiting') && !$('screen-waiting').hidden) {
    setError('lost the connection — try once more');
    show('screen-setup');
  }
});

// ── Share ────────────────────────────────────────────────────────────
window.share = function share() {
  const url = location.origin + location.pathname;
  const text = `I challenge you to draw countries from memory. Cartograph Duel — best of 3, room code awaits. ${url}`;
  if (navigator.share) {
    navigator.share({ title: 'Cartograph Duel', text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert('Link copied — send it to your sharpest friend.'));
  } else {
    prompt('Copy this and send it to a friend:', text);
  }
};

// ── Hero + Setup wire-up ─────────────────────────────────────────────
function bindHero() {
  $('begin-btn').onclick = () => {
    show('screen-setup');
    // Auto-focus the name field once the user has chosen to begin.
    setTimeout(() => $('player-name').focus(), 50);
  };
}

function bindSetup() {
  $('create-btn').onclick = createRoom;
  $('join-btn').onclick = joinRoom;
  $('back-to-hero-btn').onclick = () => {
    setError('');
    show('screen-hero');
  };
  $('join-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  });
}

// ── ?room= deep-link handler (multiplayer.md "?room= URL handler") ──
// Returns true if a deep-link was applied (caller skips hero in that case).
function handleRoomParam() {
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (!room) return false;
  const code = room.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) return false;
  $('join-code').value = code;
  $('challenge-banner').hidden = false;
  $('challenge-banner-code').textContent = code;
  // De-emphasize Create, promote Join
  $('create-btn').classList.add('demoted');
  $('join-btn').classList.add('promoted');
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  bindHero();
  bindSetup();
  const hasDeepLink = handleRoomParam();
  // A challenge link skips the marketing hero — they came here to join, not learn.
  show(hasDeepLink ? 'screen-setup' : 'screen-hero');
});
