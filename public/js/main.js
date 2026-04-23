const STORAGE_KEYS = {
  playerName: 'bergstieg_player_name',
  language: 'bergstieg_language',
  level: 'bergstieg_lang_level',
  lexical: 'bergstieg_lexical_topic',
  slots: 'bergstieg_slot_assignments',
  preset: 'bergstieg_atmosphere_preset',
  muted: 'bergstieg_muted'
};

const DEFAULT_ATMOSPHERE_PRESET = 'classic';
const ATMOSPHERE_PRESETS = [
  {
    id: 'classic',
    title: '\u0428\u0442\u0443\u0440\u043c\u043e\u0432\u043e\u0439 \u043f\u043e\u0434\u044a\u0451\u043c',
    tag: '\u0411\u0430\u0437\u043e\u0432\u044b\u0439',
    teaser: '\u0425\u043e\u043b\u043e\u0434, \u0441\u043d\u0435\u0433 \u0438 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0433\u043e\u0440\u044b',
    copy: '\u041e\u0441\u043d\u043e\u0432\u043d\u0430\u044f \u043a\u0438\u043d\u043e\u0448\u043d\u0430\u044f \u0430\u0442\u043c\u043e\u0441\u0444\u0435\u0440\u0430: \u0445\u043e\u043b\u043e\u0434\u043d\u044b\u0439 \u0441\u0432\u0435\u0442, \u043c\u0435\u0442\u0435\u043b\u044c, \u0442\u0443\u043c\u0430\u043d \u0438 \u0441\u0443\u0440\u043e\u0432\u043e\u0435 \u0432\u043e\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435.'
  },
  {
    id: 'newyear',
    title: '\u041d\u043e\u0432\u043e\u0433\u043e\u0434\u043d\u044f\u044f \u043d\u043e\u0447\u044c',
    tag: '\u041d\u043e\u0432\u044b\u0439',
    teaser: '\u0427\u0451\u0440\u043d\u043e\u0435 \u043d\u0435\u0431\u043e, \u0437\u043e\u043b\u043e\u0442\u044b\u0435 \u0437\u0432\u0451\u0437\u0434\u044b \u0438 \u0444\u043e\u043d\u0430\u0440\u0438 \u043d\u0430 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0435',
    copy: '\u041f\u0440\u0430\u0437\u0434\u043d\u0438\u0447\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0440\u0430\u0441\u0442: \u0447\u0451\u0440\u043d\u043e\u0435 \u043d\u0435\u0431\u043e, \u043b\u0435\u0434\u044f\u043d\u043e-\u0433\u043e\u043b\u0443\u0431\u044b\u0435 \u0433\u043e\u0440\u044b \u0438 \u0442\u0451\u043f\u043b\u043e\u0435 \u0437\u043e\u043b\u043e\u0442\u043e\u0435 \u0441\u0432\u0435\u0447\u0435\u043d\u0438\u0435 \u0444\u043e\u043d\u0430\u0440\u0435\u0439.'
  }
];

function languageStorageKey(key, language) {
  return `${key}_${language}`;
}

