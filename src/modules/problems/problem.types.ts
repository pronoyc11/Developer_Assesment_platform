import type { Problem, QuestionType } from "../../generated/prisma/client";

export type RecruiterProblemResponse = Pick<
  Problem,
  | "id"
  | "title"
  | "question"
  | "type"
  | "options"
  | "correctAnswer"
  | "expectedAnswer"
  | "points"
  | "createdAt"
  | "updatedAt"
>;

export type CandidateProblemResponse = {
  id: string;
  title: string;
  question: string;
  type: QuestionType;
  options: string[];
  points: number;
};
