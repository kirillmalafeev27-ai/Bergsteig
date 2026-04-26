const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const GHOST_ROUTE_FILE = path.join(DATA_DIR, 'ghost-routes.json');
const AITUNNEL_BASE_URL = process.env.AITUNNEL_BASE_URL || 'https://api.aitunnel.ru/v1';
const AITUNNEL_MODEL = process.env.AITUNNEL_MODEL || 'gpt-5.4';
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const DEFAULT_QUESTION_COUNT = 4;
const MAX_QUESTION_COUNT = 12;
const QUESTION_COMPLETION_BASE_TOKENS = 700;
const QUESTION_COMPLETION_TOKENS_PER_ITEM = 260;
const QUESTION_COMPLETION_MAX_TOKENS = 3200;
const MAX_GHOST_ROUTES = 24;
const EXTERNAL_GHOST_ROUTE_LIMIT = 8;

const questionPool = Object.create(null);
const ghostRoutes = loadGhostRoutes();
let ghostRouteCounter = ghostRoutes.reduce((maxId, route) => {
  const match = /^ghost-route-(\d+)$/.exec(String(route && route.id || ''));
  return match ? Math.max(maxId, Number(match[1]) || 0) : maxId;
}, 0);

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

// Cache policy: this project does not use hashed asset URLs yet, so scripts
// and styles must revalidate on each load. Otherwise browsers can keep an old
// game bundle while the server already has a newer one.
const CACHE_CONTROL = {
  '.html': 'no-cache',
  '.js': 'no-cache',
  '.css': 'no-cache'
};

function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

function loadGhostRoutes() {
  try {
    if (!fs.existsSync(GHOST_ROUTE_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(GHOST_ROUTE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_GHOST_ROUTES) : [];
  } catch (error) {
    log(`ghost route load failed: ${error.message}`);
    return [];
  }
}

function saveGhostRoutes() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(GHOST_ROUTE_FILE, JSON.stringify(ghostRoutes, null, 2), 'utf8');
  } catch (error) {
    log(`ghost route save failed: ${error.message}`);
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      log(`readFile error for ${filePath}: ${error.message}`);
      sendJson(res, 500, { error: 'Failed to read file' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Length': buffer.length,
      'X-Content-Type-Options': 'nosniff'
    };
    if (CACHE_CONTROL[ext]) {
      headers['Cache-Control'] = CACHE_CONTROL[ext];
    }
    res.writeHead(200, headers);
    res.end(buffer);
  });
}

function resolveRequestedFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    return null;
  }

  return resolvedPath;
}

