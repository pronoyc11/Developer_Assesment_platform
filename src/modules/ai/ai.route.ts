import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { suggestWrittenEvaluation, generateProblemDraft } from "./ai.controller";
import { aiSubmissionParamsSchema, problemDraftSchema } from "./ai.validation";

const router = Router();

router.use(authenticate, requireRoles("RECRUITER"));
router.post("/problem-drafts", validate(problemDraftSchema), generateProblemDraft);
router.post(
  "/submissions/:submissionId/evaluation-suggestion",
  validate(aiSubmissionParamsSchema, "params"),
  suggestWrittenEvaluation,
);

export default router;
