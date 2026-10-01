# Phase 7 Invitation Testing Checklist

## Setup

- API root: `http://localhost:5000/api/v1`.
- Use `Authorization: Bearer <access-token>` on protected requests. JSON requests use `Content-Type: application/json`.
- Use one active, verified RECRUITER and two active, verified CANDIDATE accounts. Keep candidate B for wrong-owner tests.
- Phase 9 publishing is not implemented. For invitation tests, create a Phase 6 assessment with its normal authoring flow, then in Prisma Studio set `status = PUBLISHED`, set `publishedAt` to the current time, and ensure `closedAt` and `deletedAt` are null. Restore/delete this fixture after testing.
- The invitation lifetime is seven days. The database stores a SHA-256 token hash; only the emailed frontend URL contains the raw token.

## Invitation Creation and Listing

- [ ] **1. Require authentication**
  - `POST /api/v1/assessments/{{assessmentId}}/invitations`
  - No Authorization header; JSON body `{"candidateId":"{{candidateAId}}"}`.
  - Expect `401`; no Invitation row or email.

- [ ] **2. Require recruiter role**
  - Same `POST` as an authenticated CANDIDATE.
  - Expect `403`; no Invitation row or email.

- [ ] **3. Reject non-published assessment**
  - As owning recruiter, POST the same body for a DRAFT assessment, then a READY assessment.
  - Expect `409` for each; no Invitation row and no email.

- [ ] **4. Reject assessment not owned by recruiter**
  - As recruiter A, POST to recruiter B's PUBLISHED assessment.
  - Expect `404`; no Invitation row and no email.

- [ ] **5. Create invitation for valid candidate**
  - As owning recruiter, `POST /api/v1/assessments/{{assessmentId}}/invitations` with `{"candidateId":"{{candidateAId}}"}`.
  - Expect `201`, `status: "PENDING"`, email, assessmentId, candidateId, expiresAt, and invitation id. Response must not contain `token`.
  - Verify one Invitation row with matching assessment/candidate, `status=PENDING`, `acceptedAt=null`, `usedAt=null`, `deletedAt=null`, and `expiresAt` about seven days ahead. Verify token is a 64-character hash and is not the raw token in the email URL.

- [ ] **6. Verify invitation email**
  - Inspect candidate A's inbox for the message from the configured Nodemailer sender.
  - Verify assessment title, recruiter/company name when set, seven-day expiration, and a URL shaped like `{{FRONTEND_URL}}/invitations/<43-character-token>`. Verify answer keys are absent. Confirm the URL/token is not logged by the API.

- [ ] **7. Reject invalid candidate IDs**
  - POST with malformed UUID; expect `400` and no DB row.
  - POST with a nonexistent UUID; expect `404` and no DB row.

- [ ] **8. Reject non-candidate, unverified, blocked, suspended, or deleted users**
  - POST using an ADMIN or RECRUITER user ID, then test candidate fixtures with `emailVerified=false`, `status=BLOCKED`, `status=SUSPENDED`, and non-null `deletedAt`.
  - Expect `404` for each candidate lookup failure and no invitation/email. Restore fixtures afterward.

- [ ] **9. Reject duplicate active invitation**
  - Repeat test 5 for candidate A and the same assessment.
  - Expect `409`; verify there is still only one row and the original token hash/expiry remain unchanged.

- [ ] **10. List assessment invitations**
  - `GET /api/v1/assessments/{{assessmentId}}/invitations?page=1&limit=10&status=PENDING&search=candidateA&sortBy=createdAt&sortOrder=desc` as the owner recruiter.
  - Expect `200`, candidate A's invitation, and pagination metadata. Verify no token field appears.

- [ ] **11. Validate list query**
  - Repeat list with `status=INVALID`, `sortBy=token`, or `limit=101`.
  - Expect `400` for each.

- [ ] **12. Prevent cross-recruiter list access**
  - As recruiter A, GET invitations for recruiter B's assessment.
  - Expect `404`; no B invitation/candidate data is returned.

## Invitation Detail and Acceptance

- [ ] **13. Read invitation as allowed users**
  - `GET /api/v1/invitations/{{invitationId}}` as candidate A and separately as the owning recruiter.
  - Expect `200`, invitation status/expiry and assessment summary, but no token.

