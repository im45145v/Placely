# deadline-reminders

Scheduled Appwrite Function for deadline reminder notifications.

## Purpose

- Runs on an Appwrite schedule, typically hourly or daily.
- Finds published roles whose `applicationDeadline` falls within the next 24 hours.
- Executes `notification-dispatcher` with `DEADLINE_REMINDER` payloads.
- Reuses notification dedupe keys so repeated scheduled runs do not create duplicate reminders.

## Required environment variables

- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_NOTIFICATION_FUNCTION_ID`
- `APPWRITE_PROJECT_ID` or `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_ENDPOINT` optional
