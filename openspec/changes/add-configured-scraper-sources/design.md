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
- Keep the first rules version small.

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
list URL, rules version, rules, author, and latest preview result. A
partial unique index permits one active revision for each source.

`scrape_source_run` links a durable external-site run to its source and
revision. Foreign keys prove that both records exist. A composite key proves
that the revision belongs to the source. The run-creation service selects the
source by site and inserts the run and link in one transaction. A suggestion
run starts without a revision and records the new revision after the AI
response passes the server checks.

The short source-kind list represents code-supported behavior. Site keys stay
text because admins can add them without a deploy. A TODO beside the enum marks
the planned `event` kind and its required product boundary.

## Site Creation

The admin enters a site name, website URL, and source kind. The server derives
the internal site key from the website hostname. The key remains visible in
URLs and APIs but is not an admin decision. The website URL becomes the first
list-page candidate.

## Network Control

An admin creates the exact origin and a conservative request policy. Targets,
origins, and site mappings record `managed_by` as `code` or `admin`. Startup
sync changes code-managed rows only.

Parsing rules cannot contain origins, credentials, headers, robots exceptions,
or retry policy. The list URL can change only within the source's current
origin. Preview, AI page reads, and collection use the normal request controls.

## Rules Version 1

The first format supports one bounded list page and same-origin detail pages.
It has CSS selectors for detail links and known review or price fields. Code
owns date, score, money, currency, and volume conversion.

The rules JSON does not include its version. The revision stores the rules
version used to read it. This version does not support
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
revision or after the latest revision fails its test. The server reads the
main page and selects a small number of links on the same website that look
like review or store pages. It fetches those pages and the admin's examples,
then makes one AI request. The response must match the rules format. The AI has
no tools, and provider storage is disabled.

The typed response names one supplied list page. The server runs the returned
list selector against that exact page before it saves the revision. This keeps
list-page selection bounded and testable without a model tool loop. Pagination
remains outside rules version 1 until a pilot proves the required page behavior.

Code validates the returned rules and source kind before it stores a revision.
The system records the AI model name and instructions version. An admin must
preview and activate the result.

## Admin Flow

1. Add a site and its first review or price source from its website URL.
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
preview isolation, and target ownership. Live AI suggestion evals replace only
the publisher website with fixture HTML. They use the real AI service,
database, run code, and preview parser. These evals belong in `pnpm evals`, not
`pnpm test`.

## Migration

This schema has not shipped. Replace the old generated migrations with one
generated migration instead of adding rename SQL or a compatibility layer.
Keep existing code sources unchanged during the pilot.

## Open Questions

- Which review publisher and store are the best first pilot sources?
- How will repeated event observations match and update existing events?
- What measured validation result, if any, could permit automatic repair later?
