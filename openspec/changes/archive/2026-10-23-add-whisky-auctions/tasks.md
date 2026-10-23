## 1. Model and persistence

- [x] 1.1 Add auction events, lots, result revisions, watches, and alert constraints and generate additive migrations.
- [x] 1.2 Implement validated repeat-safe ingestion, freshness/deadline availability, result revisions, and version-checked Bottle assignments.
- [x] 1.3 Integrate accepted references and classifier/review evidence; preserve auction references during Bottle lifecycle operations.

## 2. Collection and alerts

- [x] 2.1 Add an auction sink and runtime source integration with complete resumable discovery and closing-result reconciliation within the recent auction window.
- [x] 2.2 Verify and document the initial source's actual accessible identifiers, state/result semantics, and activation limits.
- [x] 2.3 Add private exact-Bottle subscriptions and transactional, durably deduplicated in-app alerts.

## 3. API and product

- [x] 3.1 Add public Bottle auction/history reads and protected watch/match operations with serializers.
- [x] 3.2 Show availability, result history, and watch controls on Bottle pages; render auction notifications.

## 4. Verification and handoff

- [x] 4.1 Add integration coverage for identity, relisting, results, deadlines, stale matching, permissions, and alert retries.
- [x] 4.2 Run focused tests, server/web typechecks, formatting, lint, and appropriate manual QA.
- [x] 4.3 Document the shipped model and source operation; reconcile the proposal with implemented behavior and remaining activation limits.
- [x] 4.4 Enable Scotch Whisky Auctions for manual runs, recheck public pages with the real parser, and document the production rollout. Keep automatic collection unscheduled until full-run capacity and live markup are checked.

## Verification scope

Backend checks cover ingestion through sink, matching worker, public reads,
private watches, notification creation and dismissal, reference correction,
and Bottle merge/delete behavior. Server and web typechecks and changed-file
lint/format checks pass. The focused backend checks passed (140 tests), and
the full web unit suite passed (533 tests).

Manual browser QA used the real Bottle auction route with a local mock API at
1440×900 and 390×844, including light/dark system preferences, source links, tab selection,
no horizontal overflow, and the signed-out watch redirect. The accessibility
check reported no confirmed violations; one contrast check
needs manual review. Authenticated browser mutations and a live Redis/model
run were not exercised; backend integration tests own these side effects.
Full repository tests remain a PR CI check. No production migration, source
activation, or archive backfill was performed. Live-auction verification and
targeted hourly collection remain explicit activation/follow-up limits in
the feature document.

The manual-rollout follow-up passed 76 focused scraper tests, server typecheck,
changed-file lint and formatting, and strict OpenSpec validation. Five spaced
public requests with Peated's crawler identity verified robots, discovery,
first/final-page parsing, and closed results. The registry is now enabled for
manual collection; production was still disabled and unscheduled at the
read-only health check. Deployment and the first full production run remain
operator steps in `docs/operations/auctions.md`. No production writes or
automatic schedule changes were made.
