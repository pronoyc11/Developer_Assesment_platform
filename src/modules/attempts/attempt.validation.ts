import { z } from "zod";

const attemptIdParamsSchema = z.object({
  id: z.string().uuid("Attempt ID must be a valid UUID"),
});

const invitationTokenParamsSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invitation token is invalid"),
});

const submitAnswersSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            assessmentItemId: z
              .string()
              .uuid("Assessment item ID must be a valid UUID"),
            answer: z
              .string()
              .max(50000, "Answer cannot exceed 50000 characters"),
          })
          .strict(),
      )
      .min(1, "At least one answer is required"),
  })
  .strict()
  .superRefine(({ answers }, context) => {
    if (
      new Set(answers.map((answer) => answer.assessmentItemId)).size !==
      answers.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["answers"],
        message: "Each assessment item can only be answered once",
      });
    }
  });

const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum(["PENDING", "AUTO_EVALUATED", "MANUALLY_EVALUATED"])
    .optional(),
});

const listCandidateAttemptsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "EVALUATED"])
    .optional(),
});

const submissionIdParamsSchema = z.object({
  submissionId: z.string().uuid("Submission ID must be a valid UUID"),
});

const evaluateSubmissionSchema = z
  .object({
    score: z.number().int().min(0).max(1000),
    feedback: z.string().trim().max(10000).optional(),
  })
  .strict();

export {
  attemptIdParamsSchema,
  evaluateSubmissionSchema,
  invitationTokenParamsSchema,
  listCandidateAttemptsQuerySchema,
  listSubmissionsQuerySchema,
  submissionIdParamsSchema,
  submitAnswersSchema,
};

export type EvaluateSubmissionInput = z.infer<typeof evaluateSubmissionSchema>;
export type ListCandidateAttemptsQuery = z.infer<
  typeof listCandidateAttemptsQuerySchema
>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SubmitAnswersInput = z.infer<typeof submitAnswersSchema>;
