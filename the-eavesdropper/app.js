/* app.js — ES-module entry point. Module scope means inline onclick=""
 * handlers don't see imported names; we explicitly attach window.share
 * and window.restart so the buttons in index.html find them. */

import { renderSeatPicker, shareLetter, restartJourney } from './journey.js';

window.share = shareLetter;
window.restart = restartJourney;

renderSeatPicker();
