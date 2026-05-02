// Material palette toolbar — one button per visible registry entry plus
// an erase button. AI-invented elements get a corner "flag" badge that
// opens the element-feedback modal.
//
// Order is the registry's id order, which equals the BUILTINS table
// followed by AI-invented elements in invention order.

import { state } from '../state.js';
import { openElementFeedback } from './modals.js';

export function rebuildPalette() {
  const host = document.getElementById('palette-buttons');
  if (!host) return;
  host.innerHTML = '';
  const ids = Object.keys(state.registry).map(n => +n).sort((a, b) => a - b);
  for (const id of ids) {
    const spec = state.registry[id];
    if (!spec || spec.isHidden) continue;
    host.appendChild(materialButton(spec));
  }
  host.appendChild(eraseButton());
  refreshActiveClass();
}

function materialButton(spec) {
  const btn = document.createElement('button');
  btn.type = 'button';
  const explosiveClass = (spec.isBuiltIn && spec.isExplosive) ? ' mat-explosive-builtin' : '';
  btn.className = 'tool-btn ' + (spec.isBuiltIn ? ('mat-' + spec.key) : 'mat-custom') + explosiveClass;
  btn.setAttribute('data-key', spec.key);
  if (!spec.isBuiltIn) btn.style.setProperty('--swatch', spec.colors[0] || '#e8a030');

  const label = document.createElement('span');
  label.textContent = spec.displayName.slice(0, 14);
  btn.appendChild(label);

  if (!spec.isBuiltIn) {
    const flag = document.createElement('span');
    flag.className = 'flag-el';
    flag.setAttribute('role', 'button');
    flag.setAttribute('aria-label', 'flag ' + spec.displayName);
    flag.setAttribute('title', 'flag ' + spec.displayName + ' — tell the builder what is wrong');
    flag.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      openElementFeedback(spec.key);
    });
    btn.appendChild(flag);
    attachLongPress(btn, () => openElementFeedback(spec.key));
  }

  btn.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('flag-el')) return;
    setMaterial(spec.key);
  });
  return btn;
}

function eraseButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool-btn mat-erase';
  btn.setAttribute('data-key', 'erase');
  btn.textContent = 'erase';
  btn.addEventListener('click', () => setMaterial('erase'));
  return btn;
}

function attachLongPress(el, handler) {
  let timer = null, sx = 0, sy = 0, fired = false;
  const start = (e) => {
    fired = false;
    const t = (e.touches && e.touches[0]) || e;
    sx = t.clientX; sy = t.clientY;
    timer = setTimeout(() => { fired = true; handler(); }, 650);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const move = (e) => {
    if (!timer) return;
    const t = (e.touches && e.touches[0]) || e;
    if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) cancel();
  };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchmove',  move,  { passive: true });
  el.addEventListener('touchend',   (e) => { cancel(); if (fired && e.cancelable) e.preventDefault(); });
  el.addEventListener('touchcancel', cancel);
}

export function refreshActiveClass() {
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-key') === state.selectedKey);
  });
}

export function setMaterial(key) {
  state.selectedKey = key;
  refreshActiveClass();
}
