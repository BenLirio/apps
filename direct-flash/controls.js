// controls.js — owns the input channels (DeviceOrientation, mouse-drag,
// arrow keys) and emits a single calibrated tilt vector { pitch, roll }
// in degrees, normalized so neutral-pose = (0, 0).
//
// Per the device-orientation-controls KB page:
//   - pose-zero must be calibrated explicitly (pitch and roll baselines)
//   - tilt → output mapping must be one-step (here: tilt directly chooses scene)
//   - desktop fallback ships first-class (drag + arrow keys)
//
// Coordinate conventions (after calibration):
//   pitch > 0  → user tilted phone UP (looking at ceiling)
//   pitch < 0  → user tilted phone DOWN (looking at shoes)
//   roll > 0   → user rolled phone clockwise to the right
//   roll < 0   → user rolled phone counter-clockwise to the left

let baseline = { beta: null, gamma: null };
let raw = { beta: 0, gamma: 0 };
let mode = 'idle';                  // 'idle' | 'sensor' | 'fallback'
let listeners = new Set();
let kbState = { up: 0, down: 0, left: 0, right: 0 };

// Fallback-only state (cumulative drag + key offsets in degrees).
let fb = { pitch: 0, roll: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0, p: 0, r: 0 };

const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function onTilt(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const v = currentTilt();
  for (const fn of listeners) fn(v);
}

export function currentTilt() {
  if (mode === 'sensor' && baseline.beta !== null) {
    return {
      pitch: CLAMP((raw.beta - baseline.beta), -90, 90),
      roll:  CLAMP((raw.gamma - baseline.gamma), -90, 90),
      mode,
    };
  }
  return { pitch: CLAMP(fb.pitch, -90, 90), roll: CLAMP(fb.roll, -90, 90), mode: mode === 'idle' ? 'fallback' : mode };
}

/**
 * Request DeviceOrientation permission (iOS gates it behind a user gesture)
 * and capture pose-zero. If permission is denied or sensor is missing, we
 * fall back to the drag+keys path so the app is always playable.
 */
export async function requestPermissionAndCalibrate() {
  let granted = false;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      granted = (res === 'granted');
    } else if ('DeviceOrientationEvent' in window) {
      // Non-iOS — orientation events fire without explicit permission, but
      // some browsers on http or with privacy settings still won't deliver.
      granted = true;
    }
  } catch (e) {
    granted = false;
  }

  if (granted) {
    bindSensor();
    // Wait briefly to capture a real reading before snapshotting baseline.
    await waitForFirstReading(700);
    if (raw.beta !== null && raw.gamma !== null && (raw.beta !== 0 || raw.gamma !== 0)) {
      baseline = { beta: raw.beta, gamma: raw.gamma };
      mode = 'sensor';
      bindFallback(); // keys still work as additive tweaks if desired
      emit();
      return { mode };
    }
  }

  // Fallback path — always available.
  baseline = { beta: 0, gamma: 0 };
  fb = { pitch: 0, roll: 0 };
  mode = 'fallback';
  bindFallback();
  emit();
  return { mode };
}

/** Re-snapshot pose zero in-place. */
export function recalibrate() {
  if (mode === 'sensor' && raw.beta !== null) {
    baseline = { beta: raw.beta, gamma: raw.gamma };
  } else {
    fb = { pitch: 0, roll: 0 };
  }
  emit();
}

let firstReadResolve = null;
function waitForFirstReading(ms) {
  return new Promise((resolve) => {
    firstReadResolve = resolve;
    setTimeout(() => { firstReadResolve = null; resolve(); }, ms);
  });
}

let sensorBound = false;
function bindSensor() {
  if (sensorBound) return;
  sensorBound = true;
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    raw.beta = e.beta;
    raw.gamma = e.gamma;
    if (firstReadResolve) { firstReadResolve(); firstReadResolve = null; }
    emit();
  });
}

let fallbackBound = false;
function bindFallback() {
  if (fallbackBound) return;
  fallbackBound = true;

  const vf = document.getElementById('viewfinder');
  if (vf) {
    const onDown = (e) => {
      isDragging = true;
      const pt = pointer(e);
      dragStart = { x: pt.x, y: pt.y, p: fb.pitch, r: fb.roll };
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!isDragging) return;
      const pt = pointer(e);
      const rect = vf.getBoundingClientRect();
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      // Drag-to-tilt: vertical drag = pitch, horizontal = roll.
      // Map a full-height drag to ~110° of pitch range (covers ceiling→shoes).
      const pitchRange = 110;
      const rollRange = 110;
      fb.pitch = CLAMP(dragStart.p + (-dy / rect.height) * pitchRange, -90, 90);
      fb.roll  = CLAMP(dragStart.r + ( dx / rect.width)  * rollRange,  -90, 90);
      emit();
      e.preventDefault();
    };
    const onUp = () => { isDragging = false; };

    vf.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Keyboard fallback — arrow keys nudge tilt 6° per press, held = repeat.
  const KEY_STEP = 6;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    let used = true;
    switch (e.key) {
      case 'ArrowUp':    fb.pitch = CLAMP(fb.pitch + KEY_STEP, -90, 90); break;
      case 'ArrowDown':  fb.pitch = CLAMP(fb.pitch - KEY_STEP, -90, 90); break;
      case 'ArrowLeft':  fb.roll  = CLAMP(fb.roll  - KEY_STEP, -90, 90); break;
      case 'ArrowRight': fb.roll  = CLAMP(fb.roll  + KEY_STEP, -90, 90); break;
      default: used = false;
    }
    if (used) { emit(); e.preventDefault(); }
  });
}

function pointer(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

/**
 * Bucket a tilt vector into one of the named scenes. Buckets are wide enough
 * that finding each scene is easy with sensor noise, and the order is
 * deterministic (first match wins) so the readout never flickers between two.
 */
export function pickScene({ pitch, roll }) {
  const ap = Math.abs(pitch);
  const ar = Math.abs(roll);

  // Hard side-roll dominates everything else — that's "wall accident" or "DJ booth".
  if (ar > 45) {
    return roll < 0 ? SCENES.WALL : SCENES.BOOTH;
  }
  // Looking up at the ceiling.
  if (pitch > 35) return SCENES.CEILING;
  // Looking down at shoes.
  if (pitch < -35) return SCENES.SHOES;
  // Slight up + roll → selfie miss.
  if (pitch > 12 && ar > 14) return SCENES.SELFIE;
  // Slight down + roll → drink in hand.
  if (pitch < -12 && ar > 14) return SCENES.DRINK;
  // Vertical / near-neutral → club portrait.
  return SCENES.CLUB;
}

export const SCENES = {
  CEILING: { id: 'ceiling', name: 'Ceiling',        caption: 'who turned on the lights' },
  SHOES:   { id: 'shoes',   name: 'Shoes',          caption: 'a study of the floor' },
  CLUB:    { id: 'club',    name: 'Club Portrait',  caption: 'someone you will text tomorrow' },
  WALL:    { id: 'wall',    name: 'Wall Accident',  caption: "stranger's shoulder, full focus" },
  BOOTH:   { id: 'booth',   name: 'DJ Booth',       caption: 'at least the lights are good' },
  SELFIE:  { id: 'selfie',  name: 'Selfie Miss',    caption: 'half a face, mostly forehead' },
  DRINK:   { id: 'drink',   name: 'Drink in Hand',  caption: 'ice. condensation. proof of life.' },
};
