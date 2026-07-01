import type { QuestionInput, QuestionType } from "@/shared/types";

// Curated starter templates for the public library. These are seeded into the
// Firestore `templates` collection (see seedStarterTemplates in lib/data.ts).

let seq = 0;
const uid = () => `t${seq++}`;

interface TemplateSeed {
  title: string;
  description: string;
  category: string;
  questions: QuestionInput[];
}

function opt(text: string) {
  return { id: uid(), text };
}

function q(
  type: QuestionType,
  prompt: string,
  options: { id: string; text: string }[],
  correctAnswers: string[],
  extra: Partial<QuestionInput> = {}
): QuestionInput {
  return {
    id: uid(),
    type,
    prompt,
    options,
    correctAnswers,
    durationSeconds: 20,
    basePoints: 1000,
    ...extra,
  };
}

// --- Science ---
const sMars = [opt("Venus"), opt("Mars"), opt("Jupiter"), opt("Saturn")];
const sBoil = [opt("True"), opt("False")];
const sNoble = [opt("Helium"), opt("Oxygen"), opt("Neon"), opt("Argon")];
const sPlanets = [opt("Mercury"), opt("Venus"), opt("Earth"), opt("Mars")];

// --- Geography ---
const gCap = [opt("Berlin"), opt("Madrid"), opt("Paris"), opt("Rome")];
const gOcean = [opt("Atlantic"), opt("Indian"), opt("Arctic"), opt("Pacific")];

// --- History ---
const hWar = [opt("1914"), opt("1918"), opt("1939"), opt("1945")];
const hOrder = [opt("Stone Age"), opt("Bronze Age"), opt("Iron Age"), opt("Middle Ages")];

// --- Pop Culture ---
const pMovie = [opt("Titanic"), opt("Avatar"), opt("Avengers: Endgame"), opt("Star Wars")];
const pBeatles = [opt("True"), opt("False")];

export const STARTER_TEMPLATES: TemplateSeed[] = [
  {
    title: "Science Trivia Challenge",
    description: "Physics, chemistry, and biology facts to test any budding scientist.",
    category: "Science",
    questions: [
      q("MCQ", "Which planet is known as the Red Planet?", sMars, [sMars[1].id]),
      q("TF", "Water boils at 100°C at sea level.", sBoil, [sBoil[0].id], { durationSeconds: 15 }),
      q("MULTI", "Which of these are noble gases?", sNoble, [sNoble[0].id, sNoble[2].id, sNoble[3].id]),
      q("ORDER", "Order these planets from the Sun outward.", sPlanets, sPlanets.map((o) => o.id)),
      q("NUMERIC", "How many bones are in the adult human body?", [], ["206"], { numericTolerance: 0 }),
    ],
  },
  {
    title: "World Geography Quiz",
    description: "Capitals, oceans, and landmarks from around the globe.",
    category: "Geography",
    questions: [
      q("MCQ", "What is the capital of France?", gCap, [gCap[2].id]),
      q("MCQ", "Which is the largest ocean on Earth?", gOcean, [gOcean[3].id]),
      q("SHORT", "Which country has the largest population?", [], ["India"]),
      q("NUMERIC", "How many continents are there?", [], ["7"]),
    ],
  },
  {
    title: "History Buff",
    description: "Journey through the key dates and eras that shaped our world.",
    category: "History",
    questions: [
      q("MCQ", "In which year did World War II end?", hWar, [hWar[3].id]),
      q("ORDER", "Put these historical periods in chronological order.", hOrder, hOrder.map((o) => o.id)),
      q("SHORT", "Who was the first President of the United States?", [], ["George Washington", "Washington"]),
    ],
  },
  {
    title: "Pop Culture Blitz",
    description: "Movies, music, and moments from modern entertainment.",
    category: "Pop Culture",
    questions: [
      q("MCQ", "Which film was the highest-grossing of all time (2024)?", pMovie, [pMovie[1].id]),
      q("TF", "The Beatles were formed in Liverpool.", pBeatles, [pBeatles[0].id], { durationSeconds: 15 }),
    ],
  },
];
