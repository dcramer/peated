import { z } from "zod";

const UniqueViolationSchema = z.object({
  code: z.literal("23505"),
  constraint: z.string().optional(),
});

/**
 * Returns the name of the unique constraint a failed query violated, or null.
 *
 * Drizzle wraps PostgreSQL errors in `DrizzleQueryError`, and callers may wrap
 * them again, so this checks the error and its causes.
 */
export function uniqueViolationConstraint(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const violation = UniqueViolationSchema.safeParse(current);
    if (violation.success) return violation.data.constraint ?? null;
    current = current.cause;
  }
  return null;
}
