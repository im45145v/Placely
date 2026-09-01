# Placely

> "Campus placements, simplified."

Placely is a university placement management platform built with **Next.js**, **TypeScript**, **Tailwind CSS**, and **Appwrite**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Backend-as-a-Service | Appwrite Cloud |
| Authentication | Appwrite Auth + Google OAuth |
| Database | Appwrite Databases |
| Storage | Appwrite Storage |
| Functions | Appwrite Functions |
| Messaging | Appwrite Messaging |

---

## Getting Started

### Prerequisites

- Node.js 20+
- An [Appwrite Cloud](https://cloud.appwrite.io) project

### Installation

```bash
# Clone the repository
git clone https://github.com/im45145v/Placely.git
cd Placely

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local and fill in your Appwrite project credentials
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Checks

```bash
# TypeScript type check
npm run typecheck

# Linting
npm run lint

# Production build
npm run build
```

---

## Environment Variables

See [.env.example](.env.example) for all required variables with descriptions.

| Variable | Required | Where |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Yes | Client + Server |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Yes | Client + Server |
| `NEXT_PUBLIC_APP_URL` | Yes | Client + Server |
| `APPWRITE_API_KEY` | Yes | Server only |
| `APPWRITE_DATABASE_ID` | Yes | Server only |
| `APPWRITE_SHORTLISTING_FUNCTION_ID` | No | Server only |
| `APPWRITE_NOTIFICATION_FUNCTION_ID` | No | Server only |
| `APPWRITE_FUNCTION_SHARED_SECRET` | Required when Appwrite Functions are enabled | Server only |
| `EMAIL_AUTOMATION_PROVIDER` | No | Server only |
| `GOOGLE_APPS_SCRIPT_WEB_APP_URL` | No | Server only |
| `GOOGLE_APPS_SCRIPT_AUTH_TOKEN` | No | Server only |

> **Security:** Never add `APPWRITE_API_KEY`, `GOOGLE_APPS_SCRIPT_WEB_APP_URL`, or `GOOGLE_APPS_SCRIPT_AUTH_TOKEN` to a `NEXT_PUBLIC_*` variable. They must remain server-only.

Production deployment guidance lives in [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Project Structure

```
src/
  app/            # Next.js App Router pages and layouts
  components/     # Shared UI components
    ui/           # Primitive components (Button, Card, Badge, …)
    layout/       # Header, Sidebar, PageWrapper
    feedback/     # ErrorBoundary, Skeleton, EmptyState
  features/       # Feature-based modules (populated in subsequent phases)
  lib/
    appwrite/     # Appwrite client/server utilities and constants
    auth/         # Session helpers and route guards
    validation/   # Environment validation and Zod schemas
    errors.ts     # Application error types
    utils.ts      # Shared utility functions
  hooks/          # React hooks
  types/          # TypeScript domain types

functions/        # Appwrite Functions (server-side serverless logic)
```

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete architecture proposal.

---

## Specification

See [PROJECT_SPEC.md](PROJECT_SPEC.md) for the full product specification.

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Project Foundation | ✅ Complete |
| 2 | Student Profile | 🔜 Planned |
| 3 | Companies and Roles | 🔜 Planned |
| 4 | Eligibility Engine | 🔜 Planned |
| 5 | Applications | 🔜 Planned |
| 6 | Rounds and Results | 🔜 Planned |
| 7 | Shortlisting and Bulk Ops | 🔜 Planned |
| 8 | Notifications | 🔜 Planned |
| 9 | Admin Analytics and Export | 🔜 Planned |
| 10 | Audit Logs and Compliance | 🔜 Planned |
| 11 | Polish and Performance | 🔜 Planned |

---

## License

[MIT](LICENSE)
