import cookieParser from "cookie-parser";
import express from "express";
import router from "./app/routes";
import { configureSecurity } from "./app/security";
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";

const app = express();

configureSecurity(app);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", router);

app.use(notFoundMiddleware);
app.use(errorHandler);

export default app;
