// Melody Guesser — Daily puzzle game using Web Audio API
// Aesthetic: Terminal/CRT

// ─── Note frequency table ───────────────────────────────────────────────────

const NOTE_FREQ = {
  C4: 261.63, Db4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63,
  F4: 349.23, Gb4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00,
  Bb4: 466.16, B4: 493.88,
  C5: 523.25, Db5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25,
  F5: 698.46, Gb5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00,
  Bb5: 932.33, B5: 987.77,
  C6: 1046.50,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
  A3: 220.00, B3: 246.94,
};

// ─── Song database (note, duration in beats at 120bpm) ──────────────────────

const SONGS = [
  {
    title: "Happy Birthday",
    notes: [
      {n:"C4",d:0.75},{n:"C4",d:0.25},{n:"D4",d:1},{n:"C4",d:1},{n:"F4",d:1},{n:"E4",d:2},
      {n:"C4",d:0.75},{n:"C4",d:0.25},{n:"D4",d:1},{n:"C4",d:1},{n:"G4",d:1},{n:"F4",d:2},
    ],
    options: ["Happy Birthday","Jingle Bells","Twinkle Twinkle","For He's a Jolly Good Fellow"],
  },
  {
    title: "Twinkle Twinkle Little Star",
    notes: [
      {n:"C4",d:1},{n:"C4",d:1},{n:"G4",d:1},{n:"G4",d:1},{n:"A4",d:1},{n:"A4",d:1},{n:"G4",d:2},
      {n:"F4",d:1},{n:"F4",d:1},{n:"E4",d:1},{n:"E4",d:1},{n:"D4",d:1},{n:"D4",d:1},{n:"C4",d:2},
    ],
    options: ["Twinkle Twinkle Little Star","Mary Had a Little Lamb","Baa Baa Black Sheep","ABC Song"],
  },
  {
    title: "Jingle Bells",
    notes: [
      {n:"E4",d:1},{n:"E4",d:1},{n:"E4",d:2},
      {n:"E4",d:1},{n:"E4",d:1},{n:"E4",d:2},
      {n:"E4",d:1},{n:"G4",d:1},{n:"C4",d:1},{n:"D4",d:1},{n:"E4",d:4},
    ],
    options: ["Jingle Bells","We Wish You a Merry Christmas","Deck the Halls","Silent Night"],
  },
  {
    title: "Ode to Joy",
    notes: [
      {n:"E4",d:1},{n:"E4",d:1},{n:"F4",d:1},{n:"G4",d:1},
      {n:"G4",d:1},{n:"F4",d:1},{n:"E4",d:1},{n:"D4",d:1},
      {n:"C4",d:1},{n:"C4",d:1},{n:"D4",d:1},{n:"E4",d:1},
      {n:"E4",d:1.5},{n:"D4",d:0.5},{n:"D4",d:2},
    ],
    options: ["Ode to Joy","Fur Elise","Moonlight Sonata","Canon in D"],
  },
  {
    title: "Mary Had a Little Lamb",
    notes: [
      {n:"E4",d:1},{n:"D4",d:1},{n:"C4",d:1},{n:"D4",d:1},
      {n:"E4",d:1},{n:"E4",d:1},{n:"E4",d:2},
      {n:"D4",d:1},{n:"D4",d:1},{n:"D4",d:2},
      {n:"E4",d:1},{n:"G4",d:1},{n:"G4",d:2},
    ],
    options: ["Mary Had a Little Lamb","Twinkle Twinkle Little Star","Row Your Boat","Hot Cross Buns"],
  },
  {
    title: "Fur Elise",
    notes: [
      {n:"E5",d:0.5},{n:"Eb5",d:0.5},{n:"E5",d:0.5},{n:"Eb5",d:0.5},{n:"E5",d:0.5},{n:"B4",d:0.5},{n:"D5",d:0.5},{n:"C5",d:0.5},
      {n:"A4",d:1},{n:"C4",d:0.5},{n:"E4",d:0.5},{n:"A4",d:0.5},{n:"B4",d:1},{n:"E4",d:0.5},{n:"Ab4",d:0.5},{n:"B4",d:0.5},
    ],
    options: ["Fur Elise","Ode to Joy","Moonlight Sonata","Clair de Lune"],
  },
  {
    title: "We Wish You a Merry Christmas",
    notes: [
      {n:"C4",d:1},{n:"F4",d:1},{n:"F4",d:0.75},{n:"G4",d:0.25},{n:"F4",d:0.5},{n:"E4",d:0.5},
      {n:"D4",d:1},{n:"D4",d:1},{n:"D4",d:1},
      {n:"G4",d:1},{n:"G4",d:0.75},{n:"A5",d:0.25},{n:"G5",d:0.5},{n:"F5",d:0.5},
      {n:"E4",d:1},{n:"C4",d:1},
    ],
    options: ["We Wish You a Merry Christmas","Jingle Bells","Deck the Halls","O Christmas Tree"],
  },
  {
    title: "Row Your Boat",
    notes: [
      {n:"C4",d:1},{n:"C4",d:1},{n:"C4",d:0.75},{n:"D4",d:0.25},{n:"E4",d:1},
      {n:"E4",d:0.75},{n:"D4",d:0.25},{n:"E4",d:0.75},{n:"F4",d:0.25},{n:"G4",d:2},
      {n:"C5",d:0.33},{n:"C5",d:0.33},{n:"C5",d:0.33},{n:"G4",d:0.33},{n:"G4",d:0.33},{n:"G4",d:0.33},{n:"E4",d:0.33},{n:"E4",d:0.33},{n:"E4",d:0.33},
      {n:"C4",d:0.33},{n:"C4",d:0.33},{n:"C4",d:0.33},
    ],
    options: ["Row Your Boat","Mary Had a Little Lamb","Twinkle Twinkle Little Star","Hot Cross Buns"],
  },
  {
    title: "Scarborough Fair",
    notes: [
      {n:"A3",d:1.5},{n:"C4",d:0.5},{n:"D4",d:1},{n:"D4",d:1},
      {n:"F4",d:1},{n:"E4",d:1},{n:"D4",d:2},
      {n:"C4",d:1},{n:"A3",d:2},
    ],
    options: ["Scarborough Fair","House of the Rising Sun","Greensleeves","Danny Boy"],
  },
  {
    title: "Greensleeves",
    notes: [
      {n:"A3",d:1},{n:"C4",d:1.5},{n:"D4",d:0.5},{n:"E4",d:1},{n:"G4",d:1.5},{n:"F4",d:0.5},
      {n:"E4",d:1},{n:"D4",d:1.5},{n:"B3",d:0.5},{n:"C4",d:1},{n:"A3",d:2},
    ],
    options: ["Greensleeves","Scarborough Fair","Danny Boy","Greensleeves"],
  },
  {
    title: "Canon in D",
    notes: [
      {n:"Gb4",d:1},{n:"E4",d:1},{n:"B3",d:1},{n:"Gb3",d:1},
      {n:"A3",d:1},{n:"E3",d:1},{n:"A3",d:1},{n:"B3",d:1},
    ],
    options: ["Canon in D","Clair de Lune","Air on a G String","Moonlight Sonata"],
  },
  {
    title: "Sakura Sakura",
    notes: [
      {n:"A4",d:1},{n:"A4",d:1},{n:"B4",d:2},
      {n:"A4",d:1},{n:"A4",d:1},{n:"B4",d:2},
      {n:"A4",d:1},{n:"G4",d:1},{n:"E4",d:1},{n:"G4",d:1},{n:"A4",d:3},
    ],
    options: ["Sakura Sakura","Kimi ga Yo","Moon Over the Ruined Castle","Hana"],
  },
  {
    title: "When the Saints Go Marching In",
    notes: [
      {n:"C4",d:1},{n:"E4",d:1},{n:"F4",d:1},{n:"G4",d:4},
      {n:"C4",d:1},{n:"E4",d:1},{n:"F4",d:1},{n:"G4",d:4},
    ],
    options: ["When the Saints Go Marching In","Oh Susanna","Camptown Races","My Old Kentucky Home"],
  },
  {
    title: "London Bridge",
    notes: [
      {n:"G4",d:1},{n:"A4",d:1},{n:"G4",d:1},{n:"F4",d:1},{n:"E4",d:1},{n:"F4",d:1},{n:"G4",d:2},
      {n:"D4",d:1},{n:"E4",d:1},{n:"F4",d:2},{n:"E4",d:1},{n:"F4",d:1},{n:"G4",d:2},
    ],
    options: ["London Bridge","Ring Around the Rosie","Jack and Jill","Humpty Dumpty"],
  },
  {
    title: "Silent Night",
    notes: [
      {n:"G4",d:1.5},{n:"A4",d:0.5},{n:"G4",d:1},{n:"E4",d:2},
      {n:"G4",d:1.5},{n:"A4",d:0.5},{n:"G4",d:1},{n:"E4",d:2},
      {n:"D5",d:2},{n:"D5",d:1},{n:"B4",d:3},
    ],
    options: ["Silent Night","O Holy Night","Away in a Manger","O Come All Ye Faithful"],
  },
];

