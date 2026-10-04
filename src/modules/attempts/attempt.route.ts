import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getAttempt,
  listCandidateAttempts,
  submitAttempt,
  cancelAttempt,
} from "./attempt.controller";
import {
  attemptIdParamsSchema,
  listCandidateAttemptsQuerySchema,
  submitAnswersSchema,
  cancelAttemptSchema,
} from "./attempt.validation";

const router = Router();

router.use(authenticate, requireRoles("CANDIDATE"));
router.get(
  "/",
  validate(listCandidateAttemptsQuerySchema, "query"),
  listCandidateAttempts,
);
router.get("/:id", validate(attemptIdParamsSchema, "params"), getAttempt);
router.post(
  "/:id/submit",
  validate(attemptIdParamsSchema, "params"),
  validate(submitAnswersSchema),
  submitAttempt,
);
router.post(
  "/:id/cancel",
  validate(attemptIdParamsSchema, "params"),
  validate(cancelAttemptSchema),
  cancelAttempt,
);

export default router;
