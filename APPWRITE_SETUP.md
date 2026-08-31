# Placely Appwrite Setup

This project is in `/Users/im45145v/Projects/Placely`.

To get the current app running, Appwrite only needs:

- one Appwrite project
- one Web platform for `localhost`
- Google OAuth enabled in Appwrite Auth
- one server API key
- one database
- one `users` collection

## 1. Create the Appwrite project

1. Open Appwrite Cloud: `https://cloud.appwrite.io/console`
2. Create a new project named `Placely`
3. Copy these two values from the project:
   - `Project ID`
   - `Endpoint`

Use the exact endpoint shown by Appwrite for your project region.

## 2. Add a Web platform

1. In the Appwrite project, add a `Web` platform
2. Use:
   - Name: `Placely Local`
   - Hostname: `localhost`

If you later deploy the app, add a second Web platform for the real domain.

## 3. Create the server API key

Create one API key for local setup and server-side auth. Name it something like `placely-local-dev`.

Give it these scopes:

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

These are broader than the current runtime strictly needs, but they let me finish the database setup from this machine once you send me the key.

Copy the API key value immediately after creation.

## 4. Configure Google OAuth in Appwrite

Placely currently only exposes `Continue with Google`, so Google OAuth must be configured.

### In Google Cloud

1. Open `https://console.cloud.google.com/`
2. Create or select a Google Cloud project
3. Open `APIs & Services` -> `OAuth consent screen`
4. Configure the consent screen
5. Create an `OAuth 2.0 Client ID`
6. Application type: `Web application`
7. Add a temporary redirect URI, save, then keep the `Client ID` and `Client secret` open

### In Appwrite

1. Open `Auth` -> `Settings`
2. In `OAuth2 Providers`, open `Google`
3. Enable the provider
4. Paste the Google `Client ID` and `Client secret`
5. Appwrite will show you its Google redirect URI
6. Copy that redirect URI back into the Google OAuth client as an authorized redirect URI
7. Save both sides

## 5. Create the database

Create one database:

- Name: `Placely`
- ID: `placely-db`

## 6. Create the `users` collection

Create one collection in `placely-db`:

- Name: `Users`
- ID: `users`

Add these attributes:

- `name` -> string, required, size `255`
- `email` -> string, required, size `255`
- `universityId` -> string, required, size `64`
- `role` -> string, required, size `32`
- `isActive` -> boolean, required
- `createdAt` -> string, required, size `64`
- `updatedAt` -> string, required, size `64`

You do not need any indexes yet for the current codepath.

## 7. Send me these values

Reply with these exact values:

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DATABASE_ID=placely-db
APPWRITE_SHORTLISTING_FUNCTION_ID=
APPWRITE_NOTIFICATION_FUNCTION_ID=
EMAIL_AUTOMATION_PROVIDER=google_apps_script
GOOGLE_APPS_SCRIPT_WEB_APP_URL=
GOOGLE_APPS_SCRIPT_AUTH_TOKEN=
GOOGLE_OAUTH_CONFIGURED=yes
```

## 8. What I will do after you send them

After you send those values, I will:

1. create `.env.local`
2. verify the local auth configuration
3. run the Next.js app
4. fix any remaining Appwrite integration issues from the local side
