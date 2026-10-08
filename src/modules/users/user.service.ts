import type { User } from "../../generated/prisma/client";
import { deleteCloudinaryAsset, uploadImageBuffer } from "../../lib/cloudinary";
import { comparePassword, hashPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import type { UserProfileResponse } from "./user.types";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
  ListCandidatesQuery,
} from "./user.validation";
import { getPagination, getPaginationMeta } from "../../utils/pagination";

export const toPublicUserProfile = (user: User): UserProfileResponse => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  recruiterStatus: user.recruiterStatus,
  status: user.status,
  avatarUrl: user.avatarUrl,
  emailVerified: user.emailVerified,
  authProvider: user.authProvider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = async (
  userId: string,
): Promise<UserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User not found or account is deactivated.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "User account is suspended or blocked.");
  }

  return toPublicUserProfile(user);
};

export const updateProfile = async (
  userId: string,
  data: UpdateProfileInput,
): Promise<UserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User not found or account is deactivated.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "User account is suspended or blocked.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name.trim(),
    },
  });

  return toPublicUserProfile(updatedUser);
};

export const changePassword = async (
  userId: string,
  data: ChangePasswordInput,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User not found or account is deactivated.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "User account is suspended or blocked.");
  }

  if (user.authProvider === "GOOGLE" && !user.passwordHash) {
    throw new AppError(
      400,
      "This account was created with Google. Password change is not applicable.",
    );
  }

  if (!user.passwordHash) {
    throw new AppError(400, "No password exists for this account.");
  }

  const isPasswordValid = await comparePassword(
    data.currentPassword,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AppError(400, "Current password is incorrect.");
  }

  const newPasswordHash = await hashPassword(data.newPassword);

  // Atomically update password and invalidate all active refresh tokens for this user
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);
};

export const updateAvatar = async (
  userId: string,
  fileBuffer: Buffer,
): Promise<UserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User not found or account is deactivated.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "User account is suspended or blocked.");
  }

  // 1. Upload new image to Cloudinary
  const uploadResult = await uploadImageBuffer(
    fileBuffer,
    "developer-assessment-platform/avatars",
  );

  const oldPublicId = user.avatarPublicId;

  // 2. Update user in database with new URL and public ID
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: uploadResult.secureUrl,
        avatarPublicId: uploadResult.publicId,
      },
    });

    // 3. Delete previous Cloudinary asset after database update succeeds
    if (oldPublicId) {
      await deleteCloudinaryAsset(oldPublicId);
    }

    return toPublicUserProfile(updatedUser);
  } catch (error) {
    // Compensating cleanup of the newly uploaded asset if DB update fails
    await deleteCloudinaryAsset(uploadResult.publicId);
    throw error;
  }
};

export const listCandidates = async (query: ListCandidatesQuery) => {
  const { page, limit, skip } = getPagination(query);
  const where = { role: "CANDIDATE" as const, status: "ACTIVE" as const, emailVerified: true, deletedAt: null, ...(query.search && { OR: [{ name: { contains: query.search, mode: "insensitive" as const } }, { email: { contains: query.search, mode: "insensitive" as const } }] }) };
  const [candidates, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true }, orderBy: { name: query.sortOrder }, skip, take: limit }),
    prisma.user.count({ where }),
  ]);
  return { candidates, pagination: getPaginationMeta(page, limit, total) };
};

export const getCandidate = async (candidateId: string) => {
  const candidate = await prisma.user.findFirst({ where: { id: candidateId, role: "CANDIDATE", status: "ACTIVE", emailVerified: true, deletedAt: null }, select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } });
  if (!candidate) throw new AppError(404, "Candidate not found.");
  return candidate;
};

export const listInvitedCandidates = async (recruiterId: string, query: ListCandidatesQuery) => {
  const { page, limit, skip } = getPagination(query);
  const where = {
    role: "CANDIDATE" as const,
    status: "ACTIVE" as const,
    emailVerified: true,
    deletedAt: null,
    invitations: {
      some: {
        deletedAt: null,
        assessment: { recruiterId, deletedAt: null },
      },
    },
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" as const } },
        { email: { contains: query.search, mode: "insensitive" as const } },
      ],
    }),
  };
  const [candidates, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
      orderBy: { name: query.sortOrder },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { candidates, pagination: getPaginationMeta(page, limit, total) };
};

export const getInvitedCandidate = async (recruiterId: string, candidateId: string) => {
  const candidate = await prisma.user.findFirst({
    where: {
      id: candidateId,
      role: "CANDIDATE",
      status: "ACTIVE",
      emailVerified: true,
      deletedAt: null,
      invitations: {
        some: { deletedAt: null, assessment: { recruiterId, deletedAt: null } },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      invitations: {
        where: { deletedAt: null, assessment: { recruiterId, deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          expiresAt: true,
          assessment: {
            select: { id: true, title: true, passingScore: true, durationMinutes: true },
          },
          attempt: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              submittedAt: true,
              evaluatedAt: true,
              totalScore: true,
              maxScore: true,
            },
          },
        },
      },
    },
  });
  if (!candidate) throw new AppError(404, "Invited candidate not found.");
  return {
    ...candidate,
    invitations: candidate.invitations.map((invitation) => ({
      ...invitation,
      attempt: invitation.attempt
        ? {
            ...invitation.attempt,
            passed:
              invitation.attempt.status === "EVALUATED" &&
              invitation.attempt.maxScore > 0 &&
              (invitation.attempt.totalScore / invitation.attempt.maxScore) * 100 >=
                invitation.assessment.passingScore,
          }
        : null,
    })),
  };
};
