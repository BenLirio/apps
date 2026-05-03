// app.js — entry point. ES module scope means inline onclick="share()" can't
// see a module-local variable, so we explicitly assign window.share. Then
// hand off to loop.js (the imperative state machine for camera modes).

import { startCamera, getLastShot } from './loop.js';

window.share = async function share() {
  const shot = getLastShot();
  if (!shot) return;
  const url = location.origin + location.pathname;
  const text = `direct flash · ${shot.sceneName.toLowerCase()} · iso 1600 — ${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Direct Flash', text, url });
      return;
    }
  } catch (e) { /* user-cancelled / no permission — fall through */ }
  try {
    await navigator.clipboard.writeText(text);
    flashShareButton('LINK COPIED');
  } catch (e) {
    flashShareButton('COPY FAILED');
  }
};

function flashShareButton(label) {
  const btn = document.getElementById('btn-share');
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = prev; }, 1400);
}

// Best-on-mobile hint for desktop visitors. We default-show only on no-touch
// devices so phones never see the banner.
(function maybeShowDesktopHints() {
  const noCoarse = !window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (noCoarse) {
    document.getElementById('best-on-mobile')?.removeAttribute('hidden');
    document.getElementById('desktop-hint')?.removeAttribute('hidden');
  }
})();

startCamera();
