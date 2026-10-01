import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createProblem,
  deleteProblem,
  getProblem,
  listProblems,
  updateProblem,
} from "./problem.controller";
import {
  createProblemSchema,
  listProblemsQuerySchema,
  problemIdParamsSchema,
  updateProblemSchema,
} from "./problem.validation";

const router = Router();

router.use(authenticate, requireRoles("RECRUITER"));
router.post("/", validate(createProblemSchema), createProblem);
router.get("/", validate(listProblemsQuerySchema, "query"), listProblems);
router.get("/:id", validate(problemIdParamsSchema, "params"), getProblem);
router.patch(
  "/:id",
  validate(problemIdParamsSchema, "params"),
  validate(updateProblemSchema),
  updateProblem,
);
router.delete("/:id", validate(problemIdParamsSchema, "params"), deleteProblem);

export default router;
