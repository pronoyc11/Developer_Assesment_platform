import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  approveRecruiterApplication,
  getAuditLog,
  getDashboard,
  getUser,
  listAuditLogs,
  listRecruiterApplications,
  listUsers,
  updateUserStatus,
} from "./admin.controller";
import {
  adminUserIdParamsSchema,
  approveRecruiterApplicationParamsSchema,
  auditLogIdParamsSchema,
  listAdminUsersQuerySchema,
  listAuditLogsQuerySchema,
  listRecruiterApplicationsQuerySchema,
  updateUserStatusSchema,
} from "./admin.validation";

const router = Router();

router.use(authenticate, requireRoles("ADMIN"));
router.get("/dashboard", getDashboard);
router.get("/users", validate(listAdminUsersQuerySchema, "query"), listUsers);
router.get("/users/:id", validate(adminUserIdParamsSchema, "params"), getUser);
router.patch(
  "/users/:id/status",
  validate(adminUserIdParamsSchema, "params"),
  validate(updateUserStatusSchema),
  updateUserStatus,
);
router.get(
  "/audit-logs",
  validate(listAuditLogsQuerySchema, "query"),
  listAuditLogs,
);
router.get(
  "/audit-logs/:id",
  validate(auditLogIdParamsSchema, "params"),
  getAuditLog,
);
router.get(
  "/recruiter-applications",
  validate(listRecruiterApplicationsQuerySchema, "query"),
  listRecruiterApplications,
);
router.patch(
  "/recruiter-applications/:userId/approve",
  validate(approveRecruiterApplicationParamsSchema, "params"),
  approveRecruiterApplication,
);

export default router;
