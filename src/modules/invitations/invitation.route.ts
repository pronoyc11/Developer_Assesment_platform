import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  acceptInvitation,
  acceptInvitationById,
  deleteInvitation,
  getInvitation,
  listCandidateInvitations,
  rejectInvitation,
  startAttempt,
} from "./invitation.controller";
import {
  invitationIdParamsSchema,
  invitationTokenParamsSchema,
  listCandidateInvitationsQuerySchema,
  rejectInvitationSchema,
} from "./invitation.validation";

const router = Router();

router.get(
  "/candidate-invitations",
  authenticate,
  requireRoles("CANDIDATE"),
  validate(listCandidateInvitationsQuerySchema, "query"),
  listCandidateInvitations,
);
router.get(
  "/:id",
  authenticate,
  validate(invitationIdParamsSchema, "params"),
  getInvitation,
);
router.post(
  "/id/:id/accept",
  authenticate,
  requireRoles("CANDIDATE"),
  validate(invitationIdParamsSchema, "params"),
  acceptInvitationById,
);
router.post(
  "/id/:id/reject",
  authenticate,
  requireRoles("CANDIDATE"),
  validate(invitationIdParamsSchema, "params"),
  validate(rejectInvitationSchema),
  rejectInvitation,
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
