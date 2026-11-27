import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

{
  const section = document.getElementById("cad");
  const stage = document.getElementById("cadStage");
  const canvas = document.getElementById("cadCanvas");
  const labelsEl = document.getElementById("cadLabels");
  const leadersEl = document.getElementById("cadLeaders");
  const statusEl = document.getElementById("cadStatus");
  const noteEl = document.getElementById("cadNote");
  const partsEl = document.getElementById("cadParts");
  const trisEl = document.getElementById("cadTris");
  const legendEl = document.getElementById("cadLegend");
  const phaseEls = [...section.querySelectorAll(".cad-phases li")];
  const tabs = [...section.querySelectorAll(".cad-tabs button")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Explode offsets in mm, Y up, +Z is the front of the model. */
  const MODELS = {
    speaker: {
      file: "assets/models/speaker.gltf.json",
      note: "Recreated from the product: the enclosure, a teal face plate, woofer and tweeter with their grilles, the volume knob, and the power button with its LED.",
      edgeAngle: 25,
      explode: {
        "Grilles": [0, 0, 150], "Face plate": [0, 0, 100], "Volume knob": [0, 55, 125], "Power button": [0, 55, 125],
        "Tweeter": [0, 0, 55], "Woofer": [0, 0, 55], "Enclosure": [0, 0, -45]
      }
    },
    devkit: {
      file: "assets/models/devkit.gltf.json",
      note: "An enclosure packaged around an NVIDIA Jetson dev kit with its 40 mm fan, an Intel RealSense D415 depth camera, a phone that records telemetry and adds network, barometer and accelerometer readouts, a 3S LiPo pack and an XT60 → USB 5 V converter, between a mount plate and top and bottom covers.",
      edgeAngle: 35,
      rename: { "iPhone 17 Pro Max": "Phone" },
      explode: {
        "Top cover": [0, 170, 0], "Jetson dev kit": [0, 105, 35], "LiPo pack": [0, 65, -70], "XT60 → USB 5 V": [0, 40, -25],
        "Intel D415 depth camera": [-130, 25, 0], "iPhone 17 Pro Max": [120, -10, 40], "Mount plate": [0, -35, 0], "Bottom cover": [0, -85, 0]
      }
    }
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    stage.classList.add("no-webgl");
    statusEl.textContent = "3D isn't available in this browser, so here are the renders.";
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.5, 2);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const pivot = new THREE.Group();
  scene.add(pivot);

  /* soft contact shadow */
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(23,22,15,0.35)");
    grd.addColorStop(1, "rgba(23,22,15,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  pivot.add(shadow);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  let current = null;
  let currentKey = null;
  let loadToken = 0;

  const PAPER = new THREE.Color("#ebe8de");
  const INK = new THREE.Color("#17160f");

  function prepare(keyName, gltf) {
    const cfg = MODELS[keyName];
    const root = gltf.scene.getObjectByName("model") || gltf.scene;
    const parts = [];
    let tris = 0;
    root.children.forEach((grp) => {
      const box = new THREE.Box3().setFromObject(grp);
      const name = grp.name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
      const entry = { name: (cfg.rename && cfg.rename[name]) || name, group: grp, center: box.getCenter(new THREE.Vector3()), offset: new THREE.Vector3(...(cfg.explode[name] || [0, 0, 0])), mats: [] };
      grp.traverse((o) => {
        if (!o.isMesh) return;
        tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        const m = o.material;
        entry.mats.push({ m, color: m.color.clone(), metal: m.metalness, emissive: m.emissive ? m.emissive.clone() : null });
        m.polygonOffset = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits = 1;
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(o.geometry, cfg.edgeAngle),
          new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 1 })
        );
        o.add(edges);
        entry.mats.push({ line: edges.material });
      });
      parts.push(entry);
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const exploded = box.clone();
    parts.forEach((p) => {
      const pb = new THREE.Box3().setFromObject(p.group);
      exploded.union(pb.translate(p.offset));
    });
    return { key: keyName, root, parts, tris, size, box, exploded, note: cfg.note };
  }

  function show(model) {
    if (current) pivot.remove(current.root);
    current = model;
    pivot.add(model.root);
    const s = model.size;
    shadow.scale.set(s.x * 1.6, s.z * 1.6, 1);
    shadow.position.y = model.box.min.y + 0.2;
    noteEl.textContent = model.note;
    partsEl.textContent = String(model.parts.length);
    trisEl.textContent = Math.round(model.tris / 1000) + "k";
    labelsEl.innerHTML = model.parts.map((p, i) => `<span class="cad-label"><b>${String(i + 1).padStart(2, "0")}</b><span></span></span>`).join("");
    labelsEl.querySelectorAll(".cad-label > span").forEach((el, i) => { el.textContent = model.parts[i].name; });
    legendEl.innerHTML = model.parts.map((p, i) => `<li><b>${String(i + 1).padStart(2, "0")}</b><span></span></li>`).join("");
    legendEl.querySelectorAll("span").forEach((el, i) => { el.textContent = model.parts[i].name; });
    leadersEl.innerHTML = model.parts.map(() => '<line /><circle r="3" />').join("");
    fit();
    statusEl.hidden = true;
  }

  function select(keyName) {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.model === keyName)));
    currentKey = keyName;
    const token = ++loadToken;
    if (cache[keyName]) { show(cache[keyName]); return; }
    statusEl.hidden = false;
    statusEl.textContent = "Loading model…";
    loader.load(MODELS[keyName].file, (gltf) => {
      cache[keyName] = prepare(keyName, gltf);
      if (token === loadToken) show(cache[keyName]);
    }, (ev) => {
      if (token === loadToken && ev.total) statusEl.textContent = `Loading model… ${Math.min(99, Math.round(ev.loaded / ev.total * 100))}%`;
    }, () => {
      if (token !== loadToken) return;
      stage.classList.add("no-webgl");
      statusEl.textContent = "The model couldn't load, so here are the renders.";
    });
  }
  tabs.forEach((t) => t.addEventListener("click", () => select(t.dataset.model)));

  /* ---------- camera fit ---------- */
  let W = 0, H = 0, dist = 400, distA = 400, distE = 400;
  const target = new THREE.Vector3();
  function fit() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    leadersEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!current) return;
    target.copy(current.box.getCenter(new THREE.Vector3()));
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const half = Math.sin(Math.min(vFov, hFov) / 2);
    distE = (current.exploded.getBoundingSphere(new THREE.Sphere()).radius * (W < 700 ? 1.08 : 1.25)) / half;
    distA = (current.box.getBoundingSphere(new THREE.Sphere()).radius * (W < 700 ? 1.15 : 1.45)) / half;
  }
  new ResizeObserver(fit).observe(stage);

  /* ---------- drag to rotate (mouse and horizontal touch) ---------- */
  let yawUser = 0, pitchUser = 0, dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yawUser += (e.clientX - lx) * 0.008;
    pitchUser = Math.max(-0.5, Math.min(0.6, pitchUser + (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  /* ---------- scroll timeline ---------- */
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function progress() {
    const r = section.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }

  let visible = false;
  new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    if (visible && !currentKey) select("speaker");
  }, { rootMargin: "600px 0px" }).observe(section);

  /* detents: line drawing → solid → exploded. Each threshold trips a timed animation (with an
     earlier untrip point so the edge can't flicker); only the spin below stays tied to scroll. */
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const mkStage = (trip, untrip, dur) => ({ trip, untrip, dur, on: false, u: 0 });
  const fillD = mkStage(0.1, 0.07, 900), exD = mkStage(0.26, 0.22, 1100);
  let lastT = 0, detentInit = false;
  function stepStage(d, p, dt) {
    if (!d.on && p >= d.trip) d.on = true; else if (d.on && p < d.untrip) d.on = false;
    if (!detentInit) { d.u = d.on ? 1 : 0; return; }
    d.u = reduceMotion ? (d.on ? 1 : 0) : Math.max(0, Math.min(1, d.u + (d.on ? 1 : -1) * (dt / d.dur)));
  }

  const tmp = new THREE.Vector3();
  let shown = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = lastT ? Math.min(100, t - lastT) : 0; lastT = t;
    if (!visible || !current) return;
    const p = progress();
    stepStage(fillD, p, dt); stepStage(exD, p, dt); detentInit = true;
    const fill = easeIO(fillD.u);
    const ex = easeIO(exD.u);
    /* detent: exploded and held; scrolling here spins the model a full turn while the camera eases in */
    const spin = smooth(0.46, 0.9, p);
    shown += ((ex > 0.55 ? 1 : 0) - shown) * 0.15;

    phaseEls.forEach((el, i) => el.classList.toggle("on", i === (ex > 0.05 ? 2 : fill > 0.05 ? 1 : 0)));

    for (const part of current.parts) {
      part.group.position.copy(part.offset).multiplyScalar(ex);
      for (const mm of part.mats) {
        if (mm.line) { mm.line.opacity = 1 - fill * 0.82; continue; }
        mm.m.color.copy(PAPER).lerp(mm.color, fill);
        mm.m.metalness = mm.metal * fill;
        if (mm.emissive) mm.m.emissive.copy(mm.emissive).multiplyScalar(fill);
      }
    }
    shadow.material.opacity = 1 - ex * 0.6;

    dist = (distA + (distE - distA) * ex) * (1 - 0.22 * Math.sin(Math.PI * spin));
    const drift = reduceMotion ? 0 : t * 0.00008;
    const yaw = -0.75 + smooth(0, 0.44, p) * 0.6 + spin * Math.PI * 2 + drift + yawUser;
    const pitch = 0.32 + pitchUser - ex * 0.06;
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.lookAt(target);
    renderer.render(scene, camera);

    /* labels + leader lines, pushed apart so they never overlap */
    const lines = leadersEl.querySelectorAll("line");
    const dots = leadersEl.querySelectorAll("circle");
    const labels = labelsEl.children;
    const narrow = W < 700;
    const pts = current.parts.map((part, i) => {
      tmp.copy(part.center).add(part.group.position).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
      return { i, x, y, left: x < W / 2, ly: y };
    });
    if (!narrow) {
      for (const side of [true, false]) {
        const col = pts.filter((q) => q.left === side).sort((a, b) => a.y - b.y);
        for (let k = 1; k < col.length; k++) col[k].ly = Math.max(col[k].ly, col[k - 1].ly + 28);
        const over = col.length ? col[col.length - 1].ly - (H - 16) : 0;
        if (over > 0) col.forEach((q) => { q.ly -= over; });
      }
    }
    const fade = shown.toFixed(3);
    for (const q of pts) {
      const lxp = narrow ? q.x : q.left ? Math.max(12, q.x - 110) : Math.min(W - 12, q.x + 110);
      const el = labels[q.i];
      el.style.transform = narrow
        ? `translate(${q.x}px, ${q.y}px) translate(-50%, -50%)`
        : `translate(${lxp}px, ${q.ly}px) translate(${q.left ? "-100%" : "0"}, -50%)`;
      el.style.opacity = fade;
      lines[q.i].setAttribute("x1", q.x); lines[q.i].setAttribute("y1", q.y);
      lines[q.i].setAttribute("x2", lxp); lines[q.i].setAttribute("y2", q.ly);
      lines[q.i].style.opacity = narrow ? 0 : fade;
      dots[q.i].setAttribute("cx", q.x); dots[q.i].setAttribute("cy", q.y);
      dots[q.i].style.opacity = narrow ? 0 : fade;
    }
    legendEl.style.opacity = fade;
  }
  requestAnimationFrame(frame);
}
