// app.js — entry point. Wires DOM, screens, share, and net/game integration.
//
// Voice: the Bureau of Synaptic Concordance frames ALL copy on this app, not
// just the verdict. Every screen reads as if a stamped, mock-bureaucratic
// agency administers the test.

import { SyncNet, generateRoomCode, isValidRoomCode } from "./net.js";
import { SyncGame, TOTAL_ROUNDS, MAX_SCORE, PALETTE_SLOTS } from "./loop.js";
import { PALETTE, compositionToSet, verdictForPercentile } from "./content.js";
import { fetchDistribution, recordScore, percentileOf } from "./histogram.js";

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
  net = new SyncNet({
    onJoined: ({ role: r, roomCode }) => {
      if (r === "host") {
        renderWaiting(roomCode);
        show("waiting");
      } else {
        startGame();
      }
    },
    onPlayerJoined: () => {
      // Host's signal that guest is in. Start the game.
      startGame();
    },
    onPeerState: (state) => {
      if (!state || !state.kind) return;
      if (state.kind === "lock") {
        game.onPeerLock(state.round, state.emojis);
        renderPlay();
      } else if (state.kind === "rematch") {
        runItBack();
      }
    },
    onError: (msg) => {
      const err = {
        room_not_found: "no chamber under that code — re-confirm with your partner",
        room_full:      "that chamber is already paired — request a fresh code",
        opponent_left:  "your partner has left the chamber — concordance severed",
      }[msg] || "the chamber is unstable — please retry";
      showLandingError(err);
    },
    onClose: () => {
      // Only escalate to disconnected if a game was in progress.
      const playOpen = document.getElementById("screen-play").hidden === false;
      const waitOpen = document.getElementById("screen-waiting").hidden === false;
      const revealOpen = document.getElementById("screen-reveal").hidden === false;
      if ((game && game.round <= TOTAL_ROUNDS && playOpen) || waitOpen || revealOpen) {
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
    if (!name) { showLandingError("name your operator before opening a chamber"); return; }
    startSession("host", null, name);
  });

  document.getElementById("btn-join").addEventListener("click", () => {
    clearLandingError();
    const name = (nameInput.value || "").trim().slice(0, 20);
    const code = (codeInput.value || "").trim().toUpperCase();
    if (!name) { showLandingError("name your operator before joining a chamber"); return; }
    if (!isValidRoomCode(code)) { showLandingError("chamber code is four letters — please re-key"); return; }
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
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(joinUrl)}`;
  const img = document.getElementById("waiting-qr");
  img.src = qrSrc;
  img.alt = `chamber code ${code}`;
}

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
  game = new SyncGame(net);
  game.onChange = renderPlay;
  game.onRoundComplete = () => {
    renderReveal();
    show("reveal");
  };
  game.onGameComplete = onGameComplete;
  document.getElementById("opponent-banner-name").textContent =
    net.opponentName || (net.role === "host" ? "your partner" : "the host");
  buildPalette();
  renderPlay();
  show("play");
}

// ── Play screen rendering ─────────────────────────────────────────────────
function buildPalette() {
  const grid = document.getElementById("my-palette");
  if (grid.dataset.built) return;
  grid.dataset.built = "1";
  PALETTE.forEach((emoji, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "palette-key";
    b.textContent = emoji;
    b.setAttribute("aria-label", `encode symbol ${i + 1}`);
    b.addEventListener("click", () => game && game.appendEmoji(i));
    grid.appendChild(b);
  });
}

function renderPlay() {
  // Top bar.
  document.getElementById("round-label").textContent =
    `TRIAL ${game.round} / ${TOTAL_ROUNDS}`;
  document.getElementById("score-label").textContent =
    `CONCORDANCE: ${game.score} / ${MAX_SCORE}`;

  // Prompt.
  document.getElementById("prompt-feeling").textContent = game.promptText();

  // Composition slots.
  const comp = document.getElementById("my-composition");
  comp.innerHTML = "";
  for (let i = 0; i < PALETTE_SLOTS; i++) {
    const slot = document.createElement("span");
    slot.className = "slot" + (game.composition[i] ? " filled" : "");
    slot.textContent = game.composition[i] || "·";
    comp.appendChild(slot);
  }

  // Palette + buttons enable/disable based on lock state.
  const grid = document.getElementById("my-palette");
  const phase = game.phase();
  grid.classList.toggle("locked", phase !== "compose");
  document.getElementById("btn-back").disabled = phase !== "compose" || game.composition.length === 0;
  document.getElementById("btn-clear").disabled = phase !== "compose" || game.composition.length === 0;
  const lock = document.getElementById("btn-lock");
  lock.disabled = phase !== "compose" || game.composition.length !== PALETTE_SLOTS;
  if (phase === "compose") {
    lock.textContent = "LOCK ENCODING";
  } else {
    lock.textContent = "ENCODING LOCKED";
  }

  // Lock-status indicators (only shown once at least one side has locked).
  const status = document.getElementById("lock-status");
  status.hidden = !(game.locked || game.peerLocked);
  const mineLine = document.getElementById("lock-status-mine");
  const peerLine = document.getElementById("lock-status-peer");
  mineLine.textContent = game.locked ? "YOU · ENCODING LOCKED" : "YOU · still composing";
  mineLine.classList.toggle("locked", game.locked);
  peerLine.textContent = game.peerLocked ? "PARTNER · ENCODING LOCKED" : "PARTNER · still composing";
  peerLine.classList.toggle("locked", game.peerLocked);
}

// ── Reveal screen ─────────────────────────────────────────────────────────
function renderReveal() {
  const last = game.history[game.history.length - 1];
  if (!last) return;

  document.getElementById("reveal-round").textContent = String(last.round);
  document.getElementById("reveal-prompt").textContent = last.prompt;

  document.getElementById("reveal-mine").textContent = last.mine.join(" ");
  // Peer composition is a flat string from the wire — render with spaces between graphemes.
  const peerSet = compositionToSet(last.peer);
  // Keep peer's original order if we can — fall back to set order.
  document.getElementById("reveal-peer").textContent = renderEmojiString(last.peer);

  const overlap = last.overlap;
  document.getElementById("reveal-overlap").textContent = `${overlap} / ${PALETTE_SLOTS}`;

  // Show the actually-shared emojis (intersection) for emotional payoff.
  const mineSet = new Set(last.mine);
  const shared = [...peerSet].filter(e => mineSet.has(e));
  const sharedEl = document.getElementById("reveal-shared");
  if (shared.length === 0) {
    sharedEl.textContent = "no concordance this trial";
    sharedEl.classList.add("none");
  } else {
    sharedEl.textContent = shared.join(" ");
    sharedEl.classList.remove("none");
  }

  const stamp = document.getElementById("reveal-stamp");
  if (overlap >= 3) {
    stamp.textContent = "FULLY CONCORDANT";
    stamp.className = "stamp matched";
  } else if (overlap >= 1) {
    stamp.textContent = "PARTIAL CONCORDANCE";
    stamp.className = "stamp partial";
  } else {
    stamp.textContent = "DIVERGENT";
    stamp.className = "stamp mismatched";
  }

  document.getElementById("reveal-progress").textContent =
    `Trial ${last.round} of ${TOTAL_ROUNDS} · running tally ${game.score}/${MAX_SCORE}`;
  const btn = document.getElementById("btn-next");
  btn.textContent = (last.round < TOTAL_ROUNDS)
    ? "ADVANCE TO NEXT TRIAL"
    : "FILE FINAL REPORT";
}

// Render a peer emoji string with single spaces between recognised palette
// graphemes so multi-codepoint glyphs (😵‍💫 etc.) display individually.
function renderEmojiString(s) {
  const sorted = [...PALETTE].sort((a, b) => b.length - a.length);
  const out = [];
  let i = 0;
  while (i < (s || "").length) {
    let matched = null;
    for (const sym of sorted) {
      if (s.startsWith(sym, i)) { matched = sym; break; }
    }
    if (matched) { out.push(matched); i += matched.length; }
    else { i++; }
  }
  return out.join(" ");
}

function nextFromReveal() {
  if (game.round >= TOTAL_ROUNDS) {
    onGameComplete();
    return;
  }
  game.nextRound();
  show("play");
  renderPlay();
}

// ── Final / verdict / histogram ───────────────────────────────────────────
async function onGameComplete() {
  show("final");
  const finalScore = game.score;
  document.getElementById("final-score").textContent = `${finalScore} / ${MAX_SCORE}`;
  document.getElementById("final-pair").textContent =
    `${truncName(net.playerName)} & ${truncName(net.opponentName || "partner")}`;

  // 800ms minimum for the "filing the report" beat.
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
  for (let s = 0; s <= MAX_SCORE; s++) {
    const col = document.createElement("div");
    col.className = "bar-col" + (s === finalScore ? " our-bar" : "");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = ((dist.counts[s] / max) * 100).toFixed(1) + "%";
    const label = document.createElement("div");
    label.className = "bar-label";
    // Show only every other tick so axis stays legible at MAX_SCORE=20.
    label.textContent = (s % 2 === 0) ? String(s) : "";
    col.appendChild(bar);
    col.appendChild(label);
    wrap.appendChild(col);
  }
}

function doShare(score, pct, verdict, partner) {
  const text = `The Bureau of Synaptic Concordance classified ${truncName(net.playerName)} & ${truncName(partner)} as ${verdict.name} (${pct}th percentile, ${score}/${MAX_SCORE} matched).`;
  const url = location.origin + location.pathname;
  const payload = { title: "Synapse Sync", text, url };
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
  if (rematchPending) return; // we already asked; just mirror
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
  document.getElementById("btn-lock").addEventListener("click", () => game && game.lockIn());
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

window.share = () => {};
