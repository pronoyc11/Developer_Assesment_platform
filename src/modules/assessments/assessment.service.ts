import { type Assessment, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { getPagination, getPaginationMeta } from "../../utils/pagination";
import type {
  AddAssessmentItemInput,
  CreateAssessmentInput,
  ListAssessmentsQuery,
  ReorderAssessmentItemsInput,
  UpdateAssessmentInput,
  UpdateAssessmentItemInput,
} from "./assessment.validation";

const assessmentSummarySelect = {
  id: true,
  title: true,
  description: true,
  durationMinutes: true,
  passingScore: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true } },
  
} satisfies Prisma.AssessmentSelect;

const assessmentDetailSelect = {
  id: true,
  title: true,
  description: true,
  durationMinutes: true,
  passingScore: true,
  status: true,
  publishedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      problemId: true,
      order: true,
      title: true,
      question: true,
      type: true,
      options: true,
      points: true,
      correctAnswer: true,
      expectedAnswer: true,
    },
  },
} satisfies Prisma.AssessmentSelect;

const orderByFor = (
  sortBy: ListAssessmentsQuery["sortBy"],
  order: "asc" | "desc",
) => {
  const orderByMap = {
    createdAt: { createdAt: order },
    updatedAt: { updatedAt: order },
    title: { title: order },
    durationMinutes: { durationMinutes: order },
    passingScore: { passingScore: order },
    status: { status: order },
  } satisfies Record<
    ListAssessmentsQuery["sortBy"],
    Prisma.AssessmentOrderByWithRelationInput
  >;
  return orderByMap[sortBy];
};

const throwDatabaseConflict = (error: unknown, message: string): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2003" || error.code === "P2034")
  ) {
    throw new AppError(409, message);
  }
  throw error;
};

const ensureEditable = (assessment: Pick<Assessment, "status">): void => {
  if (assessment.status !== "DRAFT" && assessment.status !== "READY") {
    throw new AppError(
      409,
      "Published or closed assessments cannot be modified.",
    );
  }
};

const findOwnedAssessment = async (recruiterId: string, assessmentId: string) =>
  prisma.assessment.findFirst({
    where: { id: assessmentId, recruiterId, deletedAt: null },
  });

export const createAssessment = async (
  recruiterId: string,
  data: CreateAssessmentInput,
) => {
  const assessment = await prisma.assessment.create({
    data: {
      recruiterId,
      title: data.title,
      description: data.description ?? null,
      durationMinutes: data.durationMinutes,
      passingScore: data.passingScore,
      status: "DRAFT",
    },
    select: assessmentSummarySelect,
  });

  return {
    id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    durationMinutes: assessment.durationMinutes,
    passingScore: assessment.passingScore,
    status: assessment.status,
    itemCount: assessment._count.items,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
  };
};

export const listAssessments = async (
  recruiterId: string,
  query: ListAssessmentsQuery,
) => {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.AssessmentWhereInput = {
    recruiterId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };

  const [assessments, total] = await prisma.$transaction([
    prisma.assessment.findMany({
      where,
      select: assessmentSummarySelect,
    
      orderBy: orderByFor(query.sortBy, query.sortOrder),
      skip,
      take: limit,
    }),
    prisma.assessment.count({ where }),
  ]);

  return {
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      durationMinutes: assessment.durationMinutes,
      passingScore: assessment.passingScore,
      status: assessment.status,
      itemCount: assessment._count.items,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    })),
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const getAssessment = async (
  recruiterId: string,
  assessmentId: string,
) => {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, recruiterId, deletedAt: null },
    select: assessmentDetailSelect,
  });
  if (!assessment) {
    throw new AppError(404, "Assessment not found.");
  }
  return assessment;
};

export const updateAssessment = async (
  recruiterId: string,
  assessmentId: string,
  data: UpdateAssessmentInput,
) => {
  const current = await findOwnedAssessment(recruiterId, assessmentId);
  if (!current) {
    throw new AppError(404, "Assessment not found.");
  }
  ensureEditable(current);

  const updated = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      recruiterId,
      deletedAt: null,
      status: { in: ["DRAFT", "READY"] },
    },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.passingScore !== undefined && {
        passingScore: data.passingScore,
      }),
      status: "DRAFT",
    },
  });
  if (updated.count === 0) {
    throw new AppError(409, "Assessment changed and can no longer be edited.");
  }
  return getAssessment(recruiterId, assessmentId);
};

export const deleteAssessment = async (
  recruiterId: string,
  assessmentId: string,
): Promise<void> => {
  const assessment = await findOwnedAssessment(recruiterId, assessmentId);
  if (!assessment) {
    throw new AppError(404, "Assessment not found.");
  }
  ensureEditable(assessment);

  const deleted = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      recruiterId,
      deletedAt: null,
      status: { in: ["DRAFT", "READY"] },
    },
    data: { deletedAt: new Date() },
  });
  if (deleted.count === 0) {
    throw new AppError(409, "Assessment changed and can no longer be deleted.");
  }
};

