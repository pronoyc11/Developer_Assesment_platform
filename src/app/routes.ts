import { Router } from "express";
import adminRouter from "../modules/admin/admin.route";
import assessmentRouter from "../modules/assessments/assessment.route";
import attemptRouter from "../modules/attempts/attempt.route";
import authRouter from "../modules/auth/auth.route";
import authTestRouter from "../modules/authTest/authTest.route";
import healthRouter from "../modules/health/health.route";
import invitationRouter from "../modules/invitations/invitation.route";
import problemRouter from "../modules/problems/problem.route";
import recruiterProfileRouter from "../modules/recruiter-profile/recruiter-profile.route";
import submissionRouter from "../modules/submissions/submission.route";
import userRouter from "../modules/users/user.route";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/auth-test", authTestRouter);
router.use("/admin", adminRouter);
router.use("/problems", problemRouter);
router.use("/assessments", assessmentRouter);
router.use("/invitations", invitationRouter);
router.use("/attempts", attemptRouter);
router.use("/submissions", submissionRouter);
router.use("/users", userRouter);
router.use("/recruiters", recruiterProfileRouter);

export default router;
