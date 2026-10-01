import type { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/client";
import { AppError } from "../utils/appError";

export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError(
          401,
          "Authentication required. Please provide a Bearer token.",
        ),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          "You do not have permission to access this resource.",
        ),
      );
      return;
    }

    next();
  };
};
