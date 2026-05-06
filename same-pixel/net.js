// net.js — WebSocket protocol for the shared "SAMEPIXEL" room.
// All visitors join one room. The server enforces the 60s cooldown and owns the
// authoritative pixel board (see infrastructure/aws-multiplayer/message.js
// pixel_join / pixel_tap actions).

const WSS_URL = 'wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod';
const ROOM = 'SAMEPIXEL';

let ws = null;
let handlers = {
  snapshot: () => {},
  update: () => {},
  ack: () => {},
  cooldown: () => {},
  error: () => {},
  open: () => {},
  close: () => {},
};

export function setHandlers(h) {
  handlers = { ...handlers, ...h };
}

export function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  ws = new WebSocket(WSS_URL);
  ws.onopen = () => {
    handlers.open();
    send({ action: 'pixel_join', roomCode: ROOM });
  };
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    if (msg.type === 'pixel_snapshot') handlers.snapshot(msg);
    else if (msg.type === 'pixel_update') handlers.update(msg);
    else if (msg.type === 'pixel_cooldown_ack') handlers.ack(msg);
    else if (msg.type === 'error') {
      if (msg.message === 'cooldown') handlers.cooldown(msg);
      else handlers.error(msg);
    }
  };
  ws.onclose = () => handlers.close();
  ws.onerror = () => { /* swallow — onclose fires after */ };
}

export function tap(x, y, colorIdx) {
  send({ action: 'pixel_tap', roomCode: ROOM, x, y, colorIdx });
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

// Decode a base64 board string into a Uint8Array of length 4096 (one byte per
// pixel: 0..7 = colorIdx, 0xFF = unowned).
const TOTAL = 64 * 64;
export function decodeBoard(b64) {
  const bin = atob(b64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  if (arr.length === TOTAL) return arr;
  const out = new Uint8Array(TOTAL); out.fill(0xFF);
  out.set(arr.subarray(0, Math.min(TOTAL, arr.length)));
  return out;
}
