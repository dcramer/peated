## 1. Intent and Operation Contracts

- [x] 1.1 Preserve `classifyBottleReference` and add `auditBottle`, with intent
      and `moderator | post_user_creation` audit origin fixed by the server.
- [x] 1.2 Preserve the existing reference decision result and define audit
      output as narrative summary, proposed operations, and non-executable findings
      without a redundant outcome.
- [x] 1.3 Add the bounded `ProposedOperation` union for Bottle update/merge and
      Entity update/merge.
- [x] 1.4 Reuse canonical field validators in narrow agent-facing identity
      schemas; add only mechanical checks for inspected ids, supported roles,
      direct conflicts, no-op patches, intent, and a configurable runaway-output
      safety ceiling.
- [x] 1.5 Define the common `{ type, input, rationale, evidenceRefs }` proposal
      envelope, typed evidence-reference union, explicit existing/create Entity
      choices inside Bottle operations, and separate prepared-versus-blocked review
      contracts.
- [x] 1.6 Implement one canonical strict literal-tagged Zod proposal union,
      generate the provider JSON Schema from it, parse raw output back through
      it, keep one strict review union, and use plain exhaustive prepare/execute
      switches. Expose the four proposal tools on every full reference and audit
      run without per-operation capability flags.
- [x] 1.7 Prepare collector-accepted proposals independently, preserving the
      agent result and valid siblings while retaining later mechanical or
      current-state preparation failures as blocked.
- [x] 1.8 Add contract and policy tests for every intent, operation variant,
      invalid combination, required evidence, type/input correlation, and absence
      of mutating tools.

## 2. Classifier Agent and Evals

- [x] 2.1 Refactor classifier instructions into a stable shared Bottle identity
      section plus small intent-specific sections while retaining the existing
      bounded evidence gathering within the same tool loop.
- [x] 2.2 Add bounded Bottle-check context and read-only Bottle, BottleGroup, related
      Entity, sibling, and focused web-evidence tools through
      `get_bottle_context`, `get_entity_context`, existing search, and web search.
      Make resource context available to both full intents, with audit mode
      preloading the audited Bottle. Include Bottle
      observations and bounded identity-bearing public images, but exclude user
      identity, private activity, tasting prose, counts, and unrelated social data.
- [x] 2.3 Reuse the existing image-evidence extractor for selected Bottle
      context images and return normalized label evidence with source and URL
      metadata; do not make the semantic agent interpret opaque image URLs.
- [x] 2.4 Persist structured Bottle and Entity context-tool results in runtime
      artifacts; keep consumer impact and blast radius in server previews.
- [x] 2.5 Add the real Laphroaig Càirdeas production miss: listing `11828042`
      SHALL hard-gate the authoritative decision matching Warehouse 1 Bottle
      `45146` rather than generic Bottle `44288`, plus canonical/collected
      grounding. Preserve `merge_bottles` from malformed Bottle `39096` to
      `45146` as a diagnostic operation-recall target. Record the July 29, 2026
      Peated API state, the official Laphroaig 2022 Warehouse 1 evidence, public
      tasting `223` and its Warehouse 1 label image, and the exact expected Peated
      outcome in the fixture provenance.
- [x] 2.6 Add one synthetic clean/no-op audit fixture and one evidence-backed
      Laphroaig Càirdeas audit fixture derived from the verified production
      reference miss, with provenance that distinguishes the derived audit from
      the observed reference failure.
- [x] 2.7 Cover Bottle/Entity operation shapes, invalid combinations,
      grounding failures, unrelated cleanup, and decision/operation conflicts
      in deterministic contract, policy, and server integration tests rather
      than invented semantic repair fixtures.
- [x] 2.8 Report reference-decision accuracy separately from exact operation and
      finding precision/recall. Hard-gate the authoritative reference decision
      and canonical/collected grounding, keep exact reference operation/finding
      sets—including missing and extra entries—diagnostic, and hard-gate exact
      audit operations, findings, and required evidence.
- [x] 2.9 Run exactly one bounded semantic agent loop for each non-ignored
      reference and each audit. Give it the read tools and four non-mutating
      proposal tools. Reference final output is the strict authoritative
      decision plus findings; audit final output is summary plus findings;
      runtime attaches proposals and artifacts collected during the loop.
- [x] 2.10 Validate proposal-tool payloads through the canonical schemas,
      require inspected existing targets and collected evidence, deduplicate
      exact type/input pairs, and enforce a bounded proposal count. Supply
      deterministic identity as an agent input anchor rather than suppressing
      the agent. Scan smaller readable label regions for identity-bearing text.

## 3. Check Persistence

