// Стаб под твою готовую систему обучения.
// Интерфейс: nextQuestion(session) -> { id, text, options: [string,string,string], answer: 0|1|2 }
//
// Когда будешь интегрировать реальную систему — подмени реализацию в this nextQuestion,
// остальной код ничего не заметит.

const STUB_BANK = [
  { text: "___ Haus ist groß.", options: ["Der", "Die", "Das"], answer: 2 },
  { text: "Ich ___ einen Apfel.", options: ["esse", "isst", "essen"], answer: 0 },
  { text: "Wir ___ nach Berlin.", options: ["fahre", "fahrt", "fahren"], answer: 2 },
  { text: "___ Frau arbeitet hier.", options: ["Der", "Die", "Das"], answer: 1 },
  { text: "Er ___ ein Buch.", options: ["lese", "liest", "lesen"], answer: 1 },
  { text: "Was ist der Artikel von „Katze“?", options: ["der", "die", "das"], answer: 1 },
  { text: "Sie ___ Deutsch sehr gut.", options: ["sprichst", "spricht", "sprechen"], answer: 1 },
  { text: "Ich gehe ___ Schule.", options: ["in die", "in der", "zu dem"], answer: 0 },
  { text: "Das ist ___ Auto meines Vaters.", options: ["der", "das", "dem"], answer: 1 },
  { text: "Er wohnt ___ München.", options: ["in", "bei", "an"], answer: 0 },
  { text: "Ich habe ___ Hund.", options: ["ein", "einen", "eines"], answer: 1 },
  { text: "Gestern ___ ich ins Kino.", options: ["gehe", "ging", "gegangen"], answer: 1 },
  { text: "Der Mann, ___ dort steht, ist mein Onkel.", options: ["der", "den", "dem"], answer: 0 },
  { text: "Wenn ich Zeit ___, würde ich kommen.", options: ["habe", "hätte", "hatte"], answer: 1 },
  { text: "Das Buch ___ von Kafka geschrieben.", options: ["ist", "wurde", "hat"], answer: 1 },
];

export function nextQuestion(_session = null) {
  const q = STUB_BANK[Math.floor(Math.random() * STUB_BANK.length)];
  return { id: crypto.randomUUID?.() ?? String(Math.random()), ...q };
}
