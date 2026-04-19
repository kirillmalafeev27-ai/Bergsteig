const PLAYER_NAME_KEY = 'aufstieg_player_name';
const RUN_NAME_KEY = 'aufstieg_run_name';
const TUTORIAL_SEEN_KEY = 'aufstieg_tutorial_seen';
const LANG_LEVEL_KEY = 'aufstieg_lang_level';

const game = new Game();

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
  const ui = {
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    winScreen: document.getElementById('win-screen'),
    loseScreen: document.getElementById('lose-screen'),
    playerName: document.getElementById('player-name'),
    runName: document.getElementById('run-name'),
    lexicalGrid: document.getElementById('lexical-grid'),
    grammarPicker: document.getElementById('grammar-picker'),
    bonusSlots: document.getElementById('bonus-slots'),
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialClose: document.getElementById('tutorial-close'),
    levelButtons: Array.from(document.querySelectorAll('.level-btn')),
    toStep4Button: document.getElementById('to-step4-btn'),
    startButton: document.getElementById('start-btn'),
    winStats: document.getElementById('win-stats'),
    loseMessage: document.getElementById('lose-message'),
    loseStats: document.getElementById('lose-stats')
  };

  let selectedLexical = null;
  let selectedGrammar = null;
  let selectedSlotIndex = null;
  let selectedLevel = safeStorageGet(LANG_LEVEL_KEY, DEFAULT_CEFR_LEVEL) || DEFAULT_CEFR_LEVEL;
  const slotAssignments = Array(BONUS_SLOTS.length).fill(null);
  let lastSettings = null;
  let pendingTutorialCallback = null;

  ui.playerName.value = safeStorageGet(PLAYER_NAME_KEY, 'Climber');
  ui.runName.value = safeStorageGet(RUN_NAME_KEY, 'White Ridge');

  renderLexicalGrid();
  renderSlots();
  renderGrammarPicker();
  renderLevelButtons();
  updateStartButton();
  showStep(1);

  document.getElementById('to-step2-btn').addEventListener('click', () => showStep(2));
  document.getElementById('to-step3-btn').addEventListener('click', () => showStep(3));
  document.getElementById('to-step4-btn').addEventListener('click', () => showStep(4));
  document.getElementById('back-to-step1').addEventListener('click', () => showStep(1));
  document.getElementById('back-to-step2').addEventListener('click', () => showStep(2));
  document.getElementById('back-to-step3').addEventListener('click', () => showStep(3));

  ui.levelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedLevel = button.dataset.level || DEFAULT_CEFR_LEVEL;
      renderLevelButtons();
    });
  });

  ui.startButton.addEventListener('click', () => {
    const settings = buildGameSettings();
    if (!settings) {
      return;
    }

    safeStorageSet(PLAYER_NAME_KEY, settings.playerName);
    safeStorageSet(RUN_NAME_KEY, settings.runName);
    safeStorageSet(LANG_LEVEL_KEY, settings.langLevel);

    lastSettings = settings;

    if (!safeStorageGet(TUTORIAL_SEEN_KEY, '')) {
      safeStorageSet(TUTORIAL_SEEN_KEY, '1');
      showTutorial(() => startGame(settings));
      return;
    }

    startGame(settings);
  });

  ui.tutorialClose.addEventListener('click', () => {
    ui.tutorialOverlay.classList.add('hidden');
    if (pendingTutorialCallback) {
      const callback = pendingTutorialCallback;
      pendingTutorialCallback = null;
      callback();
    }
  });

  document.getElementById('win-restart').addEventListener('click', () => {
    if (lastSettings) {
      startGame(lastSettings);
    }
  });

  document.getElementById('lose-restart').addEventListener('click', () => {
    if (lastSettings) {
      startGame(lastSettings);
    }
  });

  document.getElementById('win-menu').addEventListener('click', () => {
    game.destroy();
    setActiveScreen('menu-screen');
    showStep(1);
  });

  document.getElementById('lose-menu').addEventListener('click', () => {
    game.destroy();
    setActiveScreen('menu-screen');
    showStep(1);
  });

  function showStep(stepNumber) {
    for (let index = 1; index <= 4; index += 1) {
      const node = document.getElementById(`setup-step${index}`);
      node.classList.toggle('hidden', index !== stepNumber);
    }
  }

  function setActiveScreen(screenId) {
    ['menu-screen', 'game-screen', 'win-screen', 'lose-screen'].forEach((id) => {
      const node = document.getElementById(id);
      node.classList.toggle('active', id === screenId);
    });
  }

  function renderLevelButtons() {
    ui.levelButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.level === selectedLevel);
    });
  }

  function renderLexicalGrid() {
    ui.lexicalGrid.innerHTML = '';
    LEXICAL_TOPICS.forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'lexical-btn';
      button.textContent = topic;
      button.classList.toggle('selected', selectedLexical === topic);
      button.addEventListener('click', () => {
        selectedLexical = topic;
        ui.toStep4Button.disabled = false;
        renderLexicalGrid();
        updateStartButton();
      });
      ui.lexicalGrid.appendChild(button);
    });
  }

  function renderSlots() {
    ui.bonusSlots.innerHTML = '';
    BONUS_SLOTS.forEach((slotDef, index) => {
      const node = document.createElement('button');
      node.className = 'bonus-slot';
      const grammar = slotAssignments[index];

      if (!grammar) {
        node.classList.add('empty');
      } else {
        node.classList.add('has-topic');
      }
      if (selectedSlotIndex === index) {
        node.classList.add('selected-slot');
      }

      node.innerHTML = `
        <div class="slot-bonus">${slotDef.bonusLabel}</div>
        <div class="slot-topic">${grammar || 'Choose grammar topic'}</div>
        <div class="slot-grammar">${slotDef.help}</div>
      `;

      node.addEventListener('click', () => {
        if (selectedGrammar) {
          assignGrammarToSlot(index, selectedGrammar);
          return;
        }

        selectedSlotIndex = selectedSlotIndex === index ? null : index;
        renderSlots();
        renderGrammarPicker();
        updateStartButton();
      });

      ui.bonusSlots.appendChild(node);
    });
  }

  function renderGrammarPicker() {
    ui.grammarPicker.innerHTML = '';
    const usedTopics = slotAssignments.filter(Boolean);

    GRAMMAR_TOPICS.forEach((topic) => {
      const button = document.createElement('button');
      button.className = 'grammar-tag';
      button.textContent = topic;

      if (usedTopics.includes(topic)) {
        button.classList.add('used');
      }
      if (selectedGrammar === topic) {
        button.classList.add('selected-grammar');
      }

      button.addEventListener('click', () => {
        if (usedTopics.includes(topic)) {
          return;
        }

        if (selectedSlotIndex !== null) {
          assignGrammarToSlot(selectedSlotIndex, topic);
          return;
        }

        selectedGrammar = selectedGrammar === topic ? null : topic;
        renderSlots();
        renderGrammarPicker();
      });

      ui.grammarPicker.appendChild(button);
    });
  }

  function assignGrammarToSlot(slotIndex, grammarTopic) {
    for (let index = 0; index < slotAssignments.length; index += 1) {
      if (slotAssignments[index] === grammarTopic) {
        slotAssignments[index] = null;
      }
    }

    slotAssignments[slotIndex] = grammarTopic;
    selectedGrammar = null;
    selectedSlotIndex = null;
    renderSlots();
    renderGrammarPicker();
    updateStartButton();
  }

  function updateStartButton() {
    ui.startButton.disabled = !selectedLexical || slotAssignments.some((topic) => !topic);
  }

  function buildGameSettings() {
    if (!selectedLexical || slotAssignments.some((topic) => !topic)) {
      return null;
    }

    return {
      playerName: ui.playerName.value.trim() || 'Climber',
      runName: ui.runName.value.trim() || 'White Ridge',
      langLevel: selectedLevel,
      lexicalTopic: selectedLexical,
      slotConfigs: BONUS_SLOTS.map((slotDef, index) => ({
        slotDef,
        grammarTopic: slotAssignments[index]
      }))
    };
  }

  function startGame(settings) {
    setActiveScreen('game-screen');
    game.init(settings, {
      onWin(stats) {
        ui.winStats.textContent =
          `${stats.runName}: ${stats.altitudePercent}% altitude, ${stats.correct}/${stats.answered} correct, accuracy ${stats.accuracy}%.`;
        setActiveScreen('win-screen');
      },
      onLose(info) {
        ui.loseMessage.textContent = `${info.reason}. ${info.message}`;
        ui.loseStats.textContent =
          `${info.runName}: ${info.altitudePercent}% altitude, ${info.correct}/${info.answered} correct, accuracy ${info.accuracy}%.`;
        setActiveScreen('lose-screen');
      }
    }).catch((error) => {
      console.error('Failed to start game:', error);
      game.destroy();
      setActiveScreen('menu-screen');
    });
  }

  function showTutorial(onClose) {
    pendingTutorialCallback = onClose;
    ui.tutorialOverlay.classList.remove('hidden');
  }
});
