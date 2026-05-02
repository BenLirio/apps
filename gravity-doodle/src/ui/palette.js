// Material palette toolbar: builds buttons for every visible element in
// the registry, plus an erase button. Long-press / flag icon on
// AI-invented buttons opens the element-feedback modal.

import { state } from '../state.js';
import {
  WALL_ID, STONE_ID, WOOD_ID, SAND_ID, GRAVEL_ID, DUST_ID,
  WATER_ID, OIL_ID, MERCURY_ID, HONEY_ID, TAR_ID, ACID_ID,
  ICE_ID, STEAM_ID, LAVA_ID, FIRE_ID, EXPLOSIVE_ID, SMOKE_ID, BALLOON_ID,
  PLANT_ID, MOLD_ID, VINE_ID, COPPER_ID, BATTERY_ID, LIGHTNING_ID,
  FAN_ID, URANIUM_ID,
} from '../constants.js';
import { pourableKeyFor } from '../sim/pours.js';
import { openElementFeedback } from './modals.js';

// Logical grouping for built-ins: solids → powders → liquids → cold↔hot
// → volatile → life → electrical → airflow. Custom (AI) elements append.
const ORDERED_BUILTIN_IDS = [
  WALL_ID, STONE_ID, WOOD_ID,
  SAND_ID, GRAVEL_ID, DUST_ID,
  WATER_ID, OIL_ID, MERCURY_ID, HONEY_ID, TAR_ID, ACID_ID,
  ICE_ID, STEAM_ID,
  LAVA_ID, FIRE_ID, EXPLOSIVE_ID, SMOKE_ID, BALLOON_ID,
  PLANT_ID, MOLD_ID, VINE_ID,
  COPPER_ID, BATTERY_ID, LIGHTNING_ID,
  FAN_ID,
  URANIUM_ID,
];

export function rebuildPalette() {
  const host = document.getElementById('palette-buttons');
  if (!host) return;
  host.innerHTML = '';

  const orderedIds = [...ORDERED_BUILTIN_IDS];
  const customIds = Object.keys(state.registry)
    .map(n => +n)
    .filter(id => !state.registry[id].isBuiltIn)
    .sort((a, b) => a - b);
  orderedIds.push(...customIds);

  for (const id of orderedIds) {
    const spec = state.registry[id];
    if (!spec || spec.isHidden) continue;
    host.appendChild(buildMaterialButton(spec));
  }
  host.appendChild(buildEraseButton());
  refreshActiveClass();
}

function buildMaterialButton(spec) {
  const btn = document.createElement('button');
  btn.type = 'button';
  const extraClass = spec.isBuiltIn && spec.isExplosive ? ' mat-explosive-builtin' : '';
  btn.className = 'tool-btn ' + (spec.isBuiltIn ? ('mat-' + spec.key) : 'mat-custom') + extraClass;
  btn.setAttribute('data-key', spec.key);
  if (!spec.isBuiltIn) {
    btn.style.setProperty('--swatch', spec.colors[0] || '#e8a030');
  }
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
    if (e.target && e.target.classList && e.target.classList.contains('flag-el')) return;
    setMaterial(spec.key);
  });
  return btn;
}

function attachLongPress(el, handler) {
  let timer = null, startX = 0, startY = 0, fired = false;
  const start = (e) => {
    fired = false;
    const t = (e.touches && e.touches[0]) || e;
    startX = t.clientX; startY = t.clientY;
    timer = setTimeout(() => { fired = true; handler(); }, 650);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const move = (e) => {
    if (!timer) return;
    const t = (e.touches && e.touches[0]) || e;
    if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
  };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('touchend', (e) => { cancel(); if (fired && e.cancelable) e.preventDefault(); });
  el.addEventListener('touchcancel', cancel);
}

function buildEraseButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool-btn mat-erase';
  btn.setAttribute('data-key', 'erase');
  btn.textContent = 'erase';
  btn.addEventListener('click', () => setMaterial('erase'));
  return btn;
}

export function refreshActiveClass() {
  document.querySelectorAll('.tool-btn').forEach(b => {
    const k = b.getAttribute('data-key');
    b.classList.toggle('active', k === state.selectedKey);
  });
}

export function setMaterial(key) {
  state.selectedKey = key;
  refreshActiveClass();
  syncActionLabel();
}

export function syncActionLabel() {
  const drop = document.getElementById('btn-drop');
  if (drop) drop.textContent = 'pour ' + pourableKeyFor(state.selectedKey);
}
