import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import {
  googleLogin,
  forgotPassword,
  login,
  logout,
  refreshToken,
  register,
  resendVerification,
  verifyEmail,
  resetPassword,
} from "./auth.controller";
import {
  googleAuthSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  resendVerification,
);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/login", validate(loginSchema), login);
router.post("/google", validate(googleAuthSchema), googleLogin);
router.post("/refresh", validate(refreshTokenSchema), refreshToken);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(logoutSchema), logout);

export default router;
