// app.js — entry point for same-pixel.
//
// Wires:
//   - net.js (websocket)
//   - loop.js (canvas + input)
//   - DOM controls (palette, chips, commit button, overwrite feed)
//   - Steward-notice timer (silent 5min callback that opens the modal)
//   - Session stats (your color, your pixels, longest streak, who overwrote you)

import { connect, setHandlers, tap, decodeBoard } from './net.js';
import {
  initBoard, setBoard, setPixel, getPixel, getTarget, setTarget, clearTarget, PALETTE
} from './loop.js';

// ── Session state ──────────────────────────────────────────────
let myColorIdx = null;
let myConnId = null;
let cooldownEndsAt = 0;          // ms (Date.now-based)
let myPixels = new Map();        // "x,y" → { placedAt, lostAt }
let allMine = new Map();         // every pixel we've ever placed (lifetime stats)
let longestHoldMs = 0;           // longest single-pixel hold this session
let longestHoldCoord = null;     // "x,y" of that hold
let nemesisCounts = new Array(8).fill(0); // how often each color overwrote one of mine
let lastOverwrittenCoord = null;
let lastOverwrittenHoldMs = 0;
let memberCount = 1;
let sessionStartMs = Date.now();
let stewardFiredAt = 0;          // timestamp (0 if not fired)

const SESSION_LENGTH_MS = 5 * 60 * 1000;
// Server is authoritative — see infrastructure/aws-multiplayer/message.js.
// Keep this constant equal to the server's COOLDOWN_MS.
const COOLDOWN_MS = 2 * 1000;
const N = 32;

// ── Voice copy banks ───────────────────────────────────────────
const COOLDOWN_PHRASES = [
  'arming the brush', 'the saffrons are watching', 'restraint is policy',
  'pacing yourself', 'paint is drying', 'the wall is calibrating', 'thinking it over',
];
const VERDICT_TEMPLATES = [
  ({ nemesis, surviving }) => `your shade was eaten by ${nemesis} more than any other — the ${nemesis.split('-')[0]}s have it in for you. ${surviving} of yours still cling to the wall.`,
  ({ nemesis, surviving }) => `${surviving} pixel${surviving === 1 ? '' : 's'} survives. ${nemesis} kept circling back. take it personally if you want; nobody's stopping you.`,
  ({ nemesis, surviving, longest }) => `you held one cell for ${longest}. then ${nemesis} happened. ${surviving} still answer to your color.`,
  ({ nemesis, surviving }) => `the wall forgets nothing. ${surviving} of your taps remain. ${nemesis} did most of the forgetting.`,
];
const NO_NEMESIS_VERDICTS = [
  'nobody has overwritten you yet. the wall is suspiciously quiet. enjoy it; somebody is loading their thumb.',
  'no enemies. no friends. just you and a paper graveyard. unsubscribe at any time.',
  'nothing has been taken from you. nothing has been given. you are a private museum.',
];

// ── DOM refs ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Init ───────────────────────────────────────────────────────
function init() {
  pickColor();
  buildPalette();
  bindUI();

  initBoard({
    canvas: $('board'),
    frame: $('board').parentElement,
    onTarget: onTargetSelected,
  });

  setHandlers({
    open: () => updateCooldownChip(),
    close: () => {
      $('cooldown-chip').textContent = 'the wall blinked. reload?';
      $('cooldown-chip').classList.remove('armed');
    },
    snapshot: (msg) => {
      myConnId = msg.you;
      memberCount = msg.members || 1;
      cooldownEndsAt = Date.now() + (msg.cooldownRemainingMs || 0);
      const arr = decodeBoard(msg.board);
      setBoard(arr);
      // Re-hydrate any of "our" pixels — we can't recover them across page
      // reloads (server doesn't track per-pixel ownership), so the local
      // session stats start fresh. That's fine: the steward notice is a
      // *session* artifact.
      updateMemberChip();
      updateCooldownChip();
    },
    update: (msg) => {
      const { x, y, colorIdx, by } = msg;
      const key = `${x},${y}`;
      // If this overwrote one of ours, log it and update nemesis count.
      if (myPixels.has(key)) {
        const mine = myPixels.get(key);
        const heldMs = Date.now() - mine.placedAt;
        if (heldMs > longestHoldMs) {
          longestHoldMs = heldMs;
          longestHoldCoord = key;
        }
        myPixels.delete(key);
        if (by !== myConnId) {
          nemesisCounts[colorIdx]++;
          lastOverwrittenCoord = key;
          lastOverwrittenHoldMs = heldMs;
          announceOverwrite(x, y, colorIdx, heldMs);
        }
      } else if (by === myConnId) {
        // Echo of our own commit (server sends to us too). Add to myPixels.
        myPixels.set(key, { placedAt: Date.now() });
        allMine.set(key, true);
      } else {
        // Somebody else painted somewhere not on top of us. No-op for stats.
      }
      setPixel(x, y, colorIdx);
      updateMineChip();
    },
    ack: (msg) => {
      cooldownEndsAt = msg.nextTapAtMs || (Date.now() + COOLDOWN_MS);
      updateCooldownChip();
    },
    cooldown: (msg) => {
      cooldownEndsAt = msg.nextTapAtMs || (Date.now() + COOLDOWN_MS);
      updateCooldownChip();
      // Re-arm the commit button after the cooldown ticks down.
    },
    error: (msg) => {
      // Show a brief inline error if a tap fails for non-cooldown reasons.
      $('cooldown-chip').textContent = `error: ${msg.message}`;
    }
  });

  connect();

  // Steward-notice silent timer.
  setTimeout(() => {
    if (stewardFiredAt) return;
    stewardFiredAt = Date.now();
    showStewardNotice();
  }, SESSION_LENGTH_MS);

  // Cooldown chip ticks every 250ms while cooling.
  setInterval(updateCooldownChip, 250);

  // Share function.
  window.share = share;
}

