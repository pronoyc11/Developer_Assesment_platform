import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as attemptService from "../attempts/attempt.service";

export const evaluateWrittenSubmission = catchAsync(
  async (req: Request, res: Response) => {
    const recruiterId = req.user?.id;
    const submissionId = req.params.submissionId;
    if (!recruiterId) {
      throw new AppError(401, "Authentication required.");
    }
    if (!submissionId || Array.isArray(submissionId)) {
      throw new AppError(400, "Submission ID is required.");
    }
    const result = await attemptService.evaluateWrittenSubmission(
      recruiterId,
      recruiterId,
      submissionId,
      req.body,
    );
    await writeAuditEvent({
      actorId: recruiterId,
      action: "SUBMISSION_EVALUATED",
      entity: "Submission",
      entityId: submissionId,
      request: req,
    });
    return sendSuccess(
      res,
      "Written submission evaluated successfully.",
      result,
      200,
    );
  },
);
