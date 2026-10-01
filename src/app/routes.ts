import { Router } from "express";

import authRouter from "../modules/auth/auth.route";

import healthRouter from "../modules/health/health.route";
import { profileRouter } from "../modules/authTest/authTest.route";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/auth-test", profileRouter);

export default router;
