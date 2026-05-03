// net.js — WebSocket protocol + room codes.
// Game state + render lives in loop.js. This file only knows about messages.
//
// Per multiplayer.md: dumb relay forwards `game_update` between peers.
// Both clients run identical resolution logic over the same data.
// We don't have contested first-to-act in this game — both players
// drawing-and-submitting is naturally simultaneous-submit.

const WSS_URL = 'wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod';
const SLUG = 'cartograph-duel';

let ws = null;
let listeners = {};
let currentRoomCode = null;

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

function emit(event, payload) {
  (listeners[event] || []).forEach(fn => fn(payload));
}

export function getRoomCode() { return currentRoomCode; }
export function setRoomCode(code) { currentRoomCode = code; }

// 4-char no-confusables — see multiplayer.md "Room-code session-friction kit"
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function openWS(onOpen) {
  ws = new WebSocket(WSS_URL);
  ws.onopen = onOpen;
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleServerMessage(msg);
  };
  ws.onclose = () => emit('disconnected', null);
  ws.onerror = () => emit('error', { message: 'connection_error' });
}

function handleServerMessage(msg) {
  if (msg.type === 'room_created') {
    emit('room_created', { roomCode: msg.roomCode });
  } else if (msg.type === 'joined_room') {
    currentRoomCode = msg.roomCode;
    emit('joined_room', { roomCode: msg.roomCode, hostName: msg.hostName });
  } else if (msg.type === 'player_joined') {
    emit('player_joined', { guestName: msg.guestName });
  } else if (msg.type === 'game_update') {
    emit('peer_update', { state: msg.state, from: msg.from });
  } else if (msg.type === 'opponent_disconnected') {
    emit('opponent_disconnected', null);
  } else if (msg.type === 'error') {
    emit('error', { message: msg.message });
  }
}

export function createRoom(playerName) {
  const code = generateRoomCode();
  currentRoomCode = code;
  openWS(() => {
    ws.send(JSON.stringify({
      action: 'create_room', slug: SLUG, playerName, roomCode: code
    }));
  });
}

export function joinRoom(code, playerName) {
  currentRoomCode = code.toUpperCase();
  openWS(() => {
    ws.send(JSON.stringify({
      action: 'join_room', roomCode: currentRoomCode, playerName
    }));
  });
}

export function sendUpdate(state, persist = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentRoomCode) return;
  ws.send(JSON.stringify({
    action: 'game_update',
    roomCode: currentRoomCode,
    state,
    ...(persist ? { persist: true } : {})
  }));
}
