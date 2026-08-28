# Placely – Architecture Document

> "Campus placements, simplified."

---

## 1. Folder Structure

```
placely/
├── src/
│   ├── app/                          # Next.js App Router pages and layouts
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (student)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── resume/
│   │   │   ├── companies/
│   │   │   ├── roles/
│   │   │   ├── applications/
│   │   │   ├── rounds/
│   │   │   └── notifications/
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── companies/
│   │   │   ├── roles/
│   │   │   ├── students/
│   │   │   ├── applications/
│   │   │   ├── shortlists/
│   │   │   ├── rounds/
│   │   │   ├── results/
│   │   │   ├── announcements/
│   │   │   ├── notifications/
│   │   │   ├── analytics/
│   │   │   ├── variables/
│   │   │   ├── eligibility/
│   │   │   ├── documents/
│   │   │   ├── audit-logs/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...appwrite]/
│   │   │           └── route.ts     # Appwrite SSR auth callback handler
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Primitive components (Button, Input, etc.)
│   │   ├── layout/                   # Header, Sidebar, Footer, PageWrapper
│   │   ├── forms/                    # Reusable form primitives
│   │   ├── data-display/             # Tables, Cards, Stats
│   │   └── feedback/                 # Toasts, Alerts, Loading, Empty states
│   │
│   ├── features/                     # Feature-based modules
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── resume/
│   │   ├── companies/
│   │   ├── roles/
│   │   ├── eligibility/
│   │   ├── applications/
│   │   ├── shortlisting/
│   │   ├── rounds/
│   │   ├── results/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── variables/
│   │   ├── placement-rules/
│   │   ├── audit/
│   │   └── import-export/
│   │
│   ├── lib/
│   │   ├── appwrite/
│   │   │   ├── client.ts             # Browser-side Appwrite client (public key only)
│   │   │   ├── server.ts             # Server-side Appwrite client (server key, never exposed)
│   │   │   ├── auth.ts               # Auth helpers
│   │   │   ├── databases.ts          # Database helpers
│   │   │   ├── storage.ts            # Storage helpers
│   │   │   ├── functions.ts          # Function invocation helpers
│   │   │   └── constants.ts          # Collection IDs, bucket IDs, database ID, etc.
│   │   ├── auth/
│   │   │   ├── session.ts            # Session retrieval and validation
│   │   │   └── guards.ts             # Route guard utilities
│   │   ├── permissions/
│   │   │   └── index.ts              # Permission string builders
│   │   └── validation/
│   │       └── index.ts              # Zod schemas and validators
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useCurrentUser.ts
│   │   ├── useRealtime.ts
│   │   └── ...
│   │
│   ├── types/                        # TypeScript types and interfaces
│   │   ├── appwrite.ts               # Appwrite document types
│   │   ├── student.ts
│   │   ├── company.ts
│   │   ├── role.ts
│   │   ├── application.ts
│   │   ├── round.ts
│   │   ├── eligibility.ts
│   │   ├── notification.ts
│   │   └── ...
│   │
│   └── utils/                        # Pure utility functions
│       ├── date.ts
│       ├── format.ts
│       ├── eligibility-engine.ts     # Rule evaluation logic (also used server-side)
│       └── ...
│
├── functions/                        # Appwrite Functions (server-side logic)
│   ├── evaluate-eligibility/
│   ├── create-application/
│   ├── shortlist-students/
│   ├── send-notification/
│   ├── import-students/
│   ├── generate-export/
│   └── audit-logger/
│
├── public/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── ARCHITECTURE.md
├── PROJECT_SPEC.md
└── README.md
```

---

## 2. Appwrite Resource Structure

### Databases

| Resource | ID | Purpose |
|---|---|---|
| Database | `placely-db` | Single database for the entire platform |

### Collections

