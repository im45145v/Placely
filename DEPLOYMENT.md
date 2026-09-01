# Placely Production Deployment

This document prepares Placely for Appwrite Cloud production deployment with:

- Appwrite Sites deployment
- GitHub repository integration
- production environment variables
- Appwrite project configuration
- production domain configuration
- secure secret handling
- build configuration
- Appwrite Functions deployment

Use placeholders and environment variables throughout. Do not hardcode project IDs, API keys, OAuth secrets, or shared secrets in source control.

## Prerequisites

- Appwrite Cloud account
- Google Cloud project for OAuth
- GitHub repository containing Placely
- Production domain, for example `placely.example.com`
- Node.js 20+ for local validation

Recommended secret variables:

```bash
APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<appwrite-project-id>
APPWRITE_API_KEY=<server-api-key>
APPWRITE_DATABASE_ID=placely-db
NEXT_PUBLIC_APP_URL=https://placely.example.com
APPWRITE_FUNCTION_SHARED_SECRET=<long-random-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_APPS_SCRIPT_WEB_APP_URL=<optional-google-apps-script-url>
GOOGLE_APPS_SCRIPT_AUTH_TOKEN=<optional-google-apps-script-token>
```

## 1. Create Appwrite project

1. Open Appwrite Cloud Console.
2. Create a new project for production, for example `Placely Production`.
3. Copy the project values into your secret manager:
   - `APPWRITE_ENDPOINT`
   - `APPWRITE_PROJECT_ID`
4. In `Overview`, create a server API key for Placely production. Store it as `APPWRITE_API_KEY`.

Minimum API key scopes for the current app and provisioning workflow:

- `sessions.write`
- `users.read`
- `databases.read`
- `databases.write`
- `tables.read`
- `tables.write`
- `columns.read`
- `columns.write`
- `indexes.read`
- `indexes.write`
- `rows.read`
- `rows.write`
- `buckets.read`
- `buckets.write`
- `files.read`
- `files.write`
- `functions.read`
- `functions.write`
- `execution.read`
- `execution.write`

Use a dedicated production key. Do not reuse a developer key.

## 2. Add Web platform

1. In the Appwrite project, add a `Web` platform.
2. Set the production hostname only, for example `placely.example.com`.
3. If you use a `www` subdomain, add that hostname as an additional platform.

Set `NEXT_PUBLIC_APP_URL` to the same canonical HTTPS origin you will expose publicly.

## 3. Configure Google OAuth

Placely uses Appwrite Auth with Google OAuth and a server-side callback at `/api/auth/callback`.

### In Google Cloud

1. Open `APIs & Services` -> `OAuth consent screen` and configure the production app.
2. Create an OAuth 2.0 client of type `Web application`.
3. In Appwrite, open `Auth` -> `Settings` -> `OAuth2 Providers` -> `Google`.
4. Enable Google and paste:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
5. Copy the redirect URI shown by Appwrite.
6. Add that exact redirect URI to the Google OAuth client.
7. Save both configurations.

Also verify the Placely production origin is listed in Google as an authorized JavaScript origin if Google requires it for your project setup.

## 4. Create database

Create one production database:

- Name: `Placely`
- ID via env var: `APPWRITE_DATABASE_ID`

Recommended value:

```bash
APPWRITE_DATABASE_ID=placely-db
```

Keep the ID in environment configuration so the app and functions read the same database target.

## 5. Create collections/tables

Placely expects these Appwrite tables/collections in `APPWRITE_DATABASE_ID`:

- `universities`
- `users`
- `student_profiles`
- `companies`
- `roles`
- `eligibility_rules`
- `variables`
- `applications`
- `placement_rounds`
- `round_participants`
- `results`
- `resumes`
- `notifications`
- `email_deliveries`
- `notification_templates`
- `document_metadata`
- `audit_logs`
- `placement_rules`

Create them with document security enabled. The repository already includes a provisioning script at [`scripts/provision-appwrite.mjs`](/Users/im45145v/Projects/Placely/scripts/provision-appwrite.mjs:1) that can create the database shell, base collections, and storage buckets when run with production environment variables.

Current bootstrap command:

```bash
npm run appwrite:provision
```

That script is a starting point, not the full schema migration. Use it first, then complete the remaining schema manually or extend the script before first production launch.

## 6. Create indexes

Create the indexes defined in [`src/lib/appwrite/schema.ts`](/Users/im45145v/Projects/Placely/src/lib/appwrite/schema.ts:1). These indexes are required for uniqueness constraints and query performance.

At minimum, create the unique and key indexes referenced there for:

- `universities`
- `users`
- `student_profiles`
- `resumes`
- `companies`
- `roles`
- `eligibility_rules`
- `variables`
- `applications`
- `placement_rounds`
- `round_participants`
- `results`
- `notifications`
- `email_deliveries`
- `notification_templates`
- `document_metadata`
- `audit_logs`
- `placement_rules`

