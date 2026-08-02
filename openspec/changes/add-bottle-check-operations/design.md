## Context

The common unit is not “a store-price match.” It is a Bottle check:

- an external reference that may describe a Bottle; or
- an existing Peated Bottle that may contain or expose bad catalog data.

The caller always knows why it is starting the check. That intent
changes the required result:

- `resolve_reference` must tell the caller whether to match, create, repair, or
  stop unresolved;
- `audit_bottle` must tell the reviewer whether the existing Bottle is clean,
  has proposed changes, or cannot be assessed safely.

Both checks may discover changes to the Bottle and its related catalog
Entities. For example, the classifier may identify exact duplicate Bottles,
duplicate Brands, an incorrect Brand assignment, or a missing Brand.

Peated already has:

- the Bottle classifier and its reviewed
  `match | create_bottle | repair_bottle | no_match` decision;
- a separate Entity classifier for checks whose subject is an Entity;
- canonical Bottle create, update, merge, and Brand-repair services;
- Entity create and update route behavior and an asynchronous Entity merge job.

This change extends Bottle checks. It does not replace the Entity
classifier when an Entity itself is the check subject.

## Terms

- **Check:** persisted current workflow state for an external Bottle reference
  or an actionable existing-Bottle audit.
- **Intent:** the caller-selected reason for the check.
- **Finding:** a useful issue that is not executable.
- **Proposed operation:** the small typed object recorded by the agent through a
  proposal tool.
- **Review operation:** the server-prepared operation shown to a moderator.
- **Apply:** execute one approved operation through a canonical service.

These terms are used in API names, database records, UI copy, tests, and docs.
The implementation favors TypeScript discriminated unions, Zod schemas, plain
objects, and plain async functions.

## Goals / Non-Goals

**Goals:**

- Make check intent explicit and server-owned.
- Reuse the current reference-resolution decision instead of inventing a
  parallel identity conclusion.
- Support existing-Bottle audit and repair through the same classifier agent and
  evidence model.
- Let either intent propose a small set of typed Bottle and related-Entity
  operations.
- Make each operation easy to validate, preview, approve, test, and operate.
- Make operation names, direction, creation behavior, and affected scope
  explicit; no behavior may depend on route conventions or nullable-id tricks.
- Keep all mutation authority in canonical server services.
- Preserve current store-price behavior.
- Separate automatic checks from automatic mutation.

**Non-Goals:**

- The agent does not choose or change its intent.
- No generic entity-operation framework for arbitrary Peated objects.
- No second remediation, reviewer, or evaluator agent.
- No scripts, SQL, route names, generic commands, or mutating agent tools.
- No model-authored dependencies, operation-result references, ordering, or
  multi-operation transaction.
- No BottleGroup move/merge/split operation or automatic approval of proposed
  catalog operations.
- No immediate migration of the existing Entity classifier.
- No automatic execution of supplemental catalog operations, including those
  produced by a post-create audit.

## Decisions

### Decision: Existing and audit entrypoints select intent

Keep the existing public reference API and add one audit API:

```ts
classifier.classifyBottleReference(referenceInput);
classifier.auditBottle({
  bottleId,
  origin: "moderator" | "post_user_creation",
  note,
});
```

The entrypoint selects the server-owned intent: `resolve_reference` or
`audit_bottle`. Callers do not migrate to a universal public command object.
The two entrypoints may share an internal discriminated `BottleCheckInput` when
that reduces duplication.

`BottleReference` retains source metadata such as store price, user submission,
or photo. Audit `origin` records what started the audit. Intent describes the
job; source or origin describes why this check exists.

Selecting an intent does not itself persist the classifier result. V1 creates
durable `resolve_reference` checks from store-price retries, durable background
audit receipts, and durable actionable moderator audits. Clean moderator audits
return a transient result without persistence. Photo identification also
persists an idempotent `resolve_reference` check when an existing-Bottle result
contains supplemental operations or findings. That check is moderator-only;
the end-user response keeps the existing photo-tasting contract. Other generic
reference consumers do not persist or surface supplemental proposals.

