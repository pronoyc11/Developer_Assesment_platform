import type { Role } from "../../generated/prisma/client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
