const DEFAULT_CEFR_LEVEL = 'A2';
const DEFAULT_LANGUAGE = 'de';

const LANGUAGE_OPTIONS = [
  {
    id: 'de',
    nativeLabel: 'Deutsch',
    uiLabel: 'Немецкий',
    teaser: 'Artikel, Prateritum, Nebensatze',
    copy: 'Полный немецкий маршрут: свои темы, свои карточки и свои вопросы.'
  },
  {
    id: 'fr',
    nativeLabel: 'Francais',
    uiLabel: 'Французский',
    teaser: 'Accords, pronoms, subjonctif',
    copy: 'Отдельный французский маршрут без смешивания с немецким набором.'
  }
];

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

const FRENCH_LEXICAL_TOPICS = [
  'Famille',
  'Amitie',
  'Logement',
  'Taches menageres',
  'Ecole',
  'Universite',
  'Travail',
  'Candidature',
  'Voyages',
  'Hotel',
  'Ville',
  'Vie a la campagne',
  'Cuisine et boissons',
  'Restaurant',
  'Courses',
  'Vetements',
  'Sante',
  'Corps',
  'Sport',
  'Loisirs',
  'Musique',
  'Films et series',
  'Nature',
  'Environnement',
  'Transport',
  'Technologie',
  'Internet',
  'Livres',
  'Meteo',
  'Fetes',
  'Urgences',
  'Montagne',
  'Camping',
  'Animaux',
  'Art',
  'Medias',
  'Politique',
  'Vie quotidienne',
  'Gestion du temps',
  'Travail de bureau',
  'Service client',
  'Etudes a letranger',
  'Migration',
  'Recherche de logement',
  'Finances',
  'Rendez-vous',
  'Communication',
  'Emotions',
  'Vacances a la mer',
  'Vacances dhiver'
];

const FRENCH_GRAMMAR_TOPICS = [
  'Present',
  'Passe compose',
  'Imparfait',
  'Futur proche',
  'Futur simple',
  'Imperatif',
  'Pouvoir, vouloir, devoir',
  'Verbes pronominaux',
  'Verbes avec etre',
  'Verbes avec a / de',
  'Infinitif',
  'Faire + infinitif',
  'Etre vs. avoir',
  'Articles definis',
  'Articles indefinis',
  'Articles partitifs',
  'Noms au pluriel',
  'Articles contractes',
  'Possessifs',
  'Pronoms',
  'Pronoms sujets',
  'Pronoms toniques',
  'Pronoms COD',
  'Pronoms COI',
  'Adjectifs',
  'Accord des adjectifs',
  'Comparatif',
  'Superlatif',
  'Nombres et date',
  'Prepositions de temps',
  'Prepositions de lieu',
  'A / en / au / aux',
  'Depuis / pendant / pour',
  'Il y a / depuis',
  'Negation',
  'Questions',
  'Est-ce que',
  'Inversion',
  'Cest / il est',
  'Pronoms relatifs qui / que',
  'Pronoms relatifs ou / dont',
  'Connecteurs logiques',
  'Parce que / puisque / comme',
  'Quand / lorsque / pendant que',
  'Avant de / apres avoir',
  'Conditionnel present',
  'Subjonctif present',
  'Si + imparfait',
  'Passif',
  'Gerondif',
  'Plus-que-parfait'
];

const LANGUAGE_CONFIGS = {
  de: {
    id: 'de',
    uiLabel: 'Немецкий',
    playerPlaceholder: 'Например, Лея',
    defaultPlayerName: 'Spieler',
    levelLabel: 'Уровень немецкого (CEFR)',
    step1Text: 'Выберите язык сессии, уровень и имя альпиниста. Для немецкого откроются только немецкие темы и немецкие вопросы.',
    step2Text: 'Одна тема на всю сессию. Она задаёт рамку для упражнений по немецкому и настроение карточек во время подъёма.',
    grammarLabel: 'Доступные грамматические темы по немецкому',
    lexicalTopics: LEXICAL_TOPICS,
    grammarTopics: GRAMMAR_TOPICS
  },
  fr: {
    id: 'fr',
    uiLabel: 'Французский',
    playerPlaceholder: 'Например, Lea',
    defaultPlayerName: 'Joueur',
    levelLabel: 'Уровень французского (CEFR)',
    step1Text: 'Выберите язык сессии, уровень и имя альпиниста. Для французского откроются только французские темы и французские вопросы.',
    step2Text: 'Одна тема на всю сессию. Она задаёт рамку для упражнений по французскому и настроение карточек во время подъёма.',
    grammarLabel: 'Доступные грамматические темы по французскому',
    lexicalTopics: FRENCH_LEXICAL_TOPICS,
    grammarTopics: FRENCH_GRAMMAR_TOPICS
  }
};

