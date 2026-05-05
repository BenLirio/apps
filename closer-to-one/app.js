// ES-module entry. imports the journey factory (which assigns itself to
// window for Alpine) and wires window.share for the share button.
import './journey.js';

window.share = async function share() {
  const url = window.location.href;
  const text = "I made the scoreboard. how close can you get to 1.000s? " + url;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Closer to 1.000', text, url });
      return;
    }
  } catch (_) { /* user cancelled or unsupported — fall through to clipboard */ }
  try {
    await navigator.clipboard.writeText(url);
    alert('share link copied to clipboard.');
  } catch (_) {
    prompt('copy this link:', url);
  }
};
