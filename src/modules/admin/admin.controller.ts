import type { Request, Response } from "express";
import { writeAuditEvent } from "../../lib/audit";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as adminService from "./admin.service";

export const listRecruiterApplications = catchAsync(
  async (req: Request, res: Response) => {
    const applications = await adminService.listRecruiterApplications(
      req.query as unknown as { page: number; limit: number },
    );

    return sendSuccess(
      res,
      "Pending recruiter applications retrieved successfully.",
      applications,
      200,
    );
  },
);

export const approveRecruiterApplication = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.params.userId;
    if (!userId || Array.isArray(userId)) {
      throw new AppError(400, "User ID is required.");
    }

    const user = await adminService.approveRecruiterApplication(userId);
    await writeAuditEvent({
      actorId: req.user?.id ?? null,
      action: "RECRUITER_APPROVED",
      entity: "User",
      entityId: userId,
      request: req,
    });

    return sendSuccess(
      res,
      "Recruiter application approved successfully.",
      user,
      200,
    );
  },
);

export const rejectRecruiterApplication = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!userId || Array.isArray(userId)) throw new AppError(400, "User ID is required.");
  const user = await adminService.rejectRecruiterApplication(userId);
  await writeAuditEvent({ actorId: req.user?.id ?? null, action: "RECRUITER_REJECTED", entity: "User", entityId: userId, request: req });
  return sendSuccess(res, "Recruiter application rejected successfully.", user, 200);
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.listUsers(
    req.query as unknown as Parameters<typeof adminService.listUsers>[0],
  );
  return sendSuccess(res, "Users retrieved successfully.", result, 200);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.id;
  if (!userId || Array.isArray(userId)) {
    throw new AppError(400, "User ID is required.");
  }
  const user = await adminService.getUser(userId);
  return sendSuccess(res, "User retrieved successfully.", user, 200);
});

export const updateUserStatus = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    if (!userId || Array.isArray(userId)) {
      throw new AppError(400, "User ID is required.");
    }
    const user = await adminService.updateUserStatus(userId, req.body.status);
    await writeAuditEvent({
      actorId: req.user?.id ?? null,
      action: "USER_STATUS_CHANGED",
      entity: "User",
      entityId: userId,
      metadata: { status: user.status },
      request: req,
    });
    return sendSuccess(res, "User status updated successfully.", user, 200);
  },
);

export const getDashboard = catchAsync(async (_req: Request, res: Response) => {
  const dashboard = await adminService.getDashboard();
  return sendSuccess(res, "Admin dashboard summary retrieved.", dashboard, 200);
});

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const logs = await adminService.listAuditLogs(
    req.query as unknown as Parameters<typeof adminService.listAuditLogs>[0],
  );
  return sendSuccess(res, "Audit logs retrieved successfully.", logs, 200);
});

export const getAuditLog = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id || Array.isArray(id)) {
    throw new AppError(400, "Audit log ID is required.");
  }
  const log = await adminService.getAuditLog(id);
  return sendSuccess(res, "Audit log retrieved successfully.", log, 200);
});
