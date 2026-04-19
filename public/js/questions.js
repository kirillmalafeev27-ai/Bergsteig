const DEFAULT_CEFR_LEVEL = 'A2';

const GRAMMAR_TOPICS = [
  'Praesens',
  'Perfekt',
  'Praeteritum',
  'Futur I',
  'Imperativ',
  'Modalverben',
  'Trennbare Verben',
  'Untrennbare Verben',
  'Reflexive Verben',
  'Verben mit Praepositionen',
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
  'Fragewoerter',
  'Negation',
  'Adjektivdeklination',
  'Komparativ und Superlativ',
  'Steigerung',
  'Zahlen und Datum',
  'Temporale Praepositionen',
  'Lokale Praepositionen',
  'Wechselpraepositionen',
  'Praepositionen mit Dativ',
  'Praepositionen mit Akkusativ',
  'Satzklammer',
  'Wortstellung',
  'Wortstellung im Hauptsatz',
  'Wortstellung im Nebensatz',
  'weil-Saetze',
  'dass-Saetze',
  'wenn-Saetze',
  'obwohl-Saetze',
  'damit-Saetze',
  'Relativsaetze',
  'Indirekte Fragen',
  'Infinitiv mit zu',
  'Konjunktiv II',
  'Passiv',
  'Plusquamperfekt',
  'Doppelkonjunktionen',
  'als vs. wenn',
  'Partizip I und II',
  'Genitivpraepositionen'
];

const LEXICAL_TOPICS = [
  'Familie',
  'Freundschaft',
  'Wohnen',
  'Hausarbeit',
  'Schule',
  'Universitaet',
  'Arbeit',
  'Bewerbung',
  'Reisen',
  'Hotel',
  'Stadt',
  'Auf dem Land',
  'Essen und Trinken',
  'Restaurant',
  'Einkaufen',
  'Kleidung',
  'Gesundheit',
  'Koerper',
  'Sport',
  'Freizeit',
  'Musik',
  'Filme und Serien',
  'Natur',
  'Umwelt',
  'Verkehr',
  'Technik',
  'Internet',
  'Buecher',
  'Wetter',
  'Feiertage'
];

const BONUS_SLOTS = [
  {
    id: 'extraMove',
    bonus: 'extraMove',
    bonusLabel: 'Zusatzschub',
    successCooldownMs: 18000,
    wrongCooldownMs: 3000,
    help: 'Correct answer adds one extra climb tick on top of the base ascent tick.'
  },
  {
    id: 'step',
    bonus: 'step',
    bonusLabel: 'Seitenschritt',
    successCooldownMs: 8000,
    wrongCooldownMs: 2500,
    help: 'A weak swing shifts the climber one lane toward the selected target lane.'
  },
  {
    id: 'surge',
    bonus: 'surge',
    bonusLabel: 'Kraftzug',
    successCooldownMs: 16000,
    wrongCooldownMs: 4000,
    help: 'A strong swing reaches any lane and can break onto a side ledge to evade avalanches, but causes a long swing-back.'
  },
  {
    id: 'shield',
    bonus: 'shield',
    bonusLabel: 'Schneeschutz',
    successCooldownMs: 180000,
    wrongCooldownMs: 6000,
    help: 'Adds a snow shield that can absorb the next avalanche and soften lens buildup.'
  },
  {
    id: 'clear',
    bonus: 'clear',
    bonusLabel: 'Klare Sicht',
    successCooldownMs: 45000,
    wrongCooldownMs: 2500,
    help: 'Instantly clears the camera lens. Volcanic sections recharge it faster than snow levels.'
  }
];

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

class QuestionManager {
  constructor(level = DEFAULT_CEFR_LEVEL) {
    this.level = level;
    this.lexicalTopic = null;
    this.questionPool = Object.create(null);
    this.fetching = Object.create(null);
    this.slots = [];
    this.lastQuestion = null;
    this.usedDisplays = Object.create(null);
  }

  setLevel(level) {
    if (this.level !== level) {
      this.level = level;
      this.questionPool = Object.create(null);
      this.fetching = Object.create(null);
      this.usedDisplays = Object.create(null);
      this.lastQuestion = null;
    }
  }

  setLexicalTopic(topic) {
    if (this.lexicalTopic !== topic) {
      this.lexicalTopic = topic;
      this.questionPool = Object.create(null);
      this.fetching = Object.create(null);
      this.usedDisplays = Object.create(null);
      this.lastQuestion = null;
    }
  }

