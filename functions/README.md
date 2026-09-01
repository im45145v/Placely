# Appwrite Functions

This directory contains the Appwrite Functions currently used by Placely in production-oriented workflows.

Each function is deployed separately from its own subdirectory.

## Active functions

| Function | Purpose | Trigger |
|---|---|---|
| `shortlisting-orchestrator` | Bulk shortlist, reject, move-to-round, and import-backed application workflows | HTTP execution from Placely |
| `notification-dispatcher` | In-app notifications, email dispatch, template seeding, and retry handling | HTTP execution and optional event/scheduled execution |
| `deadline-reminders` | Scheduled reminder runs for roles nearing application deadline | Scheduled execution |

## Deployment layout

- [`shortlisting-orchestrator`](./shortlisting-orchestrator/README.md)
- [`notification-dispatcher`](./notification-dispatcher/README.md)
- [`deadline-reminders`](./deadline-reminders/README.md)

Create each function in Appwrite Cloud and configure its root directory to the matching folder under `functions/`.

## Required shared environment variables

Configure these on every function unless a function-specific README says otherwise:

- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_PROJECT_ID` or `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_ENDPOINT` when the regional endpoint must be explicit
- `APPWRITE_FUNCTION_SHARED_SECRET` for trusted internal function-to-function calls

## Function-specific variables

### `shortlisting-orchestrator`

- `APPWRITE_NOTIFICATION_FUNCTION_ID` optional but recommended

### `notification-dispatcher`

- `EMAIL_AUTOMATION_PROVIDER`
- `GOOGLE_APPS_SCRIPT_WEB_APP_URL` when `EMAIL_AUTOMATION_PROVIDER=google_apps_script`
- `GOOGLE_APPS_SCRIPT_AUTH_TOKEN` when `EMAIL_AUTOMATION_PROVIDER=google_apps_script`

### `deadline-reminders`

- `APPWRITE_NOTIFICATION_FUNCTION_ID`

## Security

- Use dedicated production API keys and separate non-production keys.
- Keep all function secrets server-only.
- Reuse the same `APPWRITE_FUNCTION_SHARED_SECRET` across trusted callers and callees.
- Do not invoke these functions directly from untrusted clients without an additional auth layer.

See [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the full production deployment sequence.
