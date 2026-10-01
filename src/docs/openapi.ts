const bearerSecurity = [{ bearerAuth: [] }];
const cookieSecurity = [{ cookieAuth: [] }];
const standardErrors = {
  "400": { description: "Validation or business-rule error" },
  "401": { description: "Authentication required or invalid" },
  "403": { description: "Role or account status denied" },
  "404": { description: "Resource not found or not owned" },
  "409": { description: "State or uniqueness conflict" },
};

const operation = (
  summary: string,
  tags: string[],
  secured = true,
  requestBody?: object,
) => ({
  summary,
  tags,
  ...(secured && { security: [...bearerSecurity, ...cookieSecurity] }),
  ...(requestBody && { requestBody }),
  responses: {
    "200": {
      description: "Successful operation using the standard API envelope",
    },
    ...standardErrors,
  },
});

const jsonBody = (schema: object, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

const uuid = { type: "string", format: "uuid" };
const idParam = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: uuid,
});

const queryParam = (name: string, schema: object, description: string) => ({
  name,
  in: "query",
  description,
  schema,
});

const paginationParams = [
  queryParam(
    "page",
    { type: "integer", minimum: 1, default: 1 },
    "Page number",
  ),
  queryParam(
    "limit",
    { type: "integer", minimum: 1, maximum: 100, default: 10 },
    "Page size, capped at 100",
  ),
];

