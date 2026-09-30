## Context

Peated already has accepted Bottle references, classifier checks, an HTTP scraper runtime with resumable runs and source pacing, and in-app notifications. Retailer listings and catalog listings do not own auction occurrence history. New auction collection must use the current runtime and protect existing sources.

## Goals / Non-Goals

Goals: stable event/lot identity; complete single-bottle listing collection; explicit availability; correct final result history; reviewed Bottle matching; exact-Bottle watches and retry-safe in-app alerts.

Non-goals: physical-bottle tracking, bidding, per-bid history, exchange-rate conversion, fee calculators, sets/multipacks, automatic source activation, or email alerts.

## Decisions

- Add `auction`, `auction_lot`, and `auction_lot_result`. Auctions are unique by site and source auction key; lots are unique by auction and source lot key. A new auction occurrence never updates an older occurrence.
- A lot stores current source state, evidence, source identity fingerprint, nullable Bottle assignment, matching status, and successful check times. Source states are upcoming/live/aftersale/closed/withdrawn/unknown. Freshness and passed deadlines derive availability without inventing closure.
- Store result revisions only when outcome, sale amount, currency, price kind, or source sale time changes. A latest-result query selects one result per lot. Monetary amounts use integer minor units. Amount/currency/kind form a valid combination and prices require a sold outcome. A sold outcome may have no published price.
- Preserve source-reported hammer amounts and price qualifications. Aftersale prices have their own kind; current bids are not results. Source timestamps and observation timestamps are distinct.
- Use accepted references and shared classifier checks, retaining source evidence and rechecking fingerprints before assignment. Moderator assignments are version-checked. Source facts never directly edit canonical Bottle fields.
- Add private `auction_watch` rows and durable `auction_alert` rows. Watches are unique by member and Bottle. Alerts are unique by member and lot and survive notification deletion. Recheck watch, assignment, and availability when creating in-app notifications in the same transaction.
- Reuse scraper runs, pacing, robots handling, sinks, and checkpoints. Auction adapters discover complete pages and revisit known lots rather than applying retailer expiry rules. A source is runnable only after verifying its source contract and permitted use. Public-only sources preserve unavailable prices as unknown.
- The first adapter completely scans the two most recent auction events and revisits those events on each run for closing results. It is disabled with no automatic interval. Public availability expires after six hours. Prioritized hourly watched/deadline checks and one-hour/day/week targeted result follow-up are deferred until an open auction and request capacity have been verified. Failure never marks lots closed or clears a known result. Older responses cannot replace newer state.
- Public Bottle reads show active/stale lots and one latest result per ended lot. Watches and alerts remain private. Bottle merge/delete handling explicitly preserves or blocks auction references.

## Risks / Trade-offs

- Public pages may require JavaScript or block collection → verify actual accessible source data; do not invent parser fields or evade access controls.
- A cached page can retain live bid labels after closing → source-specific result evidence is required.
- Matching can finish after closure → preserve history, suppress expired availability alerts.
- Source corrections or cancelled sales → append revisions, keep original evidence, show only the latest result in public sale lists.
- Queue retries and notification deletion → durable alert uniqueness independent of notification rows.

## Migration Plan

Generate additive migrations with `pnpm db:generate`; apply them to the isolated local test database for integration checks. Deploy schema before runtime activation. Rollback disables auction sources and UI; preserve all saved auction history. No production migration is run during this task.

## Open Questions

Source-specific collection capability and permitted public reuse must be recorded before enabling the initial auction house. This affects activation, not the domain schema.