The server assembles the input, intent, and origin before the agent runs. The
model cannot switch an audit into a reference-resolution task or use freeform
text to change routing or automation policy.
Future intents extend this input union only when they require different success
criteria or reviewer behavior.

### Decision: Results are intent-specific

Reference resolution retains the existing result and adds operations:

```ts
type ResolveReferenceResult =
  | {
      status: "ignored";
      reason: string;
      proposedOperations: [];
      findings: Finding[];
      artifacts: BottleClassificationArtifacts;
    }
  | {
      status: "classified";
      decision: BottleClassificationDecision;
      proposedOperations: ProposedOperation[];
      findings: Finding[];
      artifacts: BottleClassificationArtifacts;
    };
```

Existing-Bottle audit uses:

```ts
type AuditBottleResult = {
  summary: string;
  proposedOperations: ProposedOperation[];
  findings: Finding[];
  artifacts: BottleClassificationArtifacts;
};
```

Audit display state is derived without another model field:

- empty operations and findings display as clean;
- any operation displays as changes proposed;
- findings display as needs review, with or without operations.

There is no universal structured `identityConclusion`. The reference decision
remains the structured primary result where identity routing is required.
Operations and findings carry audit structure; `summary` or the existing
rationale explains it to a reviewer.

`Finding` is a non-executable issue:

```ts
type Finding = {
  scope: "bottle" | "bottle_group" | "series" | "entity" | "other";
  summary: string;
  evidenceRefs: [EvidenceRef, ...EvidenceRef[]];
};
```

Findings preserve concrete, reviewer-relevant catalog problems outside the
supported operation set without inventing a mutation or suppressing valid
operations. They require positive evidence of a real catalog defect that
remains after proposed operations apply. Missing optional enrichment, harmless
absence, speculative cleanup, and uncertainty about whether an underspecified,
generic, or family row is intentional are not findings. Returning no operations
and no findings is valid after review. This relevance boundary is prompt and
eval policy, not a name, score, or relationship heuristic in code.

### Decision: Automation policy belongs to the invoking workflow

Running the classifier and applying its output are separate decisions.

- The end-user add-Bottle workflow may automatically apply its primary
  `match`, `create_bottle`, or `repair_bottle` result when the existing
  classifier review policy permits it.
- Store-price and moderator-audit sources retain their
  existing review behavior for the primary result.
- Supplemental operation proposals always require an explicit
  moderator approval. Source kind, confidence, or reviewer acceptance metrics
  do not authorize automatic application.

After an end-user Bottle creation commits, the existing
`VerifyBottleCreation` job may run one idempotent `audit_bottle` check for that
Bottle-creation event. The user-facing save does not wait for that check. A
clean audit records no work; proposed changes enter moderator review; findings
remain visible without changing the Bottle.

For Bottles, this agent check replaces the job's existing heuristic
passed/flagged finding calculation. The job selects 100% of eligible
`manual_entry` Bottles and a deterministic `price_match_automation` sample that
defaults to 10%. It keeps its uniqueness and queue boundary, but it does not
write a second verification result beside the check. Existing deterministic
Brand-repair candidate discovery may seed read-only candidate context; it is
not a parallel conclusion or operation generator.

This post-create audit is a correlated follow-up Bottle check using the same
classifier capability, not independent verification. Its result can surface
work and measure quality, but a clean result is not a second proof that the
original classification was correct.

This lets agent use be fluid and automatic where it improves intake while
keeping the small volume of broader catalog remediation human-supervised.

### Decision: Agent proposals and review operations are separate

The agent records small plain objects through proposal tools. Evidence
references are typed:

