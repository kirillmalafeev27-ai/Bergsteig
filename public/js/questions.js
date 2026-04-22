const DEFAULT_CEFR_LEVEL = 'A2';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const LEXICAL_TOPICS = [
  'Familie',
  'Freundschaft',
  'Wohnen',
  'Hausarbeit',
  'Schule',
  'Universität',
  'Arbeit',
  'Bewerbung',
  'Reisen',
  'Hotel',
  'Stadt',
  'Landleben',
  'Essen und Trinken',
  'Restaurant',
  'Einkaufen',
  'Kleidung',
  'Gesundheit',
  'Körper',
  'Sport',
  'Freizeit',
  'Musik',
  'Filme und Serien',
  'Natur',
  'Umwelt',
  'Verkehr',
  'Technik',
  'Internet',
  'Bücher',
  'Wetter',
  'Feiertage',
  'Notfälle',
  'Berge',
  'Camping',
  'Tiere',
  'Kunst',
  'Medien',
  'Politik',
  'Alltag',
  'Zeitmanagement',
  'Büroarbeit',
  'Kundenservice',
  'Studium im Ausland',
  'Migration',
  'Wohnungssuche',
  'Finanzen',
  'Termine',
  'Kommunikation',
  'Gefühle',
  'Urlaub am Meer',
  'Winterurlaub'
];

const GRAMMAR_TOPICS = [
  'Präsens',
  'Perfekt',
  'Präteritum',
  'Futur I',
  'Imperativ',
  'Modalverben',
  'Trennbare Verben',
  'Untrennbare Verben',
  'Reflexive Verben',
  'Verben mit Präpositionen',
  'Lassen',
  'Werden',
  'Sein vs. haben',
  'Nominativ',
  'Akkusativ',
  'Dativ',
  'Genitiv',
  'Artikel',
  'Possessivartikel',
  'Pronomen',
  'Personalpronomen',
  'Relativpronomen',
  'Fragewörter',
  'Negation',
  'Adjektivdeklination',
  'Komparativ',
  'Superlativ',
  'Zahlen und Datum',
  'Temporale Präpositionen',
  'Lokale Präpositionen',
  'Wechselpräpositionen',
  'Präpositionen mit Dativ',
  'Präpositionen mit Akkusativ',
  'Satzklammer',
  'Wortstellung im Hauptsatz',
  'Wortstellung im Nebensatz',
  'weil-Sätze',
  'dass-Sätze',
  'wenn-Sätze',
  'obwohl-Sätze',
  'damit-Sätze',
  'Relativsätze',
  'Indirekte Fragen',
  'Infinitiv mit zu',
  'Konjunktiv II',
  'Passiv',
  'Plusquamperfekt',
  'Doppelkonjunktionen',
  'als vs. wenn',
  'Partizip I und II',
  'Genitivpräpositionen'
];

const BONUS_SLOTS = [
  {
    id: 'climb',
    bonusLabel: '+2 хода вверх',
    help: 'Продвигает альпиниста вверх по тросу сразу на два шага.',
    cooldownMs: 0
  },
  {
    id: 'sidestep',
    bonusLabel: 'Рывок на 1 линию',
    help: 'На кнопке есть две отдельные половины: влево и вправо. Верный ответ сразу смещает на соседнюю линию в выбранную сторону.',
    cooldownMs: 0,
    splitDirections: true
  },
  {
    id: 'powerSwing',
    bonusLabel: 'Сильный рывок',
    help: 'Тоже разделён на две половины: влево и вправо. Верный ответ сразу запускает сильный рывок в выбранную сторону.',
    cooldownMs: 0,
    splitDirections: true
  },
  {
    id: 'snowShield',
    bonusLabel: 'Снежный щит',
    help: 'Поглощает одну лавину или тяжёлую волну снега. Кулдаун 3 минуты.',
    cooldownMs: 180000
  },
  {
    id: 'cleanLens',
    bonusLabel: 'Очистка камеры',
    help: 'Убирает налипший снег и резко возвращает читаемость сцены.',
    cooldownMs: 0
  }
];

const NAMES = ['Mia', 'Noah', 'Lina', 'Jonas', 'Ella', 'Paul', 'Sara', 'Leon'];
const TIMES = ['heute', 'morgen', 'am Abend', 'nach dem Kurs', 'im Winter', 'vor der Tour'];
const PLACES = ['im Camp', 'am Bahnhof', 'in der Hütte', 'im Büro', 'im Dorf', 'im Kursraum'];
const ADJECTIVES = ['warm', 'ruhig', 'frisch', 'lang', 'steil', 'klar', 'klein', 'sicher'];

