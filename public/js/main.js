const STORAGE_KEYS = {
  playerName: 'bergstieg_player_name',
  level: 'bergstieg_lang_level'
};

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

document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  const ui = {
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    winScreen: document.getElementById('win-screen'),
    loseScreen: document.getElementById('lose-screen'),
    playerName: document.getElementById('player-name'),
    levelButtons: document.getElementById('level-buttons'),
    lexicalGrid: document.getElementById('lexical-grid'),
    bonusSlots: document.getElementById('bonus-slots'),
    grammarPicker: document.getElementById('grammar-picker'),
    selectionCounter: document.getElementById('selection-counter'),
    startButton: document.getElementById('start-btn'),
    winStats: document.getElementById('win-stats'),
    loseStats: document.getElementById('lose-stats'),
    loseMessage: document.getElementById('lose-message')
  };

  let currentStep = 1;
  let selectedLevel = safeStorageGet(STORAGE_KEYS.level, DEFAULT_CEFR_LEVEL) || DEFAULT_CEFR_LEVEL;
  let selectedLexical = null;
  let selectedSlotIndex = 0;
  const slotAssignments = Array(BONUS_SLOTS.length).fill(null);

  ui.playerName.value = safeStorageGet(STORAGE_KEYS.playerName, '');

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
    safeStorageSet(STORAGE_KEYS.level, settings.langLevel);

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
    resetSessionSelections();
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

  function showStep(step) {
    currentStep = step;
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

  function renderLevelButtons() {
    ui.levelButtons.innerHTML = '';
    CEFR_LEVELS.forEach((level) => {
      const button = document.createElement('button');
      button.className = 'level-btn';
      button.textContent = level;
      button.classList.toggle('active', level === selectedLevel);
      button.addEventListener('click', () => {
        selectedLevel = level;
        renderLevelButtons();
      });
      ui.levelButtons.appendChild(button);
    });
  }

  function renderLexicalGrid() {
    ui.lexicalGrid.innerHTML = '';
    LEXICAL_TOPICS.forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'selection-btn';
      button.textContent = topic;
      button.classList.toggle('selected', topic === selectedLexical);
      button.addEventListener('click', () => {
        selectedLexical = topic;
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
      node.className = 'bonus-slot';
      if (selectedSlotIndex === index) {
        node.classList.add('selected');
      }
      if (slotAssignments[index]) {
        node.classList.add('ready');
      }
      node.innerHTML = `
        <div class="slot-kicker">Бонус ${index + 1}</div>
        <div class="slot-title">${slot.bonusLabel}</div>
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

    GRAMMAR_TOPICS.forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'selection-btn';
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

    return {
      playerName: ui.playerName.value.trim() || 'Spieler',
      langLevel: selectedLevel,
      lexicalTopic: selectedLexical,
      slotConfigs: BONUS_SLOTS.map((slotDef, index) => ({
        slotDef,
        grammarTopic: slotAssignments[index]
      }))
    };
  }

  function resetSessionSelections() {
    selectedLexical = null;
    selectedSlotIndex = 0;
    slotAssignments.fill(null);
    renderLexicalGrid();
    renderBonusSlots();
    renderGrammarPicker();
    updateSelectionCounter();
    updateStartButton();
  }
});
