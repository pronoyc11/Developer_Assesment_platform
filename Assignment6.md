# Developer Assessment Platform

API_DOCUMENTATION_POSTMAN : https://documenter.getpostman.com/view/29611624/2sBYHNX3UK

## Purpose

Developer Assessment Platform is a backend for recruiters to build technical assessments and evaluate candidate submissions. It manages identities, recruiter approval, profiles and company assets, reusable problems, assessment snapshots, paid publication, candidate invitations, timed attempts, automatic MCQ scoring, manual written evaluation, admin user controls, and audit history.

The API is rooted at `/api/v1`. It is built with Express 5 and TypeScript, PostgreSQL/Prisma 7, Redis, Nodemailer, Cloudinary, and Stripe. It is backend-only; frontend screens and production cloud resources are not part of this repository.

## Main Workflow

1. A candidate or recruiter applicant registers. Email verification is required. A recruiter applicant remains a candidate with `recruiterStatus=PENDING` until an admin approves them.
2. An approved recruiter maintains a company profile and builds a reusable bank of MCQ and written problems.
3. The recruiter creates a DRAFT assessment and adds problems. Each assessment item is a snapshot, so later edits to the source problem do not alter the assessment.
4. The recruiter marks a valid assessment READY. Editing a READY assessment returns it to DRAFT.
5. The owning recruiter starts Stripe Checkout for the configured publishing fee. A verified Stripe webhook changes the payment to PAID and the assessment to PUBLISHED.
6. The recruiter invites an existing active, verified candidate. The invitation token is random, stored hashed, and expires after seven days.
7. The invited candidate accepts the invitation and starts the single allowed attempt. Starting creates an IN_PROGRESS attempt and changes the invitation to USED.
8. The candidate submits all answers before the server-side deadline. MCQ items are automatically scored; written answers remain pending.
9. The owning recruiter scores written answers. When all are evaluated, the attempt becomes EVALUATED and the candidate can see a safe result.
10. Admins manage account status and inspect aggregate counts and immutable audit events.

## Roles and Access

- `CANDIDATE`: own user profile; accept invitations addressed to them; start, read, submit, and view results for their own attempts.
- `RECRUITER`: own company profile, problems, assessments, invitations, and assessment submissions/evaluations. A recruiter applicant does not receive this role until admin approval.
- `ADMIN`: recruiter application approval, user management, dashboard, and audit-log access. Public registration cannot create an admin.

Authenticated API routes accept `Authorization: Bearer <access JWT>` or the HttpOnly `accessToken` cookie. Login/verification set HttpOnly access and refresh cookies. Refresh rotates refresh tokens; password change revokes active refresh tokens. Soft-deleted or non-active accounts cannot authenticate.

Success responses use `{ "success": true, "message": "...", "data": ... }`. Error responses use `{ "success": false, "message": "...", "errors": [...] }`.

## API Endpoints

Examples use `{{baseUrl}}` as shorthand for `http://localhost:5000/api/v1`. Protected examples require the role shown. JSON requests use `Content-Type: application/json`; upload requests use multipart form-data.

### Health

| Method and path | Access | Purpose |
|---|---|---|
| `GET /health` | Public | Health response with status and environment, no secrets. Optional query `test` must be at least 3 characters. |

### Authentication

| Method and path | Access | Request and behavior |
|---|---|---|
| `POST /auth/register` | Public | `{ "name": "Test Candidate", "email": "candidate@example.com", "password": "CandidatePass123!", "role": "CANDIDATE" }`. Role may be `CANDIDATE` or a recruiter request. Sends email OTP; registration data stays temporary until verification. |
| `POST /auth/verify-email` | Public | `{ "email": "candidate@example.com", "otp": "123456" }`. OTP is six digits. Creates the account, sets cookies, and issues tokens. |
| `POST /auth/resend-verification` | Public | `{ "email": "candidate@example.com" }`. Redis cooldown and privacy-preserving response apply. |
| `POST /auth/login` | Public | `{ "email": "candidate@example.com", "password": "CandidatePass123!" }`. Sets HttpOnly cookies and returns auth result. |
| `POST /auth/google` | Public/configured | `{ "credential": "<Google ID token>" }` or `idToken`. Requires Google configuration. |
| `POST /auth/refresh` | Public token route | Optional JSON `{ "refreshToken": "<refresh token>" }`; otherwise uses the refresh cookie. Rotates the token. |
| `POST /auth/refresh-token` | Alias | Same behavior as `/auth/refresh`. |
| `POST /auth/logout` | Auth token route | Optional JSON refresh token or refresh cookie. Revokes refresh token and clears cookies. |
| `GET /auth-test/me` | Authenticated | Temporary authentication probe returning the current user. |

