# Placely Security Audit

Date: 2026-09-01

## Scope

Reviewed the full Placely codebase in `/Users/im45145v/Projects/Placely` with focus on:

- authentication and session handling
- authorization and role separation
- Appwrite collection and function trust boundaries
- student, resume, application, and admin data exposure
- secret handling and error leakage
- input validation and business logic around applications and bulk workflows
- file access and storage-mediated downloads

## Method

- Static review of all server auth, route handlers, services, Appwrite functions, env handling, and provisioning code.
- Regression tests added for new security-critical helpers.
- Live Appwrite read/write verification performed with the configured local credentials where scopes allowed it.

## Actor Matrix

The authorization matrix for `anonymous`, `student A`, `student B`, `placement admin`, and `super admin` is covered in code by:

- [src/lib/student-profile/rules.test.mjs](/Users/im45145v/Projects/Placely/src/lib/student-profile/rules.test.mjs)
- [src/lib/auth/access.test.mjs](/Users/im45145v/Projects/Placely/src/lib/auth/access.test.mjs)

Live backend verification was possible for collection security state, but not for bucket and function configuration because the configured Appwrite key lacks `buckets.read` and `functions.read`.

## Findings

### 1. OAuth callback accepted unbound login responses

- Severity: High
- Area: Authentication / OAuth configuration
- Vulnerability: The Google OAuth initiation flow did not bind the callback to a server-generated state value. A victim could be forced through a forged callback URL containing another user’s valid `userId` and `secret`, causing login CSRF / session swapping.
- Impact: A user could be silently signed into the attacker’s account, exposing student data, resumes, application status, and admin access if the attacker controlled an admin account.
- Fix:
  - Added an httpOnly OAuth state cookie with a 10-minute lifetime.
  - Added callback state validation and state-cookie clearing on both success and failure.
- Code:
  - [src/features/auth/actions.ts](/Users/im45145v/Projects/Placely/src/features/auth/actions.ts)
  - [src/app/api/auth/callback/route.ts](/Users/im45145v/Projects/Placely/src/app/api/auth/callback/route.ts)
  - [src/lib/auth/cookies.ts](/Users/im45145v/Projects/Placely/src/lib/auth/cookies.ts)
  - [src/lib/auth/oauth-state.js](/Users/im45145v/Projects/Placely/src/lib/auth/oauth-state.js)
- Regression test:
  - [src/lib/auth/oauth-state.test.mjs](/Users/im45145v/Projects/Placely/src/lib/auth/oauth-state.test.mjs)

### 2. Authenticated requests failed open when app user records were missing or unreadable

- Severity: High
- Area: Authentication / Authorization
- Vulnerability: `syncUserRecord()` could synthesize a student user when the `users` document read or create path failed, and `requireAuthenticatedAppUser()` called that logic on ordinary requests. That turned database/provisioning failures into implicit access decisions.
- Impact: Authorization could drift from the server-trusted `users` collection. A missing or unreadable record could be treated as a valid active student account instead of failing closed.
- Fix:
  - Removed synthesized-user fallback from `syncUserRecord()`.
  - Changed protected request resolution to require an existing provisioned `users` record.
  - Added explicit fail-closed redirect reasons for missing and inactive users.
- Code:
  - [src/lib/auth/userSync.ts](/Users/im45145v/Projects/Placely/src/lib/auth/userSync.ts)
  - [src/lib/auth/guards.ts](/Users/im45145v/Projects/Placely/src/lib/auth/guards.ts)
  - [src/lib/auth/access.js](/Users/im45145v/Projects/Placely/src/lib/auth/access.js)
- Regression test:
  - [src/lib/auth/access.test.mjs](/Users/im45145v/Projects/Placely/src/lib/auth/access.test.mjs)

### 3. Privileged Appwrite functions trusted unsigned JSON payloads

- Severity: High
- Area: Function security / Business logic
- Vulnerability: `shortlisting-orchestrator` and `notification-dispatcher` accepted raw JSON inputs with no shared-secret signature, freshness check, or payload-to-operation binding.
- Impact:
  - Unauthorized shortlist, reject, move-to-round, or notification execution if a function became invokable outside the intended server path.
  - Replay of stale executions.
  - Tampering with notification recipients or university scope.
- Fix:
  - Added HMAC signing for Appwrite function payloads.
  - Added timestamp freshness checks and constant-time signature comparison.
  - Bound bulk execution payloads to the queued operation’s `actorId` and `universityId`.
  - Updated the reminder function to sign its downstream notification calls.
  - Added `APPWRITE_FUNCTION_SHARED_SECRET`.
