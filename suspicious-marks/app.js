// Department of Suspicious Marks
// Pure deterministic mock-bureaucratic affidavit. No LLM. The geometric
// measurements of the user's drawing are quoted verbatim into the document
// so the input -> output causality is legible at the point of interaction.

(function () {
  "use strict";

  /* ========================================================================
   * CANVAS SETUP
   * ====================================================================== */

  var canvas = document.getElementById("pad");
  var ctx = canvas.getContext("2d");
  var frame = canvas.parentElement;
  var emptyHint = document.getElementById("canvas-empty");
  var editToggle = document.getElementById("edit-toggle");
  var clearBtn = document.getElementById("clear-btn");
  var submitBtn = document.getElementById("submit-btn");
  var redrawBtn = document.getElementById("redraw-btn");
  var intakePane = document.getElementById("intake");
  var affidavitPane = document.getElementById("affidavit");

  // Logical drawing space — we always draw in 600x600 logical units; CSS scales.
  var W = 600, H = 600;

  // Edit-mode default: OFF on touch-primary, ON on desktop.
  var isTouchPrimary = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  var editing = !isTouchPrimary;

  var strokes = [];      // [[ {x,y}, ... ], ...]
  var current = null;    // currently-being-drawn stroke
  var pointerActive = false;

  function sizeCanvasBuffer() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = Math.max(1, Math.round(rect.width));
    var cssH = Math.max(1, Math.round(rect.height));
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    // We render in logical 600-unit space; map logical -> device pixels.
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    redraw();
  }

  // Run sizing after first layout to avoid pre-layout-stretch race.
  requestAnimationFrame(sizeCanvasBuffer);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(sizeCanvasBuffer).observe(frame);
  } else {
    window.addEventListener("resize", sizeCanvasBuffer);
  }

  function redraw() {
    ctx.save();
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#1c1812";
    ctx.lineWidth = 4.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < strokes.length; i++) {
      drawStroke(strokes[i]);
    }
    if (current && current.length > 0) drawStroke(current);
    ctx.restore();
  }

  function drawStroke(pts) {
    if (pts.length === 0) return;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "#1c1812";
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  function pointFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var src = e.touches && e.touches[0] ? e.touches[0] : e;
    var x = (src.clientX - rect.left) * (W / rect.width);
    var y = (src.clientY - rect.top) * (H / rect.height);
    return { x: clamp(x, 0, W), y: clamp(y, 0, H) };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function startStroke(p) {
    current = [p];
    pointerActive = true;
    frame.classList.add("has-marks");
    redraw();
  }

  function extendStroke(p) {
    if (!current) return;
    var last = current[current.length - 1];
    if ((p.x - last.x) * (p.x - last.x) + (p.y - last.y) * (p.y - last.y) < 1.6) return;
    current.push(p);
    redraw();
  }

  function finishStroke() {
    if (current && current.length > 0) {
      strokes.push(current);
    }
    current = null;
    pointerActive = false;
    updateLiveReadout();
  }

  /* ========================================================================
   * INPUT HANDLERS
   * ====================================================================== */

  function setEditing(on) {
    editing = !!on;
    canvas.classList.toggle("editing", editing);
    editToggle.setAttribute("aria-pressed", editing ? "true" : "false");
    var label = editToggle.querySelector(".chip-label");
    label.textContent = editing
      ? "EDIT MODE: ON · deposit your mark"
      : "EDIT MODE: OFF · tap to enable";
  }

  setEditing(editing);

  editToggle.addEventListener("click", function () { setEditing(!editing); });

  clearBtn.addEventListener("click", function () {
    strokes = [];
    current = null;
    frame.classList.remove("has-marks");
    redraw();
    updateLiveReadout();
  });

  // Pointer Events (covers mouse + touch where supported)
  canvas.addEventListener("pointerdown", function (e) {
    if (!editing) return;
    e.preventDefault();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    startStroke(pointFromEvent(e));
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!editing || !pointerActive) return;
    e.preventDefault();
    extendStroke(pointFromEvent(e));
  });
  function endPointer(e) {
    if (!pointerActive) return;
    if (editing) e.preventDefault();
    finishStroke();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", function (e) {
    if (pointerActive && editing) finishStroke();
  });

  // Suppress iOS context menu / gesture / double-tap zoom inside the canvas
  canvas.addEventListener("contextmenu", function (e) {
    if (editing) e.preventDefault();
  });
  canvas.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  canvas.addEventListener("gesturechange", function (e) { e.preventDefault(); });

  /* ========================================================================
   * GEOMETRIC ANALYSIS
   * ====================================================================== */

  function analyze(allStrokes) {
    if (allStrokes.length === 0 || totalPoints(allStrokes) < 2) {
      return null;
    }

    var totalLength = 0;
    var totalTurning = 0; // sum of |angle change| over interior points
    var turningCount = 0;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var sumX = 0, sumY = 0, n = 0;
    var endpointGap = 0;

    for (var s = 0; s < allStrokes.length; s++) {
      var pts = allStrokes[s];
      if (pts.length < 2) {
        for (var k = 0; k < pts.length; k++) {
          var p0 = pts[k];
          minX = Math.min(minX, p0.x); minY = Math.min(minY, p0.y);
          maxX = Math.max(maxX, p0.x); maxY = Math.max(maxY, p0.y);
          sumX += p0.x; sumY += p0.y; n++;
        }
        continue;
      }
      var prevDx = 0, prevDy = 0, hasPrev = false;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        sumX += p.x; sumY += p.y; n++;
        if (i > 0) {
          var dx = p.x - pts[i-1].x;
          var dy = p.y - pts[i-1].y;
          var seg = Math.sqrt(dx*dx + dy*dy);
          totalLength += seg;
          if (hasPrev && seg > 0.5) {
            // angle between (prevDx,prevDy) and (dx,dy)
            var a = Math.atan2(prevDy, prevDx);
            var b = Math.atan2(dy, dx);
            var d = Math.abs(b - a);
            if (d > Math.PI) d = Math.PI * 2 - d;
            totalTurning += d;
            turningCount++;
          }
          if (seg > 0.5) { prevDx = dx; prevDy = dy; hasPrev = true; }
        }
      }
      // endpoint gap for this stroke (used by closure)
      var first = pts[0], last = pts[pts.length - 1];
      var gx = last.x - first.x, gy = last.y - first.y;
      endpointGap += Math.sqrt(gx*gx + gy*gy);
    }

    var bbW = Math.max(1, maxX - minX);
    var bbH = Math.max(1, maxY - minY);
    var bbDiag = Math.sqrt(bbW*bbW + bbH*bbH);

    // closure index: how closed-up are the strokes' endpoints, normalized
    // by per-stroke maximum-possible gap (=bbox diagonal). 1 = perfectly closed,
    // 0 = endpoints span the bbox.
    var avgGap = endpointGap / allStrokes.length;
    var closure = clamp(1 - (avgGap / Math.max(1, bbDiag)), 0, 1);

    // jaggedness: turning per unit length, normalized so a doodle with sharp
    // angle changes scores high. Empirical scaling: 0.025 rad/px ~ 1.0.
    var turnPerLen = totalLength > 0 ? (totalTurning / totalLength) : 0;
    var jagged = clamp(turnPerLen / 0.025, 0, 1);

    // density: total stroke length relative to canvas perimeter (W+H).
    var density = clamp(totalLength / (W * 1.6), 0, 1);

    // asymmetry: |centroid - bbox center| over bbox diagonal, plus
    // a balance term measuring how lopsided the bbox itself sits in the canvas.
    var cx = sumX / n, cy = sumY / n;
    var bbcx = (minX + maxX) / 2, bbcy = (minY + maxY) / 2;
    var off = Math.sqrt((cx - bbcx) * (cx - bbcx) + (cy - bbcy) * (cy - bbcy));
    var asym = clamp(off / Math.max(1, bbDiag * 0.5), 0, 1);

    // dominant axis
    var ratio = bbW / bbH;
    var axis;
    if (ratio > 1.45) axis = "horizontal";
    else if (ratio < 0.69) axis = "vertical";
    else if (ratio > 0.95 && ratio < 1.05) axis = "isometric";
    else axis = "diagonal";

    return {
      closure: round(closure, 2),
      jagged: round(jagged, 2),
      density: round(density, 2),
      asym: round(asym, 2),
      strokes: allStrokes.length,
      points: n,
      axis: axis,
      bbW: bbW,
      bbH: bbH,
      length: round(totalLength, 1)
    };
  }

  function totalPoints(arr) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) n += arr[i].length;
    return n;
  }

  function round(v, d) {
    var m = Math.pow(10, d);
    return Math.round(v * m) / m;
  }

  /* ========================================================================
   * CLASSIFICATION  (deterministic, audit-trail-style)
   *
   * Each class reads the geometric properties and gives the affidavit a
   * different voice. The user's live readout shows which class their
   * current drawing tilts toward — closing the input->output causality
   * loop at the point of interaction.
   * ====================================================================== */

  // Each class: {name, predicate, finding (template), priorCase, priorNote}
  var CLASSES = [
    {
      key: "looping-confessional",
      name: "Looping Confessional Class",
      desc: "high closure / smooth curvature",
      check: function (g) { return g.closure > 0.55 && g.jagged < 0.45; },
      finding: function (g) {
        return "The mark loops back on itself in a manner the office associates with " +
          "<em>confessional intent</em>. Subjects depositing closures of this magnitude (" +
          g.closure.toFixed(2) + ") historically wish to be seen, but only obliquely.";
      },
      prior: "the Pemberton Pantry Affair (M-7-04812)",
      priorNote: "the mark closes; the maker does not"
    },
    {
      key: "spiked-affirmation",
      name: "Spiked Affirmation Class",
      desc: "low closure / high jaggedness",
      check: function (g) { return g.jagged > 0.55 && g.closure < 0.55; },
      finding: function (g) {
        return "The mark's turning rate (jaggedness " + g.jagged.toFixed(2) + ") indicates " +
          "<em>declarative agitation</em>. Branch 14b classifies repeat offenders as " +
          "harmless but meeting-disrupting.";
      },
      prior: "the Cartwright Stairwell Sighting (M-7-02273)",
      priorNote: "intent: insistent. tone: peaks only"
    },
    {
      key: "striated-industrial",
      name: "Striated Industrial Class",
      desc: "high density / horizontal axis",
      check: function (g) { return g.density > 0.42 && (g.axis === "horizontal"); },
      finding: function (g) {
        return "Coverage (" + g.density.toFixed(2) + ") reads as <em>occupational habit</em>. " +
          "Department reference: persons who hatch in straight lines are usually rehearsing " +
          "an apology.";
      },
      prior: "the Underline Incident at Reception (M-7-01906)",
      priorNote: "ruled the lines, then signed below them"
    },
    {
      key: "vertical-vow",
      name: "Vertical Vow Class",
      desc: "vertical axis / low density",
      check: function (g) { return g.axis === "vertical" && g.density < 0.5; },
      finding: function (g) {
        return "The mark's vertical rise is consistent with <em>solitary resolutions</em>. " +
          "An extension of " + g.length.toFixed(0) + " units in this orientation is the " +
          "office's textbook example of a private decision made in public ink.";
      },
      prior: "the Stairwell Decree of Mr. R. Ngata (M-7-00557)",
      priorNote: "stood up, drew up, sat back down"
    },
    {
      key: "isometric-omen",
      name: "Isometric Omen Class",
      desc: "balanced bbox / mid-density",
      check: function (g) { return g.axis === "isometric"; },
      finding: function (g) {
        return "The mark's containing rectangle is <em>square within tolerance</em>, a " +
          "geometry the office associates with <em>omen-making</em>. We do not encourage " +
          "it but we file it.";
      },
      prior: "the Wivelsfield Bus Stop Disclosure (M-7-03301)",
      priorNote: "the box was square; the message was not"
    },
    {
      key: "lopsided-grievance",
      name: "Lopsided Grievance Class",
      desc: "high asymmetry",
      check: function (g) { return g.asym > 0.42; },
      finding: function (g) {
        return "Centroid drift (" + g.asym.toFixed(2) + ") places this mark in the " +
          "<em>grievance corner</em> of the office's index. The mark does not know it is " +
          "leaning; the marker does.";
      },
      prior: "the Tilted Memo of Apr. 1996 (M-7-00112)",
      priorNote: "leaned left when read aloud, right when filed"
    },
    {
      key: "single-stroke-petition",
      name: "Single-Stroke Petition Class",
      desc: "exactly one continuous stroke",
      check: function (g) { return g.strokes === 1 && g.length > 60; },
      finding: function (g) {
        return "One continuous stroke. The Department reads single-stroke marks as " +
          "<em>petitions</em>: they begin without permission and end without ceremony.";
      },
      prior: "the Cardew Petition for Vending-Machine Reform (M-7-00009)",
      priorNote: "could not be redacted without redacting the whole"
    },
    {
      key: "scattershot-disorder",
      name: "Scattershot Disorder Class",
      desc: "many strokes / sparse coverage",
      check: function (g) { return g.strokes >= 5 && g.density < 0.32; },
      finding: function (g) {
        return "The mark consists of " + g.strokes + " separate gestures totaling little " +
          "ink. Branch 14b notes this as <em>scattershot ideation</em>: many small intentions, " +
          "no committee.";
      },
      prior: "the Untitled Annotations of File Cabinet 6 (M-7-00674)",
      priorNote: "all the dots, none of the line"
    },
    {
      key: "dense-deposition",
      name: "Dense Deposition Class",
      desc: "very high density",
      check: function (g) { return g.density > 0.62; },
      finding: function (g) {
        return "Coverage (" + g.density.toFixed(2) + ") substantially exceeds the office's " +
          "tolerance for <em>deposition without explanation</em>. Repeat depositors are " +
          "asked to keep their marks shorter for the secretary's sake.";
      },
      prior: "the Drewell Surplus Filing (M-7-04902)",
      priorNote: "filed for record, retained against advice"
    },
    {
      key: "indeterminate-misdemeanor",
      name: "Indeterminate Misdemeanor Class",
      desc: "fallback — averaged across axes",
      check: function () { return true; },
      finding: function (g) {
        return "The mark fails to commit to any single classification axis. The office " +
          "files this with a note of <em>indeterminate misdemeanor</em>: an offense the " +
          "marker has not yet decided on.";
      },
      prior: "the Unspecified Margin Dispute, 2017 (M-7-02019)",
      priorNote: "every drawer thought it belonged in the next one"
    }
  ];

  function classify(g) {
    for (var i = 0; i < CLASSES.length; i++) {
      if (CLASSES[i].check(g)) return CLASSES[i];
    }
    return CLASSES[CLASSES.length - 1];
  }

  /* ========================================================================
   * LIVE READOUT
   * ====================================================================== */

  function updateLiveReadout() {
    var g = analyze(strokes);
    var keys = ["closure", "jagged", "density", "asym"];
    if (!g) {
      keys.forEach(function (k) {
        document.querySelector('[data-fill="' + k + '"]').style.width = "0%";
        document.querySelector('[data-val="' + k + '"]').textContent = "0.00";
      });
      document.querySelector('[data-val="cls"]').textContent = "—";
      submitBtn.disabled = true;
      return;
    }
    keys.forEach(function (k) {
      var v = g[k];
      document.querySelector('[data-fill="' + k + '"]').style.width = (v * 100).toFixed(0) + "%";
      document.querySelector('[data-val="' + k + '"]').textContent = v.toFixed(2);
    });
    var cls = classify(g);
    document.querySelector('[data-val="cls"]').textContent = cls.name + " — " + cls.desc;
    submitBtn.disabled = g.length < 30; // require at least a small mark
  }

  /* ========================================================================
   * AFFIDAVIT RENDERING
   * ====================================================================== */

  var EXAMINER_NAMES = [
    "Hollis Wenmark, Jr.",
    "B. M. Trimble-Pew",
    "Inspector R. T. Yarrow",
    "Constance Mappick",
    "Examiner J. P. Aurelis",
    "Aldwin Pearce",
    "Mae Roundtree",
    "Examiner W. Salzburg",
    "F. F. Ostrowicz",
    "Theodora Pell",
    "G. R. Bickley",
    "Cmdr. (ret.) S. Quill",
    "Examiner D. Wexford-Bly",
    "Hattie Drum",
    "Inspector V. Aoki",
    "Examiner L. M. Bouchard",
    "Reginald Pflug",
    "Margery Tinsmith",
    "Examiner C. P. Tuvalu",
    "Wendell Bright"
  ];

  function caseNumberFor(g, classKey) {
    // 8-digit deterministic case number from the geometry signature.
    var sig = [
      Math.round(g.closure * 1000),
      Math.round(g.jagged * 1000),
      Math.round(g.density * 1000),
      Math.round(g.asym * 1000),
      g.strokes,
      Math.round(g.length),
      classKey.length
    ].join("|");
    var h = 2166136261 >>> 0;
    for (var i = 0; i < sig.length; i++) {
      h = (h ^ sig.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    var n = h % 100000000;
    var s = String(n);
    while (s.length < 8) s = "0" + s;
    return "M-7-" + s;
  }

  function pickExaminer(caseNo) {
    var h = 0;
    for (var i = 0; i < caseNo.length; i++) h = (Math.imul(31, h) + caseNo.charCodeAt(i)) | 0;
    return EXAMINER_NAMES[Math.abs(h) % EXAMINER_NAMES.length];
  }

  function todayStamp() {
    var d = new Date();
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  function exhibitDataUrl() {
    // Render the strokes onto a clean 600x600 canvas (no grid) for the affidavit.
    var off = document.createElement("canvas");
    off.width = 600; off.height = 600;
    var oc = off.getContext("2d");
    oc.fillStyle = "#f1e6cf";
    oc.fillRect(0, 0, 600, 600);
    oc.strokeStyle = "#1c1812";
    oc.lineWidth = 4.2;
    oc.lineCap = "round";
    oc.lineJoin = "round";
    for (var i = 0; i < strokes.length; i++) {
      var pts = strokes[i];
      if (pts.length === 0) continue;
      if (pts.length === 1) {
        oc.beginPath();
        oc.arc(pts[0].x, pts[0].y, 2.2, 0, Math.PI * 2);
        oc.fillStyle = "#1c1812";
        oc.fill();
        continue;
      }
      oc.beginPath();
      oc.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length; j++) oc.lineTo(pts[j].x, pts[j].y);
      oc.stroke();
    }
    return off.toDataURL("image/png");
  }

  function fillAffidavit(g, cls, caseNo) {
    var examiner = pickExaminer(caseNo);
    var fillMap = {
      caseno: caseNo,
      filed: todayStamp(),
      examiner: examiner,
      "examiner-sig": examiner,
      cls: cls.name,
      cls2: cls.name,
      closure: g.closure.toFixed(2),
      jagged: g.jagged.toFixed(2),
      density: g.density.toFixed(2),
      asym: g.asym.toFixed(2),
      strokes: String(g.strokes),
      axis: g.axis,
      prior: cls.prior,
      "prior-note": cls.priorNote,
      "stamp-date": todayStamp().toUpperCase()
    };
    Object.keys(fillMap).forEach(function (k) {
      var nodes = document.querySelectorAll('[data-aff="' + k + '"]');
      for (var i = 0; i < nodes.length; i++) nodes[i].textContent = fillMap[k];
    });

    // The findings paragraph contains <em> tags; assign innerHTML.
    var findEl = document.querySelector('[data-aff-find]');
    if (findEl) findEl.innerHTML = cls.finding(g);

    // Exhibit A reproduction
    document.getElementById("exhibit-img").src = exhibitDataUrl();
  }

  /* ========================================================================
   * SUBMIT / NAVIGATE
   * ====================================================================== */

  submitBtn.addEventListener("click", function () {
    var g = analyze(strokes);
    if (!g || g.length < 30) return;
    var cls = classify(g);
    var caseNo = caseNumberFor(g, cls.key);
    fillAffidavit(g, cls, caseNo);
    intakePane.hidden = true;
    affidavitPane.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  redrawBtn.addEventListener("click", function () {
    affidavitPane.hidden = true;
    intakePane.hidden = false;
    strokes = [];
    current = null;
    frame.classList.remove("has-marks");
    redraw();
    updateLiveReadout();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Initial empty readout
  updateLiveReadout();
})();

/* ============================================================================
 * SHARE
 * ========================================================================= */

function share() {
  var url = location.origin + location.pathname; // canonical page URL
  if (navigator.share) {
    navigator.share({
      title: "Department of Suspicious Marks",
      text: "the office filed my mark.",
      url: url
    }).catch(function () {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () {
      alert("affidavit URL copied to clipboard — forward at your discretion.");
    });
  } else {
    alert(url);
  }
}
