## 1. Durable Run Model

- [x] 1.1 Add external-site run enums, schema, foreign keys, indexes, and exported types.
- [x] 1.2 Generate migrations that create run storage and add an auditable `last_run_id` materialization pointer.
- [x] 1.3 Add run schemas and serializers for protected summary and history responses.

## 2. Lifecycle Ownership

- [x] 2.1 Implement strict run creation, deterministic dispatch, active-run conflict, and terminal materialization capabilities.
- [x] 2.2 Implement worker execution ownership for claim, attempt, success, failure, safe error summary, and Sentry correlation.
- [x] 2.3 Update production scraper entry points to return accepted item counts and bind registry jobs to fixed sites and run ids.

## 3. Scheduling and Triggering

- [x] 3.1 Replace scheduler dispatch timestamps with durable scheduled runs and separate `nextRunAt` advancement.
- [x] 3.2 Replace manual trigger dispatch with attributed durable runs and return the run summary.
- [x] 3.3 Remove unrelated `lastRunAt` writes from external review persistence.

## 4. Administrator Surfaces

- [x] 4.1 Add protected administrator site-health and recent-run routes with listing totals and last-success context.
- [x] 4.2 Update the admin sites list to show listings, factual status, and next schedule without duplicate timestamp concepts.
- [x] 4.3 Update site details with current health and recent run history, including safe failure information.
- [x] 4.4 Refine the list, detail header, and run history responsive hierarchy after visual review.

## 5. Verification

- [x] 5.1 Add lifecycle, scheduling, manual-trigger, overlap, dispatch-failure, materialization, and authorization tests.
- [x] 5.2 Run generated migration checks, focused tests, typechecks, lint, and formatting.
- [x] 5.3 Perform local API plus authenticated desktop and mobile visual QA and clean up disposable data.
- [x] 5.4 Repeat authenticated desktop and mobile visual QA for the revised layouts.
- [x] 5.5 Reconcile stale active runs with deterministic redispatch and cover interrupted dispatch and cleanup windows.
