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
  const capC = document.getElementById("carCapC");
  const capD = document.getElementById("carCapD");
  const capE = document.getElementById("carCapE");
  const capChunks = [...capC.querySelectorAll(".chunk")];
  const capSlot = capD.querySelector(".cd-slot"), capReel = capD.querySelector(".cd-reel");
  const capWords = [...capD.querySelectorAll(".cd-reel i")];
  let capW = -1;
  const capKitchen = capD.querySelector(".cd-kitchen");
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
  /* diamond quilting with stitch lines, as a colour map and a bump map */
  function quiltTexture(cells = 6) {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d"), step = 512 / cells;
    g.fillStyle = "#808080"; g.fillRect(0, 0, 512, 512);
    for (let i = -cells; i <= cells * 2; i++) {
      for (const dir of [1, -1]) {
        g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 7;
        g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step + dir * 512, 512); g.stroke();
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.setLineDash([7, 6]);
        g.beginPath(); g.moveTo(i * step + 6, 0); g.lineTo(i * step + 6 + dir * 512, 512); g.stroke();
        g.setLineDash([]);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const quiltBump = quiltTexture();
  const quiltCol = quiltTexture(); quiltCol.colorSpace = THREE.SRGBColorSpace;
  const quilted = (rx, ry) => {
    const b = quiltBump.clone(); b.needsUpdate = true; b.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ color: "#d8d0c2", roughness: 0.62, bumpMap: b, bumpScale: 2.2 });
  };
  const M = {
    leather: new THREE.MeshStandardMaterial({ color: "#1b1816", roughness: 0.72 }),
    cream: new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 0.6 }),
    insert: new THREE.MeshStandardMaterial({ color: "#2c2622", roughness: 0.82 }),
    grille: new THREE.MeshStandardMaterial({ color: "#6d6f73", roughness: 0.4, metalness: 0.85 }),
    trim: new THREE.MeshStandardMaterial({ color: "#131316", roughness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: "#8d8f94", roughness: 0.28, metalness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: "#2a1d16", roughness: 0.35, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: "#060608", roughness: 0.12, metalness: 0.4 }),
    carpet: new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 1 }),
    headliner: new THREE.MeshStandardMaterial({ color: "#3a3937", roughness: 0.95 }),
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
  box(1.72, 0.04, 2.0, M.headliner, 0, 1.37, 0.45, 0.02);
  box(1.66, 0.6, 0.05, M.trim, 0, 0.42, -1.02, 0.02);
  box(1.66, 0.75, 0.06, M.trim, 0, 0.95, 1.5, 0.03);

  /* dashboard: lower body, upper cowl, glass display, knee panel, wood band */
  box(1.62, 0.3, 0.46, M.trim, 0, 0.8, -0.8, 0.06);
  box(1.62, 0.07, 0.4, M.leather, 0, 0.975, -0.84, 0.03);
  box(1.6, 0.26, 0.22, M.trim, 0, 0.55, -0.66, 0.05);
  box(1.56, 0.035, 0.02, M.wood, 0, 0.86, -0.565, 0.008);
  /* slim vents */
  const ventM = new THREE.MeshStandardMaterial({ color: "#3a3b3f", roughness: 0.55, metalness: 0.6 });
  for (const vx of [-0.5, -0.18, 0.18, 0.5]) box(0.2, 0.026, 0.018, ventM, vx, 0.915, -0.566, 0.008);

  /* centre screen: a modest panel set into a housing that grows out of the cowl */
  /* stands just proud of the cowl's front edge, clear of the dash body, on a short foot into the cowl */
  box(0.12, 0.04, 0.06, M.trim, 0, 0.972, -0.648, 0.01);
  const glass = box(0.39, 0.165, 0.012, M.glass, 0, 1.052, -0.618, 0.006, deg(-14));
  const scr = document.createElement("canvas");
  scr.width = 1200; scr.height = 504;
  const sx = scr.getContext("2d");
  const scrTex = new THREE.CanvasTexture(scr);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.anisotropy = 4;
  /* kept below the bloom threshold so the display stays crisp */
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.375, 0.1575), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false, color: new THREE.Color(0.6, 0.6, 0.6) }));
  screen.position.set(0, 0, 0.0065);
  glass.add(screen);

  /* driver's cluster in its own hooded binnacle behind the wheel */
  /* gauge pod sitting on the steering column, seen through the top of the wheel */
  box(0.07, 0.07, 0.1, M.trim, S * 0.37, 0.905, -0.47, 0.02);
  box(0.27, 0.105, 0.06, M.trim, S * 0.37, 0.965, -0.5, 0.03, deg(-16));
  box(0.28, 0.018, 0.08, M.leather, S * 0.37, 1.022, -0.495, 0.008, deg(-16));
  const cglass = box(0.24, 0.09, 0.01, M.glass, S * 0.37, 0.965, -0.468, 0.005, deg(-16));
  const clu = document.createElement("canvas");
  clu.width = 1000; clu.height = 372;
  const cx = clu.getContext("2d");
  const cluTex = new THREE.CanvasTexture(clu);
  cluTex.colorSpace = THREE.SRGBColorSpace;
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.0863), new THREE.MeshBasicMaterial({ map: cluTex, toneMapped: false, color: new THREE.Color(0.6, 0.6, 0.6) }));
  cluster.position.set(0, 0, 0.0055);
  cglass.add(cluster);

  /* centre console + armrest + wood inlay */
  box(0.28, 0.42, 1.0, M.trim, 0, 0.36, -0.2, 0.05);
  box(0.3, 0.07, 0.46, M.leather, 0, 0.6, 0.16, 0.035);
  box(0.2, 0.012, 0.42, M.wood, 0, 0.575, -0.38, 0.005);
  box(0.06, 0.03, 0.06, M.metal, 0, 0.6, -0.5, 0.015);

  /* steering wheel on the driver side */
  const wheel = new THREE.Group();
  wheel.position.set(S * 0.37, 0.86, -0.27);
  wheel.rotation.x = deg(-24);
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
  column.position.set(S * 0.37, 0.8, -0.45);
  column.rotation.x = deg(62);
  column.scale.y = 1.25;
  car.add(column);

  /* seats */
  const seatQuilt = quilted(1.6, 1.6), backQuilt = quilted(1.6, 2.2);
  function seat(x, z, w = 0.54) {
    box(w, 0.15, 0.54, M.cream, x, 0.42, z, 0.07);
    box(w * 0.6, 0.025, 0.42, seatQuilt, x, 0.5, z - 0.02, 0.012);
    box(0.09, 0.08, 0.5, M.cream, x - w / 2 + 0.045, 0.52, z, 0.04);
    box(0.09, 0.08, 0.5, M.cream, x + w / 2 - 0.045, 0.52, z, 0.04);
    const back = box(w, 0.72, 0.16, M.cream, x, 0.83, z + 0.29, 0.075, deg(-12));
    box(w * 0.58, 0.52, 0.02, backQuilt, x, 0.82, z + 0.205, 0.01, deg(-12));
    box(0.1, 0.56, 0.2, M.cream, x - w / 2 + 0.05, 0.8, z + 0.26, 0.05, deg(-12));
    box(0.1, 0.56, 0.2, M.cream, x + w / 2 - 0.05, 0.8, z + 0.26, 0.05, deg(-12));
    box(0.3, 0.2, 0.12, M.cream, x, 1.25, z + 0.38, 0.06, deg(-8));
    box(0.24, 0.12, 0.05, M.leather, x, 1.24, z + 0.32, 0.025, deg(-8));
    return back;
  }
  seat(-0.37, 0.05);
  seat(0.37, 0.05);
  box(1.42, 0.15, 0.52, M.cream, 0, 0.42, 1.0, 0.06);
  box(1.42, 0.64, 0.16, M.cream, 0, 0.8, 1.3, 0.07, deg(-10));
  box(1.2, 0.46, 0.02, quilted(4, 1.8), 0, 0.8, 1.215, 0.01, deg(-10));

  /* doors (inner panel, armrest, outer skin) and the window frame */
  const doorZ0 = -0.92, doorZ1 = 1.4;
  for (const side of [-1, 1]) {
    box(0.08, 0.86, doorZ1 - doorZ0, M.trim, side * 0.82, 0.57, (doorZ0 + doorZ1) / 2, 0.03);
    box(0.11, 0.05, 0.95, M.cream, side * 0.765, 0.72, -0.02, 0.025);
    box(0.012, 0.26, 1.5, quilted(4, 0.8), side * 0.779, 0.98 - 0.13 - 0.07, 0.15, 0.004);
    box(0.06, 0.1, 0.7, M.trim, side * 0.775, 0.36, -0.12, 0.02);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 40), M.grille);
    sp.rotation.z = Math.PI / 2; sp.position.set(side * 0.776, 0.5, -0.62); car.add(sp);
    box(0.03, 0.025, 0.16, M.metal, side * 0.74, 0.755, -0.3, 0.008);
    box(0.03, 0.9, doorZ1 - doorZ0 + 0.2, M.paint, side * 0.9, 0.55, (doorZ0 + doorZ1) / 2, 0.012);
    box(0.06, 0.03, 2.5, M.paint, side * 0.86, 1.35, 0.3, 0.015);
    box(0.07, 0.4, 0.1, M.paint, side * 0.84, 1.16, 0.62, 0.02);
    const aP = box(0.07, 0.54, 0.08, M.paint, side * 0.83, 1.16, -0.68, 0.02, deg(-48));
    aP.position.z = -0.72;
    box(0.07, 0.4, 0.1, M.paint, side * 0.84, 1.16, 1.42, 0.02);
  }

  /* rear-view mirror and door mirrors */
  box(0.26, 0.07, 0.025, M.trim, 0, 1.26, -0.42, 0.02);
  box(0.02, 0.06, 0.02, M.trim, 0, 1.32, -0.4, 0.008);
  for (const side of [-1, 1]) box(0.08, 0.13, 0.2, M.paint, side * 1.0, 1.05, -0.78, 0.04, 0, side * 0.3);

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

  /* roof rails echo the door zones; door-pocket lines too */
  lightLine([[D * 0.7, 1.345, -0.3], [D * 0.71, 1.35, 0.5], [D * 0.7, 1.345, 1.2]], range(73, 107), 0.004);
  lightLine([[-D * 0.7, 1.345, -0.3], [-D * 0.71, 1.35, 0.5], [-D * 0.7, 1.345, 1.2]], range(163, 197), 0.004);
  lightLine([[D * 0.742, 0.415, -0.46], [D * 0.742, 0.415, 0.22]], range(73, 107), 0.0035);
  lightLine([[-D * 0.742, 0.415, -0.46], [-D * 0.742, 0.415, 0.22]], range(163, 197), 0.0035);

  /* the four zones again, as seams in the passenger-side dash face */
  /* each one runs the full width of the dash, following its contour: cowl seam, wood band, knee seam */
  [[0, 73, 0.948, -0.62], [73, 107, 0.877, -0.567], [107, 163, 0.842, -0.567], [163, 197, 0.68, -0.552]].forEach(([a, b, y, z]) => {
    lightLine([[-0.79, y, z - 0.05], [-0.45, y, z - 0.005], [0, y, z + 0.008], [0.45, y, z - 0.005], [0.79, y, z - 0.05]], range(a, b), 0.0019);
  });

  /* light spill onto the cabin: one point light per zone, plus footwells and the screen */
  const spill = [
    { light: new THREE.PointLight(0xffffff, 0, 2.2, 1.6), at: [0, 1.0, -0.15], idx: range(0, 73), k: 0.9 },
    { light: new THREE.PointLight(0xffffff, 0, 1.8, 1.6), at: [D * 0.62, 0.95, 0.15], idx: range(73, 107), k: 1.2 },
    { light: new THREE.PointLight(0xffffff, 0, 1.8, 1.6), at: [-D * 0.62, 0.95, 0.15], idx: range(163, 197), k: 1.2 },
    { light: new THREE.PointLight(0xffffff, 0, 1.4, 1.8), at: [0, 0.68, -0.1], idx: range(107, 163), k: 0.9 },
    { light: new THREE.PointLight(0xffffff, 0, 1.4, 1.5), at: [-0.4, 0.22, -0.55], idx: range(107, 163), k: 1.6 },
    { light: new THREE.PointLight(0xffffff, 0, 1.4, 1.5), at: [0.4, 0.22, -0.55], idx: range(107, 163), k: 1.6 },
    { light: new THREE.PointLight(0xffffff, 0, 0.9, 1.6), at: [-0.17, 0.62, 0.0], idx: range(107, 135), k: 1.0 },
    { light: new THREE.PointLight(0xffffff, 0, 0.9, 1.6), at: [0.17, 0.62, 0.0], idx: range(135, 163), k: 1.0 },
    { light: new THREE.PointLight(0xffffff, 0, 1.6, 1.5), at: [D * 0.0, 1.28, 0.4], idx: range(73, 107).concat(range(163, 197)), k: 0.7 }
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.3, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let baseFov = 76, holdFov = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w * (mobile ? 0.35 : 0.5), h * (mobile ? 0.35 : 0.5));
    camera.aspect = w / h;
    baseFov = w / h < 0.8 ? 96 : w / h < 1.2 ? 86 : 76;
    camera.fov = baseFov + 14 * holdFov;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------------- camera path ----------------
     yaw 0 looks forward (-z); negative turns toward +x. Keys mirror with S for left-hand drive. */
  const DETENT = [0.45, 0.72];
  const K = [
    [0.00, [1.45, 1.17, 0.06], -90, 1],
    [0.08, [1.05, 1.17, 0.06], -90, 0],
    [0.15, [0.70, 1.17, 0.06], -90, 0],
    [0.24, [0.38, 1.15, 0.08], -92, -2],
    [0.32, [0.16, 1.14, 0.06], -45, -6],
    [0.40, [0.01, 1.12, 0.2], -5, -5],
    [0.45, [0.0, 1.1, 0.26], 0, -3],
    [0.72, [0.0, 1.1, 0.26], 0, -3],
    [0.79, [-0.2, 1.13, 0.08], 45, -4],
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
    if (t >= DETENT[0] && t <= DETENT[1]) { const k = K[6]; return { x: k.p[0], y: k.p[1], z: k.p[2], yaw: k.yaw, pitch: k.pitch }; }
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
  const hits = [];
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const font = (w, px) => `${w} ${px}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  function drawScreen() {
    const R = bus();
    const W = scr.width, H = scr.height;
    hits.length = 0;
    const pal = R ? R.engine.cur : [[30, 20, 50], [255, 60, 170], [70, 200, 255]];
    const on = !!(R && R.on);
    sx.fillStyle = "#0c0c10"; sx.fillRect(0, 0, W, H);
    const cover = R && R.coverSrc;
    if (cover && cover !== coverCache.src) { coverCache.src = cover; coverCache.img = new Image(); coverCache.img.src = cover; }
    const art = coverCache.img && coverCache.img.complete && coverCache.img.naturalWidth ? coverCache.img : null;
    if (art) {
      sx.globalAlpha = 0.35; sx.filter = "blur(40px) saturate(1.4)";
      sx.drawImage(art, -100, -300, W + 200, W + 200);
      sx.filter = "none"; sx.globalAlpha = 1;
      sx.fillStyle = "rgba(6,6,9,.45)"; sx.fillRect(0, 0, W, H);
    }
    const cs = H - 80, cx0 = 40, cy0 = 40;
    sx.fillStyle = rgbCss(pal[1], 0.35);
    sx.beginPath(); sx.roundRect(cx0, cy0, cs, cs, 22); sx.fill();
    if (art) { sx.save(); sx.beginPath(); sx.roundRect(cx0, cy0, cs, cs, 22); sx.clip(); sx.drawImage(art, cx0, cy0, cs, cs); sx.restore(); }
    const tx = cx0 + cs + 44, tw = W - tx - 44;
    sx.fillStyle = "#fff"; sx.font = font(700, 50);
    sx.fillText(fit((R && R.title) || "Rave Mode", tw), tx, 112);
    sx.fillStyle = "rgba(255,255,255,.66)"; sx.font = font(500, 30);
    sx.fillText(fit((R && R.artist) || "Tap play", tw), tx, 158);
    const [cur, dur] = R && R.time ? R.time() : [0, 0];
    const prog = dur ? cur / dur : 0;
    sx.fillStyle = "rgba(255,255,255,.18)"; sx.beginPath(); sx.roundRect(tx, 204, tw, 7, 3.5); sx.fill();
    sx.fillStyle = "#fff"; sx.beginPath(); sx.roundRect(tx, 204, Math.max(7, tw * prog), 7, 3.5); sx.fill();
    sx.fillStyle = "rgba(255,255,255,.5)"; sx.font = font(500, 22);
    sx.fillText(mmss(cur), tx, 244);
    sx.textAlign = "right"; sx.fillText(dur ? mmss(dur) : "--:--", tx + tw, 244); sx.textAlign = "left";
    /* previous · play/pause · next */
    const by = 370, mid = tx + tw / 2;
    sx.fillStyle = "#fff";
    const tri = (x, dir, h) => { sx.beginPath(); sx.moveTo(x, by - h); sx.lineTo(x + dir * h * 1.3, by); sx.lineTo(x, by + h); sx.closePath(); sx.fill(); };
    const px0 = mid - 180;
    sx.fillRect(px0 - 4, by - 24, 8, 48); tri(px0 + 42, -1, 24);
    hits.push({ x: px0 - 40, y: by - 60, w: 120, h: 120, act: () => R.prev() });
    sx.beginPath(); sx.arc(mid, by, 56, 0, Math.PI * 2); sx.fillStyle = "rgba(255,255,255,.95)"; sx.fill();
    sx.fillStyle = "#0c0c10";
    if (on) { sx.fillRect(mid - 19, by - 24, 13, 48); sx.fillRect(mid + 6, by - 24, 13, 48); }
    else { sx.beginPath(); sx.moveTo(mid - 15, by - 26); sx.lineTo(mid + 27, by); sx.lineTo(mid - 15, by + 26); sx.closePath(); sx.fill(); }
    hits.push({ x: mid - 66, y: by - 66, w: 132, h: 132, act: () => R.toggle() });
    sx.fillStyle = "#fff";
    const nx0 = mid + 140;
    tri(nx0, 1, 24); sx.fillRect(nx0 + 33, by - 24, 8, 48);
    hits.push({ x: nx0 - 30, y: by - 60, w: 120, h: 120, act: () => R.next() });
    scrTex.needsUpdate = true;
  }

  /* the cluster: a normal pair of dials, sized for the binnacle */
  function drawCluster() {
    const W = clu.width, H = clu.height;
    cx.fillStyle = "#050507"; cx.fillRect(0, 0, W, H);
    const dial = (x, y, r, value, unit, ticks) => {
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      cx.lineCap = "round"; cx.strokeStyle = "rgba(255,255,255,.16)"; cx.lineWidth = 7;
      cx.beginPath(); cx.arc(x, y, r, a0, a1); cx.stroke();
      cx.fillStyle = "rgba(255,255,255,.5)"; cx.font = font(500, 17); cx.textAlign = "center";
      ticks.forEach((t, i) => { const a = a0 + (a1 - a0) * (i / (ticks.length - 1)); cx.fillText(t, x + Math.cos(a) * (r - 28), y + Math.sin(a) * (r - 28) + 6); });
      const an = a0 + 0.04;
      cx.strokeStyle = "#ff5a2a"; cx.lineWidth = 5; cx.lineCap = "round";
      cx.beginPath(); cx.moveTo(x + Math.cos(an) * 36, y + Math.sin(an) * 36); cx.lineTo(x + Math.cos(an) * (r - 12), y + Math.sin(an) * (r - 12)); cx.stroke();
      cx.fillStyle = "#fff"; cx.font = font(300, 64); cx.fillText(value, x, y + 18);
      cx.fillStyle = "rgba(255,255,255,.5)"; cx.font = font(600, 17); cx.fillText(unit, x, y + 46);
      cx.textAlign = "left"; cx.lineCap = "butt";
    };
    dial(250, 178, 140, "0", "km/h", ["0", "60", "120", "180", "240"]);
    dial(750, 178, 140, "P", "READY", ["0", "", "50", "", "100"]);
    const d = new Date();
    cx.fillStyle = "rgba(255,255,255,.7)"; cx.font = font(600, 22); cx.textAlign = "center";
    cx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, 500, 60);
    cx.fillStyle = "rgba(255,255,255,.45)"; cx.font = font(500, 18);
    cx.fillText("22°C  ·  412 km", 500, 352);
    cx.textAlign = "left";
    cluTex.needsUpdate = true;
  }

  /* clicks on the display → the same controls as the hidden HTML player */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitAt(ev) {
    if (holdNow < 0.5) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const it = ray.intersectObject(screen)[0];
    if (!it || !it.uv) return null;
    const u = RHD ? it.uv.x : 1 - it.uv.x;
    const x = u * scr.width, y = (1 - it.uv.y) * scr.height;
    return hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) || null;
  }
  canvas.addEventListener("click", (ev) => {
    const h = hitAt(ev);
    if (h) { h.act(); setTimeout(drawScreen, 60); } else if (bus() && bus().wake) bus().wake();
  });
  canvas.addEventListener("pointermove", (ev) => { canvas.style.cursor = hitAt(ev) ? "pointer" : ""; });

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
    const boost = 1.35; /* LED values are 0-255 PWM; lines are emissive and bloom above 1.0 */
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

  let last = 0, holdNow = 0;
  const PAPER = new THREE.Color("#ebe8de"), NIGHT = new THREE.Color("#060608");
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;
    if (!visible) return;
    const target = reduceMotion ? 0.58 : progress();
    shown += (target - shown) * (1 - Math.exp(-dt * 9));
    window.__carShown = shown;
    const P = pose(shown);
    camera.position.set(P.x, P.y, P.z);
    camera.rotation.set(THREE.MathUtils.degToRad(P.pitch), THREE.MathUtils.degToRad(P.yaw), 0);

    /* the cabin's sky follows the page colour, so nothing reads as an edge on the way in or out */
    const dk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dk")) || 0;
    scene.background.copy(PAPER).lerp(NIGHT, dk);
    scene.fog.color.copy(scene.background);
    const hold = smooth(0.49, 0.52, shown) * (1 - smooth(0.72, 0.76, shown));
    holdNow = hold;
    section.style.setProperty("--hold", hold.toFixed(3));
    section.classList.toggle("holding", hold > 0.02);
    /* desk → car → what it is → where it belongs → presenting, then the car takes the stage */
    const win = (a, b, c, d) => smooth(a, b, shown) * (1 - smooth(c, d, shown));
    capA.style.opacity = win(0.0, 0.012, 0.035, 0.045);
    capB.style.opacity = win(0.045, 0.057, 0.08, 0.09);
    capC.style.opacity = win(0.09, 0.1, 0.15, 0.16);
    capChunks[0].classList.toggle("on", shown > 0.093);
    capChunks[1].classList.toggle("on", shown > 0.118);
    capD.style.opacity = win(0.16, 0.17, 0.355, 0.37);
    const w = shown < 0.205 ? 0 : shown < 0.245 ? 1 : 2;
    if (w !== capW) { capW = w; capReel.style.transform = `translateY(${-w * 1.12}em)`; capSlot.style.width = capWords[w].offsetWidth + "px"; }
    capD.classList.toggle("wild", shown > 0.29);
    capKitchen.classList.toggle("on", shown > 0.318);
    capE.style.opacity = win(0.375, 0.39, 0.47, 0.5);
    const hf = smooth(0.38, 0.45, shown) * (1 - smooth(0.72, 0.8, shown));
    if (Math.abs(hf - holdFov) > 0.002) { holdFov = hf; camera.fov = baseFov + 14 * hf; camera.updateProjectionMatrix(); }

    updateLights();
    if ((frameN++ & 1) === 0) drawScreen();
    if (frameN % 30 === 1) drawCluster();
    composer.render();
  }
  requestAnimationFrame(frame);
}
