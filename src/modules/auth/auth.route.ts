import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import {
  googleLogin,
  login,
  logout,
  refreshToken,
  register,
  resendVerification,
  verifyEmail,
} from "./auth.controller";
import {
  googleAuthSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  resendVerification,
);
router.post("/login", validate(loginSchema), login);
router.post("/google", validate(googleAuthSchema), googleLogin);
router.post("/refresh", validate(refreshTokenSchema), refreshToken);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(logoutSchema), logout);

export default router;
