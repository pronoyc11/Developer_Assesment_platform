import type { AuthenticatedUser } from "../modules/auth/auth.type";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
