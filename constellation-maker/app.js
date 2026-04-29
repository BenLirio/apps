// All application JavaScript here

// ── Constellation name & myth data ──────────────────────────────────────────

const NAMES = [
  "Vel Aurantia", "Noctis Spina", "Cauda Mirae", "Ignis Excelsa",
  "Umbra Celeste", "Cor Sepulti", "Lyra Infernis", "Manus Aeterna",
  "Oculus Vagus", "Flos Glaciei", "Penna Mortis", "Anima Venti",
  "Turris Lunae", "Clavis Abyssi", "Porta Silens", "Crux Obscura",
  "Vena Aurea", "Fatum Peregri", "Lacus Soporis", "Signum Ignotum",
  "Dentes Noctis", "Petra Volantis", "Viscera Mundi", "Caelum Inversum",
  "Radius Perditus", "Pulsus Stellae", "Vertex Obitus", "Gemma Profundi",
  "Nebula Cordis", "Axis Ruinae", "Coma Draconis", "Vesper Exilii",
  "Sinus Mortalis", "Flamma Longa", "Iugum Tenebrae", "Arbor Caelestis",
  "Rivus Aureus", "Scutum Vacuum", "Vox Siderum", "Palma Incertae"
];

const MYTHS = [
  "They say it was drawn by a grieving cartographer who mapped the sky instead of the sea she'd lost.",
  "Ancient navigators refused to sail beneath this formation, believing it marked the exact edge of the knowable world.",
  "It appears only to those who have stood at a threshold and chosen not to cross.",
  "The first astronomer to chart it disappeared the following morning, leaving only a single burned page.",
  "Sailors called it the Quiet Pilot — it never guided them home, but it always told them how far they'd gone.",
  "It was once used as a clock by a civilization that measured time only in losses.",
  "Legend holds it was set in place by a god who needed somewhere to put their regret.",
  "Children in the old valley would count its stars before sleep, believing each one held an unspoken wish.",
  "It rises when the year is turning and the world hasn't yet decided what it wants to become.",
  "An old temple aligned its central hall with this formation — every solstice, light would pass through and illuminate nothing.",
  "The pattern was found scratched into a cave wall twenty thousand years before anyone knew to look up.",
  "Poets of the second age claimed it was the signature of whoever wrote the laws of physics.",
  "It moves imperceptibly, and those who track it say it is very slowly spelling something.",
  "When it appears directly overhead, fish swim in circles and birds refuse to migrate.",
  "A twin of this formation is rumored to exist on a planet no telescope has ever found.",
  "The formation is named in nineteen separate ancient languages, none of them related, all of them meaning the same thing.",
  "It was once used to settle a war — both sides claimed it as their patron, and neither could prove the other wrong.",
  "Astronomers who study it report strange calm — a sense that whatever they were worried about does not matter.",
  "It forms a perfect geometric ratio with the horizon at the exact moment between night and dawn.",
  "No two people who observe it agree on how many stars it contains.",
  "Its light, calculated backward, would have left its source before the Earth had cooled.",
  "Nomadic peoples navigated by it for millennia before realizing it was not fixed — it wanders.",
  "The pattern does not appear in any star chart before 1743, though the stars themselves are ancient.",
  "There is a grove where, on the right night, you can see all its stars reflected in a single still pond.",
  "It is said to be the eye of a creature so large that the rest of its body is on the other side of the universe.",
  "The oldest written record of it is a warning.",
  "Some believe it is not a constellation at all, but a message from a civilization leaving us behind.",
  "Its shape, projected onto the ground, matches the floorplan of a structure no one has been able to build.",
  "Children who grow up in its latitude tend to dream of oceans they have never seen.",
  "It has no official name in modern astronomy — too faint to measure, too persistent to ignore.",
  "The formation has been the subject of seventeen known paintings, none of which survive.",
  "A mathematician once proved it could not exist geometrically. It continued to exist.",
  "It appears in the last paragraph of a manuscript that ends mid-sentence.",
  "Those who navigate by it say it always brings them somewhere true, if not somewhere expected.",
  "It was the last thing a famous explorer wrote about before their journal goes blank.",
  "The pattern repeats itself in the growth rings of a tree found only at high altitude.",
  "No one knows who named it first. The name appears, fully formed, in records from three separate continents.",
  "On certain nights the stars that form it seem closer than they should, as if leaning in.",
  "It is the only formation that cannot be seen from the equator, and cannot be missed from either pole.",
  "When the season turns, it rises as if it had been waiting just out of sight all along."
];

