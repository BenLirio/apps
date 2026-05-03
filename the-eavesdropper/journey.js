/* journey.js — copy strings + screen state machine.
 *   intro/seat → listen (90s) → loading → letter
 *
 * Owns DOM rendering for each screen. Imports mechanic + ai for behavior.
 * No fetch() lives here — that's ai.js. No simulation state lives here —
 * that's mechanic.js. */

import { TABLES, SEATS, FLOOR_GRID, NAME_BANK } from './cafe.js';
import {
  scheduleFragments,
  startSession,
  deriveLetterSignature,
  SESSION_SECONDS,
} from './mechanic.js';
import { generateLetter } from './ai.js';

/* Voice-locked copy for the four required locations
 * 1. loading: "a stranger is typing you a letter…"
 * 2. error:   "the typewriter jammed for a moment — try sitting somewhere else."
 * 3. pre-interaction (intro on seat-pick screen): in HTML — "the bell rings…"
 * 4. result micro-copy: per-letter — references the leader-table descriptor */

const $ = (id) => document.getElementById(id);

let lingeredFragments = []; // pushed when user taps "lean in" (or by default at fragment expiry)
let session = null;
let seatId = null;
let scheduleCache = null;
let letterPayload = null; // cached for share()

/* ============ Screen 1: seat picker ============ */
export function renderSeatPicker() {
  const grid = $('seatGrid');
  grid.innerHTML = '';
  // FLOOR_GRID is 6 rows × 7 cols of glyph descriptors
  for (let r = 0; r < FLOOR_GRID.length; r++) {
    for (let c = 0; c < FLOOR_GRID[r].length; c++) {
      const desc = FLOOR_GRID[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (desc === 'empty') {
        cell.classList.add('empty');
      } else if (desc.startsWith('wall:')) {
        cell.classList.add('wall');
        cell.textContent = desc.slice(5);
      } else if (desc.startsWith('bar:')) {
        cell.classList.add('bar');
        cell.textContent = desc.slice(4);
      } else if (desc.startsWith('table:')) {
        cell.classList.add('table');
        cell.textContent = 'T' + desc.slice(6);
      } else if (desc.startsWith('plant:')) {
        cell.classList.add('plant');
        cell.textContent = desc.slice(6);
      } else if (desc.startsWith('seat:')) {
        const sid = desc.slice(5);
        const seat = SEATS[sid];
        cell.classList.add('seat');
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', 'sit at ' + seat.label);
        cell.title = seat.label + ' — ' + seat.where;
        cell.textContent = '○';
        cell.addEventListener('click', () => onSeatChosen(sid));
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeatChosen(sid); }
        });
      }
      grid.appendChild(cell);
    }
  }
}

function onSeatChosen(sid) {
  seatId = sid;
  scheduleCache = scheduleFragments(sid);
  show('screen-listen');
  hide('screen-seat');
  startListenScreen();
}