  configureSlots(slotConfigs) {
    this.slots = slotConfigs.filter(Boolean);
  }

  async prefetchAll() {
    const tasks = this.slots.map((slot) => this._ensurePool(slot.slotDef.id));
    await Promise.allSettled(tasks);
  }

  getQuestion(slotId) {
    const slotConfig = this.slots.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return null;
    }

    const pool = this.questionPool[slotId];
    if (!pool || pool.length === 0) {
      return this._fallbackQuestion(slotConfig);
    }

    const rawQuestion = pool.shift();
    this.lastQuestion = { slotId, question: rawQuestion };

    if (pool.length === 0) {
      this._ensurePool(slotId);
    }

    return this._formatQuestion(rawQuestion, slotConfig);
  }

  onCorrectAnswer(slotId) {
    if (this.lastQuestion && this.lastQuestion.slotId === slotId) {
      const used = this.usedDisplays[slotId] || new Set();
      used.add(this.lastQuestion.question.display);
      this.usedDisplays[slotId] = used;
      this.lastQuestion = null;
    }

    if (!this.questionPool[slotId] || this.questionPool[slotId].length === 0) {
      this._ensurePool(slotId);
    }
  }

  onWrongAnswer(slotId) {
    if (!this.lastQuestion || this.lastQuestion.slotId !== slotId) {
      return;
    }

    const pool = this.questionPool[slotId] || [];
    const position = Math.floor(Math.random() * (pool.length + 1));
    pool.splice(position, 0, this.lastQuestion.question);
    this.questionPool[slotId] = pool;
    this.lastQuestion = null;
  }

  async _ensurePool(slotId) {
    if (this.fetching[slotId]) {
      return this.fetching[slotId];
    }

    if (this.questionPool[slotId] && this.questionPool[slotId].length > 0) {
      return this.questionPool[slotId];
    }

    const slotConfig = this.slots.find((slot) => slot.slotDef.id === slotId);
    if (!slotConfig) {
      return [];
    }

    this.fetching[slotId] = this._fetchQuestions(slotConfig)
      .catch((error) => {
        console.warn(`Failed to load questions for slot ${slotId}:`, error);
        return [];
      })
      .finally(() => {
        delete this.fetching[slotId];
      });

    return this.fetching[slotId];
  }

  async _fetchQuestions(slotConfig) {
    const slotId = slotConfig.slotDef.id;
    const seen = Array.from(this.usedDisplays[slotId] || []).slice(-12);
    const grammarTopic = slotConfig.grammarTopic;
    const isWortstellung = /wortstellung/i.test(grammarTopic);

    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: this.level,
        lexicalTopic: this.lexicalTopic,
        grammarTopic,
        isWortstellung,
        count: 24,
        exclude: seen
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const valid = (data.questions || []).filter((question) => this._isValidQuestion(question));
    if (!valid.length) {
      return [];
    }

    const pool = [...(this.questionPool[slotId] || []), ...shuffleArray(valid)];
    this.questionPool[slotId] = pool;
    return pool;
  }

  _isValidQuestion(question) {
    return Boolean(
      question &&
        typeof question.text === 'string' &&
        typeof question.display === 'string' &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        typeof question.correct === 'number' &&
        question.correct >= 0 &&
        question.correct <= 3
    );
  }

  _formatQuestion(rawQuestion, slotConfig) {
    const correctAnswer = rawQuestion.options[rawQuestion.correct];
    const shuffledOptions = shuffleArray(rawQuestion.options);

    return {
      slotId: slotConfig.slotDef.id,
      slotDef: slotConfig.slotDef,
      grammarTopic: slotConfig.grammarTopic,
      level: this.level,
      text: rawQuestion.text,
      display: rawQuestion.display,
      options: {
        options: shuffledOptions,
        correctIndex: shuffledOptions.indexOf(correctAnswer)
      }
    };
  }

  _fallbackQuestion(slotConfig) {
    return {
      slotId: slotConfig.slotDef.id,
      slotDef: slotConfig.slotDef,
      grammarTopic: slotConfig.grammarTopic,
      level: this.level,
      text: 'Fallback question',
      display: 'Question server unavailable. Choose OK to keep the climb moving.',
      options: {
        options: ['OK', 'Pause', 'Fehler', 'Zurueck'],
        correctIndex: 0
      }
    };
  }
}
