/* DWG 003 detail set: lap chart (003.1), pit-stop scatter (003.3), coefficients and rank slope chart (003.4). */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* reveal on scroll, as on the other detail sets */
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((s) => io.observe(s));

  /* ---------- 003.1 lap chart ---------- */
  const lc = document.getElementById("lc");
  fetch("races.json").then((r) => r.json()).then((races) => {
    const W = 1000, H = 420, L = 34, R = 58, T = 10, B = 26;
    const pick = document.getElementById("lcRaces");
    const out = { n: document.getElementById("lcN"), v1: document.getElementById("lcV1n"), v2: document.getElementById("lcV2n"), stops: document.getElementById("lcStops") };
    const bV2 = document.getElementById("lcV2"), bV1 = document.getElementById("lcV1");
    let cur = 0, mode = "v2";
    races.forEach((r, i) => {
      const b = document.createElement("button");
      b.className = "chip" + (i === 0 ? " on" : ""); b.textContent = r.label.toUpperCase();
      b.addEventListener("click", () => { cur = i; pick.querySelectorAll(".chip").forEach((c, j) => c.classList.toggle("on", j === i)); draw(); });
      pick.appendChild(b);
    });
    const setMode = (m) => { mode = m; bV2.classList.toggle("on", m === "v2"); bV1.classList.toggle("on", m === "v1"); draw(); };
    bV2.addEventListener("click", () => setMode("v2"));
    bV1.addEventListener("click", () => setMode("v1"));

    function draw() {
      const r = races[cur];
      lc.replaceChildren();
      const n = r.laps.length, nd = r.drivers.length;
      const x = (i) => L + (i / (n - 1)) * (W - L - R);
      const y = (p) => T + ((p - 1) / (nd - 1)) * (H - T - B);
      const step = (W - L - R) / (n - 1);
      r.neu.forEach((v, i) => { if (v) el("rect", { class: "sc-band", x: x(i) - step / 2, y: T - 4, width: step, height: H - T - B + 8 }, lc); });
      for (let p = 1; p <= nd; p += 1) {
        el("line", { class: "grid", x1: L, x2: W - R, y1: y(p), y2: y(p) }, lc);
        if (p === 1 || p % 5 === 0) el("text", { class: "ax", x: L - 8, y: y(p) + 3, "text-anchor": "end" }, lc).textContent = "P" + p;
      }
      for (let i = 0; i < n; i += 1) if (r.laps[i] === 1 || r.laps[i] % 10 === 0) el("text", { class: "ax", x: x(i), y: H - 6, "text-anchor": "middle" }, lc).textContent = "L" + r.laps[i];
      const lines = {}, labs = {};
      for (const d of r.drivers) {
        const pts = [];
        r.pos[d].forEach((p, i) => { if (p) pts.push(`${x(i).toFixed(1)},${y(p).toFixed(1)}`); });
        if (pts.length < 2) continue;
        lines[d] = el("polyline", { class: "drv", points: pts.join(" ") }, lc);
        let last = r.pos[d].length - 1;
        while (last > 0 && !r.pos[d][last]) last -= 1;
        labs[d] = el("text", { class: "lab", x: x(last) + 6, y: y(r.pos[d][last]) + 3 }, lc);
        labs[d].textContent = d;
        const hot = (on) => { lines[d].classList.toggle("hot", on); labs[d].classList.toggle("hot", on); if (on) lc.appendChild(lines[d]); };
        lines[d].addEventListener("mouseenter", () => hot(true));
        lines[d].addEventListener("mouseleave", () => hot(false));
        r.pit[d].forEach((pt, i) => { if (pt && r.pos[d][i]) el("circle", { class: "pitm", cx: x(i), cy: y(r.pos[d][i]), r: 2.4 }, lc); });
      }
      const evs = mode === "v2" ? r.v2.map(([w, , i]) => [w, i]) : r.v1.map(([d, i]) => [d, i]);
      for (const [d, i] of evs) if (r.pos[d] && r.pos[d][i]) el("circle", { class: "ev", cx: x(i), cy: y(r.pos[d][i]), r: 3.4 }, lc);
      out.n.textContent = mode === "v2" ? r.v2n : r.v1n;
      out.v1.textContent = r.v1n; out.v2.textContent = r.v2n; out.stops.textContent = r.stops;
    }
    draw();
  });

  /* ---------- 003.3 scatter ---------- */
  const sc = document.getElementById("sc");
  fetch("scatter.json").then((r) => r.json()).then((rows) => {
    const W = 520, H = 400, L = 44, R = 14, T = 16, B = 40;
    const xmax = 110, ymax = 190;
    const x = (v) => L + (v / xmax) * (W - L - R), y = (v) => H - B - (v / ymax) * (H - T - B);
    for (let v = 0; v <= ymax; v += 50) { el("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }, sc); el("text", { class: "ax", x: L - 6, y: y(v) + 3, "text-anchor": "end" }, sc).textContent = v; }
    for (let v = 0; v <= xmax; v += 25) el("text", { class: "ax", x: x(v), y: H - B + 16, "text-anchor": "middle" }, sc).textContent = v;
    el("line", { class: "axl", x1: L, x2: W - R, y1: H - B, y2: H - B }, sc);
    el("line", { class: "axl", x1: L, x2: L, y1: T, y2: H - B }, sc);
    el("text", { class: "ax", x: (L + W - R) / 2, y: H - 6, "text-anchor": "middle" }, sc).textContent = "PIT STOPS IN THE RACE";
    const yl = el("text", { class: "ax", x: 12, y: (T + H - B) / 2, "text-anchor": "middle", transform: `rotate(-90 12 ${(T + H - B) / 2})` }, sc);
    yl.textContent = "COUNT";
    const fit = el("line", { class: "fit" }, sc);
    const rlab = el("text", { class: "rlab", x: W - R - 4, y: T + 14, "text-anchor": "end" }, sc);
    const read = document.getElementById("scRead");
    const dots = rows.map(([ev, yr, pits]) => {
      const d = el("circle", { class: "dot" + (ev === "Qatar" && yr === 2023 ? " qat" : ""), cx: x(pits), r: 3.6 }, sc);
      return d;
    });
    const stats = (k) => {
      const xs = rows.map((r) => r[2]), ys = rows.map((r) => r[k]);
      const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
      let sxy = 0, sxx = 0, syy = 0;
      xs.forEach((v, i) => { sxy += (v - mx) * (ys[i] - my); sxx += (v - mx) ** 2; syy += (ys[i] - my) ** 2; });
      const b = sxy / sxx;
      return { r: sxy / Math.sqrt(sxx * syy), a: my - b * mx, b };
    };
    const bV1 = document.getElementById("scV1"), bV2 = document.getElementById("scV2");
    function show(k) {
      bV1.classList.toggle("on", k === 3); bV2.classList.toggle("on", k === 4);
      dots.forEach((d, i) => d.setAttribute("cy", y(rows[i][k])));
      const s = stats(k);
      fit.setAttribute("x1", x(0)); fit.setAttribute("x2", x(xmax));
      fit.setAttribute("y1", y(Math.max(0, s.a))); fit.setAttribute("y2", y(s.a + s.b * xmax));
      rlab.textContent = `r = ${s.r.toFixed(2)}`;
      dots.forEach((d, i) => { d.onmouseenter = () => { const [ev, yr, p, a, b] = rows[i]; read.textContent = `${ev} ${yr} · ${p} pit stops · V1 ${a} · V2 ${b}`; }; });
    }
    bV1.addEventListener("click", () => show(3));
    bV2.addEventListener("click", () => show(4));
    show(4);
  });

  /* ---------- 003.4 coefficients ---------- */
  const COEF = [["Track length", 0.0815], ["Longest straight", 0.0604], ["Corners per km", -0.0567], ["Street circuit", -0.0229], ["DRS zones", 0.0081]];
  const coef = document.getElementById("coef");
  const cmax = 0.09;
  for (const [name, v] of COEF) {
    const li = document.createElement("li");
    const w = (Math.abs(v) / cmax) * 50;
    li.innerHTML = `<span>${name}</span><span class="cbar"><i class="${v < 0 ? "neg" : ""}" style="${v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`}"></i></span><b>${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(3)}</b>`;
    coef.appendChild(li);
  }

  /* ---------- 003.4 slope chart ---------- */
  const sl = document.getElementById("sl");
  fetch("ranks.json").then((r) => r.json()).then((rows) => {
    const W = 520, H = 560, T = 30, B = 10, xa = 150, xb = 370;
    const y = (k) => T + ((k - 1) / 27) * (H - T - B);
    el("text", { class: "ax", x: xa, y: 14, "text-anchor": "end" }, sl).textContent = "ACTUAL";
    el("text", { class: "ax", x: xb, y: 14 }, sl).textContent = "PREDICTED";
    for (const [name, a, p, n] of rows) {
      const g = el("g", { class: "row" }, sl);
      el("line", { class: "ln" + (Math.abs(a - p) >= 12 ? " big" : ""), x1: xa + 6, y1: y(a), x2: xb - 6, y2: y(p) }, g);
      el("text", { x: xa - 4, y: y(a) + 3.5, "text-anchor": "end" }, g).textContent = `${name}${n <= 3 ? " †" : ""} ${String(a).padStart(2, "0")}`;
      el("text", { x: xb + 4, y: y(p) + 3.5 }, g).textContent = `${String(p).padStart(2, "0")} ${name}`;
      el("rect", { x: 0, y: y(a) - 7, width: W, height: 0, fill: "transparent" }, g);
    }
  });
})();
