import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as attemptService from "./attempt.service";

const getCandidateId = (req: Request): string => {
  const candidateId = req.user?.id;
  if (!candidateId) {
    throw new AppError(401, "Authentication required.");
  }
  return candidateId;
};

export const startAttempt = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token || Array.isArray(token)) {
    throw new AppError(400, "Invitation token is required.");
  }
  const attempt = await attemptService.startAttempt(getCandidateId(req), token);
  return sendSuccess(res, "Assessment attempt started.", attempt, 201);
});

export const listCandidateAttempts = catchAsync(
  async (req: Request, res: Response) => {
    const attempts = await attemptService.listCandidateAttempts(
      getCandidateId(req),
      req.query as unknown as Parameters<
        typeof attemptService.listCandidateAttempts
      >[1],
    );
    return sendSuccess(
      res,
      "Candidate attempts retrieved successfully.",
      attempts,
      200,
    );
  },
);

export const getAttempt = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.id;
  if (!attemptId || Array.isArray(attemptId)) {
    throw new AppError(400, "Attempt ID is required.");
  }
  const attempt = await attemptService.getAttempt(
    getCandidateId(req),
    attemptId,
  );
  return sendSuccess(res, "Attempt retrieved successfully.", attempt, 200);
});

export const submitAttempt = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.id;
  if (!attemptId || Array.isArray(attemptId)) {
    throw new AppError(400, "Attempt ID is required.");
  }
  const attempt = await attemptService.submitAttempt(
    getCandidateId(req),
    attemptId,
    req.body,
  );
  await writeAuditEvent({
    actorId: getCandidateId(req),
    action: "ATTEMPT_SUBMITTED",
    entity: "Attempt",
    entityId: attemptId,
    metadata: { status: attempt.status },
    request: req,
  });
  return sendSuccess(res, "Attempt submitted successfully.", attempt, 200);
});