| Collection | ID | Description |
|---|---|---|
| Universities | `universities` | University metadata |
| Users | `users` | Extended user profiles (mirroring Appwrite Auth users) |
| StudentProfiles | `student_profiles` | Student academic and placement data |
| Companies | `companies` | Company records |
| Roles | `roles` | Job roles linked to companies |
| EligibilityRules | `eligibility_rules` | Configurable rule sets per role |
| Variables | `variables` | Built-in and custom variable definitions |
| Applications | `applications` | Student applications per role |
| PlacementRounds | `placement_rounds` | Rounds for a given role |
| RoundParticipants | `round_participants` | Students assigned to a round |
| Results | `results` | Round/final results per student |
| Resumes | `resumes` | Resume metadata (file stored in Storage) |
| Notifications | `notifications` | Per-user notification records |
| NotificationTemplates | `notification_templates` | Reusable notification templates |
| Announcements | `announcements` | Platform-wide or cohort-wide announcements |
| AuditLogs | `audit_logs` | Immutable audit trail |
| PlacementRules | `placement_rules` | Configurable placement restriction rules |
| Offers | `offers` | Offer records linked to applications |
| Settings | `settings` | Per-university or global configuration |

### Storage Buckets

| Bucket | ID | Access | Description |
|---|---|---|---|
| Resumes | `resumes` | Private (per-user) | Student resume files |
| CompanyLogos | `company_logos` | Public read | Company logo images |
| JDAttachments | `jd_attachments` | Admin write, authenticated read | JD PDF attachments |
| ImportFiles | `import_files` | Admin only | Temporary bulk import files |

---

## 3. Database Entities and Relationships

### University
```
id
name
domain (email domain for auto-assignment)
logoUrl
isActive
createdAt
```

### User (extends Appwrite Auth user)
```
id (= Appwrite Auth user ID)
universityId         ← set server-side, never trusted from client
role: 'student' | 'placement_admin' | 'super_admin'
isActive
createdAt
updatedAt
```

### StudentProfile
```
id
userId               ← FK → User
universityId         ← set server-side
personalInfo: {
  phone, dateOfBirth, gender
}
academic: {
  tenthPercentage, twelfthPercentage
  diplomaPercentage?, ugDegree, ugInstitution
  ugBranch, ugCgpa, graduationYear
  activeBacklogs, totalBacklogs, academicGaps
}
professional: {
  previousCompanies[], previousTitles[]
  totalWorkExperienceMonths, internships[]
  certifications[], skills[], projects[]
}
placement: {
  status: 'not_placed' | 'placed' | 'opted_out'
  numberOfOffers, currentOfferId?
  currentOfferCtc?, placementHistory[]
}
customFields: Record<string, unknown>  ← for custom variables
isProfileComplete
createdAt
updatedAt
```

### Company
```
id
universityId
name, logo, website, industry
description, locations[], companyType
contactInfo: { name, email, phone }
participationHistory[]
isActive
createdAt
updatedAt
```

### Role
```
id
companyId            ← FK → Company
universityId
title, jdText, jdAttachmentId?
location, workMode, employmentType
ctc, fixedCtc, variableCtc
joiningDate, experienceRequirementMonths
numberOfOpenings, applicationDeadline
selectionProcessDescription
eligibilityRuleSetId ← FK → EligibilityRules
requiredSkills[], requiredQualifications[]
status: 'draft' | 'published' | 'closed' | 'cancelled'
createdAt
updatedAt
```

### EligibilityRules
```
id
universityId
roleId               ← FK → Role (nullable for reusable rule sets)
name, description
ruleTree: RuleNode   ← JSON - nested rule AST
createdBy
createdAt
updatedAt
```

**RuleNode (recursive JSON type):**
```typescript
type RuleNode =
  | { type: 'condition'; variable: string; operator: string; value: unknown }
  | { type: 'group'; logic: 'AND' | 'OR' | 'NOT'; children: RuleNode[] }
```

### Variable
```
id
universityId
name (slug, e.g. 'cgpa')
label (e.g. 'UG CGPA')
type: 'string' | 'number' | 'boolean' | 'date' | 'single_select' | 'multi_select'
options?: string[]   ← for select types
isBuiltIn: boolean
description
createdAt
updatedAt
```

### Application
```
id
studentId            ← FK → StudentProfile
roleId               ← FK → Role
companyId            ← denormalized for query efficiency
universityId
status: ApplicationStatus
currentRoundId?      ← FK → PlacementRound
appliedAt
withdrawnAt?
lastStatusChangedAt
notes
createdAt
updatedAt
```

### PlacementRound
```
id
roleId               ← FK → Role
universityId
name, type, description, instructions
startTime, endTime
location?, meetingLink?
capacity?
evaluators[]
status: 'scheduled' | 'active' | 'completed' | 'cancelled'
sequence (sort order)
createdAt
updatedAt
```

