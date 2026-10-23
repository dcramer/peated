## Why

Peated has no administrator-wide way to browse member reviews or tastings. Critic reviews are visible only inside each scraper source, and that table does not expose a durable moderation action. Administrators can permanently delete a tasting, but member reviews and critic reviews follow different rules. This makes it hard to inspect reported content, remove it safely, and understand who changed its visibility.

## What Changes

- Add a separate Content group to Admin navigation with Reviews and Tastings destinations.
- Put member and critic reviews under one Reviews destination with source-specific tabs and detail pages.
- Add administrator-only list and detail reads that can inspect active and removed content, including private member content when moderation requires it.
- Add reversible `Remove from Peated` and `Restore` actions for member reviews, critic reviews, and tastings. Require a reason and record the administrator, timestamp, and durable history without copying content into the audit record.
- Keep manual moderation separate from critic-review staging and source publication so a scraper run or publication change cannot restore content removed by an administrator.
- Exclude removed content from ordinary APIs, pages, feeds, interactions, recommendations, ratings, tasting-note summaries, and public counts while retaining it for administrator review.
- Keep member-owned deletion as the existing permanent deletion path. Administrators do not edit a member's words or rating as part of moderation.

## Capabilities

### New Capabilities

- `content-moderation-admin`: Defines administrator content browsing, review and tasting information architecture, private-content access, reversible removal, restoration, and moderation history.

### Modified Capabilities

- `ratings-and-reviews`: Excludes moderator-removed records from rating and tasting-band calculations and defines recomputation after moderation changes.
- `public-review-and-tasting-aggregation`: Excludes moderator-removed records from combined public lists, counts, and tasting-note summaries.

## Impact

- Adds nullable moderation columns to tastings, member reviews, and external reviews, plus object kinds needed to record member-review and external-review changes. Migrations are generated with `pnpm db:generate`.
- Adds strict administrator-only content schemas and routes under `apps/server/src/orpc/routes/admin/`, with source-specific moderation mutations and integration tests.
- Requires every read, interaction, aggregate, recommendation, badge, and summary consumer of the three source tables to apply the removal rule.
- Adds `/admin/reviews`, member-review and critic-review tabs and details, and `/admin/tastings` list and detail routes under `apps/web`.
- Updates Ratings, External Reviews, and administrator documentation. It does not expose stored external-review bodies, add content to the Moderation Inbox, change scraper publication approval, or add a generic moderation workflow engine.