- [ ] **14. Hide invitation from unrelated users**
  - GET the same invitation as candidate B, another recruiter, or an unauthenticated request.
  - Expect `404` for authenticated unrelated users and `401` without auth.

- [ ] **15. Reject invalid token shape**
  - `POST /api/v1/invitations/not-a-token/accept` as candidate A.
  - Expect `400`; DB status remains PENDING.

- [ ] **16. Reject well-shaped unknown token**
  - POST a random 43-character base64url token to `/api/v1/invitations/{{randomToken}}/accept`.
  - Expect `404`; no row changes.

- [ ] **17. Prevent another candidate accepting the invitation**
  - Candidate B sends `POST /api/v1/invitations/{{rawTokenFromEmail}}/accept` with no body.
  - Expect `404`; invitation remains PENDING with acceptedAt null.

- [ ] **18. Accept as invited candidate**
  - Candidate A sends `POST /api/v1/invitations/{{rawTokenFromEmail}}/accept`, empty body.
  - Expect `200`, status `ACCEPTED`, acceptedAt, and assessment title. No token or answer keys in response.
  - Verify the same Invitation row changed to `ACCEPTED`, acceptedAt is set, usedAt remains null, and no Attempt row was created.

- [ ] **19. Reject token reuse**
  - Candidate A repeats the accept request with the same raw token.
  - Expect `409`; acceptedAt remains the original value and no Attempt row is created.

- [ ] **20. Reject expired invitation**
  - In Prisma Studio set another pending invitation's expiresAt to a past time. Its candidate sends the valid emailed token to accept.
  - Expect `410`; status remains PENDING and acceptedAt remains null.

- [ ] **21. Reject soft-deleted invitation**
  - Set a pending invitation's deletedAt in Prisma Studio, then try GET and accept with its token.
  - Expect `404`; verify the row remains in the database with deletedAt set.

- [ ] **22. Reject blocked/suspended invitee**
  - Set candidate A to BLOCKED, then SUSPENDED and attempt acceptance. Authentication should reject with `403` before acceptance. Restore ACTIVE afterward.

## Cancellation, Email Failure, and Regression

- [ ] **23. Soft-delete pending invitation**
  - Owning recruiter sends `DELETE /api/v1/invitations/{{pendingInvitationId}}`.
  - Expect `200`; verify deletedAt is set and the row is not physically removed. It should disappear from normal list/detail and its token should return `404` on acceptance.

- [ ] **24. Enforce cancellation ownership/state**
  - Another recruiter tries deleting the invitation; expect `404`. Owning recruiter tries deleting an ACCEPTED invitation; expect `409`.

- [ ] **25. Handle SMTP failure safely**
  - In a local-only setup temporarily unset SMTP_USER/SMTP_PASSWORD and restart. Create an invitation for an eligible candidate.
  - Expect a controlled `503`; no active invitation should remain, the row should have deletedAt set, and no token/secret should appear in the response or logs. Restore SMTP configuration.

- [ ] **26. Retry after failed delivery**
  - Restore SMTP and repeat invitation creation for the same assessment/candidate whose failed-send row was soft-deleted.
  - Expect a new delivered pending invitation using the same unique row (no duplicate row), with a fresh token hash and expiry.

- [ ] **27. Phase 4 authentication regression**
  - Register, verify email, login, refresh, logout, and call `GET /api/v1/auth-test/me` with a valid token. Expect the established statuses/cookies and no invitation changes.

- [ ] **28. Phase 5 profile regression**
  - Call `GET/PATCH /api/v1/users/me` and `GET/PATCH /api/v1/recruiters/me/profile` with appropriate users. Confirm profile behavior and RBAC remain unchanged.

- [ ] **29. Phase 6 authoring regression**
  - Create/list/update/soft-delete an owned Problem; create/list/get an Assessment, add/reorder/remove an item, and mark a valid draft READY. Confirm invitation routes do not change snapshots or phase 6 status rules.

- [ ] **30. Error and sensitive-data review**
  - For invalid IDs, duplicate requests, SMTP failure, and authorization failures, confirm standard `{success:false,message,errors}` responses; no raw Prisma error, stack trace, token hash, raw token, or mail credential appears.