Do not skip unique indexes. They enforce important business constraints such as unique user emails, one profile per student, and deduplicated notifications.

## 7. Create storage buckets

Create these Appwrite Storage buckets:

- `resumes`
- `company_logos`
- `jd_attachments`
- `import_files`

Current code uses the first three directly and constants already define all four in [`src/lib/appwrite/constants.ts`](/Users/im45145v/Projects/Placely/src/lib/appwrite/constants.ts:1).

Recommended settings:

- Enable encryption
- Enable antivirus
- Enable file security
- Restrict allowed extensions per bucket
- Keep max file sizes aligned with application needs

Suggested bucket policies:

- `resumes`: private, document-linked access only
- `company_logos`: controlled upload, read via app route
- `jd_attachments`: private, served through authenticated route
- `import_files`: admin-only import/export workflows

## 8. Configure permissions

Placely is designed for server-mediated access. Prefer restrictive Appwrite permissions and let the Next.js server and Functions enforce workflow rules.

Recommended approach:

- Keep collection-level default permissions empty or minimal.
- Enable document security on all sensitive collections.
- Use server-side writes for protected data.
- Limit direct client access to authenticated, least-privilege reads where necessary.

Sensitive collections include:

- `users`
- `student_profiles`
- `resumes`
- `applications`
- `placement_rounds`
- `round_participants`
- `results`
- `notifications`
- `email_deliveries`
- `audit_logs`

Use [`src/lib/appwrite/schema.ts`](/Users/im45145v/Projects/Placely/src/lib/appwrite/schema.ts:1) as the source of truth for intended access patterns.

## 9. Create Functions

Create these Appwrite Functions from the `functions/` directory:

1. `shortlisting-orchestrator`
2. `notification-dispatcher`
3. `deadline-reminders`

Recommended runtime:

- Node.js runtime supported by current Appwrite Cloud and compatible with repository dependencies

Recommended root directories:

- `functions/shortlisting-orchestrator`
- `functions/notification-dispatcher`
- `functions/deadline-reminders`

After creation, store the generated function IDs as secrets for the Site:

```bash
APPWRITE_SHORTLISTING_FUNCTION_ID=<shortlisting-function-id>
APPWRITE_NOTIFICATION_FUNCTION_ID=<notification-function-id>
```

`deadline-reminders` does not need a Site env var unless you invoke it from the app.

## 10. Configure Function environment variables

Configure each function with server-only environment variables.

Shared variables for all functions:

```bash
APPWRITE_API_KEY=<server-api-key>
APPWRITE_DATABASE_ID=<database-id>
APPWRITE_PROJECT_ID=<project-id>
APPWRITE_FUNCTION_API_ENDPOINT=<endpoint-url>
APPWRITE_FUNCTION_SHARED_SECRET=<long-random-secret>
```

Function-specific variables:

### `shortlisting-orchestrator`

```bash
APPWRITE_NOTIFICATION_FUNCTION_ID=<notification-function-id>
```

### `notification-dispatcher`

```bash
EMAIL_AUTOMATION_PROVIDER=google_apps_script
GOOGLE_APPS_SCRIPT_WEB_APP_URL=<optional-provider-url>
GOOGLE_APPS_SCRIPT_AUTH_TOKEN=<optional-provider-secret>
```

For non-production dry runs you may use:

```bash
EMAIL_AUTOMATION_PROVIDER=log
```

### `deadline-reminders`

```bash
APPWRITE_NOTIFICATION_FUNCTION_ID=<notification-function-id>
APPWRITE_FUNCTION_SHARED_SECRET=<same-shared-secret-used-by-caller>
```

Use the same `APPWRITE_FUNCTION_SHARED_SECRET` across the Placely Site and trusted internal functions so signed function payload verification succeeds.

## 11. Connect GitHub repository

1. Push the production-ready branch to GitHub.
2. In Appwrite Sites, create a new Site.
3. Choose GitHub as the source provider.
4. Authorize Appwrite to access the repository.
5. Select the Placely repository and production branch.

Use branch protection on the production branch. Treat Appwrite as the deploy target, not the source of truth.

## 12. Configure Appwrite Site

For the Site:

- Framework: `Next.js`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: leave empty for Next.js SSR/App Router unless Appwrite requires a specific adapter setting
- Node version: use a version compatible with Next.js 16 and this repository, preferably Node 20+

Placely is not a static export. Do not configure a static-only output directory.

Before enabling automatic production deploys, run locally:

```bash
npm run lint
npm run typecheck
npm run build
```

## 13. Configure production environment

