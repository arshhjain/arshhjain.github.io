(() => {
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svgPt = (svg, ev) => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const dragOn = (svg, onValue) => {
    let on = false;
    svg.addEventListener("pointerdown", (ev) => { on = true; svg.setPointerCapture(ev.pointerId); svg.classList.add("dragging"); onValue(svgPt(svg, ev)); });
    svg.addEventListener("pointermove", (ev) => { if (on) onValue(svgPt(svg, ev)); });
    const stop = () => { on = false; svg.classList.remove("dragging"); };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
  };

  /* ---------- reveal ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((n) => revealObs.observe(n));

  /* ---------- 001.1 system map: one loop, two students ---------- */
  (() => {
    const svg = $(".map");
    if (!svg) return;
    const packet = $(".packet:not(.side)", svg), side = $(".packet.side", svg);
    const log = $(".route-log"), phaseEl = $("#mapPhase");
    const nodes = [...svg.querySelectorAll(".node[data-n]")].map((n) => {
      const m = /translate\((\d+) (\d+)\)/.exec(n.getAttribute("transform"));
      return { n, name: n.dataset.n, x: +m[1], y: +m[2], w: 120, h: 60 };
    });
    const inNode = (p) => nodes.find((o) => p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y - 4 && p.y <= o.y + o.h);
    const order = ["UPLOAD", "EXTRACT", "RECALL", "UNDERSTAND", "STORE", "TOPICS", "RENDER"];
    const phases = [
      {
        label: "STUDENT 1 · FIRST UPLOAD", cls: "ph-a",
        main: "M80 90 H920", fork: "UNDERSTAND", side: "M590 120 L500 196", dur: 4600,
        steps: { UPLOAD: "file lands in uploads/", EXTRACT: "text out · file deleted", RECALL: "nothing ≥ 0.85 · MISS", UNDERSTAND: "Gemini → {subject, tree}", STORE: "output + vector → cache.db", TOPICS: "3 gates · +1 hit per node", RENDER: "tree + ticks" },
        skip: []
      },
      {
        label: "STUDENT 2 · SAME LECTURE", cls: "ph-b",
        main: "M80 90 H390 L478 200 L390 90 V60 C390 8 760 8 760 60 V90 H920", fork: "", side: "M0 0", dur: 6200,
        steps: { UPLOAD: "file lands in uploads/", EXTRACT: "text out · file deleted", RECALL: "student 1's row ≥ 0.85 · HIT", UNDERSTAND: "skipped · no LLM call", STORE: "stored output read back", TOPICS: "3 gates · +1 hit per node", RENDER: "'served from cache'" },
        skip: ["UNDERSTAND"]
      }
    ];
    const mk = () => el("path", { class: "probe" }, svg);
    const probe = mk(), sprobe = mk();
    let DUR = 4600; const HOLD = 1100, SIDE = 1000;
    let ph = 0, t0 = 0, len = 0, slen = 0, forkF = 0, visible = false, raf = 0;

    function setPhase(i) {
      ph = i;
      const P = phases[i];
      probe.setAttribute("d", P.main); len = probe.getTotalLength();
      sprobe.setAttribute("d", P.side); slen = sprobe.getTotalLength();
      forkF = 0; DUR = P.dur;
      for (let k = 0; k <= 400; k++) {
        const pt = probe.getPointAtLength((len * k) / 400), o = inNode(pt);
        if (P.fork && o && o.name === P.fork && Math.abs(pt.x - (o.x + 60)) < 4) { forkF = k / 400; break; }
      }
      svg.classList.remove("ph-a", "ph-b"); svg.classList.add(P.cls);
      phaseEl.textContent = P.label;
      log.innerHTML = order.map((k) => `<li data-k="${k}" class="${P.skip.includes(k) ? "skip" : ""}"><b>${k}</b>${P.steps[k]}</li>`).join("");
      t0 = performance.now();
    }
    const ease = (f) => (f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const t = now - t0;
      if (t > DUR + HOLD) { setPhase((ph + 1) % phases.length); raf = requestAnimationFrame(frame); return; }
      const f = Math.min(1, t / DUR), e = ease(f);
      const p = probe.getPointAtLength(len * e);
      packet.setAttribute("cx", p.x.toFixed(1)); packet.setAttribute("cy", p.y.toFixed(1));
      const tFork = forkF <= 0 ? Infinity : (() => { let lo = 0, hi = 1; for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; (ease(m) < forkF ? (lo = m) : (hi = m)); } return lo * DUR; })();
      const sf = (t - tFork) / SIDE;
      let sideOn = false;
      if (sf >= 0 && sf <= 1) {
        const sp = sprobe.getPointAtLength(slen * ease(sf));
        side.setAttribute("cx", sp.x.toFixed(1)); side.setAttribute("cy", sp.y.toFixed(1));
        sideOn = true;
      } else { side.setAttribute("cx", -100); side.setAttribute("cy", -100); }
      side.style.opacity = sideOn ? 1 : 0;
      const at = inNode(p);
      nodes.forEach((o) => o.n.classList.toggle("lit", (at && o === at) || (sideOn && o.name === "STORE" && sf > .35)));
      const litMain = at ? at.name : null;
      [...log.children].forEach((li) => li.classList.toggle("on", li.dataset.k === litMain || (sideOn && li.dataset.k === "STORE")));
      raf = requestAnimationFrame(frame);
    }
    setPhase(0);
    if (reduce) { [...log.children].forEach((li) => li.classList.add("on")); return; }
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible && !raf) { setPhase(0); raf = requestAnimationFrame(frame); }
    }, { threshold: 0.3 }).observe(svg);
  })();

  /* ---------- 001.3 terminal ---------- */
  (() => {
    const pre = $("#uTerm");
    if (!pre) return;
    const k = (s) => `<span class="key">"${s}"</span>`;
    const lines = [
      `<span class="dim">$ analyze_text(lecture)  · model gemini-3-flash-preview · contract in system_instruction</span>`,
      `<span class="dim">← raw response</span>`,
      `<span class="strike">\`\`\`json</span>`,
      `{ ${k("subject")}: "Machine Learning",`,
      `  ${k("tree")}: { ${k("topic")}: "Supervised Learning", ${k("children")}: [`,
      `    { ${k("topic")}: "Linear Regression", ${k("children")}: [`,
      `        { ${k("topic")}: "Cost Function", ${k("children")}: [] },`,
      `        { ${k("topic")}: "Gradient Descent", ${k("children")}: [] } ] },`,
      `    { ${k("topic")}: "Logistic Regression", ${k("children")}: [`,
      `        { ${k("topic")}: "Sigmoid Function", ${k("children")}: [] } ] } ] } }`,
      `<span class="strike">\`\`\`</span>`,
      `<span class="dim">slice [first "{" … last "}"] → json.loads</span>  <span class="ok">✓</span>`,
      `<span class="ok">subject</span>  Machine Learning`,
      `<span class="ok">flatten</span>  Supervised Learning · Linear Regression · Cost Function · Gradient Descent · Logistic Regression · Sigmoid Function`,
      `<span class="hit">→ 6 topics handed to 001.4</span> <span class="caret"></span>`
    ];
    if (reduce) { pre.innerHTML = lines.join("\n"); return; }
    let started = false;
    new IntersectionObserver((e) => {
      if (!e[0].isIntersecting || started) return;
      started = true;
      let i = 0;
      const tick = () => {
        pre.innerHTML = lines.slice(0, ++i).join("\n");
        if (i < lines.length) setTimeout(tick, i < 3 ? 380 : 150);
      };
      tick();
    }, { threshold: 0.35 }).observe(pre);
  })();

  /* ---------- 001.4 normalize_topic_name ---------- */
  (() => {
    const inp = $("#normIn"), out = $("#normOut");
    if (!inp) return;
    const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, "").split(/\s+/).filter(Boolean).join(" ");
    const run = () => { out.textContent = `"${norm(inp.value)}"`; };
    inp.addEventListener("input", run);
    run();
  })();

  /* ---------- 001.5 decay ---------- */
  (() => {
    const svg = $("#decay"), scoresEl = $("#decayScores");
    if (!svg) return;
    const X0 = 40, X1 = 460, DAYS = 30, LH = 72;
    const xOf = (d) => X1 - (d / DAYS) * (X1 - X0);
    const dOf = (x) => Math.round(Math.max(0, Math.min(DAYS, ((X1 - x) / (X1 - X0)) * DAYS)));
    const lanes = [
      { key: "a", name: "TOPIC A · one burst, 3 weeks ago", y: 26 },
      { key: "b", name: "TOPIC B · one a day, this week", y: 122 }
    ];
    const preset = () => ({ a: Array(10).fill(20), b: [0, 1, 2, 3, 4] });
    let hits = preset();
    const score = (arr) => arr.reduce((s, d) => s + Math.exp(-0.1 * d), 0);
    const count = (key, d) => hits[key].filter((x) => x === d).length;

    const base = el("g", {}, svg);
    for (let d = 0; d <= DAYS; d += 5) {
      el("line", { class: "tick", x1: xOf(d), x2: xOf(d), y1: 20, y2: 290 }, base);
      const t = el("text", { class: "sub", x: xOf(d), y: 302, "text-anchor": "middle" }, base);
      t.textContent = d === 0 ? "today" : `${d}d`;
    }
    const KY0 = 284, KY1 = 214;
    let dk = "";
    for (let d = 0; d <= DAYS; d += 0.5) dk += `${d ? "L" : "M"}${xOf(d).toFixed(1)} ${(KY0 - (KY0 - KY1) * Math.exp(-0.1 * d)).toFixed(1)} `;
    el("path", { class: "kernel", d: dk }, base);
    const hx = xOf(Math.LN2 / 0.1);
    el("line", { class: "half", x1: hx, x2: hx, y1: KY1 - 4, y2: KY0 }, base);
    const ht = el("text", { class: "sub", x: hx + 5, y: KY0 - 6 }, base); ht.textContent = "t½ ≈ 6.9d";
    const kt = el("text", { class: "sub", x: X0, y: KY1 - 8 }, base); kt.textContent = "weight of one hit = e^(−0.1·days)";

    const dots = el("g", { "pointer-events": "none" }, svg);
    const ghosts = {};
    lanes.forEach((L) => {
      const t = el("text", { class: "sub", x: X0, y: L.y - 6 }, base);
      t.textContent = L.name;
      const r = el("rect", { class: "lane", x: X0 - 8, y: L.y, width: X1 - X0 + 16, height: LH, tabindex: 0, role: "button", "aria-label": `${L.name}: click to add or remove a hit` }, svg);
      const g = el("g", { class: "ghost", "pointer-events": "none" }, svg);
      const gl = el("line", { y1: L.y + 4, y2: L.y + LH - 4 }, g);
      const gt = el("text", { x: X1 + 8, y: L.y - 6, "text-anchor": "end" }, g);
      ghosts[L.key] = { g, gl, gt };
      const show = (d) => {
        const n = count(L.key, d);
        g.style.display = "";
        gl.setAttribute("x1", xOf(d)); gl.setAttribute("x2", xOf(d));
        gt.textContent = n ? `− remove · ${d}d` : `+ add hit · ${d}d`;
        g.classList.toggle("rm", !!n);
      };
      r.addEventListener("pointermove", (ev) => show(dOf(svgPt(svg, ev).x)));
      r.addEventListener("pointerleave", () => { g.style.display = "none"; });
      r.addEventListener("click", (ev) => {
        const d = dOf(svgPt(svg, ev).x);
        const i = hits[L.key].indexOf(d);
        if (i >= 0) hits[L.key].splice(i, 1); else hits[L.key].push(d);
        draw(); show(d);
      });
      g.style.display = "none";
    });
    svg.appendChild(dots);

    function draw() {
      dots.innerHTML = "";
      lanes.forEach((L) => {
        const days = {};
        hits[L.key].forEach((d) => { days[d] = (days[d] || 0) + 1; });
        Object.entries(days).forEach(([d, n]) => {
          const show = Math.min(n, 5);
          for (let k = 0; k < show; k++) el("circle", { class: `hitdot ${L.key}`, cx: xOf(+d), cy: L.y + LH - 10 - k * 11, r: 5 }, dots);
          if (n > 5) { const t = el("text", { class: "stackn", x: xOf(+d) + 9, y: L.y + LH - 52 }, dots); t.textContent = `×${n}`; }
        });
      });
      const sa = score(hits.a), sb = score(hits.b), mx = Math.max(sa, sb, 0.0001);
      scoresEl.innerHTML = lanes.map((L) => {
        const s = L.key === "a" ? sa : sb;
        const win = s > 0 && s === mx && sa !== sb;
        return `<div class="${L.key}${win ? " win" : ""}">${L.key.toUpperCase()} · ${hits[L.key].length} hits<b>${s.toFixed(2)}</b><i style="width:${(s / mx) * 100}%"></i></div>`;
      }).join("");
    }
    $("#decayReset").addEventListener("click", () => { hits = preset(); draw(); });
    draw();
  })();

  /* ---------- 001.6 query builder ---------- */
  (() => {
    const topic = $("#qbTopic"), sim = $("#qbSim"), simOut = $("#qbSimOut"), q = $("#qbQuery"), br = $("#qbBranch");
    if (!topic) return;
    const run = () => {
      const v = +sim.value, t = topic.value.trim() || "…";
      simOut.textContent = v.toFixed(2);
      if (v >= 0.45) { br.textContent = "RULE CLEARS 0.45 → SCOPED TO SOURCE"; q.textContent = `"${t} StatQuest"`; }
      else { br.textContent = "NO RULE CLEARS 0.45 → DEFAULT QUERY"; q.textContent = `"${t} university lecture"`; }
    };
    topic.addEventListener("input", run); sim.addEventListener("input", run); run();
  })();

  /* ---------- 001.6 adaptive loop ---------- */
  (() => {
    const svg = $("#lpSvg"), n = $("#lpN"), nOut = $("#lpNOut"), read = $("#lpRead");
    if (!svg) return;
    const X0 = 50, X1 = 410, MAX = 80;
    const xOf = (u) => X0 + (u / MAX) * (X1 - X0);
    const yOf = (h) => ({ 12: 22, 2: 72, 0.5: 108 })[h];
    const interval = (u) => (u < 20 ? 12 : u <= 50 ? 2 : 0.5);
    el("rect", { class: "hitpad", x: 0, y: 0, width: 420, height: 140 }, svg);
    [[12, "12 h"], [2, "2 h"], [0.5, "30 min"]].forEach(([h, l]) => {
      const t = el("text", { class: "sub", x: 0, y: yOf(h) + 4 }, svg); t.textContent = l;
    });
    [0, 20, 50, 80].forEach((u) => { const t = el("text", { class: "sub", x: xOf(u), y: 134, "text-anchor": "middle" }, svg); t.textContent = u; });
    el("path", { class: "st", d: `M${xOf(0)} ${yOf(12)} H${xOf(20)} V${yOf(2)} H${xOf(50)} V${yOf(0.5)} H${xOf(80)}` }, svg);
    const cur = el("line", { class: "cur", y1: 8, y2: 122 }, svg);
    const knob = el("rect", { class: "knob", width: 16, height: 22, rx: 0 }, svg);
    const run = () => {
      const u = +n.value, h = interval(u);
      nOut.textContent = u;
      cur.setAttribute("x1", xOf(u)); cur.setAttribute("x2", xOf(u));
      knob.setAttribute("x", xOf(u) - 8); knob.setAttribute("y", yOf(h) - 11);
      const lbl = h === 0.5 ? "30 minutes" : `${h} hours`;
      read.textContent = `${u} upload${u === 1 ? "" : "s"} today → wakes every ${lbl}, takes the top-20 trending topics with no resource, resolves them 3 at a time.`;
    };
    dragOn(svg, (p) => { n.value = Math.round(Math.max(0, Math.min(MAX, ((p.x - X0) / (X1 - X0)) * MAX))); run(); });
    n.addEventListener("input", run); run();
  })();

  /* ---------- 001.7 ruler ---------- */
  (() => {
    const svg = $("#ruler"), list = $("#verdicts");
    if (!svg) return;
    const X0 = 24, X1 = 496;
    const xOf = (v) => X0 + v * (X1 - X0);
    let v = 0.7;
    el("rect", { class: "hitpad", x: 0, y: 0, width: 520, height: 120 }, svg);
    for (let i = 0; i <= 100; i += 5) {
      const major = i % 10 === 0;
      el("line", { class: `tk${major ? " m" : ""}`, x1: xOf(i / 100), x2: xOf(i / 100), y1: 52, y2: major ? 68 : 60 }, svg);
      if (major) { const t = el("text", { class: "sub", x: xOf(i / 100), y: 82, "text-anchor": "middle" }, svg); t.textContent = (i / 100).toFixed(1); }
    }
    el("line", { class: "tk m", x1: X0, x2: X1, y1: 52, y2: 52 }, svg);
    [[0.45, "CONSTITUTION"], [0.65, "TOPIC"], [0.85, "RECALL"]].forEach(([t, l]) => {
      el("line", { class: "th", x1: xOf(t), x2: xOf(t), y1: 20, y2: 68 }, svg);
      const tx = el("text", { class: "thl", x: xOf(t), y: 14, "text-anchor": "middle" }, svg); tx.textContent = `${l} ${t}`;
    });
    const cur = el("g", { class: "cursor" }, svg);
    el("line", { x1: 0, x2: 0, y1: 26, y2: 92 }, cur);
    el("rect", { class: "grip", x: -11, y: 88, width: 22, height: 26 }, cur);
    el("path", { class: "grip-l", d: "M-4 95 V107 M0 95 V107 M4 95 V107" }, cur);
    const cl = el("text", { class: "cursor-l", x: 16, y: 106 }, cur);
    const words = {
      "0.85": ["serve the peer's map", "call Gemini"],
      "0.65": ["reuse topic id", "new topic"],
      "0.45": ["scope to the source", "university lecture"]
    };
    const run = () => {
      cur.setAttribute("transform", `translate(${xOf(v).toFixed(1)} 0)`);
      cl.textContent = `cos ${v.toFixed(2)}`;
      cl.setAttribute("x", v > 0.82 ? -92 : 16);
      svg.setAttribute("aria-valuenow", v.toFixed(2));
      [...list.children].forEach((li) => {
        const t = li.dataset.t, pass = v >= +t;
        li.classList.toggle("pass", pass);
        $("em", li).textContent = pass ? words[t][0] : words[t][1];
      });
    };
    dragOn(svg, (p) => { v = Math.round(Math.max(0, Math.min(1, (p.x - X0) / (X1 - X0))) * 100) / 100; run(); });
    svg.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.1 : 0.01;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") v = Math.min(1, +(v + step).toFixed(2));
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = Math.max(0, +(v - step).toFixed(2));
      else return;
      e.preventDefault(); run();
    });
    run();
  })();

  /* ---------- 001.8 mastery ---------- */
  (() => {
    const root = $("#mTree");
    if (!root) return;
    const tree = { topic: "Supervised Learning", children: [
      { topic: "Linear Regression", children: [{ topic: "Cost Function" }, { topic: "Gradient Descent" }] },
      { topic: "Logistic Regression", children: [{ topic: "Sigmoid Function" }, { topic: "Decision Boundary" }] },
      { topic: "Evaluation", children: [{ topic: "Train/Test Split" }] }
    ] };
    const render = (node, depth) => {
      const li = document.createElement("li");
      const lab = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      lab.append(cb, document.createTextNode(node.topic));
      if (depth === 0) lab.classList.add("root");
      const leaf = !node.children || !node.children.length;
      if (leaf) li.classList.add("leaf");
      else { const s = document.createElement("small"); s.textContent = depth === 0 ? "ROOT" : "PARENT"; lab.append(s); }
      li.append(lab);
      if (!leaf) {
        const ul = document.createElement("ul");
        node.children.forEach((c) => ul.append(render(c, depth + 1)));
        li.append(ul);
      }
      return li;
    };
    root.append(render(tree, 0));
    const boxOf = (li) => li.querySelector(":scope > label > input");
    const childLis = (li) => [...li.querySelectorAll(":scope > ul > li")];
    const sync = () => {
      root.querySelectorAll("label").forEach((l) => l.classList.toggle("done", $("input", l).checked));
      const leaves = [...root.querySelectorAll("li.leaf")];
      const done = leaves.filter((li) => boxOf(li).checked).length;
      $("#mCount").textContent = `${done} of ${leaves.length} mastered`;
      $("#mFill").style.width = `${(done / leaves.length) * 100}%`;
    };
    root.addEventListener("change", (e) => {
      const li = e.target.closest("li");
      const state = e.target.checked;
      li.querySelectorAll("input").forEach((x) => { x.checked = state; });
      let p = li.parentElement.closest("li");
      while (p) {
        boxOf(p).checked = childLis(p).every((c) => boxOf(c).checked);
        p = p.parentElement.closest("li");
      }
      sync();
    });
    sync();
  })();

  /* ---------- 001.9 ladders ---------- */
  (() => {
    const host = $("#ladders");
    if (!host) return;
    const data = [
      ["EXTRACT", [["Text extracted by file type", "PyPDF2 · python-docx · python-pptx · utf-8"], ["No extractable text", "400 · 'may be an image-based scan'"]]],
      ["RECALL", [["Nearest stored doc ≥ 0.85", "serve its analysis · peer_cache: true"], ["Nothing clears 0.85", "full Gemini call, then stored"]]],
      ["UNDERSTAND", [["Clean JSON", "json.loads straight"], ["Fenced or chatty JSON", "slice first { … last }"], ["Still unparseable", "500 with the parse error"]]],
      ["TOPIC IDENTITY", [["Exact name", "reuse the row"], ["Nearest name ≥ 0.65", "reuse that id"], ["Nothing close", "insert a new topic"]]],
      ["CONSTITUTION", [["Best rule ≥ 0.45", "query: topic + source_name"], ["No rule, or too weak", "query: topic + 'university lecture'"]]],
      ["YOUTUBE SCRAPE", [["ytInitialData = {…};", "first regex"], ["…inside a <script> block", "DOTALL regex"], ["Brace-counting scanner", "walks { } from the variable name"], ["Blocked, or zero videos", "plain search-results URL"]]],
      ["BACKGROUND LOOP", [["Batch resolves", "3 workers · top-20 trending"], ["One topic throws", "logged · other futures carry on"], ["Whole iteration throws", "sleep 60 s, go again"]]],
      ["TIMESTAMPS", [["%Y-%m-%d %H:%M:%S", "SQLite's default"], ["ISO 8601", "datetime.fromisoformat"], ["Unparseable", "treat the hit as now"]]],
      ["SCHEMA", [["Current schema", "no-op"], ["Missing columns", "ALTER TABLE … ADD COLUMN"], ["Old topic_name schema", "drop and rebuild"]]]
    ];
    host.innerHTML = data.map(([name, rungs]) => `
      <div class="ladder">
        <h4>${name}<span>${rungs.length} RUNGS</span></h4>
        <ol class="rungs">${rungs.map(([a, b], i) => `<li><button class="rung${i === 0 ? " live" : ""}${i === rungs.length - 1 ? " floor" : ""}" type="button"><i></i><span>${a.replace(/</g, "&lt;")}<small>${b.replace(/</g, "&lt;")}</small></span><em class="brk">BREAK ✕</em></button></li>`).join("")}</ol>
      </div>`).join("");
    host.addEventListener("click", (e) => {
      const r = e.target.closest(".rung");
      if (!r || !r.classList.contains("live") || r.classList.contains("floor")) return;
      r.classList.remove("live"); r.classList.add("broke");
      const next = r.closest("li").nextElementSibling;
      if (next) $(".rung", next).classList.add("live");
    });
    $("#ftReset").addEventListener("click", () => {
      host.querySelectorAll(".ladder").forEach((l) => {
        l.querySelectorAll(".rung").forEach((r, i) => { r.classList.remove("broke"); r.classList.toggle("live", i === 0); });
      });
    });
  })();

  /* ---------- 001.R subset ---------- */
  (() => {
    const gA = $(".subset .chs:not(.b)"), gB = $(".subset .chs.b");
    if (!gA) return;
    for (let i = 0; i < 10; i++) {
      const shared = i >= 2 && i <= 6;
      el("rect", { x: i * 46, y: 0, width: 40, height: 40, class: shared ? "shared" : "" }, gA);
      const t = el("text", { x: i * 46 + 20, y: 25, "text-anchor": "middle" }, gA); t.textContent = `CH${i + 1}`;
      if (shared) {
        el("rect", { x: i * 46, y: 0, width: 40, height: 40 }, gB);
        const tb = el("text", { x: i * 46 + 20, y: 25, "text-anchor": "middle" }, gB); tb.textContent = `CH${i + 1}`;
      }
    }
  })();
})();