// Static asset paths that must 404 cleanly instead of falling back to
// index.html. Otherwise a missing JS/CSS/image silently returns HTML and
// clients fail in confusing ways.
const STRICT_EXTENSIONS = new Set(['.js', '.css', '.json', '.map', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.woff', '.woff2']);

const TOPIC_RULES = {
  'Infinitiv mit zu': `Verwende NUR Verben, die "zu + Infinitiv" verlangen: versuchen, beginnen, anfangen, aufhoeren, vorhaben, hoffen, vergessen, planen, sich freuen, Lust haben, Es ist wichtig/moeglich/schwer... NIEMALS Modalverben (koennen, muessen, sollen, wollen, duerfen, moegen) - diese stehen mit Infinitiv OHNE "zu"! Richtig: "Er versucht, den Bahnhof zu finden." | Falsch: "Er kann den Bahnhof zu finden."`,
  'Modalverben': `Modalverben: koennen, muessen, sollen, wollen, duerfen, moegen/moechten. Modalverb auf Position 2, Infinitiv am Satzende OHNE "zu"! Richtig: "Er kann den Bahnhof finden." | Falsch: "Er kann den Bahnhof zu finden."`,
  'Perfekt': `sein + Partizip II bei: Bewegungsverben (gehen->ist gegangen, fahren->ist gefahren, kommen->ist gekommen, fliegen->ist geflogen, laufen->ist gelaufen), Zustandsaenderung (einschlafen->ist eingeschlafen, aufwachen, sterben, werden, bleiben). haben + Partizip II bei ALLEN anderen Verben (machen->hat gemacht, essen->hat gegessen, lesen->hat gelesen). Partizip II: ge-...-t (regelmaessig: gemacht, gekauft), ge-...-en (unregelmaessig: gegangen, geschrieben). Verben auf -ieren: KEIN ge- (studiert, telefoniert). Trennbare: ge- zwischen Praefix und Stamm (ein-ge-kauft, auf-ge-standen). Untrennbare (be-, er-, ver-, ent-, zer-, emp-, miss-): KEIN ge- (besucht, verstanden, erzaehlt).`,
  'Praeteritum': `Regelmaessig: Stamm + -te/-test/-te/-ten/-tet/-ten (machte, sagtest). Unregelmaessig: Stammvokalwechsel OHNE -te (gehen->ging, sehen->sah, nehmen->nahm, schreiben->schrieb, lesen->las, sprechen->sprach). Mischverben: Vokalwechsel + -te (bringen->brachte, denken->dachte, kennen->kannte, wissen->wusste).`,
  'Dativ': `Dativpraepositionen: mit, nach, bei, seit, von, zu, aus, gegenueber, ab. Dativverben: helfen, danken, gehoeren, gefallen, schmecken, passen, gratulieren, antworten, folgen. Formen: dem (m/n), der (f), den + -n (Pl). ein->einem (m/n), eine->einer (f).`,
  'Akkusativ': `Akkusativpraepositionen: durch, fuer, gegen, ohne, um. Formen: den (m), die (f), das (n), die (Pl). ein->einen (m), eine (f), ein (n). Transitive Verben: sehen, kaufen, essen, trinken, lesen, schreiben, brauchen, haben, finden.`,
  'Genitiv': `Genitivpraepositionen: wegen, trotz, waehrend, innerhalb, ausserhalb, statt/anstatt. Maskulin/Neutrum: des/eines + Nomen mit -(e)s (des Mannes, eines Kindes). Feminin: der/einer + Nomen OHNE Endung (der Frau, einer Studentin). Plural: der + Nomen OHNE Endung (der Kinder).`,
  'Adjektivdeklination': `Nach bestimmtem Artikel (der/die/das): -e (Nom. Sg. alle Genera), -en (alle anderen Faelle). Nach unbestimmtem Artikel (ein/kein/mein): -er (Nom.m), -es (Nom./Akk.n), -e (Nom./Akk.f), -en (alle anderen). Ohne Artikel: starke Endungen - Signalendungen des bestimmten Artikels: -er (m.Nom), -e (f.Nom/Akk), -es (n.Nom/Akk), -en (Dat/Gen), -em (m/n.Dat). Richtig: "ein alter Mann" (m.Nom), "mit dem alten Mann" (m.Dat) | Falsch: "ein alten Mann", "mit dem alter Mann"`,
  'Wechselpraepositionen': `an, auf, hinter, in, neben, ueber, unter, vor, zwischen. Wohin? (Bewegung/Richtung) -> Akkusativ: "Ich stelle das Buch auf den Tisch." (stellen, legen, setzen, haengen) Wo? (Position/Ort) -> Dativ: "Das Buch steht auf dem Tisch." (stehen, liegen, sitzen, haengen)`,
  'Negation': `"nicht" verneint: Verben, Adjektive, Adverbien, Praepositionalphrasen. Position: vor dem verneinten Element. "kein/keine/keinen/keinem/keiner" ersetzt unbestimmten Artikel oder Nullartikel + Nomen. Richtig: "Ich habe kein Auto." | Falsch: "Ich habe nicht Auto." Richtig: "Ich komme nicht aus Berlin." | Falsch: "Ich komme kein aus Berlin."`,
  'Wortstellung im Hauptsatz': `Finites Verb IMMER auf Position 2! Inversion bei Adverb/Objekt auf Pos.1: Verb Pos.2, Subjekt Pos.3. Richtig: "Gestern ging ich ins Kino." | Falsch: "Gestern ich ging ins Kino."`,
  'Wortstellung im Nebensatz': `Nach Konjunktion (weil, dass, wenn, ob, als, nachdem, obwohl): finites Verb am SATZENDE. Richtig: "Ich weiss, dass er morgen kommt." | Falsch: "Ich weiss, dass er kommt morgen." Perfekt im Nebensatz: "..., weil er nach Hause gegangen ist." (Hilfsverb am Ende!)`,
  'dass-Saetze': `"dass" + Nebensatzwortstellung (Verb am Ende). Richtig: "Ich glaube, dass er recht hat." | Falsch: "Ich glaube, dass er hat recht."`,
  'weil-Saetze': `"weil" + Nebensatzwortstellung (Verb am Ende). Richtig: "Ich bleibe zu Hause, weil ich krank bin." | Falsch: "Ich bleibe zu Hause, weil ich bin krank."`,
  'wenn-Saetze': `"wenn" + Verb am Ende. Hauptsatz nach wenn-Satz: Verb auf Position 1. Richtig: "Wenn es regnet, bleibe ich zu Hause." | Falsch: "Wenn es regnet, ich bleibe zu Hause."`,
  'Relativsaetze': `Relativpronomen: Genus/Numerus vom BEZUGSWORT, aber Kasus von der FUNKTION im Nebensatz! Bestimme den Kasus: Was ist die Rolle des Relativpronomens im Nebensatz? Subjekt->Nom, direktes Objekt->Akk, indirektes Objekt->Dat. Nom: der/die/das/die. Akk: den/die/das/die. Dat: dem/der/dem/denen. Gen: dessen/deren. Richtig: "Der Turm, den man sehen kann" (Akk! weil: man sieht DEN Turm). Falsch: "Der Turm, dem man sehen kann." Richtig: "Der Mann, dem ich helfe" (Dat! weil: ich helfe DEM Mann). Verb am Ende des Relativsatzes!`,
  'Konjunktiv II': `Irreale Wuensche, hoefliche Bitten, Ratschlaege. wuerde + Infinitiv (Standard). Eigene Formen: waere, haette, koennte, muesste, sollte, duerfte, wuesste, kaeme, ginge, braeuchte. Richtig: "Wenn ich reich waere, wuerde ich reisen." | Falsch: "Wenn ich reich wuerde sein..."`,
  'Passiv': `Vorgangspassiv: werden + Partizip II. "Das Buch wird gelesen." Zustandspassiv: sein + Partizip II. "Das Fenster ist geoeffnet." Agens: von + Dativ. Praeteritum: wurde + P.II. Perfekt: ist + P.II + worden.`,
  'Praesens': `Konjugation: -e, -st, -t, -en, -t, -en. Stammvokalwechsel (2./3. Sg.): e->i (sprechen->spricht, helfen->hilft), e->ie (lesen->liest, sehen->sieht), a->ae (fahren->faehrt, schlafen->schlaeft). Verben auf -ten/-den: Bindevokal -e- (du arbeitest, er arbeitet).`,
  'Futur I': `werden + Infinitiv. werden: werde, wirst, wird, werden, werdet, werden. Richtig: "Ich werde morgen kommen." | Falsch: "Ich werde morgen zu kommen."`,
  'Imperativ': `du: Stamm (+e optional): "Komm!", "Mach!". e->i/ie bleibt: "Sprich!", "Lies!", "Nimm!" (KEIN -st, KEIN Pronomen). a->ae faellt weg: "Fahr!" (nicht "Faehr!"). ihr: wie Praesens ohne "ihr": "Kommt!", "Lest!". Sie: Infinitiv + Sie: "Kommen Sie!", "Lesen Sie!"`,
  'Artikel': `Bestimmt: der (m), die (f), das (n), die (Pl). Unbestimmt: ein (m/n), eine (f). Genus-Regeln: -ung/-heit/-keit/-schaft/-tion/-taet -> die. -chen/-lein -> das. -er/-ling -> oft der.`,
  'Nominativ': `Subjekt im Nominativ. Praedikativ nach sein/werden/bleiben ebenfalls Nominativ. Richtig: "Der Mann ist ein guter Lehrer." | Falsch: "Der Mann ist einen guten Lehrer."`
};

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function canonicalGermanTopic(topic) {
  const normalized = stripDiacritics(topic)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .toLowerCase();

  const aliases = [
    [/praesens|prasens/, 'Praesens'],
    [/praeteritum|prateritum/, 'Praeteritum'],
    [/wechselpraepositionen|wechselprapositionen/, 'Wechselpraepositionen'],
    [/dass-saetze|dass-satze/, 'dass-Saetze'],
    [/weil-saetze|weil-satze/, 'weil-Saetze'],
    [/wenn-saetze|wenn-satze/, 'wenn-Saetze'],
    [/relativsaetze|relativsatze/, 'Relativsaetze']
  ];

  for (const [pattern, replacement] of aliases) {
    if (pattern.test(normalized)) {
      return replacement;
    }
  }

  return String(topic || '');
}

function isValidQuestion(question) {
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

function sanitizeQuestion(question) {
  const correct = Number(question && question.correct);
  return {
    text: String(question && question.text ? question.text : '').trim(),
    display: String(question && question.display ? question.display : '').trim(),
    options: Array.isArray(question && question.options)
      ? question.options.slice(0, 4).map((option) => String(option).trim())
      : [],
    correct
  };
}

function isWortstellungTopic(topic) {
  return /wortstellung/i.test(stripDiacritics(topic));
}

function buildQuestionPrompt({
  level,
  lexicalTopic,
  grammarTopic,
  language,
  isWortstellung,
  questionsCount,
  exclude
}) {
  const isFrench = language === 'fr';
  const canonicalTopic = isFrench ? grammarTopic : canonicalGermanTopic(grammarTopic);
  const topicRule = isFrench ? '' : TOPIC_RULES[canonicalTopic] || TOPIC_RULES[grammarTopic] || '';
  const targetLanguage = isFrench ? 'Franzoesisch' : 'Deutsch';
  const teacherRole = isFrench
    ? 'Du bist ein erfahrener FLE-Lehrer (Franzoesisch als Fremdsprache) und Lehrbuchautor.'
    : 'Du bist ein erfahrener DaF-Lehrer (Deutsch als Fremdsprache) und Lehrbuchautor.';
  const bookStyle = isFrench
    ? 'Du erstellst Uebungen auf dem Qualitaetsniveau moderner FLE-Lehrwerke.'
    : 'Du erstellst Uebungen auf dem Qualitaetsniveau von Schritte International, Menschen und Aspekte.';

  let excludeNote = '';
  if (Array.isArray(exclude) && exclude.length > 0) {
    const short = exclude.slice(-10).map((item) => `"${String(item).replace(/"/g, "'")}"`).join(', ');
    excludeNote = `\nVerwende diese Saetze NICHT: ${short}`;
  }

  let taskDescription;
  if (isWortstellung) {
    taskDescription = `Erstelle ${questionsCount} Wortstellungsuebungen fuer ${targetLanguage} (Niveau ${level}).
Grammatikthema: ${grammarTopic}.
${lexicalTopic ? `Lexikalisches Thema: ${lexicalTopic}. Alle Saetze muessen Woerter aus diesem Thema verwenden.` : ''}

Format:
- "display": Woerter/Phrasen durch " / " getrennt in ZUFAELLIGER Reihenfolge (NICHT in der korrekten Reihenfolge!)
- "options": 4 vollstaendige Saetze in ${targetLanguage} - NUR EINER ist grammatisch korrekt
- "correct": Index der korrekten Option (0-3), GLEICHMAESSIG verteilt
- "text": Kurze Anweisung auf Russisch (z.B. "Расставь слова в правильном порядке:")

Regeln fuer Wortstellungsuebungen:
- Die Woerter in "display" MUESSEN durcheinander sein - NICHT in der korrekten Reihenfolge!
- NUR EIN Satz darf korrekt sein. Andere korrekte Wortstellungen duerfen NICHT als falsche Option erscheinen.
- Falsche Optionen: klare Wortstellungsfehler.
- Jeder Satz ANDERS (verschiedene Subjekte, Verben, Situationen)`;
  } else {
    taskDescription = `Erstelle ${questionsCount} Grammatikuebungen (Lueckenuebungen) fuer ${targetLanguage} (Niveau ${level}).
Grammatikthema: ${grammarTopic}.
${lexicalTopic ? `Lexikalisches Thema: ${lexicalTopic}. Alle Saetze muessen Woerter aus diesem Thema verwenden.` : ''}

Format:
- "display": Satz in ${targetLanguage} mit Luecke ___ an der relevanten Stelle
- "options": 4 Optionen in ${targetLanguage} - NUR EINE ist grammatisch korrekt
- "correct": Index der korrekten Option (0-3), GLEICHMAESSIG verteilt
- "text": Kurze Anweisung auf Russisch (z.B. "Выбери правильный вариант:")

Regeln fuer Lueckenuebungen:
- Falsche Optionen: EINE klare Fehlerart (falscher Kasus, falscher Artikel, falsche Endung, falsche Konjugation, falsche Wortstellung)
- Keine absurden oder offensichtlich falschen Optionen - sie muessen plausibel aussehen
- Jeder Satz ANDERS (verschiedene Subjekte, Verben, Situationen)`;
  }

  return `${teacherRole} ${bookStyle}

${topicRule ? `GRAMMATIKREGELN fuer "${grammarTopic}" - halte dich STRIKT daran:\n${topicRule}\n` : ''}
${taskDescription}

GER-Niveau: ${level}. Halte dich STRIKT an dieses Niveau! Verwende KEINE Grammatik und KEINEN Wortschatz ueber ${level}.
${excludeNote}

KRITISCHE REGELN (Verstoss = Ausschuss):
1. Die korrekte Antwort MUSS grammatisch EINWANDFREI sein. Pruefe vor der Ausgabe jeden Satz: Subjekt, Praedikat, Kasus, Genus, Numerus, Wortstellung.
2. Jeder Satz MUSS VOLLSTAENDIG und SINNVOLL abgeschlossen sein. Kein Satz darf abgeschnitten werden! Wenn ein grammatisch korrekter Satz lang sein muss - schreibe ihn lang. Die Laenge ist NICHT begrenzt.
3. Falsche Optionen muessen EINEN KLAREN Fehler enthalten. Keine absurden Optionen.
4. GENAU EINE korrekte Antwort. Wenn zwei Optionen grammatisch korrekt sind - ist die Uebung Ausschuss.
5. "correct" - Index der korrekten Antwort (0-3). GLEICHMAESSIG ueber die Positionen verteilen.
6. Alle ${questionsCount} Saetze EINZIGARTIG: verschiedene Subjekte, Verben, Situationen. Keine Eintoenigkeit.
7. Verwende lebendige, natuerliche Saetze wie in modernen Lehrbuechern.

QUALITAETSKONTROLLE - pruefe JEDE Uebung BEVOR du sie ausgibst:
1. Setze die korrekte Option in den Satz ein -> ist er grammatisch PERFEKT?
2. Setze JEDE falsche Option ein -> enthaelt der Satz einen KLAREN grammatischen Fehler?
3. Gibt es GENAU EINE korrekte Antwort? Wenn zwei Optionen korrekt sein koennten -> Uebung neu formulieren!
4. Passt die Uebung zum Thema "${grammarTopic}" und zum Niveau ${level}?
5. Sind die Saetze natuerlich und vollstaendig?

Antworte NUR mit einem validen JSON-Array, KEIN Markdown, KEINE Erklaerungen:
[{"text":"Anweisung auf Russisch","display":"Text","options":["A","B","C","D"],"correct":0}]`;
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_JSON_BODY_BYTES) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function completionTokensForQuestionCount(count) {
  const requested = Number(count) || 1;
  return Math.min(
    QUESTION_COMPLETION_MAX_TOKENS,
    QUESTION_COMPLETION_BASE_TOKENS + Math.max(1, requested) * QUESTION_COMPLETION_TOKENS_PER_ITEM
  );
}

async function requestAiText(messages, maxCompletionTokens = 512) {
  const response = await fetch(`${AITUNNEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AITUNNEL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AITUNNEL_MODEL,
      max_completion_tokens: maxCompletionTokens,
      messages
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`AITunnel HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const text = String(payload.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new Error('AITunnel returned an empty completion');
  }

  return text;
}

async function requestAiQuestions(prompt, questionsCount) {
  const text = await requestAiText(
    [{ role: 'user', content: prompt }],
    completionTokensForQuestionCount(questionsCount)
  );

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : text;
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : [];
}

async function handleGenerateQuestions(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const {
    level,
    language = 'de',
    lexicalTopic = '',
    grammarTopic,
    isWortstellung,
    count,
    exclude
  } = body;

  if (!level || !grammarTopic) {
    sendJson(res, 400, { error: 'level and grammarTopic are required' });
    return;
  }

  if (!process.env.AITUNNEL_API_KEY) {
    sendJson(res, 503, { error: 'AITUNNEL_API_KEY is not configured' });
    return;
  }

  const questionsCount = Math.max(1, Math.min(Number(count) || DEFAULT_QUESTION_COUNT, MAX_QUESTION_COUNT));
  const wordOrderMode = Boolean(isWortstellung || (language === 'de' && isWortstellungTopic(grammarTopic)));
  const cacheKey = [
    language || 'de',
    level,
    grammarTopic,
    lexicalTopic || '',
    wordOrderMode ? 'w' : 'g'
  ].join(':');

  if (questionPool[cacheKey] && questionPool[cacheKey].length >= questionsCount) {
    sendJson(res, 200, { questions: questionPool[cacheKey].splice(0, questionsCount) });
    return;
  }

  const prompt = buildQuestionPrompt({
    level,
    lexicalTopic,
    grammarTopic,
    language,
    isWortstellung: wordOrderMode,
    questionsCount,
    exclude
  });

  try {
    const parsed = await requestAiQuestions(prompt, questionsCount);
    const valid = parsed
      .map(sanitizeQuestion)
      .filter(isValidQuestion);

    if (valid.length > questionsCount) {
      if (!questionPool[cacheKey]) {
        questionPool[cacheKey] = [];
      }
      questionPool[cacheKey].push(...valid.slice(questionsCount));
    }

    sendJson(res, 200, { questions: valid.slice(0, questionsCount) });
  } catch (error) {
    log(`AITunnel API error: ${error.message}`);
    const statusCode = error.status && error.status >= 400 && error.status < 500 ? error.status : 502;
    sendJson(res, statusCode, { error: 'Failed to generate questions', detail: error.message });
  }
}

async function handleTranslatePhrase(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const phrase = String(body.phrase || '').trim();
  const language = String(body.language || 'de').trim();
  if (!phrase) {
    sendJson(res, 400, { error: 'phrase is required' });
    return;
  }

  if (!process.env.AITUNNEL_API_KEY) {
    sendJson(res, 503, { error: 'AITUNNEL_API_KEY is not configured' });
    return;
  }

  try {
    const text = await requestAiText([
      {
        role: 'system',
        content: 'Ты переводчик. Возвращай только короткий перевод на русский без пояснений, кавычек и дополнительных фраз.'
      },
      {
        role: 'user',
        content: `Переведи на русский короткую фразу из игрового задания (${language}): ${phrase}`
      }
    ], 256);

    const translation = text
      .replace(/^["'«»]+|["'«»]+$/g, '')
      .split('\n')[0]
      .trim();

    sendJson(res, 200, {
      phrase,
      translation: translation || 'Перевод не получен'
    });
  } catch (error) {
    log(`AITunnel translation error: ${error.message}`);
    sendJson(res, 500, { error: 'Failed to translate phrase', detail: error.message });
  }
}

async function handleGhostRoutes(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, {
      routes: ghostRoutes.slice(0, EXTERNAL_GHOST_ROUTE_LIMIT)
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const route = Array.isArray(body.route) ? body.route : [];
  if (route.length < 2) {
    sendJson(res, 400, { error: 'route must contain at least two points' });
    return;
  }

  const sanitizedRoute = route
    .map((point) => ({
      t: Math.max(0, Number(point.t) || 0),
      progress: Math.max(0, Math.min(100, Number(point.progress) || 0)),
      lane: Math.max(-1, Math.min(1, Number(point.lane) || 0))
    }))
    .sort((left, right) => left.t - right.t);

  ghostRoutes.unshift({
    id: `ghost-route-${ghostRouteCounter += 1}`,
    createdAt: new Date().toISOString(),
    playerName: String(body.playerName || 'Climber').slice(0, 32),
    won: Boolean(body.won),
    relicId: String(body.relicId || ''),
    durationSeconds: Math.max(1, Number(body.durationSeconds) || sanitizedRoute[sanitizedRoute.length - 1].t || 1),
    route: sanitizedRoute
  });
  if (ghostRoutes.length > MAX_GHOST_ROUTES) {
    ghostRoutes.length = MAX_GHOST_ROUTES;
  }
  saveGhostRoutes();

  sendJson(res, 200, { ok: true });
}

async function handleRequest(req, res) {
  const pathname = req.url || '/';
  const routePath = pathname.split('?')[0];

  if (routePath === '/healthz') {
    sendJson(res, 200, { ok: true, service: 'bergstieg' });
    return;
  }

  if (routePath === '/api/generate-questions') {
    await handleGenerateQuestions(req, res);
    return;
  }

  if (routePath === '/api/translate-phrase') {
    await handleTranslatePhrase(req, res);
    return;
  }

  if (routePath === '/api/ghost-routes' || routePath === '/api/ghost-routes/log') {
    await handleGhostRoutes(req, res);
    return;
  }

  // Browsers always ask for /favicon.ico. Return an empty 204 until an icon
  // is shipped so it doesn't spam logs or fall through to the SPA handler.
  if (routePath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const resolvedPath = resolveRequestedFile(routePath);
  if (!resolvedPath) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(resolvedPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, resolvedPath);
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (STRICT_EXTENSIONS.has(ext)) {
      sendJson(res, 404, { error: 'Not found', path: pathname });
      return;
    }

    // SPA fallback for any other path.
    const fallback = path.join(PUBLIC_DIR, 'index.html');
    fs.stat(fallback, (fallbackError, fallbackStats) => {
      if (fallbackError || !fallbackStats.isFile()) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      sendFile(res, fallback);
    });
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    log(`request error: ${error.message}`);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    } else {
      res.end();
    }
  });
});

server.on('error', (error) => {
  log(`server error: ${error.message}`);
});

server.listen(PORT, () => {
  log(`BERGSTIEG listening on http://127.0.0.1:${PORT}`);
});

function shutdown(signal) {
  log(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Safety net: force exit if close hangs on open sockets.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
