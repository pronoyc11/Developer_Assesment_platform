import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { healthCheck } from "./health.controller.js";
import { healthQuerySchema } from "./health.validation.js";

const router = Router();

router.get("/", validate(healthQuerySchema, "query"), healthCheck);

export default router;
