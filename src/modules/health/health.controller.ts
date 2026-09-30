import type { Request, Response } from "express";
import { env } from "../../config/index.js";
// import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/response.js";

export const healthCheck = (_req: Request, res: Response): void => {
  sendSuccess(res, "API is healthy", {
    status: "OK",
    environment: env.NODE_ENV,
  });
};