// ─── Clip durations ──────────────────────────────────────────────────────────

const CLIP_DURATIONS = [0.5, 1, 2, 4, 8, 16]; // seconds
const CLIP_LABELS = [
  "Clip 1 of 6 — 0.5 seconds",
  "Clip 2 of 6 — 1 second",
  "Clip 3 of 6 — 2 seconds",
  "Clip 4 of 6 — 4 seconds",
  "Clip 5 of 6 — 8 seconds",
  "Clip 6 of 6 — 16 seconds",
];

// ─── Date seeding ────────────────────────────────────────────────────────────

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function seededIndex(key, length) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h) % length;
}

// ─── State ───────────────────────────────────────────────────────────────────

let audioCtx = null;
let currentSong = null;
let currentClipIndex = 0;
let guessResults = []; // 'correct' | 'wrong' | 'skip'
let isPlaying = false;
let shareText = '';

const STORAGE_KEY = 'melody-guesser-v1';

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function saveState(data) {
  const existing = loadState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
}

// ─── Audio engine ────────────────────────────────────────────────────────────

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function computeNoteTiming(notes, bpm) {
  // Returns array of {freq, start, duration} in seconds
  const beatDuration = 60 / bpm;
  let time = 0;
  return notes.map(({n, d}) => {
    const entry = { freq: NOTE_FREQ[n] || 440, start: time, duration: d * beatDuration };
    time += d * beatDuration;
    return entry;
  });
}

