import crypto from "node:crypto";
import { type LoginTicket, OAuth2Client } from "google-auth-library";
import { env } from "../../config/env";
import type { Role, User } from "../../generated/prisma/client";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { sendVerificationOtpEmail } from "../../lib/mailer";
import { comparePassword, hashPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { hashToken } from "../../utils/token";
import {
  deletePendingRegistration,
  generateNumericOtp,
  getPendingRegistration,
  isResendCooldownActive,
  setResendCooldown,
  storeEmailVerificationOtp,
  storePendingRegistration,
  verifyEmailVerificationOtp,
} from "./auth.otp";
import type { AuthenticatedUser, AuthTokens } from "./auth.type";
import type {
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  VerifyEmailInput,
} from "./auth.validation";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  emailVerified: user.emailVerified,
});

const createTokens = async (user: AuthenticatedUser): Promise<AuthTokens> => {
  const tokenId = crypto.randomUUID();

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  });

  const refreshToken = signRefreshToken({
    userId: user.id,
    tokenId,
  });

  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
  };
};

export const register = async (data: RegisterInput) => {
  const normalizedEmail = data.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser && !existingUser.deletedAt) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(data.password);
  const role: Role = data.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";
  await storePendingRegistration(normalizedEmail, {
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
  });

  // Generate 6-digit numeric OTP and store in Redis with 10-minute expiration
  const otp = generateNumericOtp();
  await storeEmailVerificationOtp(normalizedEmail, otp);
  await setResendCooldown(normalizedEmail);

  // Send verification email via Nodemailer
  try {
    await sendVerificationOtpEmail(normalizedEmail, otp);
  } catch (error) {
    console.error(
      "Verification email dispatch failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw new AppError(
      502,
      "Registration is pending, but the verification email could not be delivered. Please try resending verification.",
    );
  }

  return {
    email: normalizedEmail,
    emailVerified: false,
  };
};

export const verifyEmail = async (data: VerifyEmailInput) => {
  const normalizedEmail = data.email.trim().toLowerCase();
  const registration = await getPendingRegistration(normalizedEmail);
  if (!registration) {
    throw new AppError(
      400,
      "Registration is invalid or has expired. Please register again.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser && !existingUser.deletedAt) {
    throw new AppError(409, "An account with this email already exists");
  }

  // Verify OTP against Redis with attempt limiting and expiration
  await verifyEmailVerificationOtp(normalizedEmail, data.otp);

  const userData = {
    name: registration.name,
    email: normalizedEmail,
    passwordHash: registration.passwordHash,
    authProvider: "LOCAL" as const,
    status: "ACTIVE" as const,
    deletedAt: null,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    role: "CANDIDATE" as const,
    recruiterStatus:
      registration.role === "RECRUITER"
        ? ("PENDING" as const)
        : ("NOT_REQUESTED" as const),
  };

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: userData,
      })
    : await prisma.user.create({ data: userData });

  await deletePendingRegistration(normalizedEmail);
  const safeUser = sanitizeUser(user);
  const tokens = await createTokens(safeUser);
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    recruiterStatus: user.recruiterStatus,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

export const resendVerification = async (data: ResendVerificationInput) => {
  const normalizedEmail = data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });
  const pendingRegistration = await getPendingRegistration(normalizedEmail);
  const pendingForNewUser = Boolean(
    pendingRegistration && (!user || user.deletedAt),
  );
  const existingUnverifiedLocalUser = Boolean(
    user &&
      !user.deletedAt &&
      !user.emailVerified &&
      user.authProvider === "LOCAL",
  );

  // Privacy-preserving response: do not disclose whether email exists or account is verified
  if (!pendingForNewUser && !existingUnverifiedLocalUser) {
    return null;
  }

  // Check 60-second cooldown in Redis
  const isCooldown = await isResendCooldownActive(normalizedEmail);
  if (isCooldown) {
    throw new AppError(
      429,
      "Please wait at least 60 seconds before requesting a new verification code.",
    );
  }

  // Generate new OTP, replace existing in Redis, reset attempts, set cooldown
  const otp = generateNumericOtp();
  if (pendingRegistration) {
    await storePendingRegistration(normalizedEmail, pendingRegistration);
  }
  await storeEmailVerificationOtp(normalizedEmail, otp);
  await setResendCooldown(normalizedEmail);

  try {
    await sendVerificationOtpEmail(normalizedEmail, otp);
  } catch (error) {
    console.error(
      "Verification email resend failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw new AppError(
      502,
      "Failed to deliver verification email. Please try again later.",
    );
  }

  return null;
};

export const login = async (data: LoginInput) => {
  const normalizedEmail = data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.authProvider === "GOOGLE" && !user.passwordHash) {
    throw new AppError(
      400,
      "This account was created with Google. Please log in using Google.",
    );
  }

  if (!user.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "Your account is not active");
  }

  const passwordMatches = await comparePassword(
    data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.emailVerified) {
    throw new AppError(403, "Please verify your email before logging in");
  }

  const safeUser = sanitizeUser(user);
  const tokens = await createTokens(safeUser);

  return {
    user: safeUser,
    ...tokens,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  let payload: ReturnType<typeof verifyRefreshToken>;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt <= new Date()
  ) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  if (storedToken.user.id !== payload.userId) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (storedToken.user.deletedAt || storedToken.user.status !== "ACTIVE") {
    throw new AppError(403, "User account is not active");
  }

  // Atomically revoke old token and create new token
  const safeUser = sanitizeUser(storedToken.user);
  const newAccessToken = signAccessToken({
    userId: safeUser.id,
    role: safeUser.role,
    email: safeUser.email,
    name: safeUser.name,
  });

  const newTokenId = crypto.randomUUID();
  const newRefreshToken = signRefreshToken({
    userId: safeUser.id,
    tokenId: newTokenId,
  });

  const newTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: safeUser.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  return {
    user: safeUser,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return storedToken?.userId ?? null;
};

export const googleLogin = async (data: GoogleAuthInput) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Google authentication is not configured");
  }

  const token = data.idToken || data.credential;
  if (!token) {
    throw new AppError(400, "Google ID token is required");
  }

  let ticket: LoginTicket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    console.error(
      "Google token verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw new AppError(401, "Invalid Google credential");
  }

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub || !payload.email_verified) {
    throw new AppError(
      401,
      "Google account email is not verified or information is incomplete",
    );
  }

  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  let user: User;

  if (existingUser) {
    if (existingUser.deletedAt) {
      throw new AppError(403, "This account is no longer available");
    }

    if (existingUser.status !== "ACTIVE") {
      throw new AppError(403, "Your account is not active");
    }

    // Edge Case: If account was registered locally with password, reject automatic overwrite
    if (existingUser.authProvider === "LOCAL" && existingUser.passwordHash) {
      throw new AppError(
        409,
        "An account with this email already exists using password authentication. Please log in with your email and password.",
      );
    }

    const updatedName = (payload.name ?? "").trim() || existingUser.name;

    user = await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        authProvider: "GOOGLE",
        name: updatedName,
        emailVerified: true,
        emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
      },
    });
  } else {
    const newName =
      (payload.name ?? "").trim() || email.split("@")[0] || "User";

    user = await prisma.user.create({
      data: {
        email,
        name: newName,
        authProvider: "GOOGLE",
        role: "CANDIDATE",
        status: "ACTIVE",
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  const safeUser = sanitizeUser(user);
  const tokens = await createTokens(safeUser);

  return {
    user: safeUser,
    ...tokens,
  };
};
