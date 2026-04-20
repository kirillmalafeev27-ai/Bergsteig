const STORAGE_LEVEL_KEY = 'sklon_level';
const STORAGE_LEXICAL_KEY = 'sklon_lexical_theme';
const STORAGE_SESSION_KEY = 'sklon_session_topics';

const game = new Game();

function safeStorageGet(key, fallback = '') {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.warn(`Не удалось прочитать ${key}:`, error);
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Не удалось сохранить ${key}:`, error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const ui = {
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultScreen: document.getElementById('result-screen'),
    levelButtons: document.getElementById('level-buttons'),
    lexicalGrid: document.getElementById('lexical-grid'),
    sessionGrid: document.getElementById('session-grid'),
    selectedSessionTopics: document.getElementById('selected-session-topics'),
    startHint: document.getElementById('start-hint'),
    startButton: document.getElementById('start-btn'),
    resultKicker: document.getElementById('result-kicker'),
    resultTitle: document.getElementById('result-title'),
    resultCopy: document.getElementById('result-copy'),
    resultRestart: document.getElementById('result-restart'),
    resultMenu: document.getElementById('result-menu')
  };

  let selectedLevel = safeStorageGet(STORAGE_LEVEL_KEY, DEFAULT_CEFR_LEVEL) || DEFAULT_CEFR_LEVEL;
  let selectedLexicalTheme = safeStorageGet(STORAGE_LEXICAL_KEY, LEXICAL_THEMES[0].id) || LEXICAL_THEMES[0].id;
  let selectedSessionTopics = parseStoredTopics(safeStorageGet(STORAGE_SESSION_KEY, ''));
  let lastSettings = null;

  if (!LEXICAL_THEMES.some((theme) => theme.id === selectedLexicalTheme)) {
    selectedLexicalTheme = LEXICAL_THEMES[0].id;
  }
  selectedSessionTopics = selectedSessionTopics.filter((topicId) => SESSION_TOPICS.some((topic) => topic.id === topicId)).slice(0, SESSION_THEME_LIMIT);

  renderLevelButtons();
  renderLexicalThemes();
  renderSessionTopics();
  renderSelectedTopics();
  updateStartState();
  setActiveScreen('menu-screen');

  ui.startButton.addEventListener('click', () => {
    const settings = buildGameSettings();
    if (!settings) {
      return;
    }

    safeStorageSet(STORAGE_LEVEL_KEY, settings.langLevel);
    safeStorageSet(STORAGE_LEXICAL_KEY, settings.lexicalTheme);
    safeStorageSet(STORAGE_SESSION_KEY, JSON.stringify(settings.sessionTopics));

    lastSettings = settings;
    setActiveScreen('game-screen');
    game.init(settings, {
      onWin(stats) {
        ui.resultKicker.textContent = 'Финиш';
        ui.resultTitle.textContent = 'Кромка взята';
        ui.resultCopy.textContent =
          `Ты добрался до вершины. Ходов куплено: ${stats.movesEarned}, шагов потрачено: ${stats.movesSpent}, точность: ${stats.accuracy}%.`;
        setActiveScreen('result-screen');
      },
      onLose(stats) {
        ui.resultKicker.textContent = 'Срыв';
        ui.resultTitle.textContent = 'Камнепад догнал';
        ui.resultCopy.textContent =
          `Пройдено ${stats.progressPercent}% склона. Верных ответов: ${stats.correct}/${stats.answered}, купленных ходов: ${stats.movesEarned}, потрачено: ${stats.movesSpent}.`;
        setActiveScreen('result-screen');
      }
    }).catch((error) => {
      console.error('Не удалось запустить игру:', error);
      game.destroy();
      setActiveScreen('menu-screen');
    });
  });

  ui.resultRestart.addEventListener('click', () => {
    if (!lastSettings) {
      return;
    }
    setActiveScreen('game-screen');
    game.init(lastSettings, {
      onWin(stats) {
        ui.resultKicker.textContent = 'Финиш';
        ui.resultTitle.textContent = 'Кромка взята';
        ui.resultCopy.textContent =
          `Ты добрался до вершины. Ходов куплено: ${stats.movesEarned}, шагов потрачено: ${stats.movesSpent}, точность: ${stats.accuracy}%.`;
        setActiveScreen('result-screen');
      },
      onLose(stats) {
        ui.resultKicker.textContent = 'Срыв';
        ui.resultTitle.textContent = 'Камнепад догнал';
        ui.resultCopy.textContent =
          `Пройдено ${stats.progressPercent}% склона. Верных ответов: ${stats.correct}/${stats.answered}, купленных ходов: ${stats.movesEarned}, потрачено: ${stats.movesSpent}.`;
        setActiveScreen('result-screen');
      }
    }).catch((error) => {
      console.error('Не удалось перезапустить игру:', error);
      game.destroy();
      setActiveScreen('menu-screen');
    });
  });

  ui.resultMenu.addEventListener('click', () => {
    game.destroy();
    setActiveScreen('menu-screen');
  });

  function parseStoredTopics(raw) {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function setActiveScreen(screenId) {
    ['menu-screen', 'game-screen', 'result-screen'].forEach((id) => {
      const node = document.getElementById(id);
      node.classList.toggle('active', id === screenId);
    });
  }

  function renderLevelButtons() {
    ui.levelButtons.innerHTML = '';
    CEFR_LEVELS.forEach((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-pill';
      button.textContent = level;
      button.classList.toggle('active', selectedLevel === level);
      button.addEventListener('click', () => {
        selectedLevel = level;
        renderLevelButtons();
      });
      ui.levelButtons.appendChild(button);
    });
  }

  function renderLexicalThemes() {
    ui.lexicalGrid.innerHTML = '';
    LEXICAL_THEMES.forEach((theme) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lexical-pill';
      button.textContent = theme.title;
      button.classList.toggle('selected', selectedLexicalTheme === theme.id);
      button.addEventListener('click', () => {
        selectedLexicalTheme = theme.id;
        renderLexicalThemes();
        updateStartState();
      });
      ui.lexicalGrid.appendChild(button);
    });
  }

  function renderSessionTopics() {
    ui.sessionGrid.innerHTML = '';
    SESSION_TOPICS.forEach((topic) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'topic-pill';
      const selected = selectedSessionTopics.includes(topic.id);
      button.classList.toggle('selected', selected);
      button.classList.toggle('disabled', !selected && selectedSessionTopics.length >= SESSION_THEME_LIMIT);
      button.innerHTML = `
        <div class="topic-pill-title">${topic.title}</div>
        <div class="topic-pill-copy">${topic.blurb}</div>
      `;
      button.addEventListener('click', () => {
        toggleSessionTopic(topic.id);
      });
      ui.sessionGrid.appendChild(button);
    });
  }

  function renderSelectedTopics() {
    ui.selectedSessionTopics.innerHTML = '';
    selectedSessionTopics.forEach((topicId) => {
      const topic = findSessionTopic(topicId);
      const chip = document.createElement('div');
      chip.className = 'selected-chip';
      chip.textContent = topic.title;
      ui.selectedSessionTopics.appendChild(chip);
    });
  }

  function toggleSessionTopic(topicId) {
    const currentIndex = selectedSessionTopics.indexOf(topicId);
    if (currentIndex >= 0) {
      selectedSessionTopics.splice(currentIndex, 1);
    } else {
      if (selectedSessionTopics.length >= SESSION_THEME_LIMIT) {
        return;
      }
      selectedSessionTopics.push(topicId);
    }
    renderSessionTopics();
    renderSelectedTopics();
    updateStartState();
  }

  function updateStartState() {
    const ready = Boolean(selectedLexicalTheme) && selectedSessionTopics.length === SESSION_THEME_LIMIT;
    ui.startButton.disabled = !ready;
    ui.startHint.textContent = ready
      ? 'Все готово. Камнепад начнется сразу после запуска.'
      : `Нужно выбрать тему восхождения и ${SESSION_THEME_LIMIT} тем сессии.`;
  }

  function buildGameSettings() {
    if (!selectedLexicalTheme || selectedSessionTopics.length !== SESSION_THEME_LIMIT) {
      return null;
    }

    return {
      langLevel: selectedLevel,
      lexicalTheme: selectedLexicalTheme,
      sessionTopics: [...selectedSessionTopics]
    };
  }
});