In the Appwrite Site production environment, configure:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
NEXT_PUBLIC_APP_URL=https://placely.example.com
APPWRITE_API_KEY=<server-api-key>
APPWRITE_DATABASE_ID=<database-id>
APPWRITE_SHORTLISTING_FUNCTION_ID=<shortlisting-function-id>
APPWRITE_NOTIFICATION_FUNCTION_ID=<notification-function-id>
APPWRITE_FUNCTION_SHARED_SECRET=<long-random-secret>
APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS=im45145v@gmail.com
EMAIL_AUTOMATION_PROVIDER=google_apps_script
GOOGLE_APPS_SCRIPT_WEB_APP_URL=<optional-provider-url>
GOOGLE_APPS_SCRIPT_AUTH_TOKEN=<optional-provider-secret>
```

Rules:

- Only `NEXT_PUBLIC_*` variables may be exposed to the browser bundle.
- Keep `APPWRITE_API_KEY`, `APPWRITE_FUNCTION_SHARED_SECRET`, and provider tokens server-only.
- Keep `APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS` server-only.
- Rotate secrets in Appwrite, not in the repository.
- Use separate values for production and non-production.

Reference templates:

- [`.env.example`](/Users/im45145v/Projects/Placely/.env.example:1)
- [`src/lib/validation/env.ts`](/Users/im45145v/Projects/Placely/src/lib/validation/env.ts:1)

## 14. Configure domain

1. In Appwrite Sites, add the production custom domain, for example `placely.example.com`.
2. Add the DNS records requested by Appwrite at your DNS provider.
3. Wait for verification and certificate issuance.
4. Redirect `www` to the canonical hostname if you use both.

After the domain is active:

1. Confirm `NEXT_PUBLIC_APP_URL` matches the final HTTPS origin exactly.
2. Confirm the Appwrite Web platform hostname matches the production hostname.
3. Confirm Google OAuth redirect configuration still matches the Appwrite-generated redirect URI for this project.

## 15. Deploy

Deployment sequence:

1. Confirm all production env vars and function env vars are present.
2. Create database, collections, indexes, and storage buckets.
3. Deploy the three Appwrite Functions.
4. Save function IDs into Site env vars.
5. Trigger the Appwrite Site production deployment from the connected GitHub branch.
6. Watch build logs until the Site is live.

If you want a manual release gate, disable auto-deploy on push and deploy only tagged or reviewed commits.

## 16. Verify production

Verify on the live domain:

1. Open `/login` and confirm the Site loads over HTTPS.
2. Start Google login and confirm redirect flow returns to `/api/auth/callback`.
3. Confirm the session cookie is created and the user lands on the expected dashboard.
4. Confirm first-login user sync creates the Appwrite user record.
5. Confirm database reads and writes succeed for a test tenant.
6. Upload a resume and verify storage access.
7. Create a company and role as admin.
8. Submit an application as a student.
9. Execute a workflow that invokes `shortlisting-orchestrator`.
10. Confirm `notification-dispatcher` creates in-app notifications.
11. If email is enabled, confirm a real email delivery succeeds.
12. Run or wait for `deadline-reminders` and confirm deduplicated reminders behave correctly.

Also verify server logs and Appwrite execution logs for:

- OAuth callback errors
- missing env vars
- function signature failures
- permission-denied responses
- storage access failures

## 17. Rollback procedure

Use a reversible release process.

Recommended rollback:

1. Keep the previous successful Git commit tagged.
2. If the Site deploy fails, redeploy the previous stable commit from GitHub.
3. If a release introduces bad config, restore the prior Site env var set and redeploy.
4. If a function deployment breaks workflows, redeploy the previous function build and keep the same function ID if Appwrite supports version rollback.
5. If a schema change is backward incompatible, stop traffic, restore compatible code, then revert the schema only after confirming no data loss risk.

Operational guidance:

- Never delete the production project as a rollback mechanism.
- Rotate compromised secrets immediately, then redeploy Site and Functions.
- Keep database migrations backward compatible until the new release is verified.
- Record the rollback commit SHA, function versions, and env var revision used for each production release.

## Secure secret handling

- Store secrets only in Appwrite environment configuration or your secret manager.
- Never commit `.env.local`, production `.env` files, or copied console values.
- Generate `APPWRITE_FUNCTION_SHARED_SECRET` and provider tokens with a cryptographically secure random generator.
- Use separate API keys for production and local development.
- Review access to the Appwrite project, GitHub repository, and Google Cloud OAuth project regularly.

## Build configuration summary

Placely currently builds with:

```bash
npm install
npm run build
```

Validation commands before production deploy:

```bash
npm run lint
npm run typecheck
npm run build
```

Core references:

- [`README.md`](/Users/im45145v/Projects/Placely/README.md:1)
- [`APPWRITE_SETUP.md`](/Users/im45145v/Projects/Placely/APPWRITE_SETUP.md:1)
- [`functions/README.md`](/Users/im45145v/Projects/Placely/functions/README.md:1)
