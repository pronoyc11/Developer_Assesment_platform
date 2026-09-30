import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/appError";

export const validate = <T>(
  schema: ZodType<T>,
  source: "body" | "query" | "params" = "body",
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new AppError(400, "Validation failed", errors));
    }

    Object.defineProperty(req, source, {
      value: result.data,
      configurable: true,
      enumerable: true,
      writable: true,
    });

    next();
  };
};