### RoundParticipant
```
id
roundId              ← FK → PlacementRound
applicationId        ← FK → Application
studentId
score?
passed?
notes
resultPublished
createdAt
updatedAt
```

### Resume
```
id
studentId            ← FK → StudentProfile
universityId
fileId               ← Appwrite Storage file ID
fileName, fileSize, mimeType
version (integer)
isCurrent
status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
rejectionReason?
verifiedBy?
verifiedAt?
uploadedAt
```

### Notification
```
id
userId               ← FK → User
universityId
type (e.g. 'role_published', 'shortlisted', etc.)
title, body
data: Record<string, unknown>  ← contextual metadata
isRead
readAt?
createdAt
```

### NotificationTemplate
```
id
universityId
type
titleTemplate, bodyTemplate   ← handlebars-style {{variable}} templates
channel: 'in_app' | 'email' | 'push'
isActive
createdAt
updatedAt
```

### Announcement
```
id
universityId
title, body
targetAudience: 'all' | 'students' | 'admins'
isPinned
publishedAt?
expiresAt?
createdBy
createdAt
updatedAt
```

### AuditLog
```
id
universityId
actorId, actorRole
action (e.g. 'COMPANY_PUBLISHED', 'APPLICATION_STATUS_CHANGED')
entityType, entityId
previousValue?       ← JSON snapshot
newValue?            ← JSON snapshot
ipAddress?
userAgent?
timestamp
```

### PlacementRule
```
id
universityId
name, description
ruleType: 'max_applications' | 'max_per_company' | 'offer_restriction' | 'salary_restriction' | 'custom'
config: Record<string, unknown>  ← rule-specific configuration
isActive
createdAt
updatedAt
```

### Offer
```
id
applicationId        ← FK → Application
studentId
roleId
companyId
universityId
ctc, fixedCtc, variableCtc
joiningDate
letterFileId?        ← Appwrite Storage file ID
status: 'extended' | 'accepted' | 'declined' | 'revoked'
expiresAt?
createdAt
updatedAt
```

---

## 4. Permission Model

Appwrite document-level and collection-level permissions are used throughout.

### Permission Principles

1. **Never trust the client.** All sensitive operations go through Appwrite Functions using server-side API keys.
2. **Least privilege.** Roles receive only the minimum permissions required.
3. **Row-level security.** Documents include ownership references that are enforced server-side.

### Collection Permissions Matrix

| Collection | Student Read | Student Write | Admin Read | Admin Write | Notes |
|---|---|---|---|---|---|
| `universities` | ✅ own | ❌ | ✅ | ✅ | |
| `users` | ✅ own | ✅ own limited | ✅ | ✅ | |
| `student_profiles` | ✅ own | ✅ own | ✅ | ✅ (limited) | |
| `companies` | ✅ | ❌ | ✅ | ✅ | |
| `roles` | ✅ published | ❌ | ✅ | ✅ | |
| `eligibility_rules` | ❌ | ❌ | ✅ | ✅ | Evaluated server-side only |
| `variables` | ❌ | ❌ | ✅ | ✅ | |
| `applications` | ✅ own | ✅ own (create/withdraw) | ✅ | ✅ | Write-guarded by Function |
| `placement_rounds` | ✅ enrolled | ❌ | ✅ | ✅ | |
| `round_participants` | ✅ own | ❌ | ✅ | ✅ | |
| `results` | ✅ own (after publish) | ❌ | ✅ | ✅ | |
| `resumes` | ✅ own | ✅ own (upload) | ✅ | ✅ | Bucket: private |
| `notifications` | ✅ own | ✅ own (mark read) | ✅ | ✅ | |
| `notification_templates` | ❌ | ❌ | ✅ | ✅ | |
| `announcements` | ✅ published | ❌ | ✅ | ✅ | |
| `audit_logs` | ❌ | ❌ | ✅ | ❌ (append-only via Function) | |
| `placement_rules` | ❌ | ❌ | ✅ | ✅ | Enforced server-side |
| `offers` | ✅ own | ✅ own (accept/decline) | ✅ | ✅ | |

### Appwrite Permission Strings

