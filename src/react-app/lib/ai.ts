import { getAI, getGenerativeModel, VertexAIBackend, Schema } from "firebase/ai";
import { app } from "./firebase";
import type { QuizInput, QuestionInput, QuestionType } from "@/shared/types";

// Firebase AI Logic — Vertex AI Gemini backend (bills pay-as-you-go on Blaze,
// avoiding the Developer API free-tier credit limits).
// NOTE: Before a public launch, enable Firebase App Check so this AI quota
// can't be abused by unauthorized clients.
const ai = getAI(app, { backend: new VertexAIBackend() });

// Structured-output schema so Gemini returns quiz JSON we can trust.
const quizSchema = Schema.object({
  properties: {
    title: Schema.string(),
    description: Schema.string(),
    questions: Schema.array({
      items: Schema.object({
        properties: {
          type: Schema.enumString({ enum: ["MCQ", "TF", "MULTI"] }),
          prompt: Schema.string(),
          options: Schema.array({ items: Schema.string() }),
          correctIndexes: Schema.array({ items: Schema.integer() }),
        },
      }),
    }),
  },
});

export interface GenerateQuizOptions {
  topic: string;
  count: number;
  difficulty: "Easy" | "Medium" | "Hard";
}

interface RawQuestion {
  type?: string;
  prompt?: string;
  options?: string[];
  correctIndexes?: number[];
}

/** Generate a ready-to-edit quiz from a topic prompt using Gemini. */
export async function generateQuiz(opts: GenerateQuizOptions): Promise<QuizInput> {
  const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
      temperature: 0.8,
    },
  });

  const prompt = `Create a fun, engaging ${opts.difficulty} quiz about "${opts.topic}" with exactly ${opts.count} questions.
Requirements:
- Mix the question types: MCQ (exactly 4 options, 1 correct), TF (exactly 2 options "True" and "False", 1 correct), and MULTI (4-5 options, 2 or more correct).
- "correctIndexes" are 0-based indexes into that question's "options" array.
- Keep each prompt concise, factual, and unambiguous.
- Provide a short catchy quiz title and a one-sentence description.`;

  const result = await model.generateContent(prompt);
  const data = JSON.parse(result.response.text()) as {
    title?: string;
    description?: string;
    questions?: RawQuestion[];
  };

  let seq = 0;
  const questions: QuestionInput[] = (data.questions || [])
    .map((q): QuestionInput => {
      const options = (q.options || []).map((text) => ({ id: `o${seq++}`, text: String(text).slice(0, 300) }));
      const correct = (q.correctIndexes || [])
        .map((i) => options[i]?.id)
        .filter((id): id is string => !!id);
      const type = (["MCQ", "TF", "MULTI"].includes(q.type || "") ? q.type : "MCQ") as QuestionType;
      return {
        id: `q${seq++}`,
        type,
        prompt: (q.prompt || "").slice(0, 500),
        options,
        correctAnswers: correct.length ? correct : options[0] ? [options[0].id] : [],
        durationSeconds: 20,
        basePoints: 1000,
      };
    })
    .filter((q) => q.options.length >= 2 && q.prompt && q.correctAnswers.length > 0);

  if (questions.length === 0) {
    throw new Error("The AI didn't return any usable questions. Try a more specific topic.");
  }

  return {
    title: (data.title || opts.topic).slice(0, 200),
    description: (data.description || `AI-generated quiz about ${opts.topic}`).slice(0, 1000),
    logoUrl: null,
    questions,
  };
}
