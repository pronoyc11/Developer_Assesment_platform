import { Router } from "express";

import authRouter from "../modules/auth/auth.route";
import authTestRouter from "../modules/authTest/authTest.route";
import healthRouter from "../modules/health/health.route";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/auth-test", authTestRouter);

export default router;