```typescript
// Example: Student can only read their own document
permissions: [
  Permission.read(Role.user(studentUserId)),
  Permission.write(Role.user(studentUserId)),
  Permission.read(Role.label('admin')),
  Permission.write(Role.label('admin')),
]
```

Admin users receive the `admin` Appwrite label upon promotion.

---

## 5. Authentication Flow

```
1. User visits Placely
2. Redirect to /login
3. User clicks "Sign in with Google"
4. Appwrite Auth OAuth2 flow starts → redirects to Google
5. Google authenticates the user
6. Appwrite Auth callback:
   a. Appwrite creates/updates the Auth user
   b. Next.js API route /api/auth/[...appwrite]/route.ts handles the callback
   c. Server-side Appwrite session is established using official Appwrite SSR helpers
7. Post-auth server action runs:
   a. Check if a User record exists in the `users` collection
   b. If new user:
      - Determine role (default: 'student')
      - Assign universityId based on email domain or institution config
      - Create User document (role, universityId set server-side)
      - Create empty StudentProfile
   c. If existing user: validate session
8. Redirect to appropriate dashboard based on role
```

### Session Management

- Sessions use Appwrite's server-side session cookies (SSR mode).
- Server Components use server-side Appwrite client with session cookies.
- Client Components use the browser Appwrite client (public endpoint key only).
- Server API key is never sent to the browser.

### Route Protection

- `(student)` layout validates session and `role === 'student'` server-side.
- `(admin)` layout validates session and `role` is `placement_admin` or `super_admin` server-side.
- Middleware (`middleware.ts`) performs early redirect for unauthenticated users.

---

## 6. Function Architecture

All sensitive operations are performed via Appwrite Functions using server-side API keys.

| Function | Trigger | Responsibility |
|---|---|---|
| `evaluate-eligibility` | HTTP (invoked from server action) | Evaluate a student's eligibility for a role using the rule engine |
| `create-application` | HTTP | Validate eligibility + placement rules, prevent duplicates, create application atomically |
| `withdraw-application` | HTTP | Validate withdrawal is permitted, update application status |
| `shortlist-students` | HTTP | Bulk or automatic shortlisting with audit logging |
| `advance-round` | HTTP | Move students to next round, update statuses |
| `send-notification` | HTTP / Event (database trigger) | Resolve template, deduplicate, send in-app + email |
| `import-data` | HTTP | Process uploaded CSV/Excel, validate, and bulk-insert records |
| `generate-export` | HTTP | Generate CSV/Excel exports for admin download |
| `audit-logger` | HTTP (called from other functions) | Append-only audit log creation |
| `verify-resume` | HTTP | Admin resumes verification action |
| `publish-announcement` | HTTP | Create announcement, trigger notifications |

### Function Design Rules

- Functions use the Appwrite Node.js runtime.
- Functions use server-side API keys stored as Appwrite Function environment variables.
- Functions never receive or trust client-supplied role, universityId, or eligibility values.
- Functions re-fetch the calling user's profile from the database to verify identity and role.
- Functions return structured `{ success, data, error }` responses.

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────┐
│            Vercel (or similar)          │
│                                         │
│  Next.js App (App Router)               │
│  ├── Server Components (read data)      │
│  ├── Server Actions (mutations)         │
│  └── API Routes (auth callbacks)        │
└───────────────────┬─────────────────────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────┐
│            Appwrite Cloud               │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │  Auth   │  │Databases │  │Storage │ │
│  └─────────┘  └──────────┘  └────────┘ │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Functions   │  │   Messaging     │  │
│  └──────────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────────┐│
│  │           Realtime (selective)      ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Environment Variables

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Browser + Server | Public Appwrite endpoint |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Browser + Server | Public project ID |
| `APPWRITE_API_KEY` | Server only (never `NEXT_PUBLIC_`) | Server API key |
| `APPWRITE_DATABASE_ID` | Server only | Database ID |
| `NEXT_PUBLIC_APP_URL` | Browser + Server | Canonical app URL |

Secrets (`APPWRITE_API_KEY`) are stored in:
- Vercel environment variables (production)
- `.env.local` (local development, gitignored)
- Appwrite Function environment variables (for functions)

`.env.local` is always in `.gitignore`. A `.env.local.example` with placeholder values is committed to the repository.

---

## 8. Realtime Strategy

