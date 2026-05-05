// net.js — WebSocket protocol for Synapse Sync.
//
// Uses the shared aws-multiplayer dumb-relay. The server forwards game_update
// messages between the two peers; all game logic runs client-side.
//
// Message kinds we use inside `state`:
//   { kind: "lock", round, emojis }   either → other: my locked-in 4-emoji set
//   { kind: "rematch" }                either → other: rematch handshake

const WSS_URL = "wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod";
const SLUG = "synapse-sync";

// 4-letter no-confusables alphabet (KB rule: short codes).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateRoomCode() {
  let c = "";
  for (let i = 0; i < 4; i++) {
    c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return c;
}

export function isValidRoomCode(s) {
  if (typeof s !== "string" || s.length !== 4) return false;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export class SyncNet {
  constructor(handlers) {
    this.ws = null;
    this.role = null;            // 'host' | 'guest'
    this.playerName = "";
    this.opponentName = "";
    this.roomCode = null;
    this.handlers = handlers;    // { onJoined, onPlayerJoined, onPeerState, onError, onClose }
  }

  _open(onOpen) {
    this.ws = new WebSocket(WSS_URL);
    this.ws.onopen = onOpen;
    this.ws.onmessage = (e) => this._handle(JSON.parse(e.data));
    this.ws.onclose = () => this.handlers.onClose && this.handlers.onClose();
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _handle(msg) {
    if (msg.type === "room_created") {
      this.roomCode = msg.roomCode;
      this.handlers.onJoined && this.handlers.onJoined({ role: "host", roomCode: msg.roomCode });
    } else if (msg.type === "joined_room") {
      this.opponentName = msg.hostName;
      this.roomCode = msg.roomCode;
      this.handlers.onJoined && this.handlers.onJoined({ role: "guest", roomCode: msg.roomCode });
    } else if (msg.type === "player_joined") {
      this.opponentName = msg.guestName;
      this.handlers.onPlayerJoined && this.handlers.onPlayerJoined({ guestName: msg.guestName });
    } else if (msg.type === "game_update") {
      this.handlers.onPeerState && this.handlers.onPeerState(msg.state);
    } else if (msg.type === "opponent_disconnected") {
      this.handlers.onError && this.handlers.onError("opponent_left");
    } else if (msg.type === "error") {
      this.handlers.onError && this.handlers.onError(msg.message || "unknown_error");
    }
  }

  createRoom(playerName) {
    this.playerName = playerName;
    this.role = "host";
    const code = generateRoomCode();
    this.roomCode = code;
    this._open(() => {
      this._send({ action: "create_room", slug: SLUG, playerName, roomCode: code });
    });
  }

  joinRoom(roomCode, playerName) {
    this.playerName = playerName;
    this.role = "guest";
    this.roomCode = roomCode;
    this._open(() => {
      this._send({ action: "join_room", roomCode, playerName });
    });
  }

  // Send a state object to the peer through the relay.
  sendState(state) {
    this._send({ action: "game_update", roomCode: this.roomCode, state });
  }
}
