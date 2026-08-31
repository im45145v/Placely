# Placely Database Schema

Date: 2026-08-31

Placely uses Appwrite Databases only. No SQL schema, MongoDB schema, or browser-trusted authorization layer is introduced.

## Database

- ID: `placely-db`

## Core entities

- `University`
- `User`
- `StudentProfile`
- `Company`
- `Role`
- `EligibilityRule`
- `Application`
- `PlacementRound`
- `RoundParticipant`
- `RoundResult`
- `Notification`
- `DocumentMetadata`
- `AuditLog`
- `CustomVariable`
- `PlacementRule`

## What is defined

The canonical schema file [src/lib/appwrite/schema.ts](/Users/im45145v/Projects/Placely/src/lib/appwrite/schema.ts) defines for each collection:

- fields
- types
- required vs optional
- relationships
- indexes
- validation intent
- permission decisions

## First login handling

- After verified Appwrite Google authentication, the app creates the initial `users` record.
- If the user role is `STUDENT`, the app also creates an initial `student_profiles` record.
- The role used for authorization is always loaded from the server-side `users` collection.

## Provisioning

- Script: [scripts/provision-appwrite.mjs](/Users/im45145v/Projects/Placely/scripts/provision-appwrite.mjs)
- Current script creates the database and required collections.
- Attribute/index creation for complex Appwrite field types should continue from the canonical schema definition if your Appwrite project version needs collection-by-collection rollout.
