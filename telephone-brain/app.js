// app.js — entry point. Wires DOM, screens, share, and net/game integration.
//
// Voice: the Bureau of Synapse Telegraphy is the framing for ALL copy on this
// app, not just the verdict. Every screen reads as if a stamped, mock-bureaucratic
// agency administers the test.

import { TelephoneNet, generateRoomCode, isValidRoomCode } from "./net.js";
import { TelephoneGame, TOTAL_ROUNDS, PALETTE_SLOTS } from "./loop.js";
import { FEELINGS, PALETTE } from "./content.js";
import { fetchDistribution, recordScore, percentileOf } from "./histogram.js";
import { verdictForPercentile } from "./content.js";

// ── Screens ───────────────────────────────────────────────────────────────
const SCREENS = ["landing","waiting","play","reveal","intermission","final","disconnected"];
function show(id) {
  for (const s of SCREENS) {
    const el = document.getElementById("screen-" + s);
    if (el) el.hidden = (s !== id);
  }
  window.scrollTo(0, 0);
}

// ── Net + Game wiring ─────────────────────────────────────────────────────
let net = null;
let game = null;

function startSession(role, code, name) {
  net = new TelephoneNet({
    onJoined: ({ role: r, roomCode }) => {
      if (r === "host") {
        renderWaiting(roomCode);
        show("waiting");
      } else {
        // Guest joined; the actual game start is keyed off player_joined on host
        // and joined_room on guest. The host kicks off when receiving player_joined.
        // For guest, start the game immediately on joined_room.
        startGame();
      }
    },
    onPlayerJoined: ({ guestName }) => {
      // Host's signal that guest is in. Start the game.
      startGame();
    },
    onPeerState: (state) => {
      if (!state || !state.kind) return;
      if (state.kind === "transmission") {
        game.onTransmission(state.round, state.emojis);
        renderPlay();
      } else if (state.kind === "guess") {
        game.onPeerGuess(state.round, state.choice, state.correct);
        // sender will land on reveal via onRoundComplete
      } else if (state.kind === "rematch") {
        runItBack();
      }
    },
    onError: (msg) => {
      const err = {
        room_not_found: "no arena under that code — re-confirm with your partner",
        room_full:      "that arena is already paired — request a fresh code",
        opponent_left:  "your partner has left the wire — connection severed",
      }[msg] || "the wire is unstable — please retry";
      showLandingError(err);
    },
    onClose: () => {
      // Only escalate to disconnected if a game was in progress.
      if (game && game.round <= TOTAL_ROUNDS && document.getElementById("screen-play").hidden === false) {
        show("disconnected");
      } else if (document.getElementById("screen-waiting").hidden === false) {
        show("disconnected");
      } else if (document.getElementById("screen-reveal").hidden === false) {
        show("disconnected");
      }
    }
  });

  if (role === "host") {
    net.createRoom(name);
  } else {
    net.joinRoom(code, name);
  }
}

// ── Landing ───────────────────────────────────────────────────────────────
function showLandingError(msg) {
  const el = document.getElementById("landing-error");
  el.textContent = msg;
  el.hidden = false;
}
function clearLandingError() {
  const el = document.getElementById("landing-error");
  el.textContent = "";
  el.hidden = true;
}

function attachLanding() {
  const nameInput = document.getElementById("player-name");
  const codeInput = document.getElementById("join-code");

  // ?room= prefill — drop user straight into the join flow.
  const params = new URLSearchParams(location.search);
  const presetCode = (params.get("room") || "").toUpperCase().slice(0, 4);
  if (isValidRoomCode(presetCode)) {
    codeInput.value = presetCode;
    document.getElementById("invite-banner").hidden = false;
    document.getElementById("invite-banner-code").textContent = presetCode;
    document.getElementById("create-section").classList.add("dim");
  }

  document.getElementById("btn-create").addEventListener("click", () => {
    clearLandingError();
    const name = (nameInput.value || "").trim().slice(0, 20);
    if (!name) { showLandingError("name your operator before opening a wire"); return; }
    startSession("host", null, name);
  });

  document.getElementById("btn-join").addEventListener("click", () => {
    clearLandingError();
    const name = (nameInput.value || "").trim().slice(0, 20);
    const code = (codeInput.value || "").trim().toUpperCase();
    if (!name) { showLandingError("name your operator before opening a wire"); return; }
    if (!isValidRoomCode(code)) { showLandingError("arena code is four letters — please re-key"); return; }
    startSession("guest", code, name);
  });

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  });
}

// ── Waiting (host) ────────────────────────────────────────────────────────
function renderWaiting(code) {
  document.getElementById("waiting-code").textContent = code.split("").join(" ");
  const joinUrl = `${location.origin}${location.pathname}?room=${code}`;
  document.getElementById("waiting-link").value = joinUrl;
  // QR via stateless free service.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(joinUrl)}`;
  const img = document.getElementById("waiting-qr");
  img.src = qrSrc;
  img.alt = `arena code ${code}`;
}