function safeStorageGet(key, fallback = '') {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.warn(`Storage read failed for ${key}:`, error);
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Storage write failed for ${key}:`, error);
  }
}

function detectTouchDevice() {
  if (typeof window === 'undefined') {
    return false;
  }
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  return Boolean(coarse || touch);
}

function normalizeAtmospherePreset(preset) {
  return ATMOSPHERE_PRESETS.some((option) => option.id === preset)
    ? preset
    : DEFAULT_ATMOSPHERE_PRESET;
}

document.addEventListener('DOMContentLoaded', () => {
  if (detectTouchDevice()) {
    document.body.classList.add('touch');
  }

  const game = new Game();

  const ui = {
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    winScreen: document.getElementById('win-screen'),
    loseScreen: document.getElementById('lose-screen'),
    languageButtons: document.getElementById('language-buttons'),
    step1Text: document.getElementById('step1-text'),
    playerName: document.getElementById('player-name'),
    levelLabel: document.getElementById('level-label'),
    levelButtons: document.getElementById('level-buttons'),
    presetLabel: document.getElementById('preset-label'),
    presetButtons: document.getElementById('preset-buttons'),
    step2Text: document.getElementById('step2-text'),
    lexicalGrid: document.getElementById('lexical-grid'),
    bonusSlots: document.getElementById('bonus-slots'),
    grammarLabel: document.getElementById('grammar-label'),
    grammarPicker: document.getElementById('grammar-picker'),
    selectionCounter: document.getElementById('selection-counter'),
    startButton: document.getElementById('start-btn'),
    winStats: document.getElementById('win-stats'),
    loseStats: document.getElementById('lose-stats'),
    loseMessage: document.getElementById('lose-message'),
    themeColorMeta: document.querySelector('meta[name="theme-color"]')
  };

  let selectedLanguage = safeStorageGet(STORAGE_KEYS.language, DEFAULT_LANGUAGE) || DEFAULT_LANGUAGE;
  if (!LANGUAGE_OPTIONS.some((option) => option.id === selectedLanguage)) {
    selectedLanguage = DEFAULT_LANGUAGE;
  }
  let selectedAtmospherePreset = normalizeAtmospherePreset(
    safeStorageGet(STORAGE_KEYS.preset, DEFAULT_ATMOSPHERE_PRESET) || DEFAULT_ATMOSPHERE_PRESET
  );
  let selectedLevel = DEFAULT_CEFR_LEVEL;
  let selectedLexical = null;
  let selectedSlotIndex = 0;
  let slotAssignments = [];

  ui.playerName.value = safeStorageGet(STORAGE_KEYS.playerName, '');
  applyAtmospherePreview();
  loadSelectionsForLanguage(selectedLanguage);

  const storedMute = safeStorageGet(STORAGE_KEYS.muted, '0');
  game.setMuted(storedMute === '1');
  game.onMuteChange = (muted) => {
    safeStorageSet(STORAGE_KEYS.muted, muted ? '1' : '0');
  };

  game.onExit = () => {
    game.destroy(false);
    setScreen('menu-screen');
    showStep(stepForCurrentState());
  };

  game.onWin = (stats) => {
    ui.winStats.textContent =
      `${stats.playerName} добрался до вершины. Точность: ${stats.accuracy}%. ` +
      `Ответов: ${stats.correct}/${stats.answers}. Время: ${stats.durationSeconds} сек. ` +
      `Лавины заблокированы: ${stats.avalanchesBlocked}.`;
    setScreen('win-screen');
  };

  game.onLose = (stats) => {
    ui.loseMessage.textContent =
      `Достигнуто: ${stats.progress} м из ${SUMMIT_HEIGHT}. Лавины сбивали назад ${stats.avalanchesHit} раз.`;
    ui.loseStats.textContent =
      `Точность: ${stats.accuracy}%. Верных ответов: ${stats.correct}/${stats.answers}. ` +
      `Удачных уходов от опасностей: ${stats.nearMisses}.`;
    setScreen('lose-screen');
  };

  renderLanguageButtons();
  renderPresetButtons();
  updateSetupCopy();
  renderLevelButtons();
  renderLexicalGrid();
  renderBonusSlots();
  renderGrammarPicker();
  updateSelectionCounter();
  updateStartButton();
  showStep(1);

  document.getElementById('to-step2-btn').addEventListener('click', () => {
    showStep(2);
  });

  document.getElementById('to-step3-btn').addEventListener('click', () => {
    if (!selectedLexical) {
      return;
    }
    showStep(3);
  });

  document.getElementById('back-to-step1').addEventListener('click', () => showStep(1));
  document.getElementById('back-to-step2').addEventListener('click', () => showStep(2));

  document.getElementById('start-btn').addEventListener('click', async () => {
    const settings = buildSettings();
    if (!settings) {
      return;
    }

    safeStorageSet(STORAGE_KEYS.playerName, settings.playerName);
    persistSelectionsForLanguage();

    setScreen('game-screen');
    try {
      await game.init(settings);
    } catch (error) {
      console.error('Game init failed:', error);
      game.destroy(false);
      setScreen('menu-screen');
      window.alert('Не удалось запустить подъём. Перезагрузи страницу и попробуй снова.');
    }
  });

  document.getElementById('win-restart').addEventListener('click', () => {
    game.destroy();
    setScreen('menu-screen');
    showStep(1);
  });

  document.getElementById('lose-restart').addEventListener('click', async () => {
    setScreen('game-screen');
    await game.restartCurrentSession();
  });

  document.getElementById('lose-menu').addEventListener('click', () => {
    game.destroy(false);
    setScreen('menu-screen');
    showStep(1);
  });

  function stepForCurrentState() {
    if (!selectedLexical) {
      return 2;
    }
    if (slotAssignments.some((slot) => !slot)) {
      return 3;
    }
    return 3;
  }

  function showStep(step) {
    [1, 2, 3].forEach((stepNumber) => {
      const node = document.getElementById(`setup-step${stepNumber}`);
      node.classList.toggle('hidden', stepNumber !== step);
      const dot = document.querySelector(`[data-step-dot="${stepNumber}"]`);
      if (dot) {
        dot.classList.toggle('active', stepNumber === step);
      }
    });
  }

  function setScreen(screenId) {
    ['menu-screen', 'game-screen', 'win-screen', 'lose-screen'].forEach((id) => {
      const node = document.getElementById(id);
      node.classList.toggle('active', id === screenId);
    });
  }

  function loadSelectionsForLanguage(language) {
    const languageConfig = getLanguageConfig(language);
    const storedLevel = safeStorageGet(languageStorageKey(STORAGE_KEYS.level, language), DEFAULT_CEFR_LEVEL) || DEFAULT_CEFR_LEVEL;
    selectedLevel = CEFR_LEVELS.includes(storedLevel) ? storedLevel : DEFAULT_CEFR_LEVEL;
    const storedLexical = safeStorageGet(languageStorageKey(STORAGE_KEYS.lexical, language), '');
    selectedLexical = languageConfig.lexicalTopics.includes(storedLexical) ? storedLexical : null;
    slotAssignments = restoreSlotAssignments(language);
    const firstEmpty = slotAssignments.findIndex((slot) => !slot);
    selectedSlotIndex = firstEmpty >= 0 ? firstEmpty : 0;
  }

  function persistSelectionsForLanguage(language = selectedLanguage) {
    safeStorageSet(STORAGE_KEYS.language, language);
    safeStorageSet(languageStorageKey(STORAGE_KEYS.level, language), selectedLevel);
    safeStorageSet(languageStorageKey(STORAGE_KEYS.lexical, language), selectedLexical || '');
    safeStorageSet(languageStorageKey(STORAGE_KEYS.slots, language), JSON.stringify(slotAssignments));
    safeStorageSet(STORAGE_KEYS.preset, selectedAtmospherePreset);
  }

  function updateSetupCopy() {
    const languageConfig = getLanguageConfig(selectedLanguage);
    if (ui.step1Text) {
      ui.step1Text.textContent = languageConfig.step1Text;
    }
    if (ui.levelLabel) {
      ui.levelLabel.textContent = languageConfig.levelLabel;
    }
    if (ui.step2Text) {
      ui.step2Text.textContent = languageConfig.step2Text;
    }
    if (ui.grammarLabel) {
      ui.grammarLabel.textContent = languageConfig.grammarLabel;
    }
    if (ui.playerName) {
      ui.playerName.placeholder = languageConfig.playerPlaceholder;
    }
    if (ui.presetLabel) {
      ui.presetLabel.textContent = '\u0410\u0442\u043c\u043e\u0441\u0444\u0435\u0440\u0430 \u0441\u0435\u0441\u0441\u0438\u0438';
    }
  }

  function renderLanguageButtons() {
    if (!ui.languageButtons) {
      return;
    }

    ui.languageButtons.innerHTML = '';
    LANGUAGE_OPTIONS.forEach((option) => {
      const languageConfig = getLanguageConfig(option.id);
      const button = document.createElement('button');
      button.className = 'language-btn';
      button.type = 'button';
      button.classList.toggle('active', option.id === selectedLanguage);
      button.innerHTML = `
        <span class="language-btn-topline">
          <span class="language-btn-title">${option.nativeLabel}</span>
          <span class="language-btn-tag">${languageConfig.grammarTopics.length} тем</span>
        </span>
        <span class="language-btn-subtitle">${option.uiLabel}</span>
        <span class="language-btn-teaser">${option.teaser}</span>
        <span class="language-btn-copy">${option.copy}</span>
      `;
      button.addEventListener('click', () => {
        if (option.id === selectedLanguage) {
          return;
        }
        persistSelectionsForLanguage(selectedLanguage);
        selectedLanguage = option.id;
        safeStorageSet(STORAGE_KEYS.language, selectedLanguage);
        loadSelectionsForLanguage(selectedLanguage);
        renderLanguageButtons();
        updateSetupCopy();
        renderLevelButtons();
        renderLexicalGrid();
        renderBonusSlots();
        renderGrammarPicker();
        updateSelectionCounter();
        updateStartButton();
      });
      ui.languageButtons.appendChild(button);
    });
  }

  function renderLevelButtons() {
    ui.levelButtons.innerHTML = '';
    CEFR_LEVELS.forEach((level) => {
      const button = document.createElement('button');
      button.className = 'level-btn';
      button.type = 'button';
      button.textContent = level;
      button.classList.toggle('active', level === selectedLevel);
      button.addEventListener('click', () => {
        selectedLevel = level;
        persistSelectionsForLanguage();
        renderLevelButtons();
      });
      ui.levelButtons.appendChild(button);
    });
  }

  function renderPresetButtons() {
    if (!ui.presetButtons) {
      return;
    }

    ui.presetButtons.innerHTML = '';
    ATMOSPHERE_PRESETS.forEach((preset) => {
      const button = document.createElement('button');
      button.className = `preset-btn preset-btn-${preset.id}`;
      button.type = 'button';
      button.classList.toggle('active', preset.id === selectedAtmospherePreset);
      button.innerHTML = `
        <span class="preset-btn-topline">
          <span class="preset-btn-title">${preset.title}</span>
          <span class="preset-btn-tag">${preset.tag}</span>
        </span>
        <span class="preset-btn-teaser">${preset.teaser}</span>
        <span class="preset-btn-copy">${preset.copy}</span>
      `;
      button.addEventListener('click', () => {
        if (preset.id === selectedAtmospherePreset) {
          return;
        }
        selectedAtmospherePreset = preset.id;
        applyAtmospherePreview();
        persistSelectionsForLanguage();
        renderPresetButtons();
      });
      ui.presetButtons.appendChild(button);
    });
  }

  function renderLexicalGrid() {
    ui.lexicalGrid.innerHTML = '';
    getLanguageLexicalTopics(selectedLanguage).forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'selection-btn';
      button.type = 'button';
      button.textContent = topic;
      button.classList.toggle('selected', topic === selectedLexical);
      button.addEventListener('click', () => {
        selectedLexical = topic;
        persistSelectionsForLanguage();
        renderLexicalGrid();
        updateStartButton();
      });
      ui.lexicalGrid.appendChild(button);
    });
  }

  function renderBonusSlots() {
    ui.bonusSlots.innerHTML = '';
    BONUS_SLOTS.forEach((slot, index) => {
      const node = document.createElement('button');
      const directionSlots = slot.splitDirections
        ? `
          <div class="slot-directions" aria-hidden="true">
            <span class="slot-direction">Влево</span>
            <span class="slot-direction">Вправо</span>
          </div>
        `
        : '';
      node.className = 'bonus-slot';
      node.type = 'button';
      if (selectedSlotIndex === index) {
        node.classList.add('selected');
      }
      if (slotAssignments[index]) {
        node.classList.add('ready');
      }
      node.innerHTML = `
        <div class="slot-kicker">Бонус ${index + 1}</div>
        <div class="slot-title">${slot.bonusLabel}</div>
        ${directionSlots}
        <div class="slot-topic">${slotAssignments[index] || 'Тема ещё не выбрана'}</div>
        <div class="slot-help">${slot.help}</div>
      `;
      node.addEventListener('click', () => {
        selectedSlotIndex = index;
        renderBonusSlots();
        renderGrammarPicker();
      });
      ui.bonusSlots.appendChild(node);
    });
  }

  function renderGrammarPicker() {
    ui.grammarPicker.innerHTML = '';
    const usedTopics = slotAssignments.filter(Boolean);

    getLanguageGrammarTopics(selectedLanguage).forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'selection-btn';
      button.type = 'button';
      button.textContent = topic;
      if (usedTopics.includes(topic)) {
        button.classList.add('used');
      }
      button.addEventListener('click', () => {
        assignTopicToSlot(topic);
      });
      ui.grammarPicker.appendChild(button);
    });
  }

  function assignTopicToSlot(topic) {
    if (slotAssignments.includes(topic)) {
      return;
    }

    const targetIndex = selectedSlotIndex !== null ? selectedSlotIndex : slotAssignments.findIndex((slot) => !slot);
    if (targetIndex < 0) {
      return;
    }

    slotAssignments[targetIndex] = topic;
    persistSelectionsForLanguage();
    const nextEmpty = slotAssignments.findIndex((slot) => !slot);
    selectedSlotIndex = nextEmpty >= 0 ? nextEmpty : targetIndex;
    renderBonusSlots();
    renderGrammarPicker();
    updateSelectionCounter();
    updateStartButton();
  }

  function updateSelectionCounter() {
    const selectedCount = slotAssignments.filter(Boolean).length;
    ui.selectionCounter.textContent = `${selectedCount} / ${BONUS_SLOTS.length}`;
  }

  function updateStartButton() {
    ui.startButton.disabled = !selectedLexical || slotAssignments.some((topic) => !topic);
  }

  function buildSettings() {
    if (!selectedLexical || slotAssignments.some((topic) => !topic)) {
      return null;
    }

    const languageConfig = getLanguageConfig(selectedLanguage);

    return {
      language: selectedLanguage,
      languageLabel: languageConfig.uiLabel,
      playerName: ui.playerName.value.trim() || languageConfig.defaultPlayerName,
      atmospherePreset: selectedAtmospherePreset,
      langLevel: selectedLevel,
      lexicalTopic: selectedLexical,
      slotConfigs: BONUS_SLOTS.map((slotDef, index) => ({
        slotDef,
        grammarTopic: slotAssignments[index]
      }))
    };
  }

  function restoreSlotAssignments(language = selectedLanguage) {
    const empty = Array(BONUS_SLOTS.length).fill(null);
    const grammarTopics = getLanguageGrammarTopics(language);
    const raw = safeStorageGet(languageStorageKey(STORAGE_KEYS.slots, language), '');
    if (!raw) {
      return empty;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return empty;
      }
      const seen = new Set();
      return empty.map((_, index) => {
        const candidate = parsed[index];
        if (typeof candidate !== 'string') {
          return null;
        }
        if (!grammarTopics.includes(candidate) || seen.has(candidate)) {
          return null;
        }
        seen.add(candidate);
        return candidate;
      });
    } catch (error) {
      console.warn('Saved slot assignments could not be restored:', error);
      return empty;
    }
  }

  function applyAtmospherePreview() {
    document.body.dataset.atmospherePreset = selectedAtmospherePreset;
    if (ui.themeColorMeta) {
      ui.themeColorMeta.setAttribute(
        'content',
        selectedAtmospherePreset === 'newyear' ? '#05070b' : '#0e1821'
      );
    }
  }
});
