import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { listSubmissionsQuerySchema } from "../attempts/attempt.validation";
import {
  createInvitationSchema,
  listInvitationsQuerySchema,
} from "../invitations/invitation.validation";
import {
  addAssessmentItem,
  createAssessment,
  createAssessmentInvitation,
  createPublishingCheckout,
  deleteAssessment,
  deleteAssessmentItem,
  getAssessment,
  listAssessmentInvitations,
  listAssessmentSubmissions,
  listAssessments,
  markAssessmentReady,
  reorderAssessmentItems,
  updateAssessment,
  updateAssessmentItem,
} from "./assessment.controller";
import {
  addAssessmentItemSchema,
  assessmentIdParamsSchema,
  assessmentItemParamsSchema,
  createAssessmentSchema,
  listAssessmentsQuerySchema,
  reorderAssessmentItemsSchema,
  updateAssessmentItemSchema,
  updateAssessmentSchema,
} from "./assessment.validation";

const router = Router();

router.use(authenticate, requireRoles("RECRUITER"));
router.post("/", validate(createAssessmentSchema), createAssessment);
router.get("/", validate(listAssessmentsQuerySchema, "query"), listAssessments);
router.post(
  "/:assessmentId/invitations",
  validate(assessmentIdParamsSchema, "params"),
  validate(createInvitationSchema),
  createAssessmentInvitation,
);
router.get(
  "/:assessmentId/invitations",
  validate(assessmentIdParamsSchema, "params"),
  validate(listInvitationsQuerySchema, "query"),
  listAssessmentInvitations,
);
router.get(
  "/:assessmentId/submissions",
  validate(assessmentIdParamsSchema, "params"),
  validate(listSubmissionsQuerySchema, "query"),
  listAssessmentSubmissions,
);
router.post(
  "/:assessmentId/items",
  validate(assessmentIdParamsSchema, "params"),
  validate(addAssessmentItemSchema),
  addAssessmentItem,
);
router.patch(
  "/:assessmentId/items/reorder",
  validate(assessmentIdParamsSchema, "params"),
  validate(reorderAssessmentItemsSchema),
  reorderAssessmentItems,
);
router.patch(
  "/:assessmentId/items/:itemId",
  validate(assessmentItemParamsSchema, "params"),
  validate(updateAssessmentItemSchema),
  updateAssessmentItem,
);
router.delete(
  "/:assessmentId/items/:itemId",
  validate(assessmentItemParamsSchema, "params"),
  deleteAssessmentItem,
);
router.post(
  "/:assessmentId/ready",
  validate(assessmentIdParamsSchema, "params"),
  markAssessmentReady,
);
router.post(
  "/:assessmentId/payment",
  validate(assessmentIdParamsSchema, "params"),
  createPublishingCheckout,
);
router.get(
  "/:assessmentId",
  validate(assessmentIdParamsSchema, "params"),
  getAssessment,
);
router.patch(
  "/:assessmentId",
  validate(assessmentIdParamsSchema, "params"),
  validate(updateAssessmentSchema),
  updateAssessment,
);
router.delete(
  "/:assessmentId",
  validate(assessmentIdParamsSchema, "params"),
  deleteAssessment,
);

export default router;