```ts
type EvidenceRef =
  | { kind: "source"; field: string }
  | { kind: "bottle"; bottleId: number }
  | { kind: "entity"; entityId: number }
  | { kind: "web_result"; url: string };

const ProposedOperationSchema = z.union([
  UpdateBottleOperationSchema,
  MergeBottlesOperationSchema,
  UpdateEntityOperationSchema,
  MergeEntitiesOperationSchema,
]);

type ProposedOperation = z.infer<typeof ProposedOperationSchema>;
```

Each operation schema owns its literal `type`, typed `input`, `rationale`, and
at least one entry in `evidenceRefs`. Source refs use exact serialized input
paths: `reference.<field>`, `extractedIdentity.<field>`,
`imageEvidence.fieldCandidates.<field>`, or `audit.note`. Web URLs and existing
target ids must appear in the runtime's collected artifacts. The design does
not add a second evidence-id system or trust model claims about which records
were inspected.

The final model output contains the intent-specific decision or summary and
findings, but not proposed operations. Runtime code attaches proposals recorded
by successful tool calls, collected artifacts, and model metadata after the
run; the model never echoes those server-owned fields.

Proposed operations do not contain
database row ids for the operation itself, review status, permissions, impact
counts, state tokens, function names, route names, or apply results.

The server prepares each proposal for review. A prepared operation adds only
server-owned data:

```ts
const PreparedReviewOperationSchema = z.discriminatedUnion("type", [
  ReviewBottleUpdateSchema,
  ReviewBottleMergeSchema,
  ReviewEntityUpdateSchema,
  ReviewEntityMergeSchema,
]);

const BlockedReviewOperationSchema = z
  .object({
    id: z.number(),
    status: z.literal("blocked"),
    proposal: ProposedOperationSchema,
    preparationError: PreparationErrorSchema,
  })
  .strict();

const ReviewOperationSchema = z.union([
  BlockedReviewOperationSchema,
  PreparedReviewOperationSchema,
]);

type ReviewOperation = z.infer<typeof ReviewOperationSchema>;
```

Each prepared review variant contains the original typed proposal,
server-built preview, state token, and non-blocked status. A proposal that
cannot be prepared has only its typed proposal and concrete preparation error;
it does not invent a preview or state token. Prepared inputs remain internal
and are rebuilt during approval.

With four operations, preparation and application use plain exhaustive
functions:

```ts
async function prepareOperation(operation: ProposedOperation) {
  switch (operation.type) {
    case "update_bottle":
      return prepareBottleUpdate(operation);
    case "merge_bottles":
      return prepareBottleMerge(operation);
    case "update_entity":
      return prepareEntityUpdate(operation);
    case "merge_entities":
      return prepareEntityMerge(operation);
    default:
      return assertNever(operation);
  }
}
```

`executeOperation` uses the same exhaustive shape. The inferred unions keep
type/input and type/preview pairs correlated, and `assertNever` makes a new
operation a compile error until both switches handle it. There are no handler
classes, registries, mapped generic framework, inheritance, reflection,
dependency injection container, or generic command objects.

Every full reference and audit run receives the same four non-mutating proposal
tools. V1 does not add per-operation capability flags or expose operation names
as a separate runtime input.

UI code receives `ReviewOperation` and never interprets raw model payloads.
This separation prevents model output from becoming an accidental apply
API and gives each operation one place to test normalization, stale-state
checks, and canonical execution.

### Decision: Existing-versus-new Entity choices are explicit

An `update_bottle` operation's shared-field patch may need either an existing
Entity or a new one. It uses a discriminated choice:

```ts
type BottleOperationEntityChoice =
  | { kind: "existing"; entityId: number }
  | { kind: "create"; entity: ProposedEntityDraft };
```

`ProposedEntityDraft` uses agent-observable values such as normalized name,
roles, website, country name, and region name. It never asks the model for
country or region database ids. Preparation resolves names to current catalog
ids, reports possible collisions, and shows any Entity creation as an explicit
effect in the preview. Similar names and search scores are warnings, not
deterministic proof that the Entity must be reused.

