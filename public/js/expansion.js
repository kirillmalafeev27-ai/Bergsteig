(function () {
  if (typeof Game === 'undefined' || typeof BergRenderer === 'undefined' || typeof AudioManager === 'undefined') {
    return;
  }

  const EXT = {
    oxygenCorrectBoost: 9,
    oxygenWrongPenalty: 7,
    oxygenDrainBase: 0.72,
    oxygenDrainAltitude: 1.18,
    oxygenClampMax: 100,
    dawnHoursPerSecond: 0.08,
    summitQuietMinMs: 8500,
    routeSampleCadenceMs: 1000,
    inscriptionsMax: 5,
    ghostRouteMax: 6
  };

  function extClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function extSmoothStep(min, max, value) {
    const x = extClamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unwrapPhrase(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*___\s*/g, ' ')
      .trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function laneKey(lane) {
    if (lane < 0) {
      return 'left';
    }
    if (lane > 0) {
      return 'right';
    }
    return 'center';
  }

  function relicMultiplier(relicId, multipliers) {
    return multipliers[relicId] != null ? multipliers[relicId] : 1;
  }

  function hoursFromDate(date) {
    return date.getHours() + date.getMinutes() / 60;
  }

  function sunlightForHour(hour) {
    const wrapped = ((hour % 24) + 24) % 24;
    if (wrapped >= 21.2 || wrapped <= 4.6) {
      return 0;
    }
    if (wrapped < 6.4) {
      return extSmoothStep(4.6, 6.4, wrapped);
    }
    if (wrapped < 17.8) {
      return 1;
    }
    return 1 - extSmoothStep(17.8, 21.2, wrapped);
  }

  function atmosphericPhaseForHour(hour) {
    const wrapped = ((hour % 24) + 24) % 24;
    return {
      sunlight: sunlightForHour(wrapped),
      dawnGlow: extSmoothStep(4.8, 6.6, wrapped) * (1 - extSmoothStep(6.8, 8.4, wrapped)),
      midnight: wrapped >= 22 || wrapped <= 4.2
    };
  }

  function sessionPhotoCaption(momentType, stats) {
    if (momentType === 'panorama') {
      return `Панорама на ${Math.round(stats.personalPeak || stats.progress || 0)} м`;
    }
    if (momentType === 'streak') {
      return `Серия из ${stats.bestStreak || 0} ответов`;
    }
    if (momentType === 'echo') {
      return 'Редкий отголосок на склоне';
    }
    return 'Лучший момент подъёма';
  }

  function nearestRockAhead(rocks, progress) {
    return (rocks || [])
      .filter((rock) => rock.y >= progress)
      .sort((left, right) => left.y - right.y)[0] || null;
  }

  const originalAudioInit = AudioManager.prototype.init;
  const originalAudioDispose = AudioManager.prototype.dispose;

  AudioManager.prototype.init = function patchedInit() {
    originalAudioInit.call(this);
    if (!this.ctx || this._expansionAudioReady) {
      return;
    }

    this._expansionAudioReady = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.connect(this.masterGain);

    this.musicOscA = this.ctx.createOscillator();
    this.musicOscB = this.ctx.createOscillator();
    this.musicOscA.type = 'triangle';
    this.musicOscB.type = 'sine';
    this.musicOscA.frequency.value = 146.83;
    this.musicOscB.frequency.value = 220;
    this.musicOscA.connect(this.musicGain);
    this.musicOscB.connect(this.musicGain);
    this.musicOscA.start();
    this.musicOscB.start();

    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0.0001;
    this.heartbeatGain.connect(this.masterGain);
    this.lastHeartbeatAt = 0;
    this.oxygenRatio = 1;
  };

  AudioManager.prototype.dispose = function patchedDispose() {
    ['musicOscA', 'musicOscB'].forEach((key) => {
      if (this[key]) {
        try {
          this[key].stop();
        } catch (error) {
          void error;
        }
        try {
          this[key].disconnect();
        } catch (error) {
          void error;
        }
        this[key] = null;
      }
    });
    ['musicGain', 'heartbeatGain'].forEach((key) => {
      if (this[key]) {
        try {
          this[key].disconnect();
        } catch (error) {
          void error;
        }
        this[key] = null;
      }
    });
    this._expansionAudioReady = false;
    originalAudioDispose.call(this);
  };

  AudioManager.prototype.setPhysiology = function setPhysiology(oxygenRatio, serenity) {
    if (!this.ctx || !this._expansionAudioReady) {
      return;
    }

    const oxygen = extClamp(oxygenRatio || 0, 0, 1);
    const musicTarget = extClamp(serenity || 0, 0, 1) * (0.02 + oxygen * 0.025);
    this.musicGain.gain.setTargetAtTime(musicTarget, this.ctx.currentTime, 0.45);
    this.oxygenRatio = oxygen;

    if (oxygen >= 0.34) {
      return;
    }

    const interval = 0.52 + oxygen * 0.55;
    if (this.ctx.currentTime - this.lastHeartbeatAt < interval) {
      return;
    }

    const intensity = 1 - oxygen;
    const t = this.ctx.currentTime;
    const hitA = this.ctx.createOscillator();
    const hitB = this.ctx.createOscillator();
    const hitGainA = this.ctx.createGain();
    const hitGainB = this.ctx.createGain();
    hitA.type = 'sine';
    hitB.type = 'triangle';
    hitA.frequency.setValueAtTime(42, t);
    hitB.frequency.setValueAtTime(64, t + 0.08);
    hitGainA.gain.setValueAtTime(0.0001, t);
    hitGainA.gain.linearRampToValueAtTime(0.045 + intensity * 0.08, t + 0.02);
    hitGainA.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    hitGainB.gain.setValueAtTime(0.0001, t + 0.07);
    hitGainB.gain.linearRampToValueAtTime(0.018 + intensity * 0.05, t + 0.095);
    hitGainB.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    hitA.connect(hitGainA);
    hitB.connect(hitGainB);
    hitGainA.connect(this.heartbeatGain);
    hitGainB.connect(this.heartbeatGain);
    hitA.start(t);
    hitB.start(t + 0.07);
    hitA.stop(t + 0.2);
    hitB.stop(t + 0.24);
    this.lastHeartbeatAt = t;
  };

  const originalCacheUi = Game.prototype._cacheUi;
  Game.prototype._cacheUi = function patchedCacheUi() {
    const ui = originalCacheUi.call(this);
    ui.oxygenText = document.getElementById('oxygen-text');
    ui.oxygenSubtext = document.getElementById('oxygen-subtext');
    ui.companionText = document.getElementById('companion-text');
    ui.companionSubtext = document.getElementById('companion-subtext');
    ui.environmentVignette = document.getElementById('environment-vignette');
    ui.summitOverlay = document.getElementById('summit-overlay');
    return ui;
  };

  const originalBindUi = Game.prototype._bindUi;
  Game.prototype._bindUi = function patchedBindUi() {
    originalBindUi.call(this);
    if (this._expansionKeyListenerBound) {
      return;
    }
    this._expansionKeyListenerBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (this.summitView && this.summitView.active) {
        event.preventDefault();
        this._finishSummitView();
      }
    });
  };

  const originalGameInit = Game.prototype.init;
  Game.prototype.init = async function patchedInit(settings) {
    this.relic = settings.relic || BERG_MEMORY.getSelectedRelic();
    this.sessionProfile = settings.memoryProfile || BERG_MEMORY.loadProfile();
    this.oxygen = { value: 100 };
    this.bestStreak = 0;
    this.bestMoment = null;
    this.routeLog = [];
    this.nextRouteSampleAt = Number.POSITIVE_INFINITY;
    this.dynamicSummitHeight = 94;
    this.summitCloud = 0.34;
    this.summitView = {
      active: false,
      startedAt: 0
    };
    this.liveCarvings = [];
    this.memoryInscriptions = (this.sessionProfile.journal || []).slice(0, EXT.inscriptionsMax).map((entry, index) => ({
      id: `memory-inscription-${index}`,
      phrase: entry.phrase,
      translation: entry.translation,
      progress: 22 + index * 24,
      lane: index % 2 === 0 ? -1 : 1,
      persistent: true
    }));
    this.memoryMarkers = (this.sessionProfile.markers || []).slice(0, 10);
    this.memoryCairns = (this.sessionProfile.cairns || []).slice(0, 8);
    this.activeEcho = this.sessionProfile.activeEcho || null;
    this.compassLaneHint = null;
    this.companion = {
      available: !this.sessionProfile.companionLost,
      mistakes: 0,
      falling: false,
      lost: false,
      fallStartedAt: 0
    };
    this.extraLifeAvailable = this.relic.id === 'photo';
    this.cairnBuilt = false;
    this.persistedSession = false;
    this.sessionPhraseCandidate = null;
    this.sessionFallMarker = null;
    this.sessionScratchMarker = null;
    this.sessionPeakLane = 0;
    this.sessionStartedRealHour = hoursFromDate(new Date());
    this.sessionDayPhase = atmosphericPhaseForHour(this.sessionStartedRealHour);
    this.nextEchoMessageAt = Number.POSITIVE_INFINITY;
    this._echoMessageShown = false;
    this.ghostRoutes = [];

    // Base init renders HUD and one frame synchronously, so all patched fields
    // above must exist before control enters the original initializer.
    await originalGameInit.call(this, settings);

    this.nextRouteSampleAt = this.currentTime;
    this.nextEchoMessageAt = this.currentTime + 1200;
    this.sessionPeakLane = this.player ? this.player.baseLane : 0;

    if (this.ui.environmentVignette) {
      this.ui.environmentVignette.style.setProperty('--oxygen-tunnel', '0');
      this.ui.environmentVignette.style.setProperty('--oxygen-bleach', '0');
      this.ui.environmentVignette.style.setProperty('--dawn-glow', this.sessionDayPhase.dawnGlow.toFixed(3));
    }
    if (this.ui.summitOverlay) {
      this.ui.summitOverlay.classList.add('hidden');
    }
    document.body.classList.remove('summit-view');
    this._recordRouteSample(true);
    this._fetchGhostRoutes();
  };

  Game.prototype._recordRouteSample = function _recordRouteSample(force = false) {
    if (!force && this.currentTime < this.nextRouteSampleAt) {
      return;
    }
    this.routeLog.push({
      t: Math.round((this.currentTime - this.startedAt) / 1000),
      progress: Number(this.player.progress.toFixed(2)),
      lane: this.player.baseLane
    });
    this.nextRouteSampleAt = this.currentTime + EXT.routeSampleCadenceMs;
  };

  Game.prototype._fetchGhostRoutes = async function _fetchGhostRoutes() {
    const localRoutes = BERG_MEMORY.getGhostRoutes ? BERG_MEMORY.getGhostRoutes() : [];
    this.ghostRoutes = localRoutes.slice(0, EXT.ghostRouteMax);
    try {
      const response = await fetch('/api/ghost-routes');
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const serverRoutes = Array.isArray(payload.routes) ? payload.routes : [];
      const seen = new Set(this.ghostRoutes.map((route) => route.id));
      serverRoutes.forEach((route) => {
        if (!seen.has(route.id)) {
          this.ghostRoutes.push(route);
          seen.add(route.id);
        }
      });
      this.ghostRoutes = this.ghostRoutes.slice(0, EXT.ghostRouteMax);
    } catch (error) {
      console.warn('Ghost routes unavailable:', error);
    }
  };

  Game.prototype._sendRouteLog = async function _sendRouteLog(won) {
    if (!Array.isArray(this.routeLog) || this.routeLog.length < 2) {
      return;
    }
    const routePayload = {
      id: `local-ghost-route-${Date.now()}`,
      createdAt: nowIso(),
      playerName: this.player.name,
      relicId: this.relic && this.relic.id,
      won: Boolean(won),
      durationSeconds: Math.max(1, Math.round((this.currentTime - this.startedAt) / 1000)),
      route: this.routeLog
    };
    if (BERG_MEMORY.recordGhostRoute) {
      BERG_MEMORY.recordGhostRoute(routePayload);
    }
    try {
      await fetch('/api/ghost-routes/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(routePayload)
      });
    } catch (error) {
      console.warn('Ghost route send failed:', error);
    }
  };

  Game.prototype._queueTranslationRequest = async function _queueTranslationRequest() {
    const entries = (this.liveCarvings || [])
      .filter((entry) => entry && entry.phrase)
      .map((entry) => ({
        phrase: entry.phrase,
        translation: entry.translation || '',
        language: this.player.language,
        sourceTopic: this.player.lexicalTopic,
        sourceLevel: this.player.level,
        origin: 'session'
      }));
    if (!entries.length && this.sessionPhraseCandidate) {
      entries.push({
        phrase: this.sessionPhraseCandidate,
        translation: '',
        language: this.player.language,
        sourceTopic: this.player.lexicalTopic,
        sourceLevel: this.player.level,
        origin: 'session'
      });
    }
    if (!entries.length) {
      return;
    }
    entries.forEach((entry) => {
      if (BERG_MEMORY.recordPhrase) {
        BERG_MEMORY.recordPhrase(entry);
      }
    });
    const lastEntry = entries[entries.length - 1];
    BERG_MEMORY.queuePendingPhrase(lastEntry);
    try {
      const response = await fetch('/api/translate-phrase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phrase: lastEntry.phrase,
          language: this.player.language
        })
      });
      if (!response.ok) {
        BERG_MEMORY.completePendingPhrase('');
        return;
      }
      const payload = await response.json();
      if (payload.translation) {
        BERG_MEMORY.completePendingPhrase(payload.translation);
      } else {
        BERG_MEMORY.completePendingPhrase('');
      }
    } catch (error) {
      console.warn('Deferred translation request failed:', error);
      BERG_MEMORY.completePendingPhrase('');
    }
  };

  Game.prototype._captureMoment = function _captureMoment(momentType, score) {
    if (!this.ui || !this.ui.canvas) {
      return;
    }
    if (this.bestMoment && this.bestMoment.score >= score) {
      return;
    }
    try {
      this.bestMoment = {
        score,
        momentType,
        imageDataUrl: this.ui.canvas.toDataURL('image/jpeg', 0.86)
      };
    } catch (error) {
      console.warn('Moment capture failed:', error);
    }
  };

  Game.prototype._persistSessionArtifacts = function _persistSessionArtifacts(won) {
    if (this.persistedSession) {
      return;
    }
    this.persistedSession = true;

    const stats = this._buildResultStats();
    const summary = {
      ...stats,
      personalPeak: Math.max(stats.progress, this.player.progress || 0),
      peakLane: this.sessionPeakLane,
      bestStreak: this.bestStreak,
      companionLost: this.companion && (this.companion.lost || this.companion.falling || this.sessionProfile.companionLost),
      fallMarker: this.sessionFallMarker,
      scratchMarker: this.sessionScratchMarker,
      cairn: this.cairnBuilt
        ? {
          progress: this.cairnBuilt.progress,
          lane: this.cairnBuilt.lane,
          stones: this.cairnBuilt.stones,
          copy: 'Трудный ответ оставил ещё один камень в пирамидке.'
        }
        : null,
      won: Boolean(won),
      relicId: this.relic && this.relic.id
    };

    BERG_MEMORY.recordSessionSummary(summary);
    if (!this.bestMoment) {
      this._captureMoment(won ? 'summit' : 'session', this.player.progress || 0);
    }
    if (this.bestMoment && this.bestMoment.imageDataUrl) {
      BERG_MEMORY.recordPhoto({
        imageDataUrl: this.bestMoment.imageDataUrl,
        caption: sessionPhotoCaption(this.bestMoment.momentType, summary),
        momentType: this.bestMoment.momentType
      });
    }
    this._queueTranslationRequest();
    this._sendRouteLog(won);
  };

  const originalOpenQuestion = Game.prototype.openQuestion;
  Game.prototype.openQuestion = async function patchedOpenQuestion(slotId, direction = 0) {
    this.currentQuestionOpenedAt = this.currentTime;
    return originalOpenQuestion.call(this, slotId, direction);
  };

  const originalAnswerQuestion = Game.prototype.answerQuestion;
  Game.prototype.answerQuestion = function patchedAnswerQuestion(index) {
    const question = this.currentQuestion ? deepClone(this.currentQuestion) : null;
    const correct = Boolean(question && index === question.options.correctIndex);
    originalAnswerQuestion.call(this, index);

    if (!question) {
      return;
    }

    if (correct) {
      this.bestStreak = Math.max(this.bestStreak || 0, this.correctStreak || 0);
      this.oxygen.value = extClamp(
        this.oxygen.value + EXT.oxygenCorrectBoost + (this.relic.id === 'iceaxe' ? 2 : 0),
        0,
        EXT.oxygenClampMax
      );

      const phrase = unwrapPhrase(question.display);
      if (phrase.length >= 12) {
        this.sessionPhraseCandidate = phrase;
        this.liveCarvings.push({
          id: `carving-${Date.now()}-${this.liveCarvings.length}`,
          phrase,
          progress: this.player.progress + 2.5,
          lane: this.player.baseLane,
          translation: ''
        });
        this.liveCarvings = this.liveCarvings.slice(-EXT.inscriptionsMax);
      }

      if (!this.cairnBuilt && this._dangerLevel() > 0.44 && this.player.progress > 18) {
        this.cairnBuilt = {
          progress: this.player.progress + 1.8,
          lane: this.player.baseLane,
          stones: 4
        };
      }

      if (this.correctStreak >= 4) {
        this._captureMoment('streak', this.correctStreak * 10 + this.player.progress);
      }
    } else {
      this.oxygen.value = extClamp(this.oxygen.value - EXT.oxygenWrongPenalty, 0, EXT.oxygenClampMax);
      if (this.companion && this.companion.available && !this.companion.falling && !this.companion.lost) {
        this.companion.mistakes += 1;
        if (this.companion.mistakes >= 3) {
          this.companion.falling = true;
          this.companion.fallStartedAt = this.currentTime;
          this._showMessage('Напарник сорвался и ушёл с горы насовсем.', 2200);
          this._schedule(() => {
            if (this.companion && this.companion.falling) {
              this.companion.lost = true;
            }
          }, 3800);
        } else {
          this._showMessage(`Напарник сорвался с ритма. Ошибок рядом с ним: ${this.companion.mistakes}/3.`, 1800);
        }
      }
    }
  };

  const originalHandleRockHit = Game.prototype._handleRockHit;
  Game.prototype._handleRockHit = function patchedHandleRockHit() {
    if (this.extraLifeAvailable) {
      this.extraLifeAvailable = false;
      this.cleanClimb = false;
      this.sessionScratchMarker = {
        progress: this.player.progress,
        lane: this.player.baseLane
      };
      this.player.climbTarget = Math.max(0, this.player.progress - CLIMB_STEP * 2);
      this.player.progress = Math.max(this.player.climbTarget, this.player.progress - CLIMB_STEP * 0.45);
      this.player.lens = extClamp(this.player.lens + 0.08, 0, 1);
      this.cameraShake = Math.max(this.cameraShake, 0.62);
      this._cancelPanorama(this.currentTime);
      this._closeQuestionPanel();
      this._closeDirectionPanel();
      this.currentQuestion = null;
      this.pendingDirection = null;
      this._showMessage('Фотография удержала тебя на тросе, но гора запомнила удар.', 1900);
      if (this.audio) {
        this.audio.playRockImpact();
      }
      return;
    }

    this.sessionScratchMarker = {
      progress: this.player.progress,
      lane: this.player.baseLane
    };
    this.sessionFallMarker = {
      progress: this.player.progress,
      lane: this.player.baseLane
    };
    this._schedule(() => {
      this._persistSessionArtifacts(false);
    }, 1200);
    originalHandleRockHit.call(this);
  };

  const originalUpdatePlayerPhysics = Game.prototype._updatePlayerPhysics;
  Game.prototype._updatePlayerPhysics = function patchedUpdatePlayerPhysics(dt, now) {
    if (this.summitView && this.summitView.active) {
      this.player.climbing = false;
      this.player.vx *= 0.92;
      return;
    }
    originalUpdatePlayerPhysics.call(this, dt, now);
  };

  const originalUpdateHazards = Game.prototype._updateHazards;
  Game.prototype._updateHazards = function patchedUpdateHazards(dt, now) {
    if (this.summitView && this.summitView.active) {
      return;
    }
    originalUpdateHazards.call(this, dt, now);
  };

  const originalSpawnRockWave = Game.prototype._spawnRockWave;
  Game.prototype._spawnRockWave = function patchedSpawnRockWave(now) {
    originalSpawnRockWave.call(this, now);
    const speedFactor = this.relic.id === 'schnapps' ? 0.86 : 1;
    this.hazards.rocks.forEach((rock) => {
      rock.speed *= speedFactor;
    });
  };

  const originalSpawnAvalanche = Game.prototype._spawnAvalanche;
  Game.prototype._spawnAvalanche = function patchedSpawnAvalanche(now) {
    originalSpawnAvalanche.call(this, now);
    const hazardFactor = this.relic.id === 'photo' ? 1.18 : this.relic.id === 'schnapps' ? 0.9 : 1;
    this.hazards.avalanches.forEach((avalanche) => {
      avalanche.speed *= this.relic.id === 'schnapps' ? 0.9 : 1;
    });
    this.nextAvalancheSpawnAt = now + Math.max(4000, (this.nextAvalancheSpawnAt - now) / hazardFactor);
  };

  const originalApplyBonus = Game.prototype._applyBonus;
  Game.prototype._applyBonus = function patchedApplyBonus(slotId, direction = 0) {
    if (slotId === 'climb' && this.relic.id === 'iceaxe') {
      this.player.climbTarget = extClamp(
        Math.max(this.player.climbTarget, this.player.progress) + CLIMB_STEP,
        0,
        SUMMIT_HEIGHT
      );
    }
    originalApplyBonus.call(this, slotId, direction);
  };

  const originalStartPanorama = Game.prototype._startPanorama;
  Game.prototype._startPanorama = function patchedStartPanorama(now) {
    originalStartPanorama.call(this, now);
    if (!this.panorama || !this.panorama.active) {
      return;
    }
    if (this.relic.id === 'rosary') {
      this.panorama.duration *= 0.82;
    }
  };

  const originalUpdateEnvironment = Game.prototype._updateEnvironment;
  Game.prototype._updateEnvironment = function patchedUpdateEnvironment(dt, now) {
    if (this.activeEcho && now >= this.nextEchoMessageAt && !this._echoMessageShown) {
      this._echoMessageShown = true;
      this._showMessage(this.activeEcho.copy, 2600);
    }

    if (this.summitView && this.summitView.active) {
      this.serenityTarget = 1;
      if (this.audio) {
        this.audio.setPanoramaDuck(1);
      }
      if (now - this.summitView.startedAt >= EXT.summitQuietMinMs) {
        this._finishSummitView();
      }
      return;
    }

    originalUpdateEnvironment.call(this, dt, now);

    const elapsedSec = Math.max(1, (now - this.startedAt) / 1000);
    const pace = this.player.progress / elapsedSec;
    const desiredSummit = extClamp(100 - pace * 5.4 + this.stats.avalanchesHit * 1.4, 86, 100);
    this.dynamicSummitHeight += (desiredSummit - this.dynamicSummitHeight) * (1 - Math.exp(-dt * 1.6));
    this.summitCloud = extClamp((this.dynamicSummitHeight - 86) / 14, 0, 1);

    if (this.player.progress >= this.dynamicSummitHeight) {
      this._handleWin();
      return;
    }

    const altitudeRatio = extClamp(this.player.progress / Math.max(1, this.dynamicSummitHeight), 0, 1);
    const relicDrain = relicMultiplier(this.relic.id, {
      rosary: 0.72,
      iceaxe: 0.9
    });
    const drainPerSecond = (EXT.oxygenDrainBase + altitudeRatio * EXT.oxygenDrainAltitude) * relicDrain;
    this.oxygen.value = extClamp(this.oxygen.value - drainPerSecond * dt, 0, EXT.oxygenClampMax);

    if (this.audio) {
      this.audio.setPhysiology(this.oxygen.value / 100, this.serenity);
    }

    if (this.panorama.active && this.panorama.intensity > 0.92) {
      this._captureMoment('panorama', 100 + this.player.progress);
    }

    const nearestRock = nearestRockAhead(this.hazards.rocks, this.player.progress);
    this.compassLaneHint = this.relic.id === 'compass' && nearestRock ? nearestRock.lane : null;
    this.sessionPeakLane = this.player.baseLane;
    this.sessionDayPhase = atmosphericPhaseForHour(this.sessionStartedRealHour + elapsedSec * EXT.dawnHoursPerSecond);
    this._recordRouteSample();
  };

  const originalUpdateHud = Game.prototype._updateHud;
  Game.prototype._updateHud = function patchedUpdateHud() {
    originalUpdateHud.call(this);
    if (!this.player || !this.ui.oxygenText || !this.ui.environmentVignette) {
      return;
    }

    const oxygenRatio = this.oxygen.value / EXT.oxygenClampMax;
    const tunnel = extClamp((0.34 - oxygenRatio) / 0.34, 0, 1);
    const bleach = extClamp((0.5 - oxygenRatio) / 0.5, 0, 1);
    this.ui.environmentVignette.style.setProperty('--oxygen-tunnel', tunnel.toFixed(3));
    this.ui.environmentVignette.style.setProperty('--oxygen-bleach', bleach.toFixed(3));
    this.ui.environmentVignette.style.setProperty('--dawn-glow', (this.sessionDayPhase && this.sessionDayPhase.dawnGlow || 0).toFixed(3));

    this.ui.altitudeText.textContent = `${Math.round(this.player.progress)} м · пик ≈ ${Math.round(this.dynamicSummitHeight)} м`;

    if (oxygenRatio > 0.7) {
      this.ui.oxygenText.textContent = `${Math.round(this.oxygen.value)}%`;
      this.ui.oxygenSubtext.textContent = 'Воздух ещё держит дыхание ровным.';
    } else if (oxygenRatio > 0.4) {
      this.ui.oxygenText.textContent = `${Math.round(this.oxygen.value)}%`;
      this.ui.oxygenSubtext.textContent = 'Воздух редеет. Каждый верный ответ становится вдохом.';
    } else if (oxygenRatio > 0.15) {
      this.ui.oxygenText.textContent = `${Math.round(this.oxygen.value)}%`;
      this.ui.oxygenSubtext.textContent = 'Цвет выцветает, кадр сужается, пульс идёт в уши.';
    } else {
      this.ui.oxygenText.textContent = `${Math.round(this.oxygen.value)}%`;
      this.ui.oxygenSubtext.textContent = 'Почти пусто. Дышать помогает только правильный ответ.';
    }

    if (!this.companion || !this.ui.companionText) {
      return;
    }
    if (!this.companion.available || this.companion.lost) {
      this.ui.companionText.textContent = 'Ушёл';
      this.ui.companionSubtext.textContent = 'Канат рядом пуст. Напарник больше не вернётся.';
    } else if (this.companion.falling) {
      this.ui.companionText.textContent = 'Срывается';
      this.ui.companionSubtext.textContent = 'Третий промах сорвал его со склона.';
    } else {
      this.ui.companionText.textContent = `${3 - this.companion.mistakes}/3`;
      this.ui.companionSubtext.textContent = 'Пока ты отвечаешь, он держится на соседней линии.';
    }

    if (this.summitView && this.summitView.active) {
      this.ui.topicPanel.classList.add('hidden');
      if (this.ui.summitOverlay) {
        this.ui.summitOverlay.classList.remove('hidden');
      }
      document.body.classList.add('summit-view');
    } else {
      this.ui.topicPanel.classList.remove('hidden');
      if (this.ui.summitOverlay) {
        this.ui.summitOverlay.classList.add('hidden');
      }
      document.body.classList.remove('summit-view');
    }
  };

  const originalUpdateHazardFeed = Game.prototype._updateHazardFeed;
  Game.prototype._updateHazardFeed = function patchedUpdateHazardFeed() {
    originalUpdateHazardFeed.call(this);
    if (this.relic.id === 'compass' && this.compassLaneHint !== null && this.ui.hazardText) {
      this.ui.hazardText.textContent = `Компас тянет в ${laneLabel(this.compassLaneHint).toLowerCase()}: ближайший камень придёт оттуда.`;
    }
    if (this.activeEcho && this.player.progress < 8 && this.ui.hazardText) {
      this.ui.hazardText.textContent = this.activeEcho.copy;
    }
  };

  const originalBuildResultStats = Game.prototype._buildResultStats;
  Game.prototype._buildResultStats = function patchedBuildResultStats() {
    const stats = originalBuildResultStats.call(this);
    stats.personalPeak = Math.max(stats.progress, Math.round(this.player.progress));
    stats.bestStreak = this.bestStreak;
    stats.oxygen = Math.round(this.oxygen.value);
    stats.relicId = this.relic && this.relic.id;
    return stats;
  };

  Game.prototype._handleWin = function patchedHandleWin() {
    if (this.summitView && this.summitView.active) {
      return;
    }
    const summitProgress = Math.max(this.player.progress || 0, this.dynamicSummitHeight || 100);
    this.player.progress = summitProgress;
    this.player.climbTarget = summitProgress;
    this.player.climbing = false;
    this.summitView = {
      active: true,
      startedAt: this.currentTime,
      duration: EXT.summitQuietMinMs
    };
    this.currentQuestion = null;
    this.pendingDirection = null;
    this.hazards.rocks = [];
    this.hazards.avalanches = [];
    this._closeQuestionPanel();
    this._closeDirectionPanel();
    this._renderTopicButtons();
    this.serenityTarget = 1;
    this._captureMoment('panorama', 140 + this.player.progress);
    if (this.audio) {
      this.audio.playWin();
      this.audio.setPanoramaDuck(1);
    }
  };

  Game.prototype._finishSummitView = function _finishSummitView() {
    if (!this.summitView || !this.summitView.active) {
      return;
    }
    this.summitView.active = false;
    this._persistSessionArtifacts(true);
    this.state = 'idle';
    if (this.audio) {
      this.audio.setPanoramaDuck(0);
    }
    if (this.onWin) {
      this.onWin(this._buildResultStats());
    }
  };

  const originalRestartCurrentSession = Game.prototype.restartCurrentSession;
  Game.prototype.restartCurrentSession = async function patchedRestart() {
    document.body.classList.remove('summit-view');
    if (this.ui && this.ui.summitOverlay) {
      this.ui.summitOverlay.classList.add('hidden');
    }
    return originalRestartCurrentSession.call(this);
  };

  const originalDestroy = Game.prototype.destroy;
  Game.prototype.destroy = function patchedDestroy(clearSettings = true) {
    document.body.classList.remove('summit-view');
    if (this.ui && this.ui.summitOverlay) {
      this.ui.summitOverlay.classList.add('hidden');
    }
    return originalDestroy.call(this, clearSettings);
  };

  const originalBuildSnapshot = Game.prototype._buildSnapshot;
  Game.prototype._buildSnapshot = function patchedBuildSnapshot() {
    const snapshot = originalBuildSnapshot.call(this);
    snapshot.oxygen = {
      value: this.oxygen.value,
      ratio: this.oxygen.value / EXT.oxygenClampMax
    };
    snapshot.relicId = this.relic && this.relic.id;
    snapshot.timeOfDay = this.sessionDayPhase || atmosphericPhaseForHour(this.sessionStartedRealHour);
    snapshot.dynamicSummitHeight = this.dynamicSummitHeight;
    snapshot.summitCloud = this.summitCloud;
    snapshot.sessionElapsedSec = Math.max(0, Math.round((this.currentTime - this.startedAt) / 1000));
    snapshot.companion = this.companion ? {
      available: this.companion.available,
      mistakes: this.companion.mistakes,
      falling: this.companion.falling,
      lost: this.companion.lost
    } : null;
    snapshot.memoryMarkers = deepClone(this.memoryMarkers || []);
    snapshot.cairns = deepClone(this.memoryCairns || []);
    snapshot.carvings = deepClone(this.liveCarvings || []);
    snapshot.memoryInscriptions = deepClone(this.memoryInscriptions || []);
    snapshot.ghostRoutes = deepClone(this.ghostRoutes || []);
    snapshot.activeEcho = this.activeEcho || null;
    snapshot.summitView = this.summitView && this.summitView.active
      ? {
        active: true,
        elapsedMs: Math.max(0, this.currentTime - this.summitView.startedAt),
        durationMs: this.summitView.duration || EXT.summitQuietMinMs
      }
      : false;
    return snapshot;
  };

  BergRenderer.prototype._ensureExpansionNodes = function _ensureExpansionNodes() {
    if (this._expansionReady) {
      return;
    }
    this._expansionReady = true;

    this.memoryMarkerGroup = new THREE.Group();
    this.root.add(this.memoryMarkerGroup);
    this.memoryMarkerNodes = new Map();

    this.cairnGroup = new THREE.Group();
    this.root.add(this.cairnGroup);
    this.cairnNodes = new Map();

    this.inscriptionGroup = new THREE.Group();
    this.root.add(this.inscriptionGroup);
    this.inscriptionNodes = new Map();

    this.ghostGroup = new THREE.Group();
    this.root.add(this.ghostGroup);
    this.ghostNodes = new Map();

    this.echoGroup = new THREE.Group();
    this.root.add(this.echoGroup);

    this.summitCloudSprite = new THREE.Sprite(this.materials.cloud.clone());
    this.summitCloudSprite.scale.set(42, 16, 1);
    this.summitCloudSprite.position.set(0, 246, -12);
    this.root.add(this.summitCloudSprite);

    this._buildCompanionNode();
  };

  BergRenderer.prototype._buildCompanionNode = function _buildCompanionNode() {
    if (this.companionGroup) {
      return;
    }
    this.companionGroup = this.playerGroup.clone(true);
    this.companionGroup.scale.multiplyScalar(0.92);
    this.companionGroup.visible = false;
    this.companionGroup.traverse((child) => {
      if (child.isLight) {
        child.visible = false;
      }
      if (child.material && child.material.clone) {
        child.material = child.material.clone();
        if (child.material.color) {
          child.material.color.lerp(new THREE.Color(0x253542), 0.58);
        }
        if (typeof child.material.opacity === 'number') {
          child.material.transparent = true;
          child.material.opacity = Math.min(1, child.material.opacity * 0.72);
        }
      }
    });
    this.root.add(this.companionGroup);

    const tetherGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0xc7d6e1,
      transparent: true,
      opacity: 0.42
    });
    this.companionLine = new THREE.Line(tetherGeom, tetherMat);
    this.root.add(this.companionLine);
  };

  BergRenderer.prototype._buildRenderSnapshot = (function wrapBuildRenderSnapshot(original) {
    return function patchedBuildRenderSnapshot(snapshot) {
      const renderSnapshot = original.call(this, snapshot);
      renderSnapshot.oxygen = snapshot.oxygen || { value: 100, ratio: 1 };
      renderSnapshot.relicId = snapshot.relicId || '';
      renderSnapshot.timeOfDay = snapshot.timeOfDay || { sunlight: 1, dawnGlow: 0, midnight: false };
      renderSnapshot.dynamicSummitHeight = snapshot.dynamicSummitHeight || 100;
      renderSnapshot.summitCloud = snapshot.summitCloud || 0;
      renderSnapshot.sessionElapsedSec = snapshot.sessionElapsedSec || 0;
      renderSnapshot.companion = snapshot.companion || null;
      renderSnapshot.memoryMarkers = snapshot.memoryMarkers || [];
      renderSnapshot.cairns = snapshot.cairns || [];
      renderSnapshot.carvings = snapshot.carvings || [];
      renderSnapshot.memoryInscriptions = snapshot.memoryInscriptions || [];
      renderSnapshot.ghostRoutes = snapshot.ghostRoutes || [];
      renderSnapshot.activeEcho = snapshot.activeEcho || null;
      renderSnapshot.summitView = snapshot.summitView || false;
      return renderSnapshot;
    };
  })(BergRenderer.prototype._buildRenderSnapshot);

  BergRenderer.prototype.render = function patchedRender(snapshot, dt = 0.016) {
    if (!snapshot) {
      return;
    }

    this._ensureExpansionNodes();
    const renderSnapshot = this._buildRenderSnapshot(snapshot);
    this.elapsed += dt;
    this.lastSnapshot = renderSnapshot;
    this._updateEnvironment(renderSnapshot, dt);
    this._updatePlayer(renderSnapshot, dt);
    this._updateRope(renderSnapshot, dt);
    this._updateCouloirFissures(renderSnapshot, dt);
    this._updateHazards(renderSnapshot, dt);
    this._updateFootprints(renderSnapshot);
    this._updateParticles(renderSnapshot, dt);
    this._updateBackdrop(renderSnapshot, dt);
    this._updateExpansion(renderSnapshot, dt);
    this._updateCamera(renderSnapshot, dt);
    this.renderer.render(this.scene, this.camera);
  };

  const originalRendererUpdateEnvironment = BergRenderer.prototype._updateEnvironment;
  BergRenderer.prototype._updateEnvironment = function patchedRendererEnvironment(snapshot, dt) {
    originalRendererUpdateEnvironment.call(this, snapshot, dt);
    const sunlight = snapshot.timeOfDay ? snapshot.timeOfDay.sunlight : 1;
    const dawnGlow = snapshot.timeOfDay ? snapshot.timeOfDay.dawnGlow : 0;
    const oxygenBleach = extClamp(1 - (snapshot.oxygen && snapshot.oxygen.ratio || 1), 0, 1);
    const nightMix = 1 - sunlight;

    this.ambientLight.intensity *= 0.45 + sunlight * 0.55;
    this.keyLight.intensity *= 0.35 + sunlight * 0.7;
    this.fillLight.intensity *= 0.25 + sunlight * 0.75;
    this.headlamp.intensity *= 0.8 + nightMix * 1.7;
    this.scene.fog.near += oxygenBleach * 3;
    this.scene.fog.far -= oxygenBleach * 22;
    this.materials.cliff.color.lerp(new THREE.Color(0xe8dccf), dawnGlow * 0.14);
    this.skyUniforms.horizonColor.value.lerp(new THREE.Color(0xffc29d), dawnGlow * 0.4);
    this.skyUniforms.topColor.value.lerp(new THREE.Color(0x1d2740), nightMix * 0.38);
  };

  const originalRendererUpdateBackdrop = BergRenderer.prototype._updateBackdrop;
  BergRenderer.prototype._updateBackdrop = function patchedRendererBackdrop(snapshot, dt) {
    originalRendererUpdateBackdrop.call(this, snapshot, dt);
    const nightMix = 1 - (snapshot.timeOfDay ? snapshot.timeOfDay.sunlight : 1);
    const dawnGlow = snapshot.timeOfDay ? snapshot.timeOfDay.dawnGlow : 0;
    this.starField.material.opacity = Math.max(this.starField.material.opacity, nightMix * 0.58);
    this.moonDisk.material.opacity = Math.max(this.moonDisk.material.opacity, nightMix * 0.44);
    this.summitCloudSprite.material.opacity = 0.08 + snapshot.summitCloud * 0.36 - dawnGlow * 0.04;
    this.summitCloudSprite.position.y = 242 + snapshot.summitCloud * 9;
    this.summitCloudSprite.position.z = -12 + snapshot.summitCloud * 2;
  };

  BergRenderer.prototype._updateExpansion = function _updateExpansion(snapshot, dt) {
    this._updateCompanion(snapshot, dt);
    this._updateMemoryMarkers(snapshot);
    this._updateCairns(snapshot);
    this._updateInscriptions(snapshot);
    this._updateGhostRoutes(snapshot);
    this._updateEcho(snapshot);
  };

  BergRenderer.prototype._updateCompanion = function _updateCompanion(snapshot) {
    if (!this.companionGroup || !snapshot.companion) {
      return;
    }
    if (!snapshot.companion.available || snapshot.companion.lost) {
      this.companionGroup.visible = false;
      this.companionLine.visible = false;
      return;
    }

    this.companionGroup.visible = true;
    this.companionLine.visible = true;
    const offsetX = (snapshot.player.baseLane <= 0 ? 1 : -1) * 3.8;
    const fallDrop = snapshot.companion.falling ? Math.min(18, (this.elapsed % 6) * 3.2) : 0;
    this.companionGroup.position.set(
      this.playerRender.x + offsetX,
      this.playerRender.y - 0.4 - fallDrop,
      this.playerRender.z + 0.8
    );
    this.companionGroup.rotation.z = -offsetX * 0.03;

    const attr = this.companionLine.geometry.attributes.position;
    attr.setXYZ(0, this.playerRender.x, this.playerRender.y + 1.3, this.playerRender.z + 0.2);
    attr.setXYZ(1, this.companionGroup.position.x, this.companionGroup.position.y + 1.1, this.companionGroup.position.z);
    attr.needsUpdate = true;
  };

  BergRenderer.prototype._createMarkerNode = function _createMarkerNode(marker) {
    const group = new THREE.Group();
    let baseX = laneToX(marker.lane || 0) + (marker.type === 'flag' ? 0.8 : -0.8);
    if (marker.type === 'scratch') {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.9),
        new THREE.MeshBasicMaterial({
          color: 0xbfd8ea,
          transparent: true,
          opacity: 0.46,
          side: THREE.DoubleSide
        })
      );
      group.add(plane);
    } else {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 2.1, 10),
        this.materials.anchorMetal.clone()
      );
      pole.position.y = 0.9;
      group.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(marker.type === 'flag' ? 1.6 : 1.1, marker.type === 'flag' ? 1 : 0.7),
        new THREE.MeshBasicMaterial({
          color: marker.type === 'flag' ? 0xc73a36 : 0xe7f4ff,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide
        })
      );
      flag.position.set(0.7, 1.55, 0.12);
      flag.rotation.y = -0.3;
      group.add(flag);
    }

    const frame = this._surfaceFrame(baseX, this._sceneYFromGameY(marker.progress || 0));
    group.position.set(frame.position.x, frame.position.y, frame.position.z + 0.05);
    group.lookAt(
      frame.position.x + frame.normal.x,
      frame.position.y + frame.normal.y,
      frame.position.z + frame.normal.z
    );
    return group;
  };

  BergRenderer.prototype._updateMemoryMarkers = function _updateMemoryMarkers(snapshot) {
    const keep = new Set();
    (snapshot.memoryMarkers || []).forEach((marker) => {
      keep.add(marker.id);
      let node = this.memoryMarkerNodes.get(marker.id);
      if (!node) {
        node = this._createMarkerNode(marker);
        this.memoryMarkerGroup.add(node);
        this.memoryMarkerNodes.set(marker.id, node);
      }
    });
    Array.from(this.memoryMarkerNodes.entries()).forEach(([id, node]) => {
      if (!keep.has(id)) {
        this.memoryMarkerGroup.remove(node);
        this.memoryMarkerNodes.delete(id);
      }
    });
  };

  BergRenderer.prototype._createCairnNode = function _createCairnNode(cairn) {
    const group = new THREE.Group();
    const stones = Math.max(3, cairn.stones || 4);
    for (let index = 0; index < stones; index += 1) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18 + Math.max(0, stones - index) * 0.02, 0),
        this.materials.rock.clone()
      );
      rock.scale.set(1.1, 0.58, 0.84);
      rock.position.set((index % 2 === 0 ? -1 : 1) * 0.07, index * 0.14, 0);
      group.add(rock);
    }
    const anchor = this._faceAnchor(laneToX(cairn.lane || 0) + 1.4, this._sceneYFromGameY(cairn.progress || 0), 0.04);
    group.position.set(anchor.x, anchor.y, anchor.z + 0.08);
    return group;
  };

  BergRenderer.prototype._updateCairns = function _updateCairns(snapshot) {
    const keep = new Set();
    (snapshot.cairns || []).forEach((cairn) => {
      keep.add(cairn.id);
      let node = this.cairnNodes.get(cairn.id);
      if (!node) {
        node = this._createCairnNode(cairn);
        this.cairnGroup.add(node);
        this.cairnNodes.set(cairn.id, node);
      }
    });
    Array.from(this.cairnNodes.entries()).forEach(([id, node]) => {
      if (!keep.has(id)) {
        this.cairnGroup.remove(node);
        this.cairnNodes.delete(id);
      }
    });
  };

  BergRenderer.prototype._makeInscriptionTexture = function _makeInscriptionTexture(phrase, translation) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1f2730';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d8dde1';
    ctx.font = '700 34px "Palatino Linotype", Georgia, serif';
    ctx.fillText(phrase.slice(0, 72), 28, 88);
    if (translation) {
      ctx.fillStyle = '#aebccc';
      ctx.font = '24px "Trebuchet MS", sans-serif';
      ctx.fillText(translation.slice(0, 96), 28, 144);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  BergRenderer.prototype._createInscriptionNode = function _createInscriptionNode(entry) {
    const texture = this._makeInscriptionTexture(entry.phrase, entry.translation);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: entry.persistent ? 0.92 : 0.74,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.8), material);
    const anchor = this._faceAnchor(laneToX(entry.lane || 0) + (entry.lane < 0 ? -3.1 : 3.1), this._sceneYFromGameY(entry.progress || 0), 0.05);
    mesh.position.set(anchor.x, anchor.y, anchor.z + 0.08);
    mesh.rotation.y = entry.lane < 0 ? 0.16 : -0.16;
    return mesh;
  };

  BergRenderer.prototype._updateInscriptions = function _updateInscriptions(snapshot) {
    const entries = [...(snapshot.memoryInscriptions || []), ...(snapshot.carvings || [])];
    const keep = new Set();
    entries.forEach((entry) => {
      keep.add(entry.id);
      let node = this.inscriptionNodes.get(entry.id);
      if (!node) {
        node = this._createInscriptionNode(entry);
        this.inscriptionGroup.add(node);
        this.inscriptionNodes.set(entry.id, node);
      }
      node.visible = snapshot.player.progressY + 12 >= entry.progress;
    });
    Array.from(this.inscriptionNodes.entries()).forEach(([id, node]) => {
      if (!keep.has(id)) {
        this.inscriptionGroup.remove(node);
        if (node.material.map) {
          node.material.map.dispose();
        }
        node.material.dispose();
        node.geometry.dispose();
        this.inscriptionNodes.delete(id);
      }
    });
  };

  BergRenderer.prototype._createGhostNode = function _createGhostNode(route, index) {
    const group = this.playerGroup.clone(true);
    group.userData.side = index % 2 === 0 ? -1 : 1;
    group.userData.phase = index * 0.7;
    group.traverse((child) => {
      if (child.isLight) {
        child.visible = false;
      }
      if (!child.material) {
        return;
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const ghostMats = materials.map((material) => {
        const clone = material.clone ? material.clone() : material;
        clone.transparent = true;
        clone.depthWrite = false;
        if (clone.color) {
          clone.color.lerp(new THREE.Color(0xcfeaff), 0.72);
        }
        if (typeof clone.opacity === 'number') {
          clone.opacity = Math.min(0.34, Math.max(0.16, clone.opacity * 0.34));
        }
        return clone;
      });
      child.material = Array.isArray(child.material) ? ghostMats : ghostMats[0];
    });
    return group;
  };

  BergRenderer.prototype._routeSampleAt = function _routeSampleAt(route, elapsedSec) {
    if (!route || !Array.isArray(route.route) || route.route.length === 0) {
      return null;
    }
    const points = route.route;
    if (elapsedSec <= points[0].t) {
      return points[0];
    }
    for (let index = 1; index < points.length; index += 1) {
      if (elapsedSec <= points[index].t) {
        const prev = points[index - 1];
        const next = points[index];
        const blend = (elapsedSec - prev.t) / Math.max(1, next.t - prev.t);
        return {
          progress: prev.progress + (next.progress - prev.progress) * blend,
          lane: prev.lane
        };
      }
    }
    return points[points.length - 1];
  };

  BergRenderer.prototype._updateGhostRoutes = function _updateGhostRoutes(snapshot) {
    const keep = new Set();
    (snapshot.ghostRoutes || []).forEach((route, index) => {
      const id = route.id || `ghost-${index}`;
      keep.add(id);
      let node = this.ghostNodes.get(id);
      if (!node) {
        node = this._createGhostNode(route, index);
        this.ghostGroup.add(node);
        this.ghostNodes.set(id, node);
      }

      const point = this._routeSampleAt(route, snapshot.sessionElapsedSec);
      if (!point) {
        node.visible = false;
        return;
      }
      node.visible = true;
      const y = this._sceneYFromGameY(point.progress || 0);
      const side = node.userData.side || 1;
      const laneX = laneToX(point.lane || 0);
      const laneOffset = side * (0.74 + Math.floor(index / 2) * 0.18);
      node.position.set(laneX + laneOffset, y, 1.28 - index * 0.04);
      node.scale.setScalar(0.84 + (route.won ? 0.05 : 0));
      node.rotation.x = -0.18 + Math.sin(this.elapsed * 0.7 + node.userData.phase) * 0.02;
      node.rotation.y = side * 0.1;
      node.rotation.z = side * 0.08;
    });

    Array.from(this.ghostNodes.entries()).forEach(([id, node]) => {
      if (!keep.has(id)) {
        this.ghostGroup.remove(node);
        this.ghostNodes.delete(id);
      }
    });
  };

  BergRenderer.prototype._disposeEchoNode = function _disposeEchoNode() {
    if (!this.echoNode) {
      return;
    }
    this.echoGroup.remove(this.echoNode);
    if (this.echoNode.material && this.echoNode.material.dispose) {
      this.echoNode.material.dispose();
    }
    if (this.echoNode.geometry && this.echoNode.geometry.dispose) {
      this.echoNode.geometry.dispose();
    }
    this.echoNode = null;
    this.echoType = '';
  };

  BergRenderer.prototype._updateEcho = function _updateEcho(snapshot) {
    const echoType = snapshot.activeEcho ? snapshot.activeEcho.type : '';
    if (!echoType) {
      this._disposeEchoNode();
      return;
    }

    if (this.echoNode && this.echoType === echoType) {
      return;
    }

    this._disposeEchoNode();

    if (echoType === 'old-climber') {
      const sprite = new THREE.Sprite(this.materials.halo.clone());
      sprite.material.color.setHex(0xc8d9e8);
      sprite.material.opacity = 0.32;
      sprite.scale.set(3.2, 6.8, 1);
      sprite.position.set(-8.4, this._sceneYFromGameY(28), -2.2);
      this.echoNode = sprite;
    } else if (echoType === 'cave') {
      const glow = new THREE.Sprite(this.materials.halo.clone());
      glow.material.color.setHex(0xffd487);
      glow.material.opacity = 0.38;
      glow.scale.set(6.8, 3.2, 1);
      glow.position.set(10.6, this._sceneYFromGameY(34), -1.6);
      this.echoNode = glow;
    } else if (echoType === 'clear-sky') {
      const glow = new THREE.Sprite(this.materials.halo.clone());
      glow.material.color.setHex(0xdcefff);
      glow.material.opacity = 0.24;
      glow.scale.set(10.6, 4.6, 1);
      glow.position.set(0, this._sceneYFromGameY(46), -10);
      this.echoNode = glow;
    }

    if (this.echoNode) {
      this.echoType = echoType;
      this.echoGroup.add(this.echoNode);
    }
  };
})();
