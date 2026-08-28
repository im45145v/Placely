# Placely – Project Specification

> "Campus placements, simplified."

---

## Overview

Placely is a university placement management platform that manages the complete placement lifecycle from student profile creation through to final placement.

**Initial deployment scale:**
- ~900 students
- Placement/admin staff
- ~2 companies/roles launched per day
- Up to ~500 users potentially opening the application within 5 minutes

---

## Non-Negotiable Architecture

Placely MUST be Appwrite-native.

### Required Technologies

| Layer | Technology |
|---|---|
| Frontend framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Backend-as-a-Service | Appwrite Cloud |
| Authentication | Appwrite Auth + Google OAuth |
| Database | Appwrite Databases |
| File storage | Appwrite Storage |
| Serverless functions | Appwrite Functions |
| Messaging | Appwrite Messaging (where appropriate) |
| Realtime | Appwrite Realtime (selective) |
| Source control | GitHub |

### Prohibited Technologies

- MongoDB / MongoDB Atlas
- PostgreSQL / MySQL
- Firebase / Supabase
- Auth0 / Clerk / NextAuth (unless required by Appwrite's official SSR integration)
- Express / FastAPI / Django
- Redis
- Heroku
- Any separate backend server or additional BaaS
- Any additional authentication provider

---

## Product Name and Branding

- **Product name:** Placely
- **Tagline:** "Campus placements, simplified."
- **Branding:** Modern, professional, and clean.

---

## User Types

| Role | Description |
|---|---|
| Student | University student going through placement |
| Placement Admin | Admin managing the placement process |
| Super Admin | Full platform administrator |

The architecture must be extensible to support Recruiter/Company users in the future without rewriting core logic.

---

## Core Student Features

Students must be able to:

- Sign in using Google
- View and edit their profile
- Maintain academic information
- Maintain professional/work-experience information
- Upload and replace resume
- View resume verification status
- Download their own resume
- View companies
- View roles and complete JDs
- See eligibility status
- Apply to eligible roles
- Withdraw applications (if allowed)
- Track application status and placement rounds
- View round schedules and results
- Receive notifications
- View placement history and analytics

---

## Student Profile Fields

### Personal
- Name, email, phone, date of birth, age, gender (if institutionally required)
- University, graduation year

### Academic
- 10th percentage
- 12th percentage
- Diploma (if applicable)
- UG degree, UG institution, UG branch/major, UG CGPA, graduation year
- Active backlogs, total backlogs
- Academic gaps

### Professional
- Previous work experience, total work experience
- Previous companies, previous job titles
- Internships, certifications, skills, projects

### Placement
- Placement status, number of offers, current offer, current offer CTC
- Placement history

> The profile system must not hardcode assumptions about any specific university's academic structure.

---

## Resume System

**Supported formats:** PDF and DOCX (where supported)

**Validation:** File type and size validation required.

**Versioning:** Support current resume with full version history.

**Resume States:**

| State | Description |
|---|---|
| `UNVERIFIED` | Uploaded but not yet reviewed |
| `PENDING` | Under admin review |
| `VERIFIED` | Approved by admin |
| `REJECTED` | Rejected with reason |

**Metadata:** verification status, rejection reason, verification timestamp, verified-by

**Security:** Private resumes must never be publicly accessible.

---

## Companies

A company is a separate entity from a role.

**Company fields:**
- Name, logo, website, industry, description
- Locations, company type
- Recruiter/contact information
- Participation history

One company may have multiple independent roles.

---

## Roles

**Role fields:**
- Company (reference), title, JD, JD attachment
- Location, work mode, employment type
- CTC, fixed compensation, variable compensation
- Joining date, experience requirement
- Number of openings, application deadline
- Selection process description
- Eligibility rules (reference)
- Required skills, required qualifications
- Status (draft, published, closed, etc.)

---

## Eligibility Engine

Eligibility MUST NOT be hardcoded.

A configurable rule engine must be created supporting:

- Numeric comparison (`>=`, `<=`, `==`, `!=`, `>`, `<`)
- Text comparison (`==`, `!=`, `IN`, `NOT_IN`)
- Boolean conditions
- Date conditions
- List/array conditions
- Logical operators: `AND`, `OR`, `NOT`
- Nested groups

**Example rule:**
```
CGPA >= 7
AND 10th >= 70
AND 12th >= 70
AND active_backlogs == 0
AND ug_branch IN [CSE, IT, ECE]
```

**Requirements:**
- Eligibility evaluated server-side
- Never trust eligibility values from the browser
- System must be extensible for future rules

---

## Variable System

A reusable variable system must be created.

### Built-in Variables

| Variable | Type |
|---|---|
| `cgpa` | number |
| `tenth_percentage` | number |
| `twelfth_percentage` | number |
| `age` | number |
| `work_experience_months` | number |
| `graduation_year` | number |
| `active_backlogs` | number |
| `total_backlogs` | number |
| `ug_branch` | string |
| `ug_institution` | string |
| `gender` | string |
| `internship_count` | number |
| `previous_ctc` | number |
| `current_offer_ctc` | number |
| `number_of_offers` | number |

### Custom Variables

Admins may create custom variables supporting types:
- `string`, `number`, `boolean`, `date`, `single_select`, `multi_select`

Eligibility rules and analytics must be able to reference these variables.

---

## Applications

**Application States:**

| State |
|---|
| `APPLIED` |
| `SHORTLISTED` |
| `REJECTED` |
| `IN_ROUND` |
| `SELECTED` |
| `OFFERED` |
| `ACCEPTED` |
| `DECLINED` |
| `WITHDRAWN` |

**Requirements:**
- Students can apply only when permitted
- Application lifecycle is configurable
- Duplicate applications must be prevented
- Application creation validated server-side
- Do not assume every company uses the same round sequence

---

## Shortlisting

Admin shortlisting capabilities:
- Manual shortlist (individual)
- Bulk shortlist
- Automatic shortlist using criteria
- CSV/Excel import
- Bulk reject
- Bulk move to next round

All important administrative changes must be audited.

---

## Placement Rounds

Rounds are fully configurable per role.

**Example round sequence:**
```
Application → Resume Shortlist → Online Assessment →
Technical Interview → Managerial Interview → HR Interview → Selected
```

**Round fields:**
- Name, type, description, instructions
- Start time, end time, location, meeting link
- Capacity, participants, evaluators
- Score, pass/fail, notes, attachments
- Results, status

Rounds must support continuous status updates.

---

## Notifications

**Supported channels:**
- In-app notifications
- Email notifications
- Optional future push notifications

**Notification triggers (examples):**
- New company published
- Eligible role available
- Application submitted
- Shortlisted
- Round scheduled / rescheduled
- Result published
- Deadline approaching
- Application deadline reached

**Templates with variables:**
```
"Congratulations {{student_name}}. You have been shortlisted for {{company_name}} - {{role_name}}."
```

Duplicate notifications must be avoided.

---

## Admin Panel

Admin dashboard sections:

| Section |
|---|
| Dashboard |
| Companies |
| Roles |
| Students |
| Applications |
| Shortlists |
| Rounds |
| Results |
| Announcements |
| Notifications |
| Analytics |
| Variables |
| Eligibility Rules |
| Documents |
| Audit Logs |
| Settings |

Bulk operations must be supported wherever practical.

---

## Admin Analytics

**Metrics:**
- Total students, active students
- Companies, roles
- Applications, shortlisted students, selected students
- Offers, placement rate
- Company-wise and role-wise selection
- Branch-wise placement
- CGPA distribution
- Work-experience distribution
- Age distribution
- UG background
- Previous work experience
- Offer distribution
- Applications per company
- Application and round conversion rates

**Filters:**
- Company, role, branch, graduation year
- CGPA, work experience, age
- Placement status
- Custom variables

---

## Placement Rules

Placement rules are separate from eligibility rules.

| Concern | Question Answered |
|---|---|
| Eligibility | "Can this student apply?" |
| Placement rules | "What is this student allowed to do?" |

**Examples:**
- Maximum number of applications
- Maximum applications per company
- Maximum active applications at once
- Offer-based restrictions
- Salary-based restrictions
- Students who are selected cannot apply further (configurable)
- Round-specific restrictions

Admins must be able to configure all placement rules.

---

## Import / Export

### Import
- Student data
- Company data
- Role data
- Shortlist data
- Results
- Interview schedules

### Export
- Students
- Applications
- Shortlists
- Round results
- Placement statistics

Format: CSV and Excel support.

---

## Audit Logging

All important administrative actions must be logged.

**Each audit entry captures:**
- Actor (user ID, role)
- Action type
- Entity type and entity ID
- Previous value (where applicable)
- New value (where applicable)
- Timestamp

**Examples:**
- Company published
- Eligibility changed
- Student shortlisted
- Application status changed
- Student restriction overridden
- Result changed
- Admin permission changed

---

## Security Requirements

Security is a hard requirement. The following rules are non-negotiable:

- Never trust client input
- Never trust client-side roles
- Never trust client-supplied eligibility
- Never trust client-supplied `universityId`
- Never trust client-supplied ownership
- Use Appwrite permissions for all access control
- Sensitive data must use row-level and file-level access control
- Students must not access other students' private information
- Students must not access private resumes or documents belonging to others
- Students must not perform admin actions
- Admin authorization must be enforced server-side
- Never expose Appwrite server API keys to the browser
- Never put secrets in `NEXT_PUBLIC_*` environment variables
- Never commit secrets to GitHub
- Use least-privilege API keys

---

## Performance Requirements

**Expected workload:**
- ~900 students
- ~2 companies/roles per day
- ~500 users potentially opening within 5 minutes

**Avoid:**
- N+1 queries
- Fetching entire collections
- Unnecessary realtime connections
- Unnecessary Function executions
- Huge client-side payloads

**Use:**
- Pagination
- Database indexes
- Efficient queries
- Server-side operations
- Caching where appropriate
- Selective realtime subscriptions

---

## Realtime Guidelines

Do NOT create realtime subscriptions for everything.

Use realtime only for meaningful live updates:
- Application status changes
- Round updates
- Schedule changes
- Admin announcements (where appropriate)

Normal pages must use standard database reads.

---

## Multi-University Future

Initial deployment is single-university.

Design data models with `universityId` on appropriate entities so a second university could be added later without rewriting the schema.

Do not over-engineer. Do not create separate databases per university.

---

## Code Quality Requirements

- TypeScript with strict typing throughout
- Reusable components
- Feature-based architecture
- Validation at every boundary
- Clear error handling
- Loading states and empty states
- Responsive UI
- Accessible components (WCAG guidance)
- Appwrite-specific code centralized in `src/lib/appwrite/`

---

## Development Rule

DO NOT build the entire application in one step.

Work phase by phase. After each phase:

1. Run the application
2. Run TypeScript checks
3. Run linting
4. Run tests where applicable
5. Fix all errors
6. Review security implications
7. Update documentation
8. Only then proceed to the next phase

If an Appwrite API or SDK behavior is uncertain, consult the current official Appwrite documentation before implementing it.

Do not invent APIs. Do not silently change the architecture. Do not add unnecessary dependencies.
