const SUMMIT_HEIGHT = 100;
const CLIMB_STEP = 6;
window.BERG_ROUTE_LANE_SPACING = window.BERG_ROUTE_LANE_SPACING || 6.35;
const LANE_SPACING = window.BERG_ROUTE_LANE_SPACING;
const STRONG_SWING_DISTANCE = 9.8;
const STRONG_SWING_ESCAPE_X = 8.1;
const STRONG_SWING_HOLD_MS = 820;
const SHIELD_ACTIVE_MS = 15000;
const SPRING_STIFFNESS = 30;
const SPRING_DAMPING = 7.6;
const MAX_PLAYER_X = 16.5;
// Climb pacing: metres per second of rope. A full CLIMB_STEP (6 m) takes ~3 s,
// so a double-climb bonus is ~6 s — enough to *feel* the ascent instead of
// teleporting. Fall-back from an avalanche hit resolves faster on purpose.
const CLIMB_SPEED_UP = 2.05;
const CLIMB_SPEED_DOWN = 11;
const SUMMIT_ROCK_STOP_DISTANCE = 10;
const ROCK_SPAWN_MIN_AHEAD = 62;
const ROCK_SPAWN_MAX_AHEAD = 82;
const ROCK_HIT_GRACE_MS = 1400;
const LANE_SWITCH_PROTECTION_MS = 10000;
const ROCK_POST_AVALANCHE_LOCK_MS = 5200;
const AVALANCHE_POST_ROCK_LOCK_MS = 2600;
const AVALANCHE_ROCK_CLEARANCE = 28;
const AVALANCHE_INTERVAL_MULTIPLIER = 4;
const AVALANCHE_INITIAL_DELAY_MS = 18000 * AVALANCHE_INTERVAL_MULTIPLIER;
const AVALANCHE_CADENCE_MIN = 14000 * AVALANCHE_INTERVAL_MULTIPLIER;
const AVALANCHE_CADENCE_MAX = 19000 * AVALANCHE_INTERVAL_MULTIPLIER;
const COULOIR_FISSURE_CHANCE = 0.5;
const COULOIR_FISSURE_TURNS = 3;
const COULOIR_FISSURE_MIN_AHEAD = 12;
const COULOIR_FISSURE_MAX_AHEAD = 18;
const LENS_DIRT_BASE_RATE = 0.0045;
const LENS_DIRT_PHASE_RATE = 0.0035;
const LENS_DIRT_DANGER_RATE = 0.0025;
const LENS_VISUAL_SMOOTHING = 1.8;
const LENS_STAGE_LIGHT = 0.3;
const LENS_STAGE_HEAVY = 0.65;
const LENS_STAGE_FULL = 1;

// Phase-change panorama. The HUD already splits the climb by phaseRatio at
// 0.45 and 0.78 — the same thresholds gate the panorama so the visible phase
// name change lines up with the silent beat.
const PANORAMA_PHASE_RATIO_STEPS = [0.45, 0.78];
const PANORAMA_BASE_MS = 900;
const PANORAMA_CLEAN_BONUS_MS = 2100;
const PANORAMA_FADE_IN_MS = 420;
const PANORAMA_FADE_OUT_MS = 520;

// Streak-driven serenity. A run of correct answers physically opens the
// world: wind ducks, sky lifts, FOV widens. A single wrong answer snaps
// the storm back. SERENITY_SATURATION is the streak length that maps to
// full-open sky; RISE/FALL are first-order blend rates (per second).
const SERENITY_SATURATION = 5;
const SERENITY_RISE_RATE = 1.15;
const SERENITY_FALL_RATE = 6.4;

// Numb fingers. Time without a correct answer accumulates "cold seconds".
// Two thresholds gate a 200ms and 400ms lag on sidesteps — the lane move
// still executes, just with a felt delay. Each correct answer refunds
// NUMB_CORRECT_RELIEF_SEC of cold time, so three rights in a row fully
// thaw even from the deepest numb.
const NUMB_LEVEL_1_SEC = 15;
const NUMB_LEVEL_2_SEC = 30;
const NUMB_DELAYS_MS = [0, 200, 400];
const NUMB_CORRECT_RELIEF_SEC = 20;
const NUMB_COLD_MAX_SEC = NUMB_LEVEL_2_SEC + 20;

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

function directionLabel(dir) {
  return dir < 0 ? 'Влево' : 'Вправо';
}

function isDirectionalBonus(slotId) {
  return slotId === 'sidestep' || slotId === 'powerSwing';
}

function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatTurnCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} ход`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} хода`;
  }
  return `${count} ходов`;
}

function lensStageTarget(dirt) {
  if (dirt >= LENS_STAGE_FULL) {
    return LENS_STAGE_FULL;
  }
  if (dirt >= LENS_STAGE_HEAVY) {
    return LENS_STAGE_HEAVY;
  }
  if (dirt >= LENS_STAGE_LIGHT) {
    return LENS_STAGE_LIGHT;
  }
  return 0;
}

