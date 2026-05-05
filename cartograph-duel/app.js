// app.js — entry point. Wires hero (mode chooser), create + join screens, share.
// Game logic lives in loop.js, network in net.js.

import * as net from './net.js';
import { init as initGame, show } from './loop.js';

let role = null;
let playerName = '';

const $ = (id) => document.getElementById(id);

function setCreateError(msg) {
  const el = $('create-error');
  if (msg) { el.textContent = msg; el.hidden = false; }
  else { el.hidden = true; }
}

function setJoinError(msg) {
  const el = $('join-error');
  if (msg) { el.textContent = msg; el.hidden = false; }
  else { el.hidden = true; }
}

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
  setCreateError('');
  playerName = ($('player-name').value || '').trim();
  if (!playerName) { setCreateError('what should we call you on the leaderboard?'); return; }
  role = 'host';
  net.createRoom(playerName);
}

function joinRoom() {
  setJoinError('');
  playerName = ($('player-name-join').value || '').trim();
  const code = ($('join-code').value || '').trim().toUpperCase();
  if (!playerName) { setJoinError('what should we call you on the leaderboard?'); return; }
  if (code.length !== 4) { setJoinError('room codes are 4 letters — check it again'); return; }
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
  const text = errorCopy[message] || 'something jammed in the press';
  // Route to whichever form the user just submitted from.
  if (role === 'guest') setJoinError(text);
  else setCreateError(text);
});

net.on('disconnected', () => {
  // loop.js handles in-game disconnect; here we only show pre-game drops
  if ($('screen-waiting') && !$('screen-waiting').hidden) {
    if (role === 'guest') {
      setJoinError('lost the connection — try once more');
      show('screen-join');
    } else {
      setCreateError('lost the connection — try once more');
      show('screen-create');
    }
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

// ── Wire-up ──────────────────────────────────────────────────────────
function bindHero() {
  $('open-new-btn').onclick = () => {
    show('screen-create');
    setTimeout(() => $('player-name').focus(), 50);
  };
  $('join-existing-btn').onclick = () => {
    show('screen-join');
    setTimeout(() => $('player-name-join').focus(), 50);
  };
}

function bindForms() {
  $('create-btn').onclick = createRoom;
  $('join-btn').onclick = joinRoom;
  $('create-back-btn').onclick = () => { setCreateError(''); show('screen-hero'); };
  $('join-back-btn').onclick = () => { setJoinError(''); show('screen-hero'); };
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
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  bindHero();
  bindForms();
  const hasDeepLink = handleRoomParam();
  // A challenge link skips the hero — they came here to join, not to choose.
  show(hasDeepLink ? 'screen-join' : 'screen-hero');
});
