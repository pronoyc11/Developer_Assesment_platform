import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
}

const ensureCloudinaryConfigured = (): void => {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new AppError(
      503,
      "Cloudinary image service is not configured on this server.",
    );
  }
};

export const uploadImageBuffer = (
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> => {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          console.error(
            "Cloudinary upload error:",
            error?.message || "No result from Cloudinary",
          );
          return reject(
            new AppError(502, "Failed to upload image to storage service."),
          );
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

export const deleteCloudinaryAsset = async (
  publicId: string,
): Promise<void> => {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(
      `Failed to clean up Cloudinary asset with public ID ${publicId}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
