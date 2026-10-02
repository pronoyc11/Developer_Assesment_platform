import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getAttempt,
  listCandidateAttempts,
  submitAttempt,
} from "./attempt.controller";
import {
  attemptIdParamsSchema,
  listCandidateAttemptsQuerySchema,
  submitAnswersSchema,
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

export default router;