/* ============ Screen 2: listening ============ */
function startListenScreen() {
  const seat = SEATS[seatId];
  $('nowTarget').textContent = '— (the room is settling)';
  $('nowDwell').textContent = '';

  const stack = $('fragmentStack');
  stack.innerHTML = '';
  setTimeFill(1);
  $('timeLabel').textContent = `${SESSION_SECONDS}s left · seated at ${seat.label}`;
  initAttentionRows();
  lingeredFragments = [];

  let visibleNodeMap = new Map();

  session = startSession({
    seatId,
    schedule: scheduleCache,
    onFragment: ({ visible, newFragId }) => {
      // Remove any DOM nodes whose fragId is no longer in `visible`
      const visibleIds = new Set(visible.map(v => v.fragId));
      for (const [fragId, node] of visibleNodeMap.entries()) {
        if (!visibleIds.has(fragId)) {
          node.classList.add('is-fading');
          setTimeout(() => node.remove(), 350);
          visibleNodeMap.delete(fragId);
        }
      }
      // Append any new fragments
      for (const v of visible) {
        if (visibleNodeMap.has(v.fragId)) continue;
        const node = document.createElement('div');
        node.className = 'fragment';
        node.dataset.fragId = v.fragId;
        node.dataset.tableId = v.tableId;
        node.innerHTML = `
          <div class="fragment-tag">
            <span class="table-name">${escapeHtml(v.tableName)} · ${escapeHtml(v.tableLabel)}</span>
            <span class="dwell-pct" data-pct="${v.tableId}">·</span>
          </div>
          <div class="fragment-text">${escapeHtml(v.fragmentText)}</div>
          <div class="fragment-speaker">— ${escapeHtml(v.speaker)}</div>
        `;
        node.addEventListener('click', () => onFragmentTap(v));
        stack.appendChild(node);
        visibleNodeMap.set(v.fragId, node);
      }
    },
    onTick: ({ remainingMs, target, dwell, lockedTargetActive }) => {
      // update the "currently listening to" label
      const targetTable = target ? TABLES[target] : null;
      $('nowTarget').textContent = targetTable
        ? `${targetTable.name} · ${targetTable.label}`
        : '— (the room is settling)';
      $('nowDwell').textContent = lockedTargetActive ? '(leaning in…)' : '';

      // highlight the focused fragment node
      for (const node of visibleNodeMap.values()) {
        if (target && node.dataset.tableId === target) {
          node.classList.add('is-listening');
        } else {
          node.classList.remove('is-listening');
        }
      }

      // time bar
      const frac = remainingMs / (SESSION_SECONDS * 1000);
      setTimeFill(frac);
      $('timeLabel').textContent = `${Math.ceil(remainingMs / 1000)}s left · seated at ${SEATS[seatId].label}`;

      // attention bar (per-table dwell %)
      updateAttentionRows(dwell.pct);
    },
    onDone: ({ dwell, leaderTableId }) => {
      finishSession({ dwell, leaderTableId });
    },
  });
}

function onFragmentTap(v) {
  if (!session) return;
  // Record what the user lingered on (deduplicated by fragId).
  if (!lingeredFragments.some(l => l.fragId === v.fragId)) {
    lingeredFragments.push({
      fragId: v.fragId,
      tableId: v.tableId,
      fragmentText: v.fragmentText,
    });
  }
  session.leanIn(v.fragId);
}

function setTimeFill(frac) {
  $('timeFill').style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
}

function initAttentionRows() {
  const rows = $('attentionRows');
  rows.innerHTML = '';
  const seat = SEATS[seatId];
  for (const tableId of Object.keys(seat.proximity)) {
    const t = TABLES[tableId];
    const row = document.createElement('div');
    row.className = 'attention-row';
    row.dataset.tableId = tableId;
    row.innerHTML = `
      <span class="att-name">${escapeHtml(t.name)}</span>
      <span class="att-meter"><span class="att-fill" style="transform: scaleX(0)"></span></span>
      <span class="att-pct">0%</span>
    `;
    rows.appendChild(row);
  }
}

function updateAttentionRows(pctMap) {
  let leaderId = null;
  let leaderVal = -1;
  for (const [k, v] of Object.entries(pctMap)) {
    if (v > leaderVal) { leaderVal = v; leaderId = k; }
  }
  for (const row of document.querySelectorAll('.attention-row')) {
    const tableId = row.dataset.tableId;
    const v = pctMap[tableId] || 0;
    row.querySelector('.att-fill').style.transform = `scaleX(${v})`;
    row.querySelector('.att-pct').textContent = `${Math.round(v * 100)}%`;
    if (tableId === leaderId && v > 0.05) {
      row.classList.add('is-leader');
    } else {
      row.classList.remove('is-leader');
    }
  }
}

