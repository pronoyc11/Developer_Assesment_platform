import Stripe from "stripe";
import { env } from "../../config/env";
import { Prisma } from "../../generated/prisma/client";
import { writeAuditEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";

const getStripeClient = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, "Stripe payments are not configured.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
};

const getFee = (): { amount: number; currency: string } => {
  const currency = env.ASSESSMENT_PUBLISH_CURRENCY.toLowerCase();
  console.log(env.ASSESSMENT_PUBLISH_FEE);
  if (
    !Number.isSafeInteger(env.ASSESSMENT_PUBLISH_FEE) ||
    env.ASSESSMENT_PUBLISH_FEE <= 0 ||
    !/^[a-z]{3}$/.test(currency)
  ) {
    throw new AppError(
      503,
      "Assessment publishing fee is not configured correctly.",
    );
  }
  return { amount: env.ASSESSMENT_PUBLISH_FEE, currency };
};

export const createPublishingCheckout = async (
  recruiterId: string,
  assessmentId: string,
) => {
  const { amount, currency } = getFee();
  const stripe = getStripeClient();

  const payment = await prisma
    .$transaction(
      async (transaction) => {
        const assessment = await transaction.assessment.findFirst({
          where: { id: assessmentId, recruiterId, deletedAt: null },
          select: { id: true, title: true, status: true },
        });
        if (!assessment) {
          throw new AppError(404, "Assessment not found.");
        }
        if (assessment.status !== "READY") {
          throw new AppError(
            409,
            "Only READY assessments can be paid for and published.",
          );
        }

        const existing = await transaction.payment.findFirst({
          where: {
            assessmentId,
            status: { in: ["PENDING", "PAID"] },
          },
          select: { id: true, status: true },
        });
        if (existing?.status === "PAID") {
          throw new AppError(409, "This assessment has already been paid for.");
        }
        if (existing) {
          return existing;
        }

        return transaction.payment.create({
          data: {
            assessmentId,
            createdById: recruiterId,
            amount,
            currency,
            status: "PENDING",
          },
          select: { id: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new AppError(
          409,
          "Another payment request is already being processed.",
        );
      }
      throw error;
    });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: payment.id,
        metadata: { paymentId: payment.id, assessmentId, recruiterId },
        // customer_email:"DapRecruiter@gmail.com",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: { name: "Assessment publishing fee" },
            },
          },
        ],
        success_url: `${env.FRONTEND_URL.replace(/\/+$/, "")}/assessments/${assessmentId}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL.replace(/\/+$/, "")}/assessments/${assessmentId}/payment/cancelled`,
      },
      { idempotencyKey: payment.id },
    );
    console.log(session);
    if (!session.url) {
      throw new Error("Stripe returned no checkout URL.");
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: session.id },
    });
  } catch {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    throw new AppError(502, "Unable to create the Stripe checkout session.");
  }

  return {
    paymentId: payment.id,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    amount,
    currency,
    status: "PENDING" as const,
  };
};

const markSessionFailed = async (session: Stripe.Checkout.Session) => {
  await prisma.payment.updateMany({
    where: {
      stripeCheckoutSessionId: session.id,
      status: "PENDING",
    },
    data: { status: "FAILED" },
  });
};

const processSuccessfulSession = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== "paid") {
    return { received: true, processed: false };
  }

  const paymentId = session.metadata?.paymentId;
  const assessmentId = session.metadata?.assessmentId;
  const recruiterId = session.metadata?.recruiterId;
  if (!paymentId || !assessmentId || !recruiterId) {
    throw new AppError(400, "Stripe session is missing required metadata.");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const result = await prisma
    .$transaction(
      async (transaction) => {
        const payment = await transaction.payment.findUnique({
          where: { id: paymentId },
          select: {
            id: true,
            assessmentId: true,
            createdById: true,
            amount: true,
            currency: true,
            status: true,
            stripeCheckoutSessionId: true,
          },
        });
        if (
          !payment ||
          payment.assessmentId !== assessmentId ||
          payment.createdById !== recruiterId ||
          session.client_reference_id !== paymentId ||
          payment.stripeCheckoutSessionId !== session.id
        ) {
          throw new AppError(
            404,
            "Payment for this Stripe session was not found.",
          );
        }
        if (
          payment.amount !== session.amount_total ||
          payment.currency !== session.currency?.toLowerCase()
        ) {
          throw new AppError(
            400,
            "Stripe payment amount or currency does not match.",
          );
        }
        if (payment.status === "PAID") {
          return { received: true, processed: false };
        }
        if (payment.status !== "PENDING") {
          return { received: true, processed: false };
        }

        const assessment = await transaction.assessment.findFirst({
          where: {
            id: assessmentId,
            recruiterId: payment.createdById,
            deletedAt: null,
          },
          select: { id: true, status: true },
        });
        if (!assessment || (assessment.status !== "DRAFT" && assessment.status !== "READY")) {
          throw new AppError(409, "Assessment cannot be published in its current state.");
        }

        const paid = await transaction.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: {
            status: "PAID",
            paidAt: new Date(),
            stripePaymentIntentId: paymentIntentId,
          },
        });
        if (paid.count !== 1) {
          throw new AppError(409, "Payment has already been processed.");
        }
        const published = await transaction.assessment.updateMany({
          where: {
            id: assessmentId,
            recruiterId: payment.createdById,
            status: { in: ["DRAFT", "READY"] },
            deletedAt: null,
          },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        if (published.count !== 1) {
          throw new AppError(409, "Assessment could not be published.");
        }
        return { received: true, processed: true };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      },
    )
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2028")
      ) {
        throw new AppError(
          409,
          "Payment event could not complete yet. Retry webhook delivery.",
        );
      }
      throw error;
    });
  if (result.processed) {
    await writeAuditEvent({
      actorId: session.metadata?.recruiterId ?? null,
      action: "PAYMENT_PAID",
      entity: "Payment",
      entityId: paymentId,
      metadata: { assessmentId },
    });
    await writeAuditEvent({
      actorId: session.metadata?.recruiterId ?? null,
      action: "ASSESSMENT_PUBLISHED",
      entity: "Assessment",
      entityId: assessmentId,
    });
  }
  return result;
};

export const handleStripeWebhook = async (
  rawBody: Buffer,
  signature: string | undefined,
) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, "Stripe webhooks are not configured.");
  }
  const stripe = getStripeClient();
  if (!signature) {
    throw new AppError(400, "Stripe signature header is required.");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Invalid Stripe webhook signature.");
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return processSuccessfulSession(
      event.data.object as Stripe.Checkout.Session,
    );
  }
  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    await markSessionFailed(event.data.object as Stripe.Checkout.Session);
    return { received: true, processed: true };
  }
  return { received: true, processed: false };
};

//stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook
