## Why

The bottle classifier currently assumes one intent: resolve an incoming
reference by matching, creating, repairing, or returning no match. Peated also
needs to check Bottles that already exist in the catalog, where the goal
is to audit and repair bad data rather than resolve a new reference.

Either check can reveal more than one safe action. A price listing may
match the correct Bottle while exposing duplicate Bottles or Brands. An
existing Bottle audit may show that Bottle fields or its Brand assignment
should change, or that a related Entity should be created, updated, or merged.

## What Changes

- Preserve `classifyBottleReference` and add `auditBottle`; each entrypoint
  selects the server-owned intent.
- Preserve the current match/create/repair/no-match decision for
  reference resolution. Audits return a summary, operations, and findings
  without a redundant outcome enum.
- Add one bounded `proposedOperations` array shared by both intents. Each
  non-ignored reference or audit uses one semantic agent loop. Four
  non-mutating tools collect operation proposals during that loop; runtime
  attaches the collected proposals to the strict final result.
- Initially support explicit Bottle update/merge and related Entity
  update/merge operations. A Bottle update may explicitly create a related
  Entity as part of the same transaction.
- Define the four operations as one strict literal-tagged Zod union and handle
  them with plain exhaustive TypeScript functions.
- Persist store-price reference checks, actionable photo-identification repairs,
  and existing-Bottle audits with their proposed operations for review. Other
  reference consumers continue to receive classifier results without durable
  proposal review until their source kind is explicitly integrated.
- Show the check result and operation cards together in the relevant
  moderator workflow.
- Put actionable post-create and moderator audits in one Bottle Checks inbox and
  allow a moderator to close finding-only or manually resolved checks.
- Approve or reject operations independently and execute them only through
  canonical Bottle and Entity services.
- Revalidate live state before execution. The classifier remains read-only.
- Permit automatic primary classification only in the existing end-user
  add-Bottle flow and under its existing safety policy.
- Extend the existing post-create verification job so it may run a background
  Bottle audit after an end user creates a Bottle, replacing the previous
  Bottle-specific heuristic conclusion; that audit may generate proposals but
  may not apply them.

The initial version intentionally avoids a universal identity-conclusion
object, arbitrary workflow language, dependencies, logical result references,
model-defined ordering, and cross-operation transactions.

## Capabilities

### New Capabilities

- `bottle-checks`: Intent-driven Bottle checks with a bounded
  set of typed Bottle and related-Entity operation proposals.
- `bottle-operation-review`: Durable moderator preview, disposition, and
  canonical execution of proposed operations.

### Modified Capabilities

None.

## Impact

- The Bottle-classifier contract preserves its reference entrypoint, gains an
  audit entrypoint, and adds typed operations and findings.
- New check and operation persistence supports store-price references,
  actionable existing-Bottle photo results, and existing-Bottle audits. Other
  reference source kinds remain a rollout follow-up.
- Store-price attempts can link to their check without replacing the
  current proposal workflow.
- Canonical Entity update behavior is extracted from its route handler for safe
  reuse; Entity merge continues through its established background workflow
  with tracked completion.
- Admin match-queue and Bottle-audit surfaces gain operation review cards.
- Existing end-user Bottle verification may dispatch an idempotent post-create
  audit without delaying the user-visible save.
- Evals and tests cover intent handling, exact operation sets, entity-role
  safety, moderation, stale data, and execution.