function getLanguageConfig(language = DEFAULT_LANGUAGE) {
  return LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS[DEFAULT_LANGUAGE];
}

function getLanguageLexicalTopics(language = DEFAULT_LANGUAGE) {
  return getLanguageConfig(language).lexicalTopics;
}

function getLanguageGrammarTopics(language = DEFAULT_LANGUAGE) {
  return getLanguageConfig(language).grammarTopics;
}

function normalizeTopicKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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

const FRENCH_NAMES = ['Lea', 'Noah', 'Camille', 'Jules', 'Ines', 'Louis', 'Manon', 'Hugo'];
const FRENCH_TIMES = ["aujourd'hui", 'demain', 'ce soir', 'apres le cours', 'en hiver', 'avant la sortie'];
const FRENCH_PLACES = ['au camp', 'a la gare', 'au refuge', 'au bureau', 'au village', 'en classe'];
const FRENCH_ADJECTIVES = ['calme', 'utile', 'chaud', 'long', 'raide', 'clair', 'petit', 'sur'];
const FRENCH_VERB_BANK = [
  { inf: 'preparer', present: 'prepare', passeCompose: 'a prepare', imparfait: 'preparait', futurSimple: 'preparera', plusQueParfait: 'avait prepare' },
  { inf: 'verifier', present: 'verifie', passeCompose: 'a verifie', imparfait: 'verifiait', futurSimple: 'verifiera', plusQueParfait: 'avait verifie' },
  { inf: 'porter', present: 'porte', passeCompose: 'a porte', imparfait: 'portait', futurSimple: 'portera', plusQueParfait: 'avait porte' },
  { inf: 'trouver', present: 'trouve', passeCompose: 'a trouve', imparfait: 'trouvait', futurSimple: 'trouvera', plusQueParfait: 'avait trouve' },
  { inf: 'organiser', present: 'organise', passeCompose: 'a organise', imparfait: 'organisait', futurSimple: 'organisera', plusQueParfait: 'avait organise' }
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

function buildQuestion(grammarTopic, lexicalTopic, level = DEFAULT_CEFR_LEVEL, language = DEFAULT_LANGUAGE) {
  if (language === 'fr') {
    return buildFrenchQuestion(grammarTopic, lexicalTopic, level);
  }
  return buildGermanQuestion(grammarTopic, lexicalTopic, level);
}

function buildGermanQuestion(grammarTopic, lexicalTopic) {
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

function buildFrenchQuestion(grammarTopic, lexicalTopic) {
  const topicKey = normalizeTopicKey(grammarTopic);

  if (/passe compose|imparfait|present|futur proche|futur simple|plus-que-parfait|conditionnel present|subjonctif present|etre vs\. avoir/.test(topicKey)) {
    return makeFrenchVerbQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/imperatif/.test(topicKey)) {
    return makeFrenchImperativeQuestion(grammarTopic, lexicalTopic);
  }
  if (/pouvoir, vouloir, devoir/.test(topicKey)) {
    return makeFrenchModalQuestion(grammarTopic, lexicalTopic);
  }
  if (/verbes pronominaux|verbes avec etre/.test(topicKey)) {
    return makeFrenchSpecialVerbQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/verbes avec a \/ de|infinitif|faire \+ infinitif|gerondif/.test(topicKey)) {
    return makeFrenchInfinitiveQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/articles definis|articles indefinis|articles partitifs|noms au pluriel|articles contractes/.test(topicKey)) {
    return makeFrenchArticleQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/possessifs/.test(topicKey) || /demonstratifs/.test(topicKey)) {
    return makeFrenchDeterminerQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/pronoms/.test(topicKey)) {
    return makeFrenchPronounQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/adjectifs/.test(topicKey)) {
    return makeFrenchAdjectiveQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/comparatif|superlatif/.test(topicKey)) {
    return makeFrenchComparisonQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/nombres et date|prepositions de temps|prepositions de lieu|a \/ en \/ au \/ aux|depuis \/ pendant \/ pour|il y a \/ depuis/.test(topicKey)) {
    return makeFrenchPrepositionQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  if (/negation|questions|est-ce que|inversion|cest \/ il est|connecteurs logiques|parce que \/ puisque \/ comme|quand \/ lorsque \/ pendant que|avant de \/ apres avoir|si \+ imparfait|passif/.test(topicKey)) {
    return makeFrenchSyntaxQuestion(topicKey, grammarTopic, lexicalTopic);
  }
  return makeFrenchDefaultQuestion(grammarTopic, lexicalTopic);
}

function makeFrenchVerbQuestion(topicKey, grammarTopic, lexicalTopic) {
  const name = pick(FRENCH_NAMES);
  const verb = pick(FRENCH_VERB_BANK);
  const time = pick(FRENCH_TIMES);
  const place = pick(FRENCH_PLACES);

  if (topicKey.includes('passe compose')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму passe compose по теме "${grammarTopic}".`,
      display: `${name} ___ ${time} son sac ${place}.`,
      options: [verb.passeCompose, verb.imparfait, verb.futurSimple, verb.present],
      correct: 0
    };
  }

  if (topicKey.includes('imparfait')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна форма imparfait.`,
      display: `Quand il neigeait, ${name} ___ lentement ${place}.`,
      options: [verb.imparfait, verb.passeCompose, verb.futurSimple, verb.present],
      correct: 0
    };
  }

  if (topicKey.includes('futur proche')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери конструкцию futur proche.`,
      display: `Demain, ${name} ___ ${verb.inf} la route ${place}.`,
      options: ['va', 'a', 'avait', 'est'],
      correct: 0
    };
  }

  if (topicKey.includes('futur simple')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен futur simple.`,
      display: `Demain, ${name} ___ ${place}.`,
      options: [verb.futurSimple, verb.present, verb.passeCompose, `va ${verb.inf}`],
      correct: 0
    };
  }

  if (topicKey.includes('plus-que-parfait')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму plus-que-parfait.`,
      display: `Avant la tempete, ${name} ___ la corde ${place}.`,
      options: [verb.plusQueParfait, verb.passeCompose, verb.imparfait, verb.futurSimple],
      correct: 0
    };
  }

  if (topicKey.includes('conditionnel present')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен conditionnel present.`,
      display: `Avec plus de temps, ${name} ___ plus longtemps ${place}.`,
      options: ['resterait', 'restera', 'reste', 'est reste'],
      correct: 0
    };
  }

  if (topicKey.includes('subjonctif present')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму subjonctif present.`,
      display: `Il faut que tu ___ prudent ${place}.`,
      options: ['sois', 'es', 'seras', 'etais'],
      correct: 0
    };
  }

  if (topicKey.includes('etre vs. avoir')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный вспомогательный глагол.`,
      display: `${name} ___ monte au refuge ${time}.`,
      options: ['est', 'a', 'avait', 'sera'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери форму present.`,
    display: `${name} ___ ${time} ${place}.`,
    options: [verb.present, verb.passeCompose, verb.futurSimple, verb.imparfait],
    correct: 0
  };
}

function makeFrenchImperativeQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Выбери форму imperatif.`,
    display: `___ vite au refuge !`,
    options: ['Monte', 'Monter', 'Montes', 'Montait'],
    correct: 0
  };
}

function makeFrenchModalQuestion(grammarTopic, lexicalTopic) {
  return {
    text: `${lexicalLead(lexicalTopic)} Нужен вариант с pouvoir / vouloir / devoir.`,
    display: `Tu ___ prendre une lampe pour la nuit.`,
    options: ['dois', 'es', 'as', 'vas'],
    correct: 0
  };
}

function makeFrenchSpecialVerbQuestion(topicKey, grammarTopic, lexicalTopic) {
  const name = pick(FRENCH_NAMES);

  if (topicKey.includes('verbes avec etre')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректную форму с etre.`,
      display: `Hier, ${name} ___ au village avant la montee.`,
      options: ['est alle', 'a alle', 'va alle', 'allait'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректный verbe pronominal.`,
    display: `${name} ___ tot avant le depart.`,
    options: ['se leve', 'leve', 'sest leve', 'se lever'],
    correct: 0
  };
}

function makeFrenchInfinitiveQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('verbes avec a / de')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный предлог перед infinitif.`,
      display: `Nous essayons ___ partir tot demain.`,
      options: ['de', 'a', 'pour', 'en'],
      correct: 0
    };
  }

  if (topicKey.includes('faire + infinitif')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужна конструкция faire + infinitif.`,
      display: `Le guide fait ___ tout le groupe a laube.`,
      options: ['avancer', 'avance', 'avancee', 'avances'],
      correct: 0
    };
  }

  if (topicKey.includes('gerondif')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери gerondif.`,
      display: `Il monte ___ regardant la corde.`,
      options: ['en', 'a', 'de', 'par'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери конструкцию с infinitif.`,
    display: `Nous aimons ___ pres du refuge.`,
    options: ['marcher', 'marchons', 'marche', 'a marche'],
    correct: 0
  };
}

function makeFrenchArticleQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('articles definis')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери article defini.`,
      display: `___ montagne est haute aujourd'hui.`,
      options: ['La', 'Une', 'Du', 'Aux'],
      correct: 0
    };
  }

  if (topicKey.includes('articles indefinis')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери article indefini.`,
      display: `Nous cherchons ___ refuge pour la nuit.`,
      options: ['un', 'le', 'du', 'au'],
      correct: 0
    };
  }

  if (topicKey.includes('articles partitifs')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери article partitif.`,
      display: `Elle boit ___ eau apres la montee.`,
      options: ["de l'", 'la', 'les', 'au'],
      correct: 0
    };
  }

  if (topicKey.includes('noms au pluriel')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму pluriel.`,
      display: `Deux ___ arrivent au camp ce soir.`,
      options: ['amis', 'ami', 'amiss', 'amiz'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери article contracte.`,
    display: `Nous allons ___ village apres la lecon.`,
    options: ['au', 'a le', 'du', 'aux'],
    correct: 0
  };
}

function makeFrenchDeterminerQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('possessifs')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери possessif.`,
      display: `Cest ___ corde, pas la mienne.`,
      options: ['sa', 'son', 'ses', 'leur'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери demonstratif.`,
    display: `Je prends ___ veste-ci pour la neige.`,
    options: ['cette', 'ce', 'cet', 'ces'],
    correct: 0
  };
}

function makeFrenchPronounQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('relatifs qui / que')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom relatif.`,
      display: `Le sac ___ est rouge est sur la table.`,
      options: ['qui', 'que', 'ou', 'dont'],
      correct: 0
    };
  }

  if (topicKey.includes('relatifs ou / dont')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom relatif.`,
      display: `Le guide ___ je parle vient demain.`,
      options: ['dont', 'ou', 'que', 'qui'],
      correct: 0
    };
  }

  if (topicKey.includes('pronoms sujets')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom sujet.`,
      display: `___ arrive tot au refuge.`,
      options: ['Il', 'Le', 'Lui', 'Y'],
      correct: 0
    };
  }

  if (topicKey.includes('pronoms toniques')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom tonique.`,
      display: `Le guide vient avec ___.`,
      options: ['elle', 'la', 'le', 'lui'],
      correct: 0
    };
  }

  if (topicKey.includes('pronoms cod')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom COD.`,
      display: `Je vois Lea. Je ___ vois.`,
      options: ['la', 'lui', 'leur', 'y'],
      correct: 0
    };
  }

  if (topicKey.includes('pronoms coi')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери pronom COI.`,
      display: `Je telephone a Jules. Je ___ telephone.`,
      options: ['lui', 'le', 'la', 'les'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректный pronom.`,
    display: `Tu connais ces cartes ? Oui, je ___ connais.`,
    options: ['les', 'leur', 'y', 'en'],
    correct: 0
  };
}

function makeFrenchAdjectiveQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('accord des adjectifs')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Нужен правильный accord des adjectifs.`,
      display: `Les chaussures sont ___ pour la neige.`,
      options: ['utiles', 'utile', 'util', 'utilese'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери корректную форму adjectif.`,
    display: `Cest une veste ___ pour la pluie.`,
    options: ['chaude', 'chaud', 'chaudes', 'chade'],
    correct: 0
  };
}

function makeFrenchComparisonQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('superlatif')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери superlatif.`,
      display: `Cest ___ refuge du secteur.`,
      options: ['le plus calme', 'plus calme', 'le plus calmes', 'tres calme'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери comparatif.`,
    display: `Cette voie est ___ que lautre.`,
    options: ['plus raide', 'le plus raide', 'aussi la raide', 'plus de raide'],
    correct: 0
  };
}

function makeFrenchPrepositionQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('nombres et date')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери естественный вариант даты.`,
      display: `Le cours commence ___ 3 mai.`,
      options: ['le', 'au', 'en', 'a'],
      correct: 0
    };
  }

  if (topicKey.includes('prepositions de temps')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери preposition de temps.`,
      display: `Nous partons ___ matin.`,
      options: ['le', 'a', 'en', 'au'],
      correct: 0
    };
  }

  if (topicKey.includes('prepositions de lieu')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери preposition de lieu.`,
      display: `Le guide attend ___ refuge.`,
      options: ['au', 'en', 'de', 'pour'],
      correct: 0
    };
  }

  if (topicKey.includes('a / en / au / aux')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму с pays ou ville.`,
      display: `Elle habite ___ France depuis deux ans.`,
      options: ['en', 'a', 'au', 'aux'],
      correct: 0
    };
  }

  if (topicKey.includes('il y a / depuis')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректный маркер времени.`,
      display: `Nous sommes ici ___ deux jours.`,
      options: ['depuis', 'pendant', 'pour', 'dans'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери правильный предлог.`,
    display: `Il travaille ici ___ trois ans.`,
    options: ['depuis', 'pendant', 'pour', 'a'],
    correct: 0
  };
}

function makeFrenchSyntaxQuestion(topicKey, grammarTopic, lexicalTopic) {
  if (topicKey.includes('negation')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректную negation.`,
      display: `Je ___ vois pas la corde.`,
      options: ['ne', 'pas', 'jamais', 'plus'],
      correct: 0
    };
  }

  if (topicKey.includes('est-ce que')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери вопрос с est-ce que.`,
      display: `___ tu es pret pour le depart ?`,
      options: ['Est-ce que', 'Parce que', 'Si', 'Comme'],
      correct: 0
    };
  }

  if (topicKey.includes('inversion')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери форму с inversion.`,
      display: `___-vous une question ?`,
      options: ['Avez', 'Avoir', 'Aviez', 'A'],
      correct: 0
    };
  }

  if (topicKey.includes('cest / il est')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный вариант.`,
      display: `___ tard, on redescend.`,
      options: ['Il est', 'Cest', 'Ils sont', 'Ce sont'],
      correct: 0
    };
  }

  if (topicKey.includes('parce que / puisque / comme')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильный connecteur.`,
      display: `Nous restons ici ___ il fait nuit.`,
      options: ['parce que', 'quand', 'si', 'avant de'],
      correct: 0
    };
  }

  if (topicKey.includes('quand / lorsque / pendant que')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректный временной союз.`,
      display: `___ tu montes, regarde la corde.`,
      options: ['Quand', 'Parce que', 'Avant de', 'Si bien que'],
      correct: 0
    };
  }

  if (topicKey.includes('avant de / apres avoir')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери правильную конструкцию.`,
      display: `___ verifier la carte, nous sommes partis.`,
      options: ['Apres avoir', 'Avant de', 'Quand', 'Puisque'],
      correct: 0
    };
  }

  if (topicKey.includes('si + imparfait')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректное условное продолжение.`,
      display: `Si javais du temps, je ___ plus.`,
      options: ['marcherais', 'marchais', 'marcherai', 'ai marche'],
      correct: 0
    };
  }

  if (topicKey.includes('passif')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери корректное passif.`,
      display: `La corde ___ par le guide chaque matin.`,
      options: ['est verifiee', 'verifie', 'a verifier', 'sera verifier'],
      correct: 0
    };
  }

  if (topicKey.includes('connecteurs logiques')) {
    return {
      text: `${lexicalLead(lexicalTopic)} Выбери логическую связку.`,
      display: `Il neige, ___ nous continuons lentement.`,
      options: ['mais', 'que', 'si', 'avant'],
      correct: 0
    };
  }

  return {
    text: `${lexicalLead(lexicalTopic)} Выбери естественный вопрос.`,
    display: `___ tu comprends la consigne ?`,
    options: ['Est-ce que', 'Comme', 'Puisque', 'Pendant que'],
    correct: 0
  };
}

