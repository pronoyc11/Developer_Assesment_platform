import type { Request, Response } from "express";
import { env } from "../../config";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as authService from "./auth.service";

const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) => {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV !== "development",
    sameSite:
      env.NODE_ENV === "development" ? ("lax" as const) : ("none" as const),
    path: "/",
  };

  res.cookie("accessToken", tokens.accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 15,
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
};

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
  setAuthCookies(res, result);
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

  setAuthCookies(res, result);
  return sendSuccess(res, "Login successful", result, 200);
});

export const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.googleLogin(req.body);

  setAuthCookies(res, result);
  return sendSuccess(res, "Google authentication successful", result, 200);
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new AppError(401, "Refresh token is required");
  }
  const result = await authService.refreshAccessToken(refreshToken);

  setAuthCookies(res, result);
  return sendSuccess(res, "Access token refreshed successfully", result, 200);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new AppError(401, "Refresh token is required");
  }
  await authService.logout(refreshToken);
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });

  return sendSuccess(res, "Logout successful", null, 200);
});
