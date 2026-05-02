// Discovery log — pops a toast the first time the user has both sides
// of a reaction visible on screen at the same time. The set of rules
// is rebuilt whenever the registry changes (registerElement triggers
// rebuildDiscoveryRules); the GPU readback runs every
// DISCOVERY_INTERVAL frames inside the main loop.

import { state } from './state.js';

export function rebuildDiscoveryRules() {
  const { registry, keyToId } = state;
  state.discoveryRules = [];
  const seen = new Set();
  const push = (fromKey, toKey, label) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const from = keyToId[fromKey];
    const to = keyToId[toKey];
    if (!from || !to) return;
    const k = from + '>' + to;
    if (seen.has(k)) return;
    seen.add(k);
    state.discoveryRules.push({ from, to, fromKey, toKey, label });
  };
  for (const idStr of Object.keys(registry)) {
    const spec = registry[+idStr];
    if (!spec) continue;
    if (spec.meltsTo)    push(spec.key, spec.meltsTo,   `${spec.key} melts → ${spec.meltsTo}`);
    if (spec.boilsTo)    push(spec.key, spec.boilsTo,   `${spec.key} boils → ${spec.boilsTo}`);
    if (spec.freezesTo)  push(spec.key, spec.freezesTo, `${spec.key} ${spec.kind === 'gas' ? 'condenses' : 'freezes'} → ${spec.freezesTo}`);
    if (spec.raTransformsTo) push(spec.key, spec.raTransformsTo, `${spec.key} decays → ${spec.raTransformsTo}`);
    if (spec.pressureBlastTo) push(spec.key, spec.pressureBlastTo, `${spec.key} pops → ${spec.pressureBlastTo}`);
    if (Array.isArray(spec.reactions)) {
      for (const rx of spec.reactions) {
        if (!rx || rx.explodes) continue;
        if (rx.becomes) push(rx.other, rx.becomes, `${rx.other} + ${spec.key} → ${rx.becomes}`);
      }
    }
  }
}

export function discoveryReadback() {
  const { gl, cols, rows, discoveryRules, discoveredKeys } = state;
  if (!gl || !discoveryRules.length) return;
  if (!state.discoveryReadBuf || state.discoveryReadBuf.length !== cols * rows * 4) {
    state.discoveryReadBuf = new Uint8Array(cols * rows * 4);
  }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.stateFboA);
  gl.readPixels(0, 0, cols, rows, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, state.discoveryReadBuf);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  const present = new Set();
  for (let i = 0; i < state.discoveryReadBuf.length; i += 4) {
    const id = state.discoveryReadBuf[i];
    if (id !== 0) present.add(id);
  }
  for (const rule of discoveryRules) {
    const k = rule.from + '>' + rule.to;
    if (discoveredKeys.has(k)) continue;
    if (present.has(rule.from) && present.has(rule.to)) {
      discoveredKeys.add(k);
      if (rule.label) queueDiscoveryToast(rule.label);
    }
  }
}

export function queueDiscoveryToast(label) {
  state.discoveryToastQueue.push(label);
  if (!state.discoveryToastActive) showNextDiscoveryToast();
}

export function showNextDiscoveryToast() {
  const el = document.getElementById('discovery-toast');
  if (!el) return;
  if (!state.discoveryToastQueue.length) {
    state.discoveryToastActive = false;
    el.classList.add('hidden');
    return;
  }
  state.discoveryToastActive = true;
  const label = state.discoveryToastQueue.shift();
  el.textContent = 'discovered: ' + label;
  el.classList.add('hidden');
  void el.offsetWidth;
  el.classList.remove('hidden');
  if (state.discoveryToastTimer) clearTimeout(state.discoveryToastTimer);
  state.discoveryToastTimer = setTimeout(() => {
    state.discoveryToastActive = false;
    showNextDiscoveryToast();
  }, 3200);
}
