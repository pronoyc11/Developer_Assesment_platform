ALTER TYPE "InvitationStatus" ADD VALUE 'REJECTED';

ALTER TABLE "invitations"
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;
