# Developer Assessment Platform

Developer Assessment Platform (DAP) is a role-based REST API for creating, publishing, delivering, and evaluating technical assessments. Recruiters manage problem banks and assessments, candidates receive invitations and complete assessments, and administrators manage users, recruiter applications, and audit records.

Live URL : https://dap-nine.vercel.app/

The API is implemented with Node.js, TypeScript, Express, Prisma ORM, and PostgreSQL. Redis is used for supporting infrastructure, while Nodemailer, Cloudinary, Google OAuth, and Stripe provide optional integrations.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Installation and local development](#installation-and-local-development)
- [API conventions](#api-conventions)
- [Authentication and roles](#authentication-and-roles)
- [API reference](#api-reference)
- [Typical workflows](#typical-workflows)
- [Database and Prisma](#database-and-prisma)
- [Database seeding](#database-seeding)
- [Testing and quality checks](#testing-and-quality-checks)
- [Postman](#postman)
- [Deployment](#deployment)
- [Security notes](#security-notes)

## Features

- Candidate, recruiter, and admin accounts
- Local email/password authentication
- Google OAuth login
- Email verification with OTP
- Access-token and refresh-token authentication
- Candidate profile and avatar management
- Recruiter profile and company-logo management
- Recruiter problem bank with MCQ and written problems
- Assessment authoring with problem snapshots and item ordering
- Assessment readiness and Stripe publishing checkout
- Candidate invitations with expiring email tokens
- Candidate invitation and attempt listing with pagination
- Candidate assessment attempts and answer submission
- Recruiter written-answer evaluation
- Admin user, recruiter-application, dashboard, and audit-log management
- PostgreSQL persistence through Prisma
- Soft deletion for problems, assessments, and invitations
- Security middleware, request validation, rate limiting, and centralized errors

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Language | TypeScript |
| HTTP API | Express 5 |
| ORM | Prisma ORM 7 |
| Database | PostgreSQL |
| Cache/infrastructure | Redis |
| Authentication | JWT, HttpOnly cookies, Google OAuth |
| Email | Nodemailer |
| File uploads | Cloudinary |
| Payments | Stripe |
| Validation | Zod |
| Formatting/linting | Biome |
| API testing | Postman and Node test runner |

## Project structure

```text
src/
├── app.ts                         Express application setup
├── server.ts                      Database, Redis, mailer, and HTTP startup
├── app/routes.ts                  Versioned route composition
├── config/                        Environment configuration
├── generated/prisma/              Generated Prisma client
├── lib/                           JWT, Prisma, Redis, mailer, audit helpers
├── middlewares/                   Authentication, roles, validation, errors, uploads
└── modules/
    ├── admin/                     Administration endpoints
    ├── assessments/               Assessment authoring and recruiter operations
    ├── attempts/                  Candidate assessment attempts
    ├── auth/                      Registration, login, verification, tokens
    ├── invitations/               Candidate invitation lifecycle
    ├── payments/                  Stripe checkout and webhook handling
    ├── problems/                  Recruiter problem bank
    ├── recruiter-profile/         Recruiter profile management
    ├── submissions/               Written submission evaluation
    └── users/                     Authenticated user profile management

prisma/                            Prisma schema and migrations
postman/                           Postman collection
docs/                              Deployment and phase-specific notes
```

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL
- Redis, unless the application is being run without Redis-dependent features
- SMTP credentials for invitation and verification emails
- Optional: Google OAuth, Cloudinary, and Stripe credentials

## Configuration

Copy the example environment file and replace the placeholder values:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Environment variables

| Variable | Required | Description |
|---|---:|---|
| `NODE_ENV` | No | Runtime mode. Defaults to `development`. |
| `PORT` | No | HTTP port. Defaults to `5000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_ACCESS_SECRET` | Yes | Secret used to sign access tokens. |
| `JWT_REFRESH_SECRET` | Yes | Secret used to sign refresh tokens. |
| `JWT_ACCESS_EXPIRES_IN` | No | Access-token lifetime. Defaults to `15m`. |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh-token lifetime. Defaults to `7d`. |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret. |
| `REDIS_URL` | Recommended | Redis connection URL. |
| `REDIS_USERNAME` | No | Split Redis configuration username. |
| `REDIS_HOST` | No | Split Redis configuration host. |
| `REDIS_PASSWORD` | No | Split Redis configuration password. |
| `REDIS_PORT` | No | Split Redis configuration port. |
| `FRONTEND_URL` | No | Frontend origin and invitation-link base URL. Defaults to `http://localhost:3000`. |
| `SMTP_HOST` | Recommended | SMTP server hostname. |
| `SMTP_PORT` | No | SMTP server port. Defaults to `587`. |
| `SMTP_USER` | Recommended | SMTP username. |
| `SMTP_PASSWORD` | Recommended | SMTP password. |
| `SMTP_FROM` | No | Sender displayed in application email. |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name for image uploads. |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret. |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for assessment publishing. |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature secret. |
| `ASSESSMENT_PUBLISH_FEE` | No | Publishing fee in the smallest currency unit. Defaults to `1000`. |
| `ASSESSMENT_PUBLISH_CURRENCY` | No | Stripe currency. Defaults to `usd`. |

`DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are required during configuration loading. Use strong, unique secrets outside local development. Never commit `.env` or real credentials.

## Installation and local development

Install dependencies:

```bash
npm install
```

Generate the Prisma client and apply local migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Start the development server with file watching:

```bash
npm run dev
```

The default server URL is:

```text
http://localhost:5000
```

The API base URL is:

```text
http://localhost:5000/api/v1
```

The root endpoint returns `Working fine`, and the health endpoint is:

```http
GET /api/v1/health
```

At startup the server connects to PostgreSQL, attempts to connect to Redis, verifies the Nodemailer transporter, and then starts listening. Redis and mailer connection failures are logged while the server continues to start; database connection failure prevents startup.

## API conventions

### Base URL

All application routes are mounted below `/api/v1`:

```text
http://localhost:5000/api/v1
```

The Stripe webhook is mounted separately at `/api/v1/payments/stripe/webhook` because it must receive the raw request body for signature verification.

### Authentication header

Protected requests may use a bearer token:

```http
Authorization: Bearer <access-token>
```

The authentication middleware also accepts the access token from the `accessToken` cookie. Refresh and logout flows use refresh tokens and may set or clear HttpOnly cookies depending on the runtime environment.

### Success response

Successful responses use this shape:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

Paginated endpoints return a `pagination` object inside `data`:

```json
{
  "page": 1,
  "limit": 10,
  "total": 25,
  "totalPages": 3,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

### Error response

Validation, authentication, authorization, and application errors use this shape:

```json
{
  "success": false,
  "message": "A human-readable error message.",
  "errors": []
}
```

Common status codes are `400` for invalid input, `401` for missing or invalid authentication, `403` for insufficient permissions, `404` for inaccessible or missing resources, `409` for state conflicts, `410` for expired resources, and `500` for unexpected server errors.

### Pagination and filtering

Most list endpoints accept `page` and `limit`. The default page is `1`, the default limit is `10`, and the maximum limit is `100`. Endpoint-specific filters and allowlisted sort fields are described below.

## Authentication and roles

The platform has three roles:

| Role | Main capabilities |
|---|---|
| `CANDIDATE` | Manage own profile, view invitations, start attempts, submit answers, view own attempts |
| `RECRUITER` | Manage problems and assessments, invite candidates, review submissions |
| `ADMIN` | Manage users, approve recruiters, inspect audit logs and platform metrics |

Recruiter-only endpoints additionally require an approved recruiter profile. Newly registered recruiters must be approved by an admin before using recruiter operations.

Email verification is required before a user can be used as an invitation candidate. The admin role is not publicly registered; it is intended to be provisioned through controlled administration/seeding.

## API reference

The following paths are relative to `/api/v1`.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Server health/liveness check. |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a candidate or recruiter. Sends an email-verification OTP. |
| `POST` | `/auth/verify-email` | Public | Verify an email using `email` and a six-digit `otp`. |
| `POST` | `/auth/resend-verification` | Public | Send a new verification OTP. |
| `POST` | `/auth/login` | Public | Log in with email and password. |
| `POST` | `/auth/google` | Public | Log in or register using a Google credential. |
| `POST` | `/auth/refresh` | Public/refresh token | Issue a new access token using a refresh token. |
| `POST` | `/auth/refresh-token` | Public/refresh token | Alias of `/auth/refresh`. |
| `POST` | `/auth/logout` | Public/refresh token | Revoke the refresh token and clear authentication state. |
| `GET` | `/auth-test/me` | Authenticated | Return the authenticated identity for debugging/integration checks. |

Example registration:

```json
{
  "name": "Candidate One",
  "email": "candidate@example.com",
  "password": "CandidatePass123!",
  "role": "CANDIDATE"
}
```

The `role` may be `CANDIDATE` or `RECRUITER`; it defaults to `CANDIDATE`.

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Any authenticated user | Get the current user profile. |
| `PATCH` | `/users/me` | Any authenticated user | Update the current profile. |
| `PATCH` | `/users/me/password` | Any authenticated user | Change the current password. |
| `PATCH` | `/users/me/avatar` | Any authenticated user | Upload or replace the profile avatar. |

### Recruiter profiles

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/recruiters/me/profile` | Approved recruiter or admin | Get the recruiter profile. |
| `PATCH` | `/recruiters/me/profile` | Approved recruiter or admin | Create or update company information. |
| `PATCH` | `/recruiters/me/profile/logo` | Approved recruiter or admin | Upload or replace the company logo. |

### Problems

All problem endpoints require an approved `RECRUITER`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/problems?page=1&limit=10&search=HTTP&type=MCQ&sortBy=createdAt&sortOrder=desc` | List the recruiter’s problems. |
| `POST` | `/problems` | Create an MCQ or written problem. |
| `GET` | `/problems/:id` | Get one owned problem. |
| `PATCH` | `/problems/:id` | Update an owned problem. |
| `DELETE` | `/problems/:id` | Soft-delete an owned problem. |

MCQ problems require `options` and a `correctAnswer` matching one option. Written problems require `expectedAnswer` and cannot include MCQ options or a correct answer.

Example MCQ:

```json
{
  "title": "HTTP status codes",
  "question": "Which status code means Not Found?",
  "type": "MCQ",
  "options": ["200", "201", "404", "500"],
  "correctAnswer": "404",
  "points": 5
}
```

Example written problem:

```json
{
  "title": "Explain database indexing",
  "question": "Explain how an index can improve query performance.",
  "type": "WRITTEN",
  "expectedAnswer": "A response should explain lookup structures and trade-offs.",
  "points": 10
}
```

### Assessments

All assessment endpoints require an approved `RECRUITER`. Recruiters can access only their own assessments.

| Method | Path | Description |
|---|---|---|
| `GET` | `/assessments?page=1&limit=10&search=Backend&status=PUBLISHED&sortBy=createdAt&sortOrder=desc` | List owned assessments. |
| `POST` | `/assessments` | Create a draft assessment. |
| `GET` | `/assessments/:assessmentId` | Get an owned assessment. |
| `PATCH` | `/assessments/:assessmentId` | Update draft/ready assessment metadata. |
| `DELETE` | `/assessments/:assessmentId` | Soft-delete an assessment. |
| `POST` | `/assessments/:assessmentId/items` | Add a problem snapshot to an assessment. |
| `PATCH` | `/assessments/:assessmentId/items/reorder` | Reorder every assessment item. |
| `PATCH` | `/assessments/:assessmentId/items/:itemId` | Change one item’s order. |
| `DELETE` | `/assessments/:assessmentId/items/:itemId` | Remove an assessment item. |
| `POST` | `/assessments/:assessmentId/ready` | Validate and mark a draft assessment `READY`. |
| `POST` | `/assessments/:assessmentId/payment` | Create a Stripe publishing checkout session. |
| `POST` | `/assessments/:assessmentId/invitations` | Invite an active, verified candidate. |
| `GET` | `/assessments/:assessmentId/invitations` | List invitations for an owned assessment. |
| `GET` | `/assessments/:assessmentId/submissions` | List submissions for an owned assessment. |

Assessment status values are `DRAFT`, `READY`, `PUBLISHED`, and `CLOSED`. Problems are copied into an assessment as snapshots, so later problem-bank changes do not alter an existing assessment item.

### Invitations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/invitations/candidate-invitations?page=1&limit=10&status=PENDING` | Candidate | List the current candidate’s incoming invitations. |
| `GET` | `/invitations/:id` | Candidate or owning recruiter | Get one invitation. |
| `POST` | `/invitations/:token/accept` | Candidate | Accept a valid, pending, unexpired invitation. |
| `POST` | `/invitations/:token/start` | Candidate | Start an attempt from an accepted invitation. |
| `DELETE` | `/invitations/:id` | Owning recruiter | Soft-delete a pending invitation. |

Invitation tokens are sent in email links and are not returned in normal API responses. Invitations are valid for seven days. An invitation can be created only for an active, verified candidate and a published, open assessment.

Candidate invitation-list query parameters:

| Parameter | Description |
|---|---|
| `page` | One-based page number. |
| `limit` | Number of records, from `1` to `100`. |
| `status` | Optional `PENDING`, `ACCEPTED`, or `USED` filter. |

### Attempts

All attempt endpoints require an authenticated `CANDIDATE`. Each candidate is restricted to their own attempts.

| Method | Path | Description |
|---|---|---|
| `GET` | `/attempts?page=1&limit=10&status=EVALUATED` | List the candidate’s own attempts. |
| `GET` | `/attempts/:id` | Get a candidate-safe attempt including assessment items and answers. |
| `POST` | `/attempts/:id/submit` | Submit answers for an in-progress attempt. |

Attempt statuses are `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, and `EVALUATED`. The list endpoint returns summary information, score/result data where available, and pagination metadata. Use the detail endpoint when the assessment questions or submitted answers are required.

Example answer submission:

```json
{
  "answers": [
    {
      "assessmentItemId": "082497a0-b861-4fc7-8329-4bf9c5b6d7a0",
      "answer": "404"
    }
  ]
}
```

### Submissions

| Method | Path | Auth | Description |
|---|---|---|---|
| `PATCH` | `/submissions/:submissionId/evaluate` | Approved recruiter | Evaluate a pending written submission. |

Example evaluation:

```json
{
  "score": 8,
  "feedback": "Good explanation of the indexing trade-offs."
}
```

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/assessments/:assessmentId/payment` | Approved recruiter | Create the Stripe checkout session used to publish an assessment. |
| `POST` | `/payments/stripe/webhook` | Stripe signature | Process Stripe payment lifecycle events. |

Run Stripe CLI forwarding during local webhook development:

```bash
stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook
```

The webhook must use the raw JSON request body. Do not place `express.json()` before this route.

### Admin

All admin endpoints require `ADMIN`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/dashboard` | Get platform metrics. |
| `GET` | `/admin/users?page=1&limit=10&status=ACTIVE&sortBy=createdAt&sortOrder=desc` | List users. |
| `GET` | `/admin/users/:id` | Get a user. |
| `PATCH` | `/admin/users/:id/status` | Change a user’s status. |
| `GET` | `/admin/audit-logs?page=1&limit=10&action=USER_LOGIN&entity=User&sortOrder=desc` | List audit logs. |
| `GET` | `/admin/audit-logs/:id` | Get one audit log. |
| `GET` | `/admin/recruiter-applications?page=1&limit=10` | List recruiter applications. |
| `PATCH` | `/admin/recruiter-applications/:userId/approve` | Approve a recruiter application. |

## Typical workflows

### Candidate onboarding

1. `POST /auth/register` with `role: CANDIDATE`.
2. `POST /auth/verify-email` with the received OTP.
3. `POST /auth/login` and save the access token or use the returned cookie.
4. `GET /users/me` to confirm the authenticated profile.
5. `GET /invitations/candidate-invitations` to view incoming invitations.

### Recruiter onboarding

1. `POST /auth/register` with `role: RECRUITER`.
2. Verify the recruiter email and log in.
3. Complete the recruiter profile with `PATCH /recruiters/me/profile`.
4. An admin approves the recruiter application.
5. Create problems and assessments.
6. Add problem snapshots and mark a valid assessment `READY`.
7. Complete the Stripe publishing flow so the assessment becomes available for invitations.

### Invite and assess a candidate

1. The approved recruiter creates an invitation for a verified candidate.
2. The candidate reads the invitation list or opens the email link.
3. The candidate accepts the invitation using its token.
4. The candidate starts the attempt using the same token.
5. The candidate reads the attempt through `/attempts/:id` and submits answers.
6. Objective answers are evaluated automatically; written answers can be evaluated by the recruiter.
7. The candidate can track all attempts through `GET /attempts`.

### Admin recruiter approval

1. An admin logs in.
2. The admin lists applications using `/admin/recruiter-applications`.
3. The admin approves a user with `/admin/recruiter-applications/:userId/approve`.
4. The recruiter can then use recruiter-protected endpoints.

## Database and Prisma

The Prisma schema is split across `prisma/*.prisma` files and uses PostgreSQL. Important entities include:

- `User` and `RecruiterProfile`
- `Problem` and `AssessmentItem`
- `Assessment`
- `Invitation`
- `Attempt` and `Submission`
- `Evaluation`
- `Payment`
- `RefreshToken`
- `AuditLog`

Useful commands:

```bash
# Generate the Prisma client
npm run prisma:generate

# Create and apply a development migration
npm run prisma:migrate

# Apply existing migrations in a deployment environment
npm run prisma:migrate:deploy

# Open Prisma Studio
npm run prisma:studio

# Seed configured development data
npm run seed
```

Use `prisma migrate dev` only for development. Production deployments should apply reviewed migrations with `prisma migrate deploy`.

## Database seeding

The idempotent seed script is located at `src/app/seed.ts` and is run with:

```bash
npm run seed
```

Run migrations first so the database schema exists. The seed creates or updates the following development records:

- A verified `ADMIN` account
- A verified and approved `RECRUITER` account with a recruiter profile
- A verified `CANDIDATE` account
- Two recruiter problems: one MCQ and one written problem
- One draft assessment containing both problems as assessment items

Default local credentials are:

| Account | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `AdminPass123!` |
| Recruiter | `recruiter@example.com` | `RecruiterPass123!` |
| Candidate | `candidate@example.com` | `CandidatePass123!` |

For safer or customized local values, set these variables in `.env` before running the seed: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_RECRUITER_EMAIL`, `SEED_RECRUITER_PASSWORD`, `SEED_CANDIDATE_EMAIL`, and `SEED_CANDIDATE_PASSWORD`. The script uses stable IDs and upserts, so it can be safely run repeatedly. These credentials are for development only and must be changed before using a non-local database.

## Testing and quality checks

Run the TypeScript compiler without emitting files:

```bash
npm run typecheck
```

Run the test suite:

```bash
npm test
```

Run Biome checks:

```bash
npm run lint
```

Build the production output:

```bash
npm run build
```

The repository also contains phase-specific testing notes under `docs/`, including invitation validation and deployment guidance.

## Postman

The project includes:

```text
postman/Developer Assessment Platform(v1).postman_collection.json
```

Import this collection into Postman and set the `baseUrl` collection variable to:

```text
http://localhost:5000/api/v1
```

Run the authentication requests first, then store or configure the access token for protected requests. The collection contains examples for candidate, recruiter, and admin workflows, including candidate invitation and attempt listing.

Use real UUIDs from the current database instead of the example IDs in requests. Invitation acceptance and attempt-start requests require the raw token from the invitation email; the database stores only its hash.

## Deployment

The included Dockerfile builds the TypeScript application and runs it with Node.js 22 Alpine:

```bash
docker build -t developer-assessment-platform .
docker run --env-file .env -p 5000:5000 developer-assessment-platform
```

The container listens on `PORT` and exposes a health check at `/api/v1/health`. The production start command is:

```bash
npm start
```

Before a production release:

1. Provision PostgreSQL, Redis, SMTP, and required third-party credentials.
2. Set `NODE_ENV=production` and strong JWT secrets.
3. Apply reviewed Prisma migrations with `npm run prisma:migrate:deploy`.
4. Configure the Stripe webhook URL and signing secret when publishing is enabled.
5. Configure HTTPS at the hosting layer and set `FRONTEND_URL` to the exact frontend origin.
6. Confirm the health endpoint and a complete authentication flow.

The repository also contains `docs/deployment.md` with additional production notes. Do not copy a real `.env` file into a container image or commit it to source control.

## Security notes

- Protected routes require authentication and role checks.
- Recruiter routes also require approved recruiter status.
- Resource ownership is checked in service queries; candidates cannot read another candidate’s invitations or attempts.
- Invitation tokens are cryptographically generated, expire after seven days, and are not exposed in normal API responses.
- Invitation and assessment deletion is soft deletion where supported.
- Request bodies and query parameters are validated with Zod.
- Security headers, CORS handling, rate limiting, and cookie parsing are configured centrally.
- Stripe webhook signatures are verified using the raw request body.
- Keep database, JWT, SMTP, Cloudinary, Google, and Stripe credentials outside source control.

## License and repository information

This project is currently version `1.0.0` and is maintained as the Developer Assessment Platform repository. The package metadata identifies the repository as:

```text
https://github.com/pronoyc11/Developer_Assesment_platform
```
