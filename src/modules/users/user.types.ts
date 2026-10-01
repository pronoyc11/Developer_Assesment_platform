import type {
  AuthProvider,
  RecruiterStatus,
  Role,
  UserStatus,
} from "../../generated/prisma/client";

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  recruiterStatus: RecruiterStatus;
  status: UserStatus;
  avatarUrl: string | null;
  emailVerified: boolean;
  authProvider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
}
