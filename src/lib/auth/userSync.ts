/**
 * User record synchronization.
 *
 * After a successful Google OAuth login we ensure an AppUser document exists
 * in the `users` Appwrite collection.  On first login the document is created
 * with role = "student" and a placeholder universityId.  On subsequent logins
 * the existing document is returned.
 *
 * Role is ALWAYS read from the database, never from the browser.
 *
 * SERVER-SIDE ONLY — do not import from Client Components.
 */
import { Databases, ID, type Models, Query } from "node-appwrite";
import { createServerClient } from "@/lib/appwrite/server";
import { Collections } from "@/lib/appwrite/constants";
import type { AppUser, UserRole } from "@/types";
import { isNotFoundError } from "@/lib/errors";

/** Default university ID until multi-university support is needed. */
const DEFAULT_UNIVERSITY_ID = "default";

/**
 * Ensures an AppUser document exists for the given Appwrite auth user.
 *
 * - If the document already exists, it is returned unchanged (role preserved).
 * - If the document does not exist, a new one is created with role = "student".
 * - If the `users` collection does not yet exist (DB not provisioned), a
 *   minimal in-memory AppUser is returned so auth still works without a DB.
 *
 * @param authUser - The verified Appwrite Auth user object.
 * @returns The AppUser profile (from DB or synthesised).
 */
export async function syncUserRecord(
  authUser: Models.User<Models.Preferences>
): Promise<AppUser> {
  const databases = new Databases(createServerClient());
  const dbId = process.env.APPWRITE_DATABASE_ID ?? "";

  // 1. Try to read existing document
  try {
    const docs = await databases.listDocuments(dbId, Collections.USERS, [
      Query.equal("userId", authUser.$id),
      Query.limit(1),
    ]);

    if (docs.total > 0) {
      return docToAppUser(docs.documents[0] as Models.DefaultDocument);
    }
  } catch (err) {
    if (!isNotFoundError(err)) {
      // Collection doesn't exist yet — synthesise a minimal user so auth works
      // during development before the DB is provisioned.
      console.warn("[syncUserRecord] users collection not found — using synthesised user");
      return synthesiseAppUser(authUser);
    }
    // 404 on the query means no matching document — fall through to create
  }

  // 2. Create new user document
  try {
    const now = new Date().toISOString();
    const data: Omit<AppUser, "$id"> = {
      name: authUser.name,
      email: authUser.email,
      universityId: DEFAULT_UNIVERSITY_ID,
      role: "student" as UserRole,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // Use the Appwrite Auth user ID as the document ID for easy lookup
    const doc = await databases.createDocument<Models.DefaultDocument>(
      dbId,
      Collections.USERS,
      authUser.$id,
      data
    );

    return docToAppUser(doc);
  } catch (createErr) {
    console.warn("[syncUserRecord] Failed to create user document:", createErr);
    // Graceful degradation — return synthesised user so login still succeeds
    return synthesiseAppUser(authUser);
  }
}

/**
 * Reads the AppUser document for a verified session user.
 * Returns null if the document doesn't exist yet (edge case during first-login
 * race or if DB is not provisioned).
 */
export async function getAppUser(userId: string): Promise<AppUser | null> {
  const databases = new Databases(createServerClient());
  const dbId = process.env.APPWRITE_DATABASE_ID ?? "";

  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(dbId, Collections.USERS, userId);
    return docToAppUser(doc);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docToAppUser(doc: Models.DefaultDocument): AppUser {
  return {
    $id: doc.$id,
    name: doc["name"] as string,
    email: doc["email"] as string,
    universityId: (doc["universityId"] as string) ?? DEFAULT_UNIVERSITY_ID,
    role: (doc["role"] as UserRole) ?? "student",
    isActive: (doc["isActive"] as boolean) ?? true,
    createdAt: doc["createdAt"] as string ?? doc.$createdAt,
    updatedAt: doc["updatedAt"] as string ?? doc.$updatedAt,
  };
}

function synthesiseAppUser(
  authUser: Models.User<Models.Preferences>
): AppUser {
  const now = new Date().toISOString();
  return {
    $id: authUser.$id,
    name: authUser.name,
    email: authUser.email,
    universityId: DEFAULT_UNIVERSITY_ID,
    role: "student",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
