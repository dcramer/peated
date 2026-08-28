## Context

The scraper runtime already owns requests, robots rules, limits, retries,
durable runs, and product writes. Source-specific page parsing still lives in
code. This change adds a database path for simple HTML sources. Publisher HTML
stays transient.

## Goals

- Let an admin add and repair a simple source without a deploy.
- Keep one clear term for each stored concept.
- Pin every run to immutable parsing rules.
- Use the same parser for preview and collection.
- Keep AI optional and unable to change active behavior.
- Keep the first rules format small.

## Non-Goals

- A general crawler, browser automation, authenticated scraping, or evasion.
- Custom scripts, headers, request bodies, or regular expressions in rules.
- Automatic activation of AI suggestions.
- A workflow engine or multi-agent repair system.
- Event parsing before event match and update behavior is defined.

## Stored Terms

`external_site` identifies the remote publisher or store. It remains the owner
of run history and product source identity.

`scrape_source` describes the site's collection intent. Its `kind` is `review`
or `price`. A site owns one source. The source stores enablement, AI permission,
sample URLs, and the current list URL.

`scrape_source_revision` stores an immutable parsing-rule revision. It pins the
list URL, rules format, rules, creation method, and latest test result. A
partial unique index permits one active revision for each source.

`scrape_source_run` links a durable external-site run to its source and
revision. Composite foreign keys prove that the run, source, revision, and site
belong together. A suggestion run starts without a revision and records the
new revision after the model response passes validation.

The small source-kind enum represents code-supported behavior. Site keys stay
text because admins can add them without a deploy. A TODO beside the enum marks
the planned `event` kind and its required product boundary.

## Network Control

An admin creates the exact origin and a conservative request policy. Targets,
origins, and site mappings record `managed_by` as `code` or `admin`. Startup
sync changes code-managed rows only.

Parsing rules cannot contain origins, credentials, headers, robots exceptions,
or retry policy. The list URL can change only within the source's current
origin. Preview, AI sampling, and collection use the normal governed request
session.

## Rules Format 1

The first format supports one bounded list page and same-origin detail pages.
It has CSS selectors for detail links and known review or price fields. Code
owns date, score, money, currency, and volume conversion.

The rules do not include their own format number. The revision column is the
single source of truth for format dispatch. The format does not support
pagination, browser rendering, APIs, or custom transforms. A code source is
the escape hatch for those cases.

## Revision Lifecycle

Editing always creates a revision. Preview runs that exact revision and stores
only parsed fields and bounded issues. It does not store fetched HTML, review
text, or products.

Activation locks the source, requires a passing test, clears the old active
revision, activates the selected revision, and enables the source. It also
makes the revision's list URL current for later suggestions. Rollback uses the
same operation with an older passing revision.

A collection run selects the active passing revision before queueing. The run
keeps that revision across retries even if an admin activates another one.

## AI Suggestions

AI is allowed only when the source opts in. It is available for the first
revision or after the latest revision fails its test. The server fetches a
bounded list of approved pages and makes one structured model call with no
tools and provider storage disabled.

Code validates the returned rules and source kind before it stores a revision.
The model and prompt revision are stored as provenance. An admin must preview
and activate the result.

## Admin Flow

1. Add a site and its first review or price source.
2. Enter rules or ask AI for a suggestion.
3. Preview the parsed fields from current pages.
4. Activate a passing revision.
5. Use history to repair, roll back, or pause the source.

The route creates a site with its source. Supporting several source kinds on
one site would also need separate scheduling and run fan-out, so it is outside
this first design.

## Tests

Parser tests use synthetic HTML without a database or network. Integration
tests cover source identity, immutable revisions, activation, run pinning,
preview isolation, and target ownership. Live model quality belongs in
`pnpm evals`, not `pnpm test`.

## Migration

This schema has not shipped. Replace the old generated migration instead of
adding rename SQL or a compatibility layer. The first generated migration adds
management metadata and the run support key. The second adds source tables and
their composite foreign keys. This order is required by PostgreSQL. Keep
existing code sources unchanged during the pilot.

## Open Questions

- Which review publisher and store are the best first pilot sources?
- How will repeated event observations match and update existing events?
- What measured validation result, if any, could permit automatic repair later?