function makeFrenchDefaultQuestion(grammarTopic, lexicalTopic) {
  const name = pick(FRENCH_NAMES);
  const adjective = pick(FRENCH_ADJECTIVES);
  return {
    text: `${lexicalLead(lexicalTopic)} Быстро выбери грамматически правильный вариант по теме "${grammarTopic}".`,
    display: `${name} cherche un endroit ${adjective} au camp.`,
    options: [
      `${name} cherche un endroit ${adjective} au camp.`,
      `${name} cherchent un endroit ${adjective} au camp.`,
      `${name} cherche un endroit ${adjective}es au camp.`,
      `${name} a cherche un endroit ${adjective} au camp maintenant.`
    ],
    correct: 0
  };
}

const AI_QUESTION_BATCH_SIZE = 5;
const AI_FETCH_TIMEOUT_MS = 12000;
const AI_FETCH_RETRY_LIMIT = 1;
const AI_FETCH_RETRY_BASE_MS = 1500;

function isValidRemoteQuestion(question) {
  if (
    !question ||
    typeof question.text !== 'string' ||
    typeof question.display !== 'string' ||
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    typeof question.correct !== 'number' ||
    question.correct < 0 ||
    question.correct > 3
  ) {
    return false;
  }
  // Drop questions with empty or duplicate options. A duplicate confuses
  // the answer mapping (the player sees two identical choices and gets
  // told their pick was wrong because the model meant the other one).
  const trimmed = question.options.map((option) => String(option || '').trim());
  if (trimmed.some((option) => option.length === 0)) {
    return false;
  }
  if (new Set(trimmed.map((option) => option.toLowerCase())).size !== trimmed.length) {
    return false;
  }
  return true;
}

