import {
  type AssessmentItem,
  type Attempt,
  Prisma,
  type Submission,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { getPagination, getPaginationMeta } from "../../utils/pagination";
import { hashToken } from "../../utils/token";
import type {
  EvaluateSubmissionInput,
  CancelAttemptInput,
  ListCandidateAttemptsQuery,
  ListSubmissionsQuery,
  SubmitAnswersInput,
} from "./attempt.validation";

const candidateItemSelect = {
  id: true,
  order: true,
  title: true,
  question: true,
  type: true,
  options: true,
  points: true,
} satisfies Prisma.AssessmentItemSelect;

const attemptDetailSelect = {
  id: true,
  assessmentId: true,
  candidateId: true,
  invitationId: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  evaluatedAt: true,
  totalScore: true,
  maxScore: true,
  assessment: {
    select: {
      title: true,
      description: true,
      durationMinutes: true,
      passingScore: true,
      items: {
        orderBy: { order: "asc" },
        select: candidateItemSelect,
      },
    },
  },
  submissions: {
    select: {
      assessmentItemId: true,
      answer: true,
      status: true,
    },
  },
} satisfies Prisma.AttemptSelect;

const deadlineFor = (
  startedAt: Date | null,
  durationMinutes: number,
): Date | null =>
  startedAt
    ? new Date(startedAt.getTime() + durationMinutes * 60 * 1000)
    : null;

const candidateAttemptDto = (attempt: {
  id: string;
  assessmentId: string;
  candidateId: string;
  status: Attempt["status"];
  startedAt: Date | null;
  submittedAt: Date | null;
  evaluatedAt: Date | null;
  totalScore: number;
  maxScore: number;
  assessment: {
    title: string;
    description: string | null;
    durationMinutes: number;
    passingScore: number;
    items: Array<
      Pick<
        AssessmentItem,
        "id" | "order" | "title" | "question" | "type" | "options" | "points"
      >
    >;
  };
  submissions: Array<
    Pick<Submission, "assessmentItemId" | "answer" | "status">
  >;
}) => ({
  id: attempt.id,
  assessmentId: attempt.assessmentId,
  status: attempt.status,
  startedAt: attempt.startedAt,
  deadline: deadlineFor(attempt.startedAt, attempt.assessment.durationMinutes),
  remainingTimeSeconds: Math.max(
    0,
    Math.ceil(
      ((deadlineFor(
        attempt.startedAt,
        attempt.assessment.durationMinutes,
      )?.getTime() ?? Date.now()) -
        Date.now()) /
      1000,
    ),
  ),
  submittedAt: attempt.submittedAt,
  evaluatedAt: attempt.evaluatedAt,
  totalScore: attempt.totalScore,
  maxScore: attempt.maxScore,
  assessment: {
    title: attempt.assessment.title,
    description: attempt.assessment.description,
    durationMinutes: attempt.assessment.durationMinutes,
    passingScore: attempt.assessment.passingScore,
    items: attempt.assessment.items.map((item) => ({
      id: item.id,
      order: item.order,
      title: item.title,
      question: item.question,
      type: item.type,
      options: item.options,
      points: item.points,
    })),
  },
  answers: attempt.submissions.map((submission) => ({
    assessmentItemId: submission.assessmentItemId,
    answer: submission.answer,
    status: submission.status,
  })),
  ...(attempt.status === "EVALUATED" && {
    result: {
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      percentage:
        attempt.maxScore === 0
          ? 0
          : Math.round((attempt.totalScore / attempt.maxScore) * 10000) / 100,
      passingScore: attempt.assessment.passingScore,
      passed:
        (attempt.maxScore === 0
          ? 0
          : (attempt.totalScore / attempt.maxScore) * 100) >=
        attempt.assessment.passingScore,
    },
  }),
});

export const listCandidateAttempts = async (
  candidateId: string,
  query: ListCandidateAttemptsQuery,
) => {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.AttemptWhereInput = {
    candidateId,
    ...(query.status && { status: query.status }),
    ...(query.search && { assessment: { is: { title: { contains: query.search, mode: "insensitive" } } } }),
  };

  const [attempts, total] = await prisma.$transaction([
    prisma.attempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        assessmentId: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        evaluatedAt: true,
        totalScore: true,
        maxScore: true,
        assessment: {
          select: {
            title: true,
            description: true,
            durationMinutes: true,
            passingScore: true,
          },
        },
      },
    }),
    prisma.attempt.count({ where }),
  ]);

  return {
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadline: deadlineFor(
        attempt.startedAt,
        attempt.assessment.durationMinutes,
      ),
      submittedAt: attempt.submittedAt,
      evaluatedAt: attempt.evaluatedAt,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      assessment: attempt.assessment,
      ...(attempt.status === "EVALUATED" && {
        result: {
          totalScore: attempt.totalScore,
          maxScore: attempt.maxScore,
          percentage:
            attempt.maxScore === 0
              ? 0
              : Math.round((attempt.totalScore / attempt.maxScore) * 10000) /
                100,
          passingScore: attempt.assessment.passingScore,
          passed:
            (attempt.maxScore === 0
              ? 0
              : (attempt.totalScore / attempt.maxScore) * 100) >=
            attempt.assessment.passingScore,
        },
      }),
    })),
    pagination: getPaginationMeta(page, limit, total),
  };
};

