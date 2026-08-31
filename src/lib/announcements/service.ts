import { Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import { isNotFoundError } from "@/lib/errors";
import type { Announcement, AppUser } from "@/types";

const IMPORTANT_ANNOUNCEMENTS_LIMIT = 5;

export async function listImportantAnnouncements(actor: AppUser): Promise<Announcement[]> {
  const { databases } = createServerServices();
  const now = new Date().toISOString();
  let result: Models.DocumentList<Models.DefaultDocument>;
  try {
    result = await databases.listDocuments<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.ANNOUNCEMENTS,
      [
        Query.equal("universityId", actor.universityId),
        Query.equal("isImportant", true),
        Query.orderDesc("publishedAt"),
        Query.limit(IMPORTANT_ANNOUNCEMENTS_LIMIT),
      ]
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return result.documents
    .map(docToAnnouncement)
    .filter((announcement) => !announcement.expiresAt || announcement.expiresAt >= now);
}

function docToAnnouncement(doc: Models.DefaultDocument): Announcement {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    title: String(doc.title),
    body: String(doc.body),
    isImportant: Boolean(doc.isImportant),
    publishedAt: String(doc.publishedAt ?? doc.createdAt ?? doc.$createdAt),
    expiresAt: asOptionalString(doc.expiresAt),
    createdAt: String(doc.createdAt ?? doc.$createdAt),
    updatedAt: String(doc.updatedAt ?? doc.$updatedAt ?? doc.$createdAt),
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
