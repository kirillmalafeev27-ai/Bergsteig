const SUMMIT_HEIGHT = 100;
const CLIMB_STEP = 6;
const LANE_SPACING = 2.85;
const STRONG_SWING_DISTANCE = 5.3;
const STRONG_SWING_ESCAPE_X = 4.2;
const STRONG_SWING_HOLD_MS = 720;
const SHIELD_ACTIVE_MS = 15000;
const SPRING_STIFFNESS = 30;
const SPRING_DAMPING = 8.4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function laneToX(lane) {
  return lane * LANE_SPACING;
}

function laneLabel(lane) {
  if (lane < 0) {
    return 'Левая';
  }
  if (lane > 0) {
    return 'Правая';
  }
  return 'Центр';
}

function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

class Game {
  constructor() {
    this.ui = this._cacheUi();
    this.renderer = null;
    this.audio = null;
    this.questionManager = null;

    this.state = 'idle';
    this.lastSettings = null;
    this.slotConfigs = [];
    this.topicButtonNodes = [];
    this.currentQuestion = null;
    this.pendingDirection = null;
    this.currentMessageTimeout = null;
    this.pendingTimeouts = [];
    this.frameId = null;
    this.lastFrameAt = 0;
    this.startedAt = 0;
    this.currentTime = 0;

    this.onWin = null;
    this.onLose = null;
    this.onExit = null;
    this.onMuteChange = null;
    this.muted = false;
    this.pausedAt = 0;
    this.totalPausedMs = 0;

    this._bindUi();
  }

  _cacheUi() {
    return {
      canvas: document.getElementById('game-canvas'),
      lensOverlay: document.getElementById('lens-overlay'),
      stormOverlay: document.getElementById('storm-overlay'),
      messageBanner: document.getElementById('message-banner'),
      altitudeText: document.getElementById('altitude-text'),
      altitudeBar: document.getElementById('altitude-bar-fill'),
      phaseText: document.getElementById('phase-text'),
      phaseSubtext: document.getElementById('phase-subtext'),
      laneText: document.getElementById('lane-text'),
      swingText: document.getElementById('swing-text'),
      lensText: document.getElementById('lens-text'),
      lensSubtext: document.getElementById('lens-subtext'),
      shieldText: document.getElementById('shield-text'),
      shieldSubtext: document.getElementById('shield-subtext'),
      playerDisplay: document.getElementById('player-display'),
      sessionDisplay: document.getElementById('session-display'),
      hazardText: document.getElementById('hazard-text'),
      topicPanel: document.getElementById('topic-panel'),
      topicButtons: document.getElementById('topic-buttons'),
      questionPanel: document.getElementById('question-panel'),
      questionKicker: document.getElementById('question-kicker'),
      questionTitle: document.getElementById('question-title'),
      questionMeta: document.getElementById('question-meta'),
      questionText: document.getElementById('question-text'),
      questionDisplay: document.getElementById('question-display'),
      questionOptions: document.getElementById('question-options'),
      questionFeedback: document.getElementById('question-feedback'),
      directionPanel: document.getElementById('direction-panel'),
      directionTitle: document.getElementById('direction-title'),
      directionButtons: Array.from(document.querySelectorAll('.direction-btn')),
      pauseBtn: document.getElementById('pause-btn'),
      muteBtn: document.getElementById('mute-btn'),
      exitBtn: document.getElementById('exit-btn'),
      pauseOverlay: document.getElementById('pause-overlay'),
      resumeBtn: document.getElementById('resume-btn'),
      pauseExitBtn: document.getElementById('pause-exit-btn'),
      touchZones: Array.from(document.querySelectorAll('.touch-zone'))
    };
  }

