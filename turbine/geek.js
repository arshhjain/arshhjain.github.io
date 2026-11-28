(() => {
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const txt = (parent, x, y, s, cls = "", anchor = "start") => { const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent); t.textContent = s; return t; };
  const svgPt = (svg, ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const dragOn = (svg, onValue) => {
    let on = false;
    svg.addEventListener("pointerdown", (ev) => { on = true; svg.setPointerCapture(ev.pointerId); svg.classList.add("dragging"); onValue(svgPt(svg, ev)); });
    svg.addEventListener("pointermove", (ev) => { if (on) onValue(svgPt(svg, ev)); });
    const stop = () => { on = false; svg.classList.remove("dragging"); };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
  const CLASSES = ["crack", "craze_crack", "delamination", "erosion", "lightning_damage", "surface_damage"];
  const NICE = { crack: "crack", craze_crack: "craze crack", delamination: "delamination", erosion: "erosion", lightning_damage: "lightning", surface_damage: "surface damage" };

  /* ---------- reveal ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((n) => revealObs.observe(n));

  /* ---------- 002.1 pipeline ---------- */
  (() => {
    const list = $("#pipe"), out = $("#pipeDetail");
    if (!list) return;
    const STAGES = [
      { h: "Annotations", p: ["1,065 drone photos at 1024 × 1024 from the Figshare wind turbine blade defect set, each with Pascal VOC boxes drawn by the dataset's authors.", "Images can have several boxes of different types."], d: [["IN", "JPEG + XML"], ["OUT", "boxes with raw class names"]] },
      { h: "Classes", p: ["The raw names are mapped to six I could explain to a repair crew. Two of the mappings are my interpretation: corrosion → erosion and hide_craze → delamination.", "hide_craze is the subtle one, and it shows up again in the failures (002.7)."], d: [["IN", "craze, corrosion, surface_injure, thunderstrike, crack, hide_craze"], ["OUT", "craze_crack, erosion, surface_damage, lightning_damage, crack, delamination"]] },
      { h: "Label", p: ["Each box gets a level from my proxy rule (002.2). The image takes its worst box: highest level, ties go to the bigger box.", "One type and one level per photo."], d: [["RULE", "class base ± 1 by box area"], ["CHANGED", "473 of 1,065 labels"]] },
      { h: "Group", p: ["Frames are chained into sequences by frame number and pixel difference, then whole sequences are split 70 / 15 / 15 (002.3)."], d: [["GROUPS", "361"], ["TRAIN · VAL · TEST", "747 · 159 · 159 images"]] },
      { h: "Train", p: ["Pretrained ResNet50, CBAM and two heads, fine-tuned end to end (002.4). Heavy augmentation on the training split only: affine, rotation, lighting, motion blur, fog.", "The best epoch is picked on validation macro-F1."], d: [["EPOCHS", "12"], ["INPUT", "224 × 224"]] },
      { h: "Evaluate", p: ["The test set is used once, at the end. Every number on this page was recomputed from the saved checkpoints on 22 November by scripts/verify_test_metrics.py."], d: [["TEST", "159 images · 36 groups"], ["MODEL C", "92.45% acc · 0.346 MAE"]] },
      { h: "Triage", p: ["Type picks the crew; level picks how soon. L5 means ground the turbine now, L4 means non-destructive testing within 48 hours, and so on down to cosmetic logging at L1.", "This mapping is a demo policy on top of the model, not something the model learned."], d: [["TYPE →", "crew"], ["LEVEL →", "priority"]] }
    ];
    const items = [...list.children];
    const show = (i) => {
      items.forEach((li, k) => li.classList.toggle("on", k === i));
      const s = STAGES[i];
      out.innerHTML = `<div><h4>${s.h}</h4>${s.p.map((x) => `<p>${x}</p>`).join("")}</div><dl>${s.d.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>`;
    };
    items.forEach((li, i) => li.addEventListener("click", () => show(i)));
    show(0);
  })();

  /* data shared by several sheets */
  const framesP = fetch("frames.json").then((r) => r.json());
  const recsP = fetch("../assets/media/turbine/test-records.json").then((r) => r.json());

  /* ---------- 002.2 label rule ---------- */
  (() => {
    const svg = $("#lblSvg");
    if (!svg) return;
    const BASE = { surface_damage: 1, erosion: 2, craze_crack: 3, crack: 4, delamination: 4, lightning_damage: 5 };
    const X0 = 24, X1 = 500, LO = Math.log10(0.0005), HI = Math.log10(0.7);
    const xOf = (a) => X0 + ((Math.log10(clamp(a, 0.0005, 0.7)) - LO) / (HI - LO)) * (X1 - X0);
    const aOf = (x) => Math.pow(10, LO + ((clamp(x, X0, X1) - X0) / (X1 - X0)) * (HI - LO));
    const level = (cls, a) => { let s = BASE[cls]; if (a >= 0.08 && s < 5) s++; else if (a <= 0.005 && s > 1) s--; return s; };
    let cls = "crack", area = 0.03, dist = 1;
    el("rect", { class: "band dn", x: X0, y: 20, width: xOf(0.005) - X0, height: 70 }, svg);
    el("rect", { class: "band up", x: xOf(0.08), y: 20, width: X1 - xOf(0.08), height: 70 }, svg);
    txt(svg, (X0 + xOf(0.005)) / 2, 14, "−1 LEVEL", "sub", "middle");
    txt(svg, (xOf(0.08) + X1) / 2, 14, "+1 LEVEL", "sub", "middle");
    el("line", { class: "axis", x1: X0, x2: X1, y1: 90, y2: 90 }, svg);
    [0.001, 0.005, 0.01, 0.03, 0.08, 0.2, 0.5].forEach((a) => {
      el("line", { class: a === 0.005 || a === 0.08 ? "thr" : "axis", x1: xOf(a), x2: xOf(a), y1: a === 0.005 || a === 0.08 ? 20 : 86, y2: 94 }, svg);
      txt(svg, xOf(a), 142, a < 0.01 ? `${(a * 100).toFixed(1)}%` : `${Math.round(a * 100)}%`, "sub", "middle");
    });
    const ticks = el("g", {}, svg);
    const ghost = el("g", {}, svg);
    el("line", { class: "ghost", x1: 0, x2: 0, y1: 24, y2: 90 }, ghost);
    el("circle", { class: "ghostgrip", cx: 0, cy: 24, r: 6 }, ghost);
    const cur = el("g", {}, svg);
    el("line", { class: "cur", x1: 0, x2: 0, y1: 24, y2: 90 }, cur);
    el("circle", { class: "grip", cx: 0, cy: 24, r: 8 }, cur);
    el("rect", { x: 0, y: 0, width: 520, height: 150, fill: "transparent" }, svg);

    let frames = [];
    const drawTicks = () => {
      ticks.innerHTML = "";
      for (const f of frames) {
        const mine = CLASSES[f[3]] === cls;
        el("line", { class: `rt ${mine ? "cls" : ""}`, x1: xOf(f[4]).toFixed(1), x2: xOf(f[4]).toFixed(1), y1: mine ? 100 : 104, y2: mine ? 126 : 118 }, ticks);
      }
    };
    framesP.then((d) => { frames = d.frames; drawTicks(); });

    const chipsEl = $("#lblClass");
    CLASSES.forEach((c) => {
      const b = document.createElement("button");
      b.className = `chip${c === cls ? " on" : ""}`; b.textContent = `${NICE[c].toUpperCase()} · ${BASE[c]}`;
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => { cls = c; [...chipsEl.children].forEach((k) => k.classList.toggle("on", k === b)); drawTicks(); draw(); });
      chipsEl.appendChild(b);
    });
    const distEl = $("#lblDist"), distO = $("#lblDistO");
    distEl.addEventListener("input", () => { dist = +distEl.value; draw(); });
    function draw() {
      const seen = area / (dist * dist);
      cur.setAttribute("transform", `translate(${xOf(seen).toFixed(1)} 0)`);
      ghost.style.display = dist > 1.01 ? "" : "none";
      ghost.setAttribute("transform", `translate(${xOf(area).toFixed(1)} 0)`);
      $("#lblBase").textContent = BASE[cls];
      $("#lblArea").textContent = seen < 0.01 ? pct(seen, 2) : pct(seen, 1);
      const lv = level(cls, seen), lv0 = level(cls, area);
      $("#lblLevel").innerHTML = `L${lv}${lv !== lv0 ? `<span class="was">L${lv0}</span>` : ""}`;
      distO.textContent = `${dist.toFixed(1)}×`;
      svg.setAttribute("aria-valuenow", seen.toFixed(4));
      $("#lblNote").textContent = dist > 1.01
        ? `Same damage, drone ${dist.toFixed(1)}× further away: the box covers 1/${(dist * dist).toFixed(1)} of the area it did${lv !== lv0 ? `, and the label drops from L${lv0} to L${lv}` : ", and here the label happens to survive"}.`
        : "Ticks under the ruler are the 1,065 real images: the largest box of each image's labelled class. Orange ticks are the selected class.";
    }
    dragOn(svg, (p) => { area = aOf(p.x) * dist * dist; area = clamp(area, 0.0005, 0.7); draw(); });
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { area = clamp(area * (e.key === "ArrowRight" ? 1.12 : 1 / 1.12), 0.0005, 0.7); draw(); e.preventDefault(); }
    });
    draw();
  })();

  /* ---------- 002.3 split ---------- */
  (() => {
    const cv = $("#framesCv");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const COLS = 41, CELL = 12, GAP = 1;
    let frames = [], mode = "group", seed = 7;
    const col = { 0: "#c9c4b4", 1: "#7d7a6e", 2: "#17160f" };
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff4a1c";
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    function shuffled() {
      const idx = frames.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      const s = new Array(frames.length);
      idx.forEach((k, r) => { s[k] = r < 747 ? 0 : r < 906 ? 1 : 2; });
      return s;
    }
    function draw() {
      const split = mode === "group" ? frames.map((f) => f[2]) : shuffled();
      const groups = new Map();
      frames.forEach((f, i) => { const g = groups.get(f[1]) || new Set(); g.add(split[i]); groups.set(f[1], g); });
      const inTrain = new Set(frames.filter((_, i) => split[i] === 0).map((f) => f[1]));
      let cross = 0; groups.forEach((s) => { if (s.size > 1) cross++; });
      let leak = 0;
      const rows = Math.ceil(frames.length / COLS);
      cv.width = COLS * CELL; cv.height = rows * CELL;
      ctx.fillStyle = "#e2dfd3"; ctx.fillRect(0, 0, cv.width, cv.height);
      frames.forEach((f, i) => {
        const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
        const bad = split[i] === 2 && inTrain.has(f[1]);
        if (bad) leak++;
        ctx.fillStyle = bad ? accent : col[split[i]];
        ctx.fillRect(x, y, CELL - GAP, CELL - GAP);
      });
      $("#splitCross").textContent = cross;
      $("#splitLeak").textContent = `${leak} / ${split.filter((s) => s === 2).length}`;
      $(".split-out").classList.toggle("bad", leak > 0);
    }
    framesP.then((d) => { frames = d.frames; draw(); });
    const gBtn = $("#splitGroup"), rBtn = $("#splitRandom"), reroll = $("#splitReroll");
    gBtn.addEventListener("click", () => { mode = "group"; gBtn.classList.add("on"); rBtn.classList.remove("on"); reroll.hidden = true; draw(); });
    rBtn.addEventListener("click", () => { mode = "random"; rBtn.classList.add("on"); gBtn.classList.remove("on"); reroll.hidden = false; draw(); });
    reroll.addEventListener("click", () => { seed = (seed * 48271) % 2147483647; draw(); });
  })();

  /* ---------- 002.4 architecture ---------- */
  (() => {
    const svg = $("#arch");
    if (!svg) return;
    const B = (y, label, shape, key, h = 34, x = 80, w = 300) => {
      const g = el("g", { class: `blk${key ? " key" : ""}`, transform: `translate(${x} ${y})` }, svg);
      el("rect", { width: w, height: h }, g);
      txt(g, 12, h / 2 + 4, label);
      txt(g, w - 12, h / 2 + 4, shape, "shape", "end");
      return g;
    };
    const wire = (x1, y1, x2, y2, cls = "") => el("path", { class: `wire ${cls}`, d: `M${x1} ${y1} L${x2} ${y2}` }, svg);
    const blocks = {};
    const ys = [10, 56, 102, 148, 194, 240];
    [["PHOTO", "3 × 224²"], ["STEM · conv7 · pool", "64 × 56²"], ["LAYER 1", "256 × 56²"], ["LAYER 2", "512 × 28²"], ["LAYER 3", "1024 × 14²"], ["LAYER 4", "2048 × 7²"]]
      .forEach(([l, s], i) => { blocks[`r${i}`] = B(ys[i], l, s, false); if (i) wire(230, ys[i - 1] + 34, 230, ys[i]); });
    wire(230, 274, 230, 292, "w-cbam");
    blocks.cbam = B(292, "CBAM · channel → spatial", "2048 × 7²", true);
    wire(230, 326, 230, 344);
    blocks.pool = B(344, "AVG ‖ MAX POOL", "4096");
    wire(230, 378, 230, 396);
    blocks.fc = B(396, "FC · LayerNorm · ReLU", "512");
    wire(230, 430, 80, 458); wire(230, 430, 230, 458, "w-ord"); wire(230, 430, 380, 458, "w-reg");
    blocks.type = B(458, "TYPE", "6", false, 50, 10, 140);
    blocks.ord = B(458, "ORDINAL", "4", false, 50, 160, 140);
    blocks.reg = B(458, "SCALAR", "1", false, 50, 310, 140);
    const lossT = txt(svg, 230, 530, "", "sub", "middle");
    const VAR = {
      A: { off: ["cbam", "ord", "reg"], loss: "cross-entropy", note: "A · plain ResNet50 with one head, cross-entropy. 93.71% accuracy, 10 wrong." },
      B: { off: ["ord", "reg"], loss: "cross-entropy", note: "B · A plus CBAM. 94.34%, 9 wrong: the best of the three, by one image." },
      C: { off: [], loss: "focal + ordinal + scalar", note: "C · B plus focal loss and the two severity heads. 92.45% on type, and the only one that predicts severity (MAE 0.346)." }
    };
    const chips = [...document.querySelectorAll("#s4 .chip[data-v]")];
    function set(v) {
      chips.forEach((c) => c.classList.toggle("on", c.dataset.v === v));
      Object.entries(blocks).forEach(([k, g]) => g.classList.toggle("off", VAR[v].off.includes(k)));
      svg.querySelector(".w-cbam").classList.toggle("off", VAR[v].off.includes("cbam"));
      svg.querySelector(".w-ord").classList.toggle("off", VAR[v].off.includes("ord"));
      svg.querySelector(".w-reg").classList.toggle("off", VAR[v].off.includes("reg"));
      lossT.textContent = `loss: ${VAR[v].loss}`;
      $("#archNote").textContent = VAR[v].note;
    }
    chips.forEach((c) => c.addEventListener("click", () => set(c.dataset.v)));
    set("C");
  })();

  /* ---------- 002.5 McNemar ---------- */
  (() => {
    const svg = $("#mcSvg");
    if (!svg) return;
    const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
    const pExact = (b, c) => { const n = b + c; if (!n) return 1; let s = 0; for (let i = 0; i <= Math.min(b, c); i++) s += comb(n, i); return Math.min(1, (2 * s) / Math.pow(2, n)); };
    const MAX = 14, X = [150, 370], Y0 = 140, U = 8.2;
    let b = 4, c = 2, names = ["A", "C"];
    el("line", { class: "base", x1: 40, x2: 480, y1: Y0, y2: Y0 }, svg);
    const bars = X.map((x, i) => el("rect", { class: `bar ${i ? "c" : ""}`, x: x - 40, width: 80, y: Y0, height: 0 }, svg));
    const counts = X.map((x) => txt(svg, x, Y0 - 6, "", "", "middle"));
    const labs = X.map((x) => txt(svg, x, Y0 + 20, "", "sub", "middle"));
    el("rect", { x: 0, y: 0, width: 520, height: 170, fill: "transparent" }, svg);
    function draw() {
      [b, c].forEach((v, i) => {
        bars[i].setAttribute("y", Y0 - v * U); bars[i].setAttribute("height", v * U);
        counts[i].setAttribute("y", Y0 - v * U - 6); counts[i].textContent = v;
        labs[i].textContent = `only ${names[i]} right`;
      });
      const p = pExact(b, c);
      $("#mcP").textContent = p >= 0.995 ? "1.00" : p.toFixed(p < 0.01 ? 3 : 2);
      $(".mc-out").classList.toggle("sig", p < 0.05);
      $("#mcVerdict").textContent = p < 0.05
        ? `${b}–${c} would be hard to put down to chance (p < 0.05). The real runs are nowhere near this.`
        : `With ${b + c} images that only one model gets right, a ${b}–${c} split happens by coin flip ${Math.round(p * 100)}% of the time. Not a real difference.`;
    }
    dragOn(svg, (pt) => {
      const v = clamp(Math.round((Y0 - pt.y) / U), 0, MAX);
      if (pt.x < 260) b = v; else c = v;
      draw();
    });
    const ca = $("#mcCA"), ba = $("#mcBA");
    ca.addEventListener("click", () => { b = 4; c = 2; names = ["A", "C"]; ca.classList.add("on"); ba.classList.remove("on"); draw(); });
    ba.addEventListener("click", () => { b = 2; c = 3; names = ["A", "B"]; ba.classList.add("on"); ca.classList.remove("on"); draw(); });
    draw();
  })();

  /* ---------- 002.6 severity ---------- */
  (() => {
    const mae = $("#mae");
    if (!mae) return;
    const ROWS = [["Always say L4 (most common)", 0.981], ["Lookup, predicted class", 0.535], ["Lookup, true class (oracle)", 0.415], ["Learned ordinal head", 0.346, true]];
    mae.innerHTML = ROWS.map(([l, v, h]) => `<div class="row${h ? " head" : ""}"><span>${l}</span><i data-w="${v}"></i><b>${v.toFixed(3)}</b></div>`).join("");
    new IntersectionObserver((e, o) => {
      if (!e[0].isIntersecting) return;
      mae.querySelectorAll("i").forEach((i) => { i.style.width = `${(+i.dataset.w / 1) * 100}%`; });
      o.disconnect();
    }, { threshold: 0.3 }).observe(mae);

    const CM = [[14, 3, 0, 1, 0], [1, 11, 6, 1, 0], [0, 1, 16, 6, 0], [2, 0, 1, 48, 7], [0, 1, 0, 16, 24]];
    const box = $("#sevcm"), note = $("#sevNote");
    const max = 48;
    let html = `<span class="h"></span>${[1, 2, 3, 4, 5].map((k) => `<span class="h">P${k}</span>`).join("")}`;
    CM.forEach((row, t) => {
      html += `<span class="h">T${t + 1}</span>`;
      row.forEach((v, p) => {
        const a = v ? 0.08 + (v / max) * 0.85 : 0;
        const d = t - p;
        html += `<span class="c${t === p ? " diag" : ""}${a > 0.5 ? " dk" : ""}${v ? "" : " z"}${v && d >= 2 ? " u2" : v && d === 1 ? " u1" : ""}" style="--a:${a.toFixed(3)}" data-t="${t + 1}" data-p="${p + 1}" data-v="${v}">${v}</span>`;
      });
    });
    box.innerHTML = html;
    const base = note.textContent;
    box.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".c");
      if (!c) return;
      const t = +c.dataset.t, p = +c.dataset.p, v = +c.dataset.v;
      note.textContent = t === p ? `${v} images at true L${t} called exactly right.`
        : `${v} image${v === 1 ? "" : "s"} at true L${t} called L${p}: ${p < t ? `under by ${t - p}${t - p >= 2 ? ". In triage, this is the dangerous direction" : ""}` : `over by ${p - t}, which costs a crew's time, not safety`}.`;
    });
    box.addEventListener("pointerleave", () => { note.textContent = base; });
    $("#sevUnder").addEventListener("click", (e) => {
      const on = box.classList.toggle("under");
      e.target.classList.toggle("on", on);
      note.textContent = on ? "Under-calls: 3 images by two or more levels (two L4s called L1, one L5 called L2), and 19 by one, 16 of them L5s called L4." : base;
    });
  })();

  /* ---------- 002.7 failures + threshold ---------- */
  (() => {
    const grid = $("#fails");
    if (!grid) return;
    const MISSES = [14, 77, 95, 181, 539, 641, 647, 729, 732, 754, 764, 834];
    const ALL3 = [14, 77, 95, 754, 764];
    const NOTES = {
      14: "Delamination's original dataset label is hide_craze, which is visually subtle. Wrong for all three deep models.",
      77: "Lightning damage, the weakest class. Wrong for all three deep models.",
      95: "Lightning called erosion. Wrong for all three deep models.",
      181: "Under 50% confident: one of the calls a human threshold would catch.",
      539: "A second hot spot sits on rocks on the ground, not on the blade.",
      641: "Delamination called craze crack at under 50%.",
      729: "The heat is on a gantry in the background, not on the blade.",
      732: "Confidently wrong at 90%. A threshold wouldn't catch this one.",
      754: "Burn mark with cracked edges, read as a craze network. Wrong for all three deep models.",
      764: "Delamination (hide_craze) called surface damage. Wrong for all three deep models.",
      834: "Lightning again, and under 50% confident."
    };
    const fv = { raw: $("#fvRaw"), cam: $("#fvCam"), img: $(".fv-img"), id: $("#fvId"), t: $("#fvTrue"), p: $("#fvPred"), p2: $("#fvP2"), note: $("#fvNote"), tog: $("#fvToggle") };
    let recs = {};
    grid.innerHTML = MISSES.map((id) => `<button data-id="${id}" class="${ALL3.includes(id) ? "all" : ""}" aria-label="Test image ${id}"><img src="../assets/media/turbine/fail/${id}.jpg" alt="" loading="lazy"><span>${id}</span></button>`).join("");
    function show(id) {
      grid.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.id === id));
      fv.raw.src = `../assets/media/turbine/fail/${id}.jpg`;
      fv.cam.src = `../assets/media/turbine/fail/${id}-cam.jpg`;
      fv.raw.alt = `Test image ${id}`;
      const r = recs[id];
      fv.id.textContent = `${id}.jpg`;
      if (r) {
        fv.t.textContent = `${NICE[r.t]} · L${r.ts}`;
        fv.p.textContent = `${NICE[r.p]} ${pct(r.c)} · L${r.ps}`;
        fv.p2.textContent = `${NICE[r.p2]} ${pct(r.c2)}`;
      }
      fv.note.textContent = NOTES[id] || "";
    }
    grid.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(+b.dataset.id); });
    fv.tog.addEventListener("click", () => {
      const raw = fv.img.classList.toggle("raw");
      fv.tog.classList.toggle("on", !raw);
      fv.tog.textContent = raw ? "GRAD-CAM OFF" : "GRAD-CAM ON";
    });

    const svg = $("#thrSvg");
    const X0 = 20, X1 = 500, C0 = 0.2, C1 = 1;
    const xOf = (c) => X0 + ((clamp(c, C0, C1) - C0) / (C1 - C0)) * (X1 - X0);
    const cOf = (x) => C0 + ((clamp(x, X0, X1) - X0) / (X1 - X0)) * (C1 - C0);
    let t = 0.5, all = [];
    const shade = el("rect", { class: "shade", x: X0, y: 8, height: 84, width: 0 }, svg);
    const dots = el("g", {}, svg);
    el("line", { class: "axis", x1: X0, x2: X1, y1: 96, y2: 96, stroke: "currentColor" }, svg);
    [0.2, 0.4, 0.6, 0.8, 1].forEach((c) => txt(svg, xOf(c), 114, `${Math.round(c * 100)}%`, "sub", "middle"));
    const cur = el("g", {}, svg);
    el("line", { class: "cur", x1: 0, x2: 0, y1: 6, y2: 96 }, cur);
    el("circle", { class: "grip", cx: 0, cy: 6, r: 7 }, cur);
    el("rect", { x: 0, y: 0, width: 520, height: 120, fill: "transparent" }, svg);
    function drawThr() {
      shade.setAttribute("width", Math.max(0, xOf(t) - X0));
      cur.setAttribute("transform", `translate(${xOf(t).toFixed(1)} 0)`);
      svg.setAttribute("aria-valuenow", t.toFixed(2));
      const sent = all.filter((r) => r.c < t), kept = all.filter((r) => r.c >= t);
      const caught = sent.filter((r) => r.p !== r.t).length;
      const keptOk = kept.filter((r) => r.p === r.t).length;
      $("#thrSent").textContent = `${sent.length}`;
      $("#thrCaught").textContent = `${caught} / 12`;
      $("#thrAcc").textContent = kept.length ? pct(keptOk / kept.length) : "—";
    }
    recsP.then((d) => {
      d.recs.forEach((r) => { recs[r.id] = r; });
      all = d.recs;
      let s = 3;
      const jit = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      all.forEach((r) => el("circle", { class: `dot ${r.p !== r.t ? "w" : "r"}`, cx: xOf(r.c).toFixed(1), cy: (r.p !== r.t ? 24 : 40) + jit() * 50, r: r.p !== r.t ? 4.5 : 3 }, dots));
      show(754);
      drawThr();
    });
    dragOn(svg, (p) => { t = Math.round(cOf(p.x) * 100) / 100; drawThr(); });
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { t = clamp(t + (e.key === "ArrowRight" ? 0.01 : -0.01), C0, C1); drawThr(); e.preventDefault(); }
    });
  })();

  /* ---------- 002.8 closed set ---------- */
  (() => {
    const box = $("#doors");
    if (!box) return;
    const P4 = { crack: 0.9108, craze_crack: 0.0133, delamination: 0.0606, erosion: 0.0053, lightning_damage: 0.0031, surface_damage: 0.007 };
    const note = $("#closedNote");
    function draw(k) {
      const healthy = k === "healthy";
      box.innerHTML = CLASSES.map((c) => {
        const p = healthy ? 0 : P4[c];
        const top = healthy ? c === "crack" : c === "crack";
        return `<div class="door${top ? " top" : ""}${healthy ? " unk" : ""}" style="--p:${p.toFixed(4)}"><em>${healthy ? (top ? "TOP" : "?") : pct(p)}</em><i></i><span>${NICE[c].toUpperCase()}</span></div>`;
      }).join("") + `<div class="door none" style="--p:0"><em>—</em><i></i><span>NONE</span></div>`;
      note.textContent = healthy
        ? "A photo of a brand-new blade, 23 November. The top answer was crack; the exact probabilities weren't saved. There is no seventh door for it to choose."
        : "Test image 4.jpg: model C's full softmax. 91.1% crack, and the six bars always add up to 100%.";
    }
    document.querySelectorAll("#closedPick .chip").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#closedPick .chip").forEach((x) => x.classList.toggle("on", x === b));
      draw(b.dataset.k);
    }));
    draw("crack");
  })();
})();