const throwAttemptConflict = (error: unknown, message: string): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    throw new AppError(409, message);
  }
  throw error;
};

export const startAttempt = async (candidateId: string, rawToken: string) => {
  const token = hashToken(rawToken);
  const now = new Date();
  try {
    const attempt = await prisma.$transaction(
      async (transaction) => {
        const invitation = await transaction.invitation.findUnique({
          where: { token },
          select: {
            id: true,
            assessmentId: true,
            candidateId: true,
            status: true,
            expiresAt: true,
            deletedAt: true,
            assessment: {
              select: {
                status: true,
                closedAt: true,
                deletedAt: true,
                durationMinutes: true,
                items: { select: { points: true } },
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
        if (invitation.status !== "ACCEPTED") {
          throw new AppError(
            409,
            "Invitation must be accepted before starting.",
          );
        }
        if (!invitation.expiresAt || invitation.expiresAt <= now) {
          throw new AppError(410, "Invitation has expired.");
        }
        if (
          invitation.assessment.deletedAt ||
          invitation.assessment.status !== "PUBLISHED" ||
          invitation.assessment.closedAt
        ) {
          throw new AppError(409, "This assessment is not available to start.");
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
        if (invitation.assessment.items.length === 0) {
          throw new AppError(409, "This assessment has no items.");
        }

        const maxScore = invitation.assessment.items.reduce(
          (total, item) => total + item.points,
          0,
        );
        const createdAttempt = await transaction.attempt.create({
          data: {
            assessmentId: invitation.assessmentId,
            candidateId,
            invitationId: invitation.id,
            status: "IN_PROGRESS",
            startedAt: now,
            maxScore,
            totalScore: 0,
          },
          select: { id: true },
        });
        const used = await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            candidateId,
            status: "ACCEPTED",
            deletedAt: null,
            expiresAt: { gt: now },
          },
          data: { status: "USED", usedAt: now },
        });
        if (used.count !== 1) {
          throw new AppError(409, "Invitation is no longer available.");
        }
        return createdAttempt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return getAttempt(candidateId, attempt.id);
  } catch (error) {
    throwAttemptConflict(
      error,
      "An attempt already exists for this assessment.",
    );
  }
};

export const getAttempt = async (candidateId: string, attemptId: string) => {
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, candidateId },
    select: attemptDetailSelect,
  });
  if (!attempt) {
    throw new AppError(404, "Attempt not found.");
  }
  return candidateAttemptDto(attempt);
};

export const cancelAttempt = async (candidateId: string, attemptId: string, data: CancelAttemptInput) => {
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const attempt = await transaction.attempt.findFirst({ where: { id: attemptId, candidateId }, select: { id: true, status: true, assessment: { select: { items: { select: { id: true } } } } } });
    if (!attempt) throw new AppError(404, "Attempt not found.");
    if (attempt.status !== "IN_PROGRESS") throw new AppError(409, "Attempt is no longer active.");
    const validItems = new Set(attempt.assessment.items.map((item) => item.id));
    if (data.answers.some((answer) => !validItems.has(answer.assessmentItemId))) throw new AppError(400, "Answer belongs to an invalid assessment item.");
    for (const answer of data.answers) {
      await transaction.submission.upsert({ where: { attemptId_assessmentItemId: { attemptId, assessmentItemId: answer.assessmentItemId } }, create: { attemptId, assessmentItemId: answer.assessmentItemId, answer: answer.answer }, update: { answer: answer.answer } });
    }
    await transaction.attempt.update({ where: { id: attemptId }, data: { status: "CANCELLED", submittedAt: now } });
    return { id: attemptId, status: "CANCELLED" as const, submittedAt: now };
  });
};

