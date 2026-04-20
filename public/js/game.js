const BAND_POSITIONS = [-1.12, 0, 1.12];
const SUMMIT_PROGRESS_GOAL = 42;
const INITIAL_MOVE_CHARGES = 2;
const MAX_MOVE_CHARGES = 9;
const MOVE_DURATION_MS = 260;
const SIDE_PROGRESS_GAIN = 0.46;
const UP_PROGRESS_GAIN = 1.08;
const ROCK_SPAWN_MIN_MS = 320;
const ROCK_SPAWN_MAX_MS = 860;
const ROCK_START_OFFSET_MIN = 12;
const ROCK_START_OFFSET_MAX = 16;
const ROCK_COLLISION_PROGRESS_WINDOW = 0.62;
const ROCK_COLLISION_LATERAL_WINDOW = 0.54;
const UI_REFRESH_MS = 120;
const TOAST_DEFAULT_MS = 1700;

class Game {
  constructor() {
    this.renderer = null;
    this.questionManager = null;
    this.callbacks = {};
    this.loopHandle = 0;
    this.pendingTimers = new Set();
    this.lastFrameAt = 0;
    this.uiDirty = true;
    this.nextUiRefreshAt = 0;
    this.lastToastAt = 0;

    this._tick = this._tick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);

    this.ui = this._cacheUi();
    this._bindUi();
  }

  _cacheUi() {
    return {
      canvas: document.getElementById('game-canvas'),
      toast: document.getElementById('toast'),
      distanceDisplay: document.getElementById('distance-display'),
      movesDisplay: document.getElementById('moves-display'),
      accuracyDisplay: document.getElementById('accuracy-display'),
      pressureDisplay: document.getElementById('pressure-display'),
      sessionThemeBar: document.getElementById('session-theme-bar'),
      questionCard: document.getElementById('question-card'),
      questionTheme: document.getElementById('question-theme'),
      questionTitle: document.getElementById('question-title'),
      questionLevel: document.getElementById('question-level'),
      questionText: document.getElementById('question-text'),
      questionDisplay: document.getElementById('question-display'),
      questionOptions: document.getElementById('question-options'),
      questionFeedback: document.getElementById('question-feedback'),
      moveButtons: Array.from(document.querySelectorAll('.move-btn')),
      moveHint: document.getElementById('move-hint')
    };
  }

  _bindUi() {
    this.ui.moveButtons.forEach((button) => {
      const direction = button.dataset.direction;
      this._bindFastPress(button, () => this.spendMove(direction));
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
    this.questionManager = QuestionManager.forSettings({
      langLevel: settings.langLevel || DEFAULT_CEFR_LEVEL,
      lexicalTheme: settings.lexicalTheme,
      sessionTopics: settings.sessionTopics || []
    });
    this.lexicalTheme = this.questionManager.lexicalTheme;
    await this.questionManager.prefetchAll();

    this.renderer = new MountainRenderer(this.ui.canvas);
    this.isActive = true;
    this.state = 'running';
    this.lastFrameAt = performance.now();

    this.currentQuestion = null;
    this.currentQuestionSerial = 0;
    this.currentQuestionTopicId = null;
    this.questionLocked = false;

    this.playerBandIndex = 1;
    this.playerLateral = BAND_POSITIONS[this.playerBandIndex];
    this.playerProgress = 0;
    this.playerLateralVelocity = 0;
    this.currentMove = null;
    this.moveQueue = [];
    this.moveCharges = INITIAL_MOVE_CHARGES;

    this.rocks = [];
    this.scheduledRocks = [];
    this.nextRockId = 1;
    this.nextPatternInMs = randomBetween(440, 820);
    this.lastPressureLabel = 'редко';

    this.stats = {
      answered: 0,
      correct: 0,
      movesEarned: 0,
      movesSpent: 0
    };

    this.deathStartedAt = 0;

    this._buildSessionButtons();
    this._renderQuestion(null);
    this._queueToast('Камни уже идут. Правильный ответ даёт +1 ход.', 2200);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);
    this.loopHandle = requestAnimationFrame(this._tick);
  }

  destroy() {
    this.isActive = false;
    this.state = 'idle';
    this.currentMove = null;
    this.moveQueue = [];
    this.currentQuestion = null;
    this.currentQuestionSerial = 0;

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

    this.ui.questionCard.classList.add('hidden');
    this.ui.toast.classList.add('hidden');
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

  _buildSessionButtons() {
    this.ui.sessionThemeBar.innerHTML = '';
    this.sessionButtonNodes = (this.settings.sessionTopics || []).map((topicId, index) => {
      const topic = findSessionTopic(topicId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'session-btn';
      button.innerHTML = `
        <div class="session-btn-title">${index + 1}. ${topic.title}</div>
        <div class="session-btn-copy">${topic.blurb}</div>
      `;
      this._bindFastPress(button, () => {
        void this.openQuestion(topicId);
      });
      this.ui.sessionThemeBar.appendChild(button);
      return { button, topicId };
    });
  }

  _queueToast(text, durationMs = TOAST_DEFAULT_MS) {
    this.ui.toast.textContent = text;
    this.ui.toast.classList.remove('hidden');
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.pendingTimers.delete(this.toastTimer);
    }
    this.toastTimer = this._setTimer(() => {
      this.ui.toast.classList.add('hidden');
    }, durationMs);
    this.lastToastAt = performance.now();
  }

  async openQuestion(topicId) {
    if (!this.isActive || this.state !== 'running') {
      return;
    }

    this.currentQuestionTopicId = topicId;
    this.currentQuestionSerial += 1;
    const serial = this.currentQuestionSerial;
    this.currentQuestion = null;
    this.questionLocked = true;
    this._renderQuestionLoading(topicId);
    this._markUiDirty();
    this._refreshUiIfNeeded(performance.now(), true);

    try {
      const question = await this.questionManager.getQuestion(topicId);
      if (!this.isActive || this.state !== 'running' || serial !== this.currentQuestionSerial) {
        return;
      }

      this.currentQuestion = question;
      this.currentQuestionTopicId = topicId;
      this.questionLocked = false;
      this._renderQuestion(question);
      this._markUiDirty();
      this._refreshUiIfNeeded(performance.now(), true);
    } catch (error) {
      console.error('Не удалось получить задание:', error);
      if (!this.isActive || serial !== this.currentQuestionSerial) {
        return;
      }

      this.currentQuestion = null;
      this.currentQuestionTopicId = null;
      this.questionLocked = false;
      this._renderQuestion(null);
      this._queueToast('Не удалось открыть задание. Попробуй тему ещё раз.', 1700);
      this._markUiDirty();
    }
  }

  answerQuestion(optionIndex) {
    if (!this.isActive || this.state !== 'running' || !this.currentQuestion || this.questionLocked) {
      return;
    }

    this.questionLocked = true;
    const serial = this.currentQuestionSerial;
    const isCorrect = optionIndex === this.currentQuestion.options.correctIndex;
    this.questionManager.recordAnswer(this.currentQuestion, isCorrect);

    this.stats.answered += 1;
    if (isCorrect) {
      this.stats.correct += 1;
      this.stats.movesEarned += 1;
      this.moveCharges = Math.min(MAX_MOVE_CHARGES, this.moveCharges + 1);
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
      ? 'Верно. Ход куплен и уже доступен на стрелках.'
      : 'Ошибка. Камни не ждут, а ход не начисляется.';
    this._queueToast(isCorrect ? '+1 ход' : 'Без нового хода', isCorrect ? 1200 : 1500);
    this._markUiDirty();

    this._setTimer(() => {
      if (serial !== this.currentQuestionSerial) {
        return;
      }
      this.currentQuestion = null;
      this.currentQuestionTopicId = null;
      this.questionLocked = false;
      this._renderQuestion(null);
      this._markUiDirty();
    }, isCorrect ? 760 : 920);
  }

  spendMove(direction) {
    if (!this.isActive || this.state !== 'running') {
      return;
    }

    if (this.moveCharges <= 0) {
      if (performance.now() - this.lastToastAt > 700) {
        this._queueToast('Ходы закончились. Открой тему и реши ещё одно задание.', 1600);
      }
      return;
    }

    const previewState = this._getPreviewState();
    const move = this._createMove(direction, previewState.bandIndex, previewState.progress);
    if (!move) {
      if (performance.now() - this.lastToastAt > 700) {
        this._queueToast(direction === 'up' ? 'Вверх можно идти всегда.' : 'Дальше в эту сторону уже некуда.', 1200);
      }
      return;
    }

    this.moveCharges -= 1;
    this.stats.movesSpent += 1;

    if (this.currentMove) {
      this.moveQueue.push(move);
    } else {
      this.currentMove = move;
    }

    this._markUiDirty();
  }

  _getPreviewState() {
    let bandIndex = this.currentMove ? this.currentMove.toBand : this.playerBandIndex;
    let progress = this.currentMove ? this.currentMove.toProgress : this.playerProgress;

    this.moveQueue.forEach((move) => {
      bandIndex = move.toBand;
      progress = move.toProgress;
    });

    return { bandIndex, progress };
  }

  _createMove(direction, bandIndex, progress) {
    if (direction === 'left') {
      if (bandIndex <= 0) {
        return null;
      }
      return {
        direction,
        fromBand: bandIndex,
        toBand: bandIndex - 1,
        fromProgress: progress,
        toProgress: Math.min(SUMMIT_PROGRESS_GOAL, progress + SIDE_PROGRESS_GAIN),
        elapsedMs: 0,
        durationMs: MOVE_DURATION_MS
      };
    }

    if (direction === 'right') {
      if (bandIndex >= BAND_POSITIONS.length - 1) {
        return null;
      }
      return {
        direction,
        fromBand: bandIndex,
        toBand: bandIndex + 1,
        fromProgress: progress,
        toProgress: Math.min(SUMMIT_PROGRESS_GOAL, progress + SIDE_PROGRESS_GAIN),
        elapsedMs: 0,
        durationMs: MOVE_DURATION_MS
      };
    }

    if (direction === 'up') {
      return {
        direction,
        fromBand: bandIndex,
        toBand: bandIndex,
        fromProgress: progress,
        toProgress: Math.min(SUMMIT_PROGRESS_GOAL, progress + UP_PROGRESS_GAIN),
        elapsedMs: 0,
        durationMs: MOVE_DURATION_MS
      };
    }

    return null;
  }

  _tick(timestamp) {
    if (!this.isActive) {
      return;
    }

    const deltaMs = Math.min(48, timestamp - this.lastFrameAt || 16);
    this.lastFrameAt = timestamp;
    const deltaSeconds = deltaMs / 1000;

    if (this.state === 'running') {
      this._updateMove(deltaMs);
      this._updateRockScheduler(deltaMs);
      this._updateScheduledRocks(deltaMs);
      this._updateRocks(deltaSeconds);
      this._checkRockCollisions(timestamp);
      this._checkWinCondition();
    }

    if (this.renderer) {
      this.renderer.render(this._buildSnapshot(timestamp), deltaSeconds);
    }
    this._refreshUiIfNeeded(timestamp);

    if (this.isActive) {
      this.loopHandle = requestAnimationFrame(this._tick);
    }
  }

  _updateMove(deltaMs) {
    const previousLateral = this.playerLateral;

    if (!this.currentMove && this.moveQueue.length) {
      this.currentMove = this.moveQueue.shift();
    }

    if (!this.currentMove) {
      this.playerBandIndex = clamp(this.playerBandIndex, 0, BAND_POSITIONS.length - 1);
      this.playerLateral = BAND_POSITIONS[this.playerBandIndex];
      this.playerLateralVelocity = deltaMs > 0 ? (this.playerLateral - previousLateral) / (deltaMs / 1000) : 0;
      return;
    }

    this.currentMove.elapsedMs += deltaMs;
    const progress = clamp(this.currentMove.elapsedMs / this.currentMove.durationMs, 0, 1);
    const eased = 0.5 - (Math.cos(Math.PI * progress) * 0.5);

    this.playerBandIndex = this.currentMove.toBand;
    this.playerLateral = this._lerp(BAND_POSITIONS[this.currentMove.fromBand], BAND_POSITIONS[this.currentMove.toBand], eased);
    this.playerProgress = this._lerp(this.currentMove.fromProgress, this.currentMove.toProgress, eased);
    this.playerLateralVelocity = deltaMs > 0 ? (this.playerLateral - previousLateral) / (deltaMs / 1000) : 0;

    if (progress >= 1) {
      this.playerLateral = BAND_POSITIONS[this.currentMove.toBand];
      this.playerProgress = this.currentMove.toProgress;
      this.currentMove = null;
    }

    this._markUiDirty();
  }

  _updateRockScheduler(deltaMs) {
    const pressureBoost = clamp(this.playerProgress / SUMMIT_PROGRESS_GOAL, 0, 1);
    this.nextPatternInMs -= deltaMs;

    while (this.nextPatternInMs <= 0) {
      this._scheduleRockPattern(pressureBoost);
      this.nextPatternInMs += randomBetween(
        ROCK_SPAWN_MIN_MS * (1 - (pressureBoost * 0.2)),
        ROCK_SPAWN_MAX_MS * (1 - (pressureBoost * 0.12))
      );
    }
  }

  _scheduleRockPattern(pressureBoost) {
    const roll = Math.random();
    const bands = [0, 1, 2];

    if (roll < 0.26) {
      this._scheduleRockEntry(pickRandom(bands), 0, pressureBoost);
      return;
    }

    if (roll < 0.52) {
      shuffleArray(bands).slice(0, 2).forEach((band, index) => {
        this._scheduleRockEntry(band, index * 90, pressureBoost);
      });
      return;
    }

    if (roll < 0.72) {
      const band = pickRandom(bands);
      this._scheduleRockEntry(band, 0, pressureBoost);
      this._scheduleRockEntry(band, randomBetween(160, 260), pressureBoost + 0.05);
      return;
    }

    if (roll < 0.9) {
      const selected = shuffleArray(bands).slice(0, 2);
      this._scheduleRockEntry(selected[0], 0, pressureBoost);
      this._scheduleRockEntry(selected[1], randomBetween(140, 240), pressureBoost);
      this._scheduleRockEntry(selected[0], randomBetween(260, 360), pressureBoost + 0.06);
      return;
    }

    bands.forEach((band, index) => {
      this._scheduleRockEntry(band, index * 80, pressureBoost + 0.08);
    });
  }

  _scheduleRockEntry(bandIndex, delayMs, pressureBoost) {
    this.scheduledRocks.push({
      bandIndex,
      delayMs,
      pressureBoost
    });
  }

  _updateScheduledRocks(deltaMs) {
    this.scheduledRocks.forEach((rock) => {
      rock.delayMs -= deltaMs;
    });

    const ready = this.scheduledRocks.filter((rock) => rock.delayMs <= 0);
    this.scheduledRocks = this.scheduledRocks.filter((rock) => rock.delayMs > 0);
    ready.forEach((entry) => this._spawnRock(entry.bandIndex, entry.pressureBoost));
  }

  _spawnRock(bandIndex, pressureBoost) {
    const baseLateral = BAND_POSITIONS[bandIndex];
    const entryBias = bandIndex === 0 ? -1 : bandIndex === 2 ? 1 : pickRandom([-1, 1]);
    this.rocks.push({
      id: this.nextRockId,
      bandIndex,
      lateral: baseLateral + randomBetween(-0.14, 0.14),
      progress: this.playerProgress + randomBetween(ROCK_START_OFFSET_MIN, ROCK_START_OFFSET_MAX),
      speed: randomBetween(5.2, 7.6) + pressureBoost * 1.6,
      size: randomBetween(0.68, 1.22),
      spinX: randomBetween(1.2, 3.8),
      spinY: randomBetween(1.6, 4.2),
      rotation: randomBetween(0, Math.PI * 2),
      entryBias
    });
    this.nextRockId += 1;
  }

  _updateRocks(deltaSeconds) {
    this.rocks.forEach((rock) => {
      rock.progress -= rock.speed * deltaSeconds;
      rock.rotation += deltaSeconds * rock.spinX;
    });

    this.rocks = this.rocks.filter((rock) => rock.progress > this.playerProgress - 4.6);
    this._markUiDirty();
  }

  _checkRockCollisions(timestamp) {
    const playerLateral = this.playerLateral;
    const playerProgress = this.playerProgress;

    const hit = this.rocks.find((rock) => (
      Math.abs(rock.progress - playerProgress) <= ROCK_COLLISION_PROGRESS_WINDOW
      && Math.abs(rock.lateral - playerLateral) <= ROCK_COLLISION_LATERAL_WINDOW
    ));

    if (!hit) {
      return;
    }

    this.state = 'dead';
    this.deathStartedAt = timestamp;
    this._queueToast('Камень поймал тебя на склоне.', 1800);
    this._markUiDirty();
    this._setTimer(() => this._finishLose(), 1450);
  }

  _checkWinCondition() {
    if (this.playerProgress < SUMMIT_PROGRESS_GOAL || this.state !== 'running') {
      return;
    }

    this.state = 'won';
    this._queueToast('Финиш рядом. Ты вышел на кромку.', 1800);
    this._setTimer(() => this._finishWin(), 900);
  }

  _buildStatsPayload() {
    const accuracy = this.stats.answered
      ? Math.round((this.stats.correct / this.stats.answered) * 100)
      : 0;
    return {
      answered: this.stats.answered,
      correct: this.stats.correct,
      accuracy,
      movesEarned: this.stats.movesEarned,
      movesSpent: this.stats.movesSpent,
      progressPercent: Math.round((this.playerProgress / SUMMIT_PROGRESS_GOAL) * 100)
    };
  }

  _finishWin() {
    if (!this.isActive) {
      return;
    }
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
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = 0;
    }
    if (this.callbacks.onLose) {
      this.callbacks.onLose(this._buildStatsPayload());
    }
  }

  _buildSnapshot(timestamp) {
    const pressureNormalized = this._pressureNormalized();
    return {
      playerProgress: this.playerProgress,
      playerLateral: this.playerLateral,
      playerLateralVelocity: this.playerLateralVelocity,
      progressRatio: clamp(this.playerProgress / SUMMIT_PROGRESS_GOAL, 0, 1),
      summitGoal: SUMMIT_PROGRESS_GOAL,
      moveCharges: this.moveCharges,
      rocks: this.rocks.map((rock) => ({
        id: rock.id,
        lateral: rock.lateral,
        progress: rock.progress,
        size: rock.size,
        rotation: rock.rotation,
        spinX: rock.spinX,
        spinY: rock.spinY,
        entryBias: rock.entryBias
      })),
      isMoving: Boolean(this.currentMove),
      moveDirection: this.currentMove?.direction || this.moveQueue[0]?.direction || null,
      queueLength: this.moveQueue.length,
      pressure: pressureNormalized,
      pressureLabel: this._pressureLabel(),
      themeAccent: this.lexicalTheme.accent,
      isDead: this.state === 'dead',
      deathElapsedMs: this.state === 'dead' ? Math.max(0, timestamp - this.deathStartedAt) : 0
    };
  }

  _renderQuestion(question) {
    if (!question) {
      this.ui.questionCard.classList.add('hidden');
      this.ui.questionTheme.textContent = 'Тема';
      this.ui.questionTitle.textContent = 'Выбери тему сессии';
      this.ui.questionLevel.textContent = this.settings?.langLevel || DEFAULT_CEFR_LEVEL;
      this.ui.questionText.textContent = '';
      this.ui.questionDisplay.textContent = '';
      this.ui.questionOptions.innerHTML = '';
      this.ui.questionFeedback.textContent = '';
      this._markUiDirty();
      return;
    }

    this.ui.questionCard.classList.remove('hidden');
    this.ui.questionTheme.textContent = question.topicTitle;
    this.ui.questionTitle.textContent = 'Задание';
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

  _renderQuestionLoading(topicId) {
    const topic = findSessionTopic(topicId);
    this.ui.questionCard.classList.remove('hidden');
    this.ui.questionTheme.textContent = topic.title;
    this.ui.questionTitle.textContent = 'Подбираю задание';
    this.ui.questionLevel.textContent = this.settings?.langLevel || DEFAULT_CEFR_LEVEL;
    this.ui.questionText.textContent = 'Готовлю следующий вопрос по этой теме.';
    this.ui.questionDisplay.textContent = '...';
    this.ui.questionOptions.innerHTML = '';
    this.ui.questionFeedback.textContent = '';
    this._markUiDirty();
  }

  _pressureNormalized() {
    const nearRocks = this.rocks.filter((rock) => rock.progress > this.playerProgress - 1 && rock.progress < this.playerProgress + 8).length;
    return clamp((nearRocks / 7) + ((ROCK_SPAWN_MAX_MS - this.nextPatternInMs) / ROCK_SPAWN_MAX_MS) * 0.4, 0, 1);
  }

  _pressureLabel() {
    const intensity = this._pressureNormalized();
    if (intensity < 0.28) {
      return 'редко';
    }
    if (intensity < 0.52) {
      return 'рвано';
    }
    if (intensity < 0.78) {
      return 'густо';
    }
    return 'шторм';
  }

  _updateUi() {
    const distanceLeft = Math.max(0, SUMMIT_PROGRESS_GOAL - this.playerProgress);
    const accuracy = this.stats.answered
      ? Math.round((this.stats.correct / this.stats.answered) * 100)
      : 0;
    const pressureLabel = this._pressureLabel();

    this.ui.distanceDisplay.textContent = `${Math.ceil(distanceLeft * 10)} м`;
    this.ui.movesDisplay.textContent = `${this.moveCharges}`;
    this.ui.accuracyDisplay.textContent = `${accuracy}%`;
    this.ui.pressureDisplay.textContent = pressureLabel;
    this.ui.moveHint.textContent = this.moveCharges > 0
      ? 'Можно тратить ход прямо сейчас, даже пока открыт вопрос.'
      : 'Новых ходов нет. Открой тему и заработай следующий.';

    this.sessionButtonNodes.forEach((entry) => {
      entry.button.classList.toggle('active', entry.topicId === this.currentQuestionTopicId);
    });

    this.ui.moveButtons.forEach((button) => {
      const direction = button.dataset.direction;
      const previewState = this._getPreviewState();
      const canMove = this.moveCharges > 0 && Boolean(this._createMove(direction, previewState.bandIndex, previewState.progress));
      button.disabled = !canMove;
      button.classList.toggle('active', this.currentMove?.direction === direction);
    });
  }

  _handleKeyDown(event) {
    if (!this.isActive || this.state !== 'running') {
      return;
    }

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    const moveMap = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowRight: 'right',
      a: 'left',
      A: 'left',
      w: 'up',
      W: 'up',
      d: 'right',
      D: 'right'
    };

    if (moveMap[event.key]) {
      event.preventDefault();
      this.spendMove(moveMap[event.key]);
      return;
    }

    const numberIndex = parseInt(event.key, 10) - 1;
    if (this.currentQuestion) {
      if (numberIndex >= 0 && numberIndex < this.currentQuestion.options.options.length) {
        event.preventDefault();
        this.answerQuestion(numberIndex);
      }
      return;
    }

    if (numberIndex >= 0 && numberIndex < this.sessionButtonNodes.length) {
      event.preventDefault();
      void this.openQuestion(this.sessionButtonNodes[numberIndex].topicId);
    }
  }

  _lerp(start, end, t) {
    return start + ((end - start) * t);
  }
}
