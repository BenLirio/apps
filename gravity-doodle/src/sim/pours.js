// "Pour" is the user clicking the pour button — it spawns a stream of
// the currently selected element from the top (gases from the bottom)
// for ~300 frames. Multiple concurrent pours are supported.

import { state } from '../state.js';
import { paintPass } from './paint.js';

export function pourableKeyFor(key) {
  if (key === 'erase') return 'sand';
  const id = state.keyToId[key];
  if (!id) return 'sand';
  const spec = state.registry[id];
  if (!spec) return 'sand';
  if (spec.kind !== 'powder' && spec.kind !== 'liquid') return 'sand';
  return key;
}

export function startDrop() {
  const key = pourableKeyFor(state.selectedKey);
  const id = state.keyToId[key];
  if (!id) return;
  const spec = state.registry[id];
  state.pours.push({ id, kind: spec.kind, frames: 0, total: 300 });
}

export function spawnFromPours() {
  if (!state.pours.length) return;
  const next = [];
  for (const p of state.pours) {
    if (p.frames > p.total) continue;
    const spec = state.registry[p.id];
    if (!spec) continue;
    const sprayRow = (spec.kind === 'gas') ? 1 : (state.rows - 2);
    for (let s = 0; s < 6; s++) {
      const cx = Math.floor(Math.random() * state.cols);
      paintPass(cx, sprayRow, 1, p.id, spec);
    }
    p.frames++;
    next.push(p);
  }
  state.pours = next;
}