// Copy invite link.
function copyInvite() {
  const input = document.getElementById("waiting-link");
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById("btn-copy-link");
    const prev = btn.textContent;
    btn.textContent = "COPIED";
    setTimeout(() => { btn.textContent = prev; }, 1400);
  }).catch(() => {});
}

// ── Game start ────────────────────────────────────────────────────────────
function startGame() {
  game = new TelephoneGame(net);
  game.onChange = renderPlay;
  game.onRoundComplete = () => {
    renderReveal();
    show("reveal");
  };
  game.onGameComplete = onGameComplete;
  document.getElementById("opponent-banner-name").textContent =
    net.opponentName || (net.role === "host" ? "your partner" : "the host");
  renderPlay();
  show("play");
}

// ── Play screen rendering ─────────────────────────────────────────────────
function renderPlay() {
  // Top-bar status.
  document.getElementById("round-label").textContent =
    `TRANSMISSION ${game.round} / ${TOTAL_ROUNDS}`;
  document.getElementById("score-label").textContent =
    `MATCHED: ${game.score} / ${TOTAL_ROUNDS}`;

  const role = game.myRoleThisRound();
  const roleEl = document.getElementById("role-banner");
  roleEl.classList.toggle("role-sender", role === "sender");
  roleEl.classList.toggle("role-receiver", role === "receiver");
  roleEl.textContent = role === "sender"
    ? "OPERATOR ON DUTY · transmit a 4-symbol cipher"
    : "OPERATOR ON DUTY · receive and identify";

  // Show the appropriate panel.
  document.getElementById("panel-sender").hidden = role !== "sender";
  document.getElementById("panel-receiver").hidden = role !== "receiver";

  if (role === "sender") {
    renderSenderPanel();
  } else {
    renderReceiverPanel();
  }
}

function renderSenderPanel() {
  document.getElementById("sender-feeling").textContent = game.truthFeeling();
  // Composition display.
  const comp = document.getElementById("sender-composition");
  comp.innerHTML = "";
  for (let i = 0; i < PALETTE_SLOTS; i++) {
    const slot = document.createElement("span");
    slot.className = "slot" + (game.composition[i] ? " filled" : "");
    slot.textContent = game.composition[i] || "·";
    comp.appendChild(slot);
  }
  // Palette grid.
  const grid = document.getElementById("sender-palette");
  if (!grid.dataset.built) {
    grid.dataset.built = "1";
    PALETTE.forEach((emoji, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "palette-key";
      b.textContent = emoji;
      b.setAttribute("aria-label", `transmit symbol ${i + 1}`);
      b.addEventListener("click", () => game.appendEmoji(i));
      grid.appendChild(b);
    });
  }
  // Disable palette / transmit per phase.
  const composing = game.phase === "compose";
  grid.classList.toggle("locked", !composing);
  document.getElementById("btn-back").disabled = !composing || game.composition.length === 0;
  document.getElementById("btn-clear").disabled = !composing || game.composition.length === 0;
  const tx = document.getElementById("btn-transmit");
  tx.disabled = !composing || game.composition.length !== PALETTE_SLOTS;
  tx.textContent = game.phase === "sent"
    ? "TRANSMITTED · awaiting partner"
    : "TRANSMIT CIPHER";
}

function renderReceiverPanel() {
  const wait = document.getElementById("receiver-waiting");
  const choose = document.getElementById("receiver-choose");
  if (!game.lastEmojis || !game.choiceTiles) {
    wait.hidden = false;
    choose.hidden = true;
    return;
  }
  wait.hidden = true;
  choose.hidden = false;

  document.getElementById("receiver-cipher").textContent = game.lastEmojis;

  const grid = document.getElementById("receiver-tiles");
  grid.innerHTML = "";
  for (const idx of game.choiceTiles) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.textContent = FEELINGS[idx];
    b.addEventListener("click", () => game.guessTile(idx));
    grid.appendChild(b);
  }
}

// ── Reveal screen ─────────────────────────────────────────────────────────
function renderReveal() {
  const last = game.history[game.history.length - 1];
  if (!last) return;
  document.getElementById("reveal-cipher").textContent = last.emojis;
  document.getElementById("reveal-truth").textContent = FEELINGS[last.truthIndex];
  document.getElementById("reveal-guess").textContent = FEELINGS[last.guessIndex];
  const stamp = document.getElementById("reveal-stamp");
  if (last.correct) {
    stamp.textContent = "MATCHED";
    stamp.className = "stamp matched";
  } else {
    stamp.textContent = "MISMATCHED";
    stamp.className = "stamp mismatched";
  }
  document.getElementById("reveal-progress").textContent =
    `Transmission ${last.round} of ${TOTAL_ROUNDS} · running tally ${game.score}/${TOTAL_ROUNDS}`;
  const btn = document.getElementById("btn-next");
  btn.textContent = (last.round < TOTAL_ROUNDS)
    ? "ADVANCE TO NEXT TRANSMISSION"
    : "FILE FINAL REPORT";
}