function totalMelodyDuration(notes, bpm) {
  return notes.reduce((acc, {d}) => acc + d, 0) * (60 / bpm);
}

function playMelody(song, clipDuration) {
  const ctx = getAudioCtx();
  const bpm = 120;
  const events = computeNoteTiming(song.notes, bpm);
  const loopLength = totalMelodyDuration(song.notes, bpm);

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.25, ctx.currentTime);

  // Fade out at end
  const fadeStart = Math.max(0, clipDuration - 0.15);
  masterGain.gain.setValueAtTime(0.25, ctx.currentTime + fadeStart);
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + clipDuration);

  masterGain.connect(ctx.destination);

  const playStart = ctx.currentTime + 0.05;
  let loopTime = 0;

  while (loopTime < clipDuration) {
    events.forEach(evt => {
      const noteStart = playStart + loopTime + evt.start;
      if (noteStart >= playStart + clipDuration) return;

      // Oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(evt.freq, noteStart);

      // Note envelope
      const noteGain = ctx.createGain();
      const attackEnd = noteStart + 0.02;
      const noteEnd = Math.min(noteStart + evt.duration * 0.85, playStart + clipDuration - 0.05);
      const releaseEnd = Math.min(noteStart + evt.duration, playStart + clipDuration);

      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(1, attackEnd);
      noteGain.gain.setValueAtTime(1, noteEnd);
      noteGain.gain.linearRampToValueAtTime(0, releaseEnd);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(releaseEnd + 0.01);
    });

    loopTime += loopLength;
    if (loopLength === 0) break;
  }

  return ctx.currentTime + clipDuration + 0.05;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function renderClipSteps() {
  const container = document.getElementById('clip-steps');
  container.innerHTML = '';
  CLIP_DURATIONS.forEach((_, i) => {
    const div = document.createElement('div');
    div.className = 'clip-step';
    if (i < currentClipIndex) {
      div.classList.add(guessResults[i] === 'correct' ? 'correct' : guessResults[i] === 'wrong' ? 'wrong' : 'played');
    } else if (i === currentClipIndex) {
      div.classList.add('current');
    }
    container.appendChild(div);
  });
  document.getElementById('clip-label').textContent = CLIP_LABELS[currentClipIndex] || '';
}

function renderOptions() {
  const container = document.getElementById('guess-options');
  container.innerHTML = '';
  currentSong.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'guess-option';
    btn.textContent = opt;
    btn.onclick = () => handleGuess(opt);
    container.appendChild(btn);
  });
}

