const AUDIO_MASTER_DEFAULT = 0.24;

const AUDIO_SAMPLES = {
  windLoop: {
    url: 'audio/ambience-wind-loop.mp3',
    gain: 0.74,
    playbackRate: 1,
    loopStart: 0.45,
    loopEnd: 13.6
  },
  threatLoop: {
    url: 'audio/ambience-threat-surge.mp3',
    gain: 0.36,
    playbackRate: 0.92,
    loopStart: 0.35,
    loopEnd: 13.5
  },
  correctCarabiner: { url: 'audio/sfx-correct-carabiner.mp3' },
  wrongSlip: { url: 'audio/sfx-wrong-slip.mp3' },
  climbPull: { url: 'audio/sfx-climb-pull.mp3' },
  climbSteps: { url: 'audio/sfx-climb-steps.mp3' },
  sidestepScrape: { url: 'audio/sfx-sidestep-scrape.mp3' },
  powerSwing: { url: 'audio/sfx-power-swing.mp3' },
  lensCleanA: { url: 'audio/sfx-lens-clean-a.mp3' },
  lensCleanB: { url: 'audio/sfx-lens-clean-b.mp3' },
  rockImpact: { url: 'audio/sfx-rock-impact.mp3' },
  avalanche: { url: 'audio/sfx-avalanche.mp3' },
  avalancheBlocked: { url: 'audio/sfx-avalanche-blocked.mp3' },
  fall: { url: 'audio/sfx-fall.mp3' },
  winEcho: { url: 'audio/sfx-win-echo.mp3' }
};

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.threatGain = null;
    this.sampleBuffers = new Map();
    this.loopNodes = new Map();
    this.activeSources = new Set();
    this.sampleLoadPromise = null;
    this.initialized = false;
    this.muted = false;
    this.masterLevel = AUDIO_MASTER_DEFAULT;
    this.loadGeneration = 0;
    this.atmosphereProgress = 0;
    this.atmosphereDanger = 0;
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
    this.windGain.gain.value = 0;
    this.windGain.connect(this.masterGain);

    this.threatGain = this.ctx.createGain();
    this.threatGain.gain.value = 0;
    this.threatGain.connect(this.masterGain);

    this.initialized = true;
    this.ctx.resume().catch(() => {});

    const generation = ++this.loadGeneration;
    this.sampleLoadPromise = this._loadAllSamples(generation).then(() => {
      if (!this._isLive(generation)) {
        return;
      }
      this._startLoop('windLoop', this.windGain);
      this._startLoop('threatLoop', this.threatGain);
      this.setAtmosphere(this.atmosphereProgress, this.atmosphereDanger);
    });
  }

  dispose() {
    this.loadGeneration += 1;

    this.activeSources.forEach((source) => this._stopSource(source));
    this.activeSources.clear();

    this.loopNodes.forEach((entry) => this._stopLoopEntry(entry));
    this.loopNodes.clear();

    if (this.ctx) {
      this.ctx.close().catch(() => {});
    }

    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.threatGain = null;
    this.sampleBuffers.clear();
    this.sampleLoadPromise = null;
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
    this.atmosphereProgress = progressRatio;
    this.atmosphereDanger = dangerLevel;

    if (!this.initialized || !this.ctx || !this.windGain || !this.threatGain) {
      return;
    }

    const windTarget = 0.03 + progressRatio * 0.085 + dangerLevel * 0.05;
    const threatTarget = 0.012 + progressRatio * 0.035 + dangerLevel * 0.11;
    this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.36);
    this.threatGain.gain.setTargetAtTime(threatTarget, this.ctx.currentTime, 0.28);
  }

  playCorrectAnswer() {
    this._playSample('correctCarabiner', {
      volume: 0.5,
      duration: 0.72,
      playbackRate: 1.02
    });
  }

  playWrongAnswer() {
    this._playSample('wrongSlip', {
      volume: 0.56,
      duration: 1.05,
      playbackRate: 0.98
    });
  }

  playClimb() {
    this._playSample('climbPull', {
      volume: 0.48,
      duration: 0.74,
      playbackRate: 0.98 + Math.random() * 0.08
    });

    if (Math.random() < 0.7) {
      this._playSample('climbSteps', {
        volume: 0.18,
        offset: 0.14 + Math.random() * 0.55,
        duration: 0.42,
        delay: 0.02,
        playbackRate: 1 + Math.random() * 0.08
      });
    }
  }

  playSidestep() {
    this._playSample('sidestepScrape', {
      volume: 0.46,
      duration: 0.84,
      playbackRate: 1 + Math.random() * 0.05
    });
  }

  playPowerSwing() {
    this._playSample('powerSwing', {
      volume: 0.62,
      duration: 0.95,
      playbackRate: 0.98 + Math.random() * 0.04
    });
  }

  playShield() {
    this._playSample('threatLoop', {
      volume: 0.34,
      offset: 0.05,
      duration: 1.2,
      playbackRate: 1.08
    });
  }

  playLensClean() {
    const key = Math.random() < 0.5 ? 'lensCleanA' : 'lensCleanB';
    this._playSample(key, {
      volume: 0.46,
      duration: 1.08,
      playbackRate: 0.98 + Math.random() * 0.05
    });
  }

  playRockImpact() {
    this._playSample('rockImpact', {
      volume: 0.78,
      duration: 0.95,
      playbackRate: 0.95 + Math.random() * 0.08
    });
  }

  playAvalanche() {
    this._playSample('avalanche', {
      volume: 0.68,
      duration: 2.7,
      playbackRate: 0.98
    });
  }

  playAvalancheBlocked() {
    this._playSample('avalancheBlocked', {
      volume: 0.64,
      duration: 2.2,
      playbackRate: 1.02
    });
  }

  playFall() {
    this._playSample('fall', {
      volume: 0.7,
      duration: 1.7,
      playbackRate: 1
    });
  }

  playWin() {
    this._playSample('winEcho', {
      volume: 0.56,
      duration: 0.95,
      playbackRate: 1
    });
    this._playSample('correctCarabiner', {
      volume: 0.18,
      duration: 0.4,
      delay: 0.18,
      playbackRate: 0.94
    });
  }

  async _loadAllSamples(generation) {
    const urls = Array.from(new Set(Object.values(AUDIO_SAMPLES).map((sample) => sample.url)));
    await Promise.all(urls.map((url) => this._loadSampleUrl(url, generation)));
  }

  async _loadSampleUrl(url, generation) {
    if (!this._isLive(generation) || this.sampleBuffers.has(url)) {
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const bytes = await response.arrayBuffer();
      if (!this._isLive(generation)) {
        return;
      }

      const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
      if (!this._isLive(generation)) {
        return;
      }

      this.sampleBuffers.set(url, buffer);
    } catch (error) {
      console.warn(`Failed to load audio sample: ${url}`, error);
    }
  }

  _startLoop(sampleKey, outputGain) {
    if (!this.initialized || !this.ctx || this.loopNodes.has(sampleKey)) {
      return;
    }

    const def = AUDIO_SAMPLES[sampleKey];
    const buffer = this.sampleBuffers.get(def.url);
    if (!def || !buffer) {
      return;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = def.playbackRate || 1;
    source.loopStart = Math.max(0, Math.min(def.loopStart || 0, buffer.duration - 0.05));
    source.loopEnd = Math.max(source.loopStart + 0.05, Math.min(def.loopEnd || buffer.duration, buffer.duration));
    gain.gain.value = def.gain || 1;
    source.connect(gain);
    gain.connect(outputGain);
    source.start();
    this.loopNodes.set(sampleKey, { source, gain });
  }

  _playSample(sampleKey, options = {}) {
    if (!this.initialized || !this.ctx || !this.masterGain) {
      return false;
    }

    const def = AUDIO_SAMPLES[sampleKey];
    const buffer = def ? this.sampleBuffers.get(def.url) : null;
    if (!def || !buffer) {
      return false;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const outputGain = options.outputGain || this.masterGain;
    const delay = options.delay || 0;
    const when = this.ctx.currentTime + delay;
    const playbackRate = options.playbackRate || 1;
    const offset = Math.max(0, Math.min(options.offset || 0, Math.max(0, buffer.duration - 0.05)));
    const maxDuration = Math.max(0.05, buffer.duration - offset - 0.01);
    const duration = Math.max(0.05, Math.min(options.duration || maxDuration, maxDuration));
    const volume = options.volume || 1;
    const fadeIn = Math.min(0.014, duration * 0.22);
    const fadeOut = Math.min(0.12, duration * 0.34);
    const fadeOutStart = Math.max(when + fadeIn, when + duration - fadeOut);

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + fadeIn);
    gain.gain.setValueAtTime(volume, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.0001, when + duration);

    source.connect(gain);
    gain.connect(outputGain);

    source.onended = () => {
      this.activeSources.delete(source);
      try {
        source.disconnect();
      } catch (error) {
        void error;
      }
      try {
        gain.disconnect();
      } catch (error) {
        void error;
      }
    };

    source.start(when, offset, duration);
    source.stop(when + duration + 0.02);
    this.activeSources.add(source);
    return true;
  }

  _stopSource(source) {
    if (!source) {
      return;
    }
    try {
      source.onended = null;
      source.stop();
    } catch (error) {
      void error;
    }
    try {
      source.disconnect();
    } catch (error) {
      void error;
    }
  }

  _stopLoopEntry(entry) {
    if (!entry) {
      return;
    }
    this._stopSource(entry.source);
    try {
      entry.gain.disconnect();
    } catch (error) {
      void error;
    }
  }

  _isLive(generation) {
    return this.initialized && this.ctx && generation === this.loadGeneration;
  }
}
