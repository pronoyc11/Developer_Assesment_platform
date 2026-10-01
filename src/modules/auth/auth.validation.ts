import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Invalid email address")
  .transform((val) => val.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must not exceed 150 characters"),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE").optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits"),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required").optional(),
  })
  .optional();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required").optional(),
  })
  .optional();

export const googleAuthSchema = z
  .object({
    idToken: z.string().min(1, "Google ID token is required").optional(),
    credential: z.string().min(1, "Google credential is required").optional(),
  })
  .refine((data) => Boolean(data.idToken || data.credential), {
    message: "Either idToken or credential must be provided",
    path: ["idToken"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