function setPlayBtnState(playing) {
  const btn = document.getElementById('play-btn');
  const icon = btn.querySelector('.play-icon');
  const text = btn.querySelector('.play-text');
  if (playing) {
    btn.classList.add('playing');
    icon.textContent = '◼';
    text.textContent = 'Playing...';
    btn.disabled = true;
  } else {
    btn.classList.remove('playing');
    icon.textContent = '▶';
    text.textContent = 'Play Clip';
    btn.disabled = false;
  }
}

function buildEmojiGrid(results) {
  return results.map(r => {
    if (r === 'correct') return '🟩';
    if (r === 'wrong') return '🟥';
    return '⬜'; // skip
  }).join('');
}

function buildShareText(song, results) {
  const key = dateKey();
  const stored = loadState();
  const streak = stored.streak || 1;
  const correctClip = results.findIndex(r => r === 'correct');
  const clueCount = correctClip >= 0 ? correctClip + 1 : results.length;
  const grid = buildEmojiGrid(results);
  const won = correctClip >= 0;

  if (won) {
    return `🎵 Melody Guesser ${key}\nGot it in ${clueCount} ${clueCount === 1 ? 'clue' : 'clues'}! ${grid}\n🔥 Day ${streak} streak\nhttps://benlirio.com/melody-guesser/`;
  } else {
    return `🎵 Melody Guesser ${key}\nDidn't get it today ${grid}\nhttps://benlirio.com/melody-guesser/`;
  }
}

// ─── Countdown timer ─────────────────────────────────────────────────────────

function startCountdown(elementId) {
  function update() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById(elementId);
    if (el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  update();
  setInterval(update, 1000);
}

// ─── Game flow ───────────────────────────────────────────────────────────────

function showScreen(id) {
  ['intro-screen','game-screen','result-screen','played-screen'].forEach(sid => {
    document.getElementById(sid).style.display = sid === id ? '' : 'none';
  });
}

function startGame() {
  const key = dateKey();
  const songIndex = seededIndex(key, SONGS.length);
  currentSong = SONGS[songIndex];
  currentClipIndex = 0;
  guessResults = [];
  isPlaying = false;

  renderClipSteps();
  renderOptions();
  document.getElementById('skip-btn').style.display = '';
  document.getElementById('give-up-btn').style.display = '';
  setPlayBtnState(false);

  showScreen('game-screen');
}

function handlePlayClip() {
  if (isPlaying) return;
  isPlaying = true;
  setPlayBtnState(true);

  const clipDuration = CLIP_DURATIONS[currentClipIndex];
  let endTime;

  try {
    endTime = playMelody(currentSong, clipDuration);
  } catch (e) {
    // fallback: show message, still allow guessing
    console.error('Audio error:', e);
    isPlaying = false;
    setPlayBtnState(false);
    document.getElementById('loading-msg').style.display = '';
    document.getElementById('loading-msg').textContent = 'audio unavailable — use your memory!';
    return;
  }

  const ctx = getAudioCtx();
  const remaining = (endTime - ctx.currentTime) * 1000;

  setTimeout(() => {
    isPlaying = false;
    setPlayBtnState(false);
  }, remaining + 100);
}

function handleGuess(choice) {
  const correct = choice === currentSong.title;
  const result = correct ? 'correct' : 'wrong';
  guessResults.push(result);

  // Flash the selected button
  const btns = document.querySelectorAll('.guess-option');
  btns.forEach(btn => {
    if (btn.textContent === choice) {
      btn.classList.add(correct ? 'correct' : 'wrong');
    }
    btn.disabled = true;
  });

  setTimeout(() => {
    if (correct) {
      endGame(true);
    } else if (currentClipIndex >= CLIP_DURATIONS.length - 1) {
      // Last clip, wrong — game over
      endGame(false);
    } else {
      // Advance to next clip
      currentClipIndex++;
      renderClipSteps();
      renderOptions();
      setPlayBtnState(false);
    }
  }, 700);
}

function handleSkip() {
  guessResults.push('skip');
  if (currentClipIndex >= CLIP_DURATIONS.length - 1) {
    endGame(false);
    return;
  }
  currentClipIndex++;
  renderClipSteps();
  renderOptions();
}

function handleGiveUp() {
  while (guessResults.length < currentClipIndex) guessResults.push('skip');
  endGame(false);
}

function endGame(won) {
  // Pad results to current clip index
  while (guessResults.length <= currentClipIndex && !won) {
    if (guessResults.length === currentClipIndex && won === false) break;
    guessResults.push('skip');
  }

  const key = dateKey();
  const stored = loadState();
  const lastDate = stored.lastDate;
  let streak = stored.streak || 0;

  if (won) {
    // Check if streak continues
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    streak = (lastDate === yKey || lastDate === key) ? streak + (lastDate === key ? 0 : 1) : 1;
  } else {
    streak = 0;
  }

  const correctClip = guessResults.findIndex(r => r === 'correct');
  const clueCount = correctClip >= 0 ? correctClip + 1 : guessResults.length;

  saveState({
    lastDate: key,
    lastResult: won ? `Got it in ${clueCount} clue${clueCount !== 1 ? 's' : ''}` : `Didn't get it (${currentSong.title})`,
    lastGrid: buildEmojiGrid(guessResults),
    streak,
  });

  shareText = buildShareText(currentSong, guessResults);

  // Render result screen
  const statusEl = document.getElementById('result-status');
  const songEl = document.getElementById('result-song');
  const detailEl = document.getElementById('result-detail');
  const gridEl = document.getElementById('result-grid');

  if (won) {
    statusEl.textContent = `identified in ${clueCount} ${clueCount === 1 ? 'clue' : 'clues'} — signal locked`;
    statusEl.style.color = 'var(--green-ok)';
  } else {
    statusEl.textContent = 'signal lost — the melody was:';
    statusEl.style.color = 'var(--red-miss)';
  }

  songEl.textContent = currentSong.title;

  if (won && streak > 1) {
    detailEl.textContent = `${streak} days in a row. your ears are tuned.`;
  } else if (won) {
    detailEl.textContent = 'first of your streak. keep going tomorrow.';
  } else {
    detailEl.textContent = "don't worry — tomorrow's melody awaits.";
  }

  // Emoji grid
  gridEl.innerHTML = '';
  guessResults.forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.textContent = r === 'correct' ? '🟩' : r === 'wrong' ? '🟥' : '⬜';
    gridEl.appendChild(cell);
  });

  showScreen('result-screen');
  startCountdown('countdown');

  // Update streak display
  updateStreakDisplay(streak);
}