- Code:
  - [src/lib/security/function-signing.js](/Users/im45145v/Projects/Placely/src/lib/security/function-signing.js)
  - [src/lib/applications/service.ts](/Users/im45145v/Projects/Placely/src/lib/applications/service.ts)
  - [src/lib/notifications/service.ts](/Users/im45145v/Projects/Placely/src/lib/notifications/service.ts)
  - [functions/shortlisting-orchestrator/src/main.js](/Users/im45145v/Projects/Placely/functions/shortlisting-orchestrator/src/main.js)
  - [functions/notification-dispatcher/src/main.js](/Users/im45145v/Projects/Placely/functions/notification-dispatcher/src/main.js)
  - [functions/deadline-reminders/src/main.js](/Users/im45145v/Projects/Placely/functions/deadline-reminders/src/main.js)
  - [.env.example](/Users/im45145v/Projects/Placely/.env.example)
- Regression test:
  - [src/lib/security/function-signing.test.mjs](/Users/im45145v/Projects/Placely/src/lib/security/function-signing.test.mjs)

### 4. Unexpected backend errors were returned directly to users

- Severity: Medium
- Area: Data security / Secrets / Logs
- Vulnerability: `toUserMessage()` returned raw `Error.message` for non-`AppError` exceptions.
- Impact: Backend internals such as database hostnames, Appwrite object IDs, missing scope names, or infrastructure details could be disclosed through API responses.
- Fix:
  - Restricted user-facing messages to explicit `AppError` messages only.
  - All other exceptions now return a generic message.
- Code:
  - [src/lib/errors.ts](/Users/im45145v/Projects/Placely/src/lib/errors.ts)
  - [src/lib/errors-user-message.js](/Users/im45145v/Projects/Placely/src/lib/errors-user-message.js)
- Regression test:
  - [src/lib/errors.test.mjs](/Users/im45145v/Projects/Placely/src/lib/errors.test.mjs)

### 5. Provisioning allowed insecure collection defaults

- Severity: Medium
- Area: Authorization / Appwrite permissions / Row-level security
- Vulnerability: The provisioning script created collections without explicitly forcing document-level security, relying on external defaults.
- Impact: A new environment could come up without row-level enforcement at the collection layer, weakening Appwrite-side isolation if permissions were later broadened.
- Fix:
  - Updated provisioning to enforce empty collection permissions plus `documentSecurity: true`.
  - Applied a live targeted correction to the configured Appwrite project.
- Code:
  - [scripts/provision-appwrite.mjs](/Users/im45145v/Projects/Placely/scripts/provision-appwrite.mjs)
- Live verification:
  - On 2026-09-01, the configured Appwrite project collections were read back and confirmed with `documentSecurity: true` for `users`, `student_profiles`, `resumes`, `companies`, `roles`, `applications`, `notifications`, `document_metadata`, `audit_logs`, and the other provisioned collections.

## Live Appwrite Verification Notes

- Verified on 2026-09-01 that all visible collections in the configured Appwrite database now report:
  - `documentSecurity: true`
  - empty collection permissions
  - `enabled: true`
- The configured API key could not read bucket or function configuration because Appwrite returned:
  - missing scope `buckets.read`
  - missing scope `functions.read`
- The configured API key also could not run the full provisioning path because it lacks `buckets.write`.

## Additional Review Outcomes

- Duplicate application protection is present through deterministic application IDs and a unique `(studentId, roleId)` index path in the schema.
- Student-vs-student application and resume access is server-checked in the service layer before server-key reads.
- Placement-admin vs super-admin scoping is enforced in the major service paths by university checks, with super admin bypass only where intended.
- File download routes for resumes, company logos, and JD attachments are server-mediated and not directly exposed from the browser bundle.
- No committed secret was found in git history for `.env.local`; the live key is present only in the local untracked file.

## Residual Risks

- I could not perform a live bucket-permission or function-execution-permission audit because the current Appwrite API key lacks `buckets.read` and `functions.read`.
- The current setup guidance in [APPWRITE_SETUP.md](/Users/im45145v/Projects/Placely/APPWRITE_SETUP.md) still describes a broadly scoped setup key. It should be split into:
  - a temporary provisioning key with schema/bucket mutation scopes
  - a narrower runtime key for the app and functions
- The new function signing path requires `APPWRITE_FUNCTION_SHARED_SECRET` to be configured consistently in the Next.js app and the Appwrite functions before function-based workflows are used.

## Verification Run

Completed successfully on 2026-09-01:

- `node --test src/lib/security/function-signing.test.mjs src/lib/auth/oauth-state.test.mjs src/lib/auth/access.test.mjs src/lib/errors.test.mjs src/lib/student-profile/rules.test.mjs`
- `npm run typecheck`
- `npm run lint`
