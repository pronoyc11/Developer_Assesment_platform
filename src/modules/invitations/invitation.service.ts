import crypto from "node:crypto";
import { env } from "../../config/env";
import { Prisma } from "../../generated/prisma/client";
import { sendAssessmentInvitationEmail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { getPagination, getPaginationMeta } from "../../utils/pagination";
import { hashToken } from "../../utils/token";
import type {
  CreateInvitationInput,
  ListCandidateInvitationsQuery,
  ListInvitationsQuery,
} from "./invitation.validation";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const invitationPublicSelect = {
  id: true,
  assessmentId: true,
  candidateId: true,
  email: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  usedAt: true,
  createdAt: true,
} satisfies Prisma.InvitationSelect;

const orderByFor = (
  sortBy: ListInvitationsQuery["sortBy"],
  sortOrder: "asc" | "desc",
) => {
  const orderByMap = {
    createdAt: { createdAt: sortOrder },
    expiresAt: { expiresAt: sortOrder },
    status: { status: sortOrder },
    email: { email: sortOrder },
  } satisfies Record<
    ListInvitationsQuery["sortBy"],
    Prisma.InvitationOrderByWithRelationInput
  >;
  return orderByMap[sortBy];
};

const throwInvitationConflict = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    throw new AppError(
      409,
      "An invitation already exists for this candidate and assessment.",
    );
  }
  throw error;
};

