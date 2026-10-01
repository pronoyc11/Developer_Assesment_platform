import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  acceptInvitation,
  deleteInvitation,
  getInvitation,
  startAttempt,
} from "./invitation.controller";
import {
  invitationIdParamsSchema,
  invitationTokenParamsSchema,
} from "./invitation.validation";

const router = Router();

router.get(
  "/:id",
  authenticate,
  validate(invitationIdParamsSchema, "params"),
  getInvitation,
);
router.post(
  "/:token/accept",
  authenticate,
  validate(invitationTokenParamsSchema, "params"),
  acceptInvitation,
);
router.post(
  "/:token/start",
  authenticate,
  requireRoles("CANDIDATE"),
  validate(invitationTokenParamsSchema, "params"),
  startAttempt,
);
router.delete(
  "/:id",
  authenticate,
  requireRoles("RECRUITER"),
  validate(invitationIdParamsSchema, "params"),
  deleteInvitation,
);

export default router;
