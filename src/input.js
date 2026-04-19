// Клавиатурный ввод. Не делает ничего умного — просто вызывает колбэки.
// Раскладка прототипа:
//   A / ← : слабый рывок влево  (1 полоса)
//   D / → : слабый рывок вправо
//   Q     : сильный рывок влево (2 полосы, неуязвимость 0.8с)
//   E     : сильный рывок вправо
//   Space : очистить снег с камеры
//   F     : поставить снежную стену (поглощает 1 удар)
//   1/2/3 : выбор ответа

export function bindInput(handlers) {
  const onKey = (e) => {
    // Игнорируем, если фокус на кнопке ответа — пусть клик сработает
    if (e.target?.tagName === "BUTTON") return;

    switch (e.code) {
      case "KeyA": case "ArrowLeft":  handlers.pull?.(-1, "weak");   break;
      case "KeyD": case "ArrowRight": handlers.pull?.(+1, "weak");   break;
      case "KeyQ":                    handlers.pull?.(-1, "strong"); break;
      case "KeyE":                    handlers.pull?.(+1, "strong"); break;
      case "Space":                   e.preventDefault(); handlers.clearSnow?.();   break;
      case "KeyF":                    handlers.snowWall?.();                         break;
      case "Digit1":                  handlers.answer?.(0); break;
      case "Digit2":                  handlers.answer?.(1); break;
      case "Digit3":                  handlers.answer?.(2); break;
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
