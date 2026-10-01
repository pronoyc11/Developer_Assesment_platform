import cookieParser from "cookie-parser";
import express from "express";
import swaggerUi from "swagger-ui-express";
import router from "./app/routes";
import { configureSecurity } from "./app/security";
import { openApiSpec } from "./docs/openapi";
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { stripeWebhook } from "./modules/payments/payment.controller";

const app = express();

configureSecurity(app);

app.use(cookieParser());

app.post(
  "/api/v1/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/docs/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/v1", router);

app.use(notFoundMiddleware);
app.use(errorHandler);

export default app;
