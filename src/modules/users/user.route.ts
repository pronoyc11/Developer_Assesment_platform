import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { uploadAvatar } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  changePassword,
  getProfile,
  updateAvatar,
  updateProfile,
  listCandidates,
  getCandidate,
} from "./user.controller";
import { candidateIdParamsSchema, changePasswordSchema, listCandidatesQuerySchema, updateProfileSchema } from "./user.validation";

const router = Router();

router.get("/candidates", authenticate, requireRoles("RECRUITER"), validate(listCandidatesQuerySchema, "query"), listCandidates);
router.get("/candidates/:id", authenticate, requireRoles("RECRUITER"), validate(candidateIdParamsSchema, "params"), getCandidate);

router.get("/me", authenticate, getProfile);
router.patch("/me", authenticate, validate(updateProfileSchema), updateProfile);
router.patch(
  "/me/password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);
router.patch("/me/avatar", authenticate, uploadAvatar, updateAvatar);

export default router;
