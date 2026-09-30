import cors from "cors";
import type { Application } from "express";
import expressRateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "../config";

export const configureSecurity = (app: Application) => {
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.set("trust proxy", 1);
  app.use(
    expressRateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests",
        errors: [],
      },
    }),
  );
};