const VERB_BANK = [
  { inf: 'packen', praesens: 'packt', praeteritum: 'packte', perfekt: 'hat gepackt', plusquamperfekt: 'hatte gepackt', futur: 'wird packen' },
  { inf: 'prüfen', praesens: 'prüft', praeteritum: 'prüfte', perfekt: 'hat geprüft', plusquamperfekt: 'hatte geprüft', futur: 'wird prüfen' },
  { inf: 'tragen', praesens: 'trägt', praeteritum: 'trug', perfekt: 'hat getragen', plusquamperfekt: 'hatte getragen', futur: 'wird tragen' },
  { inf: 'finden', praesens: 'findet', praeteritum: 'fand', perfekt: 'hat gefunden', plusquamperfekt: 'hatte gefunden', futur: 'wird finden' },
  { inf: 'bauen', praesens: 'baut', praeteritum: 'baute', perfekt: 'hat gebaut', plusquamperfekt: 'hatte gebaut', futur: 'wird bauen' },
  { inf: 'organisieren', praesens: 'organisiert', praeteritum: 'organisierte', perfekt: 'hat organisiert', plusquamperfekt: 'hatte organisiert', futur: 'wird organisieren' }
];

const MODAL_BANK = [
  { modal: 'muss', inf: 'bleiben' },
  { modal: 'kann', inf: 'helfen' },
  { modal: 'will', inf: 'lernen' },
  { modal: 'darf', inf: 'gehen' }
];

const CASE_NOUNS = [
  { base: 'Berg', nom: 'der', acc: 'den', dat: 'dem', gen: 'des' },
  { base: 'Kurs', nom: 'der', acc: 'den', dat: 'dem', gen: 'des' },
  { base: 'Jacke', nom: 'die', acc: 'die', dat: 'der', gen: 'der' },
  { base: 'Karte', nom: 'die', acc: 'die', dat: 'der', gen: 'der' },
  { base: 'Zelt', nom: 'das', acc: 'das', dat: 'dem', gen: 'des' },
  { base: 'Hotel', nom: 'das', acc: 'das', dat: 'dem', gen: 'des' }
];

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lexicalLead(topic) {
  return `Контекст сессии: ${topic}.`;
}

function buildQuestion(grammarTopic, lexicalTopic) {
  if (/Perfekt|Präteritum|Präsens|Futur I|Plusquamperfekt|Sein vs\. haben|Werden|Lassen/.test(grammarTopic)) {
    return makeVerbQuestion(grammarTopic, lexicalTopic);
  }
  if (/Imperativ/.test(grammarTopic)) {
    return makeImperativeQuestion(grammarTopic, lexicalTopic);
  }
  if (/Modalverben/.test(grammarTopic)) {
    return makeModalQuestion(grammarTopic, lexicalTopic);
  }
  if (/Trennbare|Untrennbare|Reflexive/.test(grammarTopic)) {
    return makeSpecialVerbQuestion(grammarTopic, lexicalTopic);
  }
  if (/Nominativ|Akkusativ|Dativ|Genitiv|Artikel|Possessivartikel|Adjektivdeklination/.test(grammarTopic)) {
    return makeCaseQuestion(grammarTopic, lexicalTopic);
  }
  if (/Pronomen|Relativpronomen|Fragewörter/.test(grammarTopic)) {
    return makePronounQuestion(grammarTopic, lexicalTopic);
  }
  if (/Negation/.test(grammarTopic)) {
    return makeNegationQuestion(grammarTopic, lexicalTopic);
  }
  if (/Komparativ|Superlativ/.test(grammarTopic)) {
    return makeComparisonQuestion(grammarTopic, lexicalTopic);
  }
  if (/Präpositionen|Präposition|Temporale|Lokale|Wechsel|Genitivpräpositionen/.test(grammarTopic)) {
    return makePrepositionQuestion(grammarTopic, lexicalTopic);
  }
  if (/Satzklammer|Wortstellung|weil-Sätze|dass-Sätze|wenn-Sätze|obwohl-Sätze|damit-Sätze|Relativsätze|Indirekte Fragen|Infinitiv mit zu|Doppelkonjunktionen|als vs\. wenn/.test(grammarTopic)) {
    return makeSyntaxQuestion(grammarTopic, lexicalTopic);
  }
  if (/Konjunktiv II/.test(grammarTopic)) {
    return makeKonjunktivQuestion(grammarTopic, lexicalTopic);
  }
  if (/Passiv/.test(grammarTopic)) {
    return makePassiveQuestion(grammarTopic, lexicalTopic);
  }
  if (/Zahlen und Datum/.test(grammarTopic)) {
    return makeDateQuestion(grammarTopic, lexicalTopic);
  }
  if (/Partizip I und II/.test(grammarTopic)) {
    return makeParticipleQuestion(grammarTopic, lexicalTopic);
  }
  return makeDefaultQuestion(grammarTopic, lexicalTopic);
}

