import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

const seedConfig = {
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!",
  recruiterEmail: process.env.SEED_RECRUITER_EMAIL ?? "recruiter@example.com",
  recruiterPassword:
    process.env.SEED_RECRUITER_PASSWORD ?? "RecruiterPass123!",
  candidateEmail: process.env.SEED_CANDIDATE_EMAIL ?? "candidate@example.com",
  candidatePassword:
    process.env.SEED_CANDIDATE_PASSWORD ?? "CandidatePass123!",
} as const;

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  recruiter: "00000000-0000-4000-8000-000000000002",
  candidate: "00000000-0000-4000-8000-000000000003",
  recruiterProfile: "00000000-0000-4000-8000-000000000004",
  mcqProblem: "00000000-0000-4000-8000-000000000005",
  writtenProblem: "00000000-0000-4000-8000-000000000006",
  assessment: "00000000-0000-4000-8000-000000000007",
  mcqItem: "00000000-0000-4000-8000-000000000008",
  writtenItem: "00000000-0000-4000-8000-000000000009",
} as const;

const seed = async (): Promise<void> => {
  const [adminPasswordHash, recruiterPasswordHash, candidatePasswordHash] =
    await Promise.all([
      hashPassword(seedConfig.adminPassword),
      hashPassword(seedConfig.recruiterPassword),
      hashPassword(seedConfig.candidatePassword),
    ]);

  await prisma.user.upsert({
    where: { id: ids.admin },
    update: {
      email: seedConfig.adminEmail,
      passwordHash: adminPasswordHash,
      name: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
      recruiterStatus: "NOT_REQUESTED",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
      deletedAt: null,
    },
    create: {
      id: ids.admin,
      email: seedConfig.adminEmail,
      passwordHash: adminPasswordHash,
      name: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
    },
  });

  await prisma.user.upsert({
    where: { id: ids.recruiter },
    update: {
      email: seedConfig.recruiterEmail,
      passwordHash: recruiterPasswordHash,
      name: "Demo Recruiter",
      role: "RECRUITER",
      status: "ACTIVE",
      recruiterStatus: "APPROVED",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
      deletedAt: null,
    },
    create: {
      id: ids.recruiter,
      email: seedConfig.recruiterEmail,
      passwordHash: recruiterPasswordHash,
      name: "Demo Recruiter",
      role: "RECRUITER",
      status: "ACTIVE",
      recruiterStatus: "APPROVED",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
    },
  });

  await prisma.recruiterProfile.upsert({
    where: { userId: ids.recruiter },
    update: {
      companyName: "Developer Assessment Platform",
      companyDescription: "Seeded recruiter profile for local development.",
      companyWebsite: "https://example.com",
      deletedAt: null,
    },
    create: {
      id: ids.recruiterProfile,
      userId: ids.recruiter,
      companyName: "Developer Assessment Platform",
      companyDescription: "Seeded recruiter profile for local development.",
      companyWebsite: "https://example.com",
    },
  });

  await prisma.user.upsert({
    where: { id: ids.candidate },
    update: {
      email: seedConfig.candidateEmail,
      passwordHash: candidatePasswordHash,
      name: "Demo Candidate",
      role: "CANDIDATE",
      status: "ACTIVE",
      recruiterStatus: "NOT_REQUESTED",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
      deletedAt: null,
    },
    create: {
      id: ids.candidate,
      email: seedConfig.candidateEmail,
      passwordHash: candidatePasswordHash,
      name: "Demo Candidate",
      role: "CANDIDATE",
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authProvider: "LOCAL",
    },
  });

  await prisma.problem.upsert({
    where: { id: ids.mcqProblem },
    update: {
      recruiterId: ids.recruiter,
      title: "HTTP Not Found Status",
      question: "Which HTTP status code means that a requested resource was not found?",
      type: "MCQ",
      options: ["200", "301", "404", "500"],
      correctAnswer: "404",
      expectedAnswer: null,
      points: 2,
      deletedAt: null,
    },
    create: {
      id: ids.mcqProblem,
      recruiterId: ids.recruiter,
      title: "HTTP Not Found Status",
      question: "Which HTTP status code means that a requested resource was not found?",
      type: "MCQ",
      options: ["200", "301", "404", "500"],
      correctAnswer: "404",
      points: 2,
    },
  });

  await prisma.problem.upsert({
    where: { id: ids.writtenProblem },
    update: {
      recruiterId: ids.recruiter,
      title: "Database Indexing",
      question: "Explain how a database index can improve query performance and mention one trade-off.",
      type: "WRITTEN",
      options: [],
      correctAnswer: null,
      expectedAnswer: "Indexes speed up reads but consume storage and can slow writes.",
      points: 5,
      deletedAt: null,
    },
    create: {
      id: ids.writtenProblem,
      recruiterId: ids.recruiter,
      title: "Database Indexing",
      question: "Explain how a database index can improve query performance and mention one trade-off.",
      type: "WRITTEN",
      options: [],
      expectedAnswer: "Indexes speed up reads but consume storage and can slow writes.",
      points: 5,
    },
  });

  await prisma.assessment.upsert({
    where: { id: ids.assessment },
    update: {
      recruiterId: ids.recruiter,
      title: "Demo Backend Assessment",
      description: "A seeded assessment for local API testing.",
      durationMinutes: 30,
      passingScore: 4,
      status: "DRAFT",
      publishedAt: null,
      closedAt: null,
      deletedAt: null,
    },
    create: {
      id: ids.assessment,
      recruiterId: ids.recruiter,
      title: "Demo Backend Assessment",
      description: "A seeded assessment for local API testing.",
      durationMinutes: 30,
      passingScore: 4,
      status: "DRAFT",
    },
  });

  await prisma.assessmentItem.upsert({
    where: { id: ids.mcqItem },
    update: {
      assessmentId: ids.assessment,
      problemId: ids.mcqProblem,
      order: 1,
      title: "HTTP Not Found Status",
      question: "Which HTTP status code means that a requested resource was not found?",
      type: "MCQ",
      options: ["200", "301", "404", "500"],
      points: 2,
      correctAnswer: "404",
      expectedAnswer: null,
    },
    create: {
      id: ids.mcqItem,
      assessmentId: ids.assessment,
      problemId: ids.mcqProblem,
      order: 1,
      title: "HTTP Not Found Status",
      question: "Which HTTP status code means that a requested resource was not found?",
      type: "MCQ",
      options: ["200", "301", "404", "500"],
      points: 2,
      correctAnswer: "404",
    },
  });

  await prisma.assessmentItem.upsert({
    where: { id: ids.writtenItem },
    update: {
      assessmentId: ids.assessment,
      problemId: ids.writtenProblem,
      order: 2,
      title: "Database Indexing",
      question: "Explain how a database index can improve query performance and mention one trade-off.",
      type: "WRITTEN",
      options: [],
      points: 5,
      correctAnswer: null,
      expectedAnswer: "Indexes speed up reads but consume storage and can slow writes.",
    },
    create: {
      id: ids.writtenItem,
      assessmentId: ids.assessment,
      problemId: ids.writtenProblem,
      order: 2,
      title: "Database Indexing",
      question: "Explain how a database index can improve query performance and mention one trade-off.",
      type: "WRITTEN",
      options: [],
      points: 5,
      expectedAnswer: "Indexes speed up reads but consume storage and can slow writes.",
    },
  });

  console.log("Seed completed successfully.");
  console.log(`Admin: ${seedConfig.adminEmail}`);
  console.log(`Recruiter: ${seedConfig.recruiterEmail}`);
  console.log(`Candidate: ${seedConfig.candidateEmail}`);
};

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
