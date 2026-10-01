import type { Request, Response } from "express";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as userService from "./user.service";

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Authentication required.");
  }

  const profile = await userService.getProfile(userId);

  return sendSuccess(res, "Profile retrieved successfully.", profile, 200);
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Authentication required.");
  }

  const updatedProfile = await userService.updateProfile(userId, req.body);

  return sendSuccess(res, "Profile updated successfully.", updatedProfile, 200);
});

export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required.");
    }

    await userService.changePassword(userId, req.body);

    return sendSuccess(
      res,
      "Password changed successfully. Please log in again with your new password.",
      null,
      200,
    );
  },
);

export const updateAvatar = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Authentication required.");
  }

  if (!req.file?.buffer || req.file.buffer.length === 0) {
    throw new AppError(400, "Avatar image file is required.");
  }

  const updatedProfile = await userService.updateAvatar(
    userId,
    req.file.buffer,
  );

  return sendSuccess(res, "Avatar updated successfully.", updatedProfile, 200);
});
