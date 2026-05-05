// loop.js — game state, round flow, render. The game itself, not the network.
//
// Round structure: 10 rounds total. Sender and receiver alternate strictly:
//   round 1, 3, 5, 7, 9  → host sends, guest receives
//   round 2, 4, 6, 8, 10 → guest sends, host receives
// Score is correct guesses across all 10 transmissions, 0..10.

import { FEELINGS, PALETTE, pickRoundTiles, pickTruth } from "./content.js";

export const TOTAL_ROUNDS = 10;
export const PALETTE_SLOTS = 4;

export class TelephoneGame {
  constructor(net) {
    this.net = net;
    this.round = 1;          // 1..TOTAL_ROUNDS
    this.score = 0;          // correct guesses so far
    this.composition = [];   // sender's current emoji composition (≤4)
    this.lastEmojis = null;  // last received transmission (for receiver)
    this.choiceTiles = null; // 8 feeling indices, shuffled (for receiver)
    this.lastTruthIndex = null;
    this.lastReceiverGuess = null; // { choice, correct } once receiver picks
    this.phase = "compose";  // compose | sent | guessed | between
    this.history = [];       // [{ round, role, truthIndex, emojis, guessIndex, correct }]
    this.onChange = () => {};
    this.onRoundComplete = () => {};
    this.onGameComplete = () => {};
  }

  myRoleThisRound(round = this.round) {
    // odd rounds → host sends, guest receives
    const hostSends = (round % 2) === 1;
    if (this.net.role === "host") return hostSends ? "sender" : "receiver";
    return hostSends ? "receiver" : "sender";
  }

  truthIndex(round = this.round) {
    return pickTruth(this.net.roomCode, round);
  }

  truthFeeling(round = this.round) {
    return FEELINGS[this.truthIndex(round)];
  }

  // sender: tap an emoji in the palette to add to composition.
  appendEmoji(idx) {
    if (this.myRoleThisRound() !== "sender") return;
    if (this.phase !== "compose") return;
    if (this.composition.length >= PALETTE_SLOTS) return;
    this.composition.push(PALETTE[idx]);
    this.onChange();
  }

  popEmoji() {
    if (this.myRoleThisRound() !== "sender") return;
    if (this.phase !== "compose") return;
    if (this.composition.length === 0) return;
    this.composition.pop();
    this.onChange();
  }

  clearComposition() {
    if (this.myRoleThisRound() !== "sender") return;
    if (this.phase !== "compose") return;
    this.composition = [];
    this.onChange();
  }

  // Sender presses TRANSMIT. Sends the 4-emoji string to the peer.
  transmit() {
    if (this.myRoleThisRound() !== "sender") return;
    if (this.phase !== "compose") return;
    if (this.composition.length !== PALETTE_SLOTS) return;
    const emojis = this.composition.join("");
    this.net.sendState({ kind: "transmission", round: this.round, emojis });
    this.phase = "sent";
    this.onChange();
  }

  // Receiver gets the transmission from the peer. Build the 8-tile choice
  // set deterministically from (roomCode, round) so both clients render the
  // same shuffle (debug + sender's "post-reveal" view shows the same tiles).
  onTransmission(round, emojis) {
    if (round !== this.round) return; // ignore stale
    if (this.myRoleThisRound() !== "receiver") return;
    this.lastEmojis = emojis;
    const truth = this.truthIndex(round);
    this.lastTruthIndex = truth;
    this.choiceTiles = pickRoundTiles(
      // include round so each round's shuffle is unique
      ((this.hashCode(this.net.roomCode) ^ round) >>> 0),
      truth
    );
    this.phase = "compose"; // receiver "composes" their guess
    this.onChange();
  }

  hashCode(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // Receiver picks one of the 8 tiles.
  guessTile(feelingIndex) {
    if (this.myRoleThisRound() !== "receiver") return;
    if (this.phase !== "compose") return;
    if (this.lastTruthIndex === null) return;
    const correct = feelingIndex === this.lastTruthIndex;
    this.lastReceiverGuess = { choice: feelingIndex, correct };
    if (correct) this.score++;
    this.history.push({
      round: this.round,
      role: "receiver",
      truthIndex: this.lastTruthIndex,
      emojis: this.lastEmojis,
      guessIndex: feelingIndex,
      correct
    });
    // Tell the sender the result so they see the reveal too.
    this.net.sendState({
      kind: "guess",
      round: this.round,
      choice: feelingIndex,
      correct
    });
    this.phase = "guessed";
    this.onChange();
    this.onRoundComplete();
  }

  // Sender receives the guess result.
  onPeerGuess(round, choice, correct) {
    if (round !== this.round) return;
    if (this.myRoleThisRound() !== "sender") return;
    this.lastTruthIndex = this.truthIndex(round);
    this.lastReceiverGuess = { choice, correct };
    if (correct) this.score++;
    this.history.push({
      round: this.round,
      role: "sender",
      truthIndex: this.lastTruthIndex,
      emojis: this.composition.join(""),
      guessIndex: choice,
      correct
    });
    this.phase = "guessed";
    this.onChange();
    this.onRoundComplete();
  }

  nextRound() {
    if (this.round >= TOTAL_ROUNDS) {
      this.onGameComplete();
      return;
    }
    this.round++;
    this.composition = [];
    this.lastEmojis = null;
    this.choiceTiles = null;
    this.lastTruthIndex = null;
    this.lastReceiverGuess = null;
    this.phase = "compose";
    this.onChange();
  }

  reset() {
    this.round = 1;
    this.score = 0;
    this.composition = [];
    this.lastEmojis = null;
    this.choiceTiles = null;
    this.lastTruthIndex = null;
    this.lastReceiverGuess = null;
    this.phase = "compose";
    this.history = [];
    this.onChange();
  }
}
