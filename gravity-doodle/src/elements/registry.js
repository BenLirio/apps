// Element registry: in-memory map of id → spec, plus the key↔id lookup.
//
// `registerElement` is what the rest of the app calls to install an
// element. It hot-reloads every GPU lookup texture so the new spec takes
// effect on the next frame, and rebuilds the discovery rules so reaction
// chains are detected. AI-invented elements also flow through here.

import { state } from '../state.js';
import {
  KIND_EMPTY, KIND_STATIC, KIND_POWDER, KIND_LIQUID, KIND_GAS, KIND_CELLULAR,
} from '../constants.js';
import {
  uploadElementData, uploadPalette, uploadReactions,
  uploadTraits, uploadCellular, uploadRegisters,
} from '../gl/uploads.js';
import { rebuildDiscoveryRules } from '../discovery.js';

export function kindCode(kind) {
  switch (kind) {
    case 'static':   return KIND_STATIC;
    case 'powder':   return KIND_POWDER;
    case 'liquid':   return KIND_LIQUID;
    case 'gas':      return KIND_GAS;
    case 'cellular': return KIND_CELLULAR;
  }
  return KIND_EMPTY;
}

export function registerElement(spec) {
  state.registry[spec.id] = spec;
  state.keyToId[spec.key] = spec.id;
  if (spec.id >= state.nextId) state.nextId = spec.id + 1;
  if (state.gl) {
    uploadElementData();
    uploadPalette();
    uploadReactions();
    uploadTraits();
    uploadCellular();
    uploadRegisters();
  }
  rebuildDiscoveryRules();
}

export function nextCustomId() { return state.nextId++; }