function makeVerbQuestion(grammarTopic, lexicalTopic) {
  const name = pick(NAMES);
  const verb = pick(VERB_BANK);
  const time = pick(TIMES);
  const place = pick(PLACES);

  if (/Perfekt/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму Perfekt для темы "${grammarTopic}".`,
      display: `${name} ___ ${time} die Ausrüstung ${place}.`,
      options: [`${verb.perfekt}`, `ist ${verb.inf}`, `wird ${verb.inf}`, `${verb.praeteritum}`],
      correct: 0
    };
  }

  if (/Präteritum/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна форма Präteritum.`,
      display: `${name} ___ ${time} die Route ${place}.`,
      options: [`${verb.praeteritum}`, `${verb.perfekt}`, `${verb.futur}`, `${verb.praesens}`],
      correct: 0
    };
  }

  if (/Futur I/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери вариант Futur I.`,
      display: `${time} ___ ${name} die Liste ${place} ___.`,
      options: ['wird prüfen', 'hat geprüft', 'prüfte', 'prüft'],
      correct: 0
    };
  }

  if (/Plusquamperfekt/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму Plusquamperfekt.`,
      display: `Bevor der Bus kam, ___ ${name} das Ticket schon ___.`,
      options: [`${verb.plusquamperfekt}`, `${verb.perfekt}`, `${verb.praeteritum}`, `${verb.futur}`],
      correct: 0
    };
  }

  if (/Sein vs\. haben/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный вспомогательный глагол.`,
      display: `${name} ___ heute früh ins Camp gegangen.`,
      options: ['ist', 'hat', 'wird', 'war'],
      correct: 0
    };
  }

  if (/Werden/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна правильная форма "werden".`,
      display: `${name} ___ bald ein neues Seil kaufen.`,
      options: ['wird', 'werde', 'wurde', 'worden'],
      correct: 0
    };
  }

  if (/Lassen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери естественную конструкцию с "lassen".`,
      display: `${name} ___ den Rucksack im Flur stehen.`,
      options: ['lässt', 'lasst', 'ließet', 'gelassen'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери форму Präsens.`,
    display: `${name} ___ ${time} die Karte ${place}.`,
    options: [`${verb.praesens}`, `${verb.perfekt}`, `${verb.praeteritum}`, `${verb.futur}`],
    correct: 0
  };
}

function makeImperativeQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери форму Imperativ.`,
    display: `___ bitte die Kamera, bevor der Schnee alles verdeckt!`,
    options: ['Reinige', 'Reinigst', 'Reinigt', 'Reinigen'],
    correct: 0
  };
}

function makeModalQuestion(grammarTopic, lexicalTopic) {
  const modal = pick(MODAL_BANK);
  const name = pick(NAMES);
  return {
    text: `${lexicalLead(lexicalTopic)} Нужен правильный вариант с модальным глаголом.`,
    display: `${name} ___ heute länger im Camp ${modal.inf}.`,
    options: [modal.modal, `${modal.inf}`, `${modal.modal}t`, 'hat'],
    correct: 0
  };
}

function makeSpecialVerbQuestion(grammarTopic, lexicalTopic) {
  if (/Trennbare/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери предложение с separable verb.`,
      display: `Welcher Satz ist richtig?`,
      options: [
        'Mia steht jeden Morgen früh auf.',
        'Mia aufsteht jeden Morgen früh.',
        'Mia steht auf jeden Morgen früh.',
        'Mia ist früh jeden Morgen aufsteht.'
      ],
      correct: 0
    };
  }

  if (/Untrennbare/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильное предложение с untrennbarem Verb.`,
      display: `Welcher Satz klingt natürlich?`,
      options: [
        'Jonas besucht heute seine Freundin im Dorf.',
        'Jonas sucht heute seine Freundin be im Dorf.',
        'Jonas be sucht heute seine Freundin im Dorf.',
        'Jonas hat heute seine Freundin be sucht.'
      ],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери правильный reflexiven Ausdruck.`,
    display: `Nach der Tour ___ Lina kurz aus.`,
    options: ['ruht sich', 'ruht', 'sich ruht', 'ist ruhen'],
    correct: 0
  };
}

