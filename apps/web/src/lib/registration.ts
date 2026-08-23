import type { isDefinedError } from "@orpc/client";
import { z } from "zod";

export type RegistrationConflictField = "email" | "username";
type ClientErrorCandidate = Parameters<typeof isDefinedError>[0];

const RegistrationConflictSchema = z.object({
  code: z.string().optional(),
  data: z.object({ field: z.enum(["email", "username"]) }),
  name: z.string().optional(),
});

export function getRegistrationConflictField(
  error: ClientErrorCandidate,
): RegistrationConflictField | null {
  const result = RegistrationConflictSchema.safeParse(error);
  if (!result.success) return null;
  return result.data.name === "CONFLICT" || result.data.code === "CONFLICT"
    ? result.data.data.field
    : null;
}
