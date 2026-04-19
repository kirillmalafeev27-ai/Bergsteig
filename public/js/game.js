class Game {
  constructor() {
    this.renderer = null;
    this.questionManager = null;
    this.callbacks = {};
    this.loopHandle = 0;
    this.lastFrameAt = 0;
    this.pendingTimers = new Set();
    this.isActive = false;

    this._tick = this._tick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);

    this.ui = this._cacheUi();
    this._bindUi();
  }

  _cacheUi() {
    return {
      gameScreen: document.getElementById('game-screen'),
      canvas: document.getElementById('game-canvas'),
      messageBanner: document.getElementById('message-banner'),
      checkpointBanner: document.getElementById('checkpoint-banner'),
      levelName: document.getElementById('level-name'),
      runNameDisplay: document.getElementById('run-name-display'),
      lexicalTopicDisplay: document.getElementById('lexical-topic-display'),
      altitudeDisplay: document.getElementById('altitude-display'),
      progressDisplay: document.getElementById('progress-display'),
      visibilityDisplay: document.getElementById('visibility-display'),
      accuracyDisplay: document.getElementById('accuracy-display'),
      hazardTitle: document.getElementById('hazard-title'),
      hazardDescription: document.getElementById('hazard-description'),
      hazardLanes: document.getElementById('hazard-lanes'),
      effectChips: document.getElementById('effect-chips'),
      cooldownChips: document.getElementById('cooldown-chips'),
      lensOverlay: document.getElementById('lens-overlay'),
      stormOverlay: document.getElementById('storm-overlay'),
      laneButtons: Array.from(document.querySelectorAll('.lane-btn')),
      slotBar: document.getElementById('slot-bar'),
      questionPanel: document.getElementById('question-panel'),
      questionKicker: document.getElementById('question-kicker'),
      questionTitle: document.getElementById('question-title'),
      questionLevel: document.getElementById('question-level'),
      questionText: document.getElementById('question-text'),
      questionDisplay: document.getElementById('question-display'),
      questionOptions: document.getElementById('question-options'),
      questionFeedback: document.getElementById('question-feedback')
    };
  }

  _bindUi() {
    this.ui.laneButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.selectLane(Number(button.dataset.lane));
      });
    });

    document.addEventListener('keydown', this._handleKeyDown);
  }

  async init(settings, callbacks = {}) {
    this.destroy();

    this.callbacks = callbacks;
    this.settings = settings;
    this.levelBlueprints = createLevelBlueprints();
    this.totalGoalSegments = this.levelBlueprints.reduce((sum, level) => sum + level.segmentGoal, 0);

    this.questionManager = new QuestionManager(settings.langLevel || DEFAULT_CEFR_LEVEL);
    this.questionManager.setLexicalTopic(settings.lexicalTopic);
    this.questionManager.configureSlots(settings.slotConfigs || []);

    this.renderer = new AscentRenderer(this.ui.canvas);
    this.isActive = true;
    this.lastFrameAt = performance.now();

    this.currentLevelIndex = 0;
    this.currentLevel = this.levelBlueprints[0];
    this.currentLevelProgress = 0;
    this.completedSegments = 0;
    this.visualProgressUnits = 0;
    this.currentLane = 1;
    this.selectedLane = 1;
    this.desiredLane = 1;
    this.lateralOffset = LANE_WORLD_X[this.currentLane];
    this.lateralVelocity = 0;
    this.motionProfile = { omega: 8.5, zeta: 0.6 };
    this.cameraObscurity = 6;
    this.clearViewUntil = 0;
    this.shieldCharges = 0;
    this.shieldExpiresAt = 0;
    this.currentHazard = null;
    this.currentHazardSignature = '';
    this.hazardElapsedMs = 0;
    this.movementDurationMs = 0;
    this.waveResolved = [];
    this.currentAction = null;
    this.currentQuestion = null;
    this.currentSlotId = null;
    this.currentTurnCorrect = false;
    this.pendingSetback = 0;
    this.pendingDeath = null;
    this.state = 'boot';

    this.stats = {
      answered: 0,
      correct: 0,
      survivedTurns: 0
    };

    this.slotCooldowns = Object.create(null);
    BONUS_SLOTS.forEach((slot) => {
      this.slotCooldowns[slot.id] = 0;
    });

    this._buildSlotButtons();
    this._updateUi();
    this._showQuestion(null);

    await Promise.allSettled([this.questionManager.prefetchAll()]);
    this._queueMessage('The rope tightens. Read the first hazard.');
    this._prepareNextTurn();
    this.loopHandle = requestAnimationFrame(this._tick);
  }

  destroy() {
    this.isActive = false;
    this.questionLocked = false;

    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = 0;
    }

    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.currentQuestion = null;
    this.currentSlotId = null;
    this._showQuestion(null);
    this.ui.messageBanner.classList.add('hidden');
    this.ui.checkpointBanner.classList.add('hidden');
  }

  _setTimer(callback, delayMs) {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      callback();
    }, delayMs);
    this.pendingTimers.add(timer);
    return timer;
  }

  _queueMessage(text, durationMs = 1800) {
    this.ui.messageBanner.textContent = text;
    this.ui.messageBanner.classList.remove('hidden');
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.pendingTimers.delete(this.messageTimer);
    }
    this.messageTimer = this._setTimer(() => {
      this.ui.messageBanner.classList.add('hidden');
    }, durationMs);
  }

  _showCheckpoint(text) {
    this.ui.checkpointBanner.textContent = text;
    this.ui.checkpointBanner.classList.remove('hidden');
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.pendingTimers.delete(this.checkpointTimer);
    }
    this.checkpointTimer = this._setTimer(() => {
      this.ui.checkpointBanner.classList.add('hidden');
    }, 1500);
  }

  _buildSlotButtons() {
    this.ui.slotBar.innerHTML = '';
    this.slotButtonNodes = (this.settings.slotConfigs || []).map((slotConfig, index) => {
      const button = document.createElement('button');
      button.className = 'slot-btn';
      button.addEventListener('click', () => {
        this.selectSlot(slotConfig.slotDef.id);
      });

      button.innerHTML = `
        <div class="slot-key">${index + 1}</div>
        <div class="slot-bonus-name">${slotConfig.slotDef.bonusLabel}</div>
        <div class="slot-topic-name">${slotConfig.grammarTopic}</div>
      `;
      this.ui.slotBar.appendChild(button);
      return { button, slotConfig };
    });
  }

  _prepareNextTurn() {
    if (this.currentLevelProgress >= this.currentLevel.segmentGoal) {
      this._advanceLevel();
      return;
    }

    this.currentHazard = buildHazard(this.currentLevel, this);
    this.currentHazardSignature = JSON.stringify({
      level: this.currentLevel.id,
      type: this.currentHazard.type,
      kind: this.currentHazard.kind || '',
      lanes: this.currentHazard.waves.map((wave) => wave.lanes.join('-')).join('|')
    });

    this.selectedLane = this.currentLane;
    this.desiredLane = this.currentLane;
    this.currentQuestion = null;
    this.currentSlotId = null;
    this.currentAction = null;
    this.currentTurnCorrect = false;
    this.pendingSetback = 0;
    this.pendingDeath = null;
    this.hazardElapsedMs = 0;
    this.movementDurationMs = 0;
    this.waveResolved = this.currentHazard.waves.map(() => false);
    this.state = 'telegraph';
    this.motionProfile = { omega: 8.5, zeta: 0.6 };
    this._updateUi();
  }

  selectLane(laneIndex) {
    if (!this.isActive || this.state !== 'telegraph') {
      return;
    }
    this.selectedLane = clamp(laneIndex, 0, 2);
    this._updateUi();
  }

  selectSlot(slotId) {
    if (!this.isActive || this.state !== 'telegraph') {
      return;
    }

    if ((this.slotCooldowns[slotId] || 0) > 0) {
      this._queueMessage('That slot is still cooling down.');
      return;
    }

    const question = this.questionManager.getQuestion(slotId);
    if (!question) {
      this._queueMessage('No question available for this slot.');
      return;
    }

    this.currentQuestion = question;
    this.currentSlotId = slotId;
    this.state = 'question';
    this._showQuestion(question);
    this._updateUi();
  }

  answerQuestion(optionIndex) {
    if (!this.isActive || this.state !== 'question' || !this.currentQuestion || this.questionLocked) {
      return;
    }

    this.questionLocked = true;
    const isCorrect = optionIndex === this.currentQuestion.options.correctIndex;
    const slotId = this.currentSlotId;
    const slotDef = this.currentQuestion.slotDef;

    this.stats.answered += 1;
    if (isCorrect) {
      this.stats.correct += 1;
      this.questionManager.onCorrectAnswer(slotId);
    } else {
      this.questionManager.onWrongAnswer(slotId);
    }

    Array.from(this.ui.questionOptions.children).forEach((button, index) => {
      button.disabled = true;
      if (index === this.currentQuestion.options.correctIndex) {
        button.classList.add('correct');
      }
      if (index === optionIndex && !isCorrect) {
        button.classList.add('wrong');
      }
    });

    this.ui.questionFeedback.textContent = isCorrect
      ? `${slotDef.bonusLabel} activated.`
      : `Wrong answer. ${slotDef.bonusLabel} does not trigger.`;

    const delay = isCorrect ? 820 : 1000;
    this._setTimer(() => {
      this.questionLocked = false;
      this._finishQuestion(isCorrect);
    }, delay);
  }

  _finishQuestion(isCorrect) {
    const slotDef = this.currentQuestion?.slotDef;
    if (!slotDef) {
      return;
    }

    this._showQuestion(null);
    const action = isCorrect ? this._buildAction(slotDef) : null;
    if (!isCorrect) {
      this.slotCooldowns[slotDef.id] = Math.max(this.slotCooldowns[slotDef.id] || 0, slotDef.wrongCooldownMs || 0);
    }
    this._startMovement(action, isCorrect);
  }

  _buildAction(slotDef) {
    const action = {
      slotId: slotDef.id,
      slotDef,
      targetLane: this.currentLane,
      extraSegments: 0,
      hardEvade: false,
      activateShield: false,
      clearView: false,
      profile: { omega: 8.5, zeta: 0.58 },
      impulse: 0
    };

    if (slotDef.id === 'extraMove') {
      action.extraSegments = EXTRA_MOVE_SEGMENTS;
      return action;
    }

    if (slotDef.id === 'step') {
      action.targetLane = this._resolveStepTarget();
      action.profile = { omega: 8.5, zeta: 0.58 };
      action.impulse = this._laneImpulse(action.targetLane, 0.55);
      return action;
    }

    if (slotDef.id === 'surge') {
      action.targetLane = this._resolveSurgeTarget();
      action.profile = { omega: 7.2, zeta: 0.34 };
      action.impulse = this._laneImpulse(action.targetLane, 1.25);
      action.hardEvade = true;
      return action;
    }

    if (slotDef.id === 'shield') {
      action.activateShield = true;
      return action;
    }

    if (slotDef.id === 'clear') {
      action.clearView = true;
      return action;
    }

    return action;
  }

  _resolveStepTarget() {
    const directDelta = this.selectedLane - this.currentLane;
    if (Math.abs(directDelta) === 1) {
      return this.selectedLane;
    }

    const preferred = this.currentHazard?.preferredSafeLane;
    if (typeof preferred === 'number' && Math.abs(preferred - this.currentLane) === 1) {
      return preferred;
    }

    if (directDelta > 0 && this.currentLane < 2) {
      return this.currentLane + 1;
    }

    if (directDelta < 0 && this.currentLane > 0) {
      return this.currentLane - 1;
    }

    return this.currentLane === 0 ? 1 : this.currentLane === 2 ? 1 : 0;
  }

  _resolveSurgeTarget() {
    if (this.selectedLane !== this.currentLane) {
      return this.selectedLane;
    }

    if (typeof this.currentHazard?.preferredSafeLane === 'number') {
      return this.currentHazard.preferredSafeLane;
    }

    return this.currentLane === 0 ? 2 : 0;
  }

  _laneImpulse(targetLane, strength) {
    const targetWorldX = LANE_WORLD_X[targetLane];
    const direction = Math.sign(targetWorldX - this.lateralOffset) || 1;
    return direction * strength;
  }

  _startMovement(action, isCorrect) {
    this.currentAction = action;
    this.currentTurnCorrect = isCorrect;
    this.state = 'movement';
    this.hazardElapsedMs = 0;
    this.pendingSetback = 0;
    this.pendingDeath = null;
    this.waveResolved = this.currentHazard.waves.map(() => false);
    this.movementDurationMs = this.currentHazard.waves[this.currentHazard.waves.length - 1].impactMs
      + this.currentHazard.safeWindowMs
      + 620;

    if (action) {
      this.slotCooldowns[action.slotId] = Math.max(this.slotCooldowns[action.slotId] || 0, action.slotDef.successCooldownMs || 0);
      if (action.activateShield) {
        this.shieldCharges = 1;
        this.shieldExpiresAt = performance.now() + SHIELD_DURATION_MS;
      }
      if (action.clearView) {
        this.cameraObscurity = clamp(this.cameraObscurity - CLEAR_VIEW_RECOVERY, 0, 100);
        this.clearViewUntil = performance.now() + CLEAR_VIEW_BUFF_MS;
      }
      if (action.slotId === 'step' || action.slotId === 'surge') {
        this.desiredLane = action.targetLane;
        this.motionProfile = action.profile;
        this.lateralVelocity += action.impulse;
      }
      this._queueMessage(`${action.slotDef.bonusLabel} is in play.`);
    } else {
      this.desiredLane = this.currentLane;
      this.motionProfile = { omega: 8.5, zeta: 0.64 };
      this._queueMessage('No bonus. The mountain still moves.');
    }

    this._updateUi();
  }

  _tick(timestamp) {
    if (!this.isActive) {
      return;
    }

    const deltaMs = Math.min(48, timestamp - this.lastFrameAt || 16);
    this.lastFrameAt = timestamp;
    const deltaSeconds = deltaMs / 1000;

    this._updateMotion(deltaSeconds);
    this._updateVisibility(deltaSeconds, timestamp);

    if (this.state === 'movement') {
      this._updateMovement(deltaMs, timestamp);
    }

    this.visualProgressUnits = lerp(this.visualProgressUnits, this.completedSegments, clamp(deltaMs / 180, 0, 1));
    this.renderer.render(this._buildSnapshot(timestamp), deltaSeconds);
    this._updateUi();

    if (this.isActive) {
      this.loopHandle = requestAnimationFrame(this._tick);
    }
  }

  _updateMotion(deltaSeconds) {
    const targetX = LANE_WORLD_X[this.desiredLane];
    const omega = this.motionProfile.omega;
    const zeta = this.motionProfile.zeta;
    const displacement = this.lateralOffset - targetX;
    const acceleration = -((omega * omega) * displacement) - ((2 * zeta * omega) * this.lateralVelocity);

    this.lateralVelocity += acceleration * deltaSeconds;
    this.lateralOffset += this.lateralVelocity * deltaSeconds;

    if (Math.abs(this.lateralVelocity) < 0.001 && Math.abs(displacement) < 0.002) {
      this.lateralOffset = targetX;
      this.lateralVelocity = 0;
    }
  }

  _updateVisibility(deltaSeconds, timestamp) {
    const passiveRecovery = this.clearViewUntil > timestamp ? 2.0 : 0.45;
    this.cameraObscurity = clamp(this.cameraObscurity - (passiveRecovery * deltaSeconds), 0, 100);

    if (this.shieldCharges > 0 && this.shieldExpiresAt <= timestamp) {
      this.shieldCharges = 0;
    }
  }

  _updateMovement(deltaMs, timestamp) {
    this.hazardElapsedMs += deltaMs;
    this.cameraObscurity = clamp(
      this.cameraObscurity + (this.currentHazard.passiveObscurityPerSecond * (deltaMs / 1000) * (this.clearViewUntil > timestamp ? 0.45 : 1)),
      0,
      100
    );

    this.currentHazard.waves.forEach((wave, index) => {
      if (this.waveResolved[index]) {
        return;
      }

      if (wave.kind === 'rock') {
        const inWindow = this.hazardElapsedMs >= wave.impactMs && this.hazardElapsedMs <= wave.impactMs + wave.lingerMs;
        if (inWindow && this._isTouchingHazardLane(wave)) {
          this.pendingDeath = {
            title: 'Hit by rockfall',
            message: 'A rolling stone caught the climber on the rope.'
          };
          this.waveResolved[index] = true;
          return;
        }

        if (this.hazardElapsedMs > wave.impactMs + wave.lingerMs) {
          this.waveResolved[index] = true;
        }
        return;
      }

      if (this.hazardElapsedMs < wave.impactMs) {
        return;
      }

      let avoided = Boolean(this.currentAction?.hardEvade);
      if (!avoided && this.shieldCharges > 0 && this.shieldExpiresAt > timestamp) {
        avoided = true;
        this.shieldCharges = 0;
      }

      this.cameraObscurity = clamp(this.cameraObscurity + (avoided ? 8 : 18), 0, 100);
      if (!avoided) {
        this.pendingSetback = AVALANCHE_SETBACK_SEGMENTS;
      }
      this.waveResolved[index] = true;
    });

    if (this.pendingDeath) {
      this.state = 'dead';
      this._setTimer(() => this._finishLose(), 1100);
      return;
    }

    if (this.hazardElapsedMs >= this.movementDurationMs && this.waveResolved.every(Boolean)) {
      this._completeTurn();
    }
  }

  _isTouchingHazardLane(wave) {
    return wave.lanes.some((lane) => Math.abs(this.lateralOffset - LANE_WORLD_X[lane]) < (wave.hitRadius || ROCK_HIT_RADIUS));
  }

  _completeTurn() {
    this._tickCooldowns(this.movementDurationMs);

    if (this.currentTurnCorrect) {
      const gained = BASE_ASCENT_SEGMENTS + (this.currentAction?.extraSegments || 0);
      this.currentLevelProgress += gained;
      this.completedSegments += gained;
      this.stats.survivedTurns += 1;
      this._queueMessage(`Climb gained: +${gained} segment${gained > 1 ? 's' : ''}.`);
    } else {
      this._queueMessage('The hazard passes, but the climb does not advance.');
    }

    if (this.pendingSetback > 0) {
      const actualSetback = Math.min(this.pendingSetback, this.currentLevelProgress);
      this.currentLevelProgress -= actualSetback;
      this.completedSegments = Math.max(0, this.completedSegments - actualSetback);
      this._queueMessage('Avalanche impact: -3 segments.', 2200);
    }

    this.currentLane = this._nearestLane();
    this.selectedLane = this.currentLane;
    this.desiredLane = this.currentLane;
    this.currentQuestion = null;
    this.currentSlotId = null;
    this.currentAction = null;
    this.currentTurnCorrect = false;

    if (this.currentLevelProgress >= this.currentLevel.segmentGoal) {
      this._advanceLevel();
      return;
    }

    this._prepareNextTurn();
  }

  _nearestLane() {
    let bestLane = 0;
    let bestDistance = Infinity;
    for (let lane = 0; lane < LANE_WORLD_X.length; lane += 1) {
      const distance = Math.abs(this.lateralOffset - LANE_WORLD_X[lane]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLane = lane;
      }
    }
    return bestLane;
  }

  _tickCooldowns(deltaMs) {
    Object.keys(this.slotCooldowns).forEach((slotId) => {
      this.slotCooldowns[slotId] = Math.max(0, this.slotCooldowns[slotId] - deltaMs);
    });
  }

  _advanceLevel() {
    if (this.currentLevelIndex >= this.levelBlueprints.length - 1) {
      this._finishWin();
      return;
    }

    this.state = 'checkpoint';
    this._showCheckpoint(`${this.currentLevel.name} cleared.`);
    this._setTimer(() => {
      this.currentLevelIndex += 1;
      this.currentLevel = this.levelBlueprints[this.currentLevelIndex];
      this.currentLevelProgress = 0;
      this._prepareNextTurn();
    }, 1600);
  }

  _finishWin() {
    this.isActive = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = 0;
    }

    if (this.callbacks.onWin) {
      this.callbacks.onWin(this._buildStatsPayload());
    }
  }

  _finishLose() {
    this.isActive = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = 0;
    }

    if (this.callbacks.onLose) {
      this.callbacks.onLose({
        ...this._buildStatsPayload(),
        reason: this.pendingDeath?.title || 'Fall',
        message: this.pendingDeath?.message || 'The mountain won this exchange.'
      });
    }
  }

  _buildStatsPayload() {
    const accuracy = this.stats.answered
      ? Math.round((this.stats.correct / this.stats.answered) * 100)
      : 0;

    return {
      playerName: this.settings.playerName,
      runName: this.settings.runName,
      levelReached: this.currentLevel?.name || '',
      altitudePercent: Math.round((this.completedSegments / Math.max(1, this.totalGoalSegments)) * 100),
      answered: this.stats.answered,
      correct: this.stats.correct,
      accuracy,
      segments: this.completedSegments
    };
  }

  _buildSnapshot(timestamp) {
    return {
      state: this.state,
      level: this.currentLevel,
      levelIndex: this.currentLevelIndex,
      currentLane: this.currentLane,
      selectedLane: this.selectedLane,
      desiredLane: this.desiredLane,
      lateralOffset: this.lateralOffset,
      lateralVelocity: this.lateralVelocity,
      hazard: this.currentHazard,
      hazardSignature: this.currentHazardSignature,
      hazardElapsedMs: this.hazardElapsedMs,
      movementDurationMs: this.movementDurationMs,
      visualProgressUnits: this.visualProgressUnits,
      completedSegments: this.completedSegments,
      totalGoalSegments: this.totalGoalSegments,
      cameraObscurity: this.cameraObscurity,
      biomeMix: this.currentLevel?.biomeMix || 0,
      stormStrength: this.currentLevel?.stormStrength || 0,
      ashStrength: this.currentLevel?.ashStrength || 0,
      shieldActive: this.shieldCharges > 0 && this.shieldExpiresAt > timestamp,
      clearViewActive: this.clearViewUntil > timestamp
    };
  }

  _showQuestion(question) {
    if (!question) {
      this.ui.questionPanel.classList.add('hidden');
      this.ui.questionFeedback.textContent = '';
      this.ui.questionOptions.innerHTML = '';
      return;
    }

    this.ui.questionPanel.classList.remove('hidden');
    this.ui.questionKicker.textContent = question.slotDef.bonusLabel;
    this.ui.questionTitle.textContent = question.grammarTopic;
    this.ui.questionLevel.textContent = question.level;
    this.ui.questionText.textContent = question.text;
    this.ui.questionDisplay.textContent = question.display;
    this.ui.questionFeedback.textContent = '';
    this.ui.questionOptions.innerHTML = '';

    question.options.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.className = 'question-option';
      button.innerHTML = `<strong>${index + 1}.</strong> ${option}`;
      button.addEventListener('click', () => this.answerQuestion(index));
      this.ui.questionOptions.appendChild(button);
    });
  }

  _updateUi() {
    if (!this.currentLevel) {
      return;
    }

    const accuracy = this.stats.answered
      ? Math.round((this.stats.correct / this.stats.answered) * 100)
      : 0;

    this.ui.levelName.textContent = this.currentLevel.name;
    this.ui.runNameDisplay.textContent = this.settings.runName || 'Untitled Ascent';
    this.ui.lexicalTopicDisplay.textContent = this.settings.lexicalTopic || 'Theme';
    this.ui.altitudeDisplay.textContent = `${Math.round((this.completedSegments / Math.max(1, this.totalGoalSegments)) * 100)}%`;
    this.ui.progressDisplay.textContent = `${clamp(this.currentLevelProgress, 0, this.currentLevel.segmentGoal)} / ${this.currentLevel.segmentGoal}`;
    this.ui.visibilityDisplay.textContent = describeVisibility(this.cameraObscurity);
    this.ui.accuracyDisplay.textContent = `${accuracy}%`;

    this.ui.hazardTitle.textContent = this.currentHazard?.name || 'No hazard';
    this.ui.hazardDescription.textContent = this.currentHazard?.description || '';
    this.ui.hazardLanes.innerHTML = '';
    if (this.currentHazard) {
      for (let lane = 0; lane < 3; lane += 1) {
        const chip = document.createElement('div');
        const isDanger = this.currentHazard.waves.some((wave) => wave.lanes.includes(lane));
        chip.className = `hazard-chip ${isDanger ? 'danger' : 'safe'}`;
        chip.textContent = `${laneName(lane)} ${isDanger ? 'unsafe' : 'safe'}`;
        this.ui.hazardLanes.appendChild(chip);
      }
    }

    this.ui.effectChips.innerHTML = '';
    const effects = [
      `Current lane: ${laneName(this.currentLane)}`,
      `Target lane: ${laneName(this.selectedLane)}`
    ];
    if (this.shieldCharges > 0) {
      effects.push('Snow shield active');
    }
    if (this.clearViewUntil > performance.now()) {
      effects.push('Lens cleaning active');
    }
    effects.forEach((effect) => {
      const chip = document.createElement('div');
      chip.className = 'effect-chip';
      chip.textContent = effect;
      this.ui.effectChips.appendChild(chip);
    });

    this.ui.cooldownChips.innerHTML = '';
    (this.settings.slotConfigs || []).forEach((slotConfig) => {
      const chip = document.createElement('div');
      const cooldown = this.slotCooldowns[slotConfig.slotDef.id] || 0;
      chip.className = `cooldown-chip ${cooldown > 0 ? 'cooling' : 'ready'}`;
      chip.textContent = `${slotConfig.slotDef.bonusLabel}: ${cooldown > 0 ? formatCooldown(cooldown) : 'ready'}`;
      this.ui.cooldownChips.appendChild(chip);
    });

    this.ui.laneButtons.forEach((button) => {
      button.classList.toggle('selected', Number(button.dataset.lane) === this.selectedLane);
      button.disabled = this.state !== 'telegraph';
    });

    this.slotButtonNodes.forEach((entry, index) => {
      const { button, slotConfig } = entry;
      const cooldown = this.slotCooldowns[slotConfig.slotDef.id] || 0;
      const coolingSuffix = cooldown > 0 ? ` (${formatCooldown(cooldown)})` : '';
      button.classList.toggle('active', this.currentSlotId === slotConfig.slotDef.id);
      button.disabled = this.state !== 'telegraph' || cooldown > 0;
      button.innerHTML = `
        <div class="slot-key">${index + 1}</div>
        <div class="slot-bonus-name">${slotConfig.slotDef.bonusLabel}${coolingSuffix}</div>
        <div class="slot-topic-name">${slotConfig.grammarTopic}</div>
      `;
    });

    this.ui.lensOverlay.style.opacity = String(clamp(this.cameraObscurity / 100, 0, 0.88));
    this.ui.stormOverlay.style.opacity = String(clamp((this.currentLevel.stormStrength * 0.45) + (this.cameraObscurity / 180), 0.12, 0.86));
  }

  _handleKeyDown(event) {
    if (!this.isActive) {
      return;
    }

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    if (this.state === 'telegraph') {
      const laneMap = { a: 0, A: 0, s: 1, S: 1, d: 2, D: 2 };
      if (laneMap[event.key] !== undefined) {
        event.preventDefault();
        this.selectLane(laneMap[event.key]);
        return;
      }

      const slotIndex = parseInt(event.key, 10) - 1;
      if (slotIndex >= 0 && slotIndex < this.slotButtonNodes.length) {
        event.preventDefault();
        this.selectSlot(this.slotButtonNodes[slotIndex].slotConfig.slotDef.id);
      }
      return;
    }

    if (this.state === 'question') {
      const optionIndex = parseInt(event.key, 10) - 1;
      if (optionIndex >= 0 && optionIndex < 4) {
        event.preventDefault();
        this.answerQuestion(optionIndex);
      }
    }
  }
}