function updateStreakDisplay(streak) {
  const el = document.getElementById('streak-display');
  if (streak > 0) {
    el.innerHTML = `🔥 <span>${streak} day streak</span>`;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const key = dateKey();
  const stored = loadState();

  // Format date display
  const dateEl = document.getElementById('puzzle-date');
  if (dateEl) {
    const d = new Date();
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Update streak display on load
  const streak = stored.streak || 0;
  if (streak > 0) updateStreakDisplay(streak);

  // Check if already played today
  if (stored.lastDate === key) {
    // Show already-played screen
    document.getElementById('already-result').textContent = stored.lastResult || '';
    document.getElementById('already-grid').innerHTML = '';
    if (stored.lastGrid) {
      [...stored.lastGrid].forEach(ch => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.textContent = ch;
        document.getElementById('already-grid').appendChild(cell);
      });
    }

    // Reconstruct shareText from stored data
    const storedStreak = stored.streak || 0;
    const resultLine = stored.lastResult || '';
    shareText = `🎵 Melody Guesser ${key}\n${resultLine} ${stored.lastGrid || ''}\n🔥 Day ${storedStreak} streak\nhttps://benlirio.com/melody-guesser/`;

    showScreen('played-screen');
    startCountdown('countdown-played');
    return;
  }

  // Not played — show intro
  showScreen('intro-screen');

  document.getElementById('start-btn').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('play-btn').addEventListener('click', handlePlayClip);
  document.getElementById('skip-btn').addEventListener('click', handleSkip);
  document.getElementById('give-up-btn').addEventListener('click', handleGiveUp);
});

// ─── Share function ───────────────────────────────────────────────────────────

function share() {
  const text = shareText || `🎵 Melody Guesser\nhttps://benlirio.com/melody-guesser/`;
  if (navigator.share) {
    navigator.share({ title: 'Melody Guesser', text, url: 'https://benlirio.com/melody-guesser/' });
  } else {
    navigator.clipboard.writeText(text)
      .then(() => alert('Result copied to clipboard!'))
      .catch(() => alert(text));
  }
}
