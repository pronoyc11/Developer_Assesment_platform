import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as aiService from "./ai.service";

const recruiterId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, "Authentication required.");
  return req.user.id;
};

export const generateProblemDraft = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.generateProblemDraft(req.body);
  await writeAuditEvent({
    actorId: recruiterId(req),
    action: "AI_PROBLEM_DRAFT_GENERATED",
    entity: "Problem",
    request: req,
    metadata: { type: result.type, points: result.points },
  });
  return sendSuccess(res, "AI problem draft generated successfully.", result, 200);
});

export const suggestWrittenEvaluation = catchAsync(async (req: Request, res: Response) => {
  const submissionId = req.params.submissionId;
  if (!submissionId || Array.isArray(submissionId)) throw new AppError(400, "Submission ID is required.");
  const result = await aiService.suggestWrittenEvaluation(recruiterId(req), submissionId);
  await writeAuditEvent({
    actorId: recruiterId(req),
    action: "AI_WRITTEN_EVALUATION_SUGGESTED",
    entity: "Submission",
    entityId: submissionId,
    request: req,
    metadata: { confidence: result.confidence, suggestedScore: result.suggestedScore },
  });
  return sendSuccess(res, "AI evaluation suggestion generated successfully.", result, 200);
});
