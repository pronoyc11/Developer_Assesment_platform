import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/appError";
import "../types/express";

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : req.cookies?.accessToken;

    if (!token) {
      throw new AppError(
        401,
        "Authentication required. Please provide an access token.",
      );
    }

    let payload: ReturnType<typeof verifyAccessToken>;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "Invalid or expired access token.");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        deletedAt: true,
        emailVerified: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError(
        401,
        "User account not found or has been deactivated.",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new AppError(403, "User account is suspended or blocked.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    };

    next();
  } catch (error) {
    next(error);
  }
};
