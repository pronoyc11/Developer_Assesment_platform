import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { getPagination, getPaginationMeta } from "../../utils/pagination";
import type {
  ListAdminUsersQuery,
  ListAuditLogsQuery,
  ListRecruiterApplicationsQuery,
} from "./admin.validation";

export const listRecruiterApplications = async (
  query: ListRecruiterApplicationsQuery,
) => {
  const { page, limit } = query;
  const where = {
    recruiterStatus: "PENDING" as const,
    role: "CANDIDATE" as const,
    deletedAt: null,
  };

  const [applications, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        recruiterStatus: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    applications,
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const approveRecruiterApplication = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      recruiterStatus: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "Recruiter application not found.");
  }

  if (user.role !== "CANDIDATE" || user.recruiterStatus !== "PENDING") {
    throw new AppError(409, "Recruiter application is not pending approval.");
  }

  const [approvedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        role: "RECRUITER",
        recruiterStatus: "APPROVED",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        recruiterStatus: true,
        status: true,
      },
    }),
    prisma.recruiterProfile.upsert({
      where: { userId },
      create: { userId },
      update: { deletedAt: null },
    }),
  ]);

  return approvedUser;
};

export const rejectRecruiterApplication = async (userId: string) => {
  const result = await prisma.user.updateMany({
    where: { id: userId, role: "CANDIDATE", recruiterStatus: "PENDING", deletedAt: null },
    data: { recruiterStatus: "NOT_REQUESTED" },
  });
  if (result.count !== 1) throw new AppError(409, "Recruiter application is not pending approval.");
  return getUser(userId);
};

export const listUsers = async (query: ListAdminUsersQuery) => {
  const { page, limit, skip } = getPagination(query);
  const where = {
    deletedAt: null,
    ...(query.role && { role: query.role }),
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" as const } },
        { email: { contains: query.search, mode: "insensitive" as const } },
      ],
    }),
  };
  const orderByMap = {
    createdAt: { createdAt: query.sortOrder },
    name: { name: query.sortOrder },
    email: { email: query.sortOrder },
    role: { role: query.sortOrder },
    status: { status: query.sortOrder },
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        recruiterStatus: true,
        status: true,
        emailVerified: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: orderByMap[query.sortBy],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, pagination: getPaginationMeta(page, limit, total) };
};

export const getUser = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      recruiterStatus: true,
      status: true,
      emailVerified: true,
      emailVerifiedAt: true,
      authProvider: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    throw new AppError(404, "User not found.");
  }
  return user;
};

export const updateUserStatus = async (
  userId: string,
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED",
) => {
  const result = await prisma.user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { status },
  });
  if (result.count !== 1) {
    throw new AppError(404, "User not found.");
  }
  return getUser(userId);
};

export const getDashboard = async () => {
  const [
    totalUsers,
    candidates,
    recruiters,
    admins,
    activeUsers,
    blockedUsers,
    totalAssessments,
    publishedAssessments,
    totalAttempts,
    totalPayments,
    paidPayments,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, role: "CANDIDATE" } }),
    prisma.user.count({ where: { deletedAt: null, role: "RECRUITER" } }),
    prisma.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.user.count({ where: { deletedAt: null, status: "BLOCKED" } }),
    prisma.assessment.count({ where: { deletedAt: null } }),
    prisma.assessment.count({
      where: { deletedAt: null, status: "PUBLISHED" },
    }),
    prisma.attempt.count(),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: "PAID" } }),
  ]);
  return {
    users: {
      total: totalUsers,
      candidates,
      recruiters,
      admins,
      active: activeUsers,
      blocked: blockedUsers,
    },
    assessments: { total: totalAssessments, published: publishedAssessments },
    attempts: { total: totalAttempts },
    payments: { total: totalPayments, paid: paidPayments },
  };
};

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  const { page, limit, skip } = getPagination(query);
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    throw new AppError(400, "The from date must be before the to date.");
  }
  const where = {
    ...(query.actorId && { actorId: query.actorId }),
    ...(query.action && { action: query.action }),
    ...(query.entity && { entity: query.entity }),
    ...(query.entityId && { entityId: query.entityId }),
    ...((query.from || query.to) && {
      createdAt: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
    }),
  };
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, pagination: getPaginationMeta(page, limit, total) };
};

export const getAuditLog = async (id: string) => {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    select: {
      id: true,
      actorId: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });
  if (!log) {
    throw new AppError(404, "Audit log not found.");
  }
  return log;
};
