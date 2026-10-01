import { type Request, type Response, Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { sendSuccess } from "../../utils/response";

const router = Router();

// Temporary endpoint for Phase 4 to verify access token and authenticate middleware
router.get("/me", authenticate, (req: Request, res: Response) => {
  return sendSuccess(
    res,
    "Authenticated user retrieved successfully.",
    req.user,
  );
});

export const profileRouter = router;
export default router;
