## Context

The Whiskyfun adapter reads at most 20 current articles from RSS. Whiskyfun
also publishes half-month archive pages. Each archive page contains several
daily entries. The entries have stable date anchors, titles, review text, and
scores. Each archive page links to the older and newer neighboring pages.

The source allows 25 requests per hour and spaces requests by 2.5 seconds. A
full current run can use 21 requests: one feed and 20 articles. Historical work
must fit in the same source policy.

## Goals / Non-Goals

**Goals:**

- Import Whiskyfun history over several successful daily runs.
- Keep the current RSS import unchanged and first in each run.
- Preserve the public daily anchor, title, and publication date.
- Reuse the existing request runtime, review parser, sink, and Bottle matcher.
- Accept cursors written by the current adapter.

**Non-Goals:**

- A general archive crawler or a second cursor continuation mechanism.
- New database tables, admin controls, or request policy settings.
- Faster source request rates or a full archive import in one run.
- Import of rum, brandy, or other non-whisky sessions.

## Decisions

### Traverse one archive page per run

The first historical run reads the public homepage and selects the newest valid
archive page. Each archive page then provides the link to the next older page.
Later runs request that saved page directly. This avoids downloading the large
homepage on every run.

Each run processes one archive page after current RSS work. A first run uses at
most 23 content requests. Later runs use at most 22. Both fit the existing
25-request hourly target quota.

The alternative was to save the full archive index or add a configurable page
count. The full index makes the cursor large, and a page count adds no value
under the current quota.

### Store progress in the compatible source cursor

The Whiskyfun cursor keeps its current article URLs and adds the next archive
URL, processed daily entry URLs for the active archive page, and a completion
flag. New fields have defaults so stored current-only cursors remain valid.
Whiskyfun enables the existing successful-run cursor continuation option.

The adapter checkpoints each stored daily entry. A retry can then skip entries
whose sink work completed. After a page completes, the cursor advances to the
older linked page and clears its per-page entry list.

### Treat each date anchor as one historical article

The adapter splits an archive page at publisher-provided six-digit date
anchors. It uses the archive URL plus that anchor as the canonical link and
derives the publication date from the anchor. It uses the first suitable daily
heading as the title and a date-based title when the page has no heading.

This preserves stable public links and dates. Treating a half-month page as one
article would lose daily dates and create an unusually large record.

### Keep non-whisky filtering beside the Whiskyfun parser

Archive days can contain several sessions. The parser tracks the current
session heading and ignores review candidates under a non-whisky heading. The
same existing category terms used for RSS titles apply here. The score parser
accepts the hyphen and dash characters found across old and current pages.

## Risks / Trade-offs

- **Old markup can differ from current samples** → The adapter validates date
  anchors and archive links. Unexpected review-shaped content fails the run and
  preserves the last successful cursor.
- **One old page contains many reviews** → The source makes one historical
  request per run. Sink checkpoints prevent completed daily entries from being
  repeated after a retry.
- **The oldest page has no older link** → The cursor records completion.
  Later runs continue only the current RSS check.

## Migration Plan

Deploy the compatible cursor schema, adapter change, and registry opt-in
together. Existing active cursors receive defaults when parsed. To stop the
history import, remove the continuation opt-in or set the completion cursor;
stored review data remains valid.

## Open Questions

None.
