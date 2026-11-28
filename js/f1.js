/* DWG 003: one real race per stop, drawn as a lap chart. main.js owns the detent and writes --x
   (0 Monaco, 1 Hungaroring, 2 Spa, 3 Las Vegas, 4 ranking). Between stops the lines morph from one race into the
   next, so Monaco's near-parallel parade twists into the Las Vegas braid. Once a stop settles, its on-track passes
   (V2 rule, from f1/laps.json) pop in left to right and the tally counts them up. */
(() => {
  const sec = document.getElementById("f1");
  if (!sec) return;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const STOPS = JSON.parse($("f1Stops").textContent);
  const lines = [...sec.querySelectorAll(".f1-line")];
  const svg = $("f1Chart"), num = $("f1Num"), raceEl = $("f1Race"), avgEl = $("f1Avg");
  const LAST = 3, SAMPLES = 220, SLOTS = 20, DRAW_MS = 1500, MARK_MS = 1400;
  const PAD = { l: 34, r: 44, t: 8, b: 24 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  let charts = null, W = 0, H = 0;
  let visible = false, raf = 0, lineOn = -1, ended = null;
  let drawStart = -1, landed = -1, landedAt = 0;
  let paths = [], labels = [], marksG = null, scG = null, marks = [], clipRect = null, axis = {};

  /* ---------- data: each race becomes 20 sampled position lines, slot 0 = winner ---------- */
  function prepare(race) {
    const nLaps = race.laps.length, nd = race.drivers.length;
    const pos = Array.from({ length: nd }, () => new Float32Array(nLaps).fill(NaN));
    race.laps.forEach((lap, j) => lap.o.forEach((d, r) => { pos[d][j] = r; }));
    const lastLap = pos.map((p) => { let j = nLaps - 1; while (j > 0 && isNaN(p[j])) j -= 1; return j; });
    const order = [...Array(nd).keys()].sort((a, b) => lastLap[b] - lastLap[a] || pos[a][lastLap[a]] - pos[b][lastLap[b]]);
    const slots = order.slice(0, SLOTS).map((d) => {
      const p = pos[d], end = lastLap[d];
      let first = 0; while (first < end && isNaN(p[first])) first += 1;
      const s = new Float32Array(SAMPLES + 1);
      for (let i = 0; i <= SAMPLES; i += 1) {
        const at = Math.min(end, Math.max(first, (i / SAMPLES) * (nLaps - 1)));
        const j = Math.floor(at), f = at - j;
        const a = isNaN(p[j]) ? p[end] : p[j], b = j + 1 <= end && !isNaN(p[j + 1]) ? p[j + 1] : a;
        s[i] = a + (b - a) * f;
      }
      return { code: race.drivers[d], s, end: end / (nLaps - 1), finished: end >= nLaps - 4 };
    });
    while (slots.length < SLOTS) slots.push({ code: "", s: new Float32Array(SAMPLES + 1).fill(SLOTS - 1), end: 0, finished: false });
    const passes = [];
    race.laps.forEach((lap, j) => lap.x.forEach(([g]) => {
      passes.push({ u: (j - 0.5) / (nLaps - 1), r: (pos[g][j - 1] + pos[g][j]) / 2 });
    }));
    passes.sort((a, b) => a.u - b.u);
    /* neutralised laps (SC, VSC, red flag) as spans; lap j covers the stretch from index j-1 to j */
    const sc = [];
    race.laps.forEach((lap, j) => {
      if (!lap.s || !j) return;
      const u0 = (j - 1) / (nLaps - 1), u1 = j / (nLaps - 1), last = sc[sc.length - 1];
      if (last && Math.abs(last[1] - u0) < 1e-9) last[1] = u1; else sc.push([u0, u1]);
    });
    return { race, slots, passes, sc, laps: race.laps[nLaps - 1].n };
  }

  /* ---------- geometry ---------- */
  const X = (u) => PAD.l + u * (W - PAD.l - PAD.r);
  const Y = (r) => PAD.t + (r / (SLOTS - 1)) * (H - PAD.t - PAD.b);

  function build() {
    const box = svg.getBoundingClientRect();
    W = Math.max(200, Math.round(box.width)); H = Math.max(120, Math.round(box.height));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    const clip = el("clipPath", { id: "f1Clip" }, defs);
    clipRect = el("rect", { x: 0, y: -10, width: 0, height: H + 20 }, clip);

    const grid = el("g", { class: "f1-grid" }, svg);
    for (const p of [1, 5, 10, 15, 20]) {
      el("line", { x1: PAD.l, x2: W - PAD.r, y1: Y(p - 1), y2: Y(p - 1) }, grid);
      el("text", { class: "f1-ax", x: PAD.l - 8, y: Y(p - 1) + 3.5, "text-anchor": "end" }, grid).textContent = "P" + p;
    }
    for (let q = 0; q <= 4; q += 1) el("line", { class: "v", x1: X(q / 4), x2: X(q / 4), y1: PAD.t - 4, y2: H - PAD.b + 4 }, grid);
    el("text", { class: "f1-ax", x: PAD.l, y: H - 6 }, grid).textContent = "LAP 1";
    axis.end = el("text", { class: "f1-ax", x: W - PAD.r, y: H - 6, "text-anchor": "end" }, grid);

    scG = el("g", { class: "f1-sc" }, svg);
    const g = el("g", { "clip-path": "url(#f1Clip)" }, svg);
    paths = Array.from({ length: SLOTS }, (_, i) => {
      const p = el("path", { class: "f1-ln" + (i === 0 ? " win" : "") }, g);
      p.addEventListener("pointerenter", () => { p.classList.add("hot"); labels[i].classList.add("hot"); g.appendChild(p); });
      p.addEventListener("pointerleave", () => { p.classList.remove("hot"); labels[i].classList.remove("hot"); });
      return p;
    });
    marksG = el("g", { class: "f1-marks" }, svg);
    const lg = el("g", { class: "f1-codes" }, svg);
    labels = Array.from({ length: SLOTS }, () => el("text", { class: "f1-code", x: W - PAD.r + 6 }, lg));
  }

  /* marks, labels and the tally belong to one settled race */
  function settle(i) {
    const c = charts[i];
    marksG.replaceChildren();
    scG.replaceChildren();
    for (const [u0, u1] of c.sc) el("rect", { x: X(u0), y: PAD.t - 4, width: Math.max(1, X(u1) - X(u0)), height: H - PAD.t - PAD.b + 8 }, scG);
    marks = c.passes.map((p) => ({ u: p.u, e: el("circle", { class: "f1-pass", cx: X(p.u), cy: Y(p.r), r: 4 }, marksG) }));
    c.slots.forEach((s, k) => {
      labels[k].textContent = s.finished ? s.code : "";
      labels[k].setAttribute("y", Y(s.s[SAMPLES]) + 3.5);
    });
    caption(i);
  }
  let captioned = -1;
  function caption(i) {
    if (i === captioned) return;
    captioned = i;
    const c = charts[i], s = STOPS[i];
    raceEl.textContent = `${c.race.circuit} ${c.race.year}`;
    avgEl.innerHTML = `${s.avg.toFixed(1)} a race on average · ${s.rank} of 28 · <b>${s.verdict}</b>`;
    axis.end.textContent = `LAP ${c.laps}`;
  }

  function pathFor(a, b, k, m) {
    const sa = charts[a].slots[k], sb = charts[b].slots[k];
    const last = Math.round((m < 0.5 ? sa.end : sb.end) * SAMPLES);
    let d = "";
    for (let i = 0; i <= last; i += 1) {
      const r = sa.s[i] + (sb.s[i] - sa.s[i]) * m;
      d += `${i ? "L" : "M"}${X(i / SAMPLES).toFixed(1)} ${Y(r).toFixed(1)}`;
    }
    return d;
  }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = 0;
    const raw = parseFloat(sec.style.getPropertyValue("--x")) || 0;
    const x = Math.min(raw, LAST);
    const a = Math.floor(x), b = Math.min(LAST, a + 1), m = x - a;
    const near = Math.round(x);
    const still = Math.abs(x - near) < 0.004;
    let again = false;

    if (charts) {
      if (!W) build();
      if (drawStart < 0 && visible) drawStart = reduceMotion ? now - DRAW_MS : now;
      const reveal = drawStart < 0 ? 0 : Math.min(1, (now - drawStart) / DRAW_MS);
      clipRect.setAttribute("width", (W * (1 - Math.pow(1 - reveal, 3))).toFixed(1));
      if (reveal < 1) again = true;

      for (let k = 0; k < SLOTS; k += 1) paths[k].setAttribute("d", pathFor(a, b, k, m));

      if (still) {
        if (landed !== near) { landed = near; landedAt = now; settle(near); }
        const since = reduceMotion ? Infinity : now - Math.max(landedAt, drawStart + DRAW_MS * 0.7);
        let n = 0;
        for (const mk of marks) {
          const on = since > mk.u * MARK_MS;
          if (on) n += 1;
          mk.e.classList.toggle("on", on);
        }
        num.textContent = n;
        if (n < marks.length) again = true;
        svg.classList.add("settled");
      } else {
        if (landed !== -1) { landed = -1; svg.classList.remove("settled"); marks.forEach((mk) => mk.e.classList.remove("on")); }
        num.textContent = Math.round(charts[a].passes.length + (charts[b].passes.length - charts[a].passes.length) * m);
        caption(m < 0.5 ? a : b);
      }
    }

    if (near !== lineOn) { lines.forEach((l, i) => l.classList.toggle("on", i === near)); lineOn = near; }
    const end = raw > LAST + 0.5;
    if (end !== ended) { sec.classList.toggle("f1-end", end); ended = end; }
    if (again && visible) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const ready = (data) => {
    charts = STOPS.map((s) => prepare(data.find((r) => r.circuit === s.name)));
    kick();
  };
  if (window.F1_LAPS) ready(window.F1_LAPS);
  else fetch("f1/laps.json?v=2611290100").then((r) => r.json()).then(ready).catch(() => sec.classList.add("f1-nodata"));

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(sec);
  new MutationObserver(kick).observe(sec, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", () => { W = 0; landed = -1; captioned = -1; kick(); });
})();
