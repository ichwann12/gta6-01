// Synthesised sound: no audio files, everything is WebAudio oscillators and
// filtered noise. The context is created on the first user gesture, so a
// screenshot run (no gesture) stays silent and never throws.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  /** Call from a user gesture (key or click). Safe to call any time. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** A short tone: frequency, seconds, shape, volume, and an optional slide to. */
  tone(freq, dur, type = 'square', vol = 0.15, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish, never a crash.
    }
  }

  /** A burst of filtered noise: gunshots, crashes, skids. */
  noise(dur, vol = 0.2, freq = 1200) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // Sound is garnish, never a crash.
    }
  }

  shot() {
    this.noise(0.12, 0.3, 2400);
    this.tone(220, 0.08, 'square', 0.1, 60);
  }

  crash(strength = 1) {
    this.noise(0.25, 0.25 * strength, 500);
    this.tone(70, 0.2, 'sine', 0.25 * strength, 40);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.18);
    setTimeout(() => this.tone(990, 0.12, 'sine', 0.18), 70);
  }

  cash() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.16), i * 80));
  }

  missionStart() {
    [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.16), i * 90));
  }

  fail() {
    [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'sawtooth', 0.12), i * 110));
  }

  /** Engine hum that follows the driven car's speed; call every frame. */
  engine(running, speedNorm) {
    if (!this.ctx || this.muted) return;
    try {
      if (!running) {
        if (this.engineGain) this.engineGain.gain.value = 0;
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speedNorm * 130;
      this.engineGain.gain.value = 0.05 + speedNorm * 0.05;
    } catch {
      // Sound is garnish, never a crash.
    }
  }

  /** A two-tone siren that follows the nearest cop car; call every frame. */
  siren(on, distanceNorm) {
    if (!this.ctx || this.muted) return;
    try {
      if (!on) {
        if (this.sirenGain) this.sirenGain.gain.value = 0;
        return;
      }
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      const phase = (this.ctx.currentTime % 1.2) < 0.6 ? 0 : 1;
      this.sirenOsc.frequency.value = phase === 0 ? 750 : 1000;
      this.sirenGain.gain.value = 0.03 * (1 - Math.min(1, distanceNorm));
    } catch {
      // Sound is garnish, never a crash.
    }
  }

  /** A lazy sun-soaked bassline: Am – F – C – G, one bar a second. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const roots = [110, 87.31, 130.81, 98];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const root = roots[this.musicStep % 4];
      this.musicStep += 1;
      this.tone(root, 0.5, 'triangle', 0.07);
      this.tone(root * 1.5, 0.25, 'sine', 0.05);
    }, 500);
  }
}