Realtime subscriptions are used selectively. The following events warrant realtime:

| Event | Subscription | Consumers |
|---|---|---|
| Application status change | `databases.*.collections.applications.documents.*` | Student: application tracker page |
| Round status update | `databases.*.collections.placement_rounds.documents.*` | Student: round detail page |
| New notification | `databases.*.collections.notifications.documents.*` | Global notification bell |
| Announcement published | `databases.*.collections.announcements.documents.*` | Global announcement bar |

All other data is fetched via standard SSR or client-side queries with appropriate pagination.

---

## 9. Eligibility Engine Design

The rule engine operates on a JSON-serialized abstract syntax tree (AST).

### RuleNode Type

```typescript
type ConditionNode = {
  type: 'condition';
  variable: string;        // e.g. 'cgpa', 'ug_branch'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: string | number | boolean | string[];
};

type GroupNode = {
  type: 'group';
  logic: 'AND' | 'OR' | 'NOT';
  children: RuleNode[];
};

type RuleNode = ConditionNode | GroupNode;
```

### Evaluation

```typescript
function evaluateRule(node: RuleNode, context: Record<string, unknown>): boolean {
  if (node.type === 'condition') {
    return evaluateCondition(node, context[node.variable]);
  }
  if (node.logic === 'AND') return node.children.every(c => evaluateRule(c, context));
  if (node.logic === 'OR') return node.children.some(c => evaluateRule(c, context));
  if (node.logic === 'NOT') return !evaluateRule(node.children[0], context);
  return false;
}
```

The `context` object is built server-side from the student's profile data. It is never provided by the client.

---

## 10. Index Strategy (Appwrite Attributes)

Key indexes to define per collection:

| Collection | Index |
|---|---|
| `applications` | `studentId`, `roleId`, `status`, `companyId+studentId` |
| `student_profiles` | `userId`, `universityId`, `placement.status` |
| `roles` | `companyId`, `status`, `universityId`, `applicationDeadline` |
| `companies` | `universityId`, `isActive` |
| `notifications` | `userId`, `isRead`, `createdAt` |
| `audit_logs` | `universityId`, `entityId`, `actorId`, `timestamp` |
| `round_participants` | `roundId`, `studentId`, `applicationId` |
| `resumes` | `studentId`, `isCurrent`, `status` |

---

## 11. Multi-University Design Notes

- All entities except `universities` carry a `universityId` field.
- `universityId` is always set server-side; client cannot supply or override it.
- A student's `universityId` is established at account creation based on email domain mapping or admin assignment.
- Admin users are scoped to their `universityId`; Super Admins can operate across universities.
- Queries always filter by `universityId` to ensure data isolation.
- No separate databases per university.

---

## 12. Phase Plan

### Phase 1 – Foundation
- Project scaffolding (Next.js, TypeScript, Tailwind, Appwrite SDK)
- Appwrite project configuration (collections, buckets, functions)
- Authentication (Google OAuth, session management, role assignment)
- Middleware and route guards
- Base layout components

### Phase 2 – Student Profile
- Profile creation and editing
- Academic and professional information
- Resume upload, versioning, status display

### Phase 3 – Companies and Roles
- Company listing and detail views
- Role listing, detail, and JD views
- Admin CRUD for companies and roles

### Phase 4 – Eligibility Engine
- Variable system
- Rule builder UI
- Server-side evaluation function
- Eligibility display for students

### Phase 5 – Applications
- Application creation (server-side validated)
- Application lifecycle and status tracking
- Placement rules enforcement
- Withdrawal

### Phase 6 – Rounds and Results
- Round configuration
- Participant assignment
- Result recording and publication
- Student round view

### Phase 7 – Shortlisting and Bulk Operations
- Manual and bulk shortlisting
- CSV import
- Bulk status changes

### Phase 8 – Notifications
- In-app notifications
- Email notifications via Appwrite Messaging
- Notification templates

### Phase 9 – Admin Analytics and Export
- Analytics dashboard
- Filtered views
- CSV/Excel export

### Phase 10 – Audit Logs and Compliance
- Audit log recording
- Audit log viewer (admin)

### Phase 11 – Polish and Performance
- Pagination review
- Index tuning
- Realtime review
- Accessibility pass
- Security review
- Documentation finalization
