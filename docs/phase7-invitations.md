# Phase 7 Invitation Rules

- Only an active recruiter who owns an assessment can invite candidates. The assessment must be `PUBLISHED` and not closed; `DRAFT` and `READY` are not inviteable. Publishing remains deferred to Phase 9.
- Invitees must already exist as active, verified `CANDIDATE` accounts. The invitation endpoint never creates users.
- Invitation tokens are 32 cryptographically random bytes encoded as base64url. Only the SHA-256 hash is persisted in PostgreSQL; the raw token is sent by email and is not returned by API responses or logged.
- Invitations expire seven days after creation. Expired or soft-deleted pending invitations may be retried by reusing the unique assessment/candidate row. A pending invitation cannot be duplicated; accepted/used invitations cannot be reissued in this phase.
- Email delivery uses the existing Nodemailer transporter. The email links to `{FRONTEND_URL}/invitations/{token}`; the authenticated frontend should call `POST /api/v1/invitations/{token}/accept` after the invited candidate signs in.
- Acceptance requires the authenticated user to be the invitee and the invitation to remain pending, unexpired, undeleted, and associated with an open published assessment. Acceptance sets `status = ACCEPTED` and `acceptedAt`; attempts and `USED` are deferred to Phase 8.
- Recruiter listing supports pagination, status, candidate name/email search, and allowlisted sorting. Invitation details are visible only to the invited candidate or the assessment-owning recruiter. Recruiters may soft-delete pending invitations only.
