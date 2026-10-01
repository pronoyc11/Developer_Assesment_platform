import assert from "node:assert/strict";
import test from "node:test";

import {
  createProblemSchema,
  updateProblemSchema,
} from "../src/modules/problems/problem.validation.ts";
import {
  assessmentIdParamsSchema,
  createAssessmentSchema,
  reorderAssessmentItemsSchema,
} from "../src/modules/assessments/assessment.validation.ts";
import {
  createInvitationSchema,
  invitationTokenParamsSchema,
  listInvitationsQuerySchema,
} from "../src/modules/invitations/invitation.validation.ts";
import {
  evaluateSubmissionSchema,
  submitAnswersSchema,
} from "../src/modules/attempts/attempt.validation.ts";
import { openApiSpec } from "../src/docs/openapi.ts";

const itemOne = "11111111-1111-4111-8111-111111111111";
const itemTwo = "22222222-2222-4222-8222-222222222222";

const validMcq = {
  title: "HTTP Protocol",
  question: "What does HTTP stand for?",
  type: "MCQ",
  options: ["HyperText Transfer Protocol", "HighText Transfer Protocol"],
  correctAnswer: "HyperText Transfer Protocol",
  points: 2,
};

test("MCQ problem requires unique options and an exact correct answer", () => {
  assert.equal(createProblemSchema.safeParse(validMcq).success, true);
  assert.equal(
    createProblemSchema.safeParse({ ...validMcq, correctAnswer: "other" }).success,
    false,
  );
  assert.equal(
    createProblemSchema.safeParse({ ...validMcq, options: [" A ", "A"] }).success,
    false,
  );
  assert.equal(
    createProblemSchema.safeParse({ ...validMcq, options: ["only one"] }).success,
    false,
  );
});

test("written problem rejects MCQ-only fields", () => {
  const written = {
    title: "REST Principles",
    question: "Explain REST.",
    type: "WRITTEN",
    expectedAnswer: "Stateless resource-oriented APIs.",
    points: 5,
  };
  assert.equal(createProblemSchema.safeParse(written).success, true);
  assert.equal(
    createProblemSchema.safeParse({ ...written, options: ["A", "B"] }).success,
    false,
  );
  assert.equal(
    updateProblemSchema.safeParse({ type: "WRITTEN", correctAnswer: "A" }).success,
    false,
  );
});

test("problem update does not accept protected or empty input", () => {
  assert.equal(updateProblemSchema.safeParse({ title: "Updated title" }).success, true);
  assert.equal(updateProblemSchema.safeParse({}).success, false);
  assert.equal(updateProblemSchema.safeParse({ recruiterId: itemOne }).success, false);
});

test("assessment validates percentage and rejects client-controlled status", () => {
  const input = { title: "Backend Assessment", durationMinutes: 60, passingScore: 60 };
  assert.equal(createAssessmentSchema.safeParse(input).success, true);
  assert.equal(createAssessmentSchema.safeParse({ ...input, passingScore: 101 }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...input, status: "PUBLISHED" }).success, false);
  assert.equal(assessmentIdParamsSchema.safeParse({ assessmentId: itemOne }).success, true);
});

test("assessment reorder requires a complete unique consecutive order", () => {
  assert.equal(
    reorderAssessmentItemsSchema.safeParse({
      items: [
        { itemId: itemOne, order: 2 },
        { itemId: itemTwo, order: 1 },
      ],
    }).success,
    true,
  );
  assert.equal(
    reorderAssessmentItemsSchema.safeParse({
      items: [
        { itemId: itemOne, order: 1 },
        { itemId: itemTwo, order: 1 },
      ],
    }).success,
    false,
  );
});

test("invitation body is strict and token has the expected random-token shape", () => {
  assert.equal(
    createInvitationSchema.safeParse({ candidateId: itemOne }).success,
    true,
  );
  assert.equal(
    createInvitationSchema.safeParse({ candidateId: itemOne, token: "client-token" }).success,
    false,
  );
  assert.equal(
    invitationTokenParamsSchema.safeParse({ token: "A".repeat(43) }).success,
    true,
  );
  assert.equal(invitationTokenParamsSchema.safeParse({ token: "short" }).success, false);
  assert.equal(listInvitationsQuerySchema.safeParse({ status: "PENDING" }).success, true);
  assert.equal(listInvitationsQuerySchema.safeParse({ status: "INVALID" }).success, false);
});

test("attempt submission requires unique, nonempty answers", () => {
  assert.equal(
    submitAnswersSchema.safeParse({
      answers: [{ assessmentItemId: itemOne, answer: "A" }],
    }).success,
    true,
  );
  assert.equal(submitAnswersSchema.safeParse({ answers: [] }).success, false);
  assert.equal(
    submitAnswersSchema.safeParse({
      answers: [
        { assessmentItemId: itemOne, answer: "A" },
        { assessmentItemId: itemOne, answer: "B" },
      ],
    }).success,
    false,
  );
});

test("written evaluation score is a nonnegative integer", () => {
  assert.equal(evaluateSubmissionSchema.safeParse({ score: 0 }).success, true);
  assert.equal(evaluateSubmissionSchema.safeParse({ score: -1 }).success, false);
  assert.equal(evaluateSubmissionSchema.safeParse({ score: 1.5 }).success, false);
  assert.equal(evaluateSubmissionSchema.safeParse({ score: 3, extra: true }).success, false);
});

test("OpenAPI describes core phase workflows and webhook", () => {
  assert.equal(openApiSpec.openapi, "3.1.0");
  assert.ok(openApiSpec.paths["/assessments/{assessmentId}/payment"]);
  assert.ok(openApiSpec.paths["/invitations/{token}/start"]);
  assert.ok(openApiSpec.paths["/attempts/{id}/submit"]);
  assert.ok(openApiSpec.paths["/payments/stripe/webhook"]);
  assert.ok(openApiSpec.paths["/admin/audit-logs"]);
});