export const createInvitation = async (
  recruiterId: string,
  assessmentId: string,
  data: CreateInvitationInput,
) => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);

  const result = await prisma
    .$transaction(
      async (transaction) => {
        const assessment = await transaction.assessment.findFirst({
          where: {
            id: assessmentId,
            recruiterId,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            status: true,
            closedAt: true,
            recruiter: {
              select: {
                name: true,
                recruiterProfile: { select: { companyName: true } },
              },
            },
          },
        });
        if (!assessment) {
          throw new AppError(404, "Assessment not found.");
        }
        if (assessment.status !== "PUBLISHED" || assessment.closedAt) {
          throw new AppError(
            409,
            "Invitations can only be sent for published, open assessments.",
          );
        }

        const candidate = await transaction.user.findFirst({
          where: {
            id: data.candidateId,
            role: "CANDIDATE",
            status: "ACTIVE",
            emailVerified: true,
            deletedAt: null,
          },
          select: { id: true, email: true },
        });
        if (!candidate) {
          throw new AppError(
            404,
            "An active, verified candidate account was not found.",
          );
        }

        const existing = await transaction.invitation.findUnique({
          where: {
            assessmentId_candidateId: {
              assessmentId,
              candidateId: candidate.id,
            },
          },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            deletedAt: true,
          },
        });
        const canReuse = Boolean(
          existing &&
          existing.status === "PENDING" &&
          (existing.deletedAt ||
            (existing.expiresAt && existing.expiresAt <= now)),
        );
        if (existing && !canReuse) {
          throw new AppError(
            409,
            "An invitation already exists for this candidate and assessment.",
          );
        }

        const inviteData = {
          email: candidate.email,
          token: tokenHash,
          status: "PENDING" as const,
          expiresAt,
          acceptedAt: null,
          usedAt: null,
          deletedAt: null,
        };
        const createdInvitation = existing
          ? await transaction.invitation.update({
            where: { id: existing.id },
            data: inviteData,
            select: invitationPublicSelect,
          })
          : await transaction.invitation.create({
            data: {
              assessmentId,
              candidateId: candidate.id,
              ...inviteData,
            },
            select: invitationPublicSelect,
          });

        return {
          invitation: createdInvitation,
          emailContext: {
            assessmentTitle: assessment.title,
            recruiterName: assessment.recruiter.name,
            companyName:
              assessment.recruiter.recruiterProfile?.companyName ?? null,
            candidateEmail: candidate.email,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((error: unknown) => throwInvitationConflict(error));
  const { invitation, emailContext } = result;

  const acceptanceUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/invitations/${rawToken}`;
  try {
    await sendAssessmentInvitationEmail({
      to: emailContext.candidateEmail,
      assessmentTitle: emailContext.assessmentTitle,
      recruiterName: emailContext.recruiterName,
      companyName: emailContext.companyName,
      expiresAt,
      acceptanceUrl,
    });
  } catch (error) {
    await prisma.invitation
      .updateMany({
        where: {
          id: invitation.id,
          token: tokenHash,
          status: "PENDING",
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        console.error("Failed to deactivate an unsent invitation.");
      });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(502, "Failed to deliver the assessment invitation.");
  }

  return invitation;
};

export const listAssessmentInvitations = async (
  recruiterId: string,
  assessmentId: string,
  query: ListInvitationsQuery,
) => {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, recruiterId, deletedAt: null },
    select: { id: true },
  });
  if (!assessment) {
    throw new AppError(404, "Assessment not found.");
  }

  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InvitationWhereInput = {
    assessmentId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.search && {
      candidate: {
        is: {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        },
      },
    }),
  };
  const [invitations, total] = await prisma.$transaction([
    prisma.invitation.findMany({
      where,
      orderBy: orderByFor(query.sortBy, query.sortOrder),
      skip,
      take: limit,
      select: {
        ...invitationPublicSelect,
        candidate: { select: { name: true } },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  return {
    invitations,
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const listCandidateInvitations = async (
  candidateId: string,
  query: ListCandidateInvitationsQuery,
) => {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InvitationWhereInput = {
    candidateId,
    deletedAt: null,
    assessment: { is: { deletedAt: null } },
    ...(query.status && { status: query.status }),
  };

  const [invitations, total] = await prisma.$transaction([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        ...invitationPublicSelect,
        assessment: {
          select: {
            title: true,
            description: true,
            durationMinutes: true,
            passingScore: true,
            status: true,
            closedAt: true,
            recruiter: {
              select: {
                name: true,
                recruiterProfile: { select: { companyName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  return {
    invitations,
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const getInvitation = async (userId: string, invitationId: string) => {
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      deletedAt: null,
      OR: [
        { candidateId: userId },
        { assessment: { is: { recruiterId: userId } } },
      ],
    },
    select: {
      ...invitationPublicSelect,
      candidate: { select: { name: true } },
      assessment: {
        select: { title: true, status: true, durationMinutes: true },
      },
      token: true
    },
  });
  if (!invitation) {
    throw new AppError(404, "Invitation not found.");
  }
  return invitation;
};

export const acceptInvitation = async (
  candidateId: string,
  rawToken: string,
) => {
  // const token = hashToken(rawToken);
  const token = rawToken;
  const now = new Date();

  return prisma
    .$transaction(
      async (transaction) => {
        const invitation = await transaction.invitation.findUnique({
          where: { token },
          select: {
            id: true,
            candidateId: true,
            status: true,
            expiresAt: true,
            deletedAt: true,
            assessment: {
              select: {
                title: true,
                status: true,
                closedAt: true,
                deletedAt: true,
              },
            },
          },
        });
        if (!invitation || invitation.deletedAt) {
          throw new AppError(404, "Invitation not found.");
        }
        if (invitation.candidateId !== candidateId) {
          throw new AppError(404, "Invitation not found.");
        }
        if (invitation.status !== "PENDING") {
          throw new AppError(409, "Invitation is no longer pending.");
        }
        if (!invitation.expiresAt || invitation.expiresAt <= now) {
          throw new AppError(410, "Invitation has expired.");
        }
        if (
          invitation.assessment.deletedAt ||
          invitation.assessment.status !== "PUBLISHED" ||
          invitation.assessment.closedAt
        ) {
          throw new AppError(
            409,
            "This assessment is no longer accepting invitations.",
          );
        }

        const candidate = await transaction.user.findFirst({
          where: {
            id: candidateId,
            role: "CANDIDATE",
            status: "ACTIVE",
            emailVerified: true,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!candidate) {
          throw new AppError(
            403,
            "An active, verified candidate account is required.",
          );
        }

        const changed = await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            candidateId,
            status: "PENDING",
            deletedAt: null,
            expiresAt: { gt: now },
          },
          data: { status: "ACCEPTED", acceptedAt: now },
        });
        if (changed.count !== 1) {
          throw new AppError(
            409,
            "Invitation has already been accepted or expired.",
          );
        }

        return {
          id: invitation.id,
          status: "ACCEPTED" as const,
          acceptedAt: now,
          expiresAt: invitation.expiresAt,
          assessment: { title: invitation.assessment.title },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new AppError(
          409,
          "Invitation changed concurrently. Please retry.",
        );
      }
      throw error;
    });
};

export const acceptInvitationById = async (candidateId: string, invitationId: string) => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, candidateId, deletedAt: null }, select: { id: true, status: true, expiresAt: true, assessment: { select: { title: true, status: true, closedAt: true, deletedAt: true } } } });
  if (!invitation) throw new AppError(404, "Invitation not found.");
  if (invitation.status !== "PENDING") throw new AppError(409, "Invitation is no longer pending.");
  if (!invitation.expiresAt || invitation.expiresAt <= now) throw new AppError(410, "Invitation has expired.");
  if (invitation.assessment.deletedAt || invitation.assessment.status !== "PUBLISHED" || invitation.assessment.closedAt) throw new AppError(409, "This assessment is no longer accepting invitations.");
  const changed = await prisma.invitation.updateMany({ where: { id: invitationId, candidateId, status: "PENDING", deletedAt: null, expiresAt: { gt: now } }, data: { token: hashToken(rawToken), status: "ACCEPTED", acceptedAt: now } });
  if (changed.count !== 1) throw new AppError(409, "Invitation changed and can no longer be accepted.");
  return { id: invitation.id, status: "ACCEPTED" as const, acceptedAt: now, expiresAt: invitation.expiresAt, token: rawToken, assessment: { title: invitation.assessment.title } };
};

export const deleteInvitation = async (
  recruiterId: string,
  invitationId: string,
): Promise<void> => {
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      deletedAt: null,
      assessment: { is: { recruiterId, deletedAt: null } },
    },
    select: { id: true, status: true },
  });
  if (!invitation) {
    throw new AppError(404, "Invitation not found.");
  }
  if (invitation.status !== "PENDING") {
    throw new AppError(409, "Only pending invitations can be deleted.");
  }

  const result = await prisma.invitation.updateMany({
    where: {
      id: invitationId,
      deletedAt: null,
      status: "PENDING",
      assessment: { is: { recruiterId, deletedAt: null } },
    },
    data: { deletedAt: new Date() },
  });
  if (result.count !== 1) {
    throw new AppError(409, "Invitation changed and can no longer be deleted.");
  }
};
