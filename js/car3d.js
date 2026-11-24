import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* DWG 004: Rave Mode in the place it was built for, a car cabin at night.
   The camera backs in through the driver's window, turns between the front seats, holds while the
   engine (js/rave-worklet.js) drives the four light zones, then drops out of the passenger window.
   Right-hand drive. Flip RHD to mirror the whole cabin. */
{
  const RHD = true;
  const S = RHD ? 1 : -1; /* +1: driver sits on +x */

  const section = document.getElementById("rave");
  const canvas = document.getElementById("car");
  const capA = document.getElementById("carCapA");
  const capB = document.getElementById("carCapB");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bus = () => window.__rave;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    section.classList.add("no-car");
    throw err;
  }
  window.__carActive = true;
  section.classList.add("has-car");
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050507");
  scene.fog = new THREE.FogExp2("#050507", 0.011);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.02, 200);
  camera.rotation.order = "YXZ";

  /* ---------------- materials ---------------- */
  const M = {
    leather: new THREE.MeshStandardMaterial({ color: "#1b1816", roughness: 0.72 }),
    insert: new THREE.MeshStandardMaterial({ color: "#2c2622", roughness: 0.82 }),
    trim: new THREE.MeshStandardMaterial({ color: "#131316", roughness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: "#8d8f94", roughness: 0.28, metalness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: "#2a1d16", roughness: 0.35, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: "#060608", roughness: 0.12, metalness: 0.4 }),
    carpet: new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 1 }),
    headliner: new THREE.MeshStandardMaterial({ color: "#1f1e1c", roughness: 0.95 }),
    paint: new THREE.MeshStandardMaterial({ color: "#0e1116", roughness: 0.3, metalness: 0.75 }),
    tyre: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.9 })
  };

  const car = new THREE.Group();
  scene.add(car);
  const box = (w, h, d, mat, x, y, z, r = 0.02, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    car.add(m);
    return m;
  };
  const deg = THREE.MathUtils.degToRad;

  /* floor, roof, firewall, rear */
  box(1.7, 0.04, 2.7, M.carpet, 0, 0.1, 0.25, 0.01);
  box(1.72, 0.04, 2.0, M.headliner, 0, 1.45, 0.45, 0.02);
  box(1.66, 0.6, 0.05, M.trim, 0, 0.42, -1.02, 0.02);
  box(1.66, 0.75, 0.06, M.trim, 0, 0.95, 1.5, 0.03);

  /* dashboard: lower body, upper cowl, glass display, knee panel, wood band */
  box(1.62, 0.3, 0.46, M.trim, 0, 0.8, -0.8, 0.06);
  box(1.62, 0.07, 0.4, M.leather, 0, 0.975, -0.84, 0.03);
  const glass = box(1.3, 0.2, 0.035, M.glass, 0, 1.03, -0.62, 0.015, deg(-9));
  box(1.6, 0.26, 0.22, M.trim, 0, 0.55, -0.66, 0.05);
  box(1.56, 0.035, 0.02, M.wood, 0, 0.86, -0.565, 0.008);
  /* slim vents */
  for (const vx of [-0.5, -0.18, 0.18, 0.5]) box(0.2, 0.03, 0.02, M.metal, vx, 0.915, -0.565, 0.008);

  /* screens: one emissive canvas across the glass (passenger | projection | cluster) */
  const scr = document.createElement("canvas");
  scr.width = 2048; scr.height = 320;
  const sx = scr.getContext("2d");
  const scrTex = new THREE.CanvasTexture(scr);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.197), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  screen.position.set(0, 0, 0.0185);
  glass.add(screen);
  if (!RHD) screen.scale.x = -1;

  /* centre console + armrest + wood inlay */
  box(0.28, 0.42, 1.0, M.trim, 0, 0.36, -0.2, 0.05);
  box(0.3, 0.07, 0.46, M.leather, 0, 0.6, 0.16, 0.035);
  box(0.2, 0.012, 0.42, M.wood, 0, 0.575, -0.38, 0.005);
  box(0.06, 0.03, 0.06, M.metal, 0, 0.6, -0.5, 0.015);

  /* steering wheel on the driver side */
  const wheel = new THREE.Group();
  wheel.position.set(S * 0.37, 0.93, -0.44);
  wheel.rotation.x = deg(-22);
  car.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.019, 14, 60), M.leather);
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 32), M.trim);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  for (const a of [0, 180, 270]) {
    const sp = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.02, 2, 0.008), M.metal);
    sp.position.set(Math.cos(deg(a)) * 0.1, Math.sin(deg(a)) * 0.1, 0);
    sp.rotation.z = deg(a);
    wheel.add(sp);
  }
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 16), M.trim);
  column.position.set(S * 0.37, 0.88, -0.6);
  column.rotation.x = deg(68);
  car.add(column);

  /* seats */
  function seat(x, z, w = 0.52) {
    box(w, 0.14, 0.52, M.leather, x, 0.42, z, 0.06);
    box(w * 0.62, 0.02, 0.4, M.insert, x, 0.495, z - 0.02, 0.01);
    const back = box(w, 0.7, 0.15, M.leather, x, 0.82, z + 0.28, 0.07, deg(-12));
    box(w * 0.6, 0.5, 0.02, M.insert, x, 0.8, z + 0.2, 0.01, deg(-12));
    box(0.3, 0.2, 0.11, M.leather, x, 1.24, z + 0.38, 0.05, deg(-8));
    box(0.07, 0.5, 0.18, M.leather, x - w / 2 + 0.035, 0.78, z + 0.27, 0.035, deg(-12));
    box(0.07, 0.5, 0.18, M.leather, x + w / 2 - 0.035, 0.78, z + 0.27, 0.035, deg(-12));
    return back;
  }
  seat(-0.37, 0.05);
  seat(0.37, 0.05);
  box(1.42, 0.14, 0.52, M.leather, 0, 0.42, 1.0, 0.06);
  box(1.42, 0.62, 0.16, M.leather, 0, 0.8, 1.3, 0.07, deg(-10));

  /* doors (inner panel, armrest, outer skin) and the window frame */
  const doorZ0 = -0.92, doorZ1 = 1.4;
  for (const side of [-1, 1]) {
    box(0.08, 0.86, doorZ1 - doorZ0, M.trim, side * 0.82, 0.57, (doorZ0 + doorZ1) / 2, 0.03);
    box(0.1, 0.05, 1.0, M.leather, side * 0.77, 0.72, -0.05, 0.025);
    box(0.012, 0.3, 1.2, M.wood, side * 0.778, 0.86, 0.1, 0.004);
    box(0.03, 0.9, doorZ1 - doorZ0 + 0.2, M.paint, side * 0.9, 0.55, (doorZ0 + doorZ1) / 2, 0.012);
    box(0.06, 0.03, 2.5, M.paint, side * 0.86, 1.43, 0.3, 0.015);
    box(0.07, 0.46, 0.1, M.paint, side * 0.84, 1.2, 0.62, 0.02);
    const aP = box(0.07, 0.62, 0.08, M.paint, side * 0.83, 1.2, -0.68, 0.02, deg(-48));
    aP.position.z = -0.72;
    box(0.07, 0.46, 0.1, M.paint, side * 0.84, 1.2, 1.42, 0.02);
  }

  /* outside: road, a few wheels under the sills for the fall, city bokeh */
  const roadTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#1a1b1e"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const v = 18 + Math.random() * 34; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    return c;
  })();
  const asphalt = new THREE.CanvasTexture(roadTex);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(40, 40);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: asphalt, color: "#7a7c82", roughness: 0.62, metalness: 0.15 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = -0.38;
  scene.add(road);
  /* lane dashes and kerbs */
  const paintM = new THREE.MeshStandardMaterial({ color: "#c9c6bb", roughness: 0.7 });
  for (let z = -40; z < 40; z += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3), paintM);
    dash.rotation.x = -Math.PI / 2; dash.position.set(-2.7 * S, -0.375, z); scene.add(dash);
  }
  for (const side of [-1, 1]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 90), new THREE.MeshStandardMaterial({ color: "#3a3a3d", roughness: 0.8 }));
    kerb.position.set(side * 4.4, -0.3, 0); scene.add(kerb);
  }
  for (const [wx, wz] of [[-0.86, -1.25], [0.86, -1.25], [-0.86, 1.8], [0.86, 1.8]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 32), M.tyre);
    t.rotation.z = Math.PI / 2;
    t.position.set(wx, -0.04, wz);
    car.add(t);
  }
  const lower = box(1.86, 0.36, 4.6, M.paint, 0, -0.08, 0.3, 0.1);
  lower.material = M.paint;

  const dot = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  {
    const N = 380, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const tones = [[1, 0.72, 0.42], [1, 0.86, 0.66], [0.55, 0.75, 1], [1, 0.42, 0.32], [0.9, 0.9, 1]];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 60;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = -0.25 + Math.pow(Math.random(), 2.6) * 6; pos[i * 3 + 2] = Math.sin(a) * r;
      const t = tones[(Math.random() * tones.length) | 0], k = 0.45 + Math.random() * 0.7;
      col[i * 3] = t[0] * k; col[i * 3 + 1] = t[1] * k; col[i * 3 + 2] = t[2] * k;
    }
    const gpts = new THREE.BufferGeometry();
    gpts.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gpts.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(gpts, new THREE.PointsMaterial({ size: 0.38, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })));

    /* buildings with lit windows */
    const win = document.createElement("canvas"); win.width = 128; win.height = 256;
    const wg = win.getContext("2d");
    wg.fillStyle = "#07080b"; wg.fillRect(0, 0, 128, 256);
    for (let y = 4; y < 252; y += 8) for (let x = 4; x < 126; x += 6) {
      if (Math.random() < 0.2) { const w = Math.random(); wg.fillStyle = w < 0.72 ? "rgba(255,190,115,.85)" : w < 0.93 ? "rgba(190,210,255,.75)" : "rgba(255,120,90,.7)"; wg.fillRect(x, y, 3, 4); }
    }
    const winTex = new THREE.CanvasTexture(win);
    winTex.colorSpace = THREE.SRGBColorSpace;
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = 48 + Math.random() * 55;
      const w = 10 + Math.random() * 14, h = 14 + Math.random() * 50, d = 10 + Math.random() * 12;
      const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(w / 12, h / 18); t.offset.set(Math.random(), Math.random());
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: "#06070a", roughness: 0.9, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.38 }));
      m.position.set(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r);
      m.lookAt(0, h / 2 - 0.4, 0);
      scene.add(m);
    }
    /* street lamps along the kerb */
    for (const z of [-14, -4, 6, 16]) for (const side of [-1, 1]) {
      const x = side * 5.2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 6, 10), M.trim);
      pole.position.set(x, 2.6, z); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 1.0), toneMapped: false }));
      head.position.set(x - side * 0.5, 5.6, z); scene.add(head);
      const l = new THREE.PointLight(0xffb070, 14, 18, 1.6); l.position.copy(head.position); scene.add(l);
    }
  }

  /* ---------------- the four light zones (LED order = the real strip) ----------------
     seg 0 (73): dash sweep · seg 1 (34): driver door · seg 2 (56): console, both sides · seg 3 (34): passenger door */
  const zones = [];
  function lightLine(points, idx, radius = 0.0045) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const segs = Math.max(24, idx.length * 2), radial = 6;
    const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    car.add(mesh);
    zones.push({ geo, colors, segs, radial, idx });
  }
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const D = S; /* driver side sign */
  lightLine([[-0.79, 0.9, -0.63], [-0.5, 0.895, -0.585], [0, 0.893, -0.575], [0.5, 0.895, -0.585], [0.79, 0.9, -0.63]].map(([x, y, z]) => [x * (RHD ? 1 : -1), y, z]), range(0, 73));
  lightLine([[D * 0.776, 0.905, -0.66], [D * 0.774, 0.92, 0.0], [D * 0.774, 0.915, 0.72], [D * 0.776, 0.9, 1.25]], range(73, 107));
  lightLine([[-0.142, 0.585, -0.66], [-0.142, 0.585, 0.38]], range(107, 135), 0.0038);
  lightLine([[0.142, 0.585, -0.66], [0.142, 0.585, 0.38]], range(135, 163), 0.0038);
  lightLine([[-D * 0.776, 0.905, -0.66], [-D * 0.774, 0.92, 0.0], [-D * 0.774, 0.915, 0.72], [-D * 0.776, 0.9, 1.25]], range(163, 197));

  /* light spill onto the cabin: one point light per zone, plus footwells and the screen */
  const spill = [
    { light: new THREE.PointLight(0xffffff, 0, 2.4, 1.4), at: [0, 1.05, -0.2], idx: range(0, 73), k: 1.4 },
    { light: new THREE.PointLight(0xffffff, 0, 1.8, 1.6), at: [D * 0.62, 0.95, 0.15], idx: range(73, 107), k: 1.2 },
    { light: new THREE.PointLight(0xffffff, 0, 1.8, 1.6), at: [-D * 0.62, 0.95, 0.15], idx: range(163, 197), k: 1.2 },
    { light: new THREE.PointLight(0xffffff, 0, 1.4, 1.8), at: [0, 0.68, -0.1], idx: range(107, 163), k: 0.9 },
    { light: new THREE.PointLight(0xffffff, 0, 1.2, 1.8), at: [-0.4, 0.2, -0.55], idx: range(107, 163), k: 0.8 },
    { light: new THREE.PointLight(0xffffff, 0, 1.2, 1.8), at: [0.4, 0.2, -0.55], idx: range(107, 163), k: 0.8 }
  ];
  spill.forEach((s) => { s.light.position.set(...s.at); car.add(s.light); });
  spill.push({ light: new THREE.PointLight(0xffffff, 0, 4.5, 1.4), at: [-D * 1.25, 0.6, 0.1], idx: range(163, 197), k: 3.2 });
  car.add(spill[spill.length - 1].light);
  spill[spill.length - 1].light.position.set(-D * 1.25, 0.6, 0.1);
  const screenLight = new THREE.PointLight(0x8899ff, 0.25, 1.4, 1.8);
  screenLight.position.set(0, 1.0, -0.4);
  car.add(screenLight);
  scene.add(new THREE.HemisphereLight(0x3a3f55, 0x050505, 0.18));
  const moon = new THREE.DirectionalLight(0x8090b0, 0.25);
  moon.position.set(-3, 6, 2);
  scene.add(moon);

  /* ---------------- post: bloom on the light lines ---------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.45, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w * (mobile ? 0.35 : 0.5), h * (mobile ? 0.35 : 0.5));
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 78 : w / h < 1.2 ? 68 : 56;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------------- camera path ----------------
     yaw 0 looks forward (-z); negative turns toward +x. Keys mirror with S for left-hand drive. */
  const K = [
    [0.00, [1.45, 1.17, 0.06], -90, 1],
    [0.08, [1.05, 1.17, 0.06], -90, 0],
    [0.15, [0.70, 1.17, 0.06], -90, 0],
    [0.24, [0.38, 1.15, 0.06], -92, -2],
    [0.32, [0.05, 1.16, 0.14], -70, -4],
    [0.40, [0.0, 1.17, 0.58], -8, -7],
    [0.46, [0.0, 1.16, 0.6], 0, -7],
    [0.70, [0.0, 1.13, 0.42], 0, -6],
    [0.78, [-0.18, 1.15, 0.16], 40, -4],
    [0.85, [-0.45, 1.17, 0.06], 88, -2],
    [0.91, [-0.92, 1.18, 0.06], 90, -10],
    [0.96, [-1.45, 0.95, 0.1], 90, -38],
    [1.00, [-1.85, 0.2, 0.16], 92, -70]
].map(([t, p, yaw, pitch]) => ({ t, p: [p[0] * S, p[1], p[2]], yaw: yaw * S, pitch }));
  const cr = (a, b, c, d, u) => {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  };
  function pose(t) {
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
    const u = Math.max(0, Math.min(1, (t - b.t) / (c.t - b.t)));
    return {
      x: cr(a.p[0], b.p[0], c.p[0], d.p[0], u), y: cr(a.p[1], b.p[1], c.p[1], d.p[1], u), z: cr(a.p[2], b.p[2], c.p[2], d.p[2], u),
      yaw: cr(a.yaw, b.yaw, c.yaw, d.yaw, u), pitch: cr(a.pitch, b.pitch, c.pitch, d.pitch, u)
    };
  }

  /* ---------------- the screen: passenger | phone projection | cluster ---------------- */
  const coverCache = { src: "", img: null };
  function rgbCss(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
  function drawScreen(now) {
    const R = bus();
    const W = scr.width, H = scr.height;
    sx.fillStyle = "#020203";
    sx.fillRect(0, 0, W, H);
    const pal = R ? R.engine.cur : [[30, 20, 50], [255, 60, 170], [70, 200, 255]];
    const bass = R ? R.engine.liveBass : 0, treble = R ? R.engine.liveTreble : 0;

    /* projection panel in the middle: the Rave Mode fluid as wallpaper, dock, now playing */
    const px = 700, pw = 820;
    sx.save();
    sx.beginPath(); sx.roundRect(px, 22, pw, H - 44, 26); sx.clip();
    if (R && R.fluid && R.fluid.width > 1) sx.drawImage(R.fluid, px, 22, pw, H - 44);
    sx.fillStyle = "rgba(0,0,0,.28)"; sx.fillRect(px, 22, pw, H - 44);
    /* dock */
    sx.fillStyle = "rgba(10,10,14,.55)"; sx.fillRect(px, 22, 104, H - 44);
    const icons = [[255, 90, 90], pal[1], [120, 210, 140], [110, 160, 255]];
    icons.forEach((c, i) => {
      sx.fillStyle = rgbCss(c, 0.9);
      sx.beginPath(); sx.roundRect(px + 24, 46 + i * 64, 56, 56, 15); sx.fill();
      sx.fillStyle = "rgba(255,255,255,.9)";
      sx.beginPath();
      if (i === 0) { sx.moveTo(px + 44, 62 + i * 64); sx.lineTo(px + 64, 74 + i * 64); sx.lineTo(px + 44, 86 + i * 64); }
      else if (i === 1) { for (let k = 0; k < 4; k++) sx.rect(px + 38 + k * 8, 86 + i * 64 - 8 - ((k * 7) % 18), 5, 8 + ((k * 7) % 18)); }
      else if (i === 2) sx.arc(px + 52, 74 + i * 64, 12, 0, Math.PI * 2);
      else { sx.rect(px + 40, 64 + i * 64, 24, 4); sx.rect(px + 40, 72 + i * 64, 24, 4); sx.rect(px + 40, 80 + i * 64, 16, 4); }
      sx.fill();
    });
    /* cover */
    const cover = R && R.coverSrc;
    if (cover && cover !== coverCache.src) { coverCache.src = cover; coverCache.img = new Image(); coverCache.img.src = cover; }
    const cx0 = px + 140, cy0 = 52, cs = 190;
    sx.fillStyle = rgbCss(pal[1], 0.5);
    sx.beginPath(); sx.roundRect(cx0, cy0, cs, cs, 18); sx.fill();
    if (coverCache.img && coverCache.img.complete && coverCache.img.naturalWidth) {
      sx.save(); sx.beginPath(); sx.roundRect(cx0, cy0, cs, cs, 18); sx.clip();
      sx.drawImage(coverCache.img, cx0, cy0, cs, cs); sx.restore();
    }
    /* text + transport */
    const tx = cx0 + cs + 34;
    sx.fillStyle = "#fff";
    sx.font = "700 40px 'Segoe UI', system-ui, sans-serif";
    sx.fillText(fit((R && R.title) || "Rave Mode", 340), tx, 96);
    sx.fillStyle = "rgba(255,255,255,.72)";
    sx.font = "600 24px 'Segoe UI', system-ui, sans-serif";
    sx.fillText(fit(((R && R.artist) || "flip the switch on the left").toUpperCase(), 340), tx, 132);
    const prog = R && R.progress ? R.progress() : 0;
    sx.fillStyle = "rgba(255,255,255,.2)"; sx.fillRect(tx, 160, 330, 6);
    sx.fillStyle = "#fff"; sx.fillRect(tx, 160, 330 * prog, 6);
    sx.fillStyle = "rgba(255,255,255,.9)";
    const by = 214;
    sx.beginPath(); sx.moveTo(tx + 150, by - 18); sx.lineTo(tx + 150, by + 18); sx.lineTo(tx + 120, by); sx.closePath(); sx.fill();
    if (R && R.on) { sx.fillRect(tx + 182, by - 18, 9, 36); sx.fillRect(tx + 198, by - 18, 9, 36); }
    else { sx.beginPath(); sx.moveTo(tx + 182, by - 18); sx.lineTo(tx + 210, by); sx.lineTo(tx + 182, by + 18); sx.closePath(); sx.fill(); }
    sx.beginPath(); sx.moveTo(tx + 240, by - 18); sx.lineTo(tx + 270, by); sx.lineTo(tx + 240, by + 18); sx.closePath(); sx.fill();
    sx.restore();

    /* passenger screen: the four light zones, live */
    const lx = 40;
    sx.fillStyle = "rgba(255,255,255,.55)";
    sx.font = "700 20px 'Segoe UI', system-ui, sans-serif";
    sx.fillText("AMBIENT · RAVE MODE", lx, 62);
    if (R) {
      const E = R.engine, rows = [["DASH", 0, 73], ["DRIVER DOOR", 73, 107], ["CONSOLE", 107, 163], ["PASSENGER DOOR", 163, 197]];
      rows.forEach(([name, a, b], j) => {
        const y = 96 + j * 52;
        sx.fillStyle = "rgba(255,255,255,.5)";
        sx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
        sx.fillText(name, lx, y + 4);
        const w = 420, x0 = lx + 190, n = b - a;
        for (let k = 0; k < n; k++) {
          const i = a + k;
          sx.fillStyle = `rgb(${Math.min(255, E.rs[i] * 2) | 0},${Math.min(255, E.gs[i] * 2) | 0},${Math.min(255, E.bs[i] * 2) | 0})`;
          sx.fillRect(x0 + (k / n) * w, y - 12, w / n - 1, 22);
        }
      });
    }

    /* cluster in front of the driver */
    const kx = 1580;
    const d = new Date();
    sx.fillStyle = "#fff";
    sx.font = "300 96px 'Segoe UI', system-ui, sans-serif";
    sx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, kx, 150);
    sx.fillStyle = "rgba(255,255,255,.6)";
    sx.font = "600 26px 'Segoe UI', system-ui, sans-serif";
    sx.fillText("P   R   N   D", kx + 6, 206);
    sx.fillStyle = rgbCss(pal[1]);
    sx.fillRect(kx + 6, 214, 22, 4);
    sx.fillStyle = "rgba(255,255,255,.45)";
    sx.font = "600 18px 'Segoe UI', system-ui, sans-serif";
    sx.fillText(`BASS ${(bass * 100) | 0}   TREBLE ${(treble * 100) | 0}`, kx + 6, 262);
    scrTex.needsUpdate = true;
  }
  function fit(text, max) {
    if (sx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && sx.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
  }

  /* ---------------- drive the lights from the engine ---------------- */
  const tmpC = new THREE.Color();
  function updateLights() {
    const R = bus();
    if (!R) return;
    const E = R.engine;
    const boost = 2.1; /* LED values are 0-255 PWM; lines are emissive and bloom above 1.0 */
    for (const z of zones) {
      const rings = z.segs + 1, per = z.radial + 1, n = z.idx.length;
      for (let r = 0; r < rings; r++) {
        const li = z.idx[Math.min(n - 1, Math.floor((r / z.segs) * n))];
        const cr0 = (E.rs[li] / 255) * boost, cg = (E.gs[li] / 255) * boost, cb = (E.bs[li] / 255) * boost;
        for (let k = 0; k < per; k++) { const o = (r * per + k) * 3; z.colors[o] = cr0; z.colors[o + 1] = cg; z.colors[o + 2] = cb; }
      }
      z.geo.attributes.color.needsUpdate = true;
    }
    for (const s of spill) {
      let r0 = 0, g0 = 0, b0 = 0;
      for (const i of s.idx) { r0 += E.rs[i]; g0 += E.gs[i]; b0 += E.bs[i]; }
      const n = s.idx.length * 255;
      r0 /= n; g0 /= n; b0 /= n;
      const lum = Math.max(r0, g0, b0);
      tmpC.setRGB(r0 / (lum || 1), g0 / (lum || 1), b0 / (lum || 1));
      s.light.color.copy(tmpC);
      s.light.intensity = lum * s.k * 0.9;
    }
    const p = E.cur[1];
    screenLight.color.setRGB(p[0] / 255, p[1] / 255, p[2] / 255);
  }

  /* ---------------- scroll + render loop ---------------- */
  let visible = false, shown = 0, frameN = 0;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) resize(); }, { rootMargin: "200px 0px" }).observe(section);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function progress() {
    const r = section.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;
    if (!visible) return;
    const target = reduceMotion ? 0.58 : progress();
    shown += (target - shown) * (1 - Math.exp(-dt * 9));
    const P = pose(shown);
    camera.position.set(P.x, P.y, P.z);
    camera.rotation.set(THREE.MathUtils.degToRad(P.pitch), THREE.MathUtils.degToRad(P.yaw), 0);

    const hold = smooth(0.44, 0.5, shown) * (1 - smooth(0.72, 0.77, shown));
    section.style.setProperty("--hold", hold.toFixed(3));
    section.classList.toggle("holding", hold > 0.02);
    capA.style.opacity = smooth(0.0, 0.03, shown) * (1 - smooth(0.1, 0.14, shown));
    capB.style.opacity = smooth(0.17, 0.21, shown) * (1 - smooth(0.3, 0.34, shown));

    updateLights();
    if ((frameN++ & 1) === 0) drawScreen(now);
    composer.render();
  }
  requestAnimationFrame(frame);
}
