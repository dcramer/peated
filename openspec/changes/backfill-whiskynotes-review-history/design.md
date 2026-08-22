## Context

The WhiskyNotes adapter currently scans pages 1 through 5 in one manual run.
Its run cursor supports retries and worker deferrals, but a later run starts
with an empty cursor. The scraper runtime limits each run to ten worker attempts
and 24 hours. A full archive crawl cannot fit inside one run under the source's
30-request hourly quota.

## Goals / Non-Goals

**Goals:**

- Collect the WhiskyNotes archive over several bounded daily runs.
- Continue current review collection while the history import runs.
- Reuse existing request controls, parser, sink, and Bottle matching.
- Accept cursors written by the current adapter during a deployment.

**Non-Goals:**

- A general backfill framework or a second historical source.
- New database tables, admin controls, or request policy settings.
- Faster source request rates or a full archive import in one run.

## Decisions

### Opt one source into cursor continuation

Add one optional source-definition flag that seeds a new run from the last
successful run's cursor. Only WhiskyNotes enables it. Failed runs do not become
the starting point for new work. The existing run cursor remains the durable
state, so this change needs no schema migration.

The alternative was a new backfill table or source-specific state in the run
lifecycle. Both add more storage and ownership rules for the same cursor.

### Refresh current reviews before advancing history

The WhiskyNotes cursor tracks the current page URLs separately from the active
historical page. Each run first reads page 1 and emits new current articles.
It then resumes the historical page and processes at most four pages. Page 1
can serve both roles on the first run without a second request.

Four history pages plus the current page fit within the existing run-attempt
limit under normal hourly quota deferrals. This keeps the maximum daily request
volume close to the existing five-page pilot.

### Mark the archive end in the cursor

When an archive page has no next-page link, the cursor records that history is
complete. Later runs still refresh page 1 but do not request older pages.
Article checkpoints remain after successful sink storage, so a failed item is
eligible for replay.

The cursor keeps the current `page` and `processedArticleUrls` fields and adds
fields with defaults. This lets the new schema parse stored cursors from the
deployed adapter.

## Risks / Trade-offs

- **Archive markup changes during the import** → The existing strict parser
  fails the owning run and preserves the last successful cursor.
- **A run receives extra quota deferrals** → The run can fail at its execution
  limit. A later daily run restarts from the last successful run.
- **Historical progress is gradual** → Four pages per day favors stable,
  friendly collection over a burst crawl.

## Migration Plan

Deploy the compatible cursor schema, continuation flag, adapter change, and
daily schedule together. Existing active WhiskyNotes runs can resume with the
new cursor defaults. To stop the import, restore the source to manual scheduling
or remove cursor continuation; stored review data remains valid.

## Open Questions

None.