function nextFromReveal() {
  if (game.round >= TOTAL_ROUNDS) {
    onGameComplete();
    return;
  }
  // Brief intermission while the next sender prepares.
  game.nextRound();
  show("play");
  renderPlay();
}

// ── Final / verdict / histogram ───────────────────────────────────────────
async function onGameComplete() {
  show("final");
  const finalScore = game.score;
  document.getElementById("final-score").textContent = `${finalScore} / ${TOTAL_ROUNDS}`;
  document.getElementById("final-pair").textContent =
    `${truncName(net.playerName)} & ${truncName(net.opponentName || "partner")}`;

  // 800ms minimum for the "filing the report" beat (KB rule on computation).
  const t0 = Date.now();
  const dist = await fetchDistribution();
  await recordScore(finalScore);
  const pct = percentileOf(finalScore, dist);
  const elapsed = Date.now() - t0;
  if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

  document.getElementById("final-percentile").textContent = `${pct}TH PERCENTILE`;
  const v = verdictForPercentile(pct);
  document.getElementById("verdict-name").textContent = v.name;
  document.getElementById("verdict-blurb").textContent = v.blurb;
  document.getElementById("verdict-stamp").textContent = v.stamp;

  drawHistogram(dist, finalScore);
  document.getElementById("dist-source").textContent = dist.simulated
    ? "* projected baseline · pair count below archival threshold"
    : `* archival data · ${dist.total} pairs on record`;

  // Build share text.
  const partner = net.opponentName || "my partner";
  window.share = () => doShare(finalScore, pct, v, partner);
}

function truncName(n) {
  return (n || "").slice(0, 20).toUpperCase();
}

function drawHistogram(dist, finalScore) {
  const wrap = document.getElementById("histogram");
  wrap.innerHTML = "";
  const max = Math.max(...dist.counts, 1);
  for (let s = 0; s <= 10; s++) {
    const col = document.createElement("div");
    col.className = "bar-col" + (s === finalScore ? " our-bar" : "");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = ((dist.counts[s] / max) * 100).toFixed(1) + "%";
    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = String(s);
    col.appendChild(bar);
    col.appendChild(label);
    wrap.appendChild(col);
  }
}

function doShare(score, pct, verdict, partner) {
  const text = `The Bureau of Synapse Telegraphy classified ${truncName(net.playerName)} & ${truncName(partner)} as ${verdict.name} (${pct}th percentile, ${score}/${TOTAL_ROUNDS}).`;
  const url = location.origin + location.pathname;
  const payload = { title: "Telephone Brain", text, url };
  if (navigator.share) {
    navigator.share(payload).catch(() => fallbackShare(text, url));
  } else {
    fallbackShare(text, url);
  }
}

function fallbackShare(text, url) {
  navigator.clipboard.writeText(`${text} ${url}`).then(() => {
    const btn = document.getElementById("btn-share");
    const prev = btn.textContent;
    btn.textContent = "COPIED — SEND IT";
    setTimeout(() => { btn.textContent = prev; }, 1600);
  }).catch(() => {});
}

// ── Run It Back (rematch) ─────────────────────────────────────────────────
let rematchPending = false;
function requestRematch() {
  if (rematchPending) return;
  rematchPending = true;
  net.sendState({ kind: "rematch" });
  game.reset();
  show("play");
  renderPlay();
}
function runItBack() {
  if (rematchPending) {
    // We already asked; just mirror.
    return;
  }
  rematchPending = true;
  game.reset();
  net.sendState({ kind: "rematch" }); // echo
  show("play");
  renderPlay();
}

// ── Wire DOM ──────────────────────────────────────────────────────────────
function wireButtons() {
  document.getElementById("btn-back").addEventListener("click", () => game && game.popEmoji());
  document.getElementById("btn-clear").addEventListener("click", () => game && game.clearComposition());
  document.getElementById("btn-transmit").addEventListener("click", () => game && game.transmit());
  document.getElementById("btn-next").addEventListener("click", nextFromReveal);
  document.getElementById("btn-share").addEventListener("click", () => window.share && window.share());
  document.getElementById("btn-rematch").addEventListener("click", requestRematch);
  document.getElementById("btn-copy-link").addEventListener("click", copyInvite);
  document.getElementById("btn-reload").addEventListener("click", () => location.reload());
  document.getElementById("btn-reload-disconnect").addEventListener("click", () => location.reload());
}

attachLanding();
wireButtons();
show("landing");

// expose for inline onclick fallback if any (none currently)
window.share = () => {};
