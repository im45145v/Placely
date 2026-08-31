# `shortlisting-orchestrator`

Appwrite Function for Phase 11 shortlisting workflows.

Handles:

- bulk shortlist
- automatic shortlist
- bulk reject
- bulk move to round
- CSV import execution

Expected environment variables:

- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_PROJECT_ID` or `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_ENDPOINT` optional

The Next.js app dispatches to this function when `APPWRITE_SHORTLISTING_FUNCTION_ID` is configured. Without that env var, the app falls back to direct server-side execution for smaller jobs.
