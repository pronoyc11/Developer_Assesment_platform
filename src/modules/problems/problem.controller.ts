import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as problemService from "./problem.service";

const getRecruiterId = (req: Request): string => {
  const recruiterId = req.user?.id;
  if (!recruiterId) {
    throw new AppError(401, "Authentication required.");
  }
  return recruiterId;
};

export const createProblem = catchAsync(async (req: Request, res: Response) => {
  const problem = await problemService.createProblem(
    getRecruiterId(req),
    req.body,
  );
  await writeAuditEvent({
    actorId: getRecruiterId(req),
    action: "PROBLEM_CREATED",
    entity: "Problem",
    entityId: problem.id,
    request: req,
  });
  return sendSuccess(res, "Problem created successfully.", problem, 201);
});

export const listProblems = catchAsync(async (req: Request, res: Response) => {
  const problems = await problemService.listProblems(
    getRecruiterId(req),
    req.query as unknown as Parameters<typeof problemService.listProblems>[1],
  );
  return sendSuccess(res, "Problems retrieved successfully.", problems, 200);
});

export const getProblem = catchAsync(async (req: Request, res: Response) => {
  const problemId = req.params.id;
  if (!problemId || Array.isArray(problemId)) {
    throw new AppError(400, "Problem ID is required.");
  }
  const problem = await problemService.getProblem(
    getRecruiterId(req),
    problemId,
  );
  return sendSuccess(res, "Problem retrieved successfully.", problem, 200);
});

export const updateProblem = catchAsync(async (req: Request, res: Response) => {
  const problemId = req.params.id;
  if (!problemId || Array.isArray(problemId)) {
    throw new AppError(400, "Problem ID is required.");
  }
  const problem = await problemService.updateProblem(
    getRecruiterId(req),
    problemId,
    req.body,
  );
  await writeAuditEvent({
    actorId: getRecruiterId(req),
    action: "PROBLEM_UPDATED",
    entity: "Problem",
    entityId: problem.id,
    metadata: { fields: Object.keys(req.body) },
    request: req,
  });
  return sendSuccess(res, "Problem updated successfully.", problem, 200);
});

export const deleteProblem = catchAsync(async (req: Request, res: Response) => {
  const problemId = req.params.id;
  if (!problemId || Array.isArray(problemId)) {
    throw new AppError(400, "Problem ID is required.");
  }
  await problemService.deleteProblem(getRecruiterId(req), problemId);
  await writeAuditEvent({
    actorId: getRecruiterId(req),
    action: "PROBLEM_DELETED",
    entity: "Problem",
    entityId: problemId,
    request: req,
  });
  return sendSuccess(res, "Problem deleted successfully.", null, 200);
});
