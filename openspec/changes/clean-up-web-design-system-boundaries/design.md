## Context

The StyleX migration created a useful visual system, but it also placed reusable controls, page compositions, route adapters, API queries, auth state, and navigation under one `components/designSystem` tree. `DESIGN.md` already defines a render-only boundary for shared visual code. The implementation does not consistently follow it.

The cleanup must preserve routes and visible behavior. It must also keep StyleX styles beside the component that owns the markup.

## Goals / Non-Goals

**Goals:**

- Make `components/designSystem` a render-only visual dependency.
- Put route-only behavior beside its App Router owner.
- Put behavior shared by several routes in a narrowly named feature folder.
- Remove the vague `designSystem/product` category.
- Remove completed migration names and unused public exports.

**Non-Goals:**

- Redesign components or change their public behavior.
- Add behavior, snapshot, or presentation tests.
- Split large render-only components only because of their line count.
- Create a separate design-system package for one web consumer.

## Decisions

### Keep the app-local visual system

Keep tokens, foundations, reusable controls, and render-only compositions under `components/designSystem`. An app-local design-system folder is valid while the web app is its only runtime consumer. A package would add an unnecessary release and dependency boundary.

Alternative: rename every reusable component into `components/ui`. Rejected because many components are Peated domain components rather than generic UI primitives, and a repository-wide rename would not fix runtime ownership.

### Move behavior to the narrowest real owner

Route-only modules move beside their routes. Shared runtime behavior moves to a semantic feature folder such as `components/search`, `components/auth`, or `components/admin`. The main application shell stays with the main App Router layout.

No file under `components/designSystem` may import the oRPC client, query hooks, auth hooks, Next navigation hooks, server actions, or route modules. Render-only components receive values, callbacks, links, and slots.

Alternative: rename `designSystem/product` to `product`. Rejected because it preserves the catch-all category and does not make ownership clearer.

### Remove the completed migration boundary

Rename the `(redesign)` route group to `(app)`. Route groups do not affect public URLs. Update the layout component name and remove migration-only guidance after the move.

### Narrow exports without deleting reviewed visuals

Remove public barrel exports that have no external consumer. Keep reviewed story components in place when they still represent an approved visual contract. A later product slice can connect or remove those components based on a real requirement.

## Risks / Trade-offs

- [Mechanical moves can leave stale imports] -> Search every old path and run the web typecheck and Storybook build.
- [Moving client modules can change relative dependency resolution] -> Prefer the `@peated/web` alias or update each relative import explicitly.
- [The route-group rename creates a large rename diff] -> Keep it in one mechanical step and verify that generated public route paths do not change.
- [Some runtime components serve several routes] -> Give them one semantic feature owner instead of copying them into route folders.

## Migration Plan

1. Move the main route group and route-owned modules.
2. Move shared runtime modules to semantic feature owners.
3. Remove navigation and runtime hooks from the remaining design-system tree.
4. Narrow unused exports and update design guidance.
5. Format, lint, typecheck, and build Storybook.

Rollback is a normal commit revert. The change does not alter persisted state or public URLs.

## Open Questions

None.