- [x] 3.1 Add `bottle_check` and `bottle_operation` schemas
      with intent/subject links, immutable snapshots, operation payloads, lifecycle
      status, one check schema version, evidence references, optional prepared state
      token or blocking error, structured rejection/close reasons, reviewer
      metadata, result/error, and timestamps. Use the operation id for
      dispatch/retry identity; do not add array position or per-operation versions.
- [x] 3.2 Link store-price attempts/proposals to checks without replacing their
      current decision fields. Require the exact linked attempt, derive its
      proposal link, and use that attempt's final status as the execution gate.
- [x] 3.3 Generate the database migration with `pnpm db:generate`.
- [x] 3.4 Sanitize persisted input snapshots so inline image bytes are omitted,
      and store intent output and artifacts exactly once.
- [x] 3.5 Implement latest-check history and background-event uniqueness
      without invalidating older proposals solely because a moderator forced a
      newer run.
- [x] 3.6 Add transaction tests for concurrent reruns, latest selection,
      blocked/operation status transitions, and deleted subjects.

## 4. Preview and Canonical Execution

- [x] 4.1 Add live previews for Bottle update/merge and
      Entity update/merge with bounded impact counts and warnings.
- [x] 4.2 Extract a canonical Entity update service from its route handler and
      prove the existing route retains behavior.
- [x] 4.3 Add operation execute functions that delegate to
      `updateConcreteBottle`, `mergeConcreteBottles`, and the canonical Entity
      services.
- [x] 4.4 Extend the Entity merge job to report applying/applied/failed state to
      an originating operation proposal without coupling the job to agent output.
- [x] 4.5 Add moderator-only list, approve-selected, reject-selected, and
      failed-operation retry routes; approval transitions
      `pending_review -> applying`.
- [x] 4.6 Lock each operation and revalidate its narrow state token before
      applying it; mark only relevant drift stale.
- [x] 4.7 Persist approval before dispatch and implement per-operation
      at-most-once dispatch using the operation id plus commit/result
      reconciliation.
- [x] 4.8 Add integration tests for authorization, duplicate approval,
      operation independence, stale checks, catalog drift, async Entity
      merge completion, partial failure, closed-check immutability,
      reconciliation outcomes, allowed/forbidden retries, and retry safety.
- [x] 4.9 Attribute asynchronous catalog mutations to the approving moderator,
      link system execution metadata to the operation, and determine terminal
      success from canonical results or database state.

## 5. Moderator Experience

- [x] 5.1 Add check summaries, findings, and current operation previews to
      store-price queue details without changing existing decision controls; keep
      one Incoming Listings row while supplemental work needs disposition.
- [x] 5.2 Add a Bottle Checks inbox for actionable post-create and
      moderator-triggered audits, one row per open check; keep store-price work only
      in Incoming Listings.
- [x] 5.3 Add an existing-Bottle audit action and result view under the
      moderator Bottle workflow.
- [x] 5.4 Render read-only resource-specific cards with Bottle/Entity editor
      links, rationale, evidence, live diff/impact, warnings, status, and
      disposition controls.
- [x] 5.5 Add approve-selected as explicitly independent processing with
      per-operation results.
- [x] 5.6 Add check close as `dismissed | resolved_manually` without per-finding
      state, prevent closure while operations are pending or applying, and
      automatically remove operations-only checks after all operations are applied
      or rejected.
- [x] 5.7 Add component and route tests for clean audit, findings, pending,
      structured rejection/close reasons, applying, applied, stale, failed,
      unauthorized, duplicate, manually resolved, and mixed results.
- [ ] 5.8 Verify store-price and existing-Bottle audit flows at desktop and
      mobile widths using the local UI verification playbook.

## 6. Rollout and Documentation

- [x] 6.1 Add shadow-generation, moderator-visibility, and execution flags,
      disabled by default.
- [x] 6.2 Enable shadow check generation for individual full reference retries
      and moderator-triggered Bottle audits.
- [x] 6.3 Extend the existing `VerifyBottleCreation` job with an idempotent
      sampled post-create Bottle check that runs only after the end-user save
      commits, replaces the previous Bottle-specific heuristic conclusion, creates
      no duplicate actionable result, and never auto-applies supplemental
      operations.
- [x] 6.4 Preserve automatic primary classification only in the existing
      end-user add-Bottle workflow and its established review policy.
- [ ] 6.5 Measure intent accuracy, schema validity, diagnostic exact reference
      operation/finding sets, exact audit repair, reviewer rejection/correction,
      review time, stale/failure rates, cost, latency, and tool calls before
      enabling execution broadly.
- [x] 6.6 Update Bottle classifier, Entity classifier, whisky identity,
      store-price matching, agent-design, runtime-boundary, and background-work
      docs where their contracts change.
- [ ] 6.7 Run targeted classifier, server, worker, and web formatting, lint,
      typecheck, tests, evals, migration checks, and manual QA.