export const submitAttempt = async (
  candidateId: string,
  attemptId: string,
  data: SubmitAnswersInput,
) => {
  const now = new Date();
  try {
    await prisma.$transaction(
      async (transaction) => {
        const attempt = await transaction.attempt.findFirst({
          where: { id: attemptId, candidateId },
          select: {
            id: true,
            assessmentId: true,
            status: true,
            startedAt: true,
            assessment: {
              select: {
                durationMinutes: true,
                items: {
                  select: {
                    id: true,
                    type: true,
                    points: true,
                    correctAnswer: true,
                  },
                },
              },
            },
          },
        });
        if (!attempt) {
          throw new AppError(404, "Attempt not found.");
        }
        if (attempt.status !== "IN_PROGRESS" || !attempt.startedAt) {
          throw new AppError(409, "Attempt is not accepting submissions.");
        }
        const deadline = deadlineFor(
          attempt.startedAt,
          attempt.assessment.durationMinutes,
        );
        console.log(attempt.assessment.durationMinutes);
        if (!deadline || deadline <= now) {
          throw new AppError(410, "Attempt time limit has expired.");
        }

        const itemById = new Map(
          attempt.assessment.items.map((item) => [item.id, item]),
        );
        if (
          data.answers.length !== itemById.size ||
          data.answers.some((answer) => !itemById.has(answer.assessmentItemId))
        ) {
          throw new AppError(
            400,
            "Answers must include each item in this assessment exactly once.",
          );
        }

        const submissions = data.answers.map((answer) => {
          const item = itemById.get(answer.assessmentItemId);
          if (!item) {
            throw new AppError(
              400,
              "An answer references an unknown assessment item.",
            );
          }
          const isMcq = item.type === "MCQ";
          const score =
            isMcq && answer.answer === item.correctAnswer ? item.points : 0;
          return {
            attemptId,
            assessmentItemId: item.id,
            answer: answer.answer,
            score,
            status: isMcq ? ("AUTO_EVALUATED" as const) : ("PENDING" as const),
          };
        });
        const hasWrittenQuestions = submissions.some(
          (submission) => submission.status === "PENDING",
        );
        const totalScore = submissions.reduce(
          (total, submission) => total + submission.score,
          0,
        );

        await transaction.submission.createMany({ data: submissions });
        const changed = await transaction.attempt.updateMany({
          where: { id: attemptId, candidateId, status: "IN_PROGRESS" },
          data: {
            status: hasWrittenQuestions ? "SUBMITTED" : "EVALUATED",
            submittedAt: now,
            totalScore,
            evaluatedAt: hasWrittenQuestions ? null : now,
          },
        });
        if (changed.count !== 1) {
          throw new AppError(409, "Attempt has already been submitted.");
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwAttemptConflict(error, "Attempt has already been submitted.");
  }
  return getAttempt(candidateId, attemptId);
};

export const listAssessmentSubmissions = async (
  recruiterId: string,
  assessmentId: string,
  query: ListSubmissionsQuery,
) => {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, recruiterId, deletedAt: null },
    select: { id: true },
  });
  if (!assessment) {
    throw new AppError(404, "Assessment not found.");
  }
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.SubmissionWhereInput = {
    attempt: { is: { assessmentId } },
    ...(query.status && { status: query.status }),
  };
  const [submissions, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        answer: true,
        score: true,
        status: true,
        submittedAt: true,
        attempt: {
          select: {
            id: true,
            status: true,
            totalScore: true,
            maxScore: true,
            submittedAt: true,
            evaluatedAt: true,
            candidate: { select: { id: true, name: true, email: true } },
          },
        },
        assessmentItem: {
          select: {
            id: true,
            title: true,
            question: true,
            type: true,
            points: true,
            expectedAnswer: true,
          },
        },
        evaluation: {
          select: { score: true, feedback: true, evaluatedAt: true },
        },
      },
    }),
    prisma.submission.count({ where }),
  ]);
  return {
    submissions,
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const evaluateWrittenSubmission = async (
  recruiterId: string,
  evaluatorId: string,
  submissionId: string,
  data: EvaluateSubmissionInput,
) => {
  try {
    await prisma.$transaction(
      async (transaction) => {
        const submission = await transaction.submission.findFirst({
          where: {
            id: submissionId,
            attempt: {
              is: { assessment: { is: { recruiterId, deletedAt: null } } },
            },
          },
          select: {
            id: true,
            attemptId: true,
            status: true,
            assessmentItem: { select: { type: true, points: true } },
            attempt: { select: { id: true, status: true } },
          },
        });
        if (!submission) {
          throw new AppError(404, "Submission not found.");
        }
        if (submission.assessmentItem.type !== "WRITTEN") {
          throw new AppError(
            409,
            "Only written submissions can be manually evaluated.",
          );
        }
        if (
          submission.status !== "PENDING" ||
          submission.attempt.status !== "SUBMITTED"
        ) {
          throw new AppError(409, "Submission is not pending evaluation.");
        }
        if (data.score > submission.assessmentItem.points) {
          throw new AppError(
            400,
            "Score cannot exceed the points for this item.",
          );
        }

        const changed = await transaction.submission.updateMany({
          where: { id: submissionId, status: "PENDING" },
          data: { score: data.score, status: "MANUALLY_EVALUATED" },
        });
        if (changed.count !== 1) {
          throw new AppError(409, "Submission has already been evaluated.");
        }
        await transaction.evaluation.create({
          data: {
            submissionId,
            evaluatorId,
            score: data.score,
            feedback: data.feedback ?? null,
          },
        });

        const remaining = await transaction.submission.count({
          where: { attemptId: submission.attemptId, status: "PENDING" },
        });
        if (remaining === 0) {
          const scores = await transaction.submission.aggregate({
            where: { attemptId: submission.attemptId },
            _sum: { score: true },
          });
          await transaction.attempt.update({
            where: { id: submission.attemptId },
            data: {
              status: "EVALUATED",
              totalScore: scores._sum.score ?? 0,
              evaluatedAt: new Date(),
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwAttemptConflict(
      error,
      "Submission was evaluated concurrently. Refresh and retry.",
    );
  }
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      score: true,
      evaluation: { select: { feedback: true, evaluatedAt: true } },
    },
  });
  return submission;
};