### Users and Recruiters

| Method and path | Access | Request and behavior |
|---|---|---|
| `GET /users/me` | Authenticated | Returns safe own profile fields; never password hashes or refresh-token data. |
| `PATCH /users/me` | Authenticated | `{ "name": "Updated Name" }`. Only `name` is editable. |
| `PATCH /users/me/password` | Authenticated | `{ "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }`. Local accounts verify current password; active refresh tokens are revoked. Google-only users cannot establish a local password here. |
| `PATCH /users/me/avatar` | Authenticated | Multipart field `avatar`, file type JPEG/PNG/WebP, max 5 MB. Uses memory storage and Cloudinary; signature bytes are checked. |
| `GET /recruiters/me/profile` | RECRUITER or ADMIN | Returns the caller's recruiter profile; absent/deleted profile returns 404. |
| `PATCH /recruiters/me/profile` | RECRUITER or ADMIN | Optional `companyName` (200 chars), `companyDescription` (5000 chars), `companyWebsite` (URL, 500 chars). Upserts the caller's profile. |
| `PATCH /recruiters/me/profile/logo` | RECRUITER or ADMIN | Multipart field `logo`; JPEG/PNG/WebP, max 5 MB. Stores Cloudinary URL/public ID and safely replaces the previous asset. |

### Problems

All routes require RECRUITER role and operate only on that recruiter’s problems. Deleted problems are excluded; deletion is soft.

| Method and path | Request/query |
|---|---|
| `GET /problems` | Query: `page`, `limit` (max 100), `search`, `type=MCQ\|WRITTEN`, `sortBy=createdAt\|updatedAt\|title\|points\|type`, `sortOrder=asc\|desc`. Search covers title/question. |
| `POST /problems` | MCQ example: `{ "title": "HTTP Protocol", "question": "What does HTTP stand for?", "type": "MCQ", "options": ["HyperText Transfer Protocol", "HighText Transfer Protocol"], "correctAnswer": "HyperText Transfer Protocol", "points": 2 }`. Requires 2-10 unique, trimmed options; answer must match one option. |
| `POST /problems` | Written example: `{ "title": "REST Principles", "question": "Explain REST.", "type": "WRITTEN", "expectedAnswer": "Stateless resource-oriented APIs.", "points": 5 }`. Written problems reject MCQ fields. |
| `GET /problems/:id` | Owning recruiter only; returns authoring data including answer keys. |
| `PATCH /problems/:id` | Explicitly editable fields: `title`, `question`, `type`, `options`, `correctAnswer`, `expectedAnswer`, `points`; combinations are revalidated. Existing assessment snapshots do not change. |
| `DELETE /problems/:id` | Soft-deletes the owned problem; existing snapshots remain intact. |

Titles are 3-255 characters, points are integers from 1-1000, and sort fields are allowlisted.

### Assessments

All assessment authoring routes require RECRUITER role and ownership. Passing score is a percentage from 0-100; duration is 1-600 minutes. Assessment creation starts at DRAFT. READY assessments remain editable, but any metadata or item edit returns them to DRAFT. PUBLISHED/CLOSED assessments cannot be edited. DRAFT/READY assessments can be soft-deleted.

