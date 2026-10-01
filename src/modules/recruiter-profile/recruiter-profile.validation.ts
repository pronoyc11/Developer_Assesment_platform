import { z } from "zod";

export const updateRecruiterProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .max(200, "Company name cannot exceed 200 characters")
    .optional(),
  companyDescription: z
    .string()
    .trim()
    .max(5000, "Company description cannot exceed 5000 characters")
    .optional(),
  companyWebsite: z
    .string()
    .trim()
    .url("Company website must be a valid URL")
    .max(500, "Company website cannot exceed 500 characters")
    .or(z.literal(""))
    .optional(),
});

export type UpdateRecruiterProfileInput = z.infer<
  typeof updateRecruiterProfileSchema
>;
