## Context

The scraper runtime already separates remote requests, durable runs, adapters,
and sinks. Review adapters also share one strict article observation and one
ingestion boundary. The remaining source-specific work is compiled into the
application: an external-site constant, target registration, adapter, parser,
and tests for each publisher or store.

The new path must keep the runtime's exact-origin, robots, request-budget,
retry, and idempotency rules. It must also preserve the review and store-price
ingestion boundaries. Publisher HTML remains transient.

## Goals / Non-Goals

**Goals:**

- Let an administrator add a source without deploying application code.
- Let one site collect reviews, store prices, or both.
- Store immutable config versions in PostgreSQL and make activation and
  rollback explicit.
- Use the same parser and validator for preview and production collection.
- Let one constrained LLM call create a draft config for a new or changed site.
- Keep existing code adapters available while configured sources prove their
  coverage.
- Keep the shared code small and test each ownership boundary independently.

**Non-Goals:**

- An unrestricted crawler, browser automation, authenticated scraping, or
  evasion of remote controls.
- Automatic rights decisions, origin changes, or request-policy changes.
- Automatic activation of an LLM-generated repair in the first release.
- Replacing all current adapters before the configured path is measured.
- A workflow engine, several agents, config inheritance, arbitrary scripts, or
  arbitrary regular expressions in stored config.

## Decisions

### Separate the site, collection, and config version

An `external_site` remains the remote publisher or store. A new configured
scraper record identifies one collection at that site: `reviews` or
`store_prices`. It owns enablement, LLM permission, starting URLs, and the
active config pointer. A site may own at most one configured scraper of each
collection type.

Config versions are append-only rows. Each stores one strict JSON config,
creation provenance, and its latest validation result. The configured scraper
points to one active version. Activation changes the pointer in a transaction;
rollback points it to an older validated version. Editing always creates a new
draft.

This is two tables instead of one status-heavy version table. It keeps mutable
operating state separate from immutable versions and makes one active version
an ordinary foreign-key invariant.

### Keep network authority outside generated config

An administrator creates the site's exact origin and a conservative target
policy. The database stores whether a target, origin, and site-target mapping
is code-owned or admin-owned. Definition synchronization updates only
code-owned rows, so it cannot disable admin-owned sources during startup.

Stored extraction config cannot contain origins, headers, credentials, request
limits, robots exceptions, or browser actions. Preview, generation, and normal
collection all use the existing governed request session.

Alternative considered: let the LLM return a complete scraper definition. This
was rejected because page content and model output cannot own network access.

### Use one small config language

Version 1 supports a bounded index page plus detail pages. It contains:

- collection type and schema version;
- selectors for detail links;
- a maximum item count;
- field selectors relative to an article, review, or product container;
- fixed field readers for text, attributes, dates, native scores, money,
  currency, volume, URLs, and optional identifiers.

Selectors select data only. Transforms are code-owned and named. Config cannot
contain JavaScript or free-form regular expressions. Review output must parse
to `ExternalReviewArticleIngestionSchema`; price output must parse to a bounded
array of `StorePriceInputSchema`.

Version 1 does not support archive pagination, browser rendering, APIs, or
source-specific request bodies. Current adapters remain the escape hatch for
those cases.

### Resolve a source for each durable run

Current code sources continue to come from the production registry. A run for
a configured scraper records the configured scraper id and exact config
version id. The runtime builds its source definition from that immutable
version and the separately approved database target. A resumed or retried run
therefore cannot switch config midway through execution.

Preview is a bounded manual run with an in-memory product sink and a stored
structured result. It never calls review or price persistence. Normal runs use
the existing external-review or store-price sink selected by the collection
type.

### Treat LLM generation as a proposal

The administrator supplies one index URL and representative detail URLs. The
generation service fetches them through the scraper runtime and sends only the
transient page content, the requested collection type, and the strict config
schema to one model call. The source must explicitly allow LLM processing.

The model has no tools. It returns one config candidate. Code validates the
schema, rejects selectors or URLs outside the contract, stores a draft, and
runs the normal preview validator. The prompt, model, and engine version are
stored with the draft. Failure creates no config and logs no page content.

Alternative considered: run an autonomous repair agent. This was rejected
because one bounded structured generation call is enough and is easier to
test.

### Use the same admin flow for new sites and changes

Admin → Scrapers gains an Add Site action. A site page gains a Configs tab with
one section per collection type. The flow is:

1. create or select the collection;
2. generate or enter a draft;
3. preview structured results from current pages;
4. activate a passing draft;
5. inspect version history or roll back.

Preview shows extracted fields, warnings, the active-versus-draft difference,
and canonical source links. Raw HTML and publisher prose are not stored.

### Test code and live config separately

The config interpreter is a function with no database or network access. Unit
tests pass synthetic HTML and strict config into it. Integration tests own
database versioning, permissions, run pinning, sinks, and route behavior.
Model-sensitive config generation uses focused evals and does not enter
`pnpm test`.

Every draft uses the production interpreter and validator before activation.
Live validation fetches several current pages and stores only structured
results and warnings. Production runs apply the same validator, so preview
cannot approve behavior that production would reject.

## Risks / Trade-offs

- **A selector returns plausible but wrong content** → Validate required facts,
  compare drafts with active output, keep first activation review-only, and
  show every changed field in preview.
- **A model update produces worse configs** → Record and pin model and prompt
  versions, keep all prior configs, and require preview before activation.
- **Database-owned targets bypass startup policy** → Use conservative defaults,
  enforce robots, separate target ownership, and require moderator routes for
  all network changes.
- **The first config language does not cover a source** → Keep the current code
  adapter and add a shared reader only after repeated sources prove the need.
- **Live preview is slow or deferred** → Run it through the durable scraper
  runtime and show its normal queued, running, or failed state.
- **Dynamic site keys weaken compile-time source lists** → Keep a separate
  registered-source type for code adapters and validate public site keys as
  bounded slugs resolved against the database.

## Migration Plan

1. Add the configured scraper, config version, target ownership, and run
   reference columns with no behavior change.
2. Add strict config schemas, the interpreter, validator, and deterministic
   tests.
3. Add database services and moderator routes for site creation, drafts,
   preview, activation, disablement, and rollback.
4. Add dynamic run resolution and reuse the existing review and price sinks.
5. Add the single-call LLM draft generator and focused eval harness.
6. Add the Configs admin tab and Add Site flow.
7. Pilot one review source and one simple store source in review-only or hidden
   mode. Keep their current adapters until results agree.

Rollback disables the configured scraper and reactivates the prior config or
the existing code adapter. Additive tables and columns remain in place so run
history stays valid.

## Open Questions

- Which existing review and store sources are the best first fixtures for the
  version 1 selector language?
- After measured pilot results, which exact validation results can permit
  automatic repair activation, if any?
