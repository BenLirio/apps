// Two modals live in here: the "invent element" form (calls the AI) and
// the "flag this element" form (sends element_feedback to the feedback
// endpoint). They share enough scaffolding to live together.

import { state } from '../state.js';
import { SLUG, FEEDBACK_ENDPOINT } from '../constants.js';
import { generateElement } from '../ai/generate.js';
import { finalizeSpec, fallbackSpec, slugify } from '../ai/finalize.js';
import { registerElement } from '../elements/registry.js';
import { rebuildPalette, setMaterial } from './palette.js';

// ───── Invent modal ─────────────────────────────────────────────────────

export function bindInventModal() {
  const overlay = document.getElementById('invent-overlay');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInvent(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeInvent();
  });
  document.querySelectorAll('.invent-example').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('invent-name').value = btn.getAttribute('data-name') || '';
      document.getElementById('invent-desc').value = btn.getAttribute('data-desc') || '';
      document.getElementById('invent-name').focus();
    });
  });
  document.getElementById('invent-cancel').addEventListener('click', closeInvent);
  document.getElementById('invent-submit').addEventListener('click', submitInvent);
}

export function openInvent() {
  const overlay = document.getElementById('invent-overlay');
  overlay.classList.remove('hidden');
  setInventStatus('', false);
  const nameEl = document.getElementById('invent-name');
  const descEl = document.getElementById('invent-desc');
  nameEl.value = ''; descEl.value = '';
  setInventBusy(false);
  setTimeout(() => nameEl.focus(), 30);
}

export function closeInvent() {
  document.getElementById('invent-overlay').classList.add('hidden');
}

function setInventStatus(msg, isErr) {
  const el = document.getElementById('invent-status');
  el.textContent = msg || ''; el.classList.toggle('err', !!isErr);
}

function setInventBusy(busy) {
  document.getElementById('invent-submit').disabled = busy;
  document.getElementById('invent-cancel').disabled = busy;
  document.getElementById('invent-submit').textContent = busy ? 'inventing…' : 'invent';
}

async function submitInvent() {
  const nameRaw = (document.getElementById('invent-name').value || '').trim();
  const descRaw = (document.getElementById('invent-desc').value || '').trim();
  if (!nameRaw) { setInventStatus('give it a name first.', true); return; }
  const key = slugify(nameRaw);
  if (!key) { setInventStatus('pick a name with letters in it.', true); return; }
  if (state.keyToId[key]) { setInventStatus('that name is already taken.', true); return; }
  setInventBusy(true);
  setInventStatus('asking the AI for physics…', false);
  try {
    const spec = await generateElement(nameRaw, descRaw);
    const finalized = finalizeSpec(nameRaw, key, spec, descRaw);
    registerElement(finalized);
    rebuildPalette();
    setMaterial(finalized.key);
    closeInvent();
  } catch (e) {
    try {
      const fb = fallbackSpec(nameRaw, key, descRaw);
      registerElement(fb);
      rebuildPalette();
      setMaterial(fb.key);
      closeInvent();
    } catch (e2) {
      setInventBusy(false);
      setInventStatus('could not invent right now. try a different name.', true);
    }
  }
}

// ───── Element-feedback modal ───────────────────────────────────────────

export function bindElementFeedbackModal() {
  const overlay = document.getElementById('elfb-overlay');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeElementFeedback(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeElementFeedback();
  });
  document.getElementById('elfb-cancel').addEventListener('click', closeElementFeedback);
  document.getElementById('elfb-submit').addEventListener('click', submitElementFeedback);
  document.querySelectorAll('#elfb-chips .elfb-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}

export function openElementFeedback(key) {
  const id = state.keyToId[key];
  if (!id) return;
  const spec = state.registry[id];
  if (!spec) return;
  state.elfbTargetKey = key;
  document.getElementById('elfb-name').textContent = spec.displayName;
  document.querySelectorAll('#elfb-chips .elfb-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('elfb-note').value = '';
  setElfbStatus('', false);
  document.getElementById('elfb-submit').disabled = false;
  document.getElementById('elfb-submit').textContent = 'send';
  document.getElementById('elfb-overlay').classList.remove('hidden');
}

function closeElementFeedback() {
  document.getElementById('elfb-overlay').classList.add('hidden');
  state.elfbTargetKey = null;
}

function setElfbStatus(msg, isErr) {
  const el = document.getElementById('elfb-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', !!isErr);
}

function submitElementFeedback() {
  if (!state.elfbTargetKey) { closeElementFeedback(); return; }
  const id = state.keyToId[state.elfbTargetKey];
  const spec = state.registry[id];
  if (!spec) { closeElementFeedback(); return; }
  const reasons = Array.from(document.querySelectorAll('#elfb-chips .elfb-chip.selected'))
    .map(c => c.getAttribute('data-reason')).filter(Boolean);
  const note = (document.getElementById('elfb-note').value || '').trim();
  if (!reasons.length && !note) { setElfbStatus('pick a reason or add a note.', true); return; }
  const report = { type: 'element_feedback', element: spec, reasons, note };
  const text = '[element_feedback] ' + spec.displayName
    + (reasons.length ? ' — ' + reasons.join('; ') : '')
    + (note ? ' — ' + note : '')
    + '\n' + JSON.stringify(report);
  const submitBtn = document.getElementById('elfb-submit');
  submitBtn.disabled = true; submitBtn.textContent = 'sending…';
  setElfbStatus('', false);
  fetch(FEEDBACK_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG, text }),
  }).then(r => { if (!r.ok) throw new Error('http_' + r.status); return r.json(); })
    .then(() => { setElfbStatus('thanks — the builder will see this next iteration.', false); setTimeout(closeElementFeedback, 1200); })
    .catch(() => { submitBtn.disabled = false; submitBtn.textContent = 'retry'; setElfbStatus('send failed. try again?', true); });
}
