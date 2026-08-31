# notification-dispatcher

Event-driven Appwrite Function for Placely notifications.

## Purpose

- Seeds notification templates per university when missing.
- Renders in-app and email templates with variables such as `{{student_name}}`, `{{company_name}}`, `{{role_name}}`, `{{round_name}}`, and `{{deadline}}`.
- Prevents duplicate in-app and email sends with channel-specific `dedupeKey` hashes and persistent Appwrite delivery records.
- Retries transient email failures with stored delivery state in `email_deliveries`.
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
- Scheduled HTTP execution with `{"mode":"retry_due"}` to process due email retries.

## Required environment variables

- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_PROJECT_ID` or `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_ENDPOINT` optional
- `EMAIL_AUTOMATION_PROVIDER` optional, defaults to `log`
- `GOOGLE_APPS_SCRIPT_WEB_APP_URL` required when `EMAIL_AUTOMATION_PROVIDER=google_apps_script`
- `GOOGLE_APPS_SCRIPT_AUTH_TOKEN` required when `EMAIL_AUTOMATION_PROVIDER=google_apps_script`
