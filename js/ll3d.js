import * as THREE from "three";

/* DWG 001: LectureLens as a campus that pays for itself.
   Scroll drives the drawing: a flat plan view on the sheet tilts to isometric and the blocks extrude.
   Time drives the campus: students upload decks; a miss goes Recall → cache.db → Recall → Gemini, and
   the fresh map goes to both cache.db and the student; a hit goes Recall → cache.db → Recall → student.
   Each semester starts with an empty cache, so the hit rate climbs week by week. Token figures are
   simulated estimates, labelled as such on the HUD. */
{
  const section = document.getElementById("lecturelens");
  const canvas = document.getElementById("llWorld");
  if (section && canvas) {
    const stage = document.getElementById("llStage");
    const labelsEl = document.getElementById("llLabels");
    const caps = [...section.querySelectorAll(".ll-cap")];
    const hud = {
      sem: document.getElementById("llSem"), week: document.getElementById("llWeek"),
      saved: document.getElementById("llSaved"), calls: document.getElementById("llCalls"),
      hits: document.getElementById("llHits"), rate: document.getElementById("llRate"),
      spark: document.querySelector("#llSpark path")
    };
    const hudEl = document.getElementById("llHud");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const css = getComputedStyle(document.documentElement);
    const PAPER = new THREE.Color("#ebe8de"), PAPER2 = new THREE.Color("#e2dfd3");
    const INK = new THREE.Color("#17160f"), ACCENT = new THREE.Color((css.getPropertyValue("--accent") || "#ff4a1c").trim());

    /* ---------- renderer / camera ---------- */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c4, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-14, 30, 20);
    scene.add(sun);

    const lineMat = new THREE.LineBasicMaterial({ color: INK });
    const fillMat = new THREE.MeshLambertMaterial({ color: PAPER });
    const fillMat2 = new THREE.MeshLambertMaterial({ color: PAPER2 });
    const inkMat = new THREE.MeshLambertMaterial({ color: INK });
    const accentMat = new THREE.MeshBasicMaterial({ color: ACCENT });

    /* ---------- ground: a site-plan sheet ---------- */
    const G = 46;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(G, G), new THREE.MeshBasicMaterial({ color: PAPER }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(G, 23, INK, INK);
    grid.material.transparent = true; grid.material.opacity = 0.1; grid.position.y = 0.01;
    scene.add(grid);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(G, 0.001, G)), lineMat);
    border.position.y = 0.02; scene.add(border);
    const border2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(G - 1.2, 0.001, G - 1.2)), lineMat);
    border2.position.y = 0.02; scene.add(border2);

    /* ---------- buildings ---------- */
    const extruders = []; /* groups whose y-scale grows with the extrude */
    const labels = [];
    function block(x, z, w, h, d, name, opts = {}) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const geo = opts.round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 40) : new THREE.BoxGeometry(w, h, d);
      geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, opts.mat || fillMat);
      g.add(m);
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), lineMat));
      if (opts.bands) for (let i = 1; i < opts.bands; i++) {
        const pts = [];
        for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * (w / 2 + 0.01), 0, Math.sin(a) * (w / 2 + 0.01))); }
        const rl = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
        rl.position.y = (h * i) / opts.bands; g.add(rl);
      }
      if (opts.windows) {
        const rows = Math.max(1, Math.floor(h / 1.1)), cols = Math.max(1, Math.floor(w / 1.2));
        const wg = new THREE.PlaneGeometry(0.42, 0.5);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const wm = new THREE.Mesh(wg, inkMat);
          wm.position.set(-w / 2 + (c + 0.5) * (w / cols), 0.6 + r * (h - 0.6) / rows, d / 2 + 0.01);
          g.add(wm);
          const wm2 = wm.clone(); wm2.rotation.y = Math.PI / 2;
          if (c < Math.max(1, Math.floor(d / 1.2))) { wm2.position.set(w / 2 + 0.01, wm.position.y, -d / 2 + (c + 0.5) * (d / Math.max(1, Math.floor(d / 1.2)))); g.add(wm2); }
        }
      }
      g.scale.y = 0.02;
      scene.add(g);
      extruders.push({ g, delay: opts.delay || 0 });
      if (name) labels.push({ name, cls: opts.lab || "", pos: new THREE.Vector3(x, h + 0.6, z), base: new THREE.Vector3(x, 0.2, z), h, el: null });
      return { g, top: new THREE.Vector3(x, h, z) };
    }

    /* LectureLens HQ, Gemini, cache.db */
    const HQ = block(0, 0, 5, 2.2, 4, "LECTURELENS · RECALL", { lab: "key", delay: 0.05 });
    const GEM = block(6.5, -4, 2.2, 9, 2.2, "GEMINI", { lab: "llm", delay: 0.15, windows: true });
    const SILO = block(-6.5, -4, 3, 3.6, 3, "cache.db", { round: true, bands: 3, delay: 0.1, mat: fillMat2 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), accentMat.clone());
    beacon.material.transparent = true; beacon.material.opacity = 0.35;
    beacon.position.set(6.5, 9.5, -4); scene.add(beacon);
    const siloLid = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 40), fillMat2);
    siloLid.add(new THREE.LineSegments(new THREE.EdgesGeometry(siloLid.geometry, 30), lineMat));
    siloLid.position.set(-6.5, 3.66, -4); scene.add(siloLid);

    /* campus */
    const campus = [
      [-15, 8, 4, 4.5, 6, "HOSTEL A"], [-15, -9, 4, 4.5, 6, "HOSTEL B"],
      [15, 9, 7, 2.4, 4.5, "LT-1"], [15, -8, 7, 2.4, 4.5, "LT-2"],
      [1, 16, 9, 3, 3.5, "LIBRARY"], [0, -16, 10, 3.6, 3.5, "ACADEMIC BLOCK"]
    ];
    const pawns = [];
    const pawnGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.55, 14); pawnGeo.translate(0, 0.28, 0);
    const headGeo = new THREE.SphereGeometry(0.27, 14, 10);
    campus.forEach(([x, z, w, h, d, name], i) => {
      block(x, z, w, h, d, name, { delay: 0.2 + i * 0.06, windows: true });
      /* road from the building to HQ */
      const len = Math.hypot(x, z) - 4;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(1.1, len), new THREE.MeshBasicMaterial({ color: PAPER2 }));
      road.rotation.x = -Math.PI / 2; road.rotation.z = Math.atan2(x, z);
      road.position.set(x * 0.5, 0.015, z * 0.5);
      scene.add(road);
      /* four students out front, on the side that faces HQ */
      const toHQ = new THREE.Vector2(-x, -z).normalize();
      const perp = new THREE.Vector2(-toHQ.y, toHQ.x);
      const front = Math.max(w, d) / 2 + 1.4;
      for (let k = 0; k < 4; k++) {
        const off = (k - 1.5) * 1.15;
        const px = x + toHQ.x * front + perp.x * off, pz = z + toHQ.y * front + perp.y * off;
        const pg = new THREE.Group();
        const body = new THREE.Mesh(pawnGeo, inkMat), head = new THREE.Mesh(headGeo, inkMat);
        head.position.y = 0.78; pg.add(body, head);
        pg.position.set(px, 0, pz); pg.scale.setScalar(0.02);
        scene.add(pg);
        pawns.push({ g: pg, pos: new THREE.Vector3(px, 0.9, pz), busy: false, bob: 0 });
      }
    });

    /* ---------- packets ---------- */
    /* packet colour says where it is in the story: ink = asking, blue = cache hit, orange = paid LLM call */
    const CACHE = new THREE.Color("#2f6bff");
    const pktGeo = new THREE.BoxGeometry(0.95, 0.2, 1.15);
    const pktInk = new THREE.MeshBasicMaterial({ color: INK }), pktHot = new THREE.MeshBasicMaterial({ color: ACCENT }), pktHit = new THREE.MeshBasicMaterial({ color: CACHE });
    const trailMat = new Map([[pktInk, INK], [pktHot, ACCENT], [pktHit, CACHE]].map(([k, c]) => [k, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.55 })]));
    const TRAIL = 22;
    const pool = [];
    const getPkt = (mat) => {
      let m = pool.pop();
      if (!m) {
        m = new THREE.Mesh(pktGeo, mat);
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
        m.userData.trail = new THREE.Line(tg, trailMat.get(mat));
        m.userData.trail.frustumCulled = false;
      }
      m.material = mat; m.visible = true; scene.add(m);
      m.userData.trail.material = trailMat.get(mat);
      m.userData.n = 0;
      m.userData.trail.geometry.setDrawRange(0, 0);
      scene.add(m.userData.trail);
      return m;
    };
    const setMat = (m, mat) => { m.material = mat; m.userData.trail.material = trailMat.get(mat); };
    const freePkt = (m) => { m.visible = false; scene.remove(m); scene.remove(m.userData.trail); pool.push(m); };
    function pushTrail(m) {
      const a = m.userData.trail.geometry.attributes.position, arr = a.array;
      arr.copyWithin(3, 0, (TRAIL - 1) * 3);
      arr[0] = m.position.x; arr[1] = m.position.y; arr[2] = m.position.z;
      m.userData.n = Math.min(TRAIL, m.userData.n + 1);
      m.userData.trail.geometry.setDrawRange(0, m.userData.n);
      a.needsUpdate = true;
    }

    const P_HQ = new THREE.Vector3(0, 2.6, 0);
    const P_SILO = new THREE.Vector3(-6.5, 4.2, -4);
    const P_GEM = new THREE.Vector3(6.5, 9.9, -4);
    /* a hop between two points: a quadratic arc lifted by the distance */
    function hop(a, b, lift = 0.3) {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y = Math.max(a.y, b.y) + a.distanceTo(b) * lift;
      return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    }

    /* ---------- simulation ---------- */
    let seed = 20261126;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const DECKS = 17, WEEK = 5.2, WEEKS = 14, SPEED = 15;
    const deckTok = Array.from({ length: DECKS }, () => 4000 + Math.round(rnd() * 7000));
    let sim;
    const flights = [];
    const resetSim = (semester) => {
      sim = { t: 0, semester, cache: new Set(), saved: 0, calls: 0, hits: 0, misses: 0, next: 0.4, weekly: [], wk: { h: 0, n: 0 }, week: 1 };
      hud.sem.textContent = semester;
    };
    resetSim(1);

    function unlocked() { return Math.min(DECKS, 2 + sim.week); }
    function pickDeck() {
      const u = unlocked();
      return rnd() < 0.5 ? u - 1 - Math.floor(rnd() * Math.min(2, u)) : Math.floor(rnd() * u);
    }
    /* pops are pinned to a world point and re-projected every frame, so they ride along with the camera */
    const pops = [];
    function pop(worldPos, text, cls) {
      const el = document.createElement("span");
      el.className = `ll-pop ${cls}`; el.textContent = text;
      labelsEl.appendChild(el);
      pops.push({ el, pos: worldPos.clone(), dx: (rnd() - 0.5) * 40, dy: -rnd() * 12 });
      setTimeout(() => { el.remove(); pops.splice(pops.findIndex((q) => q.el === el), 1); }, 1350);
    }
    const fmtK = (n) => `${(n / 1000).toFixed(1)}k`;

    /* a flight is a list of legs; each leg is a curve plus what happens on arrival */
    function launch(legs, mat) {
      const mesh = getPkt(mat);
      flights.push({ mesh, legs, i: 0, u: 0, wait: 0 });
    }
    function upload() {
      const free = pawns.filter((p) => !p.busy);
      if (!free.length) return;
      const p = free[Math.floor(rnd() * free.length)];
      p.busy = true; p.bob = 1;
      const deck = pickDeck(), tok = deckTok[deck];
      const back = (from, mat) => ({ c: hop(from, p.pos, 0.28), done: () => { p.busy = false; }, mat });
      const legs = [
        { c: hop(p.pos, P_HQ, 0.25) },
        {
          c: hop(P_HQ, P_SILO, 0.35), wait: 0.2,
          /* the lookup resolves at cache.db: the packet takes its colour here */
          arrive: (f) => {
            f.hit = sim.cache.has(deck);
            sim.wk.n++;
            if (f.hit) {
              sim.hits++; sim.wk.h++; sim.saved += tok;
              setMat(f.mesh, pktHit);
              pop(P_SILO, `HIT · +${fmtK(tok)} saved`, "hit");
            } else {
              sim.misses++;
              setMat(f.mesh, pktHot);
              pop(P_SILO, "MISS", "miss");
            }
          }
        },
        {
          c: hop(P_SILO, P_HQ, 0.35),
          arrive: (f) => {
            if (f.hit) { f.legs.push(back(P_HQ)); return; }
            f.legs.push({ c: hop(P_HQ, P_GEM, 0.15), wait: 0.9, arrive: () => {
              sim.calls++;
              pop(P_GEM, `−${fmtK(tok)} tokens`, "spend");
              flash = 1;
              /* the fresh map goes to cache.db and to the student at the same time */
              launch([{ c: hop(P_GEM, P_SILO, 0.2), done: () => sim.cache.add(deck) }], pktHot);
            } });
            f.legs.push(back(P_GEM));
          }
        }
      ];
      launch(legs, pktInk);
    }
    let flash = 0;

    function stepSim(dt) {
      sim.t += dt;
      const week = Math.min(WEEKS, 1 + Math.floor(sim.t / WEEK));
      if (week !== sim.week) {
        sim.weekly.push(sim.wk.n ? sim.wk.h / sim.wk.n : 0);
        sim.wk = { h: 0, n: 0 };
        sim.week = week;
      }
      if (sim.t > WEEK * WEEKS + 1.5 && !flights.length) {
        sim.weekly.push(sim.wk.n ? sim.wk.h / sim.wk.n : 0);
        const el = document.createElement("div");
        el.className = "ll-flash"; el.textContent = `NEW SEMESTER · CACHE CLEARED`;
        stage.appendChild(el); setTimeout(() => el.remove(), 2300);
        resetSim(sim.semester + 1);
        return;
      }
      if (sim.t < WEEK * WEEKS) {
        sim.next -= dt;
        if (sim.next <= 0) { upload(); sim.next = 0.32 + rnd() * 0.45; }
      }
      for (let k = flights.length - 1; k >= 0; k--) {
        const f = flights[k];
        if (f.wait > 0) { f.wait -= dt; continue; }
        const leg = f.legs[f.i];
        f.u += (dt * SPEED) / Math.max(1, leg.c.getLength());
        const u = Math.min(1, f.u);
        f.mesh.position.copy(leg.c.getPoint(u));
        pushTrail(f.mesh);
        f.mesh.rotation.y += dt * 3;
        if (u >= 1) {
          if (leg.arrive) leg.arrive(f);
          if (leg.done) leg.done();
          f.i++; f.u = 0;
          if (f.i >= f.legs.length) { freePkt(f.mesh); flights.splice(k, 1); continue; }
          f.wait = f.legs[f.i - 1].wait || 0;
          if (f.legs[f.i].mat) setMat(f.mesh, f.legs[f.i].mat);
        }
      }
    }

    let shownSaved = 0;
    function drawHud(dt) {
      shownSaved += (sim.saved - shownSaved) * Math.min(1, dt * 6);
      if (Math.abs(sim.saved - shownSaved) < 1) shownSaved = sim.saved;
      hud.saved.textContent = Math.round(shownSaved).toLocaleString("en-US");
      hud.calls.textContent = sim.calls;
      hud.hits.textContent = sim.hits;
      hud.week.textContent = sim.week;
      const n = sim.hits + sim.misses;
      hud.rate.textContent = n ? `${Math.round((sim.hits / n) * 100)}%` : "—";
      const pts = [...sim.weekly, sim.wk.n ? sim.wk.h / sim.wk.n : sim.weekly[sim.weekly.length - 1] || 0];
      hud.spark.setAttribute("d", pts.map((v, i) => `${i ? "L" : "M"}${((i / (WEEKS - 1)) * 200).toFixed(1)} ${(38 - v * 34).toFixed(1)}`).join(" "));
    }

    /* ---------- labels ---------- */
    labels.forEach((l) => {
      const el = document.createElement("span");
      el.className = `ll-lab ${l.cls}`; el.textContent = l.name;
      labelsEl.appendChild(el); l.el = el;
    });
    const v3 = new THREE.Vector3();
    let W = 1, H = 1;
    function project(p) {
      v3.copy(p).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
    }

    /* ---------- scroll choreography ---------- */
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const target = new THREE.Vector3(0, 0, 0);
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
    }
    window.addEventListener("resize", resize);
    resize();

    function place(p) {
      const tilt = sm(0.2, 0.5, p), ext = sm(0.26, 0.58, p), end = sm(0.74, 0.86, p);
      const theta = 0.002 + tilt * 0.98, phi = tilt * (Math.PI / 4);
      const D = 120;
      camera.position.set(D * Math.sin(theta) * Math.sin(phi), D * Math.cos(theta), D * Math.sin(theta) * Math.cos(phi));
      camera.up.set(-Math.cos(theta) * Math.sin(phi), Math.sin(theta), -Math.cos(theta) * Math.cos(phi));
      camera.lookAt(target);
      const half = 25.5 - tilt * 5.5 + end * 9;
      const aspect = W / H;
      const unitsPerPx = (2 * half) / H;
      /* keep the world clear of the captions on the left; at the end it slides right for the copy */
      const shift = (W * 0.08 + end * W * 0.13) * unitsPerPx;
      camera.left = -half * aspect - shift; camera.right = half * aspect - shift;
      camera.top = half; camera.bottom = -half;
      camera.updateProjectionMatrix();
      extruders.forEach(({ g, delay }) => { g.scale.y = 0.02 + 0.98 * sm(delay * 0.6, delay * 0.6 + 0.6, ext); });
      pawns.forEach((pw) => { const s = 0.02 + 0.98 * sm(0.5, 1, ext); pw.g.scale.set(1, s, 1); });
      beacon.visible = ext > 0.85;
      siloLid.position.y = 0.04 + 3.62 * sm(0.1, 0.7, ext);
      caps.forEach((c) => c.classList.toggle("on", p >= +c.dataset.a && p < +c.dataset.b));
      section.classList.toggle("ll-end", p >= 0.78);
      hudEl.style.opacity = String(sm(0.06, 0.18, p));
      hudEl.style.transform = `translateY(${(end * Math.max(0, H - hudEl.offsetHeight - 6)).toFixed(1)}px)`;
      labels.forEach((l) => {
        const at = l.base.clone().lerp(l.pos, ext);
        const s = project(at);
        l.el.style.transform = `translate3d(${Math.round(s.x)}px, ${Math.round(s.y)}px, 0) translate(-50%, -100%)`;
      });
      pops.forEach((q) => {
        const s = project(q.pos);
        q.el.style.transform = `translate3d(${Math.round(s.x + q.dx)}px, ${Math.round(s.y + q.dy)}px, 0) translate(-50%, -100%)`;
      });
    }

    /* ---------- loop ---------- */
    let visible = false, raf = 0, last = 0;
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      const p = parseFloat(section.style.getPropertyValue("--p")) || 0;
      if (!reduceMotion) stepSim(dt);
      pawns.forEach((pw) => { if (pw.bob > 0) { pw.bob = Math.max(0, pw.bob - dt * 2.5); pw.g.position.y = Math.sin(pw.bob * Math.PI) * 0.6; } });
      flash = Math.max(0, flash - dt * 1.6);
      beacon.material.opacity = 0.35 + flash * 0.65;
      beacon.scale.setScalar(1 + flash * 0.8);
      place(p);
      drawHud(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && !raf) { last = 0; resize(); raf = requestAnimationFrame(frame); }
    }, { rootMargin: "100px" }).observe(section);
    if (reduceMotion) {
      document.querySelector("#lecturelens .ll-note").textContent = "Simulation paused (reduced motion). Token cost per Gemini analysis is an estimate of 4k–11k per lecture.";
    }
  }
}