// ── Color pick ────────────────────────────────────────────────
// Each session picks ONE color from the 8. We pick deterministically off a
// random-this-session token so refresh changes color (per pitch: "picked at the
// start of each session").
function pickColor() {
  myColorIdx = Math.floor(Math.random() * 8);
}

// ── Palette UI ────────────────────────────────────────────────
function buildPalette() {
  const wrap = $('palette-swatches');
  wrap.innerHTML = '';
  PALETTE.forEach((c, i) => {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.setProperty('--swatch', c.hex);
    sw.title = c.name;
    sw.setAttribute('aria-label', c.name);
    sw.addEventListener('click', () => {
      myColorIdx = i;
      reflectPalette();
    });
    wrap.appendChild(sw);
  });
  reflectPalette();
}

function reflectPalette() {
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach((s, i) => s.classList.toggle('selected', i === myColorIdx));
  $('palette-name').textContent = PALETTE[myColorIdx].name;
}

// ── Controlpad: dpad + paint button at center ──────────────────
function bindUI() {
  $('commit-btn').addEventListener('click', commitTarget);
  $('cancel-btn').addEventListener('click', () => {
    clearTarget();
    refreshCommitRow();
  });
  $('steward-close').addEventListener('click', () => {
    $('steward-modal').hidden = true;
  });
  // Nudge dpad — fine-tune the target pixel by ±1 cell after a rough tap.
  const nudgeMap = {
    'nudge-up':    [0, -1],
    'nudge-down':  [0,  1],
    'nudge-left':  [-1, 0],
    'nudge-right': [ 1, 0],
  };
  for (const id in nudgeMap) {
    $(id).addEventListener('click', () => {
      const t = getTarget(); if (!t) return;
      const [dx, dy] = nudgeMap[id];
      setTarget(
        Math.max(0, Math.min(N - 1, t.x + dx)),
        Math.max(0, Math.min(N - 1, t.y + dy))
      );
      refreshCommitRow();
    });
  }
}

function onTargetSelected(t) {
  refreshCommitRow();
}

function refreshCommitRow() {
  const t = getTarget();
  const btn = $('commit-btn');
  const cancel = $('cancel-btn');
  const cooling = Date.now() < cooldownEndsAt;
  btn.classList.remove('armed');
  if (!t) {
    btn.disabled = true;
    btn.textContent = 'tap a cell';
    cancel.hidden = true;
    return;
  }
  cancel.hidden = false;
  if (cooling) {
    btn.disabled = true;
    const s = Math.ceil((cooldownEndsAt - Date.now()) / 1000);
    btn.textContent = `${s}s · ${t.x},${t.y}`;
  } else {
    btn.disabled = false;
    btn.textContent = `paint ${t.x},${t.y}`;
    btn.classList.add('armed');
  }
}

function commitTarget() {
  const t = getTarget();
  if (!t) return;
  if (Date.now() < cooldownEndsAt) return;
  // Pre-emptively flip cooldown so the user can't double-fire while the ack
  // round-trips.
  cooldownEndsAt = Date.now() + COOLDOWN_MS;
  tap(t.x, t.y, myColorIdx);
  clearTarget();
  refreshCommitRow();
  updateCooldownChip();
}

// ── Status chips ──────────────────────────────────────────────
function updateMemberChip() {
  $('member-chip').textContent =
    memberCount === 1 ? 'you alone here' : `${memberCount} here right now`;
}

