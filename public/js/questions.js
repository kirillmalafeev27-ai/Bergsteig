const DEFAULT_CEFR_LEVEL = 'A2';
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'];
const SESSION_THEME_LIMIT = 5;
const QUESTION_PREFETCH_COUNT = 8;
const QUESTION_LOW_WATERMARK = 3;
const QUESTION_FETCH_BATCH = 8;
const QUESTION_HISTORY_LIMIT = 40;
const QUESTION_ERROR_CACHE_LIMIT = 18;
const QUESTION_SESSION_CACHE = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(items) {
  return items[randomInt(0, items.length - 1)];
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildQuestionSessionKey(settings = {}) {
  const level = settings.langLevel || settings.level || DEFAULT_CEFR_LEVEL;
  const lexicalTheme = settings.lexicalTheme || LEXICAL_THEMES[0].id;
  const sessionTopics = [...(settings.sessionTopics || [])].join('|');
  return `${level}::${lexicalTheme}::${sessionTopics}`;
}

const SESSION_TOPICS = [
  {
    id: 'articles',
    title: 'Артикли',
    blurb: 'Быстрый выбор der, die, das внутри лексической темы.'
  },
  {
    id: 'wordOrder',
    title: 'Порядок слов',
    blurb: 'Нейтральные немецкие фразы без ломаного порядка.'
  },
  {
    id: 'modals',
    title: 'Модальные глаголы',
    blurb: 'müssen, können, wollen и место инфинитива.'
  },
  {
    id: 'past',
    title: 'Прошедшее время',
    blurb: 'Perfekt и выбор вспомогательного глагола.'
  },
  {
    id: 'prepositions',
    title: 'Предлоги',
    blurb: 'Короткие задачи на место, направление и опоры.'
  },
  {
    id: 'separable',
    title: 'Отделяемые приставки',
    blurb: 'Разнос приставки по фразе без потери ритма.'
  }
];

const LEXICAL_THEMES = [
  {
    id: 'travel',
    title: 'Путешествия',
    blurb: 'Поезда, билеты, гостиницы и пересадки.',
    accent: '#9fdcff',
    nouns: [
      { article: 'der', word: 'Zug', ru: 'поезд' },
      { article: 'das', word: 'Ticket', ru: 'билет' },
      { article: 'das', word: 'Hotel', ru: 'отель' },
      { article: 'die', word: 'Reise', ru: 'поездка' }
    ],
    wordOrderTemplates: [
      { timeFront: 'Heute', timeInline: 'heute', subject: 'Lena', verb: 'bucht', tail: 'im Hotel ein Zimmer' },
      { timeFront: 'Am Morgen', timeInline: 'am Morgen', subject: 'Omar', verb: 'sucht', tail: 'am Bahnhof sein Gleis' },
      { timeFront: 'Nach dem Kurs', timeInline: 'nach dem Kurs', subject: 'Mia', verb: 'kauft', tail: 'online ein Ticket' }
    ],
    modalTemplates: [
      {
        text: 'Выбери естественную фразу с модальным глаголом.',
        display: 'Ich / muss / heute / ein Ticket / kaufen',
        correct: 'Ich muss heute ein Ticket kaufen.',
        wrongs: [
          'Ich heute ein Ticket muss kaufen.',
          'Ich muss kaufe heute ein Ticket.',
          'Ich ein Ticket kaufen muss heute.'
        ]
      },
      {
        text: 'Выбери вариант без ошибки в месте инфинитива.',
        display: 'Wir / wollen / am Abend / ins Hotel / fahren',
        correct: 'Wir wollen am Abend ins Hotel fahren.',
        wrongs: [
          'Wir wollen fahren am Abend ins Hotel.',
          'Wir am Abend wollen ins Hotel fahren.',
          'Wir wollen ins Hotel am Abend fahren.'
        ]
      },
      {
        text: 'Выбери правильную фразу.',
        display: 'Sie / kann / den Fahrplan / schnell / lesen',
        correct: 'Sie kann den Fahrplan schnell lesen.',
        wrongs: [
          'Sie kann liest den Fahrplan schnell.',
          'Sie den Fahrplan kann schnell lesen.',
          'Sie kann schnell den Fahrplan liest.'
        ]
      }
    ],
    pastTemplates: [
      {
        text: 'Выбери верный Perfekt.',
        display: 'Вчера мы забронировали маленький отель.',
        correct: 'Wir haben gestern ein kleines Hotel gebucht.',
        wrongs: [
          'Wir sind gestern ein kleines Hotel gebucht.',
          'Wir haben gestern ein kleines Hotel buchen.',
          'Wir gestern haben ein kleines Hotel gebucht.'
        ]
      },
      {
        text: 'Выбери верный вариант.',
        display: 'Он поздно приехал на вокзал.',
        correct: 'Er ist spaet am Bahnhof angekommen.',
        wrongs: [
          'Er hat spaet am Bahnhof angekommen.',
          'Er ist spaet am Bahnhof ankommen.',
          'Er spaet ist am Bahnhof angekommen.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Они в пятницу поехали ночным поездом.',
        correct: 'Sie sind am Freitag mit dem Nachtzug gefahren.',
        wrongs: [
          'Sie haben am Freitag mit dem Nachtzug gefahren.',
          'Sie sind am Freitag mit dem Nachtzug fahren.',
          'Sie am Freitag sind mit dem Nachtzug gefahren.'
        ]
      }
    ],
    prepositionTemplates: [
      {
        text: 'Подбери правильный предлог.',
        display: 'Wir warten ___ Bahnhof auf den Zug.',
        correct: 'am',
        wrongs: ['im', 'auf', 'neben']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Das Taxi steht ___ Hotel.',
        correct: 'vor dem',
        wrongs: ['in den', 'unter', 'gegen']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Sie geht ___ Rezeption und fragt nach dem Schluessel.',
        correct: 'zur',
        wrongs: ['unter', 'neben dem', 'am']
      }
    ],
    separableTemplates: [
      {
        text: 'Где должна стоять приставка?',
        display: 'Поезд отправляется в семь утра.',
        correct: 'Der Zug faehrt um sieben Uhr ab.',
        wrongs: [
          'Der Zug abfaehrt um sieben Uhr.',
          'Der Zug faehrt ab um sieben Uhr ab.',
          'Der Zug um sieben Uhr abfaehrt.'
        ]
      },
      {
        text: 'Выбери правильный вариант с отделяемой приставкой.',
        display: 'Мия заходит в номер только вечером.',
        correct: 'Mia checkt erst am Abend im Zimmer ein.',
        wrongs: [
          'Mia eincheckt erst am Abend im Zimmer.',
          'Mia checkt im Zimmer erst am Abend ein ein.',
          'Mia am Abend erst im Zimmer eincheckt.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Он забирает чемодан после посадки.',
        correct: 'Er holt den Koffer nach dem Einsteigen ab.',
        wrongs: [
          'Er abholt den Koffer nach dem Einsteigen.',
          'Er holt ab den Koffer nach dem Einsteigen ab.',
          'Er nach dem Einsteigen den Koffer abholt.'
        ]
      }
    ]
  },
  {
    id: 'city',
    title: 'Город и быт',
    blurb: 'Улица, дом, квартира и обычные бытовые сцены.',
    accent: '#b6f6d6',
    nouns: [
      { article: 'die', word: 'Wohnung', ru: 'квартира' },
      { article: 'der', word: 'Markt', ru: 'рынок' },
      { article: 'die', word: 'Strasse', ru: 'улица' },
      { article: 'das', word: 'Licht', ru: 'свет' }
    ],
    wordOrderTemplates: [
      { timeFront: 'Heute', timeInline: 'heute', subject: 'Maksim', verb: 'repariert', tail: 'in der Wohnung das Licht' },
      { timeFront: 'Am Abend', timeInline: 'am Abend', subject: 'Nina', verb: 'kauft', tail: 'auf dem Markt frisches Brot' },
      { timeFront: 'Nach der Arbeit', timeInline: 'nach der Arbeit', subject: 'Tom', verb: 'putzt', tail: 'zu Hause die Kueche' }
    ],
    modalTemplates: [
      {
        text: 'Выбери естественный вариант.',
        display: 'Wir / muessen / heute / die Wohnung / aufraeumen',
        correct: 'Wir muessen heute die Wohnung aufraeumen.',
        wrongs: [
          'Wir heute die Wohnung muessen aufraeumen.',
          'Wir muessen raeumen heute die Wohnung auf.',
          'Wir die Wohnung muessen heute aufraeumen.'
        ]
      },
      {
        text: 'Выбери фразу без ошибки.',
        display: 'Sie / will / am Abend / den Markt / besuchen',
        correct: 'Sie will am Abend den Markt besuchen.',
        wrongs: [
          'Sie am Abend will den Markt besuchen.',
          'Sie will besucht am Abend den Markt.',
          'Sie will den Markt am Abend besucht.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Ich / kann / die Strasse / von hier / sehen',
        correct: 'Ich kann die Strasse von hier sehen.',
        wrongs: [
          'Ich kann sehe die Strasse von hier.',
          'Ich die Strasse kann von hier sehen.',
          'Ich kann von hier die Strasse sehe.'
        ]
      }
    ],
    pastTemplates: [
      {
        text: 'Выбери верный Perfekt.',
        display: 'Она вчера убрала кухню.',
        correct: 'Sie hat gestern die Kueche aufgeraeumt.',
        wrongs: [
          'Sie ist gestern die Kueche aufgeraeumt.',
          'Sie hat gestern die Kueche aufraeumen.',
          'Sie gestern hat die Kueche aufgeraeumt.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Мы поздно вернулись домой.',
        correct: 'Wir sind spaet nach Hause zurueckgekommen.',
        wrongs: [
          'Wir haben spaet nach Hause zurueckgekommen.',
          'Wir sind spaet nach Hause zurueckkommen.',
          'Wir spaet sind nach Hause zurueckgekommen.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Он купил на рынке цветы.',
        correct: 'Er hat auf dem Markt Blumen gekauft.',
        wrongs: [
          'Er ist auf dem Markt Blumen gekauft.',
          'Er hat auf dem Markt Blumen kaufen.',
          'Er auf dem Markt hat Blumen gekauft.'
        ]
      }
    ],
    prepositionTemplates: [
      {
        text: 'Подбери правильный предлог.',
        display: 'Das Fahrrad steht ___ Haus.',
        correct: 'vor dem',
        wrongs: ['am', 'hinter den', 'gegen']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Wir sitzen ___ Wohnung und trinken Tee.',
        correct: 'in der',
        wrongs: ['auf die', 'zwischen dem', 'vor']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Sie geht ___ Markt und kauft Obst.',
        correct: 'zum',
        wrongs: ['unter den', 'am', 'hinter']
      }
    ],
    separableTemplates: [
      {
        text: 'Где должна стоять приставка?',
        display: 'Он убирает посуду после ужина.',
        correct: 'Er raeumt das Geschirr nach dem Essen weg.',
        wrongs: [
          'Er wegraeumt das Geschirr nach dem Essen.',
          'Er raeumt weg das Geschirr nach dem Essen weg.',
          'Er nach dem Essen das Geschirr wegraeumt.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Нина включает свет в прихожей.',
        correct: 'Nina macht im Flur das Licht an.',
        wrongs: [
          'Nina anmacht im Flur das Licht.',
          'Nina macht an im Flur das Licht an.',
          'Nina im Flur das Licht anmacht.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Мы выносим мусор перед сном.',
        correct: 'Wir bringen vor dem Schlafen den Muell raus.',
        wrongs: [
          'Wir rausbringen vor dem Schlafen den Muell.',
          'Wir bringen raus vor dem Schlafen den Muell raus.',
          'Wir vor dem Schlafen den Muell rausbringen.'
        ]
      }
    ]
  },
  {
    id: 'work',
    title: 'Работа и учеба',
    blurb: 'Офис, задания, пары, дедлайны и письма.',
    accent: '#ffd491',
    nouns: [
      { article: 'die', word: 'Aufgabe', ru: 'задание' },
      { article: 'der', word: 'Termin', ru: 'встреча' },
      { article: 'die', word: 'Pruefung', ru: 'экзамен' },
      { article: 'das', word: 'Projekt', ru: 'проект' }
    ],
    wordOrderTemplates: [
      { timeFront: 'Heute', timeInline: 'heute', subject: 'Katja', verb: 'schreibt', tail: 'im Buero einen Bericht' },
      { timeFront: 'Nach dem Unterricht', timeInline: 'nach dem Unterricht', subject: 'Dima', verb: 'liest', tail: 'in der Bibliothek seine Notizen' },
      { timeFront: 'Am Nachmittag', timeInline: 'am Nachmittag', subject: 'Sara', verb: 'schickt', tail: 'dem Team eine E-Mail' }
    ],
    modalTemplates: [
      {
        text: 'Выбери корректную фразу.',
        display: 'Ich / muss / heute / das Projekt / beenden',
        correct: 'Ich muss heute das Projekt beenden.',
        wrongs: [
          'Ich heute das Projekt muss beenden.',
          'Ich muss beendet heute das Projekt.',
          'Ich das Projekt muss heute beenden.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Wir / koennen / nach dem Kurs / zusammen / lernen',
        correct: 'Wir koennen nach dem Kurs zusammen lernen.',
        wrongs: [
          'Wir nach dem Kurs koennen zusammen lernen.',
          'Wir koennen lernen nach dem Kurs zusammen.',
          'Wir koennen zusammen lernt nach dem Kurs.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Sie / will / die Aufgabe / heute / abschicken',
        correct: 'Sie will die Aufgabe heute abschicken.',
        wrongs: [
          'Sie die Aufgabe will heute abschicken.',
          'Sie will schickt die Aufgabe heute ab.',
          'Sie will heute die Aufgabe abschickt.'
        ]
      }
    ],
    pastTemplates: [
      {
        text: 'Выбери верный Perfekt.',
        display: 'Они вчера закончили проект.',
        correct: 'Sie haben gestern das Projekt beendet.',
        wrongs: [
          'Sie sind gestern das Projekt beendet.',
          'Sie haben gestern das Projekt beenden.',
          'Sie gestern haben das Projekt beendet.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Я поздно пришел на встречу.',
        correct: 'Ich bin spaet zum Termin gekommen.',
        wrongs: [
          'Ich habe spaet zum Termin gekommen.',
          'Ich bin spaet zum Termin kommen.',
          'Ich spaet bin zum Termin gekommen.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Она отправила преподавателю письмо.',
        correct: 'Sie hat dem Lehrer eine E-Mail geschickt.',
        wrongs: [
          'Sie ist dem Lehrer eine E-Mail geschickt.',
          'Sie hat dem Lehrer eine E-Mail schicken.',
          'Sie dem Lehrer hat eine E-Mail geschickt.'
        ]
      }
    ],
    prepositionTemplates: [
      {
        text: 'Подбери правильный предлог.',
        display: 'Wir arbeiten heute ___ Projekt weiter.',
        correct: 'am',
        wrongs: ['auf den', 'gegen', 'unter']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Sie sitzt ___ Bibliothek und lernt.',
        correct: 'in der',
        wrongs: ['zum', 'auf die', 'unter der']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Er geht ___ Chef und stellt eine Frage.',
        correct: 'zum',
        wrongs: ['am', 'vor dem', 'hinter']
      }
    ],
    separableTemplates: [
      {
        text: 'Где должна стоять приставка?',
        display: 'Катя отправляет отчет сегодня вечером.',
        correct: 'Katja schickt den Bericht heute Abend ab.',
        wrongs: [
          'Katja abschickt den Bericht heute Abend.',
          'Katja schickt ab den Bericht heute Abend ab.',
          'Katja heute Abend den Bericht abschickt.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Мы подготавливаем заметки перед экзаменом.',
        correct: 'Wir bereiten vor der Pruefung die Notizen vor.',
        wrongs: [
          'Wir vorbereiten vor der Pruefung die Notizen.',
          'Wir bereiten vor die Notizen vor der Pruefung vor.',
          'Wir vor der Pruefung die Notizen vorbereiten.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Он заполняет форму онлайн.',
        correct: 'Er fuellt das Formular online aus.',
        wrongs: [
          'Er ausfuellt das Formular online.',
          'Er fuellt aus das Formular online aus.',
          'Er online das Formular ausfuellt.'
        ]
      }
    ]
  },
  {
    id: 'nature',
    title: 'Природа и поход',
    blurb: 'Тропа, лес, вершина, ветер и холод.',
    accent: '#c8f0ff',
    nouns: [
      { article: 'der', word: 'Weg', ru: 'путь' },
      { article: 'der', word: 'Wind', ru: 'ветер' },
      { article: 'die', word: 'Karte', ru: 'карта' },
      { article: 'das', word: 'Lager', ru: 'лагерь' }
    ],
    wordOrderTemplates: [
      { timeFront: 'Heute', timeInline: 'heute', subject: 'Artem', verb: 'traegt', tail: 'im Wald eine schwere Karte' },
      { timeFront: 'Am Morgen', timeInline: 'am Morgen', subject: 'Lisa', verb: 'sucht', tail: 'am Hang den richtigen Weg' },
      { timeFront: 'Vor dem Regen', timeInline: 'vor dem Regen', subject: 'Jonas', verb: 'packt', tail: 'am Lager schnell den Rucksack' }
    ],
    modalTemplates: [
      {
        text: 'Выбери естественную фразу.',
        display: 'Wir / muessen / vor dem Regen / das Lager / finden',
        correct: 'Wir muessen vor dem Regen das Lager finden.',
        wrongs: [
          'Wir vor dem Regen muessen das Lager finden.',
          'Wir muessen finden vor dem Regen das Lager.',
          'Wir muessen das Lager findet vor dem Regen.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Ich / kann / den Weg / auf der Karte / sehen',
        correct: 'Ich kann den Weg auf der Karte sehen.',
        wrongs: [
          'Ich den Weg kann auf der Karte sehen.',
          'Ich kann sehe den Weg auf der Karte.',
          'Ich kann auf der Karte den Weg sehe.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Sie / wollen / am Abend / weiter / steigen',
        correct: 'Sie wollen am Abend weiter steigen.',
        wrongs: [
          'Sie am Abend wollen weiter steigen.',
          'Sie wollen steigen am Abend weiter.',
          'Sie wollen am Abend weiter steigt.'
        ]
      }
    ],
    pastTemplates: [
      {
        text: 'Выбери верный Perfekt.',
        display: 'Они поднялись на вершину на рассвете.',
        correct: 'Sie sind bei Sonnenaufgang auf den Gipfel gestiegen.',
        wrongs: [
          'Sie haben bei Sonnenaufgang auf den Gipfel gestiegen.',
          'Sie sind bei Sonnenaufgang auf den Gipfel steigen.',
          'Sie bei Sonnenaufgang sind auf den Gipfel gestiegen.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Мы нашли тропу у реки.',
        correct: 'Wir haben den Weg am Fluss gefunden.',
        wrongs: [
          'Wir sind den Weg am Fluss gefunden.',
          'Wir haben den Weg am Fluss finden.',
          'Wir den Weg haben am Fluss gefunden.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Он пришел в лагерь очень поздно.',
        correct: 'Er ist sehr spaet ins Lager gekommen.',
        wrongs: [
          'Er hat sehr spaet ins Lager gekommen.',
          'Er ist sehr spaet ins Lager kommen.',
          'Er sehr spaet ist ins Lager gekommen.'
        ]
      }
    ],
    prepositionTemplates: [
      {
        text: 'Подбери правильный предлог.',
        display: 'Das Zelt steht ___ grossen Stein.',
        correct: 'neben dem',
        wrongs: ['am', 'auf die', 'gegen']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Wir gehen langsam ___ Wald.',
        correct: 'durch den',
        wrongs: ['an dem', 'unter der', 'vor dem']
      },
      {
        text: 'Подбери правильный предлог.',
        display: 'Sie schaut lange ___ Karte.',
        correct: 'auf die',
        wrongs: ['am', 'zwischen den', 'vor']
      }
    ],
    separableTemplates: [
      {
        text: 'Где должна стоять приставка?',
        display: 'Мы ставим палатку до ветра.',
        correct: 'Wir bauen das Zelt vor dem Wind auf.',
        wrongs: [
          'Wir aufbauen das Zelt vor dem Wind.',
          'Wir bauen auf das Zelt vor dem Wind auf.',
          'Wir vor dem Wind das Zelt aufbauen.'
        ]
      },
      {
        text: 'Выбери правильный вариант.',
        display: 'Она снимает мокрую куртку у костра.',
        correct: 'Sie zieht am Feuer die nasse Jacke aus.',
        wrongs: [
          'Sie auszieht am Feuer die nasse Jacke.',
          'Sie zieht aus die nasse Jacke am Feuer aus.',
          'Sie am Feuer die nasse Jacke auszieht.'
        ]
      },
      {
        text: 'Выбери предложение без ошибки.',
        display: 'Он поднимается очень рано.',
        correct: 'Er steht im Lager sehr frueh auf.',
        wrongs: [
          'Er aufsteht im Lager sehr frueh.',
          'Er steht auf im Lager sehr frueh auf.',
          'Er im Lager sehr frueh aufsteht.'
        ]
      }
    ]
  }
];

function findLexicalTheme(themeId) {
  return LEXICAL_THEMES.find((theme) => theme.id === themeId) || LEXICAL_THEMES[0];
}

function findSessionTopic(topicId) {
  return SESSION_TOPICS.find((topic) => topic.id === topicId) || SESSION_TOPICS[0];
}

class QuestionManager {
  constructor(level = DEFAULT_CEFR_LEVEL) {
    this.level = level;
    this.lexicalTheme = findLexicalTheme(LEXICAL_THEMES[0].id);
    this.sessionTopics = [];
    this.pool = Object.create(null);
    this.mistakeCache = Object.create(null);
    this.mistakeKeys = Object.create(null);
    this.pendingRequests = Object.create(null);
    this.displayHistory = Object.create(null);
    this.remoteGenerationUnavailable = false;
    this.configSignature = '';
  }

  static forSettings(settings = {}) {
    const sessionKey = buildQuestionSessionKey(settings);
    let manager = QUESTION_SESSION_CACHE.get(sessionKey);

    if (!manager) {
      manager = new QuestionManager(settings.langLevel || settings.level || DEFAULT_CEFR_LEVEL);
      QUESTION_SESSION_CACHE.set(sessionKey, manager);
    }

    manager.configure(settings);
    return manager;
  }

  configure(settings = {}) {
    const level = settings.langLevel || settings.level || DEFAULT_CEFR_LEVEL;
    const lexicalTheme = findLexicalTheme(settings.lexicalTheme || this.lexicalTheme.id);
    const sessionTopics = (settings.sessionTopics || [])
      .filter((topicId) => SESSION_TOPICS.some((topic) => topic.id === topicId))
      .slice(0, SESSION_THEME_LIMIT);
    const nextSignature = JSON.stringify({
      level,
      lexicalTheme: lexicalTheme.id,
      sessionTopics
    });

    if (nextSignature === this.configSignature) {
      return;
    }

    this.level = level;
    this.lexicalTheme = lexicalTheme;
    this.sessionTopics = sessionTopics;
    this.pool = Object.create(null);
    this.mistakeCache = Object.create(null);
    this.mistakeKeys = Object.create(null);
    this.pendingRequests = Object.create(null);
    this.displayHistory = Object.create(null);
    this.remoteGenerationUnavailable = false;
    this.configSignature = nextSignature;
  }

  setLevel(level) {
    this.configure({
      langLevel: level,
      lexicalTheme: this.lexicalTheme.id,
      sessionTopics: this.sessionTopics
    });
  }

  setLexicalTheme(themeId) {
    this.configure({
      langLevel: this.level,
      lexicalTheme: themeId,
      sessionTopics: this.sessionTopics
    });
  }

  setSessionTopics(topicIds) {
    this.configure({
      langLevel: this.level,
      lexicalTheme: this.lexicalTheme.id,
      sessionTopics: topicIds
    });
  }

  async prefetchAll() {
    await Promise.all(this.sessionTopics.map((topicId) => this._ensureSupply(topicId, QUESTION_PREFETCH_COUNT)));
  }

  async getQuestion(topicId) {
    this._ensureTopicState(topicId);

    if (!this.pool[topicId].length && !this.mistakeCache[topicId].length) {
      await this._ensureSupply(topicId, 1);
    }

    let next = null;
    if (this.pool[topicId].length) {
      next = this.pool[topicId].shift();
    } else if (this.mistakeCache[topicId].length) {
      next = this.mistakeCache[topicId].shift();
      this.mistakeKeys[topicId].delete(next.cacheKey);
    }

    void this._ensureSupply(topicId, QUESTION_LOW_WATERMARK);
    return this._cloneQuestion(next || this._fallbackQuestion(topicId));
  }

  recordAnswer(question, isCorrect) {
    if (isCorrect || !question?.topicId) {
      return;
    }

    const topicId = question.topicId;
    this._ensureTopicState(topicId);

    if (this.mistakeKeys[topicId].has(question.cacheKey)) {
      return;
    }

    if (this.mistakeCache[topicId].length >= QUESTION_ERROR_CACHE_LIMIT) {
      const removed = this.mistakeCache[topicId].shift();
      if (removed) {
        this.mistakeKeys[topicId].delete(removed.cacheKey);
      }
    }

    const clone = this._cloneQuestion(question);
    this.mistakeCache[topicId].push(clone);
    this.mistakeKeys[topicId].add(clone.cacheKey);
  }

  _ensureTopicState(topicId) {
    this.pool[topicId] = this.pool[topicId] || [];
    this.mistakeCache[topicId] = this.mistakeCache[topicId] || [];
    this.mistakeKeys[topicId] = this.mistakeKeys[topicId] || new Set();
    this.displayHistory[topicId] = this.displayHistory[topicId] || [];
  }

  _availableCount(topicId) {
    this._ensureTopicState(topicId);
    return this.pool[topicId].length + this.mistakeCache[topicId].length;
  }

  async _ensureSupply(topicId, minReadyCount) {
    this._ensureTopicState(topicId);
    if (this._availableCount(topicId) >= minReadyCount) {
      return;
    }

    if (!this.pendingRequests[topicId]) {
      this.pendingRequests[topicId] = this._refillTopic(topicId, minReadyCount)
        .finally(() => {
          delete this.pendingRequests[topicId];
        });
    }

    await this.pendingRequests[topicId];
  }

  async _refillTopic(topicId, minReadyCount) {
    const remoteQuestions = await this._fetchRemoteBatch(
      topicId,
      Math.max(QUESTION_FETCH_BATCH, minReadyCount - this._availableCount(topicId))
    );
    this._appendQuestions(topicId, remoteQuestions);

    let attempts = 0;
    while (this._availableCount(topicId) < minReadyCount && attempts < 24) {
      const generated = this._buildQuestion(topicId);
      if (!generated) {
        break;
      }

      const formatted = this._formatQuestion(generated, topicId);
      if (!this._questionExists(topicId, formatted)) {
        this._appendQuestions(topicId, [formatted]);
      }
      attempts += 1;
    }
  }

  async _fetchRemoteBatch(topicId, count) {
    const topic = findSessionTopic(topicId);

    if (this.remoteGenerationUnavailable) {
      return [];
    }

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level: this.level,
          lexicalTopic: this.lexicalTheme.title,
          grammarTopic: topic.title,
          isWortstellung: topicId === 'wordOrder',
          count,
          exclude: this._buildExcludeList(topicId)
        })
      });

      if (!response.ok) {
        if (response.status === 503) {
          this.remoteGenerationUnavailable = true;
        }
        return [];
      }

      const payload = await response.json();
      return (payload.questions || [])
        .map((question) => this._normalizeRemoteQuestion(question, topicId))
        .filter(Boolean);
    } catch (error) {
      console.warn(`Не удалось догрузить задания для темы "${topic.title}". Использую локальный пул.`, error);
      return [];
    }
  }

  _buildExcludeList(topicId) {
    this._ensureTopicState(topicId);
    const queuedDisplays = [
      ...this.pool[topicId].map((question) => question.display),
      ...this.mistakeCache[topicId].map((question) => question.display)
    ];

    return Array.from(new Set([
      ...this.displayHistory[topicId],
      ...queuedDisplays
    ])).slice(-10);
  }

  _appendQuestions(topicId, questions) {
    this._ensureTopicState(topicId);
    questions.forEach((question) => {
      if (!question || this._questionExists(topicId, question)) {
        return;
      }

      this.pool[topicId].push(question);
      this._rememberDisplay(topicId, question.display);
    });
  }

  _questionExists(topicId, question) {
    this._ensureTopicState(topicId);
    return this.displayHistory[topicId].includes(question.display)
      || this.pool[topicId].some((entry) => entry.cacheKey === question.cacheKey)
      || this.mistakeCache[topicId].some((entry) => entry.cacheKey === question.cacheKey);
  }

  _rememberDisplay(topicId, display) {
    this._ensureTopicState(topicId);
    if (!this.displayHistory[topicId].includes(display)) {
      this.displayHistory[topicId].push(display);
      if (this.displayHistory[topicId].length > QUESTION_HISTORY_LIMIT) {
        this.displayHistory[topicId].shift();
      }
    }
  }

  _buildQuestion(topicId) {
    switch (topicId) {
      case 'articles':
        return this._buildArticleQuestion();
      case 'wordOrder':
        return this._buildWordOrderQuestion();
      case 'modals':
        return this._buildTemplateChoiceQuestion(this.lexicalTheme.modalTemplates);
      case 'past':
        return this._buildTemplateChoiceQuestion(this.lexicalTheme.pastTemplates);
      case 'prepositions':
        return this._buildPrepositionQuestion();
      case 'separable':
        return this._buildTemplateChoiceQuestion(this.lexicalTheme.separableTemplates);
      default:
        return null;
    }
  }

  _buildArticleQuestion() {
    const noun = pickRandom(this.lexicalTheme.nouns);
    const options = shuffleArray(['der', 'die', 'das', 'dem']);
    return {
      text: `Подбери правильный артикль к слову «${noun.ru}».`,
      display: `___ ${noun.word}`,
      options,
      correctIndex: options.indexOf(noun.article)
    };
  }

  _buildWordOrderQuestion() {
    const template = pickRandom(this.lexicalTheme.wordOrderTemplates);
    const correct = `${template.timeFront} ${template.verb} ${template.subject} ${template.tail}.`;
    const options = [
      correct,
      `${template.timeFront} ${template.subject} ${template.verb} ${template.tail}.`,
      `${template.subject} ${template.timeInline} ${template.verb} ${template.tail}.`,
      `${template.verb} ${template.subject} ${template.timeInline} ${template.tail}.`
    ];

    return {
      text: 'Собери нейтральное немецкое утверждение без ломаного порядка слов.',
      display: `${template.timeFront} / ${template.subject} / ${template.verb} / ${template.tail}`,
      options,
      correctIndex: 0
    };
  }

  _buildTemplateChoiceQuestion(items) {
    const template = pickRandom(items);
    const options = [template.correct, ...template.wrongs];
    return {
      text: template.text,
      display: template.display,
      options,
      correctIndex: 0
    };
  }

  _buildPrepositionQuestion() {
    const template = pickRandom(this.lexicalTheme.prepositionTemplates);
    const options = shuffleArray([template.correct, ...template.wrongs]);
    return {
      text: template.text,
      display: template.display,
      options,
      correctIndex: options.indexOf(template.correct)
    };
  }

  _formatQuestion(rawQuestion, topicId) {
    const topic = findSessionTopic(topicId);
    const shuffled = rawQuestion.options.map((option, index) => ({
      value: option,
      correct: index === rawQuestion.correctIndex
    }));
    const options = shuffleArray(shuffled);

    return {
      topicId,
      topicTitle: topic.title,
      level: this.level,
      text: rawQuestion.text,
      display: rawQuestion.display,
      cacheKey: rawQuestion.cacheKey || this._createQuestionCacheKey(topicId, rawQuestion.display, rawQuestion.options),
      options: {
        options: options.map((option) => option.value),
        correctIndex: options.findIndex((option) => option.correct)
      }
    };
  }

  _normalizeRemoteQuestion(question, topicId) {
    if (!question || typeof question.text !== 'string' || typeof question.display !== 'string' || !Array.isArray(question.options)) {
      return null;
    }

    const correctIndex = Number.isInteger(question.correctIndex) ? question.correctIndex : question.correct;
    if (!Number.isInteger(correctIndex) || question.options.length !== 4 || correctIndex < 0 || correctIndex > 3) {
      return null;
    }

    return this._formatQuestion({
      text: question.text.trim(),
      display: question.display.trim(),
      options: question.options.map((option) => `${option}`),
      correctIndex
    }, topicId);
  }

  _cloneQuestion(question) {
    return {
      topicId: question.topicId,
      topicTitle: question.topicTitle,
      level: question.level,
      text: question.text,
      display: question.display,
      cacheKey: question.cacheKey,
      options: {
        options: [...question.options.options],
        correctIndex: question.options.correctIndex
      }
    };
  }

  _createQuestionCacheKey(topicId, display, options) {
    return `${topicId}::${display}::${options.join('||')}`;
  }

  _fallbackQuestion(topicId) {
    const topic = findSessionTopic(topicId);
    return {
      topicId,
      topicTitle: topic.title,
      level: this.level,
      text: 'Выбери короткий безопасный ответ, чтобы не тормозить сессию.',
      display: 'Alles klar.',
      cacheKey: `${topicId}::fallback`,
      options: {
        options: ['Alles klar.', 'Ich gehen jetzt.', 'Heute ich bin hier.', 'Das Weg ist lang.'],
        correctIndex: 0
      }
    };
  }
}
