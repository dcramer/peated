## 1. Moderation Read Contracts

- [x] 1.1 Add strict moderation task-key, task-summary, source-locator, filter, count, and paging schemas under the administrator route boundary.
- [x] 1.2 Implement the listing task projection from actionable store-price match proposals with the correct attention timestamp and human-decision membership rules.
- [x] 1.3 Implement independent Review Operation task projections and finding-disposition task projections from Bottle checks without adding task persistence.
- [x] 1.4 Combine task projections into one oldest-first Inbox query with stable tie-breaking, search, category, blocked filters, counts, and bounded pagination.
- [x] 1.5 Add a task-locator read that revalidates actionability and returns only the owning source identifiers required to load listing or audit details.
- [x] 1.6 Cover administrator authorization, mixed-source membership, one-operation-per-task flattening, finding membership, operational exclusions, ordering, filtering, pagination, and terminal-task revalidation with server integration tests.

## 2. History And Automation Read Contracts

- [x] 2.1 Define strict moderation history summary, source-locator, filter, and paging schemas for incoming decisions, Review Operation outcomes, and audit closures.
- [x] 2.2 Implement History list and detail projections using existing durable actors, outcomes, timestamps, affected resources, and evidence without inventing missing context.
- [x] 2.3 Define and implement the bounded Automation overview from queue counts, processing proposals, retry runs, and recoverable post-decision execution state.
- [x] 2.4 Cover History ordering/filtering/detail fallbacks and Automation membership/progress/recovery locators with administrator route integration tests.

## 3. Moderation Shell And Inbox Navigation

- [x] 3.1 Add nested `/admin/moderation` routes for Inbox, task detail, History, history detail, and Automation under the existing admin ownership boundary.
- [x] 3.2 Replace the Review Flow sidebar group with Moderation navigation and keep catalog/configuration tools in a separate Admin section.
- [x] 3.3 Build the desktop three-column Moderation shell and mobile list/detail route behavior with loading, empty, unavailable, no-longer-actionable, and completion states.
- [x] 3.4 Build the compact Inbox list, counts, search, category and blocked filters, oldest-first presentation, selected state, and URL-preserved list context.
- [x] 3.5 Implement task selection, one non-mutating Skip control, successful auto-advance, end-of-list behavior, query invalidation, focus movement, and live announcements.
- [ ] 3.6 Add deterministic component tests for task rows, filter URLs, responsive composition contracts, stale-task fallbacks, and navigation state helpers.

## 4. Listing Decision Tasks

- [x] 4.1 Extract focused source context, Bottle identity, identity-fact, proposed-Bottle field, evidence, and system-detail components from the current queue card where reuse is smaller than replacement.
- [x] 4.2 Implement the match-existing task with one approve action plus choose-another and ignore alternatives through existing listing mutations.
- [x] 4.3 Implement the create-Bottle task with complete proposed fields, direct creation, edit-before-create navigation, and ignore.
- [x] 4.4 Implement the same-Bottle correction task with current/proposed field comparison and the existing transactional repair mutation.
- [x] 4.5 Implement no-match and blocked listing presentation with human-readable missing identity, manual Bottle selection, valid retry placement, and ignore.
- [x] 4.6 Move candidate evidence, classifier metadata, automation assessment, processing identifiers, and structured export behind separate default-closed disclosures.
- [ ] 4.7 Cover all listing variants, unavailable recommendations, mutation pending/error/success, preserved input, manual selection, Skip, and auto-advance with focused web tests.

## 5. Catalog Operation And Finding Tasks

- [x] 5.1 Adapt the existing live Review Operation preparation and operation card pieces into a single-operation task renderer without the audit-wide review composition.
- [x] 5.2 Implement Bottle and Entity field-update tasks with desktop and mobile diffs, inclusion controls, warnings, impact, and apply-included behavior.
- [x] 5.3 Implement Bottle and Entity merge tasks with explicit source/destination identities, affected consumers, warnings, and all-or-nothing approval.
- [x] 5.4 Implement blocked, stale, and failed operation presentation with only the source-owned removal, manual-resolution, close, or operational-recovery actions valid for the current state.
- [x] 5.5 Implement structured removal reason/note behavior, existing undo behavior where supported, and mutation-error preservation inside the focused task shell.
- [x] 5.6 Implement finding-disposition tasks with findings, evidence, canonical manual-edit links, structured close reason, and optional note.
- [ ] 5.7 Cover one-operation-per-task behavior, field exclusions, merge impact, blocked approval, removal, finding closure, failure preservation, and auto-advance with focused web tests.

## 6. Moderation History

- [x] 6.1 Build the compact History list with search and actor, category, and outcome filters backed by the History projection.
- [x] 6.2 Build incoming-listing decision details showing durable actor, outcome, source-to-Bottle relationship, available rationale/evidence, and timestamp activity.
- [x] 6.3 Build Review Operation and audit-closure details showing affected resources, included/excluded fields or merge outcome, reviewer disposition, and execution context.
- [x] 6.4 Render unavailable legacy context explicitly and keep History free of actions that repeat a terminal decision.
- [x] 6.5 Add deterministic tests for History rows, filters, actor attribution, source-specific details, activity ordering, and missing-context fallbacks.

## 7. Automation Operations

- [x] 7.1 Build compact Processing, Waiting, Failed, and Cleared-today summaries from the Automation projection.
- [x] 7.2 Build needs-attention rows and recent-run progress for classification, retry runs, and post-decision catalog execution.
- [x] 7.3 Wire only existing retry, resume, cancel, reconciliation, rerun, and open-task capabilities to the states that own them.
- [x] 7.4 Keep classifier quality reporting, model scores, and unrelated worker diagnostics outside the Automation UI.
- [x] 7.5 Add deterministic tests for operational membership, status copy, progress, permitted recovery controls, and transitions that create new Inbox decisions.

## 8. Responsive And Accessible Workflow

- [x] 8.1 Implement mobile Moderation navigation, Inbox list-to-detail transitions, back behavior, scroll restoration, and at least 44-pixel touch targets.
- [x] 8.2 Implement stacked mobile field diffs and action layouts without horizontal overflow or hidden decision-critical content.
- [x] 8.3 Verify semantic headings, regions, controls, disclosures, visible focus, live mutation announcements, and shortcut suppression inside form controls.
- [ ] 8.4 Add or update targeted Playwright flows for desktop and mobile listing, operation, finding, History, and Automation behavior using existing mock RPC fixtures.

## 9. Cutover And Verification

- [x] 9.1 Keep `/admin` as the canonical entry redirect, remove superseded review pages and read APIs, and update remaining producers to link directly to Moderation after parity tests pass.
- [x] 9.2 Remove superseded workbench, multi-card queue, audit-wide inbox/reviewer, decision-log, workstream-tab, and duplicate queue-health compositions while preserving reusable domain components.
- [x] 9.3 Update moderator-facing feature and architecture documentation to describe Inbox, History, Automation, one-decision tasks, and source-owned mutations.
- [x] 9.4 Run focused server integration tests, web tests, server and web typechecks, lint, and formatting for every touched surface.
- [x] 9.5 Manually QA the authenticated administrator workflow with agent-browser at desktop and mobile widths, including each task kind, Skip, auto-advance, direct URLs, errors, empty states, History, Automation, and the canonical admin entry redirect.
