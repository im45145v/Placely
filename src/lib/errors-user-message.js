export function getSafeUserMessage(error) {
  if (error && typeof error === "object" && "name" in error && error.name === "AppError" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred.";
}
