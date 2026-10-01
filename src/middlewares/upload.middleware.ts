import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/appError";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        400,
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      ),
    );
  }
};

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
});

const matchesImageSignature = (file: Express.Multer.File): boolean => {
  const { buffer, mimetype } = file;

  if (mimetype === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimetype === "image/png") {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimetype === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
};

export const createSingleUpload = (fieldName: string): RequestHandler => {
  const uploadHandler = multerInstance.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadHandler(req, res, (err: unknown) => {
      if (!err) {
        if (req.file && !matchesImageSignature(req.file)) {
          return next(
            new AppError(
              400,
              "File content does not match a supported image format.",
            ),
          );
        }
        return next();
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(413, "File size exceeds the allowed limit of 5 MB."),
          );
        }
        return next(new AppError(400, `Upload error: ${err.message}`));
      }

      if (err instanceof AppError) {
        return next(err);
      }

      return next(
        new AppError(
          400,
          err instanceof Error ? err.message : "File upload failed.",
        ),
      );
    });
  };
};

export const uploadAvatar = createSingleUpload("avatar");
export const uploadCompanyLogo = createSingleUpload("logo");
