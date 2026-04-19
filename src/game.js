import { CONFIG } from "./config.js";
import { ObstacleSpawner } from "./obstacles.js";
import { nextQuestion } from "./questions.js";

// Главный стейт-машин прототипа. Хранит:
//  - дискретный laneIndex (0..2), таргет игрока
//  - непрерывный swingOffset (затухающая синусоида, добавляется к центру полосы)
//  - worldY (высота), биом, снег на камере, кулдауны, текущий вопрос, жив ли игрок
//
// Главный цикл (main.js) вызывает update(dt) каждый кадр и render() через scene.

export function createGame({ sceneApi, ui }) {
  const state = {
    running: false,
    dead: false,
    won: false,

    laneIndex: 1,
    swing: null, // { t, ampl, lambda, omega, lifetime }

    worldY: 0,
    climbAnim: null, // { from, to, t, duration }

    snow: 0,                // 0..1
    clearCooldown: 0,
    snowWallCooldown: 0,
    snowWallActive: false,  // поглотит следующий удар камня

    spawner: null,
    currentQuestion: null,
    questionTimeLeft: 0,

    // защита от повторного обращения к state из колбэков в момент ответа
    answering: false,

    // бонусы (будущие — резерв)
    extraMove: 0,

    // Для UI-предупреждений
    lastWarning: null,
  };

  state.spawner = new ObstacleSpawner(sceneApi);
  state.warn = (msg) => {
    state.lastWarning = msg;
    ui.showToast(msg);
  };

  // ===== Swing physics =====
  // offset(t) = A * exp(-lambda*t) * sin(omega*t)
  // direction: sign куда «перелетаем» (1 = вправо относительно новой полосы)
  function triggerSwing(kind, direction) {
    const cfg = CONFIG.swing[kind];
    state.swing = {
      t: 0,
      amplitude: cfg.amplitude * direction,
      damping: cfg.damping,
      frequency: cfg.frequency,
      lifetime: cfg.lifetime,
      carveInvuln: kind === "strong" ? cfg.carveInvulnTime : 0,
    };
  }

  function currentSwingOffset() {
    if (!state.swing) return 0;
    const { t, amplitude, damping, frequency } = state.swing;
    return amplitude * Math.exp(-damping * t) * Math.sin(frequency * t);
  }

  function playerWorldX() {
    const base = CONFIG.lanes[state.laneIndex];
    return base + currentSwingOffset();
  }

  function isInvulnerable() {
    return state.swing && state.swing.t < state.swing.carveInvuln;
  }

  // ===== Ходы игрока =====
  function pull(direction, kind) {
    if (!state.running || state.dead) return;
    const step = kind === "strong" ? 2 : 1;
    const newLane = Math.max(0, Math.min(2, state.laneIndex + direction * step));
    if (newLane === state.laneIndex) return;

    // Импульс раскачки: мы «пролетаем» за новую полосу в сторону движения
    const swingDir = direction; // куда перелетаем (в ту же сторону, что и рывок)
    state.laneIndex = newLane;
    triggerSwing(kind, swingDir);
  }

  // ===== Бонусы =====
  function clearSnow() {
    if (state.clearCooldown > 0) return;
    state.snow = 0;
    state.clearCooldown = CONFIG.snow.clearCooldown;
    ui.showToast("Камера очищена");
  }
  function deploySnowWall() {
    if (state.snowWallCooldown > 0) return;
    state.snowWallActive = true;
    state.snowWallCooldown = CONFIG.snow.snowWallCooldown;
    ui.showToast("Снежная стена активна (поглотит 1 удар)");
  }

  // ===== Ответ на вопрос =====
  function answerQuestion(idx) {
    if (!state.currentQuestion || state.answering) return;
    state.answering = true;
    const correct = idx === state.currentQuestion.answer;

    ui.flashAnswer(idx, correct, state.currentQuestion.answer);

    setTimeout(() => {
      if (correct) climbOneStep();
      else {
        ui.showToast("Неверно — пропуск хода");
        // будущее: penalty steps
      }
      state.currentQuestion = null;
      state.answering = false;
      askNextQuestion();
    }, 350);
  }

  function climbOneStep() {
    const steps = 1 + state.extraMove;
    state.extraMove = 0;
    state.climbAnim = {
      from: state.worldY,
      to: state.worldY + CONFIG.climb.unitsPerTick * steps,
      t: 0,
      duration: CONFIG.climb.animDuration,
    };
  }

  function askNextQuestion() {
    if (state.dead || state.won) return;
    state.currentQuestion = nextQuestion();
    state.questionTimeLeft = CONFIG.question.timeout;
    ui.showQuestion(state.currentQuestion);
  }

  // ===== Коллизии =====
  function resolveHits() {
    const px = playerWorldX();
    const { rock, avalanche } = state.spawner.checkHits(px);

    if (avalanche) {
      avalanche.dead = true;
      if (isInvulnerable()) {
        ui.showToast("Карниз! Неуязвимость");
      } else {
        // Knockback: теряем высоту
        const penalty = CONFIG.obstacles.avalanche.knockbackSteps * CONFIG.climb.unitsPerTick;
        state.worldY = Math.max(0, state.worldY - penalty);
        state.climbAnim = null;
        ui.showToast(`Лавина! −${CONFIG.obstacles.avalanche.knockbackSteps} хода`);
      }
    }
    if (rock) {
      rock.dead = true;
      if (isInvulnerable()) {
        ui.showToast("Карниз! Неуязвимость");
      } else if (state.snowWallActive) {
        state.snowWallActive = false;
        ui.showToast("Стена поглотила удар");
      } else {
        die();
      }
    }
  }

  function die() {
    state.dead = true;
    state.running = false;
    ui.hideQuestion();
    ui.showGameOver(state.worldY);
  }

  function win() {
    state.won = true;
    state.running = false;
    ui.hideQuestion();
    ui.showWin(state.worldY);
  }

  // ===== Основной апдейт =====
  function update(dt) {
    if (!state.running) return;

    // swing
    if (state.swing) {
      state.swing.t += dt;
      if (state.swing.t > state.swing.lifetime) state.swing = null;
    }

    // climb animation
    if (state.climbAnim) {
      state.climbAnim.t += dt;
      const k = Math.min(1, state.climbAnim.t / state.climbAnim.duration);
      const eased = 1 - Math.pow(1 - k, 3);
      state.worldY = state.climbAnim.from + (state.climbAnim.to - state.climbAnim.from) * eased;
      if (k >= 1) state.climbAnim = null;
    }

    // биом: снег → вулкан, плавно от volcanoStartY до summitY
    const { volcanoStartY, summitY } = CONFIG.progression;
    let biome = 0;
    if (state.worldY > volcanoStartY) {
      biome = Math.min(1, (state.worldY - volcanoStartY) / (summitY - volcanoStartY));
    }
    sceneApi.setBiome(biome);

    // win?
    if (state.worldY >= CONFIG.progression.summitY) { win(); return; }

    // препятствия
    state.spawner.update(dt, state);

    // снег на камере
    state.snow = Math.min(1, state.snow + CONFIG.snow.accumulationRate * dt);
    state.clearCooldown = Math.max(0, state.clearCooldown - dt);
    state.snowWallCooldown = Math.max(0, state.snowWallCooldown - dt);

    // вопрос: таймер
    if (state.currentQuestion && CONFIG.question.timeout > 0) {
      state.questionTimeLeft -= dt;
      if (state.questionTimeLeft <= 0) {
        ui.showToast("Время вышло — пропуск");
        state.currentQuestion = null;
        askNextQuestion();
      }
    }

    // коллизии после физики
    resolveHits();

    // рендер игрока
    const px = playerWorldX();
    const hop = state.swing ? Math.abs(currentSwingOffset()) * 0.08 : 0;
    sceneApi.setPlayerX(px, hop);

    // HUD
    ui.update({
      worldY: state.worldY,
      laneIndex: state.laneIndex,
      playerX: px,
      snow: state.snow,
      clearCooldown: state.clearCooldown,
      snowWallCooldown: state.snowWallCooldown,
      snowWallActive: state.snowWallActive,
      questionTimeLeft: state.questionTimeLeft,
      questionTimeout: CONFIG.question.timeout,
    });
  }

  // ===== Управление =====
  function start() {
    // reset
    state.running = true;
    state.dead = false;
    state.won = false;
    state.laneIndex = 1;
    state.swing = null;
    state.worldY = 0;
    state.climbAnim = null;
    state.snow = 0;
    state.clearCooldown = 0;
    state.snowWallCooldown = 0;
    state.snowWallActive = false;
    state.extraMove = 0;
    state.currentQuestion = null;
    state.answering = false;

    // очистить сцену от препятствий
    for (const r of state.spawner.rocks) sceneApi.obstacleGroup.remove(r.mesh);
    for (const a of state.spawner.avalanches) sceneApi.obstacleGroup.remove(a.mesh);
    state.spawner.rocks = [];
    state.spawner.avalanches = [];

    sceneApi.setPlayerX(CONFIG.lanes[1], 0);
    sceneApi.setBiome(0);

    askNextQuestion();
  }

  return {
    update,
    start,
    pull,
    clearSnow,
    deploySnowWall,
    answerQuestion,
    getState: () => state,
  };
}
