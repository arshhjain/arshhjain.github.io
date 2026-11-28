import * as THREE from "three";

/* DWG 002: Turbine blade defect triage as a drone inspection.
   Opening: an operator slumped outside the site cabin, his SCADA screen showing three turbines short on output.
   Detent A: the low turbines get flagged and the drone lifts off the cabin roof.
   Journey (scrubbed): the drone flies out to T-04.
   Detent B: laser sweep down blade B, lock-on, the feed shows test image 4.jpg with model C's real Grad-CAM and
   output, then the triage dialog.
   Detent C: pull back to the whole farm. From here the drone works every flagged turbine on its own; each report is
   model C's real call on one of the 159 held-out test images (assets/media/turbine/test-records.json).
   Detent D: the world slides aside for the copy, and the operator is on his feet. */
{
  const section = document.getElementById("turbine");
  const canvas = document.getElementById("tbWorld");
  if (section && canvas) {
    const stage = document.getElementById("tbStage");
    const labelsEl = document.getElementById("tbLabels");
    const caps = [...section.querySelectorAll(".tb-cap")];
    const scadaEl = document.getElementById("tbScada");
    const barsEl = document.getElementById("tbBars");
    const reticle = document.getElementById("tbReticle");
    const retText = document.getElementById("tbRetText");
    const feed = document.getElementById("tbFeed");
    const frameEl = feed.querySelector(".tb-frame");
    const dialog = document.getElementById("tbDialog");
    const hudEl = document.getElementById("tbHud");
    const queuesEl = document.getElementById("tbQueues");
    const hud = {
      scanned: document.getElementById("tbScanned"), human: document.getElementById("tbHuman"),
      wrong: document.getElementById("tbWrong"), thumb: document.getElementById("tbThumb"), last: document.getElementById("tbLastText")
    };
    const annot = document.getElementById("tbAnnot");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const css = getComputedStyle(document.documentElement);
    const PAPER = new THREE.Color("#ebe8de"), PAPER2 = new THREE.Color("#e2dfd3");
    const INK = new THREE.Color("#17160f"), ACCENT = new THREE.Color((css.getPropertyValue("--accent") || "#ff4a1c").trim());

    /* ---------- renderer / camera ---------- */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PAPER, 90, 300);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c4, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-30, 60, 40);
    scene.add(sun);

    const lineMat = new THREE.LineBasicMaterial({ color: INK, fog: true });
    const fillMat = new THREE.MeshLambertMaterial({ color: PAPER });
    const fillMat2 = new THREE.MeshLambertMaterial({ color: PAPER2 });
    const inkMat = new THREE.MeshLambertMaterial({ color: INK });
    const accentMat = new THREE.MeshBasicMaterial({ color: ACCENT });
    function solid(geo, mat = fillMat, edges = true) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, mat));
      if (edges) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), lineMat));
      return g;
    }

    /* ---------- ground ---------- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ color: PAPER }));
    ground.rotation.x = -Math.PI / 2; ground.position.z = -120;
    scene.add(ground);
    const grid = new THREE.GridHelper(700, 140, INK, INK);
    grid.material.transparent = true; grid.material.opacity = 0.08; grid.position.set(0, 0.01, -120);
    scene.add(grid);

    /* ---------- turbines ---------- */
    const TOWER = 26, BLADE = 13;
    const towerGeo = new THREE.CylinderGeometry(0.42, 0.95, TOWER, 20); towerGeo.translate(0, TOWER / 2, 0);
    const nacGeo = new THREE.BoxGeometry(1.5, 1.5, 3.6); nacGeo.translate(0, 0, -0.9);
    const hubGeo = new THREE.ConeGeometry(0.62, 1.3, 16); hubGeo.rotateX(Math.PI / 2);
    const bladeGeo = (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.28, 0.4); s.lineTo(0.62, 1.6); s.quadraticCurveTo(0.5, BLADE * 0.55, 0.14, BLADE);
      s.lineTo(-0.08, BLADE); s.quadraticCurveTo(-0.32, BLADE * 0.5, -0.4, 1.4); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false });
      g.translate(0, 0, -0.11);
      return g;
    })();
    const towerEdges = new THREE.EdgesGeometry(towerGeo, 28), nacEdges = new THREE.EdgesGeometry(nacGeo, 28);
    const hubEdges = new THREE.EdgesGeometry(hubGeo, 28), bladeEdges = new THREE.EdgesGeometry(bladeGeo, 28);
    const shared = (geo, edges, mat = fillMat) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat), new THREE.LineSegments(edges, lineMat)); return g; };

    const turbines = [];
    function turbine(x, z, name) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(shared(towerGeo, towerEdges));
      const nac = shared(nacGeo, nacEdges); nac.position.y = TOWER + 0.4; g.add(nac);
      const rotor = new THREE.Group(); rotor.position.set(0, TOWER + 0.4, 1.3);
      rotor.add(shared(hubGeo, hubEdges, fillMat2));
      const blades = [];
      for (let k = 0; k < 3; k++) {
        const b = shared(bladeGeo, bladeEdges); b.rotation.z = (k * 2 * Math.PI) / 3;
        rotor.add(b); blades.push(b);
      }
      g.add(rotor);
      scene.add(g);
      const t = { g, rotor, blades, name, x, z, angle: Math.random() * 6.28, speed: 0.55 + Math.random() * 0.15, state: "ok", stateT: 0, label: null };
      turbines.push(t);
      return t;
    }
    /* the farm: staggered rows receding from the cabin */
    const FARM = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) FARM.push([-52 + c * 32 + (r % 2) * 16, -62 - r * 40]);
    FARM.forEach(([x, z], i) => turbine(x, z, `T-${String(i + 1).padStart(2, "0")}`));
    const byName = (n) => turbines.find((t) => t.name === n);
    const T04 = byName("T-04");
    const FIRST_FLAGS = ["T-04", "T-08", "T-15"];

    /* T-04 is parked with blade B pointing down and to the right, toward the drone's approach; its crack sits mid-span.
       Blade B carries a 120° offset, so a rotor angle of 1.69 rad puts it at ~217°. */
    const PARK = 1.69;
    const crackB = T04.blades[1];
    const crack = (() => {
      const pts = [], n = 9;
      for (let i = 0; i < n; i++) {
        const y = 6.9 + i * 0.15, x = 0.1 + Math.sin(i * 2.3) * 0.08 + (i % 2 ? 0.03 : -0.03);
        pts.push(new THREE.Vector3(x, y, 0.13));
        if (i) pts.push(pts[pts.length - 1].clone());
      }
      pts.pop();
      const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: INK }));
      crackB.add(l);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthTest: false }));
      ring.position.set(0.12, 7.5, 0.16); ring.renderOrder = 3;
      crackB.add(ring);
      return { ring, local: new THREE.Vector3(0.12, 7.5, 0.13) };
    })();

    /* ---------- site cabin, operator, monitor ---------- */
    const CAB = new THREE.Vector3(10, 0, 4);
    const cabin = solid(new THREE.BoxGeometry(6, 2.8, 3.4)); cabin.position.set(CAB.x, 1.4, CAB.z); scene.add(cabin);
    const roof = solid(new THREE.BoxGeometry(6.4, 0.18, 3.8), fillMat2); roof.position.set(CAB.x, 2.89, CAB.z); scene.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.0), inkMat); door.position.set(CAB.x - 1.9, 1.0, CAB.z + 1.71); scene.add(door);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), inkMat); win.position.set(CAB.x + 1.3, 1.7, CAB.z + 1.71); scene.add(win);
    const step = solid(new THREE.BoxGeometry(1.7, 0.42, 0.9), fillMat2); step.position.set(CAB.x - 0.25, 0.21, CAB.z + 2.15); scene.add(step);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: PAPER2 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(CAB.x + 1.4, 3.0, CAB.z); scene.add(pad);
    const padH = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.95, 32)), lineMat);
    padH.rotation.x = -Math.PI / 2; padH.position.set(CAB.x + 1.4, 3.01, CAB.z); scene.add(padH);
    /* monitor on a stand beside the step */
    const MON = new THREE.Vector3(CAB.x + 1.15, 0, CAB.z + 2.5);
    const post = solid(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), inkMat, false); post.position.set(MON.x, 0.58, MON.z); scene.add(post);
    const screen = solid(new THREE.BoxGeometry(0.9, 0.58, 0.08)); screen.position.set(MON.x, 1.35, MON.z); screen.rotation.y = -0.5; scene.add(screen);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.46), new THREE.MeshBasicMaterial({ color: INK })); glow.position.set(0, 0, 0.045); screen.add(glow);
    const MON_TOP = new THREE.Vector3(MON.x, 1.7, MON.z);

    /* the operator: a jointed figure with three poses. Units in metres, seated on the step */
    const man = (() => {
      const m = new THREE.Group();
      const limb = (len, r) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2, 0); return new THREE.Mesh(g, inkMat); };
      const hips = new THREE.Group(); m.add(hips);
      const torso = new THREE.Group(); hips.add(torso);
      const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), inkMat); chest.position.y = 0.32; torso.add(chest);
      const neck = new THREE.Group(); neck.position.y = 0.66; torso.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), inkMat); head.position.y = 0.16; neck.add(head);
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: ACCENT })); hat.position.y = 0.19; neck.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18), new THREE.MeshLambertMaterial({ color: ACCENT })); brim.position.set(0, 0.19, 0.03); neck.add(brim);
      const arm = (side) => {
        const sh = new THREE.Group(); sh.position.set(0.25 * side, 0.58, 0); torso.add(sh);
        sh.add(limb(0.26, 0.06));
        const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
        el.add(limb(0.24, 0.055));
        return { sh, el };
      };
      const leg = (side) => {
        const hp = new THREE.Group(); hp.position.set(0.11 * side, 0, 0); hips.add(hp);
        hp.add(limb(0.38, 0.075));
        const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
        kn.add(limb(0.38, 0.07));
        return { hp, kn };
      };
      const J = { hips, torso, neck, L: arm(1), R: arm(-1), LL: leg(1), RL: leg(-1) };
      m.position.set(CAB.x - 0.25, 0, CAB.z + 2.2);
      m.rotation.y = 0.35;
      scene.add(m);
      /* poses: [hipsY, torsoX, neckX, L.sh(x,z), L.el x, R.sh(x,z), R.el x, legs hp x, kn x] */
      const SULK = { hy: 0.86, tx: 0.62, nx: 0.55, ls: [-0.95, 0.1], le: -1.9, rs: [-0.55, -0.25], re: -0.9, hp: -1.45, kn: 1.5 };
      const WATCH = { hy: 0.86, tx: 0.12, nx: -0.28, ls: [-0.55, 0.12], le: -0.6, rs: [-0.35, -0.15], re: -0.5, hp: -1.45, kn: 1.5 };
      const STAND = { hy: 0.9, tx: 0.0, nx: -0.12, ls: [0.0, 0.08], le: -0.15, rs: [-2.6, -0.2], re: -0.35, hp: 0, kn: 0 };
      const lerp = (a, b, t) => a + (b - a) * t;
      function pose(a, b, t, tap) {
        const P = (k) => lerp(a[k], b[k], t);
        J.hips.position.y = P("hy");
        J.torso.rotation.x = P("tx");
        J.neck.rotation.x = P("nx");
        J.L.sh.rotation.set(lerp(a.ls[0], b.ls[0], t), 0, lerp(a.ls[1], b.ls[1], t));
        J.L.el.rotation.x = P("le");
        /* the tap: right arm reaches toward the monitor and comes back */
        J.R.sh.rotation.set(lerp(a.rs[0], b.rs[0], t) - tap * 0.9, 0, lerp(a.rs[1], b.rs[1], t) - tap * 0.55);
        J.R.el.rotation.x = P("re") + tap * 0.5;
        for (const L of [J.LL, J.RL]) { L.hp.rotation.x = P("hp"); L.kn.rotation.x = P("kn"); }
      }
      return { g: m, SULK, WATCH, STAND, pose };
    })();

    /* ---------- drone ---------- */
    const drone = (() => {
      const g = new THREE.Group();
      const body = solid(new THREE.BoxGeometry(0.62, 0.2, 0.62), fillMat2); g.add(body);
      const props = [];
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.07), inkMat);
        arm.position.set(Math.cos(a) * 0.38, 0.02, Math.sin(a) * 0.38); arm.rotation.y = -a; g.add(arm);
        const p = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.24, 18)), lineMat);
        p.rotation.x = -Math.PI / 2; p.position.set(Math.cos(a) * 0.68, 0.09, Math.sin(a) * 0.68); g.add(p); props.push(p);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.04), inkMat); bar.position.copy(p.position); g.add(bar); props.push(bar);
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), accentMat); eye.position.set(0, -0.11, 0.26); g.add(eye);
      g.scale.setScalar(1.15);
      scene.add(g);
      return { g, props, eye };
    })();
    const LENS = new THREE.Vector3();

    /* laser fan: a triangle from the lens to a chord line on the target blade */
    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    fan.frustumCulled = false; scene.add(fan);
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, depthTest: false }));
    beam.frustumCulled = false; beam.renderOrder = 4; scene.add(beam);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    /* point the fan at blade `b` at radius r (in blade units), fanning across the chord */
    function laser(b, r, alpha) {
      fan.visible = beam.visible = alpha > 0.01;
      if (!fan.visible) return;
      drone.eye.getWorldPosition(LENS);
      b.localToWorld(tmpA.set(-0.55, r, 0.12)); b.localToWorld(tmpB.set(0.75, r, 0.12));
      const f = fanGeo.attributes.position.array;
      f.set([LENS.x, LENS.y, LENS.z, tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z]);
      fanGeo.attributes.position.needsUpdate = true;
      beamGeo.attributes.position.array.set([tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z]);
      beamGeo.attributes.position.needsUpdate = true;
      fan.material.opacity = 0.22 * alpha; beam.material.opacity = alpha;
    }

    /* ---------- labels & projection ---------- */
    const v3 = new THREE.Vector3();
    let W = 1, H = 1;
    function project(p) {
      v3.copy(p).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, behind: v3.z > 1 };
    }
    const place = (el, p, dx = 0, dy = 0, ax = "-50%", ay = "-100%") => {
      const s = project(p);
      el.style.transform = `translate3d(${Math.round(s.x + dx)}px, ${Math.round(s.y + dy)}px, 0) translate(${ax}, ${ay})`;
      return s;
    };
    const tipOf = (t) => new THREE.Vector3(t.x, TOWER + BLADE + 2.5, t.z);
    function setLabel(t, on) {
      if (on && !t.label) {
        const el = document.createElement("span");
        el.className = "tb-lab flag"; el.textContent = `${t.name} ⚑`;
        labelsEl.appendChild(el); t.label = el;
      }
      if (t.label) t.label.style.opacity = on ? "1" : "0";
    }
    const droneTag = document.createElement("span");
    droneTag.className = "tb-drone"; droneTag.textContent = "DRONE";
    labelsEl.appendChild(droneTag);
    const chips = [];
    function chip(t, html, cls) {
      const el = document.createElement("span");
      el.className = `tb-chip ${cls}`; el.innerHTML = html;
      labelsEl.appendChild(el);
      const c = { el, pos: tipOf(t).add(new THREE.Vector3(0, 3, 0)) };
      chips.push(c);
      setTimeout(() => { el.remove(); chips.splice(chips.indexOf(c), 1); }, 3400);
    }

    /* SCADA bars: twelve rows; the three flagged turbines are the short ones */
    const SCADA_ROWS = ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08", "T-09", "T-10", "T-11", "T-12", "T-13", "T-14", "T-15"];
    let seed = 20261128;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    barsEl.innerHTML = SCADA_ROWS.map((n) => {
      const low = FIRST_FLAGS.includes(n);
      const v = low ? 0.42 + rnd() * 0.16 : 0.86 + rnd() * 0.12;
      return `<li class="${low ? "low" : ""}" style="--v:${v.toFixed(2)}"><span>${n}</span><i></i><b>LOW</b></li>`;
    }).join("");

    /* ---------- dispatch board ---------- */
    const CLASSES = ["crack", "craze_crack", "delamination", "erosion", "lightning_damage", "surface_damage"];
    const TEAM = { crack: "CRACK", craze_crack: "CRAZE", delamination: "DELAM", erosion: "EROSION", lightning_damage: "LIGHTNING", surface_damage: "SURFACE" };
    queuesEl.innerHTML = CLASSES.map((c) => `<li data-c="${c}"><span>${TEAM[c]} CREW</span><span class="tb-q"></span><b>0</b></li>`).join("");
    const qRows = Object.fromEntries(CLASSES.map((c) => [c, queuesEl.querySelector(`[data-c="${c}"]`)]));
    const ORDER = ["", "LOGGED · COSMETIC", "NEXT ROUND", "THIS QUARTER", "NDT WITHIN 48 H", "STAT."];
    const pretty = (c) => c.replace("_", " ");

    let records = null, sprite = { tile: 72, cols: 13 }, all = [];
    const spritePos = (k) => `${-(k % sprite.cols) * 48}px ${-Math.floor(k / sprite.cols) * 48}px`;
    fetch(new URL("../assets/media/turbine/test-records.json", import.meta.url))
      .then((r) => r.json())
      .then((d) => {
        sprite = d.sprite;
        const recs = d.recs;
        /* the farm opens on two tidy calls and one the model isn't sure about, then the rest in a fixed shuffle */
        const lead = [3, 10, 834].map((id) => recs.find((r) => r.id === id)).filter(Boolean);
        const rest = recs.filter((r) => !lead.includes(r) && r.id !== 4);
        let s2 = 7;
        const r2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
        for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        records = [...lead, ...rest];
        all = recs;
        const r4 = recs.find((r) => r.id === 4);
        if (r4 && sim.scanned === 1) { hud.thumb.style.visibility = "visible"; hud.thumb.style.backgroundPosition = spritePos(r4.k); }
      })
      .catch(() => { records = []; });

    /* ---------- farm simulation (runs after the pull-back) ---------- */
    let sim;
    function resetSim() {
      sim = { scanned: 1, human: 0, wrong: 0, next: 0, queue: { crack: [5] }, mode: "pick", target: null, t: 0, from: null, curve: null, flagIn: 3 };
      turbines.forEach((t) => { t.state = "ok"; setLabel(t, false); });
      T04.state = "parked";
      FIRST_FLAGS.slice(1).forEach((n) => { byName(n).state = "flagged"; setLabel(byName(n), true); });
      drawHud();
      const r4 = all.find((r) => r.id === 4);
      hud.thumb.style.visibility = r4 ? "visible" : "hidden";
      if (r4) hud.thumb.style.backgroundPosition = spritePos(r4.k);
      hud.last.textContent = "T-04 · crack · L5 · crack crew, stat.";
    }
    const HOVER = (t) => new THREE.Vector3(t.x + 4.2, TOWER - 2.2, t.z + 7.5);
    function drawHud() {
      hud.scanned.textContent = sim.scanned;
      hud.human.textContent = sim.human;
      hud.wrong.textContent = sim.wrong;
      for (const c of CLASSES) {
        const q = sim.queue[c] || [];
        const row = qRows[c];
        row.querySelector("b").textContent = q.length;
        const box = row.querySelector(".tb-q");
        while (box.children.length < Math.min(q.length, 14)) {
          const i = document.createElement("i"); const s = q[box.children.length];
          i.className = `s${s} new`; i.style.setProperty("--s", s); box.appendChild(i);
        }
        while (box.children.length > Math.min(q.length, 14)) box.lastChild.remove();
      }
    }
    function report(t) {
      if (!records || !records.length) return;
      const r = records[sim.next % records.length]; sim.next++;
      sim.scanned++;
      hud.thumb.style.visibility = "visible";
      hud.thumb.style.backgroundPosition = spritePos(r.k ?? 0);
      if (r.p !== r.t) sim.wrong++;
      if (r.c < 0.5) {
        sim.human++;
        chip(t, `<small>${t.name} · ${r.id}.jpg</small>${pretty(r.p)} or ${pretty(r.p2)}? ${Math.round(r.c * 100)}%… <b>requesting a human</b>`, "human");
        hud.last.textContent = `${t.name} · ${r.id}.jpg · ${pretty(r.p)} ${Math.round(r.c * 100)}% vs ${pretty(r.p2)} ${Math.round(r.c2 * 100)}% → human review`;
      } else {
        (sim.queue[r.p] = sim.queue[r.p] || []).push(r.ps);
        const msg = r.ps >= 5 ? `${TEAM[r.p]} CREW. <b>STAT.</b>` : `${TEAM[r.p].toLowerCase()} crew · ${ORDER[r.ps].toLowerCase()}`;
        chip(t, `<small>${t.name} · ${r.id}.jpg · ${pretty(r.p)} ${Math.round(r.c * 100)}% · L${r.ps}</small>${msg}`, `s${r.ps}`);
        hud.last.textContent = `${t.name} · ${r.id}.jpg · ${pretty(r.p)} ${Math.round(r.c * 100)}% · L${r.ps}${r.p !== r.t ? ` (was ${pretty(r.t)})` : ""}`;
      }
      t.state = "crew"; t.stateT = 16 + rnd() * 8;
      setLabel(t, false);
      drawHud();
    }
    function hop(a, b) {
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y = Math.max(a.y, b.y) + 6;
      return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    }
    const dronePos = new THREE.Vector3();
    const simPos = new THREE.Vector3();
    let scanBlade = null, scanR = 0, scanA = 0;
    function stepSim(dt) {
      sim.t += dt;
      sim.flagIn -= dt;
      /* SCADA keeps flagging: a turbine whose output dips joins the queue */
      const flagged = turbines.filter((t) => t.state === "flagged");
      if (sim.flagIn <= 0 && flagged.length < 3) {
        const ok = turbines.filter((t) => t.state === "ok" && t !== T04);
        if (ok.length) { const t = ok[Math.floor(rnd() * ok.length)]; t.state = "flagged"; setLabel(t, true); }
        sim.flagIn = 2.4 + rnd() * 2.2;
      }
      turbines.forEach((t) => { if (t.state === "crew") { t.stateT -= dt; if (t.stateT <= 0) t.state = "ok"; } });
      scanA = Math.max(0, scanA - dt * 3);
      if (sim.mode === "pick") {
        const cand = turbines.filter((t) => t.state === "flagged");
        if (cand.length) {
          cand.sort((a, b) => HOVER(a).distanceTo(simPos) - HOVER(b).distanceTo(simPos));
          sim.target = cand[0]; sim.target.state = "visiting";
          sim.curve = hop(simPos, HOVER(sim.target)); sim.t = 0; sim.mode = "fly";
        }
      } else if (sim.mode === "fly") {
        const len = sim.curve.getLength();
        const u = Math.min(1, (sim.t * 26) / Math.max(1, len));
        simPos.copy(sim.curve.getPoint(u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2));
        if (u >= 1) { sim.mode = "scan"; sim.t = 0; }
      } else if (sim.mode === "scan") {
        scanBlade = sim.target.blades[0]; scanR = 2 + Math.min(1, sim.t / 1.2) * 10; scanA = 1;
        if (sim.t > 1.3) { report(sim.target); sim.mode = "pick"; }
      }
    }

    /* ---------- detents ---------- */
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    /* each detent: crossing `trip` plays its animation forward as one timed move, dropping below `untrip` plays it back */
    const D = {
      flag: { trip: 0.08, untrip: 0.05, f: 1.4, b: 0.8, t: 0, v: 0 },
      scan: { trip: 0.4, untrip: 0.36, f: 3.4, b: 0.9, t: 0, v: 0 },
      farm: { trip: 0.6, untrip: 0.56, f: 2.4, b: 1.6, t: 0, v: 0 },
      end: { trip: 0.86, untrip: 0.82, f: 1.0, b: 1.0, t: 0, v: 0 }
    };
    const DL = Object.values(D);
    let detInit = false;
    function stepDetents(p, dt) {
      let locked = false;
      for (const d of DL) {
        const was = d.t;
        if (p >= d.trip) d.t = 1; else if (p < d.untrip) d.t = 0;
        if (detInit && d.t !== was && !locked && window.__detentLock) {
          window.__detentLock(section, d.t ? d.trip + 0.005 : d.untrip - 0.005, (d.t ? d.f : d.b) * 1000);
          locked = true;
        }
        if (!detInit || reduceMotion) { d.v = d.t; continue; }
        if (d.v < d.t) d.v = Math.min(1, d.v + dt / d.f); else if (d.v > d.t) d.v = Math.max(0, d.v - dt / d.b);
      }
      detInit = true;
    }

    /* ---------- camera shots ---------- */
    T04.rotor.rotation.z = PARK; scene.updateMatrixWorld(true);
    const CRACK_W = crackB.localToWorld(crack.local.clone());
    const S0 = { pos: new THREE.Vector3(CAB.x - 4.2, 2.0, CAB.z + 12.5), look: new THREE.Vector3(CAB.x + 2.5, 7, CAB.z - 60), fov: 40 };
    const at = (x, y, z) => CRACK_W.clone().add(new THREE.Vector3(x, y, z));
    const HOV = at(3.4, 1.9, 6.2);
    const S1 = { pos: at(10.5, -0.6, 18), look: at(-0.6, 1.4, 0), fov: 36 };
    const S1b = { pos: at(8.2, -0.2, 14), look: at(-0.4, 1.2, 0), fov: 34 };
    const S2 = { pos: new THREE.Vector3(CAB.x - 18, 92, CAB.z + 46), look: new THREE.Vector3(CAB.x + 10, 0, CAB.z - 92), fov: 44 };
    /* the end shot comes back to the cabin: the opening framing from higher up, operator on his feet, the farm behind him */
    const S3 = { pos: new THREE.Vector3(CAB.x - 9, 7.5, CAB.z + 24), look: new THREE.Vector3(CAB.x + 9, 9, CAB.z - 70), fov: 42 };
    const roofPos = new THREE.Vector3(CAB.x + 1.4, 3.35, CAB.z);
    const path = new THREE.CatmullRomCurve3([
      roofPos.clone().add(new THREE.Vector3(0, 2.6, 0)),
      new THREE.Vector3(CAB.x + 2, 11, CAB.z - 8),
      new THREE.Vector3(T04.x + 2, 24, T04.z + 40),
      at(7, 3, 16),
      HOV.clone()
    ], false, "centripetal");
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
    const chase = new THREE.Vector3(5.5, 2.2, 9);
    let jp = 0;

    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
    }
    window.addEventListener("resize", resize);
    resize();
    resetSim();

    let simLive = false, endState = false;
    function frame(now, dt) {
      const p = parseFloat(section.style.getPropertyValue("--p")) || 0;
      stepDetents(p, dt);
      const a = ease(D.flag.v), sB = D.scan.v, c = ease(D.farm.v), e = ease(D.end.v);
      /* the journey is a journey: scrubbed, with a little smoothing */
      const jt = sm(0.12, 0.36, p);
      jp = reduceMotion ? jt : jp + (jt - jp) * Math.min(1, dt * 5);

      /* turbines turn; flagged and parked ones idle down */
      turbines.forEach((t) => {
        const target = t === T04 ? 0 : t.state === "ok" || t.state === "crew" ? (t.state === "crew" ? 0 : t.speed) : 0.08;
        t.cur = (t.cur ?? t.speed) + (target - (t.cur ?? t.speed)) * Math.min(1, dt * 0.8);
        if (!reduceMotion) t.angle += t.cur * dt;
        t.rotor.rotation.z = t === T04 ? PARK : t.angle;
      });

      /* drone */
      const lift = sm(0.2, 1, a);
      if (jp <= 0) dronePos.copy(roofPos).add(tmpP.set(0, lift * 2.6, 0));
      else dronePos.copy(path.getPoint(ease(jp)));
      if (!reduceMotion) dronePos.y += Math.sin(now * 0.0021) * 0.12 * Math.min(1, lift + jp);
      if (c > 0 && simLive) dronePos.lerp(simPos, c);
      drone.g.position.copy(dronePos);
      const ahead = jp > 0 && jp < 1 ? path.getPoint(Math.min(1, ease(jp) + 0.02)) : null;
      if (c > 0.5 && sim.mode === "fly") drone.g.lookAt(tmpL.copy(sim.curve.getPoint(1)).setY(dronePos.y));
      else if (ahead && ahead.distanceToSquared(dronePos) > 1e-4) drone.g.lookAt(ahead.setY(dronePos.y));
      else drone.g.lookAt(tmpL.copy(CRACK_W).setY(dronePos.y));
      if (!reduceMotion) drone.props.forEach((pr, i) => { pr.rotation.z += dt * (i % 2 ? 40 : -40) * (lift > 0.02 ? 1 : 0); });

      /* scan sequence */
      const sweep = sm(0.03, 0.42, sB);
      const scanR0 = 1.2 + sweep * (BLADE - 1.6);
      const toCrack = sm(0.42, 0.5, sB);
      if (c < 0.05) laser(crackB, scanR0 + (7.5 - scanR0) * toCrack, sm(0.0, 0.05, sB) * (1 - sm(0.62, 0.72, sB)));
      else if (scanBlade) laser(scanBlade, scanR, scanA * c);
      else laser(crackB, 0, 0);
      crack.ring.material.opacity = sm(0.46, 0.52, sB) * (0.55 + 0.45 * Math.sin(now * 0.008)) * (1 - c);
      const crackW = crackB.localToWorld(tmpP.copy(crack.local));
      const retOn = sm(0.36, 0.42, sB) * (1 - sm(0.66, 0.74, sB)) * (1 - c);
      reticle.style.opacity = retOn.toFixed(3);
      if (retOn > 0) {
        const lock = sm(0.42, 0.5, sB), size = 150 - lock * 84;
        reticle.style.width = reticle.style.height = `${size}px`;
        place(reticle, crackW, 0, 0, "-50%", "-50%");
        retText.textContent = lock >= 1 ? "LOCKED · T-04 · BLADE B" : "SCANNING";
      }
      feed.classList.toggle("on", sB > 0.5 && c < 0.3);
      frameEl.style.setProperty("--w", sm(0.56, 0.74, sB).toFixed(3));
      feed.classList.toggle("read", sB > 0.76);
      dialog.classList.toggle("on", sB > 0.86 && c < 0.3);

      /* farm */
      if (D.farm.t === 1 && c > 0.98 && !simLive) { simLive = true; simPos.copy(HOV); sim.mode = "pick"; }
      if (D.farm.t === 0 && c < 0.02 && simLive) { simLive = false; resetSim(); }
      if (simLive && !reduceMotion) stepSim(dt);
      turbines.forEach((t) => {
        const showFlag = (c > 0.5 && (t.state === "flagged" || t.state === "visiting")) || (c <= 0.5 && a > 0.5 && FIRST_FLAGS.includes(t.name) && (t === T04 ? sB < 0.3 : jp < 0.6));
        setLabel(t, showFlag);
        if (t.label) place(t.label, tipOf(t));
      });
      hudEl.style.opacity = sm(0.55, 1, c).toFixed(3);

      /* operator */
      const tap = Math.sin(Math.PI * clamp(D.flag.v * 1.6 - 0.1, 0, 1)) * (D.flag.t ? 1 : 0);
      if (e > 0) man.pose(man.WATCH, man.STAND, e, 0);
      else man.pose(man.SULK, man.WATCH, a, tap);
      scadaEl.classList.toggle("flagged", D.flag.v > 0.45);
      scadaEl.style.opacity = (1 - sm(0.05, 0.25, jp)).toFixed(3);
      /* the panel sits right of the monitor, or flips left when the stage is too narrow for it */
      const ms = project(MON_TOP);
      if (ms.x + 24 + scadaEl.offsetWidth + 12 < W) place(scadaEl, MON_TOP, 24, -18, "0%", "-100%");
      else place(scadaEl, MON_TOP, -24, -18, "-100%", "-100%");
      annot.style.opacity = e > 0.6 ? "1" : "0";
      place(annot, tmpP.set(man.g.position.x, 2.4, man.g.position.z), 0, -6, "-30%", "-100%");

      /* captions latch: one per beat */
      let cap = -1;
      if (D.end.t) cap = -1;
      else if (D.farm.t) cap = 4;
      else if (D.scan.t) cap = 3;
      else if (p >= 0.2) cap = 2;
      else if (D.flag.t) cap = 1;
      else cap = 0;
      caps.forEach((el, i) => el.classList.toggle("on", i === cap));
      if (D.end.t !== +endState) { endState = !!D.end.t; section.classList.toggle("tb-end", endState); }

      /* camera: establishing → chase along the journey → scan push-in → farm pull-back → slide aside for the copy */
      camPos.copy(S0.pos); camLook.copy(S0.look);
      let fov = S0.fov;
      if (jp > 0) {
        const u = ease(jp);
        const follow = tmpP.copy(dronePos).add(chase);
        const blendIn = sm(0, 0.25, jp), blendOut = sm(0.7, 1, jp);
        camPos.lerp(follow, blendIn * (1 - blendOut)).lerp(S1.pos, blendOut);
        tmpL.copy(dronePos).lerp(S1.look, blendOut * 0.9 + u * 0.1);
        camLook.lerp(tmpL, sm(0, 0.2, jp));
        fov += (S1.fov - fov) * u;
      }
      const sb = ease(clamp(sB / 0.5, 0, 1));
      camPos.lerp(S1b.pos, sb * (jp >= 0.999 ? 1 : jp)); camLook.lerp(S1b.look, sb * (jp >= 0.999 ? 1 : jp)); fov += (S1b.fov - fov) * sb * jp;
      if (c > 0) {
        /* rise first, then swing out, so the pull-back reads as the camera backing away from the turbine */
        const up = tmpP.copy(camPos).lerp(S2.pos, c); up.y += Math.sin(Math.PI * c) * 14;
        camPos.copy(up); camLook.lerp(S2.look, ease(c)); fov += (S2.fov - fov) * c;
      }
      if (!reduceMotion && c > 0.99) { camPos.x += Math.sin(now * 0.00008) * 6 * (1 - e); }
      if (e > 0) { camPos.lerp(S3.pos, e); camLook.lerp(S3.look, e); fov += (S3.fov - fov) * e; }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.fov = fov;
      /* keep the action clear of the captions on the left; at the end it slides right for the copy */
      const shift = W * (0.06 + e * 0.2);
      camera.setViewOffset(W, H, -shift, 0, W, H);
      camera.updateProjectionMatrix();
      chips.forEach((q) => place(q.el, q.pos));
      droneTag.style.opacity = (sm(0.6, 1, c)).toFixed(3);
      if (c > 0.6) place(droneTag, tmpP.copy(dronePos).add(tmpL.set(0, 1.2, 0)), 0, -4);

      renderer.render(scene, camera);
    }

    /* ---------- loop ---------- */
    let visible = false, raf = 0, last = 0;
    function loop(now) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      frame(now, dt);
      raf = requestAnimationFrame(loop);
    }
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible && !raf) { last = 0; resize(); raf = requestAnimationFrame(loop); }
    }, { rootMargin: "100px" }).observe(section);
  }
}
