import { z } from "zod";

const invitationTokenSchema = z
  .string()
  // .regex(/^[A-Za-z0-9_-]{43}$/, "Invitation token is invalid");

export const createInvitationSchema = z
  .object({
    candidateId: z.string().uuid("Candidate ID must be a valid UUID"),
  })
  .strict();

export const listInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "ACCEPTED", "USED", "REJECTED"]).optional(),
  search: z.string().trim().max(255).optional(),
  sortBy: z
    .enum(["createdAt", "expiresAt", "status", "email"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const listCandidateInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "ACCEPTED", "USED", "REJECTED"]).optional(),
});

export const invitationIdParamsSchema = z.object({
  id: z.string().uuid("Invitation ID must be a valid UUID"),
});

export const invitationTokenParamsSchema = z.object({
  token: invitationTokenSchema,
});

export const rejectInvitationSchema = z
  .object({
    reason: z.string().trim().min(1, "Rejection reason is required.").max(5000),
  })
  .strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
export type ListCandidateInvitationsQuery = z.infer<
  typeof listCandidateInvitationsQuerySchema
>;
export type RejectInvitationInput = z.infer<typeof rejectInvitationSchema>;