| Method and path | Request/query |
|---|---|
| `GET /assessments` | Query: `page`, `limit` (max 100), `search`, `status=DRAFT\|READY\|PUBLISHED\|CLOSED`, `sortBy=createdAt\|updatedAt\|title\|durationMinutes\|passingScore\|status`, `sortOrder`. Returns summaries and `itemCount`. |
| `POST /assessments` | `{ "title": "Backend Developer Assessment", "description": "Backend fundamentals.", "durationMinutes": 60, "passingScore": 60 }`. Client cannot set owner or status. |
| `GET /assessments/:assessmentId` | Owning recruiter only; returns assessment and ordered item snapshots, including recruiter-only answer keys. |
| `PATCH /assessments/:assessmentId` | Updates allowed metadata fields only. Status and ownership fields are not mass-assignable. An edit resets READY to DRAFT. |
| `DELETE /assessments/:assessmentId` | Soft-deletes an editable assessment; PUBLISHED/CLOSED are protected. |
| `POST /assessments/:assessmentId/items` | `{ "problemId": "11111111-1111-4111-8111-111111111111", "order": 1 }`. Problem and assessment must be active and owned by the same recruiter. Copies a snapshot. Duplicate problem/order returns 409. |
| `PATCH /assessments/:assessmentId/items/reorder` | `{ "items": [{ "itemId": "33333333-3333-4333-8333-333333333333", "order": 1 }] }`. Must include every item once with consecutive unique orders. Transaction uses temporary order values to support swaps. |
| `PATCH /assessments/:assessmentId/items/:itemId` | `{ "order": 2 }`. Only order is editable. Conflicting order returns 409. |
| `DELETE /assessments/:assessmentId/items/:itemId` | Removes only the snapshot item and normalizes remaining orders transactionally. |
| `POST /assessments/:assessmentId/ready` | No body. Validates at least one item, consecutive order, positive points, and question snapshot consistency; transitions DRAFT to READY only. |
| `POST /assessments/:assessmentId/payment` | No body. Creates a Stripe Checkout session for an owned READY assessment using server-configured fee/currency. |

Assessment items retain the problem content as of insertion. Candidate-facing attempt routes use separate safe selects and do not return `correctAnswer` or `expectedAnswer`.

### Invitations

Creation/list/deletion require the owning recruiter. Invitation creation requires an open PUBLISHED assessment and an existing active, email-verified CANDIDATE. Tokens are 32 random bytes, stored as SHA-256 hashes, emailed once, and expire after seven days. No token is returned in normal invitation JSON responses.

| Method and path | Request/query |
|---|---|
| `POST /assessments/:assessmentId/invitations` | `{ "candidateId": "11111111-1111-4111-8111-111111111111" }`. Candidate account must already exist. Unique assessment/candidate constraint prevents duplicate active invitations. |
| `GET /assessments/:assessmentId/invitations` | Query: `page`, `limit`, `status=PENDING\|ACCEPTED\|USED`, `search` candidate name/email, `sortBy=createdAt\|expiresAt\|status\|email`, `sortOrder`. |
| `GET /invitations/:id` | Authenticated invitee or the recruiter who owns the related assessment. |
| `POST /invitations/:token/accept` | Authenticated invited candidate only; no request body. Sets ACCEPTED/acceptedAt. |
| `DELETE /invitations/:id` | Owning recruiter; pending invitations are soft-deleted. |
| `POST /invitations/:token/start` | CANDIDATE role; invitation must be accepted and valid. Creates the one allowed attempt and marks the invitation USED. |

### Attempts and Submissions

Attempt start/submit/detail routes require CANDIDATE role and are scoped to the authenticated candidate. The server calculates the deadline as `startedAt + durationMinutes`. Starting an attempt stores max score from assessment snapshots and is protected by the unique `(assessmentId, candidateId)` constraint.

| Method and path | Request and behavior |
|---|---|
| `GET /attempts/:id` | Candidate's own attempt only. Returns assessment prompt/options/points/order, status, deadline/remaining seconds, own answers, and result only when evaluated. No answer keys. |
| `POST /attempts/:id/submit` | `{ "answers": [{ "assessmentItemId": "33333333-3333-4333-8333-333333333333", "answer": "HyperText Transfer Protocol" }] }`. Must include every assessment item exactly once before deadline. Duplicate/foreign/unknown items are rejected. |
| `GET /assessments/:assessmentId/submissions` | Owning recruiter; query `page`, `limit`, optional submission `status`. Returns candidate answers, points/expected-answer context, and evaluation data. |
| `PATCH /submissions/:submissionId/evaluate` | Owning recruiter; `{ "score": 4, "feedback": "Good explanation." }`. Written questions only; score is bounded by snapshot points. |

