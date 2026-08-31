"use client";

import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";

export function getCollectionRealtimeChannel(collectionId: string): string {
  return `databases.${DATABASE_ID}.collections.${collectionId}.documents`;
}

export function getDocumentRealtimeChannel(collectionId: string, documentId: string): string {
  return `${getCollectionRealtimeChannel(collectionId)}.${documentId}`;
}

export function getApplicationRealtimeChannels(applicationId: string): string[] {
  return [getDocumentRealtimeChannel(Collections.APPLICATIONS, applicationId)];
}
