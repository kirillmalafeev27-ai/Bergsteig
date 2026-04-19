// Все тюнинг-константы прототипа в одном месте.
// Меняй — игра сразу подстроится.

export const CONFIG = {
  // Три пути. Расстояние между соседями = 2.2 ед.
  lanes: [-2.2, 0, 2.2],
  laneWidth: 2.2,

  // Подъём по ответу
  climb: {
    unitsPerTick: 6,      // насколько мир «прокручивается» вниз за правильный ответ
    animDuration: 0.6,    // сек — плавная анимация шага
  },

  // Физика раскачки: offset(t) = A * exp(-lambda*t) * sin(omega*t)
  // (добавляется к центру целевой полосы)
  swing: {
    weak: {
      amplitude: 1.0,     // перелёт за соседнюю полосу (lane ≈ 2.2 → почти касаемся края)
      damping: 2.8,
      frequency: 5.0,     // рад/с
      lifetime: 1.6,
    },
    strong: {
      amplitude: 2.6,     // перелёт за пределы прыжка на 2 полосы
      damping: 0.95,
      frequency: 3.8,
      lifetime: 3.8,
      carveInvulnTime: 0.8, // сек неуязвимости в начале рывка (уход на «карниз»)
    },
  },

  // Препятствия
  obstacles: {
    rock: {
      speed: 14,                 // ед/сек вниз
      spawnIntervalMin: 1.2,
      spawnIntervalMax: 2.2,
      doubleRockChance: 0.35,    // вероятность, что камни сразу в двух полосах
      spawnAheadY: 48,           // на сколько выше игрока спавн
      killDistance: 0.95,        // радиус попадания по X
      size: 0.8,
    },
    avalanche: {
      speed: 10,
      chance: 0.12,              // шанс заменить обычный спавн лавиной
      spawnAheadY: 60,
      knockbackSteps: 3,
      thickness: 3.0,            // длина по Y
      minIntervalAfter: 6.0,     // сек — гарантированный зазор после лавины
    },
  },

  // Снег на камере
  snow: {
    accumulationRate: 0.028,     // единиц/сек (0..1)
    visibilityExponent: 2.0,     // чем выше, тем резче падает видимость на высоких значениях
    clearCooldown: 45,
    snowWallCooldown: 180,       // «стена снега» поглощает один удар
  },

  // Вопрос
  question: {
    timeout: 9,        // сек на ответ; 0 = без таймера
    wrongPenaltySteps: 0, // сколько полос вниз при ошибке (0 = только пропуск тика)
  },

  // Игрок
  player: {
    hitboxRadius: 0.55,
  },

  // Прогрессия по высоте (прототип: один уровень, легко расширяется)
  progression: {
    volcanoStartY: 150,          // с какой высоты гора превращается в вулкан
    summitY: 320,                // победа
  },

  // Цвета
  colors: {
    snowSlope: 0xd4dde6,
    rockSlope: 0x6a5a50,
    lavaSlope: 0x3a1a14,
    laneLine: 0xffffff,
    rock: 0x4a4238,
    avalanche: 0xf0f4f8,
    player: 0xffcc4d,
    rope: 0xcfa56a,
  },
};
