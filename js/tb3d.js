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

    /* ---------- landscape: hills drawn as contours, tree clusters, access roads, substation and a power line ---------- */
    const GREEN = new THREE.Color("#d9d5c6");
    const hillFill = new THREE.MeshLambertMaterial({ color: GREEN });
    function hill(x, z, rx, rz, h) {
      const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = new THREE.Mesh(geo, hillFill); m.scale.set(rx, h, rz); m.position.set(x, 0, z); scene.add(m);
      for (let k = 1; k <= 5; k++) {
        const y = (h * k) / 6, f = Math.sqrt(1 - (y / h) ** 2), pts = [];
        for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(x + Math.cos(a) * rx * f, y + 0.05, z + Math.sin(a) * rz * f)); }
        const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.35, fog: true }));
        scene.add(l);
      }
    }
    [[-150, -150, 70, 50, 22], [-40, -250, 110, 46, 30], [110, -255, 120, 50, 26], [235, -150, 70, 60, 20], [-120, -10, 40, 34, 9], [200, 10, 44, 30, 8]]
      .forEach((h) => hill(...h));

    const roadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ddd9cb") });
    const roadEdge = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.28, fog: true });
    function road(x1, z1, x2, z2, w = 2.4) {
      const len = Math.hypot(x2 - x1, z2 - z1), g = new THREE.PlaneGeometry(w, len);
      const m = new THREE.Mesh(g, roadMat); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(x2 - x1, z2 - z1);
      m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2); scene.add(m);
      const nx = (-(z2 - z1) / len) * (w / 2), nz = ((x2 - x1) / len) * (w / 2);
      const e = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1 + nx, 0.03, z1 + nz), new THREE.Vector3(x2 + nx, 0.03, z2 + nz),
        new THREE.Vector3(x1 - nx, 0.03, z1 - nz), new THREE.Vector3(x2 - nx, 0.03, z2 - nz)]), roadEdge);
      scene.add(e);
    }
    /* a trunk road from the cabin up the middle of the farm, a row road behind each row, a short spur to every tower */
    road(4, 8, 4, -196, 3);
    for (let r = 0; r < 4; r++) { const z = -62 - r * 40 - 7; road(-60, z, 150, z); }
    turbines.forEach((t) => road(t.x, t.z, t.x, t.z - 7, 1.4));

    const treeFill = new THREE.MeshLambertMaterial({ color: new THREE.Color("#cfcab8") });
    const crownGeo = new THREE.ConeGeometry(1.1, 3.2, 7); crownGeo.translate(0, 2.4, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6); trunkGeo.translate(0, 0.45, 0);
    const crownEdges = new THREE.EdgesGeometry(crownGeo, 30);
    let ts = 41;
    const trnd = () => { ts = (ts * 16807) % 2147483647; return ts / 2147483647; };
    function grove(cx, cz, n, spread) {
      for (let i = 0; i < n; i++) {
        const a = trnd() * Math.PI * 2, r = Math.sqrt(trnd()) * spread, s = 0.7 + trnd() * 0.7;
        const g = new THREE.Group();
        g.add(new THREE.Mesh(crownGeo, treeFill), new THREE.LineSegments(crownEdges, lineMat), new THREE.Mesh(trunkGeo, inkMat));
        g.position.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r); g.scale.setScalar(s);
        scene.add(g);
      }
    }
    [[-26, -14, 7, 5], [24, 14, 6, 5], [-30, -40, 9, 9], [70, -42, 7, 7], [-70, -110, 10, 10], [130, -118, 9, 9], [40, -205, 12, 12], [160, -40, 8, 8]]
      .forEach((g) => grove(...g));

    /* substation by the trunk road, and a line of pylons heading off the site */
    const SUB = new THREE.Vector3(30, 0, -14);
    const subPad = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ddd9cb") }));
    subPad.rotation.x = -Math.PI / 2; subPad.position.set(SUB.x, 0.025, SUB.z); scene.add(subPad);
    const fence = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 1.6, 10)), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }));
    fence.position.set(SUB.x, 0.8, SUB.z); scene.add(fence);
    [[-3.5, -1.5], [0, -1.5], [3.5, -1.5]].forEach(([dx, dz]) => {
      const tr = solid(new THREE.BoxGeometry(2.2, 2.4, 2.2)); tr.position.set(SUB.x + dx, 1.2, SUB.z + dz); scene.add(tr);
    });
    road(SUB.x - 7, SUB.z + 5, 4, SUB.z + 5, 2);
    const pylonGeo = new THREE.CylinderGeometry(0.15, 0.55, 14, 4); pylonGeo.translate(0, 7, 0);
    const armGeo = new THREE.BoxGeometry(5, 0.2, 0.2);
    const pylons = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Vector3(SUB.x + 14 + i * 34, 0, SUB.z - 6 - i * 4);
      const g = new THREE.Group(); g.position.copy(p);
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(pylonGeo), lineMat));
      const arm = new THREE.Mesh(armGeo, inkMat); arm.position.y = 12.5; g.add(arm);
      scene.add(g); pylons.push(p);
    }
    const wireMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.5, fog: true });
    for (const side of [-2.2, 2.2]) {
      const pts = [new THREE.Vector3(SUB.x + 4, 2.4, SUB.z - 1.5)];
      pylons.forEach((p, i) => {
        const top = new THREE.Vector3(p.x + side * 0.2, 12.4, p.z + side);
        if (i) { const prev = pts[pts.length - 1]; for (let k = 1; k < 8; k++) { const u = k / 8; pts.push(prev.clone().lerp(top, u).add(new THREE.Vector3(0, -Math.sin(Math.PI * u) * 1.4, 0))); } }
        pts.push(top);
      });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }

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
    const MON_BASE = new THREE.Vector3(MON.x, 1.06, MON.z);

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
      const STAND = { hy: 0.9, tx: 0.0, nx: -0.12, ls: [0.0, 0.08], le: -0.15, rs: [-0.05, -0.08], re: -0.15, hp: 0, kn: 0 };
      /* the cheer: both arms straight up, head back */
      const CHEER = { hy: 0.9, tx: -0.08, nx: -0.35, ls: [-2.95, 0.32], le: -0.1, rs: [-2.95, -0.32], re: -0.1, hp: 0, kn: 0 };
      /* after the cheer: hands on hips */
      const HIPS = { hy: 0.9, tx: 0.0, nx: -0.1, ls: [0.25, 0.95], le: -2.1, rs: [0.25, -0.95], re: -2.1, hp: 0, kn: 0 };
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
      return { g: m, head, SULK, WATCH, STAND, CHEER, HIPS, pose };
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

    /* ---------- detents ----------
       Every beat is a detent: crossing `trip` plays the beat forward as one timed animation, dropping below `untrip`
       plays it back. They sit evenly ~0.17 apart over a 420vh pin, so one deliberate gesture moves one beat; the page
       lock in main.js only holds long enough to swallow the flick, and the animation carries on after it lets go. */
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const D = {
      push: { trip: 0.1, untrip: 0.07, f: 1.5, b: 0.9, t: 0, v: 0 },
      fly: { trip: 0.27, untrip: 0.24, f: 2.6, b: 1.2, t: 0, v: 0 },
      scan: { trip: 0.44, untrip: 0.41, f: 3.4, b: 0.9, t: 0, v: 0, after: "fly" },
      farm: { trip: 0.61, untrip: 0.58, f: 2.4, b: 1.6, t: 0, v: 0 },
      end: { trip: 0.8, untrip: 0.77, f: 1.2, b: 0.8, t: 0, v: 0 }
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
        /* a beat that follows another waits for it to land before it starts */
        const ready = !d.after || D[d.after].v >= 0.999;
        if (d.v < d.t && ready) d.v = Math.min(1, d.v + dt / d.f); else if (d.v > d.t) d.v = Math.max(0, d.v - dt / d.b);
      }
      detInit = true;
    }

    /* ---------- camera shots ---------- */
    T04.rotor.rotation.z = PARK; scene.updateMatrixWorld(true);
    const CRACK_W = crackB.localToWorld(crack.local.clone());
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    /* establishing: low and close, the cabin and the operator fill the right half, the farm on the horizon */
    const S0 = { pos: V(CAB.x - 3.4, 1.6, CAB.z + 10.8), look: V(CAB.x + 1.8, 3.2, CAB.z - 30), fov: 40 };
    /* push-in: operator and his screen, right of frame; the SCADA panel opens on the left */
    const SP = { pos: V(CAB.x - 2.2, 1.45, CAB.z + 7.8), look: V(CAB.x + 1.27, 1.35, CAB.z - 11.9), fov: 38 };
    const at = (x, y, z) => CRACK_W.clone().add(V(x, y, z));
    const HOV = at(3.4, 1.9, 6.2);
    const S1 = { pos: at(10.5, -0.6, 18), look: at(-0.6, 1.4, 0), fov: 36 };
    const S1b = { pos: at(8.2, -0.2, 14), look: at(-0.4, 1.2, 0), fov: 34 };
    /* farm: closer and lower than before, so the farm fills the frame left of the dispatch board */
    const S2 = { pos: V(CAB.x - 30, 58, CAB.z + 34), look: V(CAB.x + 8, 16, CAB.z - 96), fov: 44 };
    /* end: back over the cabin, operator on his feet, the farm behind him */
    const S3 = { pos: V(CAB.x - 8, 5.5, CAB.z + 19), look: V(CAB.x + 17, 7.5, CAB.z - 70), fov: 42 };
    const roofPos = V(CAB.x + 1.4, 3.35, CAB.z);
    const path = new THREE.CatmullRomCurve3([
      roofPos.clone().add(V(0, 2.6, 0)),
      V(CAB.x + 2, 11, CAB.z - 8),
      V(T04.x + 2, 24, T04.z + 40),
      at(7, 3, 16),
      HOV.clone()
    ], false, "centripetal");
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
    const flyCam = new THREE.CatmullRomCurve3([SP.pos.clone(), V(CAB.x + 2, 7, CAB.z + 8), V(CAB.x + 25, 17, CAB.z - 14), S1.pos.clone()], false, "centripetal");

    /* leader line from the SCADA panel to the operator's screen */
    const leader = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    leader.setAttribute("class", "tb-leader");
    leader.innerHTML = '<path d="M0 0"/><circle r="4"/>';
    labelsEl.appendChild(leader);
    const leaderPath = leader.querySelector("path"), leaderDot = leader.querySelector("circle");

    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      leader.setAttribute("viewBox", `0 0 ${W} ${H}`);
    }
    window.addEventListener("resize", resize);
    resize();
    resetSim();

    let simLive = false, endState = false, farmState = false, cheerT = -1;
    function frame(now, dt) {
      const p = parseFloat(section.style.getPropertyValue("--p")) || 0;
      stepDetents(p, dt);
      const a = ease(D.push.v), fp = ease(D.fly.v), sB = D.scan.v, c = ease(D.farm.v), e = ease(D.end.v);

      /* turbines turn; flagged and parked ones idle down */
      turbines.forEach((t) => {
        const target = t === T04 ? 0 : t.state === "ok" ? t.speed : t.state === "crew" ? 0 : 0.08;
        t.cur = (t.cur ?? t.speed) + (target - (t.cur ?? t.speed)) * Math.min(1, dt * 0.8);
        if (!reduceMotion) t.angle += t.cur * dt;
        t.rotor.rotation.z = t === T04 ? PARK : t.angle;
      });

      /* drone: lifts off the roof with the push-in, then the flight is one timed move to T-04 */
      const lift = sm(0.35, 1, a);
      if (D.fly.v <= 0) dronePos.copy(roofPos).add(tmpP.set(0, lift * 2.6, 0));
      else dronePos.copy(path.getPoint(fp));
      if (!reduceMotion) dronePos.y += Math.sin(now * 0.0021) * 0.12 * Math.max(lift, D.fly.v > 0 ? 1 : 0);
      if (c > 0 && simLive) dronePos.lerp(simPos, c);
      drone.g.position.copy(dronePos);
      const ahead = D.fly.v > 0 && D.fly.v < 1 ? path.getPoint(Math.min(1, fp + 0.02)) : null;
      if (c > 0.5 && sim.mode === "fly") drone.g.lookAt(tmpL.copy(sim.curve.getPoint(1)).setY(dronePos.y));
      else if (ahead && ahead.distanceToSquared(dronePos) > 1e-4) drone.g.lookAt(ahead.setY(dronePos.y));
      else drone.g.lookAt(tmpL.copy(CRACK_W).setY(dronePos.y));
      if (!reduceMotion) drone.props.forEach((pr, i) => { pr.rotation.z += dt * (i % 2 ? 40 : -40) * (lift > 0.02 || D.fly.v > 0 ? 1 : 0); });

      /* scan sequence (only starts once the drone is on station) */
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
        const early = c <= 0.5 && a > 0.5 && FIRST_FLAGS.includes(t.name) && (t === T04 ? sB < 0.3 : fp < 0.6);
        setLabel(t, (c > 0.5 && e < 0.4 && (t.state === "flagged" || t.state === "visiting")) || early);
        if (t.label) place(t.label, tipOf(t));
      });
      /* the board steps aside at the end so the operator is the subject */
      hudEl.style.opacity = (sm(0.55, 1, c) * (1 - e)).toFixed(3);
      if (!!D.farm.t !== farmState) { farmState = !!D.farm.t; section.classList.toggle("tb-farm", farmState); }

      /* operator: sulk → looks up and taps (push) → on his feet and cheering (end) */
      const tap = Math.sin(Math.PI * clamp(D.push.v * 1.6 - 0.1, 0, 1)) * (D.push.t ? 1 : 0);
      if (D.end.t && cheerT < 0) cheerT = 0;
      if (!D.end.t && e < 0.02) cheerT = -1;
      let hop = 0;
      if (cheerT >= 0 && e > 0.5) {
        cheerT += dt;
        const CH = 1.3;
        if (cheerT < CH && !reduceMotion) {
          hop = Math.abs(Math.sin((Math.PI * cheerT) / (CH / 2))) * 0.42;
          man.pose(man.STAND, man.CHEER, sm(0, 0.15, cheerT), 0);
        } else man.pose(man.CHEER, man.HIPS, sm(CH, CH + 0.45, cheerT), 0);
      } else if (e > 0) man.pose(man.WATCH, man.STAND, e * 2, 0);
      else man.pose(man.SULK, man.WATCH, a, tap);
      man.g.position.y = hop;
      annot.classList.toggle("on", cheerT > 0.1 && e > 0.5);
      /* pinned just above his head, so it reads as his */
      place(annot, man.head.getWorldPosition(tmpP).add(tmpL.set(0, 0.28, 0)), 0, 0, "-50%", "-100%");

      /* SCADA panel: opens with the push-in on the left of the hut, leader line to his screen, gone once the drone leaves */
      const scadaOn = sm(0.15, 0.6, D.push.v) * (1 - sm(0, 0.25, D.fly.v));
      scadaEl.style.opacity = scadaOn.toFixed(3);
      scadaEl.classList.toggle("flagged", D.push.v > 0.55);
      leader.style.opacity = scadaOn.toFixed(3);
      if (scadaOn > 0.01) {
        /* routed low and up the monitor's post like a cable, so it never crosses the operator */
        const mb = project(MON_BASE), r = scadaEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        const x0 = r.right - sr.left, y0 = Math.max(r.bottom - sr.top - 26, mb.y + 40);
        leaderPath.setAttribute("d", `M${x0.toFixed(1)} ${y0.toFixed(1)} H${mb.x.toFixed(1)} V${mb.y.toFixed(1)}`);
        leaderDot.setAttribute("cx", mb.x.toFixed(1)); leaderDot.setAttribute("cy", mb.y.toFixed(1));
      }

      /* captions latch: one per beat */
      const cap = D.end.t ? -1 : D.farm.t ? 4 : D.scan.t ? 3 : D.fly.t ? 2 : D.push.t ? 1 : 0;
      caps.forEach((el, i) => el.classList.toggle("on", i === cap));
      if (!!D.end.t !== endState) { endState = !!D.end.t; section.classList.toggle("tb-end", endState); }

      /* camera: establishing → push-in → chase along the flight → scan push-in → farm pull-back → back to the cabin */
      camPos.copy(S0.pos).lerp(SP.pos, a); camLook.copy(S0.look).lerp(SP.look, a);
      let fov = S0.fov + (SP.fov - S0.fov) * a;
      if (D.fly.v > 0) {
        /* a steady crane move: the camera glides along its own smooth path behind the drone, and its aim drifts
           from the cabin to the turbine with only a gentle pull toward the drone, so the frame never whips around */
        camPos.copy(flyCam.getPoint(fp));
        tmpL.copy(SP.look).lerp(S1.look, sm(0, 1, fp)).lerp(dronePos, 0.42 * Math.sin(Math.PI * fp));
        camLook.copy(tmpL);
        fov = SP.fov + (S1.fov - SP.fov) * fp;
      }
      const sb = ease(clamp(sB / 0.5, 0, 1)) * fp;
      camPos.lerp(S1b.pos, sb); camLook.lerp(S1b.look, sb); fov += (S1b.fov - fov) * sb;
      if (c > 0) {
        /* rise first, then swing out, so the pull-back reads as the camera backing away from the turbine */
        const up = tmpP.copy(camPos).lerp(S2.pos, c); up.y += Math.sin(Math.PI * c) * 14;
        camPos.copy(up); camLook.lerp(S2.look, ease(c)); fov += (S2.fov - fov) * c;
      }
      if (!reduceMotion && c > 0.99) { camPos.x += Math.sin(now * 0.00008) * 5 * (1 - e); }
      if (e > 0) { camPos.lerp(S3.pos, e); camLook.lerp(S3.look, e); fov += (S3.fov - fov) * e; }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.fov = fov;
      /* framing: clear of the captions; during the farm, left of the dispatch board; at the end, right for the copy */
      const shift = W * (0.06 - c * (1 - e) * 0.16 + e * 0.2);
      camera.setViewOffset(W, H, -shift, 0, W, H);
      camera.updateProjectionMatrix();
      chips.forEach((q) => place(q.el, q.pos));
      droneTag.style.opacity = (sm(0.6, 1, c) * (1 - e)).toFixed(3);
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