// ── Hash function ────────────────────────────────────────────────────────────

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function geometryKey(stars, lines) {
  if (stars.length === 0) return "empty";
  // Compute centroid, arm count approx, density
  const cx = stars.reduce((s, p) => s + p.x, 0) / stars.length;
  const cy = stars.reduce((s, p) => s + p.y, 0) / stars.length;
  const cxRatio = Math.round((cx / window.innerWidth) * 10);
  const cyRatio = Math.round((cy / window.innerHeight) * 10);
  const nStars = stars.length;
  const nLines = lines.length;
  // Arm count approximation: degree of each node
  const degree = {};
  lines.forEach(([a, b]) => {
    degree[a] = (degree[a] || 0) + 1;
    degree[b] = (degree[b] || 0) + 1;
  });
  const endpoints = Object.values(degree).filter(d => d === 1).length;
  return `${nStars}:${nLines}:${cxRatio}:${cyRatio}:${endpoints}`;
}

// ── p5.js sketch ─────────────────────────────────────────────────────────────

let userStars = [];   // [{x, y}]
let lines = [];       // [[indexA, indexB]]
let bgStars = [];     // [{x, y, r, alpha}]
let mode = "place";   // "place" | "connect"
let selected = -1;
let errorTimer = null;
let canvasRef = null;

const sketch = (p) => {

  p.setup = () => {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
    canvasRef = cnv;
    p.colorMode(p.RGB);
    generateBgStars(p);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    generateBgStars(p);
  };

  p.draw = () => {
    p.background(10, 10, 26);

    // Faint grain via noise overlay
    p.loadPixels();
    for (let x = 0; x < p.width; x += 4) {
      for (let y = 0; y < p.height; y += 4) {
        const n = p.noise(x * 0.008, y * 0.008, p.frameCount * 0.002);
        const idx = (x + y * p.width) * 4;
        const grain = (n - 0.5) * 12;
        p.pixels[idx]   = p.constrain(10 + grain, 0, 255);
        p.pixels[idx+1] = p.constrain(10 + grain, 0, 255);
        p.pixels[idx+2] = p.constrain(26 + grain, 0, 255);
        p.pixels[idx+3] = 255;
      }
    }
    p.updatePixels();

    // Background stars
    bgStars.forEach(s => {
      p.noStroke();
      p.fill(255, 255, 255, s.alpha + Math.sin(p.frameCount * s.flicker) * 15);
      p.ellipse(s.x, s.y, s.r, s.r);
    });

    // User lines
    p.strokeWeight(1.2);
    lines.forEach(([a, b]) => {
      const sa = userStars[a], sb = userStars[b];
      p.stroke(212, 184, 150, 140);
      p.line(sa.x, sa.y, sb.x, sb.y);
    });

    // Line being drawn (in connect mode, selected star to mouse)
    if (mode === "connect" && selected !== -1) {
      const s = userStars[selected];
      p.stroke(245, 217, 139, 80);
      p.strokeWeight(1);
      p.line(s.x, s.y, p.mouseX, p.mouseY);
    }

    // User-placed stars
    userStars.forEach((s, i) => {
      const isSelected = i === selected;
      const nearMouse = mode === "connect" && p.dist(p.mouseX, p.mouseY, s.x, s.y) < 22;

      // Outer glow
      const glowAlpha = isSelected ? 70 : (nearMouse ? 50 : 30);
      const glowR = isSelected ? 28 : 22;
      p.noStroke();
      p.fill(245, 217, 139, glowAlpha);
      p.ellipse(s.x, s.y, glowR * 2, glowR * 2);

      // Mid glow
      p.fill(255, 240, 180, isSelected ? 120 : 80);
      p.ellipse(s.x, s.y, 14, 14);

      // Core
      p.fill(255, 250, 220);
      p.ellipse(s.x, s.y, 6, 6);
    });
  };

  p.mousePressed = () => {
    // Ignore if overlays are showing
    if (document.getElementById("result-overlay").style.display !== "none") return;
    if (document.getElementById("loading-overlay").style.display !== "none") return;
    // Ignore clicks on UI controls
    if (p.mouseY > p.height - 70) return;

    if (mode === "place") {
      userStars.push({ x: p.mouseX, y: p.mouseY });
      if (userStars.length === 1) {
        document.getElementById("intro-text").classList.add("hidden");
      }
    } else {
      // Connect mode: find nearest user star within 30px
      let nearest = -1, nearDist = 30;
      userStars.forEach((s, i) => {
        const d = p.dist(p.mouseX, p.mouseY, s.x, s.y);
        if (d < nearDist) { nearDist = d; nearest = i; }
      });

      if (nearest === -1) {
        // Clicked empty space — deselect
        selected = -1;
      } else if (selected === -1) {
        selected = nearest;
      } else if (selected === nearest) {
        selected = -1;
      } else {
        // Draw line if not duplicate
        const exists = lines.some(([a, b]) =>
          (a === selected && b === nearest) || (a === nearest && b === selected));
        if (!exists) lines.push([selected, nearest]);
        selected = nearest; // keep second star selected for chaining
      }
    }
  };

  p.touchStarted = () => {
    p.mousePressed();
    return false;
  };
};