function isWordOrderTopic(topic) {
  return /wortstellung/i.test(normalizeTopicKey(topic));
}

function slotConfigSignature(slotConfigs) {
  return slotConfigs
    .filter(Boolean)
    .map((slot) => `${slot.slotDef && slot.slotDef.id}:${slot.grammarTopic}`)
    .join('|');
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readQuestionError(response) {
  const fallback = `HTTP ${response.status}`;
  try {
    const data = await response.clone().json();
    return String(data.detail || data.error || fallback).trim();
  } catch (error) {
    const text = await response.text().catch(() => '');
    return String(text || fallback).trim();
  }
}

class QuestionManager {
  constructor(level = DEFAULT_CEFR_LEVEL, language = DEFAULT_LANGUAGE) {
    this.level = level || DEFAULT_CEFR_LEVEL;
    this.language = language || DEFAULT_LANGUAGE;
    this.lexicalTopic = getLanguageLexicalTopics(this.language)[0];
    this.slots = [];
    this.questionPool = Object.create(null);
    this.fetching = Object.create(null);
    this.usedDisplays = Object.create(null);
    this.lastQuestion = null;
    this.slotsSignature = '';
  }

  setLevel(level) {
    const nextLevel = level || DEFAULT_CEFR_LEVEL;
    if (this.level !== nextLevel) {
      this.level = nextLevel;
      this._resetPools();
    }
  }

  setLanguage(language) {
    const nextLanguage = language || DEFAULT_LANGUAGE;
    if (this.language !== nextLanguage) {
      this.language = nextLanguage;
      this.lexicalTopic = getLanguageLexicalTopics(this.language)[0];
      this._resetPools();
      return;
    }

    const lexicalTopics = getLanguageLexicalTopics(this.language);
    if (!lexicalTopics.includes(this.lexicalTopic)) {
      this.lexicalTopic = lexicalTopics[0];
      this._resetPools();
    }
  }

  setLexicalTopic(topic) {
    const lexicalTopics = getLanguageLexicalTopics(this.language);
    const nextTopic = lexicalTopics.includes(topic) ? topic : lexicalTopics[0];
    if (this.lexicalTopic !== nextTopic) {
      this.lexicalTopic = nextTopic;
      this._resetPools();
    }
  }

  configureSlots(slotConfigs) {
    const nextSlots = slotConfigs.filter(Boolean);
    const nextSignature = slotConfigSignature(nextSlots);
    if (this.slotsSignature !== nextSignature) {
      this.slots = nextSlots;
      this.slotsSignature = nextSignature;
      this._resetPools();
      return;
    }

    this.slots = nextSlots;
  }

  async prefetchAll(onProgress) {
    const slots = this.slots.slice();
    let done = 0;
    for (const slot of slots) {
      const slotId = slot.slotDef.id;
      if (typeof onProgress === 'function') {
        onProgress({ slotId, done, total: slots.length, status: 'loading' });
      }
      try {
        await this._ensurePool(slotId);
      } catch (error) {
        console.warn(`Не удалось предзагрузить пул для слота ${slotId}:`, error);
      }
      done += 1;
      if (typeof onProgress === 'function') {
        onProgress({ slotId, done, total: slots.length, status: 'done' });
      }
    }
  }

  shuffleAllPools() {
    Object.keys(this.questionPool).forEach((slotId) => {
      this.questionPool[slotId] = shuffleArray(this.questionPool[slotId]);
    });
  }

  isPoolEmpty(slotId) {
    const pool = this.questionPool[slotId];
    return !pool || pool.length === 0;
  }

  async getQuestion(slotId) {
    const slotConfig = this.slots.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return null;
    }

    await this._ensurePool(slotId);
    const pool = this.questionPool[slotId];
    if (!pool || pool.length === 0) {
      return this._fallbackQuestion(slotConfig);
    }

    const rawQuestion = pool.shift();
    this.lastQuestion = { slotId, question: rawQuestion };

    return this._formatQuestion(rawQuestion, slotConfig);
  }

  onCorrectAnswer(slotId) {
    if (this.lastQuestion && this.lastQuestion.slotId === slotId) {
      const set = this.usedDisplays[slotId] || new Set();
      set.add(this.lastQuestion.question.display);
      this.usedDisplays[slotId] = set;
      this.lastQuestion = null;
    }
  }

  onWrongAnswer(slotId) {
    this.returnLastQuestion(slotId);
  }

  returnLastQuestion(slotId) {
    if (!this.lastQuestion || this.lastQuestion.slotId !== slotId) {
      return;
    }

    const pool = this.questionPool[slotId] || [];
    const position = Math.floor(Math.random() * (pool.length + 1));
    pool.splice(position, 0, this.lastQuestion.question);
    this.questionPool[slotId] = pool;
    this.lastQuestion = null;
  }

  _resetPools() {
    this.questionPool = Object.create(null);
    this.fetching = Object.create(null);
    this.usedDisplays = Object.create(null);
    this.lastQuestion = null;
  }

  async _ensurePool(slotId) {
    if (this.fetching[slotId]) {
      return this.fetching[slotId];
    }

    const pool = this.questionPool[slotId];
    if (pool && pool.length > 0) {
      return pool;
    }

    const slotConfig = this.slots.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return [];
    }

    this.fetching[slotId] = this._fetchQuestions(slotConfig)
      .catch((error) => {
        console.warn(`Не удалось загрузить вопросы для слота ${slotId}:`, error);
        return [];
      })
      .finally(() => {
        delete this.fetching[slotId];
      });

    return this.fetching[slotId];
  }

  async _fetchQuestions(slotConfig) {
    const slotId = slotConfig.slotDef.id;
    let lastError = null;

    for (let attempt = 1; attempt <= AI_FETCH_RETRY_LIMIT; attempt += 1) {
      try {
        const valid = await this._requestQuestionBatch(slotConfig);
        if (valid.length) {
          const pool = [...(this.questionPool[slotId] || []), ...shuffleArray(valid)];
          this.questionPool[slotId] = pool;
          return pool;
        }
        lastError = new Error('Empty batch');
      } catch (error) {
        lastError = error;
        console.warn(`Попытка ${attempt}/${AI_FETCH_RETRY_LIMIT} загрузки слота ${slotId} провалилась:`, error);
        if (error && error.retryable === false) {
          break;
        }
      }

      if (attempt < AI_FETCH_RETRY_LIMIT) {
        await wait(AI_FETCH_RETRY_BASE_MS * attempt);
      }
    }

    throw lastError || new Error('Не удалось получить пул вопросов');
  }

  async _requestQuestionBatch(slotConfig) {
    const slotId = slotConfig.slotDef.id;
    const seen = Array.from(this.usedDisplays[slotId] || []).slice(-12);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
    let response;

    try {
      response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          level: this.level,
          language: this.language,
          lexicalTopic: this.lexicalTopic,
          grammarTopic: slotConfig.grammarTopic,
          isWortstellung: Boolean(slotConfig.slotDef.isWortstellung || isWordOrderTopic(slotConfig.grammarTopic)),
          count: AI_QUESTION_BATCH_SIZE,
          exclude: seen
        })
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const detail = await readQuestionError(response);
      const error = new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      error.status = response.status;
      error.retryable = response.status >= 500 && !/api_key|not configured/i.test(detail);
      throw error;
    }

    const data = await response.json();
    return (data.questions || []).filter((question) => isValidRemoteQuestion(question));
  }

  _formatQuestion(rawQuestion, slotConfig) {
    // Tag each option with its correctness flag before shuffling. The
    // previous version recovered the correct index via `indexOf`, which
    // returns the first match — if the model ever emits duplicate option
    // strings the wrong button ended up flagged correct.
    const tagged = rawQuestion.options.map((option, optionIndex) => ({
      option,
      isCorrect: optionIndex === rawQuestion.correct
    }));
    const shuffled = shuffleArray(tagged);
    const correctIndex = shuffled.findIndex((entry) => entry.isCorrect);

    return {
      slotId: slotConfig.slotDef.id,
      slotDef: slotConfig.slotDef,
      grammarTopic: slotConfig.grammarTopic,
      level: this.level,
      language: this.language,
      text: rawQuestion.text,
      display: rawQuestion.display,
      options: {
        options: shuffled.map((entry) => entry.option),
        correctIndex: correctIndex >= 0 ? correctIndex : 0
      }
    };
  }

  _fallbackQuestion(slotConfig) {
    return {
      slotId: slotConfig.slotDef.id,
      slotDef: slotConfig.slotDef,
      grammarTopic: slotConfig.grammarTopic,
      level: this.level,
      language: this.language,
      text: 'Резервное упражнение',
      display: 'Сервер вопросов временно недоступен. Нажмите OK, чтобы получить бонус и не останавливать игру.',
      options: {
        options: ['OK', 'Пауза', 'Ошибка', 'Назад'],
        correctIndex: 0
      }
    };
  }
}
