// The dim overlay-with-message that appears on top of the canvas. Shown
// on first load and on reset; hidden as soon as the user starts painting.

export function showOverlay(msg) {
  const el = document.getElementById('overlay-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

export function hideOverlay() {
  const el = document.getElementById('overlay-msg');
  if (el) el.classList.add('hidden');
}
