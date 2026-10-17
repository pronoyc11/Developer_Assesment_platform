import { z } from "zod";

export const problemDraftSchema = z
  .object({
    topic: z.string().trim().min(2).max(200),
    type: z.enum(["MCQ", "WRITTEN"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    points: z.number().int().min(1).max(100),
  })
  .strict();

export const aiSubmissionParamsSchema = z.object({
  submissionId: z.string().uuid("Submission ID must be a valid UUID"),
});

export type ProblemDraftInput = z.infer<typeof problemDraftSchema>;
