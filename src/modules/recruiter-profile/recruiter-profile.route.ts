import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { uploadCompanyLogo } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getRecruiterProfile,
  updateCompanyLogo,
  updateRecruiterProfile,
} from "./recruiter-profile.controller";
import { updateRecruiterProfileSchema } from "./recruiter-profile.validation";

const router = Router();

router.get(
  "/me/profile",
  authenticate,
  requireRoles("RECRUITER", "ADMIN"),
  getRecruiterProfile,
);

router.patch(
  "/me/profile",
  authenticate,
  requireRoles("RECRUITER", "ADMIN"),
  validate(updateRecruiterProfileSchema),
  updateRecruiterProfile,
);

router.patch(
  "/me/profile/logo",
  authenticate,
  requireRoles("RECRUITER", "ADMIN"),
  uploadCompanyLogo,
  updateCompanyLogo,
);

export default router;
