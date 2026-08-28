# Appwrite Functions

This directory contains Appwrite Functions used by Placely for server-side logic.

Each function is a separate subdirectory with its own `package.json` and entry point.

Functions are deployed to Appwrite Cloud and invoked via HTTP or database event triggers.

## Functions (to be implemented in subsequent phases)

| Function | Trigger | Phase |
|---|---|---|
| `evaluate-eligibility` | HTTP | 4 |
| `create-application` | HTTP | 5 |
| `withdraw-application` | HTTP | 5 |
| `shortlist-students` | HTTP | 7 |
| `advance-round` | HTTP | 6 |
| `send-notification` | HTTP / Event | 8 |
| `import-data` | HTTP | 7 |
| `generate-export` | HTTP | 9 |
| `audit-logger` | HTTP | 10 |
| `verify-resume` | HTTP | 2 |
| `publish-announcement` | HTTP | 8 |

## Security

All functions use server-side Appwrite API keys stored as function environment variables.
Functions never trust client-supplied `role`, `universityId`, or eligibility values.
Functions always re-fetch the calling user's profile to verify identity and role.
