import type { Assessment, AssessmentItem } from "../../generated/prisma/client";

export type RecruiterAssessmentItemResponse = Pick<
  AssessmentItem,
  | "id"
  | "problemId"
  | "order"
  | "title"
  | "question"
  | "type"
  | "options"
  | "points"
  | "correctAnswer"
  | "expectedAnswer"
>;

export type CandidateAssessmentItemResponse = Pick<
  AssessmentItem,
  "id" | "order" | "title" | "question" | "type" | "options" | "points"
>;

export type RecruiterAssessmentSummary = Pick<
  Assessment,
  | "id"
  | "title"
  | "description"
  | "durationMinutes"
  | "passingScore"
  | "status"
  | "createdAt"
  | "updatedAt"
> & { itemCount: number };