  _bindUi() {
    this.ui.directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.commitDirection(Number(button.dataset.dir || 0));
      });
    });

    if (this.ui.pauseBtn) {
      this.ui.pauseBtn.addEventListener('click', () => this.togglePause());
    }
    if (this.ui.muteBtn) {
      this.ui.muteBtn.addEventListener('click', () => this.toggleMute());
    }
    if (this.ui.exitBtn) {
      this.ui.exitBtn.addEventListener('click', () => this._handleExit());
    }
    if (this.ui.resumeBtn) {
      this.ui.resumeBtn.addEventListener('click', () => this.togglePause(false));
    }
    if (this.ui.pauseExitBtn) {
      this.ui.pauseExitBtn.addEventListener('click', () => this._handleExit());
    }

    this.ui.touchZones.forEach((zone) => {
      const dir = Number(zone.dataset.touchDir || 0);
      if (!dir) {
        return;
      }
      zone.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this._handleLaneTap(dir);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (this.state === 'idle') {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        event.preventDefault();
        this.toggleMute();
        return;
      }

      if (this.state === 'paused') {
        return;
      }

      if (this.pendingDirection) {
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
          event.preventDefault();
          this.commitDirection(-1);
        } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          this.commitDirection(1);
        }
        return;
      }

      if (this.currentQuestion) {
        const optionIndex = Number.parseInt(event.key, 10) - 1;
        if (optionIndex >= 0 && optionIndex < 4) {
          event.preventDefault();
          this.answerQuestion(optionIndex);
        }
        return;
      }

      const topicIndex = Number.parseInt(event.key, 10) - 1;
      if (topicIndex >= 0 && topicIndex < this.slotConfigs.length) {
        event.preventDefault();
        this.openQuestion(this.slotConfigs[topicIndex].slotDef.id);
      }
    });
  }

  _handleLaneTap(dir) {
    if (this.state !== 'running' || this.player.falling) {
      return;
    }
    if (this.pendingDirection) {
      this.commitDirection(dir);
      return;
    }
    if (this.currentQuestion) {
      return;
    }
    const previousLane = this.player.baseLane;
    const nextLane = clamp(previousLane + dir, -1, 1);
    if (nextLane === previousLane) {
      this.player.vx += dir * 3.2;
      return;
    }
    this.player.baseLane = nextLane;
    this.player.vx += dir * 6.2;
    this._leaveFootprints(this.player.progress + 0.3, 0.6);
    if (this.audio) {
      this.audio.playSidestep();
    }
  }

  _handleExit() {
    if (this.onExit) {
      this.onExit();
    }
  }

  async init(settings) {
    this.destroy(false);

    this.lastSettings = JSON.parse(JSON.stringify(settings));
    this.slotConfigs = settings.slotConfigs;
    this.state = 'running';
    this.startedAt = performance.now();
    this.currentTime = this.startedAt;
    this.lastFrameAt = 0;

    this.questionManager = new QuestionManager(settings.langLevel);
    this.questionManager.setLevel(settings.langLevel);
    this.questionManager.setLexicalTopic(settings.lexicalTopic);
    this.questionManager.configureSlots(settings.slotConfigs);

    this.renderer = new BergRenderer(this.ui.canvas);
    this.audio = new AudioManager();
    this.audio.setMuted(this.muted);
    this.audio.init();
    this._applyMuteUi();
    this.totalPausedMs = 0;
    this.pausedAt = 0;

    this.player = {
      name: settings.playerName || 'Spieler',
      level: settings.langLevel || DEFAULT_CEFR_LEVEL,
      lexicalTopic: settings.lexicalTopic,
      progress: 0,
      baseLane: 0,
      x: 0,
      vx: 0,
      lens: 0.08,
      shieldCharges: 0,
      shieldUntil: 0,
      shieldCooldownUntil: 0,
      burst: null,
      falling: false,
      fallStartedAt: 0,
      fallOffset: 0
    };

    this.hazards = {
      rocks: [],
      avalanches: []
    };
    this.footprintMarks = [];
    this.footprintCounter = 0;
    this.hazardCounter = 0;
    this.cameraShake = 0;

    this.stats = {
      answers: 0,
      correct: 0,
      avalanchesHit: 0,
      avalanchesBlocked: 0,
      nearMisses: 0
    };

    this.nextRockSpawnAt = this.startedAt + 6500;
    this.nextAvalancheSpawnAt = this.startedAt + 16000;

    this.currentQuestion = null;
    this.pendingDirection = null;
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this._renderTopicButtons();
    this._updateHud();
    this._updateHazardFeed();
    this._showMessage('Подъём начался. Следи за оранжевыми метками на склоне — там упадёт камень.', 3200);
    this._loop(this.startedAt);
  }

  destroy(clearSettings = true) {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (this.currentMessageTimeout) {
      clearTimeout(this.currentMessageTimeout);
      this.currentMessageTimeout = null;
    }

    this.pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.pendingTimeouts = [];

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.audio) {
      this.audio.dispose();
      this.audio = null;
    }

    this.currentQuestion = null;
    this.pendingDirection = null;
    this.state = 'idle';
    this.ui.messageBanner.classList.add('hidden');
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this.ui.topicButtons.innerHTML = '';
    if (this.ui.pauseOverlay) {
      this.ui.pauseOverlay.classList.add('hidden');
    }
    if (this.ui.pauseBtn) {
      this.ui.pauseBtn.classList.remove('active');
    }
    document.body.classList.remove('paused');

    if (clearSettings) {
      this.lastSettings = null;
    }
  }

  async restartCurrentSession() {
    if (!this.lastSettings) {
      return;
    }
    await this.init(this.lastSettings);
  }

  togglePause(force) {
    const shouldPause = typeof force === 'boolean' ? force : this.state === 'running';

    if (shouldPause && this.state === 'running') {
      this.state = 'paused';
      this.pausedAt = performance.now();
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      if (this.audio) {
        this.audio.setPaused(true);
      }
      if (this.ui.pauseOverlay) {
        this.ui.pauseOverlay.classList.remove('hidden');
      }
      if (this.ui.pauseBtn) {
        this.ui.pauseBtn.classList.add('active');
      }
      document.body.classList.add('paused');
      return;
    }

    if (!shouldPause && this.state === 'paused') {
      const pausedDelta = performance.now() - this.pausedAt;
      this.totalPausedMs += pausedDelta;
      this.startedAt += pausedDelta;
      this.nextRockSpawnAt += pausedDelta;
      this.nextAvalancheSpawnAt += pausedDelta;
      if (this.player.burst) {
        this.player.burst.until += pausedDelta;
      }
      if (this.player.shieldUntil) {
        this.player.shieldUntil += pausedDelta;
      }
      if (this.player.shieldCooldownUntil) {
        this.player.shieldCooldownUntil += pausedDelta;
      }
      if (this.player.falling) {
        this.player.fallStartedAt += pausedDelta;
      }
      this.state = 'running';
      this.lastFrameAt = 0;
      if (this.audio) {
        this.audio.setPaused(false);
      }
      if (this.ui.pauseOverlay) {
        this.ui.pauseOverlay.classList.add('hidden');
      }
      if (this.ui.pauseBtn) {
        this.ui.pauseBtn.classList.remove('active');
      }
      document.body.classList.remove('paused');
      this.frameId = requestAnimationFrame(this._loop);
    }
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    if (this.audio) {
      this.audio.setMuted(this.muted);
    }
    this._applyMuteUi();
    if (this.onMuteChange) {
      this.onMuteChange(this.muted);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  _applyMuteUi() {
    if (!this.ui.muteBtn) {
      return;
    }
    const icon = this.ui.muteBtn.querySelector('.hud-action-icon');
    const label = this.ui.muteBtn.querySelector('.hud-action-label');
    if (this.muted) {
      if (icon) icon.textContent = '🔇';
      if (label) label.textContent = 'Mute';
      this.ui.muteBtn.classList.add('active');
      this.ui.muteBtn.setAttribute('aria-pressed', 'true');
      this.ui.muteBtn.setAttribute('aria-label', 'Включить звук (M)');
      this.ui.muteBtn.setAttribute('title', 'Включить звук (M)');
    } else {
      if (icon) icon.textContent = '🔊';
      if (label) label.textContent = 'Звук';
      this.ui.muteBtn.classList.remove('active');
      this.ui.muteBtn.setAttribute('aria-pressed', 'false');
      this.ui.muteBtn.setAttribute('aria-label', 'Выключить звук (M)');
      this.ui.muteBtn.setAttribute('title', 'Выключить звук (M)');
    }
  }

  _loop = (timestamp) => {
    if (this.state === 'idle' || this.state === 'paused') {
      return;
    }

    if (!this.lastFrameAt) {
      this.lastFrameAt = timestamp;
    }

    const dt = Math.min(0.04, Math.max(0.001, (timestamp - this.lastFrameAt) / 1000));
    this.lastFrameAt = timestamp;
    this.currentTime = timestamp;

    this._updatePlayerPhysics(dt, timestamp);
    this._updateEnvironment(dt, timestamp);
    this._updateHazards(dt, timestamp);
    this._updateFootprints(dt);
    this._updateHud();
    this._updateHazardFeed();

    if (this.renderer) {
      this.renderer.render(this._buildSnapshot(), dt);
    }
    if (this.audio) {
      this.audio.setAtmosphere(this.player.progress / SUMMIT_HEIGHT, this._dangerLevel());
    }

    if (this.state !== 'idle') {
      this.frameId = requestAnimationFrame(this._loop);
    }
  };

  _updatePlayerPhysics(dt, now) {
    let anchorX = laneToX(this.player.baseLane);
    if (this.player.burst && now < this.player.burst.until) {
      anchorX = this.player.burst.anchorX;
    } else if (this.player.burst && now >= this.player.burst.until) {
      this.player.burst = null;
    }

    const accel = -SPRING_STIFFNESS * (this.player.x - anchorX) - SPRING_DAMPING * this.player.vx;
    this.player.vx += accel * dt;
    this.player.x += this.player.vx * dt;
    this.player.x = clamp(this.player.x, -6.6, 6.6);

    if (this.player.falling) {
      const fallSeconds = (now - this.player.fallStartedAt) / 1000;
      this.player.fallOffset = Math.min(28, Math.pow(fallSeconds, 1.16) * 20);
      this.cameraShake = Math.max(this.cameraShake, 0.12);
      return;
    }

    if (this.player.shieldCharges > 0 && now >= this.player.shieldUntil) {
      this.player.shieldCharges = 0;
    }
  }

  _updateEnvironment(dt, now) {
    const phaseRatio = this._phaseRatio();
    const shieldFactor = this.player.shieldCharges > 0 ? 0.72 : 1;
    this.player.lens = clamp(
      this.player.lens + dt * (0.018 + phaseRatio * 0.013 + this._dangerLevel() * 0.01) * shieldFactor,
      0,
      1
    );
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.3);

    const stormStrength = 0.28 + phaseRatio * 0.18 + this._dangerLevel() * 0.24;
    this.ui.stormOverlay.style.setProperty('--storm-strength', stormStrength.toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-blur', this.player.lens.toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-haze', (this.player.lens * 0.9).toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-frost', clamp(this.player.lens * 1.15, 0, 1).toFixed(3));

    if (!this.player.falling) {
      if (now >= this.nextRockSpawnAt) {
        this._spawnRockWave(now);
      }
      if (now >= this.nextAvalancheSpawnAt) {
        this._spawnAvalanche(now);
      }
      if (this.player.progress >= SUMMIT_HEIGHT) {
        this._handleWin();
      }
    }
  }

  _updateHazards(dt, now) {
    if (this.player.falling) {
      return;
    }

    this.hazards.rocks.forEach((rock) => {
      rock.y -= rock.speed * dt;
      rock.warning = now < rock.armedUntil;

      if (!rock.closeCallDone && Math.abs(rock.y - this.player.progress) < 2.5 && Math.abs(this.player.x - rock.x) < 2.5) {
        rock.closeCallDone = true;
        this.player.lens = clamp(this.player.lens + 0.03, 0, 1);
      }

      if (Math.abs(rock.y - this.player.progress) < 1.2 && Math.abs(this.player.x - rock.x) < 1.28) {
        this._handleRockHit();
      }
    });

    this.hazards.avalanches.forEach((avalanche) => {
      avalanche.y -= avalanche.speed * dt;

      if (!avalanche.processed && Math.abs(avalanche.y - this.player.progress) < 2.8) {
        avalanche.processed = true;

        if (this.player.shieldCharges > 0 && now < this.player.shieldUntil) {
          this.player.shieldCharges = 0;
          this.stats.avalanchesBlocked += 1;
          this.cameraShake = Math.max(this.cameraShake, 0.28);
          this.player.lens = clamp(this.player.lens + 0.04, 0, 1);
          if (this.audio) {
            this.audio.playAvalancheBlocked();
          }
          this._showMessage('Щит принял лавину на себя.', 1400);
          return;
        }

        if (Math.abs(this.player.x) >= STRONG_SWING_ESCAPE_X) {
          this.stats.nearMisses += 1;
          this.cameraShake = Math.max(this.cameraShake, 0.24);
          this._showMessage('Сильный рывок вывел тебя из-под лавины.', 1200);
          return;
        }

        this.stats.avalanchesHit += 1;
        this.player.progress = Math.max(0, this.player.progress - CLIMB_STEP * 3);
        this.player.lens = clamp(this.player.lens + 0.2, 0, 1);
        this.cameraShake = Math.max(this.cameraShake, 0.52);
        this._leaveFootprints(this.player.progress, 0.9);
        if (this.audio) {
          this.audio.playAvalanche();
        }
        this._showMessage('Лавина отбросила тебя на три хода вниз.', 1700);
      }
    });

    this.hazards.rocks = this.hazards.rocks.filter((rock) => rock.y > this.player.progress - 18);
    this.hazards.avalanches = this.hazards.avalanches.filter((avalanche) => avalanche.y > this.player.progress - 18);
  }

  _updateFootprints(dt) {
    this.footprintMarks = this.footprintMarks
      .map((mark) => ({ ...mark, age: mark.age + dt }))
      .filter((mark) => mark.age < 1.2);
  }

  _spawnRockWave(now) {
    const phaseRatio = this._phaseRatio();
    const rampUp = clamp((now - this.startedAt) / 30000, 0, 1);
    const lanes = shuffleArray([-1, 0, 1]);
    const count = rampUp > 0.6 && Math.random() < 0.22 + phaseRatio * 0.18 ? 2 : 1;
    const baseSpeed = 8.4 + rampUp * 4 + phaseRatio * 4.4;

    for (let index = 0; index < count; index += 1) {
      const lane = lanes[index];
      this.hazards.rocks.push({
        id: `rock-${this.hazardCounter += 1}`,
        lane,
        x: laneToX(lane),
        y: this.player.progress + randomRange(48, 64),
        speed: baseSpeed + randomRange(0, 2.6),
        size: randomRange(1.1, 1.55),
        armedUntil: now + 720,
        warning: true,
        closeCallDone: false
      });
    }

    const cadence = randomRange(2000, 3200) - phaseRatio * 320 - rampUp * 500;
    this.nextRockSpawnAt = now + Math.max(1400, cadence);
  }

  _spawnAvalanche(now) {
    const phaseRatio = this._phaseRatio();
    const rampUp = clamp((now - this.startedAt) / 40000, 0, 1);
    this.hazards.avalanches.push({
      id: `avalanche-${this.hazardCounter += 1}`,
      y: this.player.progress + randomRange(60, 78),
      speed: randomRange(7.6, 10) + phaseRatio * 2.1 + rampUp * 1.4,
      intensity: randomRange(0.65, 1),
      heightScale: randomRange(1.05, 1.45),
      processed: false
    });

    const cadence = randomRange(16000, 22000) - phaseRatio * 1200 - rampUp * 2000;
    this.nextAvalancheSpawnAt = now + Math.max(12000, cadence);
  }

  openQuestion(slotId) {
    if (this.state !== 'running' || this.player.falling || this.currentQuestion || this.pendingDirection) {
      return;
    }

    const slotConfig = this.slotConfigs.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return;
    }

    if (slotConfig.slotDef.cooldownMs > 0) {
      const remaining = this.player.shieldCooldownUntil - this.currentTime;
      if (remaining > 0) {
        this._showMessage(`Снежный щит ещё восстанавливается: ${formatCooldown(remaining)}.`, 1600);
        return;
      }
    }

    this.currentQuestion = this.questionManager.getQuestion(slotId);
    if (!this.currentQuestion) {
      return;
    }

    this._renderQuestion();
    this._renderTopicButtons();
  }

  answerQuestion(index) {
    if (!this.currentQuestion || this.player.falling) {
      return;
    }

    const correct = index === this.currentQuestion.options.correctIndex;
    this.stats.answers += 1;
    if (correct) {
      this.stats.correct += 1;
    }

    const optionButtons = Array.from(this.ui.questionOptions.querySelectorAll('.option-btn'));
    optionButtons.forEach((button, buttonIndex) => {
      button.disabled = true;
      if (buttonIndex === this.currentQuestion.options.correctIndex) {
        button.classList.add('correct');
      } else if (buttonIndex === index) {
        button.classList.add('wrong');
      }
    });

    this.ui.questionFeedback.classList.remove('hidden', 'success', 'error');

    if (correct) {
      this.ui.questionFeedback.classList.add('success');
      this.ui.questionFeedback.textContent = 'Верно. Бонус активирован.';
      if (this.audio) {
        this.audio.playCorrectAnswer();
      }
      this._schedule(() => this._applyBonus(this.currentQuestion.slotDef.id), 260);
    } else {
      this.ui.questionFeedback.classList.add('error');
      this.ui.questionFeedback.textContent = 'Ошибка. Опасности продолжили идти вниз без твоего бонуса.';
      this.player.lens = clamp(this.player.lens + 0.05, 0, 1);
      if (this.audio) {
        this.audio.playWrongAnswer();
      }
      this._schedule(() => {
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
      }, 820);
    }
  }

  _applyBonus(slotId) {
    if (this.player.falling || this.state !== 'running') {
      return;
    }

    if (!this.currentQuestion && slotId !== 'snowShield' && slotId !== 'cleanLens' && slotId !== 'climb') {
      return;
    }

    switch (slotId) {
      case 'climb':
        this.player.progress = clamp(this.player.progress + CLIMB_STEP * 2, 0, SUMMIT_HEIGHT);
        this._leaveFootprints(this.player.progress, 1);
        this.cameraShake = Math.max(this.cameraShake, 0.16);
        if (this.audio) {
          this.audio.playClimb();
        }
        this._showMessage('Рывок вверх дал два хода по тросу.', 1100);
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
        break;

      case 'sidestep':
        this.pendingDirection = { type: 'sidestep' };
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._openDirectionPanel('Выбери сторону для смещения на одну линию');
        this._renderTopicButtons();
        break;

      case 'powerSwing':
        this.pendingDirection = { type: 'powerSwing' };
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._openDirectionPanel('Выбери сторону для сильного рывка вне линии');
        this._renderTopicButtons();
        break;

      case 'snowShield':
        this.player.shieldCharges = 1;
        this.player.shieldUntil = this.currentTime + SHIELD_ACTIVE_MS;
        this.player.shieldCooldownUntil = this.currentTime + BONUS_SLOTS.find((slot) => slot.id === 'snowShield').cooldownMs;
        if (this.audio) {
          this.audio.playShield();
        }
        this._showMessage('Снежный щит активен и готов принять одну лавину.', 1400);
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
        break;

      case 'cleanLens':
        this.player.lens = Math.max(0, this.player.lens - 0.72);
        if (this.audio) {
          this.audio.playLensClean();
        }
        this._showMessage('Камера очищена. Видимость резко выросла.', 1200);
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
        break;

      default:
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
        break;
    }
  }

  commitDirection(dir) {
    if (!this.pendingDirection || this.player.falling) {
      return;
    }

    if (this.pendingDirection.type === 'sidestep') {
      const previousLane = this.player.baseLane;
      const nextLane = clamp(previousLane + dir, -1, 1);
      this.player.baseLane = nextLane;
      this.player.vx += dir * (nextLane === previousLane ? 4.6 : 8.5);
      this.cameraShake = Math.max(this.cameraShake, 0.18);
      this._leaveFootprints(this.player.progress + 0.5, 0.8);

      if (this.audio) {
        this.audio.playSidestep();
      }

      if (nextLane === previousLane) {
        this._showMessage('Крайняя линия. Рывок дал только короткую раскачку.', 1200);
      } else {
        this._showMessage(`Линия сменена: ${laneLabel(nextLane)}.`, 1200);
      }
    } else if (this.pendingDirection.type === 'powerSwing') {
      this.player.burst = {
        anchorX: laneToX(this.player.baseLane) + dir * STRONG_SWING_DISTANCE,
        until: this.currentTime + STRONG_SWING_HOLD_MS
      };
      this.player.vx += dir * 13.8;
      this.cameraShake = Math.max(this.cameraShake, 0.34);
      this._leaveFootprints(this.player.progress + 0.3, 0.7);

      if (this.audio) {
        this.audio.playPowerSwing();
      }

      this._showMessage('Сильный рывок отправил альпиниста далеко в сторону от линии.', 1300);
    }

    this.pendingDirection = null;
    this._closeDirectionPanel();
    this._renderTopicButtons();
  }

  _renderTopicButtons() {
    this.ui.topicButtons.innerHTML = '';
    const questionLocked = Boolean(this.currentQuestion || this.pendingDirection || this.player.falling);

    this.slotConfigs.forEach((slotConfig, index) => {
      const button = document.createElement('button');
      const isShield = slotConfig.slotDef.id === 'snowShield';
      const remaining = isShield ? Math.max(0, this.player.shieldCooldownUntil - this.currentTime) : 0;
      const isCooldown = remaining > 0;

      button.className = 'topic-btn';
      if (isCooldown) {
        button.classList.add('cooldown');
      }
      if (questionLocked) {
        button.classList.add('locked');
      }

      const status = isShield
        ? isCooldown
          ? `CD ${formatCooldown(remaining)}`
          : this.player.shieldCharges > 0
            ? 'Щит активен'
            : 'Готов'
        : 'Без CD';

      button.innerHTML = `
        <span class="topic-index">${index + 1}</span>
        <span class="topic-copy">
          <span class="topic-name">${slotConfig.grammarTopic}</span>
          <span class="topic-bonus">${slotConfig.slotDef.bonusLabel}</span>
        </span>
        <span class="topic-status">${status}</span>
      `;

      button.addEventListener('click', () => this.openQuestion(slotConfig.slotDef.id));
      this.ui.topicButtons.appendChild(button);
    });
  }

  _renderQuestion() {
    const question = this.currentQuestion;
    if (!question) {
      this._closeQuestionPanel();
      return;
    }

    this.ui.questionKicker.textContent = question.grammarTopic;
    this.ui.questionTitle.textContent = question.slotDef.bonusLabel;
    this.ui.questionMeta.textContent = '1-4';
    this.ui.questionText.textContent = question.text;
    this.ui.questionDisplay.textContent = question.display;
    this.ui.questionFeedback.className = 'question-feedback hidden';
    this.ui.questionFeedback.textContent = '';
    this.ui.questionOptions.innerHTML = '';

    question.options.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.className = 'option-btn';
      button.textContent = `${index + 1}. ${option}`;
      button.addEventListener('click', () => this.answerQuestion(index));
      this.ui.questionOptions.appendChild(button);
    });

    this.ui.questionPanel.classList.remove('hidden');
  }

  _closeQuestionPanel() {
    this.ui.questionPanel.classList.add('hidden');
    this.ui.questionOptions.innerHTML = '';
    this.ui.questionFeedback.className = 'question-feedback hidden';
    this.ui.questionFeedback.textContent = '';
  }

  _openDirectionPanel(title) {
    this.ui.directionTitle.textContent = title;
    this.ui.directionPanel.classList.remove('hidden');
  }

  _closeDirectionPanel() {
    this.ui.directionPanel.classList.add('hidden');
  }

  _updateHud() {
    const progressRatio = this.player.progress / SUMMIT_HEIGHT;
    const phaseRatio = this._phaseRatio();
    const swingAmount = clamp(
      Math.abs(this.player.x - laneToX(this.player.baseLane)) / STRONG_SWING_DISTANCE + Math.abs(this.player.vx) / 14,
      0,
      1
    );

    this.ui.altitudeText.textContent = `${Math.round(this.player.progress)} / ${SUMMIT_HEIGHT} м`;
    this.ui.altitudeBar.style.width = `${(progressRatio * 100).toFixed(1)}%`;
    this.ui.phaseText.textContent = phaseRatio < 0.45 ? 'Снежный склон' : phaseRatio < 0.78 ? 'Ледяной разлом' : 'Вулканическая стена';
    this.ui.phaseSubtext.textContent = phaseRatio < 0.45
      ? 'Метель, следы на снегу и холодный свет сверху.'
      : phaseRatio < 0.78
        ? 'Снег тает, скала темнеет, в воздухе больше пара.'
        : 'Пепел, жар снизу и светящиеся трещины на стене.';
    this.ui.laneText.textContent = laneLabel(this.player.baseLane);
    this.ui.swingText.textContent = `Раскачка: ${Math.round(swingAmount * 100)}%`;

    if (this.player.lens < 0.22) {
      this.ui.lensText.textContent = 'Чисто';
      this.ui.lensSubtext.textContent = 'Камера почти не заснежена.';
    } else if (this.player.lens < 0.52) {
      this.ui.lensText.textContent = 'Снег липнет';
      this.ui.lensSubtext.textContent = 'Изображение постепенно мутнеет.';
    } else if (this.player.lens < 0.78) {
      this.ui.lensText.textContent = 'Плохо видно';
      this.ui.lensSubtext.textContent = 'Опасности теряют читаемость.';
    } else {
      this.ui.lensText.textContent = 'Почти слепо';
      this.ui.lensSubtext.textContent = 'Очистка камеры уже очень нужна.';
    }

    if (this.player.shieldCharges > 0 && this.currentTime < this.player.shieldUntil) {
      this.ui.shieldText.textContent = 'Активен';
      this.ui.shieldSubtext.textContent = `Истечёт через ${formatCooldown(this.player.shieldUntil - this.currentTime)}`;
    } else if (this.player.shieldCooldownUntil > this.currentTime) {
      this.ui.shieldText.textContent = 'На CD';
      this.ui.shieldSubtext.textContent = `Осталось ${formatCooldown(this.player.shieldCooldownUntil - this.currentTime)}`;
    } else {
      this.ui.shieldText.textContent = 'Не активен';
      this.ui.shieldSubtext.textContent = 'Готов к использованию';
    }

    this.ui.playerDisplay.textContent = this.player.name;
    this.ui.sessionDisplay.textContent = `${this.player.level} · ${this.player.lexicalTopic}`;
  }

  _updateHazardFeed() {
    const nearestAvalanche = this.hazards.avalanches
      .filter((hazard) => hazard.y >= this.player.progress)
      .sort((left, right) => left.y - right.y)[0];
    const nearestRock = this.hazards.rocks
      .filter((hazard) => hazard.y >= this.player.progress)
      .sort((left, right) => left.y - right.y)[0];

    if (nearestAvalanche && nearestAvalanche.y - this.player.progress < 24) {
      this.ui.hazardText.textContent = 'Лавина идёт по всей ширине. Спасает только сильный рывок или снежный щит.';
      return;
    }

    if (nearestRock && nearestRock.y - this.player.progress < 16) {
      this.ui.hazardText.textContent = `Камень идёт сверху по линии: ${laneLabel(nearestRock.lane)}.`;
      return;
    }

    const phaseRatio = this._phaseRatio();
    if (phaseRatio < 0.45) {
      this.ui.hazardText.textContent = 'Метель нарастает, а камни уже начали простреливать склон.';
    } else if (phaseRatio < 0.78) {
      this.ui.hazardText.textContent = 'Снег сходит с тёмной скалы, а трос всё сильнее дрожит под руками.';
    } else {
      this.ui.hazardText.textContent = 'Жар поднимается снизу. Камни летят быстрее, а воздух смешан со снегом и пеплом.';
    }
  }

  _buildSnapshot() {
    const stormStrength = 0.32 + this._phaseRatio() * 0.18 + this._dangerLevel() * 0.28;

    return {
      phaseRatio: this._phaseRatio(),
      stormStrength,
      dangerLevel: this._dangerLevel(),
      cameraShake: this.cameraShake,
      player: {
        x: this.player.x,
        y: this.player.progress,
        vx: this.player.vx,
        shieldActive: this.player.shieldCharges > 0 && this.currentTime < this.player.shieldUntil,
        falling: this.player.falling,
        fallOffset: this.player.fallOffset
      },
      rocks: this.hazards.rocks.map((rock) => ({
        id: rock.id,
        x: rock.x,
        y: rock.y,
        size: rock.size,
        speed: rock.speed,
        warning: rock.warning
      })),
      avalanches: this.hazards.avalanches.map((avalanche) => ({
        id: avalanche.id,
        y: avalanche.y,
        intensity: avalanche.intensity,
        heightScale: avalanche.heightScale
      })),
      footprints: this.footprintMarks.map((mark) => ({
        id: mark.id,
        x: mark.x,
        y: mark.y,
        age: mark.age,
        rotation: mark.rotation,
        strength: mark.strength
      }))
    };
  }

  _leaveFootprints(baseY, strength = 1) {
    this.footprintMarks.push({
      id: `footprint-${this.footprintCounter += 1}`,
      x: this.player.x - 0.22,
      y: baseY - 0.38,
      age: 0,
      rotation: -0.2,
      strength
    });
    this.footprintMarks.push({
      id: `footprint-${this.footprintCounter += 1}`,
      x: this.player.x + 0.22,
      y: baseY + 0.22,
      age: 0,
      rotation: 0.22,
      strength
    });
  }

  _handleRockHit() {
    if (this.player.falling) {
      return;
    }

    this.state = 'falling';
    this.player.falling = true;
    this.player.fallStartedAt = this.currentTime;
    this.currentQuestion = null;
    this.pendingDirection = null;
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this._renderTopicButtons();
    this.cameraShake = 0.9;

    if (this.audio) {
      this.audio.playRockImpact();
      this.audio.playFall();
    }

    this._showMessage('Камень сбил альпиниста с троса.', 1200);

    this._schedule(() => {
      const stats = this._buildResultStats();
      this.state = 'idle';
      if (this.onLose) {
        this.onLose(stats);
      }
    }, 1100);
  }

  _handleWin() {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'idle';
    if (this.audio) {
      this.audio.playWin();
    }

    const stats = this._buildResultStats();
    if (this.onWin) {
      this.onWin(stats);
    }
  }

  _buildResultStats() {
    const durationMs = Math.max(1, this.currentTime - this.startedAt);
    const accuracy = this.stats.answers ? Math.round((this.stats.correct / this.stats.answers) * 100) : 0;

    return {
      playerName: this.player.name,
      level: this.player.level,
      lexicalTopic: this.player.lexicalTopic,
      progress: Math.round(this.player.progress),
      accuracy,
      durationSeconds: Math.round(durationMs / 1000),
      answers: this.stats.answers,
      correct: this.stats.correct,
      avalanchesHit: this.stats.avalanchesHit,
      avalanchesBlocked: this.stats.avalanchesBlocked,
      nearMisses: this.stats.nearMisses
    };
  }

  _phaseRatio() {
    return clamp((this.player.progress / SUMMIT_HEIGHT - 0.42) / 0.4, 0, 1);
  }

  _dangerLevel() {
    const dangerFromRocks = this.hazards.rocks.length * 0.08;
    const dangerFromAvalanches = this.hazards.avalanches.length * 0.22;
    return clamp(dangerFromRocks + dangerFromAvalanches + this.player.lens * 0.22, 0, 1);
  }

  _showMessage(text, duration = 1400) {
    this.ui.messageBanner.textContent = text;
    this.ui.messageBanner.classList.remove('hidden');

    if (this.currentMessageTimeout) {
      clearTimeout(this.currentMessageTimeout);
    }

    this.currentMessageTimeout = setTimeout(() => {
      this.ui.messageBanner.classList.add('hidden');
      this.currentMessageTimeout = null;
    }, duration);
  }

  _schedule(callback, delay) {
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts = this.pendingTimeouts.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    this.pendingTimeouts.push(timeoutId);
  }
}
