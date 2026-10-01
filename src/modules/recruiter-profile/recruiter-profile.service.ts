import type { RecruiterProfile } from "../../generated/prisma/client";
import { deleteCloudinaryAsset, uploadImageBuffer } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import type { RecruiterProfileResponse } from "./recruiter-profile.types";
import type { UpdateRecruiterProfileInput } from "./recruiter-profile.validation";

export const toPublicRecruiterProfile = (
  profile: RecruiterProfile,
): RecruiterProfileResponse => ({
  id: profile.id,
  userId: profile.userId,
  companyName: profile.companyName,
  companyDescription: profile.companyDescription,
  companyWebsite: profile.companyWebsite,
  companyLogoUrl: profile.companyLogoUrl,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

const ensureActiveUser = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User account not found or deactivated.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "User account is suspended or blocked.");
  }
};

export const getRecruiterProfile = async (
  userId: string,
): Promise<RecruiterProfileResponse> => {
  await ensureActiveUser(userId);

  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
  });

  if (!profile || profile.deletedAt) {
    throw new AppError(404, "Recruiter profile not found.");
  }

  return toPublicRecruiterProfile(profile);
};

export const upsertRecruiterProfile = async (
  userId: string,
  data: UpdateRecruiterProfileInput,
): Promise<RecruiterProfileResponse> => {
  await ensureActiveUser(userId);

  const profile = await prisma.recruiterProfile.upsert({
    where: { userId },
    create: {
      userId,
      companyName: data.companyName ? data.companyName.trim() : null,
      companyDescription: data.companyDescription
        ? data.companyDescription.trim()
        : null,
      companyWebsite: data.companyWebsite ? data.companyWebsite.trim() : null,
    },
    update: {
      ...(data.companyName !== undefined && {
        companyName: data.companyName.trim(),
      }),
      ...(data.companyDescription !== undefined && {
        companyDescription: data.companyDescription.trim(),
      }),
      ...(data.companyWebsite !== undefined && {
        companyWebsite: data.companyWebsite ? data.companyWebsite.trim() : null,
      }),
      deletedAt: null,
    },
  });

  return toPublicRecruiterProfile(profile);
};

export const updateCompanyLogo = async (
  userId: string,
  fileBuffer: Buffer,
): Promise<RecruiterProfileResponse> => {
  await ensureActiveUser(userId);

  const existingProfile = await prisma.recruiterProfile.findUnique({
    where: { userId },
  });

  const oldPublicId = existingProfile?.companyLogoPublicId;

  // 1. Upload to Cloudinary
  const uploadResult = await uploadImageBuffer(
    fileBuffer,
    "developer-assessment-platform/company-logos",
  );

  // 2. Persist to database
  try {
    const profile = await prisma.recruiterProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyLogoUrl: uploadResult.secureUrl,
        companyLogoPublicId: uploadResult.publicId,
      },
      update: {
        companyLogoUrl: uploadResult.secureUrl,
        companyLogoPublicId: uploadResult.publicId,
        deletedAt: null,
      },
    });

    // 3. Delete old asset if replacement was successful
    if (oldPublicId) {
      await deleteCloudinaryAsset(oldPublicId);
    }

    return toPublicRecruiterProfile(profile);
  } catch (error) {
    // Compensating cleanup of the newly uploaded image
    await deleteCloudinaryAsset(uploadResult.publicId);
    throw error;
  }
};
