import { CONFIG } from "./config.js";

// Тонкая прослойка между DOM и game.js.
// Все селекторы — data-атрибуты из index.html.

export function createUI({ onAnswer, onStart }) {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    altitude: $("[data-altitude]"),
    laneIndicator: $("#lane-indicator"),
    playerMarker: $("#player-marker"),
    bonusClear: $('.bonus[data-bonus="clear"]'),
    bonusSnowwall: $('.bonus[data-bonus="snowwall"]'),
    bonusClearCd: $('.bonus[data-bonus="clear"] [data-cd]'),
    bonusSnowwallCd: $('.bonus[data-bonus="snowwall"] [data-cd]'),
    snowFill: $("[data-snow-fill]"),
    snowOverlay: $("#snow-overlay"),
    questionPanel: $("#question-panel"),
    questionText: $("[data-question-text]"),
    answerButtons: Array.from(document.querySelectorAll("[data-answer]")),
    questionTimerFill: $("[data-timer-fill]"),
    overlay: $("#overlay-screen"),
    overlayTitle: $("[data-overlay-title]"),
    overlayBody: $("[data-overlay-body]"),
    overlayAction: $("[data-overlay-action]"),
    toast: $("[data-toast]"),
  };

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2200);
  }

  function showQuestion(q) {
    els.questionPanel.classList.remove("hidden");
    els.questionText.textContent = q.text;
    els.answerButtons.forEach((btn, i) => {
      btn.textContent = `${i + 1}. ${q.options[i]}`;
      btn.className = "";
      btn.disabled = false;
    });
  }
  function hideQuestion() {
    els.questionPanel.classList.add("hidden");
  }

  function flashAnswer(idx, correct, correctIdx = null) {
    els.answerButtons.forEach((b) => (b.disabled = true));
    els.answerButtons[idx].classList.add(correct ? "correct" : "wrong");
    if (!correct && correctIdx !== null) {
      els.answerButtons[correctIdx].classList.add("correct");
    }
  }

  els.answerButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => onAnswer(i));
  });

  function showOverlay(title, body, actionText, onAction) {
    els.overlayTitle.textContent = title;
    els.overlayBody.textContent = body;
    els.overlayAction.textContent = actionText;
    els.overlayAction.onclick = onAction;
    els.overlay.classList.remove("hidden");
  }
  function hideOverlay() { els.overlay.classList.add("hidden"); }

  function showGameOver(altitude) {
    showOverlay(
      "Срыв",
      `Вы сорвались на высоте ${Math.round(altitude)} м. Попробуйте ещё раз.`,
      "Начать заново",
      () => { hideOverlay(); onStart(); }
    );
  }
  function showWin(altitude) {
    showOverlay(
      "Вершина!",
      `Вы достигли вершины на высоте ${Math.round(altitude)} м.`,
      "Восхождение заново",
      () => { hideOverlay(); onStart(); }
    );
  }
  function showStart() {
    showOverlay(
      "Bergsteig",
      "Прототип. A/D — рывок (1 полоса), Q/E — сильный рывок (2 полосы, 0.8с неуязвимости). Space — очистить снег. F — снежная стена. 1/2/3 — ответ. Отвечай правильно — поднимаешься. Избегай камней и лавин.",
      "Начать восхождение",
      () => { hideOverlay(); onStart(); }
    );
  }

  function update(s) {
    // Высота
    els.altitude.textContent = Math.round(s.worldY);

    // Индикатор полосы — позиционируем маркер поверх .lane[data-lane=...]
    const laneEls = els.laneIndicator.querySelectorAll(".lane");
    // Маркер рисуем по непрерывной X (учитывая swing) в диапазоне полос
    const minX = CONFIG.lanes[0], maxX = CONFIG.lanes[2];
    const clampedX = Math.max(minX - 1, Math.min(maxX + 1, s.playerX));
    const totalWidth = laneEls[0].offsetWidth * 3 + 12; // 3 lanes + 2 gaps of 6px
    const frac = (clampedX - minX) / (maxX - minX); // 0..1
    const leftPx = 10 + frac * (totalWidth - laneEls[0].offsetWidth) + laneEls[0].offsetWidth / 2 - 7;
    els.playerMarker.style.left = `${leftPx}px`;

    // Снег
    const pct = Math.round(s.snow * 100);
    els.snowFill.style.width = `${pct}%`;
    const opacity = Math.pow(s.snow, 1 / CONFIG.snow.visibilityExponent);
    els.snowOverlay.style.opacity = opacity.toFixed(3);

    // Кулдауны
    updateBonusCd(els.bonusClear, els.bonusClearCd, s.clearCooldown);
    updateBonusCd(els.bonusSnowwall, els.bonusSnowwallCd, s.snowWallCooldown, s.snowWallActive);

    // Таймер вопроса
    if (CONFIG.question.timeout > 0 && s.questionTimeLeft > 0) {
      const k = Math.max(0, s.questionTimeLeft / s.questionTimeout);
      els.questionTimerFill.style.width = `${k * 100}%`;
    } else {
      els.questionTimerFill.style.width = "100%";
    }
  }

  function updateBonusCd(bonusEl, cdEl, cd, active = false) {
    if (active) {
      bonusEl.classList.remove("cooldown");
      cdEl.textContent = "активно";
    } else if (cd > 0) {
      bonusEl.classList.add("cooldown");
      cdEl.textContent = `${Math.ceil(cd)}с`;
    } else {
      bonusEl.classList.remove("cooldown");
      cdEl.textContent = "готово";
    }
  }

  return {
    showQuestion, hideQuestion, flashAnswer,
    showToast,
    showGameOver, showWin, showStart, hideOverlay,
    update,
  };
}
