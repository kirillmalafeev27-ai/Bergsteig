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
    title: 'Штормовой подъём',
    tag: 'Базовый',
    teaser: 'Холод, снег и давление горы',
    copy: 'Основная киношная атмосфера: холодный свет, метель, туман и суровое восхождение.'
  },
  {
    id: 'newyear',
    title: 'Новогодняя ночь',
    tag: 'Новый',
    teaser: 'Чёрное небо, золотые звёзды и фонари на маршруте',
    copy: 'Праздничный контраст: чёрное небо, ледяно-голубые горы и тёплое золотое свечение.'
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
    relicShelf: document.getElementById('relic-shelf'),
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
    themeColorMeta: document.querySelector('meta[name="theme-color"]'),
    menuPaneTabs: Array.from(document.querySelectorAll('.setup-mode-tab')),
    menuPanes: {
      setup: document.getElementById('menu-pane-setup'),
      journal: document.getElementById('menu-pane-journal'),
      album: document.getElementById('menu-pane-album')
    },
    echoCard: document.getElementById('echo-card'),
    echoTitle: document.getElementById('echo-title'),
    echoCopy: document.getElementById('echo-copy'),
    journalEmpty: document.getElementById('journal-empty'),
    journalList: document.getElementById('journal-list'),
    albumEmpty: document.getElementById('album-empty'),
    albumGrid: document.getElementById('album-grid')
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
  let activeMenuPane = 'setup';
  let selectedRelicId = BERG_MEMORY.getSelectedRelic().id;
  let translationInFlight = false;

  ui.playerName.value = safeStorageGet(STORAGE_KEYS.playerName, '');
  applyAtmospherePreview();
  loadSelectionsForLanguage(selectedLanguage);
  normalizeSelectionForRelic();

  const storedMute = safeStorageGet(STORAGE_KEYS.muted, '0');
  game.setMuted(storedMute === '1');
  game.onMuteChange = (muted) => {
    safeStorageSet(STORAGE_KEYS.muted, muted ? '1' : '0');
  };

  game.onExit = () => {
    game.destroy(false);
    setScreen('menu-screen');
    setMenuPane('setup');
    showStep(stepForCurrentState());
    refreshPersistentViews();
  };

  game.onWin = () => {
    game.destroy(false);
    setScreen('menu-screen');
    refreshPersistentViews();
    setMenuPane('album');
    showStep(1);
  };

  game.onLose = (stats) => {
    ui.loseMessage.textContent =
      `Достигнуто: ${stats.progress} м. Лавины отбросили назад ${stats.avalanchesHit} раз.`;
    ui.loseStats.textContent =
      `Точность: ${stats.accuracy}%. Верных ответов: ${stats.correct}/${stats.answers}. ` +
      `Опасных проходов рядом с камнями: ${stats.nearMisses}.`;
    refreshPersistentViews();
    setScreen('lose-screen');
  };

  renderLanguageButtons();
  renderPresetButtons();
  renderRelicShelf();
  updateSetupCopy();
  renderLevelButtons();
  renderLexicalGrid();
  renderBonusSlots();
  renderGrammarPicker();
  updateSelectionCounter();
  updateStartButton();
  showStep(1);
  setMenuPane('setup');
  refreshPersistentViews();
  flushPendingTranslation();

  window.addEventListener('berg-memory-updated', () => {
    refreshPersistentViews();
  });

  ui.menuPaneTabs.forEach((button) => {
    button.addEventListener('click', () => {
      setMenuPane(button.dataset.menuPane || 'setup');
    });
  });

  document.getElementById('to-step2-btn').addEventListener('click', () => {
    setMenuPane('setup');
    showStep(2);
  });

  document.getElementById('to-step3-btn').addEventListener('click', () => {
    if (!selectedLexical) {
      return;
    }
    setMenuPane('setup');
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
    refreshPersistentViews();
    setMenuPane('setup');
    showStep(1);
  });

  document.getElementById('lose-restart').addEventListener('click', async () => {
    setScreen('game-screen');
    await game.restartCurrentSession();
  });

  document.getElementById('lose-menu').addEventListener('click', () => {
    game.destroy(false);
    setScreen('menu-screen');
    refreshPersistentViews();
    setMenuPane('setup');
    showStep(1);
  });

  function enabledBonusIds() {
    return BERG_MEMORY.enabledBonusIdsForRelic(selectedRelicId);
  }

  function isSlotEnabled(slotDefOrIndex) {
    const slotId = typeof slotDefOrIndex === 'number'
      ? BONUS_SLOTS[slotDefOrIndex] && BONUS_SLOTS[slotDefOrIndex].id
      : slotDefOrIndex && slotDefOrIndex.id;
    return enabledBonusIds().includes(slotId);
  }

  function firstEnabledEmptySlotIndex() {
    for (let index = 0; index < BONUS_SLOTS.length; index += 1) {
      if (!isSlotEnabled(index)) {
        continue;
      }
      if (!slotAssignments[index]) {
        return index;
      }
    }
    for (let index = 0; index < BONUS_SLOTS.length; index += 1) {
      if (isSlotEnabled(index)) {
        return index;
      }
    }
    return 0;
  }

  function normalizeSelectionForRelic() {
    if (!isSlotEnabled(selectedSlotIndex)) {
      selectedSlotIndex = firstEnabledEmptySlotIndex();
    }
  }

  function stepForCurrentState() {
    if (!selectedLexical) {
      return 2;
    }
    if (requiredSlots().some((slotIndex) => !slotAssignments[slotIndex])) {
      return 3;
    }
    return 3;
  }

  function requiredSlots() {
    return BONUS_SLOTS
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => isSlotEnabled(slot))
      .map(({ index }) => index);
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

  function setMenuPane(paneId) {
    activeMenuPane = paneId;
    Object.entries(ui.menuPanes).forEach(([id, node]) => {
      if (!node) {
        return;
      }
      node.classList.toggle('hidden', id !== paneId);
      node.classList.toggle('active', id === paneId);
    });
    ui.menuPaneTabs.forEach((button) => {
      const active = button.dataset.menuPane === paneId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function loadSelectionsForLanguage(language) {
    const languageConfig = getLanguageConfig(language);
    const storedLevel = safeStorageGet(languageStorageKey(STORAGE_KEYS.level, language), DEFAULT_CEFR_LEVEL) || DEFAULT_CEFR_LEVEL;
    selectedLevel = CEFR_LEVELS.includes(storedLevel) ? storedLevel : DEFAULT_CEFR_LEVEL;
    const storedLexical = safeStorageGet(languageStorageKey(STORAGE_KEYS.lexical, language), '');
    selectedLexical = languageConfig.lexicalTopics.includes(storedLexical) ? storedLexical : null;
    slotAssignments = restoreSlotAssignments(language);
    selectedSlotIndex = firstEnabledEmptySlotIndex();
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
      ui.presetLabel.textContent = 'Атмосфера сессии';
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
        normalizeSelectionForRelic();
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

  function renderRelicShelf() {
    if (!ui.relicShelf) {
      return;
    }
    ui.relicShelf.innerHTML = '';
    BERG_MEMORY.RELICS.forEach((relic) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'relic-card';
      button.classList.toggle('active', relic.id === selectedRelicId);
      button.innerHTML = `
        <div class="relic-kicker">${relic.kicker}</div>
        <div class="relic-title">${relic.title}</div>
        <div class="relic-meta">+ ${relic.plus}</div>
        <div class="relic-meta">− ${relic.minus}</div>
        <div class="relic-copy">${relic.copy}</div>
      `;
      button.addEventListener('click', () => {
        if (relic.id === selectedRelicId) {
          return;
        }
        selectedRelicId = relic.id;
        BERG_MEMORY.setSelectedRelic(selectedRelicId);
        normalizeSelectionForRelic();
        renderRelicShelf();
        renderBonusSlots();
        renderGrammarPicker();
        updateSelectionCounter();
        updateStartButton();
      });
      ui.relicShelf.appendChild(button);
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

  function disabledSlotReason(slot, index) {
    if (selectedRelicId === 'compass' && slot.id === 'snowShield') {
      return 'Компас отключает щит';
    }
    if (selectedRelicId === 'schnapps' && index >= 3) {
      return 'Шнапс закрывает слоты 4 и 5';
    }
    return 'Недоступно';
  }

  function renderBonusSlots() {
    ui.bonusSlots.innerHTML = '';
    BONUS_SLOTS.forEach((slot, index) => {
      const node = document.createElement('button');
      node.className = 'bonus-slot';
      node.type = 'button';
      const enabled = isSlotEnabled(slot);
      const directionSlots = slot.splitDirections
        ? `
          <div class="slot-directions" aria-hidden="true">
            <span class="slot-direction">Влево</span>
            <span class="slot-direction">Вправо</span>
          </div>
        `
        : '';

      if (selectedSlotIndex === index && enabled) {
        node.classList.add('selected');
      }
      if (slotAssignments[index]) {
        node.classList.add('ready');
      }
      if (!enabled) {
        node.classList.add('cooldown');
        node.disabled = true;
      }
      node.innerHTML = `
        <div class="slot-kicker">Бонус ${index + 1}</div>
        <div class="slot-title">${slot.bonusLabel}</div>
        ${directionSlots}
        <div class="slot-topic">${enabled ? (slotAssignments[index] || 'Тема ещё не выбрана') : disabledSlotReason(slot, index)}</div>
        <div class="slot-help">${slot.help}</div>
      `;
      node.addEventListener('click', () => {
        if (!enabled) {
          return;
        }
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
    const targetSlotEnabled = isSlotEnabled(selectedSlotIndex);

    getLanguageGrammarTopics(selectedLanguage).forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'selection-btn';
      button.type = 'button';
      button.textContent = topic;
      if (usedTopics.includes(topic)) {
        button.classList.add('used');
      }
      if (!targetSlotEnabled) {
        button.disabled = true;
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

    const fallbackIndex = firstEnabledEmptySlotIndex();
    const targetIndex = isSlotEnabled(selectedSlotIndex)
      ? selectedSlotIndex
      : fallbackIndex;
    if (targetIndex < 0 || !isSlotEnabled(targetIndex)) {
      return;
    }

    slotAssignments[targetIndex] = topic;
    persistSelectionsForLanguage();
    selectedSlotIndex = firstEnabledEmptySlotIndex();
    renderBonusSlots();
    renderGrammarPicker();
    updateSelectionCounter();
    updateStartButton();
  }

  function updateSelectionCounter() {
    const required = requiredSlots();
    const selectedCount = required.filter((slotIndex) => slotAssignments[slotIndex]).length;
    ui.selectionCounter.textContent = `${selectedCount} / ${required.length}`;
  }

  function updateStartButton() {
    ui.startButton.disabled = !selectedLexical || requiredSlots().some((topicIndex) => !slotAssignments[topicIndex]);
  }

  function buildSettings() {
    if (!selectedLexical || requiredSlots().some((slotIndex) => !slotAssignments[slotIndex])) {
      return null;
    }

    const languageConfig = getLanguageConfig(selectedLanguage);
    const profileSnapshot = BERG_MEMORY.startSession();

    return {
      language: selectedLanguage,
      languageLabel: languageConfig.uiLabel,
      playerName: ui.playerName.value.trim() || languageConfig.defaultPlayerName,
      atmospherePreset: selectedAtmospherePreset,
      langLevel: selectedLevel,
      lexicalTopic: selectedLexical,
      relic: BERG_MEMORY.getRelic(selectedRelicId),
      memoryProfile: profileSnapshot,
      slotConfigs: BONUS_SLOTS
        .map((slotDef, index) => ({ slotDef, grammarTopic: slotAssignments[index] }))
        .filter((slotConfig) => isSlotEnabled(slotConfig.slotDef))
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

  function appendTextElement(parent, tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    node.textContent = text || '';
    parent.appendChild(node);
    return node;
  }

  function safePhotoDataUrl(value) {
    const src = String(value || '');
    return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(src) ? src : '';
  }

  function renderJournal() {
    const entries = BERG_MEMORY.getJournalEntries();
    ui.journalList.innerHTML = '';
    ui.journalEmpty.classList.toggle('hidden', entries.length > 0);
    entries.forEach((entry) => {
      const node = document.createElement('article');
      node.className = 'journal-entry';
      const createdAt = new Date(entry.createdAt || Date.now()).toLocaleDateString('ru-RU');
      const meta = appendTextElement(node, 'div', 'journal-meta', '');
      appendTextElement(meta, 'span', '', entry.sourceTopic || 'Скальная фраза');
      appendTextElement(meta, 'span', '', createdAt);
      appendTextElement(node, 'div', 'journal-phrase', entry.phrase);
      appendTextElement(node, 'div', 'journal-translation', entry.translation);
      ui.journalList.appendChild(node);
    });
  }

  function renderAlbum() {
    const photos = BERG_MEMORY.getPhotos();
    ui.albumGrid.innerHTML = '';
    ui.albumEmpty.classList.toggle('hidden', photos.length > 0);
    photos.forEach((photo) => {
      const node = document.createElement('article');
      node.className = 'polaroid-card';
      const createdAt = new Date(photo.createdAt || Date.now()).toLocaleDateString('ru-RU');
      const caption = photo.caption || 'Лучший момент подъёма';
      const src = safePhotoDataUrl(photo.imageDataUrl);

      if (src) {
        const image = document.createElement('img');
        image.className = 'polaroid-image';
        image.src = src;
        image.alt = caption || 'Полароид сессии';
        node.appendChild(image);
      } else {
        appendTextElement(node, 'div', 'polaroid-image polaroid-image-empty', 'Кадр недоступен');
      }

      appendTextElement(node, 'div', 'polaroid-caption', caption);
      appendTextElement(node, 'div', 'polaroid-meta', `${createdAt} · ${photo.momentType || 'панорама'}`);
      ui.albumGrid.appendChild(node);
    });
  }

  function renderEcho() {
    const profile = BERG_MEMORY.loadProfile();
    const echo = profile.activeEcho;
    if (!echo) {
      ui.echoCard.classList.add('hidden');
      return;
    }
    ui.echoTitle.textContent = echo.title;
    ui.echoCopy.textContent = echo.copy;
    ui.echoCard.classList.remove('hidden');
  }

  function refreshPersistentViews() {
    renderRelicShelf();
    renderJournal();
    renderAlbum();
    renderEcho();
  }

  async function flushPendingTranslation() {
    if (translationInFlight) {
      return;
    }
    const pending = BERG_MEMORY.getPendingPhrase();
    if (!pending || !pending.phrase) {
      renderJournal();
      return;
    }

    translationInFlight = true;
    try {
      const response = await fetch('/api/translate-phrase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phrase: pending.phrase,
          language: pending.language || selectedLanguage
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      BERG_MEMORY.completePendingPhrase(payload.translation || 'Перевод не получен');
    } catch (error) {
      console.warn('Phrase translation failed:', error);
    } finally {
      translationInFlight = false;
      renderJournal();
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
