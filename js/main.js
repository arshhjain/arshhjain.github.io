(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ================= content lists ================= */

  /* Shuffled in the Rave Mode section. cover is optional: its palette drives the LEDs. */
  const PLAYLIST = [
    { src: "assets/audio/seven-nation-army.mp3", title: "Seven Nation Army", artist: "The White Stripes", cover: "assets/audio/seven-nation-army.jpg" },
    { src: "assets/audio/father-stretch-my-hands.mp3", title: "Father Stretch My Hands Pt. 1", artist: "Kanye West", cover: "assets/audio/father-stretch-my-hands.jpg" },
    { src: "assets/audio/flower-in-a-hurricane.mp3", title: "Flower In A Hurricane", artist: "Justice ft. Tame Impala, SZA, King Gizzard & the Lizard Wizard", cover: "assets/audio/flower-in-a-hurricane.jpg" },
    { src: "assets/audio/stolen-dance.mp3", title: "Stolen Dance", artist: "Milky Chance", cover: "assets/audio/stolen-dance.jpg" },
    { src: "assets/audio/willow.mp3", title: "willow", artist: "Taylor Swift", cover: "assets/audio/willow.jpg" }
  ];

  /* Fusion 360 turntable / exploded clips (shown only if the file exists) */
  const CAD_CLIPS = [
    { file: "assets/media/fusion-cmf-speaker.mp4", title: "CMF Speaker M, turntable" }
  ];

  const DAY_SERIES = [
    ["02", "Glass bottle"], ["03", "Paper clip"], ["04", "Faceted bottle"], ["05", "Ice tray"],
    ["06", "Hex nut"], ["07", "Torch"], ["08", "Door wedge"], ["09", "Light bulb"],
    ["10", "Phone case"], ["11", "Pet bowl"], ["15", "Triangle lattice"], ["20", "Hinged box"]
  ];

  const SKY = ["assets/media/sky-01.jpg", "assets/media/sky-02.jpg", "assets/media/sky-03.jpg"];

  /* ================= media ================= */
  function wireMedia(fig) {
    const el = fig.querySelector("video, img");
    if (!el) return;
    const ok = () => fig.classList.add("has-media");
    if (el.tagName === "VIDEO") {
      el.addEventListener("loadeddata", ok, { once: true });
      if (el.readyState >= 2) ok();
    } else if (el.complete && el.naturalWidth) ok();
    else el.addEventListener("load", ok, { once: true });
  }

  const cadGrid = document.getElementById("cadGrid");
  CAD_CLIPS.forEach((item, i) => {
    const fig = document.createElement("figure");
    fig.className = "cad-item";
    fig.hidden = true;
    const box = document.createElement("div");
    box.className = "media";
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.src = item.file;
    box.appendChild(v);
    const cap = document.createElement("figcaption");
    const b = document.createElement("b");
    b.textContent = `007.${String(i + 3).padStart(2, "0")}`;
    const t = document.createElement("span");
    t.textContent = item.title;
    cap.append(b, t);
    fig.append(box, cap);
    v.addEventListener("loadeddata", () => { fig.hidden = false; box.classList.add("has-media"); }, { once: true });
    cadGrid.appendChild(fig);
  });

  const register = document.getElementById("register");
  register.innerHTML = DAY_SERIES.map(([d, name]) =>
    `<figure class="reg-item"><img loading="lazy" alt="" src="assets/media/day-${d}.jpg"><figcaption><b>DAY ${d}</b>${name}</figcaption></figure>`
  ).join("") + `<figure class="reg-item"><img loading="lazy" alt="" src="assets/media/kammo-lamp.jpg"><figcaption><b>+</b>Kammo lamp</figcaption></figure>`;

  const skyStrip = document.getElementById("skyStrip");
  SKY.forEach((src) => {
    const img = new Image();
    img.alt = "Night sky, shot on iPhone";
    img.loading = "lazy";
    img.addEventListener("load", () => skyStrip.appendChild(img), { once: true });
    img.src = src;
  });

  document.querySelectorAll("[data-media]").forEach(wireMedia);

  const vidObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); });
  }, { threshold: 0.25 });
  document.querySelectorAll("video").forEach((v) => vidObs.observe(v));

  /* ================= reveal ================= */
  document.querySelectorAll(".t-row:not(.t-head)").forEach((r, i) => r.style.setProperty("--d", i));
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      revealObs.unobserve(e.target);
      if (e.target.id === "lecturelens") runTerminal();
    });
  }, { threshold: 0.18 });
  document.querySelectorAll("[data-reveal]").forEach((el) => revealObs.observe(el));

  /* ================= LectureLens trace ================= */
  const TRACE = [
    ["$ ", "POST /upload  syllabus_full.pdf", ""],
    ["  ", "extract → EasyOCR … 10 chapters", "dim"],
    ["  ", "sha256  9c1e…a07b  MISS", "miss"],
    ["  ", "cosine vs cache  < 0.94  MISS", "miss"],
    ["  ", "gemini-1.5-flash → topics.json", "ok"],
    ["  ", "cache.put(hash, vector, topics)", "dim"],
    ["", "", ""],
    ["$ ", "POST /upload  syllabus_full (re-export).pdf", ""],
    ["  ", "sha256  4d22…f19c  MISS", "miss"],
    ["  ", "cosine vs cache  0.98 ≥ 0.94  HIT", "hit"],
    ["  ", "0 LLM calls · served from cache", "ok"],
    ["", "", ""],
    ["$ ", "POST /upload  chapters_1-5.pdf", ""],
    ["  ", "subset of a cached doc → the hard one", "hit"]
  ];
  let termStarted = false;
  function runTerminal() {
    if (termStarted) return;
    termStarted = true;
    const pre = document.getElementById("term");
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const render = (lines, partial) => {
      pre.innerHTML = lines.map(([p, t, c]) => `<span class="dim">${esc(p)}</span>${c ? `<span class="${c}">${esc(t)}</span>` : esc(t)}`).join("\n")
        + (partial !== undefined ? "\n" + partial : "") + '<span class="caret"></span>';
    };
    if (reduceMotion) { render(TRACE); return; }
    const done = [];
    let li = 0, ci = 0;
    const tick = () => {
      if (li >= TRACE.length) { render(done); return; }
      const [p, t] = TRACE[li];
      if (p === "$ ") {
        ci++;
        render(done, `<span class="dim">$ </span>${esc(t.slice(0, ci))}`);
        if (ci >= t.length) { done.push(TRACE[li]); li++; ci = 0; setTimeout(tick, 260); }
        else setTimeout(tick, 22);
      } else {
        done.push(TRACE[li]); li++;
        render(done);
        setTimeout(tick, t ? 300 : 120);
      }
    };
    tick();
  }

  /* ================= pinned scenes ================= */
  const pins = [...document.querySelectorAll(".pin")];
  const originSection = document.getElementById("origin");
  const originTrack = document.getElementById("originTrack");
  const rave = document.getElementById("rave");

  function measureTravel() {
    originSection.style.setProperty("--travel", Math.max(0, originTrack.scrollWidth - window.innerWidth) + "px");
  }
  measureTravel();
  window.addEventListener("resize", measureTravel);
  if (document.fonts) document.fonts.ready.then(measureTravel);

  let lastDk = -1;
  function updatePins() {
    const vh = window.innerHeight;
    for (const s of pins) {
      const r = s.getBoundingClientRect();
      const span = r.height - vh;
      s.style.setProperty("--p", (span > 0 ? clamp(-r.top / span, 0, 1) : 0).toFixed(4));
    }
    const rr = rave.getBoundingClientRect();
    /* --dk: paper → night as Rave Mode arrives, night → paper as it leaves */
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const dk = Math.min(sm(vh * 1.15, vh * 0.2, rr.top), sm(-vh * 0.05, vh * 0.8, rr.bottom));
    if (Math.abs(dk - lastDk) > 0.002 || (dk === 0) !== (lastDk === 0) || (dk === 1) !== (lastDk === 1)) {
      document.documentElement.style.setProperty("--dk", dk.toFixed(3));
      lastDk = dk;
    }
  }

  /* ================= Rave Mode engine (browser port of main.py) =================
     The desktop engine runs one step per 256-sample chunk (~187 Hz); this runs once per
     animation frame, so every per-step coefficient is rescaled by STEPS. */
  const CFG = {
    n: 197,
    segments: [[0, 73], [73, 107], [107, 163], [163, 197]],
    sensitivity: 0.485, bassIntensity: 0.199, trebleIntensity: 0.835, trebleSens: 1.607,
    responsiveness: 0.035, noiseGate: 0.008, bassWidth: 117.1, trebleWidth: 98.5, trebleZone: 12,
    attackGamma: 1.38, decayGamma: 0.8, brightness: 0.06, saturation: 1, temporalSmoothing: 0.15
  };
  const STEPS = 187.5 / 60;
  const per = (a) => 1 - Math.pow(1 - clamp(a, 0, 1), STEPS);
  /* WebAudio reports Blackman-windowed magnitudes divided by N; main.py uses raw numpy rfft magnitudes
     (Hann-windowed 1024-sample buffer for bass, an unwindowed 256-sample chunk for treble).
     These factors put both back on main.py's scale so its tuning constants keep their meaning. */
  const BASS_N = 1024, TREB_N = 256;
  const KB = (BASS_N / 4) / 0.21, KT = (TREB_N / 2) / 0.21;

  function rgb2hsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb([h, s, v]) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
    return [r * 255, g * 255, b * 255];
  }
  function boostSaturation(rgb, factor) {
    let [h, s, v] = rgb2hsv(rgb);
    if (s < 0.02) return rgb.slice();
    s = factor <= 1 ? s * Math.max(0, factor) : Math.min(1, s + s * (1 - s) * (factor - 1) * 0.85);
    return hsv2rgb([h, s, v]);
  }
  function stableBackground(c1, brightness) {
    if (brightness <= 0.005) return [0, 0, 0];
    const bn = clamp((brightness - 0.005) / 0.995, 0, 1);
    const target = 4.5 + (38 - 4.5) * Math.pow(bn, 1.15);
    const mx = Math.max(c1[0], c1[1], c1[2], 1);
    return c1.map((c) => { const rel = c / mx; return rel > 0.03 ? Math.sqrt(Math.max(1.8, target * rel) * 255) : 0; });
  }
  const softLimit = (a, m = 0.95) => (a <= 0 ? 0 : m * Math.tanh(a / m));

  class AutoGain {
    constructor() { this.hist = []; this.max = Math.round(150); this.current = 1; this.changeT = 0; }
    onTrackChange() { this.hist.length = 0; this.current = 0.85; this.changeT = performance.now(); }
    update(vol) {
      this.hist.push(vol);
      if (this.hist.length > this.max) this.hist.shift();
      const sorted = this.hist.slice().sort((a, b) => a - b);
      const peak = sorted[Math.min(sorted.length - 1, Math.floor(0.92 * (sorted.length - 1)))];
      let target;
      if (peak < 0.015) target = 1;
      else if (peak < 0.06) {
        const p = (peak - 0.015) / 0.045, knee = 0.12 / 0.061;
        target = 1 + (knee - 1) * (p * p * (3 - 2 * p));
      } else target = clamp(0.12 / (peak + 0.001), 0.2, 3.5);
      target = Math.min(5, target * 1.2);
      this.current += (target - this.current) * per(target < this.current ? 0.12 : 0.015);
      let out = this.current;
      if (this.changeT) {
        const el = (performance.now() - this.changeT) / 1000;
        if (el < 4) {
          const p = clamp(el / 4, 0, 1), sm = p * p * (3 - 2 * p);
          out = Math.min(out, 0.95 + 1.5 * sm) * (0.65 + 0.35 * sm);
        } else this.changeT = 0;
      }
      return out;
    }
  }

  const FALLBACK_PALETTE = [[34, 18, 52], [255, 64, 170], [70, 200, 255]];
  const engine = {
    agc: new AutoGain(),
    bv: 0, tv: 0, rawTs: 0,
    tFloor: 0, tBinsFloor: null, prevT: null, bassEnv: null,
    arcAvgB: 0, arcPeakB: 0, arcMultB: 1,
    cur: FALLBACK_PALETTE.map((c) => c.slice()),
    target: FALLBACK_PALETTE.map((c) => c.slice()),
    r: new Float32Array(CFG.n), g: new Float32Array(CFG.n), b: new Float32Array(CFG.n),
    rs: new Float32Array(CFG.n), gs: new Float32Array(CFG.n), bs: new Float32Array(CFG.n),
    liveBass: 0, liveTreble: 0
  };

  let bbuf = null, fbufT = null, tbuf = null, bIdx = [], tIdx = [], bW = null, tW = null;
  function prepareBins(sampleRate) {
    const bHz = sampleRate / BASS_N, tHz = sampleRate / TREB_N;
    bbuf = new Float32Array(BASS_N / 2); fbufT = new Float32Array(TREB_N / 2); tbuf = new Float32Array(TREB_N);
    bIdx = []; tIdx = [];
    for (let k = 1; k < BASS_N / 2; k++) if (k * bHz < 250) bIdx.push(k);
    for (let k = 1; k < TREB_N / 2; k++) if (k * tHz > 2200) tIdx.push(k);
    bW = Float32Array.from(bIdx, (k) => 0.5 + Math.exp(-((k * bHz - 50) ** 2) / (2 * 60 ** 2)));
    tW = Float32Array.from(tIdx, (k) => 0.8 + 0.6 * clamp((k * tHz - 2200) / 8000, 0, 1));
    engine.tBinsFloor = new Float32Array(tIdx.length);
    engine.prevT = new Float32Array(tIdx.length);
    engine.bassEnv = new Float32Array(bIdx.length);
  }

  function engineStep(an) {
    const E = engine;
    let rawB = 0, rawT = 0;
    if (an) {
      an.treb.getFloatTimeDomainData(tbuf);
      let sq = 0;
      for (let i = 0; i < tbuf.length; i++) sq += tbuf[i] * tbuf[i];
      const gated = Math.sqrt(sq / tbuf.length) < CFG.noiseGate;
      an.treb.getFloatFrequencyData(fbufT);
      an.bass.getFloatFrequencyData(bbuf);
      if (!gated) {
        /* treble: spectral flux floor tracking + crest-factor transient gate */
        let bandE = 0;
        const tm = new Float32Array(tIdx.length);
        for (let j = 0; j < tIdx.length; j++) { tm[j] = Math.pow(10, fbufT[tIdx[j]] / 20) * KT; bandE += tm[j]; }
        if (E.tFloor === 0) { E.tFloor = bandE; E.tBinsFloor.set(tm); E.prevT.set(tm); }
        E.prevT.set(tm);
        E.tFloor = bandE > E.tFloor ? E.tFloor + (bandE - E.tFloor) * per(0.08) : E.tFloor + (bandE - E.tFloor) * per(0.15);
        let ex = 0;
        for (let j = 0; j < tm.length; j++) {
          const fl = E.tBinsFloor[j];
          E.tBinsFloor[j] = tm[j] > fl ? fl + (tm[j] - fl) * per(0.08) : fl + (tm[j] - fl) * per(0.15);
          ex += Math.max(0, tm[j] - E.tBinsFloor[j]) * tW[j];
        }
        const crest = E.tFloor > 1e-4 ? bandE / (E.tFloor + 1e-4) : 1;
        let gate = 0;
        if (crest >= 1.35) gate = 1;
        else if (crest > 1.15) { const p = (crest - 1.15) / 0.2; gate = p * p * (3 - 2 * p); }
        rawT = (ex / Math.max(1, tm.length)) * 3.2 * gate;

        /* bass: transient energy above a moving average envelope */
        let tb = 0;
        for (let j = 0; j < bIdx.length; j++) {
          const m = Math.pow(10, bbuf[bIdx[j]] / 20) * KB;
          E.bassEnv[j] += (m - E.bassEnv[j]) * per(0.08);
          tb += Math.max(0, m - E.bassEnv[j]) * bW[j];
        }
        rawB = (tb / Math.max(1, bIdx.length)) * 2.5;
      } else E.tFloor = 0;
    }

    if (rawT > E.rawTs) E.rawTs += (rawT - E.rawTs) * per(0.6);
    else { E.rawTs += (rawT - E.rawTs) * per(0.2); if (E.rawTs < 0.005) E.rawTs = 0; }
    rawT = E.rawTs;

    const gain = E.agc.update(rawB * 1.2 + rawT);
    const r = CFG.responsiveness;
    const bat = 0.10 + r * 0.75, bde = 0.95 - r * 0.45, tat = 0.15 + r * 0.55, tde = 0.94 - r * 0.30;

    const arcA = per(0.005 + r * 0.045);
    E.arcAvgB += (E.bv - E.arcAvgB) * arcA;
    E.arcPeakB = E.bv > E.arcPeakB ? E.bv : E.arcPeakB * (1 - arcA * 0.2);
    const par = E.arcPeakB / (E.arcAvgB + 1e-4);
    let tm = 1;
    if (E.arcAvgB > 0.02 && E.arcPeakB > 0.03 && par < 1.4) tm = Math.min(3.5, 1 + (1.4 - par) * 4 * 1.5);
    E.arcMultB += (tm - E.arcMultB) * per(0.05);

    const ngB = clamp(rawB * 6, 0.15, 1), ngT = clamp(rawT * 6, 0.15, 1);
    if (rawB > E.bv) E.bv += (rawB - E.bv) * per(bat * (0.35 + 0.65 * Math.min(1, E.bv / (rawB + 1e-4))) * ngB);
    else {
      const dm = Math.min(1, Math.pow(E.bv + 1e-4, CFG.decayGamma - 1));
      E.bv = Math.max(0, E.bv - (E.bv - rawB) * per(Math.min(1, (1 - bde) * (0.65 + 0.35 * dm) * ngB * E.arcMultB)));
    }
    if (rawT > E.tv) E.tv += (rawT - E.tv) * per(tat * (0.3 + 0.7 * Math.min(1, E.tv / (rawT + 1e-4))) * ngT);
    else {
      const dm = Math.min(1, Math.pow(E.tv + 1e-4, CFG.decayGamma - 1));
      E.tv = Math.max(0, E.tv - (E.tv - rawT) * per((1 - tde) * (0.7 + 0.3 * dm)));
    }

    const bRaw = E.bv * CFG.bassIntensity * CFG.sensitivity * gain;
    const tRaw = E.tv * CFG.trebleIntensity * CFG.sensitivity * CFG.trebleSens * gain;
    const bSh = bRaw <= 0.008 ? 0 : Math.pow((bRaw - 0.008) / 0.992, CFG.attackGamma);
    const tSh = tRaw <= 0.014 ? 0 : Math.pow((tRaw - 0.014) / 0.986, CFG.attackGamma * 1.05);
    const bAmp = softLimit(bSh), tAmp = softLimit(tSh);
    E.liveBass = Math.min(1, bAmp * 1.5);
    E.liveTreble = Math.min(1, tAmp * 1.5);
    const bw = Math.max(2, bAmp * CFG.bassWidth * Math.pow(gain, 0.3));
    const tw = Math.max(2, 3 + tAmp * CFG.trebleWidth * Math.pow(gain, 0.3) * 0.5);

    for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) E.cur[i][c] += (E.target[i][c] - E.cur[i][c]) * per(0.05);
    const sat = CFG.saturation * 1.5;
    const c2 = boostSaturation(E.cur[1], sat), c3 = boostSaturation(E.cur[2], sat);
    const bg = stableBackground(boostSaturation(E.cur[0], sat), CFG.brightness);

    for (const [st, en] of CFG.segments) {
      const L = en - st, mid = L / 2, tz = Math.min(CFG.trebleZone, Math.max(1, L / 2 - 1));
      for (let x = 0; x < L; x++) {
        const bsh = bAmp * Math.exp(-((x - mid) ** 2) / (2 * bw * bw));
        const tsh = tAmp * (Math.exp(-((x - tz) ** 2) / (2 * tw * tw)) + Math.exp(-((x - (L - tz)) ** 2) / (2 * tw * tw)));
        const f = 1 - clamp(bsh + tsh, 0, 1) * 0.9, k = st + x;
        E.r[k] = bg[0] * f + bsh * c2[0] + tsh * c3[0];
        E.g[k] = bg[1] * f + bsh * c2[1] + tsh * c3[1];
        E.b[k] = bg[2] * f + bsh * c2[2] + tsh * c3[2];
      }
    }
    const a = per(0.15);
    for (let k = 0; k < CFG.n; k++) {
      E.rs[k] += (E.r[k] - E.rs[k]) * a;
      E.gs[k] += (E.g[k] - E.gs[k]) * a;
      E.bs[k] += (E.b[k] - E.bs[k]) * a;
    }
    return { c2, c3, bg };
  }

  /* palette from album art: port of extract_color_candidates() + resolve_palette() in main.py */
  function extractCandidates(img) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 48;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0, 48, 48);
    const d = cx.getImageData(0, 0, 48, 48).data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    /* 12-colour quantise (k-means stands in for Pillow's FASTOCTREE) */
    const K = 12;
    let cents = Array.from({ length: K }, (_, i) => px[Math.floor(((i + 0.5) / K) * px.length)].slice());
    let counts = new Array(K).fill(0);
    for (let it = 0; it < 8; it++) {
      const sums = cents.map(() => [0, 0, 0]); counts = new Array(K).fill(0);
      for (const p of px) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < K; i++) { const c = cents[i], dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } }
        sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2] += p[2]; counts[bi]++;
      }
      cents = cents.map((c, i) => (counts[i] ? sums[i].map((v) => v / counts[i]) : c));
    }
    const out = [];
    cents.forEach((c, i) => {
      if (!counts[i]) return;
      const hsv = rgb2hsv(c);
      if (hsv[2] < 0.10) return;
      out.push({ rgb: c, hsv, score: hsv[1] * 0.6 + hsv[2] * 0.3 + (counts[i] / 2304) * 2.5 });
    });
    return out.sort((a, b) => b.score - a.score);
  }
  const CONES = [0.15, 0.25, 0.35, 0.50];
  const CONE_NAMES = ["Cozy", "Lounge", "Accurate", "Rave"];
  const cleanSub = (c) => { const m = Math.max(...c); return m ? c.map((v) => (v / m > 0.06 ? v : 0)) : [0, 0, 0]; };
  function resolvePalette(cands, cone) {
    if (!cands || !cands.length) return [[30, 30, 60], [255, 255, 255], [0, 150, 255]];
    const top = cands.slice(0, 6).map((c) => c.hsv[1]);
    const maxS = Math.max(...top), avgS = top.reduce((a, b) => a + b, 0) / top.length;
    if (maxS < 0.15 || (avgS < 0.08 && maxS < 0.25)) return [[28, 28, 34], [255, 255, 255], [180, 190, 205]];
    const maxH = CONES[cone];
    const bassH = cands[0].hsv;
    let trebH = null;
    for (const c of cands.slice(1)) {
      const hd = Math.min(Math.abs(bassH[0] - c.hsv[0]), 1 - Math.abs(bassH[0] - c.hsv[0]));
      if (hd >= 0.08 && hd <= maxH) { trebH = c.hsv; break; }
    }
    if (!trebH) trebH = [(bassH[0] + maxH / 2) % 1, bassH[1], bassH[2]];
    const bs = Math.max(0.4, bassH[1]);
    const treble = cleanSub(hsv2rgb([trebH[0], bs, 1]));
    const bass = cleanSub(hsv2rgb([bassH[0], bs, 1]));
    let mid = (bassH[0] + trebH[0]) / 2;
    if (Math.abs(bassH[0] - trebH[0]) > 0.5) mid = (mid + 0.5) % 1;
    return [hsv2rgb([mid, 0.35, 0.40]), bass, treble];
  }

  /* ================= the room: the strip lives on the screen edges that border Rave Mode =================
     Arriving from above, the section is exposed along the bottom of the screen, so light comes in from the
     bottom, left and right edges. Leaving, it borders the top, so the light moves to the top, left and right.
     While the section is pinned, the bottom glow crossfades to the top. Segment layout follows the strip:
     seg 0 (73) + seg 2 (56) run along the horizontal edge, seg 1 (34) up the right, seg 3 (34) down the left.
     Drawn at quarter resolution on a fixed canvas behind the page, blurred by CSS. */
  const canvas = document.getElementById("leds");
  const g = canvas.getContext("2d");
  const ROOM_SCALE = 0.25, BLEED = 60;
  let W = 0, H = 0;
  const posB = new Array(CFG.n), posT = new Array(CFG.n);
  function sizeRoom() {
    W = window.innerWidth + BLEED * 2; H = window.innerHeight + BLEED * 2;
    canvas.width = Math.max(1, Math.round(W * ROOM_SCALE)); canvas.height = Math.max(1, Math.round(H * ROOM_SCALE));
  }
  sizeRoom();
  window.addEventListener("resize", sizeRoom);

  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function layoutRoom(r, vh) {
    /* visible part of the section, in canvas coordinates (canvas origin is BLEED px above/left of the screen) */
    const top = Math.max(0, r.top) + BLEED, bot = Math.min(vh, r.bottom) + BLEED;
    const x0 = BLEED - 6, x1 = W - BLEED + 6;
    const horiz = [[0, 73], [107, 163]], hLen = 73 + 56;
    const place = (out, y) => {
      let k = 0;
      for (const [st, en] of horiz) for (let i = st; i < en; i++, k++) out[i] = [x0 + ((k + 0.5) / hLen) * (x1 - x0), y];
      for (let i = 73; i < 107; i++) { const t = (i - 73 + 0.5) / 34; out[i] = [x1, bot + (top - bot) * t]; }
      for (let i = 163; i < 197; i++) { const t = (i - 163 + 0.5) / 34; out[i] = [x0, top + (bot - top) * t]; }
    };
    place(posB, bot + 6);
    place(posT, top - 6);
  }

  function drawLeds(r, vh, p) {
    const E = engine, k = ROOM_SCALE;
    layoutRoom(r, vh);
    /* which horizontal edge is lit: bottom on the way in, top on the way out */
    const wTop = r.top > 0 ? 0 : r.bottom < vh ? 1 : smooth(0.45, 0.8, p);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const reach = Math.min(W, H) * 0.34;
    const blob = (x, y, r0, gg, b, w) => {
      const lum = (r0 + gg + b) / 765;
      if (lum * w < 0.003) return;
      const rad = reach * (0.45 + Math.sqrt(lum) * 0.75);
      const a0 = (0.03 + lum * 0.2) * w, a1 = (0.01 + lum * 0.07) * w;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r0 | 0},${gg | 0},${b | 0},${a0.toFixed(3)})`);
      grd.addColorStop(0.45, `rgba(${r0 | 0},${gg | 0},${b | 0},${a1.toFixed(3)})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    for (let i = 0; i < CFG.n; i += 2) {
      const r0 = clamp(E.rs[i] * 1.5, 0, 255), gg = clamp(E.gs[i] * 1.5, 0, 255), b = clamp(E.bs[i] * 1.5, 0, 255);
      const side = (i >= 73 && i < 107) || i >= 163;
      if (side) { blob(posB[i][0], posB[i][1], r0, gg, b, 1); continue; }
      if (wTop < 0.999) blob(posB[i][0], posB[i][1], r0, gg, b, 1 - wTop);
      if (wTop > 0.001) blob(posT[i][0], posT[i][1], r0, gg, b, wTop);
    }
  }

  /* the app's own fluid background: port of drawFluid() in ui/index.html */
  const fluidEl = document.getElementById("fluid");
  const fctx = fluidEl.getContext("2d");
  let fluidTime = 0, lastT = 0;
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
  function sizeFluid() { fluidEl.width = Math.max(1, Math.round(fluidEl.clientWidth / 2)); fluidEl.height = Math.max(1, Math.round(fluidEl.clientHeight / 2)); }
  sizeFluid();
  new ResizeObserver(sizeFluid).observe(fluidEl);
  function drawFluid(dt) {
    const FW = fluidEl.width, FH = fluidEl.height, bass = engine.liveBass, treble = engine.liveTreble;
    const pal = engine.cur.map((c) => boostSaturation(c, 1.4));
    fctx.globalCompositeOperation = "source-over";
    fctx.clearRect(0, 0, FW, FH);
    fluidTime += (0.125 + bass * 0.5) * dt;
    fctx.fillStyle = rgba(pal[0], Math.min(1, 0.45 + 0.15 * 1.2));
    fctx.fillRect(0, 0, FW, FH);
    fctx.globalCompositeOperation = "lighten";
    const m = Math.min(FW, FH);
    for (let i = 0; i < 4; i++) {
      const ph = (i * Math.PI) / 2;
      const x = FW * 0.5 + Math.sin(fluidTime * (0.8 + i * 0.1) + ph) * FW * 0.4;
      const y = FH * 0.5 + Math.cos(fluidTime * (0.6 + i * 0.1) - ph) * FH * 0.4;
      const rad = m * (0.18 + i * 0.03) * (1 + bass * 1.5);
      const gr = fctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(pal[1], 0.4)); gr.addColorStop(1, rgba(pal[1], 0));
      fctx.fillStyle = gr; fctx.beginPath(); fctx.arc(x, y, rad, 0, Math.PI * 2); fctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const ph = i * Math.PI * 0.4;
      const x = FW * 0.5 + Math.cos(fluidTime * (1.4 + i * 0.2) + ph) * FW * 0.45 + (Math.random() - 0.5) * treble * 75;
      const y = FH * 0.5 + Math.sin(fluidTime * (1.7 + i * 0.2) - ph) * FH * 0.45 + (Math.random() - 0.5) * treble * 75;
      const rad = m * (0.12 + i * 0.03) * (0.8 + treble * 2);
      const gr = fctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(pal[2], 0.5)); gr.addColorStop(1, rgba(pal[2], 0));
      fctx.fillStyle = gr; fctx.beginPath(); fctx.arc(x, y, rad, 0, Math.PI * 2); fctx.fill();
    }
    fctx.globalCompositeOperation = "source-over";
  }

  /* ================= playlist + spatial audio ================= */
  const soundBtn = document.getElementById("soundBtn");
  const soundLabel = soundBtn.querySelector(".sound-label");
  const soundBars = [...soundBtn.querySelectorAll(".sound-bars i")];
  const pPlay = document.getElementById("pPlay");
  const pNext = document.getElementById("pNext");
  const pTitle = document.getElementById("pTitle");
  const pArtist = document.getElementById("pArtist");
  const pCover = document.getElementById("pCover");
  let artA = document.getElementById("pCoverImg"), artB = document.getElementById("pCoverNext");
  const vibe = document.getElementById("vibe");
  const vibeName = document.getElementById("vibeName");
  let candidates = null;
  const mBass = document.getElementById("mBass");
  const mTreb = document.getElementById("mTreb");

  const audio = new Audio();
  audio.preload = "none";
  let ctx = null, gainNode = null, lpf = null, analyser = null;
  let soundOn = false, started = false;
  const bad = new Set();
  const order = PLAYLIST.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let pos_i = 0;

  function setPaletteVars(p) {
    const css = (c) => `rgb(${c.map((v) => Math.round(clamp(v, 0, 255))).join(",")})`;
    rave.style.setProperty("--c1", css(p[0]));
    rave.style.setProperty("--c2", css(p[1]));
    rave.style.setProperty("--c3", css(p[2]));
  }
  setPaletteVars(FALLBACK_PALETTE);

  /* album-art flip, like the app: old cover swings out, new one swings in */
  function flipCover(src) {
    artB.classList.remove("art-in");
    artB.classList.add("art-start");
    artB.onload = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        artA.classList.add("art-out"); artA.classList.remove("art-in");
        artB.classList.remove("art-start", "art-out"); artB.classList.add("art-in");
        [artA, artB] = [artB, artA];
      }));
    };
    artB.src = src;
    pCover.classList.add("has-art");
  }
  function applyVibe() {
    vibeName.textContent = CONE_NAMES[+vibe.value];
    if (candidates) { engine.target = resolvePalette(candidates, +vibe.value); setPaletteVars(engine.target); sendPalette(engine.target); }
  }
  vibe.addEventListener("input", applyVibe);

  function loadTrack(i) {
    const t = PLAYLIST[i];
    audio.src = t.src;
    pTitle.textContent = t.title;
    pArtist.textContent = t.artist;
    candidates = null;
    if (t.cover) {
      const img = new Image();
      img.onload = () => {
        coverSrc = t.cover;
        flipCover(t.cover);
        try { candidates = extractCandidates(img); applyVibe(); } catch (e) { candidates = null; }
      };
      img.src = t.cover;
    }
    engine.agc.onTrackChange();
    if (worklet) worklet.port.postMessage({ type: "trackChange" });
  }

  function nextTrack() {
    if (bad.size >= PLAYLIST.length) return;
    do { pos_i = (pos_i + 1) % order.length; } while (bad.has(order[pos_i]));
    loadTrack(order[pos_i]);
    if (soundOn) audio.play().catch(() => {});
  }

  function noTrack() {
    soundOn = false;
    soundBtn.disabled = true; pPlay.disabled = true; pNext.disabled = true;
    soundLabel.textContent = "NO TRACK";
    pPlay.checked = false;
    pTitle.textContent = "No track loaded";
    pArtist.textContent = "Audio files aren't in this build yet.";
    soundBtn.setAttribute("aria-pressed", "false");
  }

  audio.addEventListener("ended", nextTrack);
  let coverSrc = "";
  window.__rave = {
    engine, fluid: fluidEl,
    get title() { return started ? pTitle.textContent : ""; },
    get artist() { return started ? pArtist.textContent : ""; },
    get coverSrc() { return coverSrc; },
    get on() { return soundOn; },
    progress: () => (audio.duration ? audio.currentTime / audio.duration : 0)
  };
  audio.addEventListener("error", () => {
    if (!audio.src) return;
    bad.add(order[pos_i]);
    if (bad.size >= PLAYLIST.length) noTrack(); else nextTrack();
  });

  /* the engine runs on the audio thread (js/rave-worklet.js), chunk by chunk like main.py;
     browsers without AudioWorklet fall back to the per-frame analyser port above */
  let worklet = null;
  function sendPalette(p) { if (worklet) worklet.port.postMessage({ type: "palette", palette: p }); }
  async function buildGraph() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.Q.value = 0.7; lpf.frequency.value = 350;
    gainNode = ctx.createGain(); gainNode.gain.value = 0;
    /* the engine hears the raw signal; the visitor hears it through distance */
    src.connect(lpf).connect(gainNode).connect(ctx.destination);
    try {
      await ctx.audioWorklet.addModule("js/rave-worklet.js");
      worklet = new AudioWorkletNode(ctx, "rave-engine", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { cfg: { ...CFG, palette: engine.target } }
      });
      const sink = ctx.createGain(); sink.gain.value = 0;
      src.connect(worklet).connect(sink).connect(ctx.destination);
      worklet.port.onmessage = (e) => {
        const m = e.data;
        engine.rs.set(m.rs); engine.gs.set(m.gs); engine.bs.set(m.bs);
        engine.liveBass = m.bass; engine.liveTreble = m.treble;
        engine.cur = m.palette;
      };
    } catch (err) {
      worklet = null;
      const aB = ctx.createAnalyser(); aB.fftSize = BASS_N; aB.smoothingTimeConstant = 0;
      const aT = ctx.createAnalyser(); aT.fftSize = TREB_N; aT.smoothingTimeConstant = 0;
      analyser = { bass: aB, treb: aT };
      prepareBins(ctx.sampleRate);
      src.connect(aB);
      src.connect(aT);
    }
  }

  async function setSound(on) {
    if (soundBtn.disabled) return;
    if (on) {
      if (!ctx) await buildGraph();
      if (ctx.state === "suspended") await ctx.resume();
      if (!started) { started = true; loadTrack(order[pos_i]); }
      try { await audio.play(); } catch (err) { pPlay.checked = false; return; }
    } else audio.pause();
    soundOn = on;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundLabel.textContent = on ? "SOUND ON" : "SOUND OFF";
    pPlay.checked = on;
    pPlay.setAttribute("aria-label", on ? "Pause" : "Play");
    document.body.classList.toggle("sound-on", on);
  }
  let wantSound = true;
  soundBtn.addEventListener("click", () => {
    if (!started) { wantSound = !wantSound; if (wantSound) setSound(true); else reflectIntent(); return; }
    wantSound = !soundOn; setSound(!soundOn);
  });
  function reflectIntent() {
    soundBtn.setAttribute("aria-pressed", String(wantSound));
    soundLabel.textContent = wantSound ? "SOUND ON" : "SOUND OFF";
    pPlay.checked = wantSound;
  }
  reflectIntent();
  const tapHint = document.getElementById("tapHint");
  const firstGesture = (ev) => {
    if (soundBtn.contains(ev.target) || pPlay === ev.target || ev.target.id === "car") return;
    if (wantSound && !started) setSound(true);
  };
  for (const t of ["pointerdown", "keydown", "touchend"]) window.addEventListener(t, firstGesture, { capture: true, passive: true });
  /* hooks for the in-car display */
  window.__rave.toggle = () => { wantSound = !soundOn; setSound(!soundOn); };
  window.__rave.wake = () => { if (wantSound && !started) setSound(true); };
  Object.defineProperty(window.__rave, "want", { get: () => wantSound });
  pPlay.addEventListener("change", () => { wantSound = pPlay.checked; setSound(pPlay.checked); });
  pNext.addEventListener("click", () => { if (!started) setSound(true); else nextTrack(); });
  if (PLAYLIST.length < 2) pNext.title = "Add more tracks to the playlist to shuffle";

  /* x: how far into Rave Mode you are. 0 = the section edge is at the far edge of the screen,
     1 = the section fills it. Silence until the neighbouring sheet (F1 above, Ambilight below) is
     mostly behind you, then a fast low-pass sweep from "through the wall" to fully open. */
  function raveReach() {
    const r = rave.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top > 0) return (vh - r.top) / vh;
    if (r.bottom < vh) return r.bottom / vh;
    return 1;
  }
  const ease = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function updateSpatial() {
    const x = raveReach();
    const gain = ease(0.14, 0.5, x);
    const cutoff = 20000 * Math.pow(260 / 20000, 1 - ease(0.14, 0.42, x));
    if (ctx && soundOn) {
      gainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.08);
      lpf.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.06);
    }
  }

  /* ================= main loop ================= */
  let raveVisible = false;
  new IntersectionObserver((e) => { raveVisible = e[0].isIntersecting; }, { rootMargin: "40% 0px" }).observe(rave);

  function frame(now) {
    if (tapHint) tapHint.classList.toggle("on", raveVisible && wantSound && !soundOn && raveReach() > 0.3);
    canvas.style.opacity = !window.__carActive && lastDk > 0 ? lastDk.toFixed(3) : "0";
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016;
    lastT = now;
    updatePins();
    updateSpatial();
    if (raveVisible || soundOn) {
      if (!(soundOn && worklet)) engineStep(soundOn && analyser ? analyser : null);
      if (raveVisible) {
        const rr = rave.getBoundingClientRect();
        const span = rr.height - window.innerHeight;
        if (!window.__carActive) drawLeds(rr, window.innerHeight, span > 0 ? clamp(-rr.top / span, 0, 1) : 0);
        drawFluid(dt);
      }
      mBass.style.width = (engine.liveBass * 100).toFixed(1) + "%";
      mTreb.style.width = (engine.liveTreble * 100).toFixed(1) + "%";
      const lv = [engine.liveBass, engine.liveTreble, (engine.liveBass + engine.liveTreble) / 2, engine.liveBass * 0.7];
      soundBars.forEach((b, i) => { b.style.height = (soundOn ? 3 + lv[i] * 9 : 3) + "px"; });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
