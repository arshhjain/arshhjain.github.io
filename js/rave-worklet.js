/* Rave Mode audio engine, running on the audio thread.
   A line-for-line port of audio_listener() in RAVE_MODE/main.py: it processes every 256-sample
   chunk, exactly as the desktop app does, and posts finished LED frames to the page. */

const CHUNK = 256;
const BASS_WINDOW = 1024;
const TREBLE_CUTOFF = 2200;
const BASS_CUTOFF_HZ = 250;
const GAIN_WINDOW = 2.5;

/* ---------- real FFT magnitudes (radix-2) ---------- */
function makeFFT(n) {
  const levels = Math.log2(n) | 0;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b); rev[i] = r; }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = -Math.sin((2 * Math.PI * i) / n); }
  const re = new Float64Array(n), im = new Float64Array(n), mag = new Float64Array(n / 2 + 1);
  return function (input) {
    for (let i = 0; i < n; i++) { re[rev[i]] = input[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
    for (let k = 0; k <= n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    return mag;
  };
}

/* ---------- colour helpers from main.py ---------- */
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return [c[0] * 255, c[1] * 255, c[2] * 255];
}
function boostSaturation(rgb, factor) {
  let [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
  if (s < 0.02) return [rgb[0], rgb[1], rgb[2]];
  s = factor <= 1 ? s * Math.max(0, factor) : Math.min(1, s + s * (1 - s) * (factor - 1) * 0.85);
  return hsv2rgb(h, s, v);
}
function stableBackground(c1, brightness) {
  if (brightness <= 0.005) return [0, 0, 0];
  const bn = Math.max(0, Math.min(1, (brightness - 0.005) / 0.995));
  const target = 4.5 + (38 - 4.5) * Math.pow(bn, 1.15);
  const mx = Math.max(c1[0], c1[1], c1[2], 1);
  return c1.map((c) => { const rel = c / mx; return rel > 0.03 ? Math.sqrt(Math.max(1.8, target * rel) * 255) : 0; });
}
const softLimit = (a, m = 0.95) => (a <= 0 ? 0 : m * Math.tanh(a / m));

class RaveEngine extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const cfg = options.processorOptions.cfg;
    this.cfg = cfg;
    this.fftF = makeFFT(CHUNK);
    this.fftS = makeFFT(BASS_WINDOW);
    this.hann = Float64Array.from({ length: BASS_WINDOW }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (BASS_WINDOW - 1)));

    const ff = (k) => (k * sampleRate) / CHUNK, fs = (k) => (k * sampleRate) / BASS_WINDOW;
    this.bIdx = []; this.tIdx = [];
    for (let k = 0; k <= BASS_WINDOW / 2; k++) if (fs(k) < BASS_CUTOFF_HZ) this.bIdx.push(k);
    for (let k = 0; k <= CHUNK / 2; k++) if (ff(k) > TREBLE_CUTOFF) this.tIdx.push(k);
    this.bW = Float64Array.from(this.bIdx, (k) => 0.5 + 1.0 * Math.exp(-((fs(k) - 50) ** 2) / (2 * 60 ** 2)));
    this.tW = Float64Array.from(this.tIdx, (k) => 0.8 + 0.6 * Math.min(1, Math.max(0, (ff(k) - 2200) / 8000)));

    this.chunk = new Float64Array(CHUNK); this.fill = 0;
    this.bassBuf = new Float64Array(BASS_WINDOW); this.win = new Float64Array(BASS_WINDOW);
    this.trebleFloor = 0;
    this.tBinsFloor = new Float64Array(this.tIdx.length);
    this.prevT = new Float64Array(this.tIdx.length);
    this.tMags = new Float64Array(this.tIdx.length);
    this.bassAvgEnv = new Float64Array(this.bIdx.length);
    this.rawTSmooth = 0; this.bv = 0; this.tv = 0;
    this.arcAvgB = 0; this.arcPeakB = 0; this.arcMultB = 1;

    /* AutoGain */
    this.histMax = Math.round((sampleRate / CHUNK) * GAIN_WINDOW);
    this.hist = new Float64Array(this.histMax); this.histN = 0; this.histI = 0;
    this.gainCur = 1; this.changeFrames = -1; this.gradientFrames = Math.round((4.0 * sampleRate) / CHUNK);

    const n = cfg.n;
    this.r = new Float64Array(n); this.g = new Float64Array(n); this.b = new Float64Array(n);
    this.rs = new Float32Array(n); this.gs = new Float32Array(n); this.bs = new Float32Array(n);
    this.cur = cfg.palette.map((c) => c.slice());
    this.target = cfg.palette.map((c) => c.slice());
    this.liveBass = 0; this.liveTreble = 0; this.gain = 1;
    this.sinceSend = 0;

    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "palette") this.target = m.palette.map((c) => c.slice());
      if (m.type === "trackChange") { this.histN = 0; this.histI = 0; this.gainCur = 0.85; this.changeFrames = 0; }
    };
  }

  agc(vol) {
    this.hist[this.histI] = vol; this.histI = (this.histI + 1) % this.histMax; this.histN = Math.min(this.histN + 1, this.histMax);
    const sorted = Array.from(this.hist.subarray(0, this.histN)).sort((a, b) => a - b);
    const peak = sorted[Math.min(sorted.length - 1, Math.floor(0.92 * (sorted.length - 1)))];
    let target;
    if (peak < 0.015) target = 1;
    else if (peak < 0.06) { const p = (peak - 0.015) / (0.06 - 0.015), knee = 0.12 / (0.06 + 0.001); target = 1 + (knee - 1) * (p * p * (3 - 2 * p)); }
    else target = Math.max(0.2, Math.min(3.5, 0.12 / (peak + 0.001)));
    target = Math.min(5, target * 1.2); /* cohesive mode */
    this.gainCur += (target - this.gainCur) * (target < this.gainCur ? 0.12 : 0.015);
    let out = this.gainCur;
    if (this.changeFrames >= 0) {
      this.changeFrames++;
      if (this.changeFrames < this.gradientFrames) {
        const p = this.changeFrames / this.gradientFrames, sm = p * p * (3 - 2 * p);
        out = Math.min(out, 0.95 + 1.5 * sm) * (0.65 + 0.35 * sm);
      } else this.changeFrames = -1;
    }
    return out;
  }

  step(data) {
    const C = this.cfg;
    let rms = 0;
    for (let i = 0; i < CHUNK; i++) rms += data[i] * data[i];
    rms = Math.sqrt(rms / CHUNK);
    if (rms < C.noiseGate) data.fill(0);
    let maxD = 0;
    for (let i = 0; i < CHUNK; i++) if (data[i] > maxD) maxD = data[i];

    /* treble: unwindowed 256-sample FFT, spectral floor tracking, crest-factor transient gate */
    const fftF = this.fftF(data);
    let rawTInst = 0;
    if (this.tIdx.length && maxD > 0) {
      const tm = this.tMags; let bandE = 0;
      for (let j = 0; j < this.tIdx.length; j++) { tm[j] = fftF[this.tIdx[j]]; bandE += tm[j]; }
      if (this.trebleFloor === 0) { this.trebleFloor = bandE; this.tBinsFloor.set(tm); this.prevT.set(tm); }
      this.prevT.set(tm);
      this.trebleFloor = bandE > this.trebleFloor ? this.trebleFloor * 0.92 + bandE * 0.08 : this.trebleFloor * 0.85 + bandE * 0.15;
      for (let j = 0; j < tm.length; j++) {
        const f = this.tBinsFloor[j];
        this.tBinsFloor[j] = tm[j] > f ? f * 0.92 + tm[j] * 0.08 : f * 0.85 + tm[j] * 0.15;
      }
      const crest = this.trebleFloor > 1e-4 ? bandE / (this.trebleFloor + 1e-4) : 1;
      let gate;
      if (crest <= 1.15) gate = 0; else if (crest >= 1.35) gate = 1; else { const p = (crest - 1.15) / 0.2; gate = p * p * (3 - 2 * p); }
      let ex = 0;
      for (let j = 0; j < tm.length; j++) ex += Math.max(0, tm[j] - this.tBinsFloor[j]) * this.tW[j];
      rawTInst = (ex / tm.length) * 3.2 * gate;
    } else this.trebleFloor = 0;
    if (rawTInst > this.rawTSmooth) this.rawTSmooth = this.rawTSmooth * 0.4 + rawTInst * 0.6;
    else { this.rawTSmooth = this.rawTSmooth * 0.8 + rawTInst * 0.2; if (this.rawTSmooth < 0.005) this.rawTSmooth = 0; }
    const rawT = this.rawTSmooth;

    /* bass: rolling 1024-sample Hann buffer, transient energy above a moving envelope */
    this.bassBuf.copyWithin(0, CHUNK); this.bassBuf.set(data, BASS_WINDOW - CHUNK);
    for (let i = 0; i < BASS_WINDOW; i++) this.win[i] = this.bassBuf[i] * this.hann[i];
    const fftS = this.fftS(this.win);
    let rawB = 0;
    if (this.bIdx.length && maxD > 0) {
      let s = 0;
      for (let j = 0; j < this.bIdx.length; j++) {
        const m = fftS[this.bIdx[j]];
        this.bassAvgEnv[j] = this.bassAvgEnv[j] * 0.92 + m * 0.08;
        s += Math.max(0, m - this.bassAvgEnv[j]) * this.bW[j];
      }
      rawB = (s / this.bIdx.length) * 2.5;
    }

    const gain = this.agc(rawB * 1.2 + rawT);
    const r = C.responsiveness;
    const bat = 0.10 + r * 0.75, bde = 0.95 - r * 0.45, tat = 0.15 + r * 0.55, tde = 0.94 - r * 0.30;

    /* ARC */
    const arcA = 0.005 + r * 0.045;
    this.arcAvgB = this.arcAvgB * (1 - arcA) + this.bv * arcA;
    this.arcPeakB = this.bv > this.arcPeakB ? this.bv : this.arcPeakB * (1 - arcA * 0.2);
    const par = this.arcPeakB / (this.arcAvgB + 1e-4);
    let tmB = 1;
    if (this.arcAvgB > 0.02 && this.arcPeakB > 0.03 && par < 1.4) tmB = Math.min(3.5, 1 + (1.4 - par) * 4 * 1.5);
    this.arcMultB = this.arcMultB * 0.95 + tmB * 0.05;

    const ngB = Math.min(1, Math.max(0.15, rawB * 6)), ngT = Math.min(1, Math.max(0.15, rawT * 6));
    if (rawB > this.bv) this.bv += (rawB - this.bv) * (bat * (0.35 + 0.65 * Math.min(1, this.bv / (rawB + 1e-4))) * ngB);
    else {
      const dm = Math.min(1, Math.pow(this.bv + 1e-4, C.decayGamma - 1));
      const rate = Math.min(1, (1 - bde) * (0.65 + 0.35 * dm) * ngB * this.arcMultB);
      this.bv = Math.max(0, this.bv - (this.bv - rawB) * rate);
    }
    if (rawT > this.tv) this.tv += (rawT - this.tv) * (tat * (0.3 + 0.7 * Math.min(1, this.tv / (rawT + 1e-4))) * ngT);
    else {
      const dm = Math.min(1, Math.pow(this.tv + 1e-4, C.decayGamma - 1));
      this.tv = Math.max(0, this.tv - (this.tv - rawT) * ((1 - tde) * (0.7 + 0.3 * dm)));
    }

    const bRaw = this.bv * (C.bassIntensity * C.sensitivity) * gain;
    const tRaw = this.tv * (C.trebleIntensity * C.sensitivity * C.trebleSens) * gain;
    const bSh = bRaw <= 0.008 ? 0 : Math.pow((bRaw - 0.008) / 0.992, C.attackGamma);
    const tSh = tRaw <= 0.014 ? 0 : Math.pow((tRaw - 0.014) / 0.986, C.attackGamma * 1.05);
    const bAmp = softLimit(bSh), tAmp = softLimit(tSh);
    this.liveBass = Math.min(1, bAmp * 1.5); this.liveTreble = Math.min(1, tAmp * 1.5); this.gain = gain;
    const bw = Math.max(2, bAmp * C.bassWidth * Math.pow(gain, 0.3));
    const tw = Math.max(2, 3 + tAmp * C.trebleWidth * Math.pow(gain, 0.3) * 0.5);

    for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) this.cur[i][c] += (this.target[i][c] - this.cur[i][c]) * 0.05;
    const sat = C.saturation * 1.5;
    const c2 = boostSaturation(this.cur[1], sat), c3 = boostSaturation(this.cur[2], sat);
    const bg = stableBackground(boostSaturation(this.cur[0], sat), C.brightness);

    /* independent segments: bass blooms from each centre, treble flashes at each end */
    for (const [st, en] of C.segments) {
      const L = en - st, mid = L / 2, tz = Math.min(C.trebleZone, Math.max(1, L / 2 - 1));
      for (let x = 0; x < L; x++) {
        const bsh = bAmp * Math.exp(-((x - mid) ** 2) / (2 * bw * bw));
        const tsh = tAmp * (Math.exp(-((x - tz) ** 2) / (2 * tw * tw)) + Math.exp(-((x - (L - tz)) ** 2) / (2 * tw * tw)));
        const f = 1 - Math.min(1, Math.max(0, bsh + tsh)) * 0.9, k = st + x;
        this.r[k] = bg[0] * f + bsh * c2[0] + tsh * c3[0];
        this.g[k] = bg[1] * f + bsh * c2[1] + tsh * c3[1];
        this.b[k] = bg[2] * f + bsh * c2[2] + tsh * c3[2];
      }
    }
    const a = C.temporalSmoothing;
    for (let k = 0; k < C.n; k++) {
      this.rs[k] += (this.r[k] - this.rs[k]) * a;
      this.gs[k] += (this.g[k] - this.gs[k]) * a;
      this.bs[k] += (this.b[k] - this.bs[k]) * a;
    }
  }

  process(inputs) {
    const inp = inputs[0];
    if (inp && inp.length) {
      const ch0 = inp[0], ch1 = inp[1] || inp[0];
      for (let i = 0; i < ch0.length; i++) {
        this.chunk[this.fill++] = ch0[i]; /* main.py reads channel 0 */
        if (this.fill === CHUNK) {
          this.fill = 0;
          this.step(this.chunk);
          if (++this.sinceSend >= 3) {
            this.sinceSend = 0;
            this.port.postMessage({
              rs: this.rs.slice(), gs: this.gs.slice(), bs: this.bs.slice(),
              bass: this.liveBass, treble: this.liveTreble, gain: this.gain, palette: this.cur.map((c) => c.slice())
            });
          }
        }
      }
      void ch1;
    }
    return true;
  }
}

registerProcessor("rave-engine", RaveEngine);
