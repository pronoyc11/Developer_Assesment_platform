# Phase 6 Authoring Rules

- Passing score is a percentage from 0 through 100. Assessment duration is limited to 1 through 600 minutes. Problem points are limited to 1 through 1,000.
- Problem and assessment list endpoints are recruiter-owned, paginated, searchable, and sortable only by the fields declared in their query schemas.
- Assessment items are immutable snapshots of the source problem at insertion time. Updating or soft-deleting a problem never changes an existing snapshot.
- Adding an item requires an unused order. Conflicting orders return `409`; they are not shifted automatically. Reorder requests must include every current item once and assign a consecutive sequence from 1. Removing an item normalizes remaining orders.
- `DRAFT` and `READY` assessments are editable. Any metadata or item change to a `READY` assessment returns it to `DRAFT`. `READY` assessments may be soft-deleted. `PUBLISHED` and `CLOSED` assessments cannot be changed or deleted.
- Marking an assessment ready is allowed only from `DRAFT`, requires at least one consecutive, valid snapshot, and only changes the status to `READY`. Publishing, payments, invitations, and candidate-facing delivery are intentionally not implemented in Phase 6.
- Recruiter assessment/problem DTOs may include answer keys. Candidate response DTOs are separate types and omit `correctAnswer` and `expectedAnswer`; no candidate assessment endpoint is exposed in this phase.
