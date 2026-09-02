# Database Correctness

## Intent

The database is Peated's public record. A write must preserve identity,
relationships, ownership, and history.

## Policy

- Put uniqueness, reference, and valid-combination rules in database constraints
  when possible.
- Use a transaction for writes that must all succeed or all fail.
- Use a unique constraint, row lock, or saved-version check when concurrent
  writes can conflict. Do not rely on a read-then-write check alone.
- Do not infer IDs, owners, or relationships from display names or nearby rows.
- Before a merge or delete, list every dependent record and decide how each one
  moves, changes, or blocks the operation.
- Do not silently repair damaged saved data during a normal read.
- Separate schema rollout, data backfill, and irreversible cleanup when they
  need different checks or rollback plans.
- Verify each database rule at its write boundary.

## Exceptions

- A named, bounded migration may repair old data. It must record its scope and
  verify the result.