export const addAssessmentItem = async (
  recruiterId: string,
  assessmentId: string,
  data: AddAssessmentItemInput,
) => {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const assessment = await transaction.assessment.findFirst({
          where: { id: assessmentId, recruiterId, deletedAt: null },
          select: { id: true, status: true },
        });
        if (!assessment) {
          throw new AppError(404, "Assessment not found.");
        }
        ensureEditable(assessment);

        const problem = await transaction.problem.findFirst({
          where: {
            id: data.problemId,
            recruiterId,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            question: true,
            type: true,
            options: true,
            points: true,
            correctAnswer: true,
            expectedAnswer: true,
          },
        });
        if (!problem) {
          throw new AppError(404, "Problem not found.");
        }

        const existingProblem = await transaction.assessmentItem.findFirst({
          where: { assessmentId, problemId: problem.id },
          select: { id: true },
        });
        if (existingProblem) {
          throw new AppError(
            409,
            "Problem is already included in this assessment.",
          );
        }
        const existingOrder = await transaction.assessmentItem.findFirst({
          where: { assessmentId, order: data.order },
          select: { id: true },
        });
        if (existingOrder) {
          throw new AppError(
            409,
            "That assessment item order is already in use.",
          );
        }

        const item = await transaction.assessmentItem.create({
          data: {
            assessmentId,
            problemId: problem.id,
            order: data.order,
            title: problem.title,
            question: problem.question,
            type: problem.type,
            options: problem.options,
            points: problem.points,
            correctAnswer: problem.correctAnswer,
            expectedAnswer: problem.expectedAnswer,
          },
          select: {
            id: true,
            problemId: true,
            order: true,
            title: true,
            question: true,
            type: true,
            options: true,
            points: true,
            correctAnswer: true,
            expectedAnswer: true,
          },
        });

        if (assessment.status === "READY") {
          await transaction.assessment.update({
            where: { id: assessmentId },
            data: { status: "DRAFT" },
          });
        }
        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwDatabaseConflict(
      error,
      "Problem or order conflicts with an existing assessment item. Retry the request.",
    );
  }
};

