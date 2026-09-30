import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as authService from "./auth.service";

export const register = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);

  return sendSuccess(
    res,
    "Registration successful. Please check your email for the verification OTP.",
    result,
    201,
  );
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.verifyEmail(req.body);

  return sendSuccess(res, "Email verified successfully.", result, 200);
});

export const resendVerification = catchAsync(
  async (req: Request, res: Response) => {
    await authService.resendVerification(req.body);

    return sendSuccess(
      res,
      "If an unverified account exists for this email, a verification OTP has been sent.",
      null,
      200,
    );
  },
);

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  return sendSuccess(res, "Login successful", result, 200);
});

export const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.googleLogin(req.body);

  return sendSuccess(res, "Google authentication successful", result, 200);
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);

  return sendSuccess(res, "Access token refreshed successfully", result, 200);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);

  return sendSuccess(res, "Logout successful", null, 200);
});
