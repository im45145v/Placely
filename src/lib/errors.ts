/**
 * Application error types.
 * Provides structured, type-safe error handling across Placely.
 */

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "APPWRITE_ERROR"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: AppErrorCode = "INTERNAL_ERROR",
    statusCode = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, "UNAUTHORIZED", 401);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, "FORBIDDEN", 403);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(message, "NOT_FOUND", 404);
  }

  static validationError(message: string, details?: unknown): AppError {
    return new AppError(message, "VALIDATION_ERROR", 400, details);
  }

  static conflict(message: string): AppError {
    return new AppError(message, "CONFLICT", 409);
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError(message, "INTERNAL_ERROR", 500);
  }
}

/**
 * Converts any unknown error into a user-safe error message string.
 * Strips internal details that should not be shown to users.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    // Appwrite SDK errors expose a message field
    return error.message || "An unexpected error occurred.";
  }
  return "An unexpected error occurred.";
}

/**
 * Returns true if the error is an Appwrite "document not found" error.
 */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code: number }).code === 404;
  }
  return false;
}

/**
 * Returns true if the error is an Appwrite authentication error.
 */
export function isAuthError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: number }).code;
    return code === 401;
  }
  return false;
}
