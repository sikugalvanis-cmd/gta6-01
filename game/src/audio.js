// Synthesised sound: no audio files, everything is WebAudio oscillators and
// filtered noise, so the game stays offline and self-contained.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.enabled = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = 0;
  }

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.master);
    this.startMusic();
    // Engine hum: a sawtooth whose pitch follows the car's speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(40 + speed01 * 140, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1000) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.12, 0.4, 2500); this.tone(180, 0.08, 'square', 0.12, 60); }
  punch() { this.noise(0.08, 0.25, 500); }
  crash() { this.noise(0.25, 0.4, 800); this.tone(90, 0.2, 'sine', 0.25, 40); }
  pickup() { this.tone(660, 0.1, 'sine', 0.18); this.tone(990, 0.16, 'sine', 0.18); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.2), i * 110)); }
  fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.12), i * 140)); }
  siren(dt, wanted) {
    if (!this.ctx || !this.enabled || wanted === 0) return;
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.9) {
      this.sirenTimer = 0;
      this.tone(700, 0.42, 'sine', 0.05, 950);
      setTimeout(() => this.tone(950, 0.42, 'sine', 0.05, 700), 450);
    }
  }

  /** A slow neon-noir bass loop: root notes with a soft pad. */
  startMusic() {
    if (!this.ctx) return;
    const roots = [55, 65.41, 49, 58.27]; // A1 C2 G1 A#1
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const root = roots[step % roots.length];
      step += 1;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = root;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(t + 2);
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = root * 3;
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.12, t + 0.3);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      o2.connect(g2);
      g2.connect(this.musicGain);
      o2.start(t);
      o2.stop(t + 2);
      setTimeout(tick, 950);
    };
    tick();
  }
}