function updateMineChip() {
  const n = myPixels.size;
  $('mine-chip').textContent =
    n === 0 ? '0 pixels still yours' :
    n === 1 ? '1 pixel still yours' :
    `${n} pixels still yours`;
  const ms = longestHoldMs;
  const streakStr = ms < 1000
    ? '—'
    : ms < 60000
      ? `${Math.round(ms / 1000)}s`
      : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  $('streak-chip').textContent = `longest streak ${streakStr}`;
}

function updateCooldownChip() {
  const chip = $('cooldown-chip');
  const remain = cooldownEndsAt - Date.now();
  if (remain <= 0) {
    chip.textContent = 'brush armed';
    chip.classList.add('armed');
    chip.classList.remove('cooling');
  } else {
    const s = Math.max(1, Math.ceil(remain / 1000));
    // The cooldown is now seconds-short, so just rotate the phrase per-tap
    // instead of per-8-seconds — keeps the voice without being noisy.
    const phrase = COOLDOWN_PHRASES[(cooldownEndsAt >> 11) % COOLDOWN_PHRASES.length];
    chip.textContent = `${phrase} · ${s}s`;
    chip.classList.add('cooling');
    chip.classList.remove('armed');
  }
  refreshCommitRow();
}

// ── Overwrite feed ────────────────────────────────────────────
function announceOverwrite(x, y, colorIdx, heldMs) {
  const list = $('overwrite-list');
  if (list.querySelector('.empty')) list.innerHTML = '';
  const li = document.createElement('li');
  const swatch = document.createElement('span');
  swatch.className = 'by-color';
  swatch.style.background = PALETTE[colorIdx].hex;
  li.appendChild(swatch);
  const t = document.createTextNode(
    ` ${PALETTE[colorIdx].name} took ${x},${y} after ${formatHeld(heldMs)}`
  );
  li.appendChild(t);
  list.prepend(li);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

function formatHeld(ms) {
  if (ms < 1000) return 'a heartbeat';
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// ── Steward Notice (5-minute silent) ──────────────────────────
function showStewardNotice() {
  const surviving = myPixels.size;
  let nemesisIdx = -1;
  let nemesisN = 0;
  for (let i = 0; i < 8; i++) if (nemesisCounts[i] > nemesisN) { nemesisN = nemesisCounts[i]; nemesisIdx = i; }

  $('steward-headline').textContent =
    surviving === 0
      ? 'your wall is empty.'
      : surviving === 1
        ? '1 pixel still answers to you.'
        : `${surviving} pixels still answer to you.`;
  $('steward-still').textContent = `${surviving} cell${surviving === 1 ? '' : 's'}`;

  const ms = longestHoldMs;
  $('steward-streak').textContent = ms < 1000 ? 'no holds tracked' :
    ms < 60000 ? `${Math.round(ms / 1000)}s${longestHoldCoord ? ` (${longestHoldCoord})` : ''}` :
    `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s${longestHoldCoord ? ` (${longestHoldCoord})` : ''}`;

  const nemesisName = nemesisIdx >= 0 ? PALETTE[nemesisIdx].name : 'nobody';
  $('steward-nemesis').textContent = nemesisIdx >= 0
    ? `${nemesisName} (${nemesisN}×)`
    : 'untouched';

  const longest = ms < 1000 ? 'a moment' :
                  ms < 60000 ? `${Math.round(ms / 1000)}s` :
                  `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  let verdict;
  if (nemesisIdx < 0) {
    verdict = NO_NEMESIS_VERDICTS[Math.floor(Math.random() * NO_NEMESIS_VERDICTS.length)];
  } else {
    const tpl = VERDICT_TEMPLATES[Math.floor(Math.random() * VERDICT_TEMPLATES.length)];
    verdict = tpl({ nemesis: nemesisName, surviving, longest });
  }
  $('steward-verdict').textContent = verdict;
  $('steward-modal').hidden = false;
}

// ── Share ─────────────────────────────────────────────────────
function share() {
  let text;
  if (lastOverwrittenCoord && lastOverwrittenHoldMs > 0) {
    text = `i held ${lastOverwrittenCoord} for ${formatHeld(lastOverwrittenHoldMs)} on the same-pixel wall before someone painted over me. ${location.href}`;
  } else if (myPixels.size > 0 && longestHoldCoord) {
    text = `${myPixels.size} pixels still answer to me on the same-pixel wall (longest hold ${myPixels.get(longestHoldCoord) ? 'still going' : formatHeld(longestHoldMs)}). ${location.href}`;
  } else {
    text = `the same-pixel wall: 32×32 cells, shared with strangers, board never resets. ${location.href}`;
  }
  if (navigator.share) {
    navigator.share({ title: 'Same Pixel', text, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      () => alert('copied. send it to whoever you suspect of being a saffron.'),
      () => prompt('copy this:', text)
    );
  } else {
    prompt('copy this:', text);
  }
}

init();
