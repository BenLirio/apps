// controls.js — translate phone tilt (or desktop input) into a 2D gravity
// vector the physics loop reads each frame. Uses the *one-step metaphor*
// rule: the player tilts and the BALL accelerates — no intermediate world
// state to mentally simulate.
//
// Calibration: on start(), capture a neutral pose. Subsequent gravity is
// the delta from that pose, so however the player wants to hold the phone
// IS flat. This is mandatory — see knowledge-base/concepts/device-orientation-controls.md.

const TILT_SCALE = 0.075;   // (deg) → world gravity units
const KEY_GRAVITY = 0.55;   // arrow-key push strength
const DRAG_SCALE = 0.012;   // mouse-drag distance → gravity

export class TiltControls {
  constructor() {
    this.gravity = { x: 0, y: 0 };
    this.mode = "none";          // "tilt" | "key" | "drag" | "none"
    this.calibrated = false;
    this.beta0 = 0;
    this.gamma0 = 0;
    this.keys = { up: 0, down: 0, left: 0, right: 0 };
    this.dragOrigin = null;      // {x, y} during a desktop drag
    this.dragNow = null;
    this.handlers = [];          // for cleanup if needed
  }

  // Return true if device exposes orientation. iOS 13+ needs a permission
  // prompt — the caller must invoke from a real user gesture.
  static hasOrientation() {
    return typeof window !== "undefined"
      && typeof window.DeviceOrientationEvent !== "undefined";
  }

  static iOSNeedsPermission() {
    return typeof DeviceOrientationEvent !== "undefined"
      && typeof DeviceOrientationEvent.requestPermission === "function";
  }

  // Try to attach orientation. Returns "ok" | "denied" | "unsupported".
  // Must be called from a user-gesture handler on iOS.
  async attachOrientation() {
    if (!TiltControls.hasOrientation()) return "unsupported";

    if (TiltControls.iOSNeedsPermission()) {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return "denied";
      } catch (e) {
        return "denied";
      }
    }

    const onOrient = (e) => {
      // beta = front-back tilt (-180..180), gamma = left-right (-90..90)
      // Some browsers fire null on start — ignore until we have real numbers.
      if (e.beta == null || e.gamma == null) return;
      if (!this.calibrated) {
        this.beta0 = e.beta;
        this.gamma0 = e.gamma;
        this.calibrated = true;
      }
      const dBeta = e.beta - this.beta0;
      const dGamma = e.gamma - this.gamma0;
      // tilt FORWARD (top edge away) → beta increases → ball rolls DOWN screen
      // tilt RIGHT (right edge down) → gamma increases → ball rolls RIGHT
      this.gravity.x = clamp(dGamma * TILT_SCALE, -1.4, 1.4);
      this.gravity.y = clamp(dBeta * TILT_SCALE, -1.4, 1.4);
    };

    window.addEventListener("deviceorientation", onOrient, true);
    this.handlers.push(["deviceorientation", onOrient]);
    this.mode = "tilt";
    return "ok";
  }

  // Recalibrate to the current pose. Useful as a "reset zero" mid-game.
  recalibrate() { this.calibrated = false; }

  // Desktop fallback: arrow keys (continuous push) and click-drag on the
  // board (drag direction = gravity direction).
  attachDesktop(boardEl) {
    const keymap = {
      "ArrowUp": "up", "KeyW": "up",
      "ArrowDown": "down", "KeyS": "down",
      "ArrowLeft": "left", "KeyA": "left",
      "ArrowRight": "right", "KeyD": "right",
    };

    const onKeyDown = (e) => {
      const k = keymap[e.code];
      if (!k) return;
      this.keys[k] = 1;
      this._updateKeyGravity();
      if (this.mode !== "tilt") this.mode = "key";
      e.preventDefault();
    };
    const onKeyUp = (e) => {
      const k = keymap[e.code];
      if (!k) return;
      this.keys[k] = 0;
      this._updateKeyGravity();
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.handlers.push(["keydown", onKeyDown], ["keyup", onKeyUp]);

    // Pointer-drag fallback on the board itself.
    const onDown = (e) => {
      if (this.mode === "tilt") return; // don't fight tilt
      this.dragOrigin = { x: e.clientX, y: e.clientY };
      this.dragNow = { x: e.clientX, y: e.clientY };
      this.mode = "drag";
      boardEl.setPointerCapture && boardEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!this.dragOrigin) return;
      this.dragNow = { x: e.clientX, y: e.clientY };
      this._updateDragGravity();
      e.preventDefault();
    };
    const onUp = (e) => {
      this.dragOrigin = null;
      this.dragNow = null;
      this.gravity.x = 0;
      this.gravity.y = 0;
      if (this.mode === "drag") this.mode = "key";
      try { boardEl.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    boardEl.addEventListener("pointerdown", onDown);
    boardEl.addEventListener("pointermove", onMove);
    boardEl.addEventListener("pointerup", onUp);
    boardEl.addEventListener("pointercancel", onUp);
  }

  _updateKeyGravity() {
    // Tilt always wins if it's active; arrow keys only fill in otherwise.
    if (this.mode === "tilt") return;
    const x = (this.keys.right - this.keys.left) * KEY_GRAVITY;
    const y = (this.keys.down - this.keys.up) * KEY_GRAVITY;
    this.gravity.x = x;
    this.gravity.y = y;
  }

  _updateDragGravity() {
    if (!this.dragOrigin || !this.dragNow) return;
    const dx = (this.dragNow.x - this.dragOrigin.x) * DRAG_SCALE;
    const dy = (this.dragNow.y - this.dragOrigin.y) * DRAG_SCALE;
    this.gravity.x = clamp(dx, -1.4, 1.4);
    this.gravity.y = clamp(dy, -1.4, 1.4);
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
