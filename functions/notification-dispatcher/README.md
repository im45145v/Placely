# notification-dispatcher

Event-driven Appwrite Function for Placely notifications.

## Purpose

- Seeds notification templates per university when missing.
- Renders in-app and email templates with variables such as `{{student_name}}`, `{{company_name}}`, `{{role_name}}`, `{{round_name}}`, and `{{deadline}}`.
- Prevents duplicates with a stable `dedupeKey` hash.
- Keeps email delivery behind a `createEmailSender()` abstraction so the provider can be swapped later.

## Expected payload

```json
{
  "type": "SHORTLISTED",
  "universityId": "university_id",
  "recipientUserIds": ["user_id"],
  "entityId": "application_id",
  "entityType": "application",
  "dedupeKey": "application-shortlisted:application_id:timestamp",
  "variables": {
    "student_name": "Asha",
    "company_name": "Acme",
    "role_name": "Software Engineer",
    "round_name": "Technical Interview",
    "deadline": "2026-09-03T12:00:00.000Z"
  }
}
```

## Trigger options

- HTTP execution from the Next.js app for explicit workflow transitions.
- Appwrite database event triggers if you want notifications to be fully decoupled from the app layer.

## Required environment variables

- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_PROJECT_ID` or `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_ENDPOINT` optional
