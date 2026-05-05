// loop.js — game state and round flow. The game logic, not the network.
//
// Round structure: 5 rounds total. No roles — each round is symmetric:
//   1. Both clients see the SAME prompt feeling (deterministic from roomCode+round).
//   2. Both clients independently compose 4 emojis from the 60-emoji palette.
//   3. Each client locks in by sending a `lock` state to the peer.
//   4. Once both clients hold both compositions, they compute the round score
//      (set overlap, 0..4) and advance to reveal.
// Total score: sum of round overlaps, range 0..20.
//
// Score authority: both clients run identical pure-function scoring on the
// SAME inputs (myComp, peerComp), so they always agree without any
// "authoritative" coordinator. Same pattern as the old game's deterministic
// truth derivation.

import { FEELINGS, pickPrompt, overlapScore, getPaletteForPrompt } from "./content.js";

export const TOTAL_ROUNDS = 5;
export const PALETTE_SLOTS = 4;
export const MAX_SCORE = TOTAL_ROUNDS * PALETTE_SLOTS; // 20

export class SyncGame {
  constructor(net) {
    this.net = net;
    this.round = 1;            // 1..TOTAL_ROUNDS
    this.score = 0;            // sum of round overlaps so far
    this.composition = [];     // my current composition (Array<emoji>, ≤4)
    this.locked = false;       // have I locked in this round?
    this.peerComposition = null; // peer's composition for this round (Array<emoji>) or null
    this.peerLocked = false;   // has the peer locked in?
    this.lastRoundOverlap = 0; // most recently scored round's overlap (for reveal)
    this.history = [];         // [{ round, prompt, mine, peer, overlap }]
    this.onChange = () => {};
    this.onRoundComplete = () => {};
    this.onGameComplete = () => {};
  }

  // Phase derived from local + peer lock state. UI uses this to pick the panel.
  //   compose  — I'm still picking
  //   waiting  — I've locked, peer hasn't
  //   reveal   — both locked, score computed, history written
  phase() {
    if (this.locked && this.peerLocked) return "reveal";
    if (this.locked) return "waiting";
    return "compose";
  }

  promptIndex(round = this.round) {
    return pickPrompt(this.net.roomCode, round);
  }

  promptText(round = this.round) {
    return FEELINGS[this.promptIndex(round)];
  }

  // Palette for the round's prompt — both clients derive it identically.
  palette(round = this.round) {
    return getPaletteForPrompt(this.promptIndex(round));
  }

  appendEmoji(emoji) {
    if (this.locked) return;
    if (this.composition.length >= PALETTE_SLOTS) return;
    this.composition.push(emoji);
    this.onChange();
  }

  popEmoji() {
    if (this.locked) return;
    if (this.composition.length === 0) return;
    this.composition.pop();
    this.onChange();
  }

  clearComposition() {
    if (this.locked) return;
    this.composition = [];
    this.onChange();
  }

  // Player taps LOCK IN.
  lockIn() {
    if (this.locked) return;
    if (this.composition.length !== PALETTE_SLOTS) return;
    this.locked = true;
    const emojis = this.composition.join("");
    this.net.sendState({ kind: "lock", round: this.round, emojis });
    this._maybeResolveRound();
    this.onChange();
  }

  // Peer locked in.
  onPeerLock(round, emojis) {
    if (round !== this.round) return; // ignore stale (e.g. after rematch)
    if (this.peerLocked) return;
    this.peerComposition = emojis; // string form; overlap helper handles it
    this.peerLocked = true;
    this._maybeResolveRound();
    this.onChange();
  }

  _maybeResolveRound() {
    if (!(this.locked && this.peerLocked)) return;
    const overlap = overlapScore(this.composition, this.peerComposition, this.palette());
    this.score += overlap;
    this.lastRoundOverlap = overlap;
    this.history.push({
      round: this.round,
      prompt: this.promptText(),
      mine: this.composition.slice(),
      peer: this.peerComposition,
      overlap
    });
    this.onRoundComplete();
  }

  // Move to the next round (or end the game). Both clients call this
  // independently when the user taps NEXT on the reveal screen.
  nextRound() {
    if (this.round >= TOTAL_ROUNDS) {
      this.onGameComplete();
      return;
    }
    this.round++;
    this.composition = [];
    this.locked = false;
    this.peerComposition = null;
    this.peerLocked = false;
    this.lastRoundOverlap = 0;
    this.onChange();
  }

  reset() {
    this.round = 1;
    this.score = 0;
    this.composition = [];
    this.locked = false;
    this.peerComposition = null;
    this.peerLocked = false;
    this.lastRoundOverlap = 0;
    this.history = [];
    this.onChange();
  }
}
