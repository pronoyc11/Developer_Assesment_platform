import type {
  Prisma,
  Problem,
  QuestionType,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { getPagination, getPaginationMeta } from "../../utils/pagination";
import type { RecruiterProblemResponse } from "./problem.types";
import {
  type CreateProblemInput,
  createProblemSchema,
  type ListProblemsQuery,
  type UpdateProblemInput,
} from "./problem.validation";

const problemSelect = {
  id: true,
  title: true,
  question: true,
  type: true,
  options: true,
  correctAnswer: true,
  expectedAnswer: true,
  points: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProblemSelect;

const orderByFor = (
  sortBy: ListProblemsQuery["sortBy"],
  order: "asc" | "desc",
) => {
  const orderByMap = {
    createdAt: { createdAt: order },
    updatedAt: { updatedAt: order },
    title: { title: order },
    points: { points: order },
    type: { type: order },
  } satisfies Record<
    ListProblemsQuery["sortBy"],
    Prisma.ProblemOrderByWithRelationInput
  >;
  return orderByMap[sortBy];
};

const toRecruiterProblem = (problem: Problem): RecruiterProblemResponse => ({
  id: problem.id,
  title: problem.title,
  question: problem.question,
  type: problem.type,
  options: problem.options,
  correctAnswer: problem.correctAnswer,
  expectedAnswer: problem.expectedAnswer,
  points: problem.points,
  createdAt: problem.createdAt,
  updatedAt: problem.updatedAt,
});

const parseProblemContent = (input: unknown): CreateProblemInput => {
  const result = createProblemSchema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      400,
      "Problem fields are inconsistent",
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
};

const buildUpdateContent = (
  current: Problem,
  data: UpdateProblemInput,
): CreateProblemInput => {
  const type: QuestionType = data.type ?? current.type;
  const common = {
    title: data.title ?? current.title,
    question: data.question ?? current.question,
    type,
    points: data.points ?? current.points,
  };

  if (type === "MCQ") {
    return parseProblemContent({
      ...common,
      options:
        data.options ?? (current.type === "MCQ" ? current.options : undefined),
      correctAnswer:
        data.correctAnswer ??
        (current.type === "MCQ" ? current.correctAnswer : undefined),
      ...(data.expectedAnswer !== undefined && {
        expectedAnswer: data.expectedAnswer,
      }),
    });
  }

  return parseProblemContent({
    ...common,
    expectedAnswer:
      data.expectedAnswer ??
      (current.type === "WRITTEN" ? current.expectedAnswer : undefined),
    ...(data.options !== undefined && { options: data.options }),
    ...(data.correctAnswer !== undefined && {
      correctAnswer: data.correctAnswer,
    }),
  });
};

export const createProblem = async (
  recruiterId: string,
  data: CreateProblemInput,
): Promise<RecruiterProblemResponse> => {
  const content = parseProblemContent(data);
  const problem = await prisma.problem.create({
    data: {
      recruiterId,
      title: content.title,
      question: content.question,
      type: content.type,
      options: content.type === "MCQ" ? content.options : [],
      correctAnswer: content.type === "MCQ" ? content.correctAnswer : null,
      expectedAnswer:
        content.type === "WRITTEN" ? content.expectedAnswer : null,
      points: content.points,
    },
  });
  return toRecruiterProblem(problem);
};

export const listProblems = async (
  recruiterId: string,
  query: ListProblemsQuery,
) => {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ProblemWhereInput = {
    recruiterId,
    deletedAt: null,
    ...(query.type && { type: query.type }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { question: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };
  const [problems, total] = await prisma.$transaction([
    prisma.problem.findMany({
      where,
      select: problemSelect,
      orderBy: orderByFor(query.sortBy, query.sortOrder),
      skip,
      take: limit,
    }),
    prisma.problem.count({ where }),
  ]);

  return {
    problems,
    pagination: getPaginationMeta(page, limit, total),
  };
};

export const getProblem = async (
  recruiterId: string,
  problemId: string,
): Promise<RecruiterProblemResponse> => {
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, recruiterId, deletedAt: null },
    select: problemSelect,
  });
  if (!problem) {
    throw new AppError(404, "Problem not found.");
  }
  return problem;
};

export const updateProblem = async (
  recruiterId: string,
  problemId: string,
  data: UpdateProblemInput,
): Promise<RecruiterProblemResponse> => {
  const current = await prisma.problem.findFirst({
    where: { id: problemId, recruiterId, deletedAt: null },
  });
  if (!current) {
    throw new AppError(404, "Problem not found.");
  }

  const content = buildUpdateContent(current, data);
  const problem = await prisma.problem.update({
    where: { id: current.id },
    data: {
      title: content.title,
      question: content.question,
      type: content.type,
      options: content.type === "MCQ" ? content.options : [],
      correctAnswer: content.type === "MCQ" ? content.correctAnswer : null,
      expectedAnswer:
        content.type === "WRITTEN" ? content.expectedAnswer : null,
      points: content.points,
    },
  });
  return toRecruiterProblem(problem);
};

export const deleteProblem = async (
  recruiterId: string,
  problemId: string,
): Promise<void> => {
  const result = await prisma.problem.updateMany({
    where: { id: problemId, recruiterId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) {
    throw new AppError(404, "Problem not found.");
  }
};