function makeCaseQuestion(grammarTopic, lexicalTopic) {
  const noun = pick(CASE_NOUNS);

  if (/Nominativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери артикль для подлежащего.`,
      display: `___ ${noun.base} ist heute sehr wichtig.`,
      options: [noun.nom, noun.acc, noun.dat, noun.gen],
      correct: 0
    };
  }

  if (/Akkusativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна форма Akkusativ.`,
      display: `Wir sehen ___ ${noun.base} von oben.`,
      options: [noun.acc, noun.nom, noun.dat, noun.gen],
      correct: 0
    };
  }

  if (/Dativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна форма Dativ.`,
      display: `Wir helfen ___ ${noun.base} heute.`,
      options: [noun.dat, noun.acc, noun.nom, noun.gen],
      correct: 0
    };
  }

  if (/Genitiv/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна форма Genitiv.`,
      display: `Die Farbe ___ ${noun.base} ist auffällig.`,
      options: [noun.gen, noun.nom, noun.acc, noun.dat],
      correct: 0
    };
  }

  if (/Possessivartikel/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери подходящий Possessivartikel.`,
      display: `Mia sucht ___ Jacke vor der Tour.`,
      options: ['ihre', 'sein', 'euer', 'unsere'],
      correct: 0
    };
  }

  if (/Adjektivdeklination/.test(grammarTopic)) {
    const adjective = pick(ADJECTIVES);
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна правильная форма прилагательного.`,
      display: `Wir sehen einen ___ Weg.`,
      options: [`${adjective}en`, `${adjective}e`, `${adjective}er`, `${adjective}em`],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректный артикль.`,
    display: `Ich nehme ___ Karte mit.`,
    options: ['die', 'der', 'dem', 'des'],
    correct: 0
  };
}

function makePronounQuestion(grammarTopic, lexicalTopic) {
  if (/Relativpronomen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Подбери Relativpronomen.`,
      display: `Das ist der Guide, ___ uns heute hilft.`,
      options: ['der', 'den', 'dem', 'dessen'],
      correct: 0
    };
  }

  if (/Fragewörter/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери подходящее вопросительное слово.`,
      display: `___ kostet das Ticket für die Seilbahn?`,
      options: ['Wie viel', 'Wann', 'Woher', 'Warum nicht'],
      correct: 0
    };
  }

  if (/Personalpronomen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен Personalpronomen.`,
      display: `Lina kennt Paul gut. Sie ruft ___ später an.`,
      options: ['ihn', 'er', 'ihm', 'sein'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректное местоимение.`,
    display: `Mia hat die Karte. Kannst du ___ bitte geben?`,
    options: ['sie', 'ihr', 'ihn', 'es'],
    correct: 0
  };
}

function makeNegationQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери естественное отрицание.`,
    display: `Heute gibt es ___ freien Platz im Zug.`,
    options: ['keinen', 'nicht', 'kein', 'nichts'],
    correct: 0
  };
}

function makeComparisonQuestion(grammarTopic, lexicalTopic) {
  if (/Superlativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен Superlativ.`,
      display: `Das ist der ___ Weg zur Hütte.`,
      options: ['sicherste', 'sicherer', 'am sicher', 'mehr sicherste'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Нужен Komparativ.`,
    display: `Heute ist der Wind ___ als gestern.`,
    options: ['stärker', 'am stärksten', 'stark', 'mehr stark'],
    correct: 0
  };
}

