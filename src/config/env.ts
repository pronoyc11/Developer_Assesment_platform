import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const getEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  PORT: Number(process.env.PORT ?? 5000),

  DATABASE_URL: getEnv("DATABASE_URL"),

  JWT_ACCESS_SECRET: getEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET"),

  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  ASSESSMENT_PUBLISH_FEE: Number(process.env.ASSESSMENT_PUBLISH_FEE ?? "1000"),
  ASSESSMENT_PUBLISH_CURRENCY: process.env.ASSESSMENT_PUBLISH_CURRENCY ?? "usd",

  REDIS_USERNAME: process.env.REDIS_USERNAME!,
  REDIS_HOST: process.env.REDIS_HOST!,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD!,
  REDIS_PORT: process.env.REDIS_PORT!,
  REDIS_URL: process.env.REDIS_URL ?? "",

  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "",
  SMTP_FROM:
    process.env.SMTP_FROM ??
    "Developer Assessment Platform <noreply@example.com>",
} as const;

export type Env = typeof env;
