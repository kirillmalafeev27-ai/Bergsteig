const AUDIO_MASTER_DEFAULT = 0.22;

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.threatGain = null;
    this.nodes = [];
    this.initialized = false;
    this.muted = false;
    this.masterLevel = AUDIO_MASTER_DEFAULT;
  }

  init() {
    this.dispose();

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext unavailable:', error);
      return;
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterLevel;
    this.masterGain.connect(this.ctx.destination);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.09;
    this.windGain.connect(this.masterGain);

    this.threatGain = this.ctx.createGain();
    this.threatGain.gain.value = 0.02;
    this.threatGain.connect(this.masterGain);

    this.initialized = true;
    this._startWind();
    this._startThreatDrone();
  }

  dispose() {
    this.nodes.forEach((node) => {
      try {
        node.stop();
      } catch (error) {
        void error;
      }
    });
    this.nodes = [];

    if (this.ctx) {
      this.ctx.close().catch(() => {});
    }

    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.threatGain = null;
    this.initialized = false;
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    if (!this.masterGain || !this.ctx) {
      return;
    }
    const target = this.muted ? 0 : this.masterLevel;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  isMuted() {
    return this.muted;
  }

  setPaused(flag) {
    if (!this.ctx) {
      return;
    }
    const promise = flag ? this.ctx.suspend() : this.ctx.resume();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {});
    }
  }

  setAtmosphere(progressRatio, dangerLevel) {
    if (!this.initialized) {
      return;
    }

    const windTarget = 0.05 + progressRatio * 0.06 + dangerLevel * 0.03;
    const threatTarget = 0.01 + progressRatio * 0.05 + dangerLevel * 0.1;
    this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.3);
    this.threatGain.gain.setTargetAtTime(threatTarget, this.ctx.currentTime, 0.22);
  }

  playCorrectAnswer() {
    this._chord([392, 494, 587], 'triangle', 0.08, 0.26, 0.02);
  }

  playWrongAnswer() {
    this._tone(180, 'square', 0.1, 0.24, 0);
    this._tone(128, 'square', 0.06, 0.24, 0.06);
  }

  playClimb() {
    this._tone(420, 'triangle', 0.05, 0.14, 0);
    this._noiseBurst(0.03, 850, 0.08);
  }

  playSidestep() {
    this._tone(330, 'sine', 0.04, 0.18, 0);
    this._tone(260, 'sine', 0.035, 0.18, 0.03);
  }

  playPowerSwing() {
    this._tone(280, 'sawtooth', 0.08, 0.28, 0);
    this._noiseBurst(0.06, 420, 0.14);
  }

  playShield() {
    this._chord([220, 330, 440], 'triangle', 0.06, 0.34, 0.03);
  }

  playLensClean() {
    this._tone(720, 'sine', 0.04, 0.16, 0);
    this._tone(960, 'sine', 0.03, 0.18, 0.06);
  }

  playRockImpact() {
    this._tone(74, 'square', 0.16, 0.32, 0);
    this._noiseBurst(0.13, 240, 0.18, 0.02);
  }

  playAvalanche() {
    this._tone(62, 'sawtooth', 0.18, 0.52, 0);
    this._noiseBurst(0.16, 140, 0.34, 0.01);
  }

  playAvalancheBlocked() {
    this._chord([196, 247, 294], 'triangle', 0.05, 0.26, 0.02);
  }

  playFall() {
    this._tone(94, 'sawtooth', 0.18, 0.7, 0);
    this._tone(48, 'triangle', 0.1, 0.8, 0.08);
  }

  playWin() {
    this._chord([392, 523, 659], 'sine', 0.08, 0.5, 0);
    this._tone(784, 'triangle', 0.04, 0.38, 0.2);
  }

  _startWind() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    gain.gain.value = 0.17;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.windGain);
    source.start();
    this.nodes.push(source);
  }

  _startThreatDrone() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.value = 38;
    filter.type = 'lowpass';
    filter.frequency.value = 82;
    gain.gain.value = 0.18;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.threatGain);
    osc.start();
    this.nodes.push(osc);
  }

  _chord(frequencies, type, volume, duration, delay) {
    frequencies.forEach((frequency, index) => {
      this._tone(frequency, type, volume * (1 - index * 0.18), duration, delay + index * 0.02);
    });
  }

  _tone(frequency, type, volume, duration, delay) {
    if (!this.initialized) {
      return;
    }

    const time = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  _noiseBurst(volume, cutoff, duration, delay = 0) {
    if (!this.initialized) {
      return;
    }

    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const time = this.ctx.currentTime + delay;

    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(time);
    source.stop(time + duration);
  }
}
