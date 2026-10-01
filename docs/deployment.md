# Production Deployment Notes

## Build and run

Build the container with `docker build -t developer-assessment-platform .` and run it with the production environment variables from `.env.example` supplied through the hosting platform's secret manager. Do not copy a real `.env` into the image. The container listens on `PORT` (default 5000) and its health check calls `/api/v1/health`.

The package start command is `node dist/src/server.js`. Build output uses the Prisma 7 generated client under `dist/src/generated/prisma` and the PostgreSQL driver adapter.

## Database migration

Run `npm run prisma:migrate:deploy` once per release from the repository/build environment where the Prisma CLI, `prisma/` schema, `prisma.config.ts`, and `DATABASE_URL` are available. Do not run `prisma migrate dev` against production. The runtime image is intentionally application-only and does not run migrations at startup.

## Required production configuration

Set `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `REDIS_URL` (or the supported split Redis host/credentials), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, and the SMTP variables. Configure Cloudinary for uploads, Google OAuth for Google sign-in, and Stripe keys plus `STRIPE_WEBHOOK_SECRET` for payment publishing.

Configure the Stripe Dashboard webhook to send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed` to `https://<api-host>/api/v1/payments/stripe/webhook`. Use the signing secret generated for that endpoint. The service verifies the signature against the raw request body.

Configure the host to terminate TLS/HTTPS and set the exact browser frontend origin in `FRONTEND_URL`. The API enables secure, HttpOnly auth cookies outside development, Helmet, CORS credentials, and rate limiting.

Actual cloud deployment and external credential provisioning are intentionally not automated from this repository because no hosting platform/account or production secrets are configured here.
