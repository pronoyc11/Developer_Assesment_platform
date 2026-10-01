import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  evaluateSubmissionSchema,
  submissionIdParamsSchema,
} from "../attempts/attempt.validation";
import { evaluateWrittenSubmission } from "./submission.controller";

const router = Router();

router.patch(
  "/:submissionId/evaluate",
  authenticate,
  requireRoles("RECRUITER"),
  validate(submissionIdParamsSchema, "params"),
  validate(evaluateSubmissionSchema),
  evaluateWrittenSubmission,
);

export default router;
