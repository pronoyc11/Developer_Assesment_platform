import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../utils/appError.js";
import { sendError } from "../utils/response.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    sendError(res, error.message, error.errors, error.statusCode);

    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    sendError(
      res,
      "Database operation failed",
      [
        {
          code: error.code,
        },
      ],
      400,
    );

    return;
  }

  if (error instanceof Error) {
    sendError(res, error.message, [], 500);

    return;
  }

  sendError(res, "Internal server error", [], 500);
};