const sortParams = (fields: string[]) => [
  queryParam(
    "sortBy",
    { type: "string", enum: fields },
    "Allowlisted sort field",
  ),
  queryParam(
    "sortOrder",
    { type: "string", enum: ["asc", "desc"] },
    "Sort direction",
  ),
];

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Developer Assessment Platform API",
    version: "1.0.0",
    description:
      "Backend API for authentication, recruiter profiles, problem/assessment authoring, invitations, attempts, payment-controlled publishing, and administration. Authenticated routes accept Bearer tokens; the application also supports its HttpOnly accessToken cookie.",
  },
  servers: [{ url: "/api/v1", description: "API v1" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Recruiters" },
    { name: "Problems" },
    { name: "Assessments" },
    { name: "Invitations" },
    { name: "Attempts" },
    { name: "Submissions" },
    { name: "Payments" },
    { name: "Admin" },
  ],
  paths: {
    "/health": {
      get: operation("Check API health", ["Health"], false),
    },
    "/auth/register": {
      post: operation(
        "Register and request an email verification code",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/RegisterInput" }),
      ),
    },
    "/auth/verify-email": {
      post: operation(
        "Verify email using the OTP",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/VerifyEmailInput" }),
      ),
    },
    "/auth/resend-verification": {
      post: operation(
        "Resend email verification OTP",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/EmailInput" }),
      ),
    },
    "/auth/login": {
      post: operation(
        "Log in with email and password",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/LoginInput" }),
      ),
    },
    "/auth/google": {
      post: operation(
        "Authenticate with Google credential",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/GoogleInput" }),
      ),
    },
    "/auth/refresh": {
      post: operation(
        "Rotate refresh token",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/RefreshInput" }, false),
      ),
    },
    "/auth/refresh-token": {
      post: operation(
        "Rotate refresh token (alias)",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/RefreshInput" }, false),
      ),
    },
    "/auth/logout": {
      post: operation(
        "Revoke refresh token and clear cookies",
        ["Auth"],
        false,
        jsonBody({ $ref: "#/components/schemas/RefreshInput" }, false),
      ),
    },
    "/users/me": {
      get: operation("Get own safe user profile", ["Users"]),
      patch: operation(
        "Update own name",
        ["Users"],
        true,
        jsonBody({ $ref: "#/components/schemas/UpdateProfileInput" }),
      ),
    },
    "/users/me/password": {
      patch: operation(
        "Change password and revoke refresh tokens",
        ["Users"],
        true,
        jsonBody({ $ref: "#/components/schemas/ChangePasswordInput" }),
      ),
    },
    "/users/me/avatar": {
      patch: operation(
        "Upload profile avatar (multipart/form-data, avatar file, JPEG/PNG/WebP, max 5 MB)",
        ["Users"],
      ),
    },
    "/recruiters/me/profile": {
      get: operation("Get own recruiter profile", ["Recruiters"]),
      patch: operation(
        "Create or update company profile",
        ["Recruiters"],
        true,
        jsonBody({ $ref: "#/components/schemas/RecruiterProfileInput" }),
      ),
    },
    "/recruiters/me/profile/logo": {
      patch: operation(
        "Upload company logo (multipart/form-data, logo file, JPEG/PNG/WebP, max 5 MB)",
        ["Recruiters"],
      ),
    },
    "/auth-test/me": {
      get: operation("Return current authenticated identity", ["Auth"]),
    },
    "/problems": {
      get: {
        ...operation(
          "List owned problems with pagination, search, filter, and sort",
          ["Problems"],
        ),
        parameters: [
          ...paginationParams,
          queryParam("search", { type: "string" }, "Search titles/questions"),
          queryParam(
            "type",
            { type: "string", enum: ["MCQ", "WRITTEN"] },
            "Question type",
          ),
          ...sortParams(["createdAt", "updatedAt", "title", "points", "type"]),
        ],
      },
      post: operation(
        "Create MCQ or written problem",
        ["Problems"],
        true,
        jsonBody({ $ref: "#/components/schemas/ProblemInput" }),
      ),
    },
    "/problems/{id}": {
      get: {
        ...operation("Get owned problem including recruiter answer key", [
          "Problems",
        ]),
        parameters: [idParam("id", "Problem UUID")],
      },
      patch: {
        ...operation(
          "Update owned problem without changing assessment snapshots",
          ["Problems"],
          true,
          jsonBody({ $ref: "#/components/schemas/ProblemInput" }),
        ),
        parameters: [idParam("id", "Problem UUID")],
      },
      delete: {
        ...operation("Soft-delete owned problem", ["Problems"]),
        parameters: [idParam("id", "Problem UUID")],
      },
    },
    "/assessments": {
      get: {
        ...operation(
          "List owned assessments with pagination, search, status filter, and item counts",
          ["Assessments"],
        ),
        parameters: [
          ...paginationParams,
          queryParam("search", { type: "string" }, "Search title/description"),
          queryParam(
            "status",
            { type: "string", enum: ["DRAFT", "READY", "PUBLISHED", "CLOSED"] },
            "Assessment status",
          ),
          ...sortParams([
            "createdAt",
            "updatedAt",
            "title",
            "durationMinutes",
            "passingScore",
            "status",
          ]),
        ],
      },
      post: operation(
        "Create DRAFT assessment",
        ["Assessments"],
        true,
        jsonBody({ $ref: "#/components/schemas/AssessmentInput" }),
      ),
    },
    "/assessments/{assessmentId}": {
      get: {
        ...operation("Get owned assessment and immutable item snapshots", [
          "Assessments",
        ]),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
      patch: {
        ...operation(
          "Update assessment metadata; READY returns to DRAFT",
          ["Assessments"],
          true,
          jsonBody({ $ref: "#/components/schemas/AssessmentInput" }),
        ),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
      delete: {
        ...operation("Soft-delete editable assessment", ["Assessments"]),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/items": {
      post: {
        ...operation(
          "Add a same-recruiter problem snapshot at an unused order",
          ["Assessments"],
          true,
          jsonBody({ $ref: "#/components/schemas/AddItemInput" }),
        ),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/items/reorder": {
      patch: {
        ...operation(
          "Reorder every item transactionally",
          ["Assessments"],
          true,
          jsonBody({ $ref: "#/components/schemas/ReorderInput" }),
        ),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/items/{itemId}": {
      patch: {
        ...operation(
          "Update item order",
          ["Assessments"],
          true,
          jsonBody({ $ref: "#/components/schemas/ItemOrderInput" }),
        ),
        parameters: [
          idParam("assessmentId", "Assessment UUID"),
          idParam("itemId", "Assessment item UUID"),
        ],
      },
      delete: {
        ...operation("Remove item and normalize order", ["Assessments"]),
        parameters: [
          idParam("assessmentId", "Assessment UUID"),
          idParam("itemId", "Assessment item UUID"),
        ],
      },
    },
    "/assessments/{assessmentId}/ready": {
      post: {
        ...operation("Validate and transition DRAFT to READY", ["Assessments"]),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/payment": {
      post: {
        ...operation(
          "Create server-priced Stripe publishing checkout for READY assessment",
          ["Payments"],
        ),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/invitations": {
      get: {
        ...operation("List owned assessment invitations", ["Invitations"]),
        parameters: [
          idParam("assessmentId", "Assessment UUID"),
          ...paginationParams,
          queryParam(
            "search",
            { type: "string" },
            "Search candidate name/email",
          ),
          queryParam(
            "status",
            { type: "string", enum: ["PENDING", "ACCEPTED", "USED"] },
            "Invitation status",
          ),
          ...sortParams(["createdAt", "expiresAt", "status", "email"]),
        ],
      },
      post: {
        ...operation(
          "Invite an existing active verified candidate to a published assessment",
          ["Invitations"],
          true,
          jsonBody({ $ref: "#/components/schemas/InviteInput" }),
        ),
        parameters: [idParam("assessmentId", "Assessment UUID")],
      },
    },
    "/assessments/{assessmentId}/submissions": {
      get: {
        ...operation("List submissions for an owned assessment", [
          "Submissions",
        ]),
        parameters: [
          idParam("assessmentId", "Assessment UUID"),
          ...paginationParams,
          queryParam(
            "status",
            {
              type: "string",
              enum: ["PENDING", "AUTO_EVALUATED", "MANUALLY_EVALUATED"],
            },
            "Submission status",
          ),
        ],
      },
    },
    "/invitations/{id}": {
      get: {
        ...operation("Get invitation as invitee or owning recruiter", [
          "Invitations",
        ]),
        parameters: [idParam("id", "Invitation UUID")],
      },
      delete: {
        ...operation("Soft-delete pending invitation as owning recruiter", [
          "Invitations",
        ]),
        parameters: [idParam("id", "Invitation UUID")],
      },
    },
    "/invitations/{token}/accept": {
      post: {
        ...operation("Accept invitation as authenticated invitee", [
          "Invitations",
        ]),
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    },
    "/invitations/{token}/start": {
      post: {
        ...operation("Start one attempt from an accepted invitation", [
          "Attempts",
        ]),
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    },
    "/attempts/{id}": {
      get: {
        ...operation("Get own candidate-safe attempt without answer keys", [
          "Attempts",
        ]),
        parameters: [idParam("id", "Attempt UUID")],
      },
    },
    "/attempts/{id}/submit": {
      post: {
        ...operation(
          "Submit all assessment answers before server deadline",
          ["Attempts"],
          true,
          jsonBody({ $ref: "#/components/schemas/SubmitAnswersInput" }),
        ),
        parameters: [idParam("id", "Attempt UUID")],
      },
    },
    "/submissions/{submissionId}/evaluate": {
      patch: {
        ...operation(
          "Manually evaluate pending written submission",
          ["Submissions"],
          true,
          jsonBody({ $ref: "#/components/schemas/EvaluateInput" }),
        ),
        parameters: [idParam("submissionId", "Submission UUID")],
      },
    },
    "/payments/stripe/webhook": {
      post: {
        summary: "Verify Stripe webhook signature and process payment events",
        tags: ["Payments"],
        security: [],
        parameters: [
          {
            name: "Stripe-Signature",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description:
                  "Raw Stripe event body; signature verification is mandatory",
              },
            },
          },
        },
        responses: {
          "200": { description: "Verified event received" },
          "400": { description: "Invalid signature or event" },
        },
      },
    },
    "/admin/dashboard": {
      get: operation("Get aggregate platform summary", ["Admin"]),
    },
    "/admin/users": {
      get: {
        ...operation("List non-deleted users with filters and pagination", [
          "Admin",
        ]),
        parameters: [
          ...paginationParams,
          queryParam("search", { type: "string" }, "Search user name/email"),
          queryParam(
            "role",
            { type: "string", enum: ["CANDIDATE", "RECRUITER", "ADMIN"] },
            "User role",
          ),
          queryParam(
            "status",
            { type: "string", enum: ["ACTIVE", "BLOCKED", "SUSPENDED"] },
            "User status",
          ),
          ...sortParams(["createdAt", "name", "email", "role", "status"]),
        ],
      },
    },
    "/admin/users/{id}": {
      get: {
        ...operation("Get safe user details", ["Admin"]),
        parameters: [idParam("id", "User UUID")],
      },
    },
    "/admin/users/{id}/status": {
      patch: {
        ...operation(
          "Set user status to ACTIVE, BLOCKED, or SUSPENDED",
          ["Admin"],
          true,
          jsonBody({ $ref: "#/components/schemas/UpdateStatusInput" }),
        ),
        parameters: [idParam("id", "User UUID")],
      },
    },
    "/admin/audit-logs": {
      get: {
        ...operation(
          "List immutable audit events with filters and pagination",
          ["Admin"],
        ),
        parameters: [
          ...paginationParams,
          queryParam("actorId", uuid, "Actor user UUID"),
          queryParam("action", { type: "string" }, "Exact action filter"),
          queryParam("entity", { type: "string" }, "Exact entity filter"),
          queryParam("entityId", { type: "string" }, "Entity ID filter"),
          queryParam(
            "from",
            { type: "string", format: "date-time" },
            "Inclusive start date",
          ),
          queryParam(
            "to",
            { type: "string", format: "date-time" },
            "Inclusive end date",
          ),
          ...sortParams(["asc", "desc"]),
        ],
      },
    },
    "/admin/audit-logs/{id}": {
      get: {
        ...operation("Get an immutable audit event", ["Admin"]),
        parameters: [idParam("id", "Audit log UUID")],
      },
    },
    "/admin/recruiter-applications": {
      get: operation("List pending recruiter applications", ["Admin"]),
    },
    "/admin/recruiter-applications/{userId}/approve": {
      patch: {
        ...operation("Approve pending recruiter application", ["Admin"]),
        parameters: [idParam("userId", "Applicant user UUID")],
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken" },
    },
    schemas: {
      SuccessEnvelope: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { const: true },
          message: { type: "string" },
          data: {},
        },
      },
      ErrorEnvelope: {
        type: "object",
        required: ["success", "message", "errors"],
        properties: {
          success: { const: false },
          message: { type: "string" },
          errors: { type: "array", items: {} },
        },
      },
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
          role: { enum: ["CANDIDATE", "RECRUITER"] },
        },
      },
      VerifyEmailInput: {
        type: "object",
        required: ["email", "otp"],
        properties: {
          email: { type: "string", format: "email" },
          otp: { type: "string", pattern: "^[0-9]{6}$" },
        },
      },
      EmailInput: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      GoogleInput: {
        type: "object",
        properties: {
          credential: { type: "string" },
          idToken: { type: "string" },
        },
      },
      RefreshInput: {
        type: "object",
        properties: { refreshToken: { type: "string" } },
      },
      UpdateProfileInput: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 2, maxLength: 150 } },
        additionalProperties: false,
      },
      ChangePasswordInput: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string" },
          newPassword: { type: "string", minLength: 8, maxLength: 128 },
        },
        additionalProperties: false,
      },
      RecruiterProfileInput: {
        type: "object",
        properties: {
          companyName: { type: "string", maxLength: 200 },
          companyDescription: { type: "string", maxLength: 5000 },
          companyWebsite: { type: "string", format: "uri" },
        },
      },
      ProblemInput: {
        oneOf: [
          {
            type: "object",
            required: [
              "title",
              "question",
              "type",
              "options",
              "correctAnswer",
              "points",
            ],
            properties: {
              title: { type: "string", minLength: 3, maxLength: 255 },
              question: { type: "string", minLength: 1 },
              type: { const: "MCQ" },
              options: {
                type: "array",
                minItems: 2,
                maxItems: 10,
                items: { type: "string", minLength: 1 },
              },
              correctAnswer: {
                type: "string",
                description: "Must exactly match one option",
              },
              points: { type: "integer", minimum: 1, maximum: 1000 },
            },
            additionalProperties: false,
          },
          {
            type: "object",
            required: ["title", "question", "type", "expectedAnswer", "points"],
            properties: {
              title: { type: "string", minLength: 3, maxLength: 255 },
              question: { type: "string", minLength: 1 },
              type: { const: "WRITTEN" },
              expectedAnswer: {
                type: "string",
                minLength: 1,
                maxLength: 10000,
              },
              points: { type: "integer", minimum: 1, maximum: 1000 },
            },
            additionalProperties: false,
          },
        ],
      },
      AssessmentInput: {
        type: "object",
        required: ["title", "durationMinutes"],
        properties: {
          title: { type: "string", maxLength: 255 },
          description: { type: "string" },
          durationMinutes: { type: "integer", minimum: 1, maximum: 600 },
          passingScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            default: 0,
          },
        },
        additionalProperties: false,
      },
      AddItemInput: {
        type: "object",
        required: ["problemId", "order"],
        properties: { problemId: uuid, order: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
      ReorderInput: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["itemId", "order"],
              properties: {
                itemId: uuid,
                order: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
      ItemOrderInput: {
        type: "object",
        required: ["order"],
        properties: { order: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
      InviteInput: {
        type: "object",
        required: ["candidateId"],
        properties: { candidateId: uuid },
        additionalProperties: false,
      },
      SubmitAnswersInput: {
        type: "object",
        required: ["answers"],
        properties: {
          answers: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["assessmentItemId", "answer"],
              properties: {
                assessmentItemId: uuid,
                answer: { type: "string", maxLength: 50000 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      EvaluateInput: {
        type: "object",
        required: ["score"],
        properties: {
          score: { type: "integer", minimum: 0 },
          feedback: { type: "string", maxLength: 10000 },
        },
        additionalProperties: false,
      },
      UpdateStatusInput: {
        type: "object",
        required: ["status"],
        properties: { status: { enum: ["ACTIVE", "BLOCKED", "SUSPENDED"] } },
        additionalProperties: false,
      },
    },
  },
} as const;