This removes ambiguous `{ id: null, name }` behavior from `update_bottle`
operation patches. An embedded `kind: "create"` is part of that Bottle update
transaction; it is not a reference to another proposed operation. The primary
`create_bottle` decision keeps its existing `{ id, name }` Entity contract,
including `id: null` for a new Entity.

### Decision: Use one explicit operation union

The initial operation union contains:

1. `update_bottle`
   - one existing Bottle id;
   - one non-empty patch with explicit `shared` and `exact` sections;
   - shared Entity fields use `BottleOperationEntityChoice`.
   - changing the Bottle's Brand is an ordinary shared-field update, not a
     separate reassignment operation.
2. `merge_bottles`
   - one existing source Bottle to retire;
   - one distinct existing destination Bottle to survive.
3. `update_entity`
   - one existing Entity id;
   - one non-empty agent-facing identity patch.
4. `merge_entities`
   - one existing source Entity to retire;
   - one distinct existing destination Entity to survive.

Merge direction is always `source -> destination`; no `direction`,
`mergeInto`, or `mergeFrom` field is exposed to the agent. The union uses
resource-specific names and payloads rather than a generic
`{resource, verb, args}` command.

Alias creation, Bottle/entity tombstones, BottleGroup fan-out, series repair,
search indexes, statistics, verification, and retry jobs remain server-derived
effects of the canonical services, not separate agent-authored operations.

Agent-facing update schemas select fields from canonical schemas rather than
exposing entire moderator forms:

- Bottle updates cover canonical identity and relationship fields in the
  explicit `shared` and `exact` sections; they exclude content, images, tags,
  statistics, and other presentation data.
- Entity updates initially cover name, short name, roles, website, country,
  region, and year established. They exclude description provenance, address,
  coordinates, and unrelated enrichment.

This is a least-capability output surface, not a semantic rule. A real repair
case can justify adding another field without adding another operation type.

The proposal schemas live in the existing Bottle-classifier contract package.
Server-only preparation and execution stay in `apps/server`; the web app uses
the oRPC response types. A shared catalog-operations package is deferred until a
second real producer needs the same proposal contract.

### Decision: V1 operations are independently executable

Every operation references catalog records that already exist, except for an
explicit Entity creation embedded inside an `update_bottle` operation. An
operation cannot reference the result of another operation, and array order has
no meaning.

This produces deliberate constraints:

- when primary Bottle creation or repair needs a new Entity, its existing
  `{ id, name }` Entity choice remains inside the canonical primary action;
- an `update_bottle` operation may use an explicit `kind: "create"` Entity
  choice;
- a required reference repair stays inside the primary `create_bottle` or
  `repair_bottle` decision;
- supplemental operations are optional cleanup and never prerequisites for a
  safe reference decision.

The server can mechanically block duplicate operations, no-op patches,
conflicting writes to the same field, unknown ids, unsupported role values, or
impossible source/destination combinations. It does not decide whether two
Bottles or Entities are semantically identical, whether an Entity is the right
Brand/distiller/bottler for the product, or whether cited evidence is
persuasive. Existing target ids must be loaded through classifier tools before
proposal, but code does not require a heuristic notion of “relatedness.”

An `update_bottle` must not target a Bottle that is also a `merge_bottles`
source in the same batch. The merge retires the source and subsumes correction
of that row, so the two proposals are redundant and not independently
executable. Existing batch preparation blocks both if the model returns them.

Because operations execute independently against reviewed state, two merges of
the same resource type cannot share a source or destination in one batch. A
valid fan-in merge requires a separate check prepared after the first merge
completes.

The agent may propose an Entity operation only when it materially repairs the
checked Bottle, an exact duplicate of that Bottle, or an Entity directly
involved in representing it. This is semantic prompt and eval policy. Code does
not approximate it with graph distance, name similarity, or search rank.

This leaves some valid compound changes as two checks. That trade-off
is preferable to adding a workflow graph before a real case proves it
necessary.

