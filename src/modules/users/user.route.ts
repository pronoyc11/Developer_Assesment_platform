import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { uploadAvatar } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  changePassword,
  getProfile,
  updateAvatar,
  updateProfile,
} from "./user.controller";
import { changePasswordSchema, updateProfileSchema } from "./user.validation";

const router = Router();

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
