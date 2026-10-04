import { z } from "zod";

const titleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(255, "Title cannot exceed 255 characters");

const descriptionSchema = z
  .string()
  .trim()
  .max(10000, "Description cannot exceed 10000 characters");

const durationSchema = z
  .number()
  .int("Duration must be an integer")
  .min(1, "Duration must be at least 1 minute")
  .max(600, "Duration cannot exceed 600 minutes");

const passingScoreSchema = z
  .number()
  .int("Passing score must be an integer percentage")
  .min(0, "Passing score cannot be below 0")
  .max(100, "Passing score cannot exceed 100");

export const createAssessmentSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    durationMinutes: durationSchema,
    passingScore: passingScoreSchema.default(0),
  })
  .strict();

export const updateAssessmentSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    durationMinutes: durationSchema.optional(),
    passingScore: passingScoreSchema.optional(),
  })
  .strict()
  .refine((assessment) => Object.keys(assessment).length > 0, {
    message: "At least one assessment field must be provided",
  });

export const listAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "READY", "PUBLISHED", "CLOSED"]).optional(),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "title",
      "durationMinutes",
      "passingScore",
      "status",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const assessmentIdParamsSchema = z.object({
  assessmentId: z.string().uuid("Assessment ID must be a valid UUID"),
});

export const assessmentItemParamsSchema = z.object({
  assessmentId: z.string().uuid("Assessment ID must be a valid UUID"),
  itemId: z.string().uuid("Assessment item ID must be a valid UUID"),
});

export const listAssessmentCandidatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(255).optional(),
  kind: z.enum(["ATTENDED", "PASSED"]).default("ATTENDED"),
});

export const addAssessmentItemSchema = z
  .object({
    problemId: z.string().uuid("Problem ID must be a valid UUID"),
    order: z.number().int().min(1).max(10000),
  })
  .strict();

export const updateAssessmentItemSchema = z
  .object({
    order: z.number().int().min(1).max(10000),
  })
  .strict();

export const reorderAssessmentItemsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            itemId: z.string().uuid("Assessment item ID must be a valid UUID"),
            order: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .min(1, "At least one assessment item is required"),
  })
  .strict()
  .superRefine(({ items }, context) => {
    if (new Set(items.map((item) => item.itemId)).size !== items.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Assessment item IDs must not be duplicated",
      });
    }

    const orders = items.map((item) => item.order);
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Assessment item orders must not be duplicated",
      });
    }

    if (!orders.every((order) => order <= items.length)) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Orders must be consecutive values from 1 to the item count",
      });
    }
  });

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;
export type ListAssessmentCandidatesQuery = z.infer<typeof listAssessmentCandidatesQuerySchema>;
export type AddAssessmentItemInput = z.infer<typeof addAssessmentItemSchema>;
export type UpdateAssessmentItemInput = z.infer<
  typeof updateAssessmentItemSchema
>;
export type ReorderAssessmentItemsInput = z.infer<
  typeof reorderAssessmentItemsSchema
>;