### Decision: One classifier capability handles both Bottle intents

The existing Bottle classifier remains the semantic decision-maker. The prompt
has stable shared identity and operation-review sections followed by one small
intent-specific section.

Each non-ignored reference and each audit uses exactly one bounded semantic
agent loop. A reference returns its strict authoritative decision plus findings;
an audit returns a strict summary plus findings. Operations are recorded only by
successful proposal-tool calls and attached by runtime with the artifacts and
the single run's model metadata. There is no additional semantic agent call or
intermediate result contract.

Reference resolution settles identity first and may opportunistically record
directly related repairs surfaced by the same evidence. Those proposals are not
a completion requirement for the reference decision. Audit is the active repair
intent: its eval contract requires supported repairs and their evidence.

Closed-form deterministic identity remains useful but is passed to the agent as
an `identityAnchor`. The agent may preserve it or revise it when stronger
inspected evidence proves it points at the wrong catalog row. Determinism does
not suppress the one semantic loop.

Full Bottle checks have two bounded read-only context tools for inspecting
known operation targets:

- `get_bottle_context`, returning one Bottle's complete exact/shared state,
  BottleGroup siblings, aliases, related Entity ids, Bottle observations, and
  bounded identity-bearing public images already attached to the Bottle or its
  activity;
- `get_entity_context`, returning one Entity's metadata, aliases, roles, and
  bounded related Bottle samples.

Audit mode differs by preloading the audited Bottle's context. Open-expansion
runs also retain `search_bottles`, `search_entities`, and focused web search, whose
descriptions permit identity repair and audit use rather than only match/create
blocking cases. Full mutation-impact previews are not agent tools; operation
preparation owns them. The classifier gains no mutation, approval, generic
database, or queue tools.

`candidateExpansion: initial_only` disables candidate, Entity, and web search,
but keeps both context tools so the agent can inspect ids already present in its
input before recording a proposal. Local match-only identification remains a
separate mode and receives neither context nor proposal tools.

The four proposal tools are always present on full reference and audit runs:
`propose_update_bottle`, `propose_merge_bottles`, `propose_update_entity`, and
`propose_merge_entities`. Tool arguments omit the operation `type`; the tool
adds it. Sparse update tools use provider non-strict schemas and immediately
parse through the canonical strict schema. Merge tools use provider-strict
schemas.

The collector accepts a proposal only when the canonical payload parses, every
existing target was inspected, every Bottle and Entity target is cited, every
evidence reference was collected, and the bounded per-run proposal count
remains available. Repeating an existing type/input pair revalidates and
replaces its rationale and evidence in place so the agent can correct stale
support without creating a duplicate. Rejection is visible to the agent and
records no work. The collector does not resolve conflicts, order work, or
support withdrawal. Server preparation owns live-state and execution checks.

Bottle evidence excludes user identity, private activity, tasting prose,
consumer counts, and unrelated social data. The context adapter passes the
bounded public images through the classifier's existing image-evidence
extractor and returns the normalized label evidence with its source and URL;
the semantic agent is not expected to infer image contents from a URL alone.
Image extraction scans the complete readable label, including smaller
secondary bands, subtitles, and neck tags, for identity-bearing edition, batch,
release, finish, and variant text.
This reuses an existing extraction boundary rather than adding another
remediation agent. It is evidence for identity repair, not permission to
rewrite user activity.

The runtime records structured results from both context tools in the check
artifacts alongside candidates, resolved Entities, and web evidence. Review and
inspected-target validation use those immutable artifacts rather than traces or
live reloads.

Retrieved pages, source text, and tool results are untrusted evidence. They
never enter the stable instruction channel and cannot grant permissions, change
intent, or authorize application.

The server generates each provider JSON Schema from its canonical Zod schema.
The reference final schema contains the decision fields and findings; the audit
final schema contains summary and findings. Both use provider strict mode.
Sparse update proposal tools use provider non-strict argument schemas and parse
immediately through canonical Zod; merge proposal tools use strict argument
schemas. A schema-invalid final output fails the whole run, while an invalid
tool call records no proposal and returns a rejection to the agent.

