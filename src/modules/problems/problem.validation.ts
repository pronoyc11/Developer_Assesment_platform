import { z } from "zod";

const titleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(255, "Title cannot exceed 255 characters");

const questionSchema = z.string().trim().min(1, "Question is required");
const pointsSchema = z
  .number()
  .int("Points must be an integer")
  .min(1, "Points must be at least 1")
  .max(1000, "Points cannot exceed 1000");

const optionsSchema = z
  .array(z.string().trim().min(1, "Options cannot be empty"))
  .min(2, "MCQ problems must have at least 2 options")
  .max(10, "MCQ problems cannot have more than 10 options")
  .superRefine((options, context) => {
    if (new Set(options).size !== options.length) {
      context.addIssue({
        code: "custom",
        message: "Options must not contain duplicates",
      });
    }
  });

export const createProblemSchema = z.discriminatedUnion("type", [
  z
    .object({
      title: titleSchema,
      question: questionSchema,
      type: z.literal("MCQ"),
      options: optionsSchema,
      correctAnswer: z.string().trim().min(1, "Correct answer is required"),
      expectedAnswer: z.never().optional(),
      points: pointsSchema,
    })
    .strict()
    .superRefine((problem, context) => {
      if (!problem.options.includes(problem.correctAnswer)) {
        context.addIssue({
          code: "custom",
          path: ["correctAnswer"],
          message: "Correct answer must exactly match one of the options",
        });
      }
    }),
  z
    .object({
      title: titleSchema,
      question: questionSchema,
      type: z.literal("WRITTEN"),
      options: z.never().optional(),
      correctAnswer: z.never().optional(),
      expectedAnswer: z
        .string()
        .trim()
        .min(1, "Expected answer is required")
        .max(10000, "Expected answer cannot exceed 10000 characters"),
      points: pointsSchema,
    })
    .strict(),
]);

export const updateProblemSchema = z
  .object({
    title: titleSchema.optional(),
    question: questionSchema.optional(),
    type: z.enum(["MCQ", "WRITTEN"]).optional(),
    options: optionsSchema.optional(),
    correctAnswer: z.string().trim().min(1).optional(),
    expectedAnswer: z.string().trim().min(1).max(10000).optional(),
    points: pointsSchema.optional(),
  })
  .strict()
  .superRefine((problem, context) => {
    if (Object.keys(problem).length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one problem field must be provided",
      });
    }

    if (problem.type === "MCQ" && problem.expectedAnswer !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["expectedAnswer"],
        message: "MCQ problems cannot have an expectedAnswer",
      });
    }

    if (
      problem.type === "WRITTEN" &&
      (problem.options !== undefined || problem.correctAnswer !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Written problems cannot have options or a correctAnswer",
      });
    }

    if (
      problem.type === "MCQ" &&
      problem.options &&
      problem.correctAnswer &&
      !problem.options.includes(problem.correctAnswer)
    ) {
      context.addIssue({
        code: "custom",
        path: ["correctAnswer"],
        message: "Correct answer must exactly match one of the options",
      });
    }
  });

export const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(255).optional(),
  type: z.enum(["MCQ", "WRITTEN"]).optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "points", "type"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const problemIdParamsSchema = z.object({
  id: z.string().uuid("Problem ID must be a valid UUID"),
});

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
