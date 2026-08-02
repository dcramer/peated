export type RegistrationConflictField = "email" | "username";

export function getRegistrationConflictField(
  error: unknown,
): RegistrationConflictField | null {
  if (!error || typeof error !== "object") return null;

  const { code, data, name } = error as {
    code?: unknown;
    data?: unknown;
    name?: unknown;
  };
  if (name !== "CONFLICT" && code !== "CONFLICT") return null;
  if (!data || typeof data !== "object") return null;

  const field = (data as { field?: unknown }).field;
  return field === "email" || field === "username" ? field : null;
}
