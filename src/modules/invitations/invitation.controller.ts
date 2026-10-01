import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as attemptService from "../attempts/attempt.service";
import * as invitationService from "./invitation.service";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Authentication required.");
  }
  return userId;
};

export const getInvitation = catchAsync(async (req: Request, res: Response) => {
  const invitationId = req.params.id;
  if (!invitationId || Array.isArray(invitationId)) {
    throw new AppError(400, "Invitation ID is required.");
  }
  const invitation = await invitationService.getInvitation(
    getUserId(req),
    invitationId,
  );
  return sendSuccess(
    res,
    "Invitation retrieved successfully.",
    invitation,
    200,
  );
});

export const acceptInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const token = req.params.token;
    if (!token || Array.isArray(token)) {
      throw new AppError(400, "Invitation token is required.");
    }
    const invitation = await invitationService.acceptInvitation(
      getUserId(req),
      token,
    );
    await writeAuditEvent({
      actorId: getUserId(req),
      action: "INVITATION_ACCEPTED",
      entity: "Invitation",
      entityId: invitation.id,
      request: req,
    });
    return sendSuccess(
      res,
      "Invitation accepted successfully.",
      invitation,
      200,
    );
  },
);

export const startAttempt = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token || Array.isArray(token)) {
    throw new AppError(400, "Invitation token is required.");
  }
  const attempt = await attemptService.startAttempt(getUserId(req), token);
  if (!attempt) {
    throw new AppError(500, "Assessment attempt could not be started.");
  }
  await writeAuditEvent({
    actorId: getUserId(req),
    action: "ATTEMPT_STARTED",
    entity: "Attempt",
    entityId: attempt.id,
    metadata: { assessmentId: attempt.assessmentId },
    request: req,
  });
  return sendSuccess(res, "Assessment attempt started.", attempt, 201);
});

export const deleteInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const invitationId = req.params.id;
    if (!invitationId || Array.isArray(invitationId)) {
      throw new AppError(400, "Invitation ID is required.");
    }
    await invitationService.deleteInvitation(getUserId(req), invitationId);
    await writeAuditEvent({
      actorId: getUserId(req),
      action: "INVITATION_DELETED",
      entity: "Invitation",
      entityId: invitationId,
      request: req,
    });
    return sendSuccess(res, "Invitation deleted successfully.", null, 200);
  },
);
