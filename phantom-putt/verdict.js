// verdict.js — turn (strokes, par) into a NAMED identity (not a raw number),
// and turn the per-stroke distance trace into a Wordle-style emoji grid.
// Named verdicts are the difference between "share-card" and "score readout"
// — see knowledge-base/concepts/shareability-design.md.

export function verdictFor(strokes, par) {
  const delta = strokes - par;

  if (strokes === 1) return {
    name: "Inkstroke Wizard",
    line: "single line, dead center. did you ink that with a ruler?"
  };
  if (delta <= -2) return {
    name: "Crisp Pen Work",
    line: "two under par. the kind of stroke that earns a margin doodle."
  };
  if (delta === -1) return {
    name: "Slick Stroke",
    line: "one under par. quietly excellent."
  };
  if (delta === 0) return {
    name: "Standard Issue",
    line: "right on par. the page accepts you."
  };
  if (delta === 1) return {
    name: "Smudged but Solid",
    line: "one over. the ink ran a little but the line held."
  };
  if (delta === 2) return {
    name: "Wandering Doodler",
    line: "two over. you took the scenic route through the grid."
  };
  if (delta <= 4) return {
    name: "Margin Scribbler",
    line: `${delta} over par. that's not a stroke pattern, that's a sketch.`
  };
  if (delta <= 7) return {
    name: "Notebook Anarchist",
    line: `${delta} over par. the pen has its own opinions today.`
  };
  return {
    name: "Pencil Marathon",
    line: `${delta} over par. somewhere in there is a hole and you found it.`
  };
}

// Each stroke writes one cell. Distance covered during that motion-session
// determines which emoji — short tap, controlled roll, big charge, etc.
// Final cell is always the cup ⛳.
export function gridEmoji(strokeDistances) {
  const cells = strokeDistances.map((d, i) => {
    const isLast = i === strokeDistances.length - 1;
    if (isLast) return "⛳";
    if (d < 90) return "🟦";    // tiny tap
    if (d < 220) return "🟩";   // controlled roll
    if (d < 380) return "🟨";   // big charge
    return "🟥";                // off the chain
  });
  // Group in rows of 8 so phones don't soft-wrap awkwardly.
  const rows = [];
  for (let i = 0; i < cells.length; i += 8) {
    rows.push(cells.slice(i, i + 8).join(""));
  }
  return rows.join("\n");
}

export function shareText({ holeNum, holeName, par, strokes, verdict, grid }) {
  return [
    `Phantom Putt · Hole #${holeNum} — "${holeName}"`,
    `Par ${par} · I got ${strokes} (${verdict.name})`,
    grid,
    "",
    "https://benlirio.com/apps/phantom-putt/"
  ].join("\n");
}
