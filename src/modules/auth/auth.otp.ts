import crypto from "node:crypto";
import type { Role } from "../../generated/prisma/client";
import { getRedisClient } from "../../lib/redis";
import { AppError } from "../../utils/appError";
import { hashToken } from "../../utils/token";

const OTP_TTL_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
const MAX_FAILED_ATTEMPTS = 5;

export type PendingRegistration = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

const getPendingRegistrationKey = (normalizedEmail: string): string =>
  `auth:email-verification:pending:${normalizedEmail}`;

const getOtpKey = (normalizedEmail: string): string =>
  `auth:email-verification:otp:${normalizedEmail}`;

const getAttemptsKey = (normalizedEmail: string): string =>
  `auth:email-verification:attempts:${normalizedEmail}`;

const getResendKey = (normalizedEmail: string): string =>
  `auth:email-verification:resend:${normalizedEmail}`;

export const storePendingRegistration = async (
  normalizedEmail: string,
  registration: PendingRegistration,
): Promise<void> => {
  const redis = await getRedisClient();
  await redis.set(
    getPendingRegistrationKey(normalizedEmail),
    JSON.stringify(registration),
    { EX: OTP_TTL_SECONDS },
  );
};

export const getPendingRegistration = async (
  normalizedEmail: string,
): Promise<PendingRegistration | null> => {
  const redis = await getRedisClient();
  const registration = await redis.get(
    getPendingRegistrationKey(normalizedEmail),
  );
  return registration
    ? (JSON.parse(registration) as PendingRegistration)
    : null;
};

export const deletePendingRegistration = async (
  normalizedEmail: string,
): Promise<void> => {
  const redis = await getRedisClient();
  await redis.del(getPendingRegistrationKey(normalizedEmail));
};

export const generateNumericOtp = (): string => {
  const otpNumber = crypto.randomInt(0, 1000000);
  return otpNumber.toString().padStart(6, "0");
};

export const storeEmailVerificationOtp = async (
  normalizedEmail: string,
  otp: string,
): Promise<void> => {
  const redis = await getRedisClient();
  const hashedOtp = hashToken(otp);

  const otpKey = getOtpKey(normalizedEmail);
  const attemptsKey = getAttemptsKey(normalizedEmail);

  // Store hashed OTP with 10-minute expiration
  await redis.set(otpKey, hashedOtp, { EX: OTP_TTL_SECONDS });

  // Reset any previous failed attempt counter
  await redis.del(attemptsKey);
};

export const isResendCooldownActive = async (
  normalizedEmail: string,
): Promise<boolean> => {
  const redis = await getRedisClient();
  const resendKey = getResendKey(normalizedEmail);
  const exists = await redis.exists(resendKey);
  return exists > 0;
};

export const setResendCooldown = async (
  normalizedEmail: string,
): Promise<void> => {
  const redis = await getRedisClient();
  const resendKey = getResendKey(normalizedEmail);
  await redis.set(resendKey, "1", { EX: RESEND_COOLDOWN_SECONDS });
};

export const verifyEmailVerificationOtp = async (
  normalizedEmail: string,
  submittedOtp: string,
): Promise<void> => {
  const redis = await getRedisClient();
  const otpKey = getOtpKey(normalizedEmail);
  const attemptsKey = getAttemptsKey(normalizedEmail);

  // Check attempt limit
  const attemptsStr = await redis.get(attemptsKey);
  const attempts = Number(attemptsStr ?? "0");

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Invalidate OTP immediately
    await redis.del([otpKey, attemptsKey]);
    throw new AppError(
      400,
      "Maximum verification attempts exceeded. Please request a new verification code.",
    );
  }

  // Retrieve stored hashed OTP
  const storedHash = await redis.get(otpKey);
  if (!storedHash) {
    throw new AppError(
      400,
      "Verification code is invalid or has expired. Please request a new one.",
    );
  }

  const submittedHash = hashToken(submittedOtp);

  // Secure comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(submittedHash),
    Buffer.from(storedHash),
  );

  if (!isValid) {
    const newAttempts = await redis.incr(attemptsKey);
    if (newAttempts === 1) {
      await redis.expire(attemptsKey, OTP_TTL_SECONDS);
    }

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      await redis.del([otpKey, attemptsKey]);
      throw new AppError(
        400,
        "Maximum verification attempts exceeded. Please request a new verification code.",
      );
    }

    const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
    throw new AppError(
      400,
      `Invalid verification code. ${remaining} attempt(s) remaining.`,
    );
  }

  // Verification succeeded - delete single-use OTP and attempt keys
  await redis.del([otpKey, attemptsKey, getResendKey(normalizedEmail)]);
};