After parsing, each valid proposed operation is prepared independently. An
unknown id, direct conflict, or currently unexecutable operation is retained as
`blocked` with a concrete preparation error. It does not erase valid siblings
or rewrite the authoritative final decision.

For reference resolution, the existing review policy finalizes the agent's
authoritative decision. Grounding failures have already been rejected by the
collector and are not durable operations. Server preparation checks each
collected operation independently against live mechanical and current-state
constraints, retaining later failures as blocked without discarding the
authoritative decision or valid sibling operations.

When the invoking workflow automatically applies a primary create or repair,
supplemental operations are prepared only after that mutation commits. In
reviewed workflows they may be previewed immediately, but cannot be applied
until the exact store-price attempt linked to the check has an `approved` or
`ignored` final status. A store-price check without that exact attempt, or with
a mismatched proposal or price link, is rejected at persistence. Preview and
approval then prepare again against resulting current state.

### Decision: Persist current check workflow and its operations

Because existing-Bottle audits do not have a store-price attempt, the durable
batch boundary becomes a small shared check record:

`bottle_check`

- id;
- intent;
- origin;
- source kind/id or audited Bottle id;
- server-owned schema version;
- sanitized immutable input snapshot that omits inline image bytes;
- intent-specific output without artifacts, plus one artifacts snapshot,
  model metadata, and timestamps;
- optional link to the store-price match attempt/proposal that invoked it;
- stable subject identity for current-work lookup;
- optional closed-by moderator, close timestamp,
  `dismissed | resolved_manually` close reason, and close note.

`bottle_operation`

- id and check id;
- strictly parsed proposal, whose validated evidence references remain its
  single evidence source, plus a server-owned state token after successful
  preparation;
- concrete preparation error when blocked;
- `blocked | pending_review | rejected | applying | applied | stale | failed`;
- reviewer and review timestamp;
- structured rejection reason and optional reviewer note;
- safe execution result/error and timestamps.

The immutable operation id is the dispatch and retry identity. V1 does not add
array order, per-operation schema versions, or a second idempotency key.

The initial rejection reasons are `wrong_target`, `wrong_change`,
`insufficient_evidence`, `resolved_manually`, and `other`. A note is required
for `other`. This is review feedback, not an agent-visible decision rule.

Clean moderator audits are returned directly without persistence. Background
audits retain their event-key receipt for retry safety. Findings and
`pending_review | blocked | stale | failed` operations need disposition;
`applying` remains visible as in progress. A check with no findings leaves the
queue automatically once every operation is `applied | rejected`. A moderator
may close remaining findings or blocked/stale/failed work as `dismissed` or
`resolved_manually`, with one optional note. Findings do not get their own
state machine. A check cannot close while an operation is `pending_review` or
`applying`.

In the normal moderator flow, before an audit calls the model, it returns any
open audit for the Bottle that has findings or an operation in
`blocked | pending_review | applying | stale | failed`. When no current work
exists, a clean result stays transient and removes older terminal moderator
audits. An actionable result persists one new check and also removes older
terminal moderator audits for that Bottle. It does not delete blocked, pending,
applying, stale, or failed work.

Background callers use a durable uniqueness key for the triggering event.
Their receipts and store-price reference checks keep their existing lifecycle.
No separate plan revision, dependency, event, or history table is introduced.
Live preparation prevents an already-applied change from being applied twice.

For v1, the exact store-price attempt linked to a check is the sole terminal
authority for that check's primary resolution decision; the mutable proposal
remains queue correlation. A forced rerun creates a new attempt and check, so it
does not reopen an older check whose linked attempt is already terminal.
Deleting the linked attempt clears the check link and makes execution fail
closed. The linked check remains supporting workflow evidence; replacing
price-workflow ownership requires a later explicit change.