function makePrepositionQuestion(grammarTopic, lexicalTopic) {
  if (/Genitivpräpositionen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери предлог с Genitiv.`,
      display: `___ des Sturms gehen wir weiter.`,
      options: ['Trotz', 'Mit', 'Bei', 'Nach'],
      correct: 0
    };
  }

  if (/Temporale/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна temporale Präposition.`,
      display: `Wir treffen uns ___ dem Unterricht.`,
      options: ['nach', 'unter', 'gegenüber', 'ohne'],
      correct: 0
    };
  }

  if (/Lokale/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна lokale Präposition.`,
      display: `Das kleine Hotel liegt ___ dem Bahnhof.`,
      options: ['neben', 'während', 'trotz', 'seit'],
      correct: 0
    };
  }

  if (/Wechsel/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери пример с Wechselpräposition.`,
      display: `Wir legen die Karte ___ den Tisch.`,
      options: ['auf', 'mit', 'seit', 'gegen'],
      correct: 0
    };
  }

  if (/mit Dativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен предлог с Dativ.`,
      display: `Mia fährt heute ___ dem Bus.`,
      options: ['mit', 'für', 'ohne', 'gegen'],
      correct: 0
    };
  }

  if (/mit Akkusativ/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен предлог с Akkusativ.`,
      display: `Wir gehen ___ den Wald.`,
      options: ['durch', 'mit', 'aus', 'bei'],
      correct: 0
    };
  }

  if (/Verben mit Präpositionen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильную Präposition после глагола.`,
      display: `Wir warten ___ den Bus.`,
      options: ['auf', 'an', 'zu', 'mit'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректный предлог.`,
    display: `Wir sprechen heute ___ unsere Reise.`,
    options: ['über', 'zwischen', 'durch', 'seit'],
    correct: 0
  };
}

function makeSyntaxQuestion(grammarTopic, lexicalTopic) {
  if (/Wortstellung im Hauptsatz|Satzklammer/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный порядок слов в Hauptsatz.`,
      display: `Welcher Satz ist richtig?`,
      options: [
        'Heute fährt Mia früh zur Hütte.',
        'Heute Mia fährt früh zur Hütte.',
        'Fährt heute Mia früh zur Hütte.',
        'Heute früh zur Hütte fährt Mia.'
      ],
      correct: 0
    };
  }

  if (/Wortstellung im Nebensatz|weil-Sätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна правильная Wortstellung в Nebensatz.`,
      display: `Ich bleibe heute im Camp, weil ...`,
      options: [
        'der Wind zu stark ist.',
        'ist der Wind zu stark.',
        'der Wind ist zu stark.',
        'zu stark der Wind ist.'
      ],
      correct: 0
    };
  }

  if (/dass-Sätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректное продолжение с "dass".`,
      display: `Ich glaube, dass ...`,
      options: [
        'die Gruppe heute früher startet.',
        'die Gruppe startet heute früher.',
        'startet die Gruppe heute früher.',
        'heute früher startet die Gruppe.'
      ],
      correct: 0
    };
  }

  if (/wenn-Sätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери предложение с "wenn".`,
      display: `___ es schneit, bleiben wir in der Hütte.`,
      options: ['Wenn', 'Als', 'Damit', 'Obwohl'],
      correct: 0
    };
  }

  if (/obwohl-Sätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный вариант с "obwohl".`,
      display: `Wir gehen weiter, obwohl ...`,
      options: [
        'der Weg sehr schwierig ist.',
        'ist der Weg sehr schwierig.',
        'der Weg ist sehr schwierig.',
        'sehr schwierig der Weg ist.'
      ],
      correct: 0
    };
  }

  if (/damit-Sätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери предложение с целью.`,
      display: `Wir prüfen die Seile, damit ...`,
      options: [
        'niemand abrutscht.',
        'niemand rutscht ab.',
        'rutscht niemand ab.',
        'niemand abgerutscht ist.'
      ],
      correct: 0
    };
  }

  if (/Relativsätze/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный Relativsatz.`,
      display: `Das ist die Lampe, ...`,
      options: [
        'die wir gestern gekauft haben.',
        'wir gestern gekauft haben die.',
        'die haben wir gestern gekauft.',
        'haben wir gestern gekauft die.'
      ],
      correct: 0
    };
  }

  if (/Indirekte Fragen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери Indirekte Frage.`,
      display: `Weißt du, ...`,
      options: [
        'wann der Zug abfährt?',
        'wann fährt der Zug ab?',
        'wann der Zug fährt ab?',
        'der Zug wann abfährt?'
      ],
      correct: 0
    };
  }

  if (/Infinitiv mit zu/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери конструкцию с Infinitiv mit zu.`,
      display: `Wir versuchen, ...`,
      options: [
        'pünktlich anzukommen.',
        'wir kommen pünktlich an.',
        'pünktlich angekommen.',
        'anzukommen pünktlich wir.'
      ],
      correct: 0
    };
  }

  if (/Doppelkonjunktionen/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректную двойную связь.`,
      display: `___ die Strecke ist lang, ___ die Aussicht ist großartig.`,
      options: [
        'Nicht nur / sondern auch',
        'Sowohl / aber',
        'Weder / auch',
        'Entweder / trotzdem'
      ],
      correct: 0
    };
  }

  if (/als vs\. wenn/.test(grammarTopic)) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный союз.`,
      display: `___ ich klein war, fuhr ich oft in die Berge.`,
      options: ['Als', 'Wenn', 'Ob', 'Damit'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери самый естественный порядок слов.`,
    display: `Welcher Satz ist richtig?`,
    options: [
      'Morgen treffen wir uns am frühen Morgen im Dorf.',
      'Morgen wir treffen uns am frühen Morgen im Dorf.',
      'Treffen wir uns morgen am frühen Morgen im Dorf.',
      'Morgen am frühen Morgen im Dorf wir treffen uns.'
    ],
    correct: 0
  };
}

function makeKonjunktivQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Нужен Konjunktiv II.`,
    display: `Wenn ich mehr Zeit hätte, ...`,
    options: [
      'würde ich länger in den Bergen bleiben.',
      'bleibe ich länger in den Bergen.',
      'habe ich länger in den Bergen geblieben.',
      'ich würde länger in den Bergen bleibe.'
    ],
    correct: 0
  };
}

function makePassiveQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректное Passiv.`,
    display: `Die Hütte ___ morgen renoviert.`,
    options: ['wird', 'hat', 'ist werden', 'werden'],
    correct: 0
  };
}

function makeDateQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери естественный вариант даты.`,
    display: `Unser Kurs beginnt ___ dritten Mai.`,
    options: ['am', 'im', 'an den', 'zu'],
    correct: 0
  };
}

function makeParticipleQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректный Partizip-Ausdruck.`,
    display: `Der ___ Schnee macht den Weg gefährlich.`,
    options: ['fallende', 'gefallte', 'fallen', 'gefallenee'],
    correct: 0
  };
}

function makeDefaultQuestion(grammarTopic, lexicalTopic) {
  const name = pick(NAMES);
  return {
    text: `${lexicalLead(lexicalTopic)} Быстро выбери грамматически правильный вариант по теме "${grammarTopic}".`,
    display: `${name} sucht heute einen ruhigen Platz im Camp.`,
    options: [
      `${name} sucht heute einen ruhigen Platz im Camp.`,
      `${name} suchen heute einen ruhigen Platz im Camp.`,
      `${name} sucht heute ein ruhiger Platz im Camp.`,
      `${name} hat heute einen ruhigen Platz im Camp sucht.`
    ],
    correct: 0
  };
}

class QuestionManager {
  constructor(level = DEFAULT_CEFR_LEVEL) {
    this.level = level;
    this.lexicalTopic = LEXICAL_TOPICS[0];
    this.slots = [];
    this.history = Object.create(null);
  }

  setLevel(level) {
    this.level = level || DEFAULT_CEFR_LEVEL;
  }

  setLexicalTopic(topic) {
    this.lexicalTopic = topic || LEXICAL_TOPICS[0];
  }

  configureSlots(slotConfigs) {
    this.slots = slotConfigs.filter(Boolean);
    this.history = Object.create(null);
  }

  getQuestion(slotId) {
    const slotConfig = this.slots.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return null;
    }

    let question = null;
    let attempts = 0;
    const memory = this.history[slotId] || new Set();

    do {
      question = buildQuestion(slotConfig.grammarTopic, this.lexicalTopic, this.level);
      attempts += 1;
    } while (memory.has(question.display) && attempts < 8);

    memory.add(question.display);
    this.history[slotId] = memory;

    const shuffled = shuffleArray(
      question.options.map((option, index) => ({
        option,
        correct: index === question.correct
      }))
    );

    return {
      slotId,
      slotDef: slotConfig.slotDef,
      grammarTopic: slotConfig.grammarTopic,
      level: this.level,
      text: question.text,
      display: question.display,
      options: {
        options: shuffled.map((item) => item.option),
        correctIndex: shuffled.findIndex((item) => item.correct)
      }
    };
  }
}