class Game {
  constructor() {
    this.ui = this._cacheUi();
    this.renderer = null;
    this.audio = null;
    this.questionManager = null;

    this.state = 'idle';
    this.atmospherePreset = 'classic';
    this.lastSettings = null;
    this.slotConfigs = [];
    this.topicButtonNodes = [];
    this.currentQuestion = null;
    this.questionLoading = false;
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
      altitudeBar: document.getElementById('altitude-bar'),
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
      pauseBtn: document.getElementById('pause-btn'),
      muteBtn: document.getElementById('mute-btn'),
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
      pauseOverlay: document.getElementById('pause-overlay'),
      resumeBtn: document.getElementById('resume-btn'),
      pauseExitBtn: document.getElementById('pause-exit-btn'),
      prepOverlay: document.getElementById('prep-overlay'),
      prepStatus: document.getElementById('prep-status'),
      touchZones: Array.from(document.querySelectorAll('.touch-zone'))
    };
  }

  _bindUi() {
    this.ui.directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.commitDirection(Number(button.dataset.dir || 0));
      });
    });

    if (this.ui.resumeBtn) {
      this.ui.resumeBtn.addEventListener('click', () => this.togglePause(false));
    }
    if (this.ui.pauseExitBtn) {
      this.ui.pauseExitBtn.addEventListener('click', () => this._handleExit());
    }
    if (this.ui.pauseBtn) {
      this.ui.pauseBtn.addEventListener('click', () => this.togglePause());
    }
    if (this.ui.muteBtn) {
      this.ui.muteBtn.addEventListener('click', () => this.toggleMute());
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
        if (this.panorama.active) {
          this._endPanorama(performance.now());
          return;
        }
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

      const dir =
        event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A'
          ? -1
          : event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D'
            ? 1
            : 0;

      if (dir) {
        event.preventDefault();
        this.openQuestion(event.shiftKey ? 'powerSwing' : 'sidestep', dir);
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
    this.openQuestion('sidestep', dir);
  }

  _performSidestep(dir) {
    const previousLane = this.player.baseLane;
    const nextLane = clamp(previousLane + dir, -1, 1);
    if (nextLane === previousLane) {
      this.player.vx += dir * 5.4;
      this.cameraShake = Math.max(this.cameraShake, 0.08);
      this._showMessage(`Крайняя линия. Рывок ${directionLabel(dir).toLowerCase()} дальше не уводит.`, 1000);
      return false;
    }

    if (this._isCouloirBlocked(nextLane)) {
      this.player.vx += dir * 4.8;
      this.cameraShake = Math.max(this.cameraShake, 0.12);
      this._showMessage(
        `Кулуар ${laneLabel(nextLane).toLowerCase()} разорван расщелиной ещё на ${formatTurnCount(this.couloirFissure.turnsLeft)}.`,
        1300
      );
      return false;
    }

    this.player.baseLane = nextLane;
    this.player.vx += dir * 15.2;
    this.cameraShake = Math.max(this.cameraShake, 0.18);
    this._leaveFootprints(this.player.progress + 0.4, 0.74);
    this._protectLane(nextLane, this.currentTime);
    if (this.audio) {
      this.audio.playSidestep();
    }

    this._showMessage(`Рывок ${directionLabel(dir).toLowerCase()}: линия ${laneLabel(nextLane)}.`, 1200);
    return true;
  }

  _performPowerSwing(dir) {
    if (this.state !== 'running' || this.player.falling) {
      return false;
    }

    this.player.burst = {
      anchorX: laneToX(this.player.baseLane) + dir * STRONG_SWING_DISTANCE,
      until: this.currentTime + STRONG_SWING_HOLD_MS
    };
    this.player.vx += dir * 20.4;
    this.cameraShake = Math.max(this.cameraShake, 0.34);
    this._leaveFootprints(this.player.progress + 0.3, 0.7);

    if (this.audio) {
      this.audio.playPowerSwing();
    }

    this._showMessage(`Сильный рывок: ${directionLabel(dir).toLowerCase()}.`, 1300);
    return true;
  }

  _handleExit() {
    if (this.onExit) {
      this.onExit();
    }
  }

  async init(settings) {
    this.destroy(false);

    this.lastSettings = JSON.parse(JSON.stringify(settings));
    this.atmospherePreset = settings.atmospherePreset || 'classic';
    this.slotConfigs = settings.slotConfigs;
    this.state = 'preparing';
    this.poolRefillFreezeActive = false;

    if (!this.questionManager) {
      this.questionManager = new QuestionManager(settings.langLevel, settings.language);
    }
    this.questionManager.setLanguage(settings.language);
    this.questionManager.setLevel(settings.langLevel);
    this.questionManager.setLexicalTopic(settings.lexicalTopic);
    this.questionManager.configureSlots(settings.slotConfigs);

    this._showPrepOverlay('Готовим упражнения по выбранным темам...');
    try {
      await this.questionManager.prefetchAll((progress) => {
        const slotLabel = this._slotLabel(progress.slotId);
        const message = progress.status === 'loading'
          ? `Готовим тему ${progress.done + 1}/${progress.total}: ${slotLabel}...`
          : `Готово ${progress.done}/${progress.total}.`;
        this._updatePrepOverlay(message);
      });
    } catch (error) {
      console.warn('Question prefetch failed:', error);
    }
    this._hidePrepOverlay();

    this.state = 'running';
    this.startedAt = performance.now();
    this.currentTime = this.startedAt;
    this.lastFrameAt = 0;

    this.renderer = new BergRenderer(this.ui.canvas, {
      atmospherePreset: this.atmospherePreset
    });
    this.audio = new AudioManager();
    this.audio.setMuted(this.muted);
    this.audio.init();
    this._applyMuteUi();
    this.totalPausedMs = 0;
    this.pausedAt = 0;

    this.player = {
      name: settings.playerName || getLanguageConfig(settings.language).defaultPlayerName,
      language: settings.language || DEFAULT_LANGUAGE,
      languageLabel: settings.languageLabel || getLanguageConfig(settings.language).uiLabel,
      level: settings.langLevel || DEFAULT_CEFR_LEVEL,
      lexicalTopic: settings.lexicalTopic,
      progress: 0,
      climbTarget: 0,
      climbing: false,
      climbStrokePhase: 0,
      climbStrokeTimer: 0,
      baseLane: 0,
      x: 0,
      vx: 0,
      lens: 0,
      lensVisual: 0,
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
    this.couloirFissure = null;
    this.rockImpactGraceUntil = 0;
    this.rockSpawnBlockedUntil = 0;
    this.laneSafeUntil = { '-1': 0, '0': 0, '1': 0 };
    this.avalancheSpawnBlockedUntil = 0;

    this.stats = {
      answers: 0,
      correct: 0,
      avalanchesHit: 0,
      avalanchesBlocked: 0,
      nearMisses: 0
    };

    this.nextRockSpawnAt = this.startedAt + 13000;
    this.nextAvalancheSpawnAt = this.startedAt + AVALANCHE_INITIAL_DELAY_MS;

    // Panorama-pause state. `phaseStepIndex` tracks how many of the HUD phase
    // thresholds the climber has already crossed. `cleanClimb` flips to false
    // on the first avalanche hit — a dirty run still gets a short panorama,
    // but loses the scaling bonus. The panorama never fires while a question
    // is open, the climber is falling, or a panorama is already active.
    this.phaseStepIndex = 0;
    this.cleanClimb = true;
    this.panorama = {
      active: false,
      pending: false,
      startedAt: 0,
      duration: 0,
      intensity: 0
    };

    // Streak-driven "serenity": 0 = storm as usual, 1 = open sky. Built from
    // consecutive correct answers; reset to 0 the instant a wrong answer
    // lands (handled in answerQuestion). `serenity` is the smoothed render
    // value; `serenityTarget` is the raw step function off correctStreak.
    this.correctStreak = 0;
    this.serenity = 0;
    this.serenityTarget = 0;

    // Numb-fingers state. `coldSeconds` grows at 1×dt; correct answers
    // refund time. `numbLevel` is derived from thresholds — only the level
    // transition triggers a narrative message so the player gets a signal
    // when the lag kicks in, not on every sidestep.
    this.coldSeconds = 0;
    this.numbLevel = 0;

    this.currentQuestion = null;
    this.questionLoading = false;
    this.pendingDirection = null;
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this._renderTopicButtons();
    this._showMessage('Подъём начался. Следи за оранжевыми метками на склоне — там упадёт камень.', 3200);
    this._updateHud();
    this._updateHazardFeed();
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
    this.questionLoading = false;
    this.pendingDirection = null;
    this.state = 'idle';
    if (this.ui.messageBanner) {
      this.ui.messageBanner.classList.add('hidden');
    }
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this.ui.topicButtons.innerHTML = '';
    if (this.ui.pauseOverlay) {
      this.ui.pauseOverlay.classList.add('hidden');
    }
    this._hidePrepOverlay();
    this.poolRefillFreezeActive = false;
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
      if (this.panorama.active) {
        this._endPanorama(performance.now());
      }
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
      document.body.classList.add('paused');
      return;
    }

    if (!shouldPause && this.state === 'paused') {
      const pausedDelta = performance.now() - this.pausedAt;
      this.totalPausedMs += pausedDelta;
      this.startedAt += pausedDelta;
      this.nextRockSpawnAt += pausedDelta;
      this.nextAvalancheSpawnAt += pausedDelta;
      this.rockImpactGraceUntil += pausedDelta;
      if (this.laneSafeUntil) {
        Object.keys(this.laneSafeUntil).forEach((key) => {
          if (this.laneSafeUntil[key]) {
            this.laneSafeUntil[key] += pausedDelta;
          }
        });
      }
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
      if (icon) icon.textContent = 'M';
      if (label) label.textContent = 'Выкл';
      this.ui.muteBtn.classList.add('active');
      this.ui.muteBtn.setAttribute('aria-pressed', 'true');
      this.ui.muteBtn.setAttribute('aria-label', 'Включить звук (M)');
      this.ui.muteBtn.setAttribute('title', 'Включить звук (M)');
    } else {
      if (icon) icon.textContent = 'S';
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

    // Serenity: smooth climb toward the streak target, fast drop on mistake.
    // Exponential blend keeps both directions frame-rate independent.
    const serenityRate = this.serenityTarget > this.serenity ? SERENITY_RISE_RATE : SERENITY_FALL_RATE;
    this.serenity += (this.serenityTarget - this.serenity) * (1 - Math.exp(-serenityRate * dt));

    // Cold clock. Numbness level transitions produce one-shot narrative
    // messages so the player learns why their sidestep suddenly lags.
    this.coldSeconds = clamp(this.coldSeconds + dt, 0, NUMB_COLD_MAX_SEC);
    this._updateNumbLevel();

    // Kick off a deferred panorama once the climber is free of question/direction
    // UI. The phase-change check itself runs inside _updateEnvironment.
    if (this.panorama.pending && !this.panorama.active && !this.currentQuestion && !this.pendingDirection && !this.player.falling) {
      this._startPanorama(timestamp);
    }

    if (this.panorama.active) {
      this._tickPanorama(dt, timestamp);
      // World is frozen: no physics, no hazards, no spawns. Environment still
      // ticks so the storm overlay/lens can settle toward the quiet look.
      this._updateEnvironment(dt, timestamp);
      this._updateFootprints(dt);
      this._updateHud();
      this._updateHazardFeed();
      if (this.renderer) {
        this.renderer.render(this._buildSnapshot(), dt);
      }
      if (this.audio) {
        this.audio.setSerenity(this.serenity);
        this.audio.setAtmosphere(this.player.progress / SUMMIT_HEIGHT, this._dangerLevel());
      }
      if (this.state !== 'idle') {
        this.frameId = requestAnimationFrame(this._loop);
      }
      return;
    }

    this._updatePlayerPhysics(dt, timestamp);
    this._updateEnvironment(dt, timestamp);
    this._updateHazards(dt, timestamp);
    this._updateFootprints(dt);
    this._updateHud();
    this._updateHazardFeed();
    if (this.currentQuestion) {
      this._refreshQuestionMeta();
    }
    if (this.renderer) {
      this.renderer.render(this._buildSnapshot(), dt);
    }
    if (this.audio) {
      this.audio.setSerenity(this.serenity);
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
    this.player.x = clamp(this.player.x, -MAX_PLAYER_X, MAX_PLAYER_X);

    if (this.player.falling) {
      const fallSeconds = (now - this.player.fallStartedAt) / 1000;
      this.player.fallOffset = Math.min(28, Math.pow(fallSeconds, 1.16) * 20);
      this.cameraShake = Math.max(this.cameraShake, 0.12);
      return;
    }

    // Smooth the logical progress toward climbTarget. A flat rate with a
    // tiny ease-near-target gives the "pulling up the rope" feel without
    // stalling at the last centimetre. Each stroke footprint is laid
    // roughly every metre so the climb reads as deliberate hand-over-hand.
    const delta = this.player.climbTarget - this.player.progress;
    if (Math.abs(delta) > 0.001) {
      const ascending = delta > 0;
      const rate = ascending ? CLIMB_SPEED_UP : CLIMB_SPEED_DOWN;
      const easing = ascending
        ? 0.55 + 0.45 * clamp(Math.abs(delta) / 2.5, 0, 1)
        : 1;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * easing * dt);
      this.player.progress = clamp(this.player.progress + step, 0, SUMMIT_HEIGHT);
      this.player.climbing = ascending;

      if (ascending) {
        // Alternating axe/foot pulse tied to meters, not frames, so the
        // renderer can sync its limb animation cleanly.
        this.player.climbStrokeTimer += Math.abs(step);
        if (this.player.climbStrokeTimer > 0.8) {
          this.player.climbStrokeTimer = 0;
          this.player.climbStrokePhase = (this.player.climbStrokePhase + 1) % 2;
          this._leaveFootprints(this.player.progress, 0.6);
          this.cameraShake = Math.max(this.cameraShake, 0.06);
          if (this.audio) {
            this.audio.playSidestep();
          }
        }
      }
    } else {
      this.player.climbing = false;
      this.player.climbStrokeTimer = 0;
    }

    if (this.player.shieldCharges > 0 && now >= this.player.shieldUntil) {
      this.player.shieldCharges = 0;
    }
  }

  _updateEnvironment(dt, now) {
    const phaseRatio = this._phaseRatio();
    this._checkPanoramaTrigger(phaseRatio);
    const shieldFactor = this.player.shieldCharges > 0 ? 0.58 : 1;
    this.player.lens = clamp(
      this.player.lens + dt * (
        LENS_DIRT_BASE_RATE +
        phaseRatio * LENS_DIRT_PHASE_RATE +
        this._dangerLevel() * LENS_DIRT_DANGER_RATE
      ) * shieldFactor,
      0,
      1
    );
    const lensTarget = lensStageTarget(this.player.lens);
    const lensBlend = 1 - Math.exp(-LENS_VISUAL_SMOOTHING * dt);
    this.player.lensVisual += (lensTarget - this.player.lensVisual) * lensBlend;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.3);

    const stormPresetMultiplier = this.atmospherePreset === 'newyear' ? 0.48 : 1;
    const stormStrength = (0.28 + phaseRatio * 0.18 + this._dangerLevel() * 0.24) * stormPresetMultiplier;
    const lensHazeFactor = this.atmospherePreset === 'newyear' ? 0.68 : 0.86;
    const lensFrostFactor = this.atmospherePreset === 'newyear' ? 0.88 : 1.08;
    this.ui.stormOverlay.style.setProperty('--storm-strength', stormStrength.toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-blur', this.player.lensVisual.toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-haze', (this.player.lensVisual * lensHazeFactor).toFixed(3));
    this.ui.lensOverlay.style.setProperty('--lens-frost', clamp(this.player.lensVisual * lensFrostFactor, 0, 1).toFixed(3));

    if (!this.player.falling && !this.panorama.active) {
      if (now >= this.nextRockSpawnAt) {
        if (this._canSpawnRockWave(now)) {
          this._spawnRockWave(now);
        } else {
          this.nextRockSpawnAt = now + 500;
        }
      }
      if (now >= this.nextAvalancheSpawnAt) {
        if (this._canSpawnAvalanche(now)) {
          this._spawnAvalanche(now);
        } else {
          this.nextAvalancheSpawnAt = now + 700;
        }
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

    let rockHitThisFrame = false;
    this.hazards.rocks.forEach((rock) => {
      if (rock.processed || rockHitThisFrame) {
        return;
      }
      rock.y -= rock.speed * dt;
      rock.warning = now < rock.armedUntil;
      const closeCallY = 1.5 + rock.size * 0.95;
      const closeCallX = 1.1 + rock.size * 0.9;
      const hitY = 0.68 + rock.size * 0.44;
      const hitX = 0.54 + rock.size * 0.46;

      if (!rock.closeCallDone && Math.abs(rock.y - this.player.progress) < closeCallY && Math.abs(this.player.x - rock.x) < closeCallX) {
        rock.closeCallDone = true;
        this.player.lens = clamp(this.player.lens + 0.01, 0, 1);
      }

      if (now >= this.rockImpactGraceUntil && Math.abs(rock.y - this.player.progress) < hitY && Math.abs(this.player.x - rock.x) < hitX) {
        rock.processed = true;
        rockHitThisFrame = true;
        this.rockImpactGraceUntil = now + ROCK_HIT_GRACE_MS;
        this._handleRockHit();
      }
    });

    this.hazards.avalanches.forEach((avalanche) => {
      avalanche.y -= avalanche.speed * dt;

      if (!avalanche.processed && Math.abs(avalanche.y - this.player.progress) < 2.8) {
        avalanche.processed = true;
        this.rockSpawnBlockedUntil = Math.max(this.rockSpawnBlockedUntil, now + ROCK_POST_AVALANCHE_LOCK_MS);

        if (this.player.shieldCharges > 0 && now < this.player.shieldUntil) {
          this.player.shieldCharges = 0;
          this.stats.avalanchesBlocked += 1;
          this.cameraShake = Math.max(this.cameraShake, 0.28);
          this.player.lens = clamp(this.player.lens + 0.015, 0, 1);
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
        this.cleanClimb = false;
        // Knockback as a target, not a snap — the fast down-rate in
        // _updatePlayerPhysics covers the distance quickly but still
        // sells direction and weight instead of teleporting.
        this.player.climbTarget = Math.max(0, this.player.progress - CLIMB_STEP * 3);
        this.player.progress = Math.max(
          this.player.climbTarget,
          this.player.progress - CLIMB_STEP * 0.4
        );
        this.player.lens = clamp(this.player.lens + 0.09, 0, 1);
        this.cameraShake = Math.max(this.cameraShake, 0.52);
        this._leaveFootprints(this.player.progress, 0.9);
        if (this.audio) {
          this.audio.playAvalanche();
        }
        this._showMessage('Лавина отбросила тебя на три хода вниз.', 1700);
      }
    });

    this.hazards.rocks = this.hazards.rocks.filter((rock) => !rock.processed && rock.y > this.player.progress - 18);
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
    const lanes = shuffleArray(this._availableSpawnLanes(now));
    if (lanes.length === 0) {
      this.nextRockSpawnAt = now + 500;
      return;
    }
    let count = 1;
    if (rampUp > 0.22 && Math.random() < 0.26 + rampUp * 0.2 + phaseRatio * 0.14) {
      count = 2;
    }
    if (rampUp > 0.56 && Math.random() < 0.12 + rampUp * 0.18 + phaseRatio * 0.16) {
      count = 3;
    }
    count = Math.min(count, lanes.length);
    const baseSpeed = 5.6 + rampUp * 2 + phaseRatio * 2.2;

    for (let index = 0; index < count; index += 1) {
      const lane = lanes[index];
      this.hazards.rocks.push({
        id: `rock-${this.hazardCounter += 1}`,
        lane,
        x: laneToX(lane),
        y: this.player.progress + randomRange(ROCK_SPAWN_MIN_AHEAD, ROCK_SPAWN_MAX_AHEAD),
        speed: baseSpeed + randomRange(0, 1.2),
        size: randomRange(0.58, 0.86),
        armedUntil: now + 720,
        warning: true,
        closeCallDone: false,
        processed: false
      });
    }

    const cadence = randomRange(5200, 7800) - phaseRatio * 440 - rampUp * 800;
    this.nextRockSpawnAt = now + Math.max(3400, cadence);
    this.avalancheSpawnBlockedUntil = Math.max(this.avalancheSpawnBlockedUntil, now + AVALANCHE_POST_ROCK_LOCK_MS);
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

    const cadence = randomRange(AVALANCHE_CADENCE_MIN, AVALANCHE_CADENCE_MAX) - phaseRatio * 1100 - rampUp * 1800;
    this.nextAvalancheSpawnAt = now + Math.max(14500 * AVALANCHE_INTERVAL_MULTIPLIER, cadence);
    this.rockSpawnBlockedUntil = Math.max(this.rockSpawnBlockedUntil, now + ROCK_POST_AVALANCHE_LOCK_MS);
  }

  async openQuestion(slotId, direction = 0) {
    if (this.state !== 'running' || this.player.falling || this.pendingDirection || this.questionLoading) {
      return;
    }

    const slotConfig = this.slotConfigs.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return;
    }

    const isDirectionalRequest = isDirectionalBonus(slotId) && Boolean(direction);
    if (this.currentQuestion && !isDirectionalRequest) {
      return;
    }

    if (slotConfig.slotDef.cooldownMs > 0) {
      const remaining = this.player.shieldCooldownUntil - this.currentTime;
      if (remaining > 0) {
        this._showMessage(`Снежный щит ещё восстанавливается: ${formatCooldown(remaining)}.`, 1600);
        return;
      }
    }

    if (isDirectionalBonus(slotId) && !direction) {
      this._showMessage('У этого бонуса выбери половину кнопки: влево или вправо.', 1300);
      return;
    }

    if (this.currentQuestion) {
      this.questionManager.returnLastQuestion(this.currentQuestion.slotId);
      this.currentQuestion = null;
      this._closeQuestionPanel();
    }

    this.questionLoading = true;
    this._renderTopicButtons();

    const poolEmpty = this.questionManager.isPoolEmpty(slotId);
    if (poolEmpty) {
      this._beginPoolRefillFreeze(slotId);
    } else {
      this._showMessage('Загружаем вопрос...', 1100);
    }

    try {
      const question = await this.questionManager.getQuestion(slotId);
      if (poolEmpty) {
        this._endPoolRefillFreeze();
      }
      if (this.state !== 'running' || this.player.falling || this.currentQuestion || this.pendingDirection) {
        this.questionManager.returnLastQuestion(slotId);
        return;
      }
      if (!question) {
        this._showMessage('Не удалось получить вопрос для этой темы.', 1400);
        return;
      }

      this.currentQuestion = question;
      this.currentQuestion.direction = direction;
      this._renderQuestion();
    } catch (error) {
      if (poolEmpty) {
        this._endPoolRefillFreeze();
      }
      console.warn('Question loading failed:', error);
      this._showMessage('Не удалось загрузить вопрос. Попробуйте другую тему.', 1500);
    } finally {
      this.questionLoading = false;
      this._renderTopicButtons();
    }
  }

  _beginPoolRefillFreeze(slotId) {
    if (this.poolRefillFreezeActive) {
      return;
    }
    this.poolRefillFreezeActive = true;
    this._showPrepOverlay(`Пул темы «${this._slotLabel(slotId)}» исчерпан. Готовим новые упражнения...`);
    if (this.state === 'running') {
      this.togglePause(true);
      if (this.ui.pauseOverlay) {
        this.ui.pauseOverlay.classList.add('hidden');
      }
    }
  }

  _endPoolRefillFreeze() {
    if (!this.poolRefillFreezeActive) {
      return;
    }
    this.poolRefillFreezeActive = false;
    this._hidePrepOverlay();
    if (this.state === 'paused') {
      this.togglePause(false);
    }
  }

  answerQuestion(index) {
    if (!this.currentQuestion || this.player.falling) {
      return;
    }

    const correct = index === this.currentQuestion.options.correctIndex;
    const resolvedSlotId = this.currentQuestion.slotDef.id;
    const resolvedDirection = this.currentQuestion.direction || 0;
    this.stats.answers += 1;
    if (correct) {
      this.stats.correct += 1;
      this.correctStreak += 1;
      this.serenityTarget = clamp(this.correctStreak / SERENITY_SATURATION, 0, 1);
      this.coldSeconds = Math.max(0, this.coldSeconds - NUMB_CORRECT_RELIEF_SEC);
      this._updateNumbLevel();
      if (this.questionManager) {
        this.questionManager.onCorrectAnswer(resolvedSlotId);
      }
    } else {
      // Mistake snaps the storm back. Streak and serenity target drop
      // instantly; the mountain should close back in on the same beat.
      this.correctStreak = 0;
      this.serenity = 0;
      this.serenityTarget = 0;
      if (this.questionManager) {
        this.questionManager.onWrongAnswer(resolvedSlotId);
      }
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
      this._schedule(() => {
        this._applyBonus(resolvedSlotId, resolvedDirection);
        this._consumeCouloirFissureTurn();
      }, 260);
    } else {
      this.ui.questionFeedback.classList.add('error');
      this.ui.questionFeedback.textContent = 'Ошибка. Опасности продолжили идти вниз без твоего бонуса.';
      this.ui.questionFeedback.textContent =
        `Ошибка. Правильный ответ: ${this.currentQuestion.options.options[this.currentQuestion.options.correctIndex]}`;
      this.player.lens = clamp(this.player.lens + 0.015, 0, 1);
      const fissureSpawned = this._spawnCouloirFissureOnMistake();
      if (this.audio) {
        this.audio.playWrongAnswer();
      }
      this._schedule(() => {
        if (!fissureSpawned) {
          this._consumeCouloirFissureTurn();
        }
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
      }, 820);
    }
  }

  _applyBonus(slotId, direction = 0) {
    if (this.player.falling || this.state !== 'running') {
      return;
    }

    if (!this.currentQuestion && slotId !== 'snowShield' && slotId !== 'cleanLens' && slotId !== 'climb') {
      return;
    }

    switch (slotId) {
      case 'climb':
        if (this._isCouloirBlocked(this.player.baseLane)) {
          this.cameraShake = Math.max(this.cameraShake, 0.15);
          this._showMessage(
            `Расщелина перекрыла ${laneLabel(this.player.baseLane).toLowerCase()} кулуар. Нужен уход в сторону.`,
            1400
          );
          this.currentQuestion = null;
          this._closeQuestionPanel();
          this._renderTopicButtons();
          break;
        }
        // Queue altitude instead of snapping — _updatePlayerPhysics eases the
        // actual progress so the camera, rope, and limbs have time to sell
        // the pull. Chaining is fine: if another climb lands mid-ascent, the
        // target just extends.
        this.player.climbTarget = clamp(
          Math.max(this.player.climbTarget, this.player.progress) + CLIMB_STEP * 2,
          0,
          SUMMIT_HEIGHT
        );
        this.cameraShake = Math.max(this.cameraShake, 0.08);
        if (this.audio) {
          this.audio.playClimb();
        }
        this._showMessage('Рывок на трос: пара метров вверх.', 1100);
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._renderTopicButtons();
        break;

      case 'sidestep': {
        this.currentQuestion = null;
        this._closeQuestionPanel();
        const numbDelay = NUMB_DELAYS_MS[this.numbLevel] || 0;
        if (numbDelay > 0) {
          // Lane still changes on the answered direction — just with a felt
          // lag. Hazards keep closing in during the delay, which is the
          // whole point of the numb-fingers mechanic.
          this._schedule(() => this._performSidestep(direction), numbDelay);
        } else {
          this._performSidestep(direction);
        }
        this._renderTopicButtons();
        break;
      }

      case 'powerSwing':
        this.currentQuestion = null;
        this._closeQuestionPanel();
        this._performPowerSwing(direction);
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
        this.player.lens = Math.max(0, this.player.lens - 0.65);
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
      this.player.vx += dir * (nextLane === previousLane ? 7.2 : 15.2);
      this.cameraShake = Math.max(this.cameraShake, 0.18);
      this._leaveFootprints(this.player.progress + 0.5, 0.8);

      if (nextLane !== previousLane) {
        this._protectLane(nextLane, this.currentTime);
      }

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
      this.player.vx += dir * 20.4;
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
    const questionLocked = Boolean(this.currentQuestion || this.pendingDirection || this.player.falling || this.questionLoading);
    const canInterruptWithDirection = Boolean(this.currentQuestion && !this.pendingDirection && !this.player.falling && !this.questionLoading);

    this.slotConfigs.forEach((slotConfig, index) => {
      const isShield = slotConfig.slotDef.id === 'snowShield';
      const isDirectional = Boolean(slotConfig.slotDef.splitDirections);
      const remaining = isShield ? Math.max(0, this.player.shieldCooldownUntil - this.currentTime) : 0;
      const isCooldown = remaining > 0;

      const status = isShield
        ? isCooldown
          ? `CD ${formatCooldown(remaining)}`
          : this.player.shieldCharges > 0
            ? 'Щит активен'
            : 'Готов'
        : isDirectional
          ? slotConfig.slotDef.id === 'sidestep'
            ? 'A / D'
            : 'Shift+A / Shift+D'
          : 'Без CD';

      const sharedMarkup = `
        <span class="topic-index">${index + 1}</span>
        <span class="topic-copy">
          <span class="topic-name">${slotConfig.grammarTopic}</span>
          <span class="topic-bonus">${slotConfig.slotDef.bonusLabel}</span>
        </span>
        <span class="topic-status">${status}</span>
      `;

      if (isDirectional) {
        const wrapper = document.createElement('div');
        wrapper.className = 'topic-btn topic-btn-split';
        if (isCooldown) {
          wrapper.classList.add('cooldown');
        }
        if (questionLocked && !(isDirectional && canInterruptWithDirection)) {
          wrapper.classList.add('locked');
        }
        wrapper.innerHTML = `
          ${sharedMarkup}
          <div class="topic-directions">
            <button class="topic-direction-btn" type="button" data-dir="-1">Влево</button>
            <button class="topic-direction-btn" type="button" data-dir="1">Вправо</button>
          </div>
        `;
        wrapper.querySelectorAll('.topic-direction-btn').forEach((directionButton) => {
          directionButton.disabled = (questionLocked && !canInterruptWithDirection) || isCooldown;
          directionButton.addEventListener('click', () => {
            this.openQuestion(slotConfig.slotDef.id, Number(directionButton.dataset.dir || 0));
          });
        });
        this.ui.topicButtons.appendChild(wrapper);
        return;
      }

      const button = document.createElement('button');
      button.className = 'topic-btn';
      if (isCooldown) {
        button.classList.add('cooldown');
      }
      if (questionLocked) {
        button.classList.add('locked');
      }
      button.innerHTML = sharedMarkup;
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
    this.ui.questionTitle.textContent = question.direction
      ? `${question.slotDef.bonusLabel}: ${directionLabel(question.direction).toLowerCase()}`
      : question.slotDef.bonusLabel;
    this._refreshQuestionMeta();
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

  _hasActiveAvalanche() {
    return this.hazards.avalanches.some((avalanche) => avalanche.y > this.player.progress - 4);
  }

  _rocksShouldStopSpawning() {
    return SUMMIT_HEIGHT - this.player.progress <= SUMMIT_ROCK_STOP_DISTANCE;
  }

  _nearestRockAheadDistance() {
    const nearestRock = this.hazards.rocks
      .filter((rock) => rock.y >= this.player.progress)
      .sort((left, right) => left.y - right.y)[0];
    return nearestRock ? nearestRock.y - this.player.progress : Infinity;
  }

  _canSpawnRockWave(now) {
    if (this.currentQuestion || this.pendingDirection) {
      return false;
    }
    if (this._rocksShouldStopSpawning()) {
      return false;
    }
    if (this._hasActiveAvalanche()) {
      return false;
    }
    if (now < this.rockSpawnBlockedUntil) {
      return false;
    }
    return this._availableSpawnLanes(now).length > 0;
  }

  _availableSpawnLanes(now) {
    return [-1, 0, 1].filter((lane) => now >= (this.laneSafeUntil[lane] || 0));
  }

  _showPrepOverlay(message) {
    if (!this.ui.prepOverlay) {
      return;
    }
    if (this.ui.prepStatus && message) {
      this.ui.prepStatus.textContent = message;
    }
    this.ui.prepOverlay.classList.remove('hidden');
  }

  _hidePrepOverlay() {
    if (!this.ui.prepOverlay) {
      return;
    }
    this.ui.prepOverlay.classList.add('hidden');
  }

  _updatePrepOverlay(message) {
    if (this.ui.prepStatus && message) {
      this.ui.prepStatus.textContent = message;
    }
  }

  _slotLabel(slotId) {
    const slotConfig = (this.slotConfigs || []).find((slot) => slot.slotDef && slot.slotDef.id === slotId);
    if (!slotConfig) {
      return slotId || '';
    }
    return slotConfig.grammarTopic
      || (slotConfig.slotDef && (slotConfig.slotDef.label || slotConfig.slotDef.title || slotConfig.slotDef.id))
      || slotId;
  }

  _protectLane(lane, now) {
    if (lane !== -1 && lane !== 0 && lane !== 1) {
      return;
    }
    const safeUntil = now + LANE_SWITCH_PROTECTION_MS;
    this.laneSafeUntil[lane] = Math.max(this.laneSafeUntil[lane] || 0, safeUntil);

    const minTravelSec = LANE_SWITCH_PROTECTION_MS / 1000;
    this.hazards.rocks.forEach((rock) => {
      if (rock.processed || rock.lane !== lane) {
        return;
      }
      const distance = rock.y - this.player.progress;
      if (distance <= 0) {
        return;
      }
      const safeSpeed = distance / minTravelSec;
      if (rock.speed > safeSpeed) {
        rock.speed = safeSpeed;
      }
    });
  }

  _canSpawnAvalanche(now) {
    if (this._hasActiveAvalanche()) {
      return false;
    }
    if (now < this.avalancheSpawnBlockedUntil) {
      return false;
    }
    return this._nearestRockAheadDistance() > AVALANCHE_ROCK_CLEARANCE;
  }

  _refreshQuestionMeta() {
    if (!this.ui.questionMeta) {
      return;
    }
    this.ui.questionMeta.textContent = this._questionMetaText();
  }

  _questionMetaText() {
    if (!this.couloirFissure) {
      return '1-4 / ошибка = расщелина 50%';
    }
    return `Расщелина: ${laneLabel(this.couloirFissure.lane)} · ${formatTurnCount(this.couloirFissure.turnsLeft)}`;
  }

  _isCouloirBlocked(lane) {
    return Boolean(this.couloirFissure && this.couloirFissure.lane === lane && this.couloirFissure.turnsLeft > 0);
  }

  _spawnCouloirFissureOnMistake() {
    if (Math.random() >= COULOIR_FISSURE_CHANCE) {
      return false;
    }

    const lane = shuffleArray([-1, 0, 1])[0];
    const y = this.player.progress + randomRange(COULOIR_FISSURE_MIN_AHEAD, COULOIR_FISSURE_MAX_AHEAD);
    this.couloirFissure = {
      id: `fissure-${this.hazardCounter += 1}`,
      lane,
      y,
      maxTurns: COULOIR_FISSURE_TURNS,
      turnsLeft: COULOIR_FISSURE_TURNS,
      spawnedAt: this.currentTime
    };
    this.cameraShake = Math.max(this.cameraShake, 0.18);
    this._showMessage(
      `В ${laneLabel(lane).toLowerCase()} кулуаре раскрылась расщелина. Он закрыт на ${formatTurnCount(COULOIR_FISSURE_TURNS)}.`,
      1800
    );
    this._refreshQuestionMeta();
    return true;
  }

  _consumeCouloirFissureTurn() {
    if (!this.couloirFissure) {
      return;
    }

    this.couloirFissure.turnsLeft -= 1;
    if (this.couloirFissure.turnsLeft <= 0) {
      this.couloirFissure = null;
    }
    this._refreshQuestionMeta();
  }

  _updateHud() {
    if (!this.ui.altitudeText) {
      return;
    }

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

    const lensStage = lensStageTarget(this.player.lens);
    if (lensStage === 0) {
      this.ui.lensText.textContent = 'Чисто';
      this.ui.lensSubtext.textContent = 'Камера почти не заснежена.';
    } else if (lensStage === LENS_STAGE_LIGHT) {
      this.ui.lensText.textContent = 'Снег липнет';
      this.ui.lensSubtext.textContent = 'Изображение постепенно мутнеет.';
    } else if (lensStage === LENS_STAGE_HEAVY) {
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
    this.ui.sessionDisplay.textContent = `${this.player.languageLabel} · ${this.player.level} · ${this.player.lexicalTopic}`;
  }

  _updateHazardFeed() {
    if (!this.ui.hazardText) {
      return;
    }

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

    if (this.couloirFissure) {
      const laneName = laneLabel(this.couloirFissure.lane).toLowerCase();
      const turnsText = formatTurnCount(this.couloirFissure.turnsLeft);
      this.ui.hazardText.textContent = this.player.baseLane === this.couloirFissure.lane
        ? `Текущий кулуар вскрыла расщелина. Подъём по нему закрыт ещё на ${turnsText}.`
        : `Расщелина держит ${laneName} кулуар закрытым ещё на ${turnsText}.`;
      return;
    }

    if (this._rocksShouldStopSpawning()) {
      this.ui.hazardText.textContent = 'До вершины меньше 10 метров. Новые камни больше не сходят, но лавина ещё возможна.';
      return;
    }

    const phaseRatio = this._phaseRatio();
    if (phaseRatio < 0.45) {
      this.ui.hazardText.textContent = 'Метель нарастает, а камни уже начали простреливать склон.';
    } else if (phaseRatio < 0.78) {
      this.ui.hazardText.textContent = 'Снег сходит с тёмной скалы, а трос всё сильнее дрожит под руками.';
    } else {
      this.ui.hazardText.textContent = 'Жар поднимается снизу, а воздух смешан со снегом и пеплом.';
    }
  }

  _buildSnapshot() {
    const stormPresetMultiplier = this.atmospherePreset === 'newyear' ? 0.52 : 1;
    const panoramaIntensity = this.panorama.active ? this.panorama.intensity : 0;
    const serenity = clamp(this.serenity, 0, 1);
    // Storm fades ~70% at max serenity (never fully — the mountain still
    // has weather) and ~90% during panorama (silent beat dominates).
    const stormStrength = (0.32 + this._phaseRatio() * 0.18 + this._dangerLevel() * 0.28)
      * stormPresetMultiplier
      * (1 - panoramaIntensity * 0.9)
      * (1 - serenity * 0.7);

    return {
      atmospherePreset: this.atmospherePreset,
      phaseRatio: this._phaseRatio(),
      stormStrength,
      dangerLevel: this._dangerLevel(),
      cameraShake: this.cameraShake * (1 - panoramaIntensity),
      panorama: {
        active: this.panorama.active,
        intensity: panoramaIntensity
      },
      serenity,
      correctStreak: this.correctStreak,
      player: {
        x: this.player.x,
        baseLane: this.player.baseLane,
        y: this.player.progress,
        vx: this.player.vx,
        climbing: this.player.climbing,
        climbTarget: this.player.climbTarget,
        climbStrokePhase: this.player.climbStrokePhase,
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
      couloirFissures: this.couloirFissure
        ? [{
          id: this.couloirFissure.id,
          lane: this.couloirFissure.lane,
          x: laneToX(this.couloirFissure.lane),
          y: this.couloirFissure.y ?? this.player.progress + this.couloirFissure.offsetY,
          maxTurns: this.couloirFissure.maxTurns || COULOIR_FISSURE_TURNS,
          turnsLeft: this.couloirFissure.turnsLeft,
          freshness: clamp(1 - (this.currentTime - this.couloirFissure.spawnedAt) / 1200, 0, 1)
        }]
        : [],
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
    this.cleanClimb = false;
    this._cancelPanorama(this.currentTime);
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
    }, 1450);
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

  _panoramaPhaseStep(phaseRatio) {
    let step = 0;
    for (let i = 0; i < PANORAMA_PHASE_RATIO_STEPS.length; i += 1) {
      if (phaseRatio >= PANORAMA_PHASE_RATIO_STEPS[i]) {
        step = i + 1;
      }
    }
    return step;
  }

  _checkPanoramaTrigger(phaseRatio) {
    const nextStep = this._panoramaPhaseStep(phaseRatio);
    if (nextStep > this.phaseStepIndex) {
      this.phaseStepIndex = nextStep;
    }
  }

  _startPanorama(now) {
    const bonusRatio = this.cleanClimb ? clamp(this.phaseStepIndex / PANORAMA_PHASE_RATIO_STEPS.length, 0, 1) : 0;
    this.panorama.active = true;
    this.panorama.pending = false;
    this.panorama.startedAt = now;
    this.panorama.duration = PANORAMA_BASE_MS + bonusRatio * PANORAMA_CLEAN_BONUS_MS;
    this.panorama.intensity = 0;
    if (this.audio) {
      this.audio.setPanoramaDuck(1);
    }
  }

  _endPanorama(now) {
    if (!this.panorama.active) {
      return;
    }
    const pausedDelta = Math.max(0, now - this.panorama.startedAt);
    // Hazards were frozen during panorama but their absolute-time fields
    // (spawn schedules, shield/burst deadlines, armed-warning windows,
    // fissure spawn stamp) kept ticking. Shift them forward the same way
    // togglePause does so nothing expires in the silent beat.
    this.startedAt += pausedDelta;
    this.nextRockSpawnAt += pausedDelta;
    this.nextAvalancheSpawnAt += pausedDelta;
    this.rockSpawnBlockedUntil += pausedDelta;
    this.avalancheSpawnBlockedUntil += pausedDelta;
    this.rockImpactGraceUntil += pausedDelta;
    if (this.player.burst) {
      this.player.burst.until += pausedDelta;
    }
    if (this.player.shieldUntil) {
      this.player.shieldUntil += pausedDelta;
    }
    if (this.player.shieldCooldownUntil) {
      this.player.shieldCooldownUntil += pausedDelta;
    }
    if (this.couloirFissure) {
      this.couloirFissure.spawnedAt += pausedDelta;
    }
    this.hazards.rocks.forEach((rock) => {
      rock.armedUntil += pausedDelta;
    });

    this.panorama.active = false;
    this.panorama.intensity = 0;
    if (this.audio) {
      this.audio.setPanoramaDuck(0);
    }
  }

  _tickPanorama(dt, now) {
    const elapsed = now - this.panorama.startedAt;
    const duration = this.panorama.duration;
    if (elapsed >= duration) {
      this._endPanorama(now);
      return;
    }
    const fadeIn = clamp(elapsed / PANORAMA_FADE_IN_MS, 0, 1);
    const fadeOut = clamp((duration - elapsed) / PANORAMA_FADE_OUT_MS, 0, 1);
    const raw = Math.min(fadeIn, fadeOut);
    // Smoothstep so the pull-back eases in and out instead of snapping.
    this.panorama.intensity = raw * raw * (3 - 2 * raw);
  }

  _cancelPanorama(now) {
    if (this.panorama.active) {
      this._endPanorama(now);
    }
    this.panorama.pending = false;
  }

  _coldLevelFor(seconds) {
    if (seconds >= NUMB_LEVEL_2_SEC) {
      return 2;
    }
    if (seconds >= NUMB_LEVEL_1_SEC) {
      return 1;
    }
    return 0;
  }

  _updateNumbLevel() {
    const nextLevel = this._coldLevelFor(this.coldSeconds);
    if (nextLevel === this.numbLevel) {
      return;
    }
    const previous = this.numbLevel;
    this.numbLevel = nextLevel;
    if (nextLevel > previous) {
      const msg = nextLevel === 1
        ? 'Пальцы начинают неметь. Ответ — и руки отогреются.'
        : 'Пальцы почти не гнутся. Рывок запаздывает.';
      this._showMessage(msg, 1800);
    } else if (nextLevel === 0) {
      this._showMessage('Руки снова гибкие.', 1400);
    }
  }

  _dangerLevel() {
    const dangerFromRocks = this.hazards.rocks.length * 0.08;
    const dangerFromAvalanches = this.hazards.avalanches.length * 0.22;
    const dangerFromFissure = this.couloirFissure ? 0.12 + this.couloirFissure.turnsLeft * 0.03 : 0;
    const lensDanger = typeof this.player.lensVisual === 'number' ? this.player.lensVisual : this.player.lens;
    return clamp(dangerFromRocks + dangerFromAvalanches + dangerFromFissure + lensDanger * 0.18, 0, 1);
  }

  _showMessage(text, duration = 1400) {
    if (this.currentMessageTimeout) {
      clearTimeout(this.currentMessageTimeout);
      this.currentMessageTimeout = null;
    }

    if (!this.ui.messageBanner) {
      return;
    }

    this.ui.messageBanner.textContent = text;
    this.ui.messageBanner.classList.remove('hidden');

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
