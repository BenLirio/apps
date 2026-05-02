// Two modals: the "invent element" form (calls the AI) and the
// "flag this element" form (sends element_feedback to the feedback
// endpoint). They share enough scaffolding to live together.

import { state } from '../state.js';
import { SLUG, FEEDBACK_ENDPOINT } from '../constants.js';
import { generateElement } from '../ai/generate.js';
import { finalizeSpec, fallbackSpec, slugify } from '../ai/finalize.js';
import { registerElement } from '../elements.js';
import { rebuildPalette, setMaterial } from './palette.js';

// ───── Invent modal ───────────────────────────────────────────────────

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
  document.getElementById('invent-overlay').classList.remove('hidden');
  setStatus('invent', '', false);
  document.getElementById('invent-name').value = '';
  document.getElementById('invent-desc').value = '';
  setBusy(false);
  setTimeout(() => document.getElementById('invent-name').focus(), 30);
}

function closeInvent() {
  document.getElementById('invent-overlay').classList.add('hidden');
}

function setStatus(kind, msg, isErr) {
  const el = document.getElementById(kind + '-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', !!isErr);
}

function setBusy(busy) {
  const submit = document.getElementById('invent-submit');
  const cancel = document.getElementById('invent-cancel');
  submit.disabled = busy;
  cancel.disabled = busy;
  submit.textContent = busy ? 'inventing…' : 'invent';
}

async function submitInvent() {
  const nameRaw = (document.getElementById('invent-name').value || '').trim();
  const descRaw = (document.getElementById('invent-desc').value || '').trim();
  if (!nameRaw) { setStatus('invent', 'give it a name first.', true); return; }
  const key = slugify(nameRaw);
  if (!key) { setStatus('invent', 'pick a name with letters in it.', true); return; }
  if (state.keyToId[key]) { setStatus('invent', 'that name is already taken.', true); return; }

  setBusy(true);
  setStatus('invent', 'asking the AI for physics…', false);
  let spec;
  try {
    spec = finalizeSpec(nameRaw, key, await generateElement(nameRaw, descRaw), descRaw);
  } catch (e) {
    spec = fallbackSpec(nameRaw, key, descRaw);
  }
  registerElement(spec);
  rebuildPalette();
  setMaterial(spec.key);
  closeInvent();
}

// ───── Element-feedback modal ─────────────────────────────────────────

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
  const spec = state.registry[state.keyToId[key]];
  if (!spec) return;
  state.elfbTargetKey = key;
  document.getElementById('elfb-name').textContent = spec.displayName;
  document.querySelectorAll('#elfb-chips .elfb-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('elfb-note').value = '';
  setStatus('elfb', '', false);
  const submit = document.getElementById('elfb-submit');
  submit.disabled = false;
  submit.textContent = 'send';
  document.getElementById('elfb-overlay').classList.remove('hidden');
}

function closeElementFeedback() {
  document.getElementById('elfb-overlay').classList.add('hidden');
  state.elfbTargetKey = null;
}

function submitElementFeedback() {
  if (!state.elfbTargetKey) { closeElementFeedback(); return; }
  const spec = state.registry[state.keyToId[state.elfbTargetKey]];
  if (!spec) { closeElementFeedback(); return; }
  const reasons = [...document.querySelectorAll('#elfb-chips .elfb-chip.selected')]
    .map(c => c.getAttribute('data-reason')).filter(Boolean);
  const note = (document.getElementById('elfb-note').value || '').trim();
  if (!reasons.length && !note) { setStatus('elfb', 'pick a reason or add a note.', true); return; }

  const report = { type: 'element_feedback', element: spec, reasons, note };
  const text = '[element_feedback] ' + spec.displayName
    + (reasons.length ? ' — ' + reasons.join('; ') : '')
    + (note ? ' — ' + note : '')
    + '\n' + JSON.stringify(report);
  const submit = document.getElementById('elfb-submit');
  submit.disabled = true; submit.textContent = 'sending…';
  setStatus('elfb', '', false);
  fetch(FEEDBACK_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG, text }),
  }).then(r => { if (!r.ok) throw new Error('http_' + r.status); return r.json(); })
    .then(() => { setStatus('elfb', 'thanks — the builder will see this next iteration.', false); setTimeout(closeElementFeedback, 1200); })
    .catch(() => { submit.disabled = false; submit.textContent = 'retry'; setStatus('elfb', 'send failed. try again?', true); });
}
