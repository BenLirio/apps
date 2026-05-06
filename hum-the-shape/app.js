/* app.js — entry point.
 * Wires window.share for the inline onclick on the share button, then
 * starts the rAF loop. Kept tiny on purpose; everything else lives in
 * loop.js (state + render) and audio.js (pitch detection + DTW + shapes).
 */
import { startLoop, shareResult } from "./loop.js";

window.share = shareResult;
startLoop();