const getOwnedEditableAssessment = async (
  transaction: Prisma.TransactionClient,
  recruiterId: string,
  assessmentId: string,
) => {
  const assessment = await transaction.assessment.findFirst({
    where: { id: assessmentId, recruiterId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!assessment) {
    throw new AppError(404, "Assessment not found.");
  }
  ensureEditable(assessment);
  return assessment;
};

export const updateAssessmentItem = async (
  recruiterId: string,
  assessmentId: string,
  itemId: string,
  data: UpdateAssessmentItemInput,
) => {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const assessment = await getOwnedEditableAssessment(
          transaction,
          recruiterId,
          assessmentId,
        );
        const item = await transaction.assessmentItem.findFirst({
          where: { id: itemId, assessmentId },
          select: { id: true },
        });
        if (!item) {
          throw new AppError(404, "Assessment item not found.");
        }
        const conflictingItem = await transaction.assessmentItem.findFirst({
          where: { assessmentId, order: data.order, id: { not: itemId } },
          select: { id: true },
        });
        if (conflictingItem) {
          throw new AppError(
            409,
            "That assessment item order is already in use.",
          );
        }

        const updatedItem = await transaction.assessmentItem.update({
          where: { id: itemId },
          data: { order: data.order },
          select: {
            id: true,
            problemId: true,
            order: true,
            title: true,
            question: true,
            type: true,
            options: true,
            points: true,
            correctAnswer: true,
            expectedAnswer: true,
          },
        });
        if (assessment.status === "READY") {
          await transaction.assessment.update({
            where: { id: assessmentId },
            data: { status: "DRAFT" },
          });
        }
        return updatedItem;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwDatabaseConflict(
      error,
      "Assessment item order conflicts with another item.",
    );
  }
};

export const reorderAssessmentItems = async (
  recruiterId: string,
  assessmentId: string,
  data: ReorderAssessmentItemsInput,
) => {
  try {
    await prisma.$transaction(
      async (transaction) => {
        const assessment = await getOwnedEditableAssessment(
          transaction,
          recruiterId,
          assessmentId,
        );
        const existingItems = await transaction.assessmentItem.findMany({
          where: { assessmentId },
          select: { id: true, order: true },
          orderBy: { order: "asc" },
        });
        const requestedIds = new Set(data.items.map((item) => item.itemId));
        if (
          existingItems.length !== data.items.length ||
          existingItems.some((item) => !requestedIds.has(item.id))
        ) {
          throw new AppError(
            400,
            "Reorder request must include every item in this assessment exactly once.",
          );
        }

        const temporaryOrderStart =
          Math.max(0, ...existingItems.map((item) => item.order)) +
          existingItems.length +
          1;
        for (const [index, item] of existingItems.entries()) {
          await transaction.assessmentItem.update({
            where: { id: item.id },
            data: { order: temporaryOrderStart + index },
          });
        }
        for (const item of data.items) {
          await transaction.assessmentItem.update({
            where: { id: item.itemId },
            data: { order: item.order },
          });
        }
        if (assessment.status === "READY") {
          await transaction.assessment.update({
            where: { id: assessmentId },
            data: { status: "DRAFT" },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwDatabaseConflict(
      error,
      "Assessment item reorder conflicted with another update.",
    );
  }
  return getAssessment(recruiterId, assessmentId);
};

export const deleteAssessmentItem = async (
  recruiterId: string,
  assessmentId: string,
  itemId: string,
): Promise<void> => {
  await prisma
    .$transaction(
      async (transaction) => {
        const assessment = await getOwnedEditableAssessment(
          transaction,
          recruiterId,
          assessmentId,
        );
        const item = await transaction.assessmentItem.findFirst({
          where: { id: itemId, assessmentId },
          select: { id: true },
        });
        if (!item) {
          throw new AppError(404, "Assessment item not found.");
        }

        await transaction.assessmentItem.delete({ where: { id: itemId } });
        const remainingItems = await transaction.assessmentItem.findMany({
          where: { assessmentId },
          select: { id: true, order: true },
          orderBy: { order: "asc" },
        });
        const temporaryOrderStart =
          Math.max(0, ...remainingItems.map((remaining) => remaining.order)) +
          remainingItems.length +
          1;
        for (const [index, remaining] of remainingItems.entries()) {
          await transaction.assessmentItem.update({
            where: { id: remaining.id },
            data: { order: temporaryOrderStart + index },
          });
        }
        for (const [index, remaining] of remainingItems.entries()) {
          await transaction.assessmentItem.update({
            where: { id: remaining.id },
            data: { order: index + 1 },
          });
        }
        if (assessment.status === "READY") {
          await transaction.assessment.update({
            where: { id: assessmentId },
            data: { status: "DRAFT" },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((error: unknown) =>
      throwDatabaseConflict(
        error,
        "Assessment item removal conflicted with another update.",
      ),
    );
};

export const markAssessmentReady = async (
  recruiterId: string,
  assessmentId: string,
) => {
  try {
    await prisma.$transaction(
      async (transaction) => {
        const assessment = await transaction.assessment.findFirst({
          where: { id: assessmentId, recruiterId, deletedAt: null },
        });
        if (!assessment) {
          throw new AppError(404, "Assessment not found.");
        }
        if (assessment.status !== "DRAFT") {
          throw new AppError(
            409,
            "Only draft assessments can be marked ready.",
          );
        }

        if (
          assessment.durationMinutes < 1 ||
          assessment.durationMinutes > 600 ||
          assessment.passingScore < 0 ||
          assessment.passingScore > 100
        ) {
          throw new AppError(
            400,
            "Assessment duration or passing score is invalid.",
          );
        }

        const items = await transaction.assessmentItem.findMany({
          where: { assessmentId },
          select: {
            order: true,
            points: true,
            type: true,
            options: true,
            correctAnswer: true,
            expectedAnswer: true,
          },
        });
        if (items.length === 0) {
          throw new AppError(400, "Assessment must contain at least one item.");
        }

        const orderedItems = [...items].sort(
          (left, right) => left.order - right.order,
        );
        if (orderedItems.some((item, index) => item.order !== index + 1)) {
          throw new AppError(
            400,
            "Assessment item orders must be consecutive starting at 1.",
          );
        }

        for (const item of orderedItems) {
          if (!Number.isInteger(item.points) || item.points < 1) {
            throw new AppError(
              400,
              "Every assessment item must have positive points.",
            );
          }
          if (item.type === "MCQ") {
            if (
              item.options.length < 2 ||
              item.options.length > 10 ||
              new Set(item.options).size !== item.options.length ||
              !item.correctAnswer ||
              !item.options.includes(item.correctAnswer) ||
              item.expectedAnswer !== null
            ) {
              throw new AppError(400, "An MCQ assessment snapshot is invalid.");
            }
          } else if (
            !item.expectedAnswer?.trim() ||
            item.options.length > 0 ||
            item.correctAnswer !== null
          ) {
            throw new AppError(
              400,
              "A written assessment snapshot is invalid.",
            );
          }
        }

        const changed = await transaction.assessment.updateMany({
          where: {
            id: assessmentId,
            recruiterId,
            deletedAt: null,
            status: "DRAFT",
          },
          data: { status: "READY" },
        });
        if (changed.count !== 1) {
          throw new AppError(
            409,
            "Assessment changed before it could be marked ready.",
          );
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    throwDatabaseConflict(
      error,
      "Assessment changed concurrently. Please retry.",
    );
  }
  return getAssessment(recruiterId, assessmentId);
};
