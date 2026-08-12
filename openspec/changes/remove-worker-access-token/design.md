## Context

Scraper jobs run in the `apps/server` worker process and already share the server's database, queue client, validation schemas, and domain modules. They nevertheless submit mutations through the public oRPC client using `ACCESS_TOKEN`, a seven-day JWT issued to a human administrator. Expiration causes scraping to fetch data successfully but fail before persistence.

The existing Peated system actor is the durable attribution identity for automated writes. Several HTTP route handlers still own persistence logic directly, and Bottle services retain obsolete user parameters even where storage now records actor IDs.

## Goals / Non-Goals

**Goals:**

- Let scheduled scraper jobs persist their owned data without any human credential.
- Reuse one validation and persistence implementation from HTTP and worker callers.
- Attribute worker-created or worker-updated catalog data to the Peated system actor.
- Preserve existing HTTP authorization and response contracts.
- Keep system authority limited to explicitly exported ingestion operations.

**Non-Goals:**

- Adding generic machine authentication to the public API.
- Adding scraper-run history or admin-site statistics in this change.
- Repairing remote retailer markup, blocking, or pagination failures.
- Removing user access tokens from CLI or normal API clients.

## Decisions

### Workers call internal capabilities

Move route-owned mutation logic into `apps/server/src/lib` functions and invoke those functions from both route adapters and worker jobs. This matches the existing deployment boundary: the worker is already trusted with database and queue access.

Alternative: mint short-lived service JWTs from a permanent worker secret. This retains an unnecessary network dependency and requires a new service-principal authorization model across user-oriented routes.

### Automated writes use the Peated system actor

Internal functions accept or resolve an actor ID at the write boundary. HTTP adapters resolve a user actor after their existing middleware checks; worker-owned wrappers resolve the Peated system actor. Worker capabilities do not accept arbitrary actor IDs from queue payloads.

Alternative: create a non-expiring administrator user token. This grants excessive authority and produces inaccurate human audit history.

### Domain services do not require a User for attribution

Remove obsolete user parameters from entity and series helpers where actor IDs are already authoritative. Bottle create/update internals receive the actor and creation source they actually require. Human authorization remains in the HTTP adapter.

### Preserve dry-run as an explicit option

Worker persistence is enabled by default. Local callers that need parsing-only execution must request dry-run explicitly instead of relying on a missing credential as an implicit mode switch.

## Risks / Trade-offs

- [Shared service extraction changes mature route code] → Keep route schemas, middleware, serializers, errors, transaction order, and post-commit jobs unchanged; cover service and route behavior with targeted tests.
- [A worker could gain broad mutation authority] → Export narrowly named scraper operations rather than a general system context or administrator bypass.
- [A partial deployment could run old worker code] → Server and worker ship from the same image; remove the worker token dependency only after all scraper call sites migrate.
- [Local scraper invocations could unexpectedly write] → Add an explicit `dryRun` option and update tests and any documented manual commands.

## Migration Plan

1. Extract price, review, image, and external-site configuration persistence into shared domain functions.
2. Make Bottle create/update services actor-driven and add narrow Peated-system wrappers.
3. Migrate scraper jobs from the oRPC client to those functions.
4. Remove all worker-side `ACCESS_TOKEN` branches and update tests.
5. Deploy server and worker from the same revision, then remove `ACCESS_TOKEN` from the worker environment.

Rollback is a code rollback plus restoration of a valid worker `ACCESS_TOKEN`; no schema migration is required.

## Open Questions

None. Scraper-run observability remains a separate follow-up change.
