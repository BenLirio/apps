// controls.js — input adapter. Owns:
//   - DeviceOrientationEvent listening + iOS 13+ permission gate
//   - Pose-zero calibration (capture the user's neutral grip; do not feed raw beta)
//   - Desktop / no-orientation fallback (pointermove → reticle)
//   - A unified read(): { x, y } in [-1, +1] each axis, smoothed.
//
// One-step metaphor: tilt → reticle position. No intermediate physics variable.
// gamma  (left/right tilt, ±90°) → x.   Roll-as-yoke maps directly to lateral.
// beta   (forward/back tilt, ±180°) → y. Pitch the nose up = climb.

const RAD = Math.PI / 180;

export function createInput() {
  const state = {
    mode: 'idle',            // idle | orientation | pointer
    granted: false,
    have: false,             // have we received any orientation event?
    pose0: { beta: 0, gamma: 0 }, // calibrated neutral
    rawBeta: 0,
    rawGamma: 0,
    targetX: 0, targetY: 0,  // smoothed, in [-1,1]
    rawX: 0, rawY: 0,
    pointerActive: false,
    pointerX: 0, pointerY: 0, // in [-1,1]
    rect: null,
  };

  // --- orientation handler ---
  function onOri(e) {
    if (e.beta == null || e.gamma == null) return;
    state.have = true;
    state.rawBeta = e.beta;
    state.rawGamma = e.gamma;
  }

  // --- pointer handler (desktop fallback) ---
  function onPointer(e) {
    if (!state.rect) return;
    const r = state.rect;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    state.pointerX = clamp(((e.clientX - cx) / (r.width / 2)) * 1.0, -1, 1);
    state.pointerY = clamp(((e.clientY - cy) / (r.height / 2)) * 1.0, -1, 1);
    state.pointerActive = true;
  }

  function onKey(e) {
    // arrow / WASD nudges the desktop reticle if no mouse activity yet
    const step = 0.08;
    if (e.key === 'ArrowLeft' || e.key === 'a') { state.pointerX -= step; state.pointerActive = true; }
    if (e.key === 'ArrowRight'|| e.key === 'd') { state.pointerX += step; state.pointerActive = true; }
    if (e.key === 'ArrowUp'   || e.key === 'w') { state.pointerY -= step; state.pointerActive = true; }
    if (e.key === 'ArrowDown' || e.key === 's') { state.pointerY += step; state.pointerActive = true; }
    state.pointerX = clamp(state.pointerX, -1, 1);
    state.pointerY = clamp(state.pointerY, -1, 1);
  }

  function attachOrientationListener() {
    window.addEventListener('deviceorientation', onOri, true);
  }

  // --- public API ---

  // requestOrientation: returns true if granted (and so far has fired at least
  // one event), false if denied or unsupported. Caller should fall back to
  // pointer mode in that case.
  async function requestOrientation() {
    // iOS 13+ — permission must be requested from a user gesture.
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      try {
        const res = await D.requestPermission();
        if (res === 'granted') {
          state.granted = true;
          attachOrientationListener();
        } else {
          return false;
        }
      } catch (_e) {
        return false;
      }
    } else if ('DeviceOrientationEvent' in window) {
      // Android / desktop with sensors. No permission needed.
      attachOrientationListener();
      state.granted = true;
    } else {
      return false;
    }
    // wait briefly to see if any event arrives — if not, treat as desktop
    return await new Promise(resolve => {
      const t0 = performance.now();
      const tick = () => {
        if (state.have) return resolve(true);
        if (performance.now() - t0 > 700) return resolve(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // calibrate: take the current sensor pose as the neutral / level pose.
  function calibrate() {
    if (state.have) {
      state.pose0.beta = state.rawBeta;
      state.pose0.gamma = state.rawGamma;
      state.mode = 'orientation';
    } else {
      state.mode = 'pointer';
    }
    state.targetX = state.targetY = 0;
    state.rawX = state.rawY = 0;
  }

  function attachPointer(canvas) {
    state.rect = canvas.getBoundingClientRect();
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('resize', () => {
      state.rect = canvas.getBoundingClientRect();
    });
    canvas.addEventListener('touchmove', e => {
      // for users on a touchscreen who denied tilt — let them drag-aim
      const t = e.touches[0];
      if (t) onPointer({ clientX: t.clientX, clientY: t.clientY });
      e.preventDefault();
    }, { passive: false });
  }

  // tick: call every frame with dt in seconds; returns { x, y } in [-1,1]
  function tick(dt) {
    let rx = 0, ry = 0;

    if (state.mode === 'orientation' && state.have) {
      // gamma: ± lateral. Sensitivity ~30° = full deflection.
      // beta:  ± pitch.   Sensitivity ~25° = full deflection.
      const gx = (state.rawGamma - state.pose0.gamma) / 28;
      const gy = (state.rawBeta  - state.pose0.beta)  / 22;
      rx = clamp(gx, -1, 1);
      ry = clamp(gy, -1, 1);
    } else {
      // pointer / desktop fallback
      rx = state.pointerX;
      ry = state.pointerY;
    }

    state.rawX = rx;
    state.rawY = ry;

    // Smooth toward raw — first-order lag, ~80ms time constant.
    const k = 1 - Math.exp(-dt / 0.08);
    state.targetX += (rx - state.targetX) * k;
    state.targetY += (ry - state.targetY) * k;

    return { x: state.targetX, y: state.targetY, rawX: rx, rawY: ry, mode: state.mode };
  }

  function getMode() { return state.mode; }

  return {
    requestOrientation,
    calibrate,
    attachPointer,
    tick,
    getMode,
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
