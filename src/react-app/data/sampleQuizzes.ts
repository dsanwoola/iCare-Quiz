import type { QuizInput, QuestionInput } from "@/shared/types";

let seq = 0;
const opt = (text: string) => ({ id: `o${seq++}`, text });

function q(
  type: QuestionInput["type"],
  prompt: string,
  options: { id: string; text: string }[],
  correctIds: string[],
  durationSeconds = 20,
  basePoints = 1000
): QuestionInput {
  return {
    id: `q${seq++}`,
    type,
    prompt,
    options,
    correctAnswers: correctIds,
    durationSeconds,
    basePoints,
  };
}

// Build option sets once so we can reference their generated ids.
const mars = [opt("Venus"), opt("Mars"), opt("Jupiter"), opt("Saturn")];
const boil = [opt("True"), opt("False")];
const gas = [opt("Oxygen"), opt("Nitrogen"), opt("Carbon Dioxide"), opt("Hydrogen")];
const noble = [opt("Helium"), opt("Oxygen"), opt("Neon"), opt("Argon")];

const capital = [opt("Berlin"), opt("Madrid"), opt("Paris"), opt("Rome")];
const ocean = [opt("Atlantic"), opt("Indian"), opt("Arctic"), opt("Pacific")];
const great = [opt("True"), opt("False")];

export const sampleQuizzes: QuizInput[] = [
  {
    title: "Science Trivia Challenge",
    description:
      "Test your knowledge of basic science facts across physics, chemistry, and biology!",
    logoUrl: null,
    questions: [
      q("MCQ", "What planet is known as the Red Planet?", mars, [mars[1].id]),
      q("TF", "Water boils at 100°C at sea level.", boil, [boil[0].id], 15),
      q("MCQ", "What gas do plants absorb from the atmosphere?", gas, [gas[2].id]),
      q(
        "MULTI",
        "Which of these are noble gases? (Select all that apply)",
        noble,
        [noble[0].id, noble[2].id, noble[3].id]
      ),
    ],
  },
  {
    title: "World Geography Quiz",
    description: "How well do you know the world? Capitals, oceans, and more.",
    logoUrl: null,
    questions: [
      q("MCQ", "What is the capital of France?", capital, [capital[2].id]),
      q("MCQ", "Which is the largest ocean on Earth?", ocean, [ocean[3].id]),
      q("TF", "The Great Wall of China is visible from space with the naked eye.", great, [great[1].id], 15),
    ],
  },
];