Store-price checks remain in Incoming Listings. Post-user-creation and
moderator-triggered audits appear in one small Bottle Checks workstream, one row
per open check rather than one row per operation.
An Incoming Listings row remains while any linked check has findings or an
operation that still needs disposition, even when the primary store-price
decision is already complete. The listing is counted once and displays the
primary decision as complete.

### Decision: Preview and revalidation are server-owned

The review API builds a live preview for each operation:

- Bottle update: exact/shared field diff and affected BottleGroup members;
- Bottle merge: source, survivor, tombstone outcome, and consumer counts;
- Entity update: field diff and affected Bottles/series;
- Entity merge: source, survivor, aliases, roles, and affected catalog counts.

Model rationale and collected evidence are displayed, but live server state and
canonical schemas are authoritative for what can execute. Code verifies that
evidence references exist; the agent and moderator judge their relevance,
quality, and semantic support.

Review cards are read-only. They link to existing Bottle and Entity moderator
editors for corrections. After a manual correction, refreshed preparation will
mark the pending operation stale or the moderator may reject it as
`resolved_manually`; the moderator can then close the check as
`resolved_manually`. V1 does not add editable proposals, amendments, or
replacement-operation revisions.

Approval requires moderator authority, locks the operation row, reruns
preparation, and atomically records the reviewer while moving
`pending_review -> applying`. The state token covers only the fields and
relationships the operation depends on; unrelated record changes and broad
`updatedAt` drift do not make an operation stale. Relevant drift marks the
operation stale without mutation.

For inbox purposes, `pending_review | blocked | stale | failed` need
disposition, `applying` is in progress, and `applied | rejected` are done.
Only `failed` operations can be retried directly, using the same operation id.
Retry first reconciles prior execution: a confirmed mutation becomes `applied`;
an unapplied operation that passes live validation returns to `applying`;
relevant drift becomes `stale`; and an indeterminate result remains `failed`
with a safe error. Blocked or stale work requires a new check or manual
correction. Applying work is reconciled rather than manually redispatched.
Approval, rejection, and retry are forbidden once the parent check is closed;
further work requires a new check.

When a check has no findings and every operation is applied or rejected, it
leaves its inbox automatically. Explicit close is reserved for remaining
findings, blocked/stale/failed work, dismissal, or manual resolution.

### Decision: Execute each operation through a canonical service

Each operation's plain `execute` function delegates:

- `update_bottle` to `updateConcreteBottle`;
- `merge_bottles` to `mergeConcreteBottles`;
- `update_entity` to a canonical service extracted from the current update
  route;
- `merge_entities` to the established Entity merge workflow, extended to
  report completion against the review operation.

The execute functions do not copy route mutation logic. Entity merge remains
asynchronous; its operation stays `applying` until the job records success or
failure. Other operations may execute synchronously when their canonical
service already does so.

The operation record always identifies the approving moderator. Asynchronous
jobs receive the operation id and approving moderator actor. Catalog mutations
are attributed to that moderator; the system actor records execution metadata.
Change/audit records link back to the operation so the history does not look
like unprompted automation.

“Approve selected” is UI convenience, not an atomic transaction. Each operation
has its own result, and a failure does not roll back an independent operation
that already succeeded.

Approval is persisted before apply dispatch. Every dispatch carries the
immutable operation id. The execute function either records its
authoritative result in the same transaction as the mutation or supports
reconciliation after a crash between mutation commit and result recording.
Terminal success is based on the canonical service result or resulting database
state, not successful job dispatch alone.

### Decision: Test intent and operations separately

Reference-resolution evals keep all current decision assertions and hard-gate
canonical schema, inspected-target, and collected-evidence grounding. Exact
expected operation and finding sets, including missing and extra entries,
remain named diagnostic scores. A fixture cannot prove that an otherwise
supported proposal is harmful merely by omitting it, and moderator approval
remains the mutation boundary. Production cases still keep their observed
repair targets without turning every reference into an audit. Audit evals
hard-gate exact operations, findings, and required evidence, including whether
clean Bottles produce neither.

