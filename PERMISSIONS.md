# Placely Permission Model

Date: 2026-08-31

Authentication identifies the user. Authorization is derived from the server-trusted `users.role` field and never from browser-supplied state.

## Roles

- `STUDENT`
- `PLACEMENT_ADMIN`
- `SUPER_ADMIN`

## Security rules

- Sensitive collections use row-level security.
- Students can only access their own private records.
- Admin access is explicit and university-scoped unless the actor is `SUPER_ADMIN`.
- Sensitive collections are never publicly readable.
- First login creates the application `users` record and, for student users, an initial `student_profiles` record.
- Role assignment and role changes are server-side only.

## Collection permissions

| Collection | Student access | Placement Admin access | Super Admin access | Notes |
|---|---|---|---|---|
| `universities` | Read own university metadata | Read/update assigned university | Full access | Used for domain-based user sync |
| `users` | Read own, limited self-update | Read/update users in same university | Full access | Role changes remain server-only |
| `student_profiles` | Read/update own profile | Read/update scoped placement data | Full access | Private academic and placement data |
| `companies` | Read only allowed company data | Full access in same university | Full access | No public reads |
| `roles` | Read only published/allowed roles | Full access in same university | Full access | Authorization still server-checked |
| `eligibility_rules` | No direct access | Full access in same university | Full access | Evaluated server-side only |
| `variables` | No direct access | Full access in same university | Full access | Custom variable definitions |
| `applications` | Read own, guarded create/update own | Full access in same university | Full access | Student writes limited to allowed transitions |
| `placement_rounds` | Read only assigned/published context | Full access in same university | Full access | Not broadly readable before publication |
| `round_participants` | Read own participant rows | Full access in same university | Full access | Student writes disallowed |
| `results` | Read own published results | Full access in same university | Full access | Publication is server-controlled |
| `notifications` | Read/update own notifications | Operational read in same university | Full access | Student update limited to read state |
| `document_metadata` | Read own private metadata | Read scoped admin-managed metadata | Full access | Storage ownership mirror |
| `audit_logs` | No access | Read in same university | Full access | Append-only via trusted server code |
| `placement_rules` | No direct access | Full access in same university | Full access | Enforced server-side |

## Canonical source

The implementation-level permission, field, and index definition lives in [src/lib/appwrite/schema.ts](/Users/im45145v/Projects/Placely/src/lib/appwrite/schema.ts).
