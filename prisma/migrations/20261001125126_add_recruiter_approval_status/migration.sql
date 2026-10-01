-- CreateEnum
CREATE TYPE "RecruiterStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recruiterStatus" "RecruiterStatus" NOT NULL DEFAULT 'NOT_REQUESTED';
