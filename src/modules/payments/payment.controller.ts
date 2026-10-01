import type { Request, Response } from "express";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/response";
import * as paymentService from "./payment.service";

export const createPublishingCheckout = catchAsync(
  async (req: Request, res: Response) => {
    const recruiterId = req.user?.id;
    const assessmentId = req.params.assessmentId;
    if (!recruiterId) {
      throw new AppError(401, "Authentication required.");
    }
    if (!assessmentId || Array.isArray(assessmentId)) {
      throw new AppError(400, "Assessment ID is required.");
    }
    const result = await paymentService.createPublishingCheckout(
      recruiterId,
      assessmentId,
    );
    return sendSuccess(res, "Stripe checkout session created.", result, 201);
  },
);

export const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(400, "Stripe webhook requires a raw request body.");
  }
  const signature = req.headers["stripe-signature"];
  const result = await paymentService.handleStripeWebhook(
    req.body,
    typeof signature === "string" ? signature : undefined,
  );
  return sendSuccess(res, "Stripe webhook received.", result, 200);
});
