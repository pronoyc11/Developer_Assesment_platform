import { z } from "zod";

const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const listRecruiterApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const approveRecruiterApplicationParamsSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID"),
});

export type ListRecruiterApplicationsQuery = z.infer<
  typeof listRecruiterApplicationsQuerySchema
>;

export const listAdminUsersQuerySchema = z.object({
  ...paginationSchema,
  search: z.string().trim().max(255).optional(),
  role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]).optional(),
  sortBy: z
    .enum(["createdAt", "name", "email", "role", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const adminUserIdParamsSchema = z.object({
  id: z.string().uuid("User ID must be a valid UUID"),
});

export const updateUserStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]),
  })
  .strict();

export const listAuditLogsQuerySchema = z.object({
  ...paginationSchema,
  actorId: z.string().uuid().optional(),
  action: z.string().trim().max(100).optional(),
  entity: z.string().trim().max(100).optional(),
  entityId: z.string().trim().max(255).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const auditLogIdParamsSchema = z.object({
  id: z.string().uuid("Audit log ID must be a valid UUID"),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