MCQ answers are compared against the assessment snapshot and become AUTO_EVALUATED with earned points or zero. Written answers start PENDING at zero. Attempts with pending written items become SUBMITTED; otherwise they immediately become EVALUATED. Once all written submissions are graded, the attempt total and evaluatedAt are finalized. Candidate result percentage and pass state use the assessment passingScore.

### Payments

| Method and path | Access | Behavior |
|---|---|---|
| `POST /assessments/:assessmentId/payment` | Owning RECRUITER | READY assessment only. Fee/currency come from `ASSESSMENT_PUBLISH_FEE` and `ASSESSMENT_PUBLISH_CURRENCY`, not request data. Returns payment ID, Checkout URL/session ID, amount, currency, and PENDING status. |
| `POST /payments/stripe/webhook` | Stripe signature | Route-specific raw body is used for signature verification. Verified paid Checkout events transactionally mark Payment PAID and Assessment PUBLISHED. Duplicate deliveries are state-idempotent. Expired/failed sessions leave assessment unpublished. |

The publishing fee is an integer in Stripe's smallest currency unit (for USD, cents). Assessment status cannot be set to PUBLISHED through generic PATCH.

### Admin and Audit

All `/admin` routes require ADMIN role.

| Method and path | Behavior |
|---|---|
| `GET /admin/dashboard` | Counts users by role/status, assessments/published assessments, attempts, and payments/paid payments. |
| `GET /admin/users` | Query: `page`, `limit`, `search`, `role`, `status`, `sortBy=createdAt\|name\|email\|role\|status`, `sortOrder`. Excludes soft-deleted users and sensitive auth fields. |
| `GET /admin/users/:id` | Safe user details only. |
| `PATCH /admin/users/:id/status` | `{ "status": "ACTIVE" }`, `BLOCKED`, or `SUSPENDED`. Authentication middleware enforces inactive status. |
| `GET /admin/audit-logs` | Query: `page`, `limit`, `actorId`, `action`, `entity`, `entityId`, `from`, `to`, `sortOrder`. |
| `GET /admin/audit-logs/:id` | Retrieves a read-only audit record. No update/delete API exists. |
| `GET /admin/recruiter-applications` | Lists pending recruiter applications with pagination. |
| `PATCH /admin/recruiter-applications/:userId/approve` | Approves pending applicant, changes role, and creates/restores recruiter profile. |

Audit records capture actor, action, entity, entity ID, request IP/user agent, and limited metadata. Credentials, tokens, OTPs, answers, and provider secrets are not intended audit metadata.

## Runtime and Configuration

Required at startup: `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`.

Other variables used by the application include `NODE_ENV`, `PORT`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `FRONTEND_URL`, `REDIS_URL` or split Redis settings (`REDIS_USERNAME`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`), SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`), Google OAuth keys, Cloudinary credentials, Stripe keys/webhook secret, and assessment publishing fee/currency. See `.env.example`; provide real credentials through a secret manager, not source control.

Security middleware includes Helmet, exact-origin credentialed CORS, proxy awareness, and a 100-request/15-minute rate limit. Cookies are HttpOnly; production cookies use Secure and SameSite=None. Errors use the common success/error envelopes.

## Development and Operations

- `npm install`: install dependencies.
- `npm run dev`: run the TypeScript development server.
- `npm run prisma:generate`: regenerate the committed Prisma client.
- `npm run prisma:migrate`: create/apply a development migration.
- `npm run prisma:migrate:deploy`: apply existing migrations in deployment.
- `npm run prisma:studio`: inspect local database records.
- `npm run test`: run database-independent Node contract tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: quality gates.
- `npm start`: run `dist/src/server.js`; the build rewrites extensionless ESM imports for Node.

The multi-stage `Dockerfile` builds and runs the application. The runtime image does not run migrations. Apply migrations separately with `npm run prisma:migrate:deploy` in an environment containing the Prisma CLI and production `DATABASE_URL`. Deployment notes and the production Stripe webhook URL are in `docs/deployment.md`.

The test suite currently focuses on Zod validation contracts and collection structure. PostgreSQL/Redis-backed workflows, SMTP delivery, Cloudinary, live Stripe Checkout/webhooks, and production hosting require configured external services and must be verified in their target environment.