function generateBgStars(p) {
  bgStars = [];
  for (let i = 0; i < 220; i++) {
    bgStars.push({
      x: p.random(p.width),
      y: p.random(p.height),
      r: p.random(0.6, 2.2),
      alpha: p.random(30, 110),
      flicker: p.random(0.005, 0.025)
    });
  }
}

// ── UI functions ─────────────────────────────────────────────────────────────

function toggleMode() {
  mode = mode === "place" ? "connect" : "place";
  selected = -1;
  const btn = document.getElementById("mode-toggle");
  if (mode === "connect") {
    btn.textContent = "place stars";
    btn.classList.add("active");
  } else {
    btn.textContent = "connect stars";
    btn.classList.remove("active");
  }
}

function nameit() {
  if (userStars.length < 3) {
    showError();
    return;
  }

  // Show loading for 800ms
  const loadingEl = document.getElementById("loading-overlay");
  loadingEl.style.display = "flex";

  setTimeout(() => {
    loadingEl.style.display = "none";
    showResult();
  }, 800);
}

function showResult() {
  const key = geometryKey(userStars, lines);
  const h = hash(key);
  const name = NAMES[h % NAMES.length];
  const myth = MYTHS[(h * 31 + 7) % MYTHS.length];
  const n = userStars.length;

  document.getElementById("constellation-name").textContent = name;
  document.getElementById("star-count-line").textContent =
    `your ${n}-star formation has been recognized by the cosmos`;
  document.getElementById("myth-text").textContent = myth;

  document.getElementById("result-overlay").style.display = "flex";
}

function closeResult() {
  document.getElementById("result-overlay").style.display = "none";
}

function showError() {
  const el = document.getElementById("error-msg");
  el.style.display = "block";
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    el.style.display = "none";
  }, 2600);
}

function clearAll() {
  userStars = [];
  lines = [];
  selected = -1;
  mode = "place";
  const btn = document.getElementById("mode-toggle");
  btn.textContent = "connect stars";
  btn.classList.remove("active");
  document.getElementById("intro-text").classList.remove("hidden");
  document.getElementById("result-overlay").style.display = "none";
}

function saveConstellation() {
  // Use p5's saveCanvas — it saves the current canvas frame
  // We'll grab the canvas element directly
  const cnv = document.querySelector("canvas");
  if (!cnv) return;

  // Draw result text onto a temporary canvas on top
  const tmp = document.createElement("canvas");
  tmp.width = cnv.width;
  tmp.height = cnv.height;
  const ctx = tmp.getContext("2d");

  // Copy the p5 canvas
  ctx.drawImage(cnv, 0, 0);

  // Overlay dark vignette for legibility
  ctx.fillStyle = "rgba(6, 6, 18, 0.55)";
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  // Re-draw stars and lines on the export canvas for clarity
  // (they're already in the p5 canvas — just overlay the text)
  const name = document.getElementById("constellation-name").textContent;
  const myth = document.getElementById("myth-text").textContent;
  const countLine = document.getElementById("star-count-line").textContent;

  const cx = tmp.width / 2;
  const cy = tmp.height / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5d98b";
  ctx.font = `300 ${Math.min(56, tmp.width * 0.1)}px 'Cormorant Garamond', Georgia, serif`;
  ctx.fillText(name, cx, cy - 40);

  ctx.fillStyle = "rgba(212,184,150,0.65)";
  ctx.font = `400 ${Math.min(18, tmp.width * 0.034)}px 'Cormorant Garamond', Georgia, serif`;
  ctx.fillText(countLine, cx, cy);

  // Myth — wrap text
  ctx.fillStyle = "#c8aa80";
  ctx.font = `italic 300 ${Math.min(20, tmp.width * 0.038)}px 'Cormorant Garamond', Georgia, serif`;
  wrapText(ctx, myth, cx, cy + 34, tmp.width * 0.75, 30);

  // Watermark
  ctx.fillStyle = "rgba(212,184,150,0.3)";
  ctx.font = `300 14px 'Cormorant Garamond', Georgia, serif`;
  ctx.fillText("constellation maker", cx, tmp.height - 22);

  const link = document.createElement("a");
  link.download = `${name.replace(/ /g, "-").toLowerCase()}.png`;
  link.href = tmp.toDataURL("image/png");
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, lineY);
      line = words[i] + " ";
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, lineY);
}

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

new p5(sketch);
