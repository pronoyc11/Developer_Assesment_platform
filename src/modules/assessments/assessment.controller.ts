import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as attemptService from "../attempts/attempt.service";
import * as invitationService from "../invitations/invitation.service";
import * as paymentService from "../payments/payment.service";
import * as assessmentService from "./assessment.service";

const getRecruiterId = (req: Request): string => {
  const recruiterId = req.user?.id;
  if (!recruiterId) {
    throw new AppError(401, "Authentication required.");
  }
  return recruiterId;
};

const getAssessmentId = (req: Request): string => {
  const assessmentId = req.params.assessmentId;
  if (!assessmentId || Array.isArray(assessmentId)) {
    throw new AppError(400, "Assessment ID is required.");
  }
  return assessmentId;
};

export const createAssessment = catchAsync(
  async (req: Request, res: Response) => {
    const assessment = await assessmentService.createAssessment(
      getRecruiterId(req),
      req.body,
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_CREATED",
      entity: "Assessment",
      entityId: assessment.id,
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment created successfully.",
      assessment,
      201,
    );
  },
);

export const listAssessments = catchAsync(
  async (req: Request, res: Response) => {
    const assessments = await assessmentService.listAssessments(
      getRecruiterId(req),
      req.query as unknown as Parameters<
        typeof assessmentService.listAssessments
      >[1],
    );
    return sendSuccess(
      res,
      "Assessments retrieved successfully.",
      assessments,
      200,
    );
  },
);

export const getAssessment = catchAsync(async (req: Request, res: Response) => {
  const assessment = await assessmentService.getAssessment(
    getRecruiterId(req),
    getAssessmentId(req),
  );
  return sendSuccess(
    res,
    "Assessment retrieved successfully.",
    assessment,
    200,
  );
});

export const updateAssessment = catchAsync(
  async (req: Request, res: Response) => {
    const assessment = await assessmentService.updateAssessment(
      getRecruiterId(req),
      getAssessmentId(req),
      req.body,
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_UPDATED",
      entity: "Assessment",
      entityId: assessment.id,
      metadata: { fields: Object.keys(req.body) },
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment updated successfully.",
      assessment,
      200,
    );
  },
);

export const deleteAssessment = catchAsync(
  async (req: Request, res: Response) => {
    await assessmentService.deleteAssessment(
      getRecruiterId(req),
      getAssessmentId(req),
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_DELETED",
      entity: "Assessment",
      entityId: getAssessmentId(req),
      request: req,
    });
    return sendSuccess(res, "Assessment deleted successfully.", null, 200);
  },
);

export const addAssessmentItem = catchAsync(
  async (req: Request, res: Response) => {
    const item = await assessmentService.addAssessmentItem(
      getRecruiterId(req),
      getAssessmentId(req),
      req.body,
    );
    if (!item) {
      throw new AppError(500, "Assessment item could not be created.");
    }
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_ITEM_ADDED",
      entity: "AssessmentItem",
      entityId: item.id,
      metadata: { assessmentId: getAssessmentId(req) },
      request: req,
    });
    return sendSuccess(res, "Problem added to assessment.", item, 201);
  },
);

export const updateAssessmentItem = catchAsync(
  async (req: Request, res: Response) => {
    const itemId = req.params.itemId;
    if (!itemId || Array.isArray(itemId)) {
      throw new AppError(400, "Assessment item ID is required.");
    }
    const item = await assessmentService.updateAssessmentItem(
      getRecruiterId(req),
      getAssessmentId(req),
      itemId,
      req.body,
    );
    if (!item) {
      throw new AppError(500, "Assessment item could not be updated.");
    }
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_ITEM_REORDERED",
      entity: "AssessmentItem",
      entityId: item.id,
      metadata: { assessmentId: getAssessmentId(req), order: item.order },
      request: req,
    });
    return sendSuccess(res, "Assessment item updated successfully.", item, 200);
  },
);

export const deleteAssessmentItem = catchAsync(
  async (req: Request, res: Response) => {
    const itemId = req.params.itemId;
    if (!itemId || Array.isArray(itemId)) {
      throw new AppError(400, "Assessment item ID is required.");
    }
    await assessmentService.deleteAssessmentItem(
      getRecruiterId(req),
      getAssessmentId(req),
      itemId,
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_ITEM_REMOVED",
      entity: "AssessmentItem",
      entityId: itemId,
      metadata: { assessmentId: getAssessmentId(req) },
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment item removed and order normalized.",
      null,
      200,
    );
  },
);

export const reorderAssessmentItems = catchAsync(
  async (req: Request, res: Response) => {
    const result = await assessmentService.reorderAssessmentItems(
      getRecruiterId(req),
      getAssessmentId(req),
      req.body,
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_ITEMS_REORDERED",
      entity: "Assessment",
      entityId: getAssessmentId(req),
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment items reordered successfully.",
      result,
      200,
    );
  },
);

export const markAssessmentReady = catchAsync(
  async (req: Request, res: Response) => {
    const assessment = await assessmentService.markAssessmentReady(
      getRecruiterId(req),
      getAssessmentId(req),
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "ASSESSMENT_READY",
      entity: "Assessment",
      entityId: assessment.id,
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment is ready for later publishing.",
      assessment,
      200,
    );
  },
);

export const createAssessmentInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const invitation = await invitationService.createInvitation(
      getRecruiterId(req),
      getAssessmentId(req),
      req.body,
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "INVITATION_CREATED",
      entity: "Invitation",
      entityId: invitation.id,
      metadata: { assessmentId: invitation.assessmentId },
      request: req,
    });
    return sendSuccess(
      res,
      "Assessment invitation created and emailed successfully.",
      invitation,
      201,
    );
  },
);

export const listAssessmentInvitations = catchAsync(
  async (req: Request, res: Response) => {
    const invitations = await invitationService.listAssessmentInvitations(
      getRecruiterId(req),
      getAssessmentId(req),
      req.query as unknown as Parameters<
        typeof invitationService.listAssessmentInvitations
      >[2],
    );
    return sendSuccess(
      res,
      "Assessment invitations retrieved successfully.",
      invitations,
      200,
    );
  },
);

export const listAssessmentSubmissions = catchAsync(
  async (req: Request, res: Response) => {
    const result = await attemptService.listAssessmentSubmissions(
      getRecruiterId(req),
      getAssessmentId(req),
      req.query as unknown as Parameters<
        typeof attemptService.listAssessmentSubmissions
      >[2],
    );
    return sendSuccess(res, "Submissions retrieved successfully.", result, 200);
  },
);

export const createPublishingCheckout = catchAsync(
  async (req: Request, res: Response) => {
    const result = await paymentService.createPublishingCheckout(
      getRecruiterId(req),
      getAssessmentId(req),
    );
    await writeAuditEvent({
      actorId: getRecruiterId(req),
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: result.paymentId,
      metadata: { assessmentId: getAssessmentId(req) },
      request: req,
    });
    return sendSuccess(res, "Stripe checkout session created.", result, 201);
  },
);
