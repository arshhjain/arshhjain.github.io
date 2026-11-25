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

  /* ---------- reveal ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((n) => revealObs.observe(n));

  /* ---------- 001.1 system map ---------- */
  (() => {
    const svg = $(".map");
    if (!svg) return;
    const packet = $(".packet", svg);
    const log = $(".route-log");
    const nodes = [...svg.querySelectorAll(".node")];
    const nodeAt = (x) => nodes.find((n) => {
      const m = /translate\((\d+) (\d+)\)/.exec(n.getAttribute("transform"));
      return m && +m[2] === 60 && x >= +m[1] && x <= +m[1] + 120;
    });
    const routes = {
      miss: {
        d: "M80 90 H920",
        steps: [
          ["UPLOAD", "file lands in uploads/"],
          ["EXTRACT", "text out · file deleted"],
          ["RECALL", "no neighbour ≥ 0.85 · MISS"],
          ["UNDERSTAND", "Gemini → {subject, tree}"],
          ["TOPICS", "3 gates · +1 hit per node"],
          ["RENDER", "tree + ticks"]
        ],
        skip: []
      },
      hit: {
        d: "M80 90 H390 V120 C390 175 760 175 760 122 V90 H920",
        steps: [
          ["UPLOAD", "file lands in uploads/"],
          ["EXTRACT", "text out · file deleted"],
          ["RECALL", "neighbour ≥ 0.85 · HIT"],
          ["UNDERSTAND", "skipped · no LLM call"],
          ["TOPICS", "3 gates · +1 hit per node"],
          ["RENDER", "'served from cache'"]
        ],
        skip: [3]
      }
    };
    const probe = el("path", { class: "probe" }, svg);
    let route = "miss", t0 = 0, len = 0, marks = [], visible = false, raf = 0;
    const DUR = 4200, HOLD = 1400;

    function build() {
      const r = routes[route];
      probe.setAttribute("d", r.d);
      len = probe.getTotalLength();
      marks = [];
      const seen = new Set();
      for (let i = 0; i <= 300; i++) {
        const p = probe.getPointAtLength((len * i) / 300);
        if (Math.abs(p.y - 90) > 1) continue;
        const n = nodeAt(p.x);
        if (n && !seen.has(n)) { seen.add(n); marks.push({ n, f: i / 300 }); }
      }
      log.innerHTML = r.steps.map(([a, b], i) => `<li class="${r.skip.includes(i) ? "skip" : ""}"><b>${a}</b>${b}</li>`).join("");
      svg.classList.toggle("route-hit", route === "hit");
      t0 = performance.now();
    }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const el2 = (now - t0) % (DUR + HOLD);
      const f = Math.min(1, el2 / DUR);
      const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const p = probe.getPointAtLength(len * e);
      packet.setAttribute("cx", p.x.toFixed(1));
      packet.setAttribute("cy", p.y.toFixed(1));
      nodes.forEach((n) => n.classList.remove("lit"));
      let lastIdx = -1;
      marks.forEach((m, i) => { if (e >= m.f - 0.005) lastIdx = i; });
      if (lastIdx >= 0) marks[lastIdx].n.classList.add("lit");
      const steps = [...log.children];
      const stepNames = routes[route].steps.map((s) => s[0]);
      const litName = lastIdx >= 0 ? $("text", marks[lastIdx].n).textContent : "";
      const litStep = stepNames.indexOf(litName);
      steps.forEach((li, i) => li.classList.toggle("on", i === litStep));
      raf = requestAnimationFrame(frame);
    }
    document.querySelectorAll("[data-route]").forEach((b) => b.addEventListener("click", () => {
      route = b.dataset.route;
      document.querySelectorAll("[data-route]").forEach((x) => x.classList.toggle("on", x === b));
      build();
    }));
    build();
    if (reduce) { log.firstElementChild && [...log.children].forEach((li) => li.classList.add("on")); return; }
    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
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
    const X0 = 40, X1 = 460, DAYS = 30;
    const xOf = (d) => X1 - (d / DAYS) * (X1 - X0);
    const dOf = (x) => Math.round(Math.max(0, Math.min(DAYS, ((X1 - x) / (X1 - X0)) * DAYS)));
    const lanes = [
      { key: "a", name: "TOPIC A · one burst, 3 weeks ago", y: 30 },
      { key: "b", name: "TOPIC B · one a day, this week", y: 118 }
    ];
    const preset = () => ({ a: Array(10).fill(20), b: [0, 1, 2, 3, 4] });
    let hits = preset();
    const score = (arr) => arr.reduce((s, d) => s + Math.exp(-0.1 * d), 0);

    const base = el("g", {}, svg);
    for (let d = 0; d <= DAYS; d += 5) {
      el("line", { class: "tick", x1: xOf(d), x2: xOf(d), y1: 24, y2: 290 }, base);
      const t = el("text", { class: "sub", x: xOf(d), y: 298, "text-anchor": "middle" }, base);
      t.textContent = d === 0 ? "today" : `${d}d`;
    }
    lanes.forEach((L) => {
      const r = el("rect", { class: "lane", x: X0, y: L.y, width: X1 - X0, height: 64 }, base);
      r.addEventListener("click", (ev) => {
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        hits[L.key].push(dOf(p.x));
        draw();
      });
      const t = el("text", { class: "sub", x: X0, y: L.y - 6 }, base);
      t.textContent = L.name;
    });
    // kernel
    const KY0 = 280, KY1 = 206;
    let dk = "";
    for (let d = 0; d <= DAYS; d += 0.5) dk += `${d ? "L" : "M"}${xOf(d).toFixed(1)} ${(KY0 - (KY0 - KY1) * Math.exp(-0.1 * d)).toFixed(1)} `;
    el("path", { class: "kernel", d: dk }, base);
    const hx = xOf(Math.LN2 / 0.1);
    el("line", { class: "half", x1: hx, x2: hx, y1: KY1 - 4, y2: KY0 }, base);
    const ht = el("text", { class: "sub", x: hx + 5, y: KY0 - 6 }, base); ht.textContent = "t½ ≈ 6.9d";
    const kt = el("text", { class: "sub", x: X0, y: KY1 - 8 }, base); kt.textContent = "weight of one hit = e^(−0.1·days)";

    const dots = el("g", {}, svg);
    function draw() {
      dots.innerHTML = "";
      lanes.forEach((L) => {
        const stack = {};
        hits[L.key].forEach((d, idx) => {
          const k = (stack[d] = (stack[d] || 0) + 1) - 1;
          const c = el("circle", { class: `hitdot ${L.key}`, cx: xOf(d), cy: L.y + 56 - k * 5.2, r: 4.5 }, dots);
          c.addEventListener("click", (ev) => { ev.stopPropagation(); hits[L.key].splice(idx, 1); draw(); });
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
    const X0 = 40, X1 = 410, MAX = 80;
    const xOf = (u) => X0 + (u / MAX) * (X1 - X0);
    const yOf = (h) => ({ 12: 22, 2: 72, 0.5: 108 })[h];
    const interval = (u) => (u < 20 ? 12 : u <= 50 ? 2 : 0.5);
    [[12, "12 h"], [2, "2 h"], [0.5, "30 min"]].forEach(([h, l]) => {
      const t = el("text", { class: "sub", x: 0, y: yOf(h) + 4 }, svg); t.textContent = l;
    });
    [0, 20, 50, 80].forEach((u) => { const t = el("text", { class: "sub", x: xOf(u), y: 134, "text-anchor": "middle" }, svg); t.textContent = u; });
    el("path", { class: "st", d: `M${xOf(0)} ${yOf(12)} H${xOf(20)} V${yOf(2)} H${xOf(50)} V${yOf(0.5)} H${xOf(80)}` }, svg);
    const cur = el("line", { class: "cur", y1: 10, y2: 120 }, svg);
    const dot = el("circle", { class: "dot", r: 5 }, svg);
    const run = () => {
      const u = +n.value, h = interval(u);
      nOut.textContent = u;
      cur.setAttribute("x1", xOf(u)); cur.setAttribute("x2", xOf(u));
      dot.setAttribute("cx", xOf(u)); dot.setAttribute("cy", yOf(h));
      const lbl = h === 0.5 ? "30 minutes" : `${h} hours`;
      read.textContent = `${u} upload${u === 1 ? "" : "s"} today → wakes every ${lbl}, takes the top-20 trending topics with no resource, resolves them 3 at a time.`;
    };
    n.addEventListener("input", run); run();
  })();

  /* ---------- 001.7 ruler ---------- */
  (() => {
    const svg = $("#ruler"), inp = $("#rulerIn"), list = $("#verdicts");
    if (!svg) return;
    const X0 = 20, X1 = 500;
    const xOf = (v) => X0 + v * (X1 - X0);
    for (let i = 0; i <= 100; i += 5) {
      const major = i % 10 === 0;
      el("line", { class: `tk${major ? " m" : ""}`, x1: xOf(i / 100), x2: xOf(i / 100), y1: 52, y2: major ? 68 : 60 }, svg);
      if (major) { const t = el("text", { class: "sub", x: xOf(i / 100), y: 80, "text-anchor": "middle" }, svg); t.textContent = (i / 100).toFixed(1); }
    }
    el("line", { class: "tk m", x1: X0, x2: X1, y1: 52, y2: 52 }, svg);
    [[0.45, "CONSTITUTION"], [0.65, "TOPIC"], [0.85, "RECALL"]].forEach(([v, l]) => {
      el("line", { class: "th", x1: xOf(v), x2: xOf(v), y1: 20, y2: 68 }, svg);
      const t = el("text", { class: "thl", x: xOf(v), y: 14, "text-anchor": "middle" }, svg); t.textContent = `${l} ${v}`;
    });
    const cur = el("line", { class: "cursor", y1: 30, y2: 90 }, svg);
    const cl = el("text", { class: "cursor-l", y: 104, "text-anchor": "middle" }, svg);
    const words = {
      "0.85": ["serve the peer's map", "call Gemini"],
      "0.65": ["reuse topic id", "new topic"],
      "0.45": ["scope to the source", "university lecture"]
    };
    const run = () => {
      const v = +inp.value;
      cur.setAttribute("x1", xOf(v)); cur.setAttribute("x2", xOf(v));
      cl.setAttribute("x", xOf(v)); cl.textContent = `cos ${v.toFixed(2)}`;
      [...list.children].forEach((li) => {
        const t = li.dataset.t, pass = v >= +t;
        li.classList.toggle("pass", pass);
        $("em", li).textContent = pass ? words[t][0] : words[t][1];
      });
    };
    inp.addEventListener("input", run); run();
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
        <ol class="rungs">${rungs.map(([a, b], i) => `<li><button class="rung${i === 0 ? " live" : ""}${i === rungs.length - 1 ? " floor" : ""}" type="button"><i></i><span>${a.replace(/</g, "&lt;")}<small>${b.replace(/</g, "&lt;")}</small></span></button></li>`).join("")}</ol>
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
