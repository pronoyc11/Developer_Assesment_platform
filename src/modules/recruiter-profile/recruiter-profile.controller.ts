import type { Request, Response } from "express";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as recruiterProfileService from "./recruiter-profile.service";

export const getRecruiterProfile = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required.");
    }

    const profile = await recruiterProfileService.getRecruiterProfile(userId);

    return sendSuccess(
      res,
      "Recruiter profile retrieved successfully.",
      profile,
      200,
    );
  },
);

export const updateRecruiterProfile = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required.");
    }

    const updatedProfile = await recruiterProfileService.upsertRecruiterProfile(
      userId,
      req.body,
    );

    return sendSuccess(
      res,
      "Recruiter profile updated successfully.",
      updatedProfile,
      200,
    );
  },
);

export const updateCompanyLogo = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required.");
    }

    if (!req.file?.buffer || req.file.buffer.length === 0) {
      throw new AppError(400, "Company logo image file is required.");
    }

    const updatedProfile = await recruiterProfileService.updateCompanyLogo(
      userId,
      req.file.buffer,
    );

    return sendSuccess(
      res,
      "Company logo updated successfully.",
      updatedProfile,
      200,
    );
  },
);