/* ============ Screen 3: letter ============ */
async function finishSession({ dwell, leaderTableId }) {
  hide('screen-listen');
  show('screen-letter');
  const loading = $('loadingStrip');
  loading.hidden = false;
  $('letterCard').hidden = true;
  $('shareRow').hidden = true;

  // Cycle the loading copy so the user knows time is passing
  const messages = [
    'a stranger is typing you a letter…',
    'they are choosing the quietest verb…',
    'they are crossing out the second sentence…',
    'they are finding the right paper…',
  ];
  let mi = 0;
  $('loadingText').textContent = messages[0];
  const loaderInterval = setInterval(() => {
    mi = (mi + 1) % messages.length;
    $('loadingText').textContent = messages[mi];
  }, 1700);

  const sig = deriveLetterSignature({
    seatId,
    leaderTableId,
    dwellPctVector: dwell.pct,
  });

  const seat = SEATS[seatId];

  const aiInput = {
    seatId,
    seatLabel: seat.label,
    seatWhere: seat.where,
    leaderTableId,
    signerName: sig.signerName,
    letterSelfDescriptor: sig.letterSelfDescriptor,
    dwellPctVector: dwell.pct,
    lingeredFragments,
    letterSeed: sig.letterSeed,
  };

  let result;
  try {
    result = await generateLetter(aiInput);
  } catch (_) {
    result = { text: '', source: 'fallback' };
  }
  clearInterval(loaderInterval);
  loading.hidden = true;

  letterPayload = {
    seatLabel: seat.label,
    leaderTableName: TABLES[leaderTableId].name,
    signerName: sig.signerName,
    signerSuffix: sig.signerSuffix,
    text: result.text || 'the typewriter jammed for a moment — try sitting somewhere else.',
    seedString: sig.seedString,
  };

  renderLetter(letterPayload);
}

function renderLetter({ seatLabel, leaderTableName, signerName, signerSuffix, text }) {
  $('letterCard').hidden = false;
  $('shareRow').hidden = false;
  $('letterMeta').textContent = `cafe halcyon · tuesday · seat: ${seatLabel}`;
  $('letterGreeting').textContent = 'to you,';
  $('letterBody').innerHTML = '';
  // Render paragraphs split on blank lines
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (const p of paragraphs) {
    const node = document.createElement('p');
    node.textContent = p;
    $('letterBody').appendChild(node);
  }
  $('letterSign').textContent = signerName;
  $('letterTable').textContent = signerSuffix;

  // gentle scroll-into-view on mobile so the letter is foregrounded
  $('letterCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============ Share / restart ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function show(id) { $(id).hidden = false; }
function hide(id) { $(id).hidden = true; }

export function shareLetter() {
  if (!letterPayload) return;
  const blurb = `i sat at ${letterPayload.seatLabel} in cafe halcyon and ${letterPayload.signerName} (${letterPayload.leaderTableName}) wrote me a letter. different seat, different letter.`;
  const url = location.href.split('#')[0];
  const text = `${blurb}\n${url}`;
  if (navigator.share) {
    navigator.share({ title: 'a letter from a stranger', text, url }).catch(() => {});
    return;
  }
  // Fallback: clipboard + small toast
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      flashShareMessage('link & note copied — paste it to a friend');
    }).catch(() => {
      flashShareMessage('couldn\'t copy — long-press the URL bar and send the page');
    });
  } else {
    flashShareMessage('long-press the URL bar to share');
  }
}

function flashShareMessage(msg) {
  let toast = document.getElementById('eav-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'eav-toast';
    toast.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      background: var(--ink, #2a1a10); color: var(--paper, #f3ead6);
      padding: 10px 14px; border-radius: 999px;
      font-family: 'Courier Prime', monospace; font-size: 12px;
      letter-spacing: 0.05em; z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 2200);
}

export function restartJourney() {
  if (session) { session.stop(); session = null; }
  seatId = null;
  scheduleCache = null;
  letterPayload = null;
  lingeredFragments = [];
  hide('screen-letter');
  hide('screen-listen');
  show('screen-seat');
  $('letterCard').hidden = true;
  $('shareRow').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
