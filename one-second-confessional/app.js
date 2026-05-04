// ES-module entry. imports the journey factory (which assigns itself to
// window for Alpine) and wires window.share for the share button.
import './journey.js';

window.share = async function share() {
  const url = window.location.href;
  const text = "the button has spoken. " + url;
  try {
    if (navigator.share) {
      await navigator.share({ title: '1-Second Confessional', text, url });
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