Across both intents, reports include:

- exact operation type and target ids/drafts/patches;
- missing supported operations, diagnostic for references and gating for
  audits;
- extra operations and findings;
- entity-role correctness;
- target grounding in collected artifacts;
- schema and policy survival;
- useful non-executable findings;
- noisy or unrelated findings and operations;
- cost, latency, and tool use.

Operation-set mismatches remain diagnostic for references because a fixture
cannot enumerate every supported proposal and every proposal requires human
approval. For audits, exact repair is the completion contract. Production
fixtures retain the real input, catalog state, verified online evidence,
expected intent-specific result, and exact Peated operations.

The initial semantic audit corpus stays deliberately evidence-honest and
small: one synthetic clean/no-op case, plus one curated audit variant derived
from the verified Laphroaig Càirdeas production reference miss. The audit
fixture records that it is derived rather than claiming a second observed
production failure. We do not invent semantic repair cases merely to enumerate
the operation union. Bottle/Entity operation-shape breadth, invalid
combinations, grounding failures, and cross-operation conflicts belong in
deterministic contract and policy tests plus server integration tests.

### Decision: BottleGroup repair is a planned follow-up

V1 may return a `bottle_group` finding when a unique Bottle appears to be in the
wrong group and no exact Bottle merge resolves it. It does not invent a group
mutation before Peated has a canonical service for one.

After v1 produces real reviewed cases, a separate change will decide which
minimal operations are actually needed—such as moving a Bottle between groups
or merging groups. That design must preserve Bottle ids and consumer
references, distinguish regrouping from exact Bottle merge, rematerialize
shared fields transactionally, resolve representative and alias behavior,
recompute aggregates, and record an auditable before/after result. It should not
add move, merge, and split operations merely for symmetry.

## Risks / Trade-offs

- **The operation union grows into a generic workflow engine.** Add only
  resource-specific operations backed by an existing canonical service and a
  real reviewed use case.
- **The classifier overreaches from one Bottle into broad Entity cleanup.**
  Require existing ids to be loaded, use a configurable runaway-output safety
  ceiling, retain evidence for review, report extra proposals diagnostically,
  and measure moderator rejection and correction.
- **One invalid proposal hides valid work.** Reject invalid tool calls without
  disturbing recorded siblings, then prepare accepted operations independently
  and retain later preparation failures with explicit reasons.
- **Independent execution produces partial results.** Make independence
  explicit and display per-operation outcomes.
- **Entity merge is asynchronous.** Keep an `applying` status and have the
  existing job report terminal state.
- **Two classifiers may eventually emit Entity operations.** Share operation
  schemas and execute functions, not prompts or check contracts, until an
  explicit convergence change is justified.
- **Current state changes before approval.** Rebuild previews and run canonical
  validation immediately before mutation.

## Delivery

1. Introduce the intent and operation schemas while preserving the current
   resolve-reference adapter.
2. Add intent-specific evals and persist checks in their owning workflows.
3. Persist checks and expose read-only operation previews.
4. Enable moderator approval for Bottle operations.
5. Extract and test the canonical Entity update service, then enable Entity
   operations.
6. Enable `audit_bottle` for individual moderator-triggered runs.
7. Extend `VerifyBottleCreation` with idempotent post-create checks for 100% of
   eligible `manual_entry` Bottles and a deterministic `price_match_automation`
   sample that defaults to 10%.
8. Expand source kinds or change the automation sample only after review
   precision is acceptable.
9. Use reviewed `bottle_group` findings to scope a separate BottleGroup-repair
   proposal around the smallest operations demonstrated by real cases.

Rollback removes the new entrypoints and operation approval routes. Current
store-price decisions and manual Bottle/Entity controls remain available.
Already applied operations remain normal catalog changes.
