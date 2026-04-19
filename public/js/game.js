class Game {
  constructor() {
    this.renderer = null;
    this.questionManager = null;
    this.callbacks = {};
    this.loopHandle = 0;
    this.lastFrameAt = 0;
    this.pendingTimers = new Set();
    this.isActive = false;
    this.uiDirty = true;
    this.nextUiRefreshAt = 0;

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
      const lane = Number(button.dataset.lane);
      this._bindFastPress(button, () => this.selectLane(lane));
    });

    document.addEventListener('keydown', this._handleKeyDown);
  }

  _bindFastPress(node, callback) {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      callback();
    });

    node.addEventListener('click', (event) => {
      if (typeof event.detail === 'number' && event.detail > 0) {
        return;
      }
      event.preventDefault();
      callback();
    });
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
    this.cameraObscurity = 6;
    this.clearViewUntil = 0;
    this.shieldCharges = 0;
    this.shieldExpiresAt = 0;
    this.currentHazard = null;
    this.currentHazardSignature = '';
    this.hazardElapsedMs = 0;
    this.movementStartedAt = 0;
    this.movementDurationMs = 0;
    this.waveResolved = [];
    this.currentAction = null;
    this.currentQuestion = null;
    this.currentSlotId = null;
    this.currentTurnCorrect = false;
    this.pendingHazardSetback = 0;
    this.pendingWrongAnswerSetback = 0;
    this.pendingDeath = null;
    this.deathStartedAt = 0;
    this.swingState = null;
    this.questionLocked = false;
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
    this._showQuestion(null);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);

    await Promise.allSettled([this.questionManager.prefetchAll()]);
    this._queueMessage('Each correct answer drives one climb tick. Read the first hazard.');
    this._prepareNextTurn();
    this.loopHandle = requestAnimationFrame(this._tick);
  }

  destroy() {
    this.isActive = false;
    this.questionLocked = false;
    this.swingState = null;
    this.currentHazard = null;
    this.currentHazardSignature = '';

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
    this._markUiDirty();
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
      this._markUiDirty();
    }, durationMs);
    this._markUiDirty();
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
      this._markUiDirty();
    }, 1500);
    this._markUiDirty();
  }

  _markUiDirty() {
    this.uiDirty = true;
  }

  _refreshUiIfNeeded(timestamp = performance.now(), force = false) {
    if (!force && !this.uiDirty && timestamp < this.nextUiRefreshAt) {
      return;
    }
    this._updateUi(timestamp);
    this.uiDirty = false;
    this.nextUiRefreshAt = timestamp + UI_REFRESH_MS;
  }

  _buildSlotButtons() {
    this.ui.slotBar.innerHTML = '';
    this.slotButtonNodes = (this.settings.slotConfigs || []).map((slotConfig, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-btn';

      const keyNode = document.createElement('div');
      keyNode.className = 'slot-key';
      keyNode.textContent = `${index + 1}`;

      const bonusNode = document.createElement('div');
      bonusNode.className = 'slot-bonus-name';

      const topicNode = document.createElement('div');
      topicNode.className = 'slot-topic-name';
      topicNode.textContent = slotConfig.grammarTopic;

      button.append(keyNode, bonusNode, topicNode);
      this._bindFastPress(button, () => {
        this.selectSlot(slotConfig.slotDef.id);
      });

      this.ui.slotBar.appendChild(button);
      return {
        button,
        bonusNode,
        topicNode,
        slotConfig
      };
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
    this.pendingHazardSetback = 0;
    this.pendingWrongAnswerSetback = 0;
    this.pendingDeath = null;
    this.hazardElapsedMs = 0;
    this.movementStartedAt = 0;
    this.movementDurationMs = 0;
    this.waveResolved = this.currentHazard.waves.map(() => false);
    this.swingState = null;
    this.questionLocked = false;
    this.state = 'telegraph';
    this._showQuestion(null);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);
  }

  selectLane(laneIndex) {
    if (!this.isActive || this.state !== 'telegraph') {
      return;
    }
    this.selectedLane = clamp(laneIndex, 0, 2);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);
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
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);
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

    this.ui.questionFeedback.textContent = this._buildAnswerFeedback(slotDef, isCorrect);
    this._markUiDirty();

    const delay = isCorrect ? 620 : 760;
    this._setTimer(() => {
      this.questionLocked = false;
      this._finishQuestion(isCorrect);
    }, delay);
  }

  _buildAnswerFeedback(slotDef, isCorrect) {
    if (isCorrect) {
      return `${slotDef.bonusLabel} triggered. +1 climb tick is locked in.`;
    }

    if (this.currentLevel?.wrongAnswerSetback) {
      return 'Wrong answer. No climb tick, and this level also drags you back by 1.';
    }

    return 'Wrong answer. No climb tick this window.';
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
      swingMode: 'none',
      swingDurationMs: 0,
      swingLambda: 0,
      swingOmega: 0,
      swingImpulse: 0,
      emergencyEvade: false,
      ledgeSide: 0,
      activateShield: false,
      clearView: false,
      cooldownMs: slotDef.successCooldownMs || 0
    };

    if (slotDef.id === 'extraMove') {
      action.extraSegments = EXTRA_MOVE_SEGMENTS;
      return action;
    }

    if (slotDef.id === 'step') {
      action.targetLane = this._resolveStepTarget();
      action.swingMode = 'weak';
      action.swingDurationMs = WEAK_SWING_DURATION_MS;
      action.swingLambda = 2.8;
      action.swingOmega = 7.4;
      action.swingImpulse = this._laneDirection(action.targetLane) * 0.44;
      return action;
    }

    if (slotDef.id === 'surge') {
      action.targetLane = this._resolveSurgeTarget();
      action.swingMode = 'strong';
      action.swingDurationMs = STRONG_SWING_DURATION_MS;
      action.swingLambda = 1.02;
      action.swingOmega = 8.6;
      action.swingImpulse = this._laneDirection(action.targetLane) * 1.48;
      action.emergencyEvade = this.currentHazard?.type === 'avalanche';
      action.ledgeSide = this._resolveLedgeSide(action.targetLane);
      return action;
    }

    if (slotDef.id === 'shield') {
      action.activateShield = true;
      return action;
    }

    if (slotDef.id === 'clear') {
      action.clearView = true;
      action.cooldownMs = this._getClearViewCooldownMs();
      return action;
    }

    return action;
  }

  _getClearViewCooldownMs() {
    return (this.currentLevel?.ashStrength || 0) >= 0.35
      ? CLEAR_VIEW_VOLCANO_COOLDOWN_MS
      : CLEAR_VIEW_COOLDOWN_MS;
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

    return this.currentLane === 2 ? 0 : 2;
  }

  _laneDirection(targetLane, fallback = 1) {
    const safeLane = clamp(targetLane, 0, 2);
    const targetX = LANE_WORLD_X[safeLane];
    return Math.sign(targetX - this.lateralOffset)
      || Math.sign(safeLane - this.currentLane)
      || fallback;
  }

  _resolveLedgeSide(targetLane) {
    const direction = this._laneDirection(targetLane, targetLane >= this.currentLane ? 1 : -1);
    return direction || 1;
  }

  _buildSwingState(action, startedAt) {
    const startX = this.lateralOffset;
    const settleX = LANE_WORLD_X[action?.targetLane ?? this.currentLane];

    if (!action || action.swingMode === 'none') {
      return {
        type: 'hold',
        startedAt,
        settleX,
        totalDurationMs: 0,
        direction: 0
      };
    }

    if (action.swingMode === 'weak') {
      return {
        type: 'damped',
        mode: 'weak',
        startedAt,
        startX,
        settleX,
        impulse: action.swingImpulse,
        lambda: action.swingLambda,
        omega: action.swingOmega,
        totalDurationMs: action.swingDurationMs,
        direction: this._laneDirection(action.targetLane)
      };
    }

    if (action.swingMode === 'strong' && action.emergencyEvade) {
      const impactMs = this.currentHazard?.waves?.[0]?.impactMs || 1500;
      const ledgeEnterDurationMs = 180;
      const ledgeHoldStartMs = Math.max(260, impactMs - Math.floor(EMERGENCY_LEDGE_HOLD_MS * 0.5));
      const ledgeStartMs = Math.max(140, ledgeHoldStartMs - ledgeEnterDurationMs);
      const ledgeHoldEndMs = ledgeHoldStartMs + EMERGENCY_LEDGE_HOLD_MS;
      const ledgeDirection = action.ledgeSide || 1;
      return {
        type: 'ledge',
        mode: 'strong',
        startedAt,
        startX,
        settleX,
        ledgeX: ledgeDirection * OFFSCREEN_LEDGE_X,
        ledgeDirection,
        ledgeStartMs,
        ledgeEnterDurationMs,
        ledgeHoldStartMs,
        ledgeHoldEndMs,
        preloadX: startX + (ledgeDirection * 0.22),
        returnLambda: action.swingLambda,
        returnOmega: action.swingOmega,
        returnImpulse: -ledgeDirection * Math.abs(action.swingImpulse),
        returnDurationMs: action.swingDurationMs,
        totalDurationMs: ledgeHoldEndMs + action.swingDurationMs,
        direction: ledgeDirection
      };
    }

    return {
      type: 'damped',
      mode: 'strong',
      startedAt,
      startX,
      settleX,
      impulse: action.swingImpulse,
      lambda: action.swingLambda,
      omega: action.swingOmega,
      totalDurationMs: action.swingDurationMs,
      direction: this._laneDirection(action.targetLane)
    };
  }

  _sampleSwingOffset(elapsedMs) {
    if (!this.swingState) {
      return LANE_WORLD_X[this.currentLane];
    }

    if (this.swingState.type === 'hold') {
      return this.swingState.settleX;
    }

    if (this.swingState.type === 'damped') {
      return this._sampleDampedSwing(
        this.swingState.startX,
        this.swingState.settleX,
        this.swingState.impulse,
        this.swingState.lambda,
        this.swingState.omega,
        elapsedMs,
        this.swingState.totalDurationMs
      );
    }

    if (elapsedMs < this.swingState.ledgeStartMs) {
      const progress = clamp(elapsedMs / Math.max(this.swingState.ledgeStartMs, 1), 0, 1);
      return lerp(this.swingState.startX, this.swingState.preloadX, this._easeInOutSine(progress));
    }

    if (elapsedMs < this.swingState.ledgeHoldStartMs) {
      const progress = clamp(
        (elapsedMs - this.swingState.ledgeStartMs) / Math.max(this.swingState.ledgeEnterDurationMs, 1),
        0,
        1
      );
      return lerp(this.swingState.preloadX, this.swingState.ledgeX, this._easeOutCubic(progress));
    }

    if (elapsedMs <= this.swingState.ledgeHoldEndMs) {
      return this.swingState.ledgeX;
    }

    return this._sampleDampedSwing(
      this.swingState.ledgeX,
      this.swingState.settleX,
      this.swingState.returnImpulse,
      this.swingState.returnLambda,
      this.swingState.returnOmega,
      elapsedMs - this.swingState.ledgeHoldEndMs,
      this.swingState.returnDurationMs
    );
  }

  _sampleDampedSwing(startX, settleX, impulse, lambda, omega, elapsedMs, durationMs) {
    const cappedMs = clamp(elapsedMs, 0, durationMs);
    const time = cappedMs / 1000;
    const decay = Math.exp(-lambda * time);
    return settleX
      + ((startX - settleX) * decay * Math.cos(omega * time))
      + (impulse * decay * Math.sin(omega * time));
  }

  _easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  _easeInOutSine(value) {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  _isEmergencySafe() {
    return Boolean(
      this.swingState &&
      this.swingState.type === 'ledge' &&
      this.hazardElapsedMs >= this.swingState.ledgeHoldStartMs &&
      this.hazardElapsedMs <= this.swingState.ledgeHoldEndMs
    );
  }

  _startMovement(action, isCorrect) {
    const now = performance.now();

    this.currentAction = action;
    this.currentTurnCorrect = isCorrect;
    this.state = 'movement';
    this.hazardElapsedMs = 0;
    this.movementStartedAt = now;
    this.pendingHazardSetback = 0;
    this.pendingWrongAnswerSetback = isCorrect
      ? 0
      : (this.currentLevel?.wrongAnswerSetback ?? WRONG_ANSWER_SETBACK_SEGMENTS);
    this.pendingDeath = null;
    this.waveResolved = this.currentHazard.waves.map(() => false);
    this.swingState = this._buildSwingState(action, now);
    this.movementDurationMs = Math.max(
      this.currentHazard.waves[this.currentHazard.waves.length - 1].impactMs
        + this.currentHazard.safeWindowMs
        + MOVEMENT_END_BUFFER_MS,
      this.swingState?.totalDurationMs || 0,
      this.currentHazard.type === 'avalanche' ? 1900 : 1500
    );

    if (action) {
      this.slotCooldowns[action.slotId] = Math.max(
        this.slotCooldowns[action.slotId] || 0,
        action.cooldownMs || action.slotDef.successCooldownMs || 0
      );

      if (action.activateShield) {
        this.shieldCharges = 1;
        this.shieldExpiresAt = now + SHIELD_DURATION_MS;
      }

      if (action.clearView) {
        this.cameraObscurity = 0;
        this.clearViewUntil = now + CLEAR_VIEW_BUFF_MS;
      }

      this.desiredLane = action.targetLane;
      this._queueMessage(this._buildActionMessage(action));
    } else {
      this.desiredLane = this.currentLane;
      this._queueMessage(
        this.pendingWrongAnswerSetback > 0
          ? 'Wrong answer. No climb tick, and the rope starts to slip.'
          : 'Wrong answer. No climb tick. The hazard still plays.'
      );
    }

    this._markUiDirty();
    this._refreshUiIfNeeded(now, true);
  }

  _buildActionMessage(action) {
    if (action.slotId === 'extraMove') {
      const totalTicks = BASE_ASCENT_SEGMENTS + action.extraSegments;
      return `Correct answer: +${totalTicks} climb ticks.`;
    }

    if (action.slotId === 'step') {
      return 'Weak swing engaged. One clean lane change, fast recovery.';
    }

    if (action.slotId === 'surge') {
      return action.emergencyEvade
        ? 'Strong swing: breaking onto the side ledge before the avalanche hits.'
        : 'Strong swing engaged. Big reach now, long recoil afterward.';
    }

    if (action.slotId === 'shield') {
      return 'Snow shield armed for the next avalanche.';
    }

    if (action.slotId === 'clear') {
      return 'Lens cleared to zero. Fresh snow or ash starts building again immediately.';
    }

    return `${action.slotDef.bonusLabel} is in play.`;
  }

  _tick(timestamp) {
    if (!this.isActive) {
      return;
    }

    const deltaMs = Math.min(48, timestamp - this.lastFrameAt || 16);
    this.lastFrameAt = timestamp;
    const deltaSeconds = deltaMs / 1000;

    if (this.state === 'movement') {
      this.hazardElapsedMs += deltaMs;
    }

    this._updateMotion(deltaMs);
    this._updateVisibility(timestamp);

    if (this.state === 'movement') {
      this._updateMovement(deltaMs, timestamp);
    }

    this.visualProgressUnits = lerp(this.visualProgressUnits, this.completedSegments, clamp(deltaMs / 180, 0, 1));
    this.renderer.render(this._buildSnapshot(timestamp), deltaSeconds);
    this._refreshUiIfNeeded(timestamp);

    if (this.isActive) {
      this.loopHandle = requestAnimationFrame(this._tick);
    }
  }

  _updateMotion(deltaMs) {
    const previousOffset = this.lateralOffset;

    if (this.state === 'movement') {
      this.lateralOffset = this._sampleSwingOffset(this.hazardElapsedMs);
    } else {
      const settleX = LANE_WORLD_X[this.currentLane];
      this.lateralOffset = lerp(this.lateralOffset, settleX, clamp((deltaMs / 1000) * 8, 0, 1));
      if (Math.abs(this.lateralOffset - settleX) < 0.0005) {
        this.lateralOffset = settleX;
      }
    }

    this.lateralVelocity = deltaMs > 0
      ? (this.lateralOffset - previousOffset) / (deltaMs / 1000)
      : 0;
  }

  _updateVisibility(timestamp) {
    if (this.shieldCharges > 0 && this.shieldExpiresAt <= timestamp) {
      this.shieldCharges = 0;
      this._markUiDirty();
    }
  }

  _updateMovement(deltaMs, timestamp) {
    const buildupMultiplier = this.shieldCharges > 0 && this.shieldExpiresAt > timestamp ? 0.78 : 1;
    this.cameraObscurity = clamp(
      this.cameraObscurity + (this.currentHazard.passiveObscurityPerSecond * (deltaMs / 1000) * buildupMultiplier),
      0,
      100
    );
    this._markUiDirty();

    this.currentHazard.waves.forEach((wave, index) => {
      if (this.waveResolved[index]) {
        return;
      }

      if (wave.kind === 'rock') {
        const inWindow = this.hazardElapsedMs >= wave.impactMs && this.hazardElapsedMs <= wave.impactMs + wave.lingerMs;
        if (inWindow && this._isTouchingHazardLane(wave)) {
          this.pendingDeath = {
            title: 'Hit by rockfall',
            message: 'A rolling stone caught the climber during the swing-back.'
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

      let avoided = this._isEmergencySafe();
      if (!avoided && this.shieldCharges > 0 && this.shieldExpiresAt > timestamp) {
        avoided = true;
        this.shieldCharges = 0;
      }

      this.cameraObscurity = clamp(this.cameraObscurity + (avoided ? 8 : 18), 0, 100);
      if (!avoided) {
        this.pendingHazardSetback = Math.max(this.pendingHazardSetback, AVALANCHE_SETBACK_SEGMENTS);
      }
      this.waveResolved[index] = true;
    });

    if (this.pendingDeath) {
      this.state = 'dead';
      this.deathStartedAt = timestamp;
      this._markUiDirty();
      this._setTimer(() => this._finishLose(), 1400);
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
      this._queueMessage(`Climb tick resolved: +${gained}.`);
    } else {
      this._queueMessage('No correct answer: the mountain moves, you do not.');
    }

    if (this.pendingWrongAnswerSetback > 0) {
      const actualSetback = Math.min(this.pendingWrongAnswerSetback, this.currentLevelProgress);
      this.currentLevelProgress -= actualSetback;
      this.completedSegments = Math.max(0, this.completedSegments - actualSetback);
      if (actualSetback > 0) {
        this._queueMessage(`Wrong-answer penalty: -${actualSetback}.`, 2200);
      }
    }

    if (this.pendingHazardSetback > 0) {
      const actualSetback = Math.min(this.pendingHazardSetback, this.currentLevelProgress);
      this.currentLevelProgress -= actualSetback;
      this.completedSegments = Math.max(0, this.completedSegments - actualSetback);
      if (actualSetback > 0) {
        this._queueMessage(`Avalanche impact: -${actualSetback}.`, 2200);
      }
    }

    if (typeof this.currentAction?.targetLane === 'number') {
      this.currentLane = clamp(this.currentAction.targetLane, 0, 2);
    } else {
      this.currentLane = this._nearestLane();
    }

    this.selectedLane = this.currentLane;
    this.desiredLane = this.currentLane;
    this.lateralOffset = LANE_WORLD_X[this.currentLane];
    this.lateralVelocity = 0;
    this.currentQuestion = null;
    this.currentSlotId = null;
    this.currentAction = null;
    this.currentTurnCorrect = false;
    this.swingState = null;
    this.pendingWrongAnswerSetback = 0;
    this.pendingHazardSetback = 0;
    this.hazardElapsedMs = 0;
    this.movementStartedAt = 0;
    this.movementDurationMs = 0;

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
    this._markUiDirty();
  }

  _advanceLevel() {
    if (this.currentLevelIndex >= this.levelBlueprints.length - 1) {
      this._finishWin();
      return;
    }

    this.state = 'checkpoint';
    this._showCheckpoint(`${this.currentLevel.name} cleared.`);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);

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
      movementProgress: this.movementDurationMs ? clamp(this.hazardElapsedMs / this.movementDurationMs, 0, 1) : 0,
      visualProgressUnits: this.visualProgressUnits,
      completedSegments: this.completedSegments,
      totalGoalSegments: this.totalGoalSegments,
      cameraObscurity: this.cameraObscurity,
      visibilityClarity: getVisibilityClarity(this.cameraObscurity),
      biomeMix: this.currentLevel?.biomeMix || 0,
      stormStrength: this.currentLevel?.stormStrength || 0,
      ashStrength: this.currentLevel?.ashStrength || 0,
      shieldActive: this.shieldCharges > 0 && this.shieldExpiresAt > timestamp,
      clearViewActive: this.clearViewUntil > timestamp,
      swingMode: this.currentAction?.swingMode || 'none',
      swingIntensity: this.currentAction?.swingMode === 'strong' ? 1 : this.currentAction?.swingMode === 'weak' ? 0.45 : 0,
      emergencyLedgeActive: this._isEmergencySafe(),
      ledgeSide: this.swingState?.direction || 0,
      deathElapsedMs: this.state === 'dead' ? Math.max(0, timestamp - this.deathStartedAt) : 0
    };
  }

  _showQuestion(question) {
    if (!question) {
      this.ui.questionPanel.classList.add('hidden');
      this.ui.questionFeedback.textContent = '';
      this.ui.questionOptions.innerHTML = '';
      this._markUiDirty();
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
      button.type = 'button';
      button.className = 'question-option';
      button.innerHTML = `<strong>${index + 1}.</strong> ${option}`;
      this._bindFastPress(button, () => this.answerQuestion(index));
      this.ui.questionOptions.appendChild(button);
    });

    this._markUiDirty();
  }

  _updateUi(timestamp = performance.now()) {
    if (!this.currentLevel) {
      return;
    }

    const accuracy = this.stats.answered
      ? Math.round((this.stats.correct / this.stats.answered) * 100)
      : 0;
    const clarityPercent = Math.round(getVisibilityClarity(this.cameraObscurity) * 100);
    const snowRatio = clamp(this.cameraObscurity / 100, 0, 1);

    this.ui.levelName.textContent = this.currentLevel.name;
    this.ui.runNameDisplay.textContent = this.settings.runName || 'Untitled Ascent';
    this.ui.lexicalTopicDisplay.textContent = this.settings.lexicalTopic || 'Theme';
    this.ui.altitudeDisplay.textContent = `${Math.round((this.completedSegments / Math.max(1, this.totalGoalSegments)) * 100)}%`;
    this.ui.progressDisplay.textContent = `${clamp(this.currentLevelProgress, 0, this.currentLevel.segmentGoal)} / ${this.currentLevel.segmentGoal}`;
    this.ui.visibilityDisplay.textContent = `${describeVisibility(this.cameraObscurity)} ${clarityPercent}%`;
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

    if (this.state === 'movement') {
      effects.push(`Live window: ${(Math.max(0, this.movementDurationMs - this.hazardElapsedMs) / 1000).toFixed(1)}s`);
    }
    if (this.currentAction?.swingMode === 'weak') {
      effects.push('Weak swing settling');
    }
    if (this.currentAction?.swingMode === 'strong') {
      effects.push(this._isEmergencySafe() ? 'Emergency ledge active' : 'Strong swing recoil');
    }
    if (this.shieldCharges > 0) {
      effects.push('Snow shield ready');
    }
    if (this.currentAction?.clearView) {
      effects.push('Lens wiped clean');
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

    this.slotButtonNodes.forEach((entry) => {
      const { button, bonusNode, slotConfig } = entry;
      const cooldown = this.slotCooldowns[slotConfig.slotDef.id] || 0;
      const coolingSuffix = cooldown > 0 ? ` (${formatCooldown(cooldown)})` : '';
      button.classList.toggle('active', this.currentSlotId === slotConfig.slotDef.id);
      button.disabled = this.state !== 'telegraph' || cooldown > 0;
      bonusNode.textContent = `${slotConfig.slotDef.bonusLabel}${coolingSuffix}`;
    });

    this.ui.lensOverlay.style.opacity = String(clamp(Math.pow(snowRatio, 2.15) * 0.9, 0, 0.9));
    this.ui.stormOverlay.style.opacity = String(
      clamp((this.currentLevel.stormStrength * 0.42) + (Math.pow(snowRatio, 1.35) * 0.28), 0.12, 0.86)
    );

    if (this.state === 'telegraph') {
      this.nextUiRefreshAt = timestamp;
    }
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
