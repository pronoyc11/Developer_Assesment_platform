import type { RecruiterStatus, Role } from "../../generated/prisma/client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  recruiterStatus: RecruiterStatus
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
