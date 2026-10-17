import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import type { ProblemDraftInput } from "./ai.validation";

const problemDraftOutputSchema = z.object({
  title: z.string().min(3).max(255),
  question: z.string().min(1),
  type: z.enum(["MCQ", "WRITTEN"]),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  expectedAnswer: z.string(),
  points: z.number().int().min(1).max(100),
});

const evaluationSuggestionSchema = z.object({
  suggestedScore: z.number().int().min(0),
  feedback: z.string().min(1).max(5000),
  strengths: z.array(z.string()).max(5),
  concerns: z.array(z.string()).max(5),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

type JsonSchema = Record<string, unknown>;

const problemDraftJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "question", "type", "options", "correctAnswer", "expectedAnswer", "points"],
  properties: {
    title: { type: "string" },
    question: { type: "string" },
    type: { type: "string", enum: ["MCQ", "WRITTEN"] },
    options: { type: "array", items: { type: "string" } },
    correctAnswer: { type: "string" },
    expectedAnswer: { type: "string" },
    points: { type: "integer" },
  },
};

const evaluationJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestedScore", "feedback", "strengths", "concerns", "confidence"],
  properties: {
    suggestedScore: { type: "integer" },
    feedback: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
  },
};

const extractOutputText = (payload: unknown): string => {
  const response = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = response.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new AppError(502, "The AI provider returned no usable result.");
  return text;
};

const requestStructured = async <T>(
  name: string,
  schema: JsonSchema,
  instructions: string,
  input: string,
): Promise<T> => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "AI features are not configured. Add GEMINI_API_KEY to the backend environment.");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: input }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            maxOutputTokens: 1200,
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    throw new AppError(502, "The AI provider could not be reached.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(502, "The Gemini AI provider rejected the request.");
  }
  try {
    return JSON.parse(extractOutputText(payload)) as T;
  } catch {
    throw new AppError(502, "The AI provider returned an invalid structured result.");
  }
};

export const generateProblemDraft = async (input: ProblemDraftInput) => {
  const draft = await requestStructured<z.infer<typeof problemDraftOutputSchema>>(
    "problem_draft",
    problemDraftJsonSchema,
    "You are a senior technical assessment author. Generate one original, objective developer assessment problem. Avoid trivia, copyrighted wording, unsafe instructions, and ambiguity. For MCQ, provide exactly four options and set correctAnswer to one exact option. For WRITTEN, return an empty options array and empty correctAnswer, then provide a concise expectedAnswer. Return only the requested JSON structure.",
    `Create a ${input.difficulty.toLowerCase()} ${input.type} problem about: ${input.topic}. The problem is worth ${input.points} points.`,
  );
  const parsed = problemDraftOutputSchema.parse(draft);
  if (parsed.type !== input.type || parsed.points !== input.points) {
    throw new AppError(502, "The AI provider returned a mismatched problem draft.");
  }
  if (parsed.type === "MCQ" && (parsed.options.length !== 4 || !parsed.correctAnswer || parsed.expectedAnswer)) {
    throw new AppError(502, "The AI provider returned an incomplete MCQ draft.");
  }
  if (parsed.type === "WRITTEN" && (!parsed.expectedAnswer || parsed.options.length > 0 || parsed.correctAnswer)) {
    throw new AppError(502, "The AI provider returned an incomplete written draft.");
  }
  return {
    ...parsed,
    options: parsed.options.length ? parsed.options : null,
    correctAnswer: parsed.correctAnswer || null,
    expectedAnswer: parsed.expectedAnswer || null,
  };
};

export const suggestWrittenEvaluation = async (recruiterId: string, submissionId: string) => {
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      attempt: { is: { assessment: { is: { recruiterId, deletedAt: null } } } },
    },
    select: {
      id: true,
      answer: true,
      status: true,
      assessmentItem: { select: { type: true, question: true, expectedAnswer: true, points: true } },
    },
  });
  if (!submission) throw new AppError(404, "Submission not found.");
  if (submission.assessmentItem.type !== "WRITTEN") {
    throw new AppError(409, "AI evaluation suggestions are only available for written submissions.");
  }
  if (submission.status !== "PENDING") {
    throw new AppError(409, "Only pending written submissions can receive an AI suggestion.");
  }

  const suggestion = await requestStructured<z.infer<typeof evaluationSuggestionSchema>>(
    "written_evaluation_suggestion",
    evaluationJsonSchema,
    "You are an assessment-review assistant. Evaluate the candidate answer against the question and expected answer. Be fair, concise, evidence-based, and do not reward irrelevant content. This is only a recommendation for a human recruiter; never claim the evaluation is final. Return only the requested JSON structure.",
    JSON.stringify({
      question: submission.assessmentItem.question,
      expectedAnswer: submission.assessmentItem.expectedAnswer,
      candidateAnswer: submission.answer,
      maximumPoints: submission.assessmentItem.points,
    }),
  );
  const parsed = evaluationSuggestionSchema.parse(suggestion);
  return {
    ...parsed,
    suggestedScore: Math.min(Math.max(parsed.suggestedScore, 0), submission.assessmentItem.points),
    maxScore: submission.assessmentItem.points,
    submissionId: submission.id,
  };
};
