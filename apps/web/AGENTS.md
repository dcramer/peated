# Web Agent Instructions

## Components

- Read `../../DESIGN.md` before changing visual foundations or shared components.
- Search `src/components/` before creating a reusable component.
- Query the `peated-storybook` MCP server when Storybook is running. Use documented component props and story states.
- Keep each component story beside its implementation. Put page-sized, render-only components under `pages/`.
- Put component usage, visible states, and examples in Storybook. Use concise component JSDoc so Storybook Docs and MCP expose the same guidance.
- Start with one Overview story. Add another story only for a meaningful behavior, async state, permission boundary, error, or responsive composition.
- Keep complete routes out of Storybook. Review them in the application.
- Use the Catalog Detail Page story when building a catalog detail route.
- Keep API queries, auth state, mutations, server actions, and navigation out of reusable components. Put route-only behavior beside the route and shared behavior in a narrowly named feature folder.
- Reuse shared form components for add and edit versions of the same task. Route pages should mainly supply data, auth checks, mutations, and redirects.
- Keep StyleX rules with the component that owns the markup. Use a narrow wrapper only when third-party markup cannot be styled safely another way.
- Do not render an empty preview or inactive container unless it gives the user a clear next action.
- Do not add catch-all component folders such as `product/`.
- Use StyleX for web styling. Do not add Tailwind utilities or configuration.
- Do not add committed component snapshots or presentation tests. CI captures Storybook stories as non-blocking Frameshift review images. Use the accessibility panel and manual light, dark, desktop, and mobile review for component changes.

## Product language

- Use “bottle” for a catalog item. Use “bottling” only for a production fact or edition, such as a bottling year.
- Use “brand or producer,” “rating,” and “Peated ID” in product copy and Storybook names. Do not expose implementation terms such as “entity,” “measure,” or “canonical ID.”
- “Tasting band” is an internal term. Customer text should use “rating” or show the name and range, such as `Very good · 85–89`. Use “review score” for an exact 0–100 score.
- Name components after the Peated concept or user task they own. Use a normal interface noun for a generic control.
- Do not use vague implementation nouns such as `Product`, `Experience`, `Surface`, `Shell`, `Widget`, `Module`, `Structure`, or `Record` unless that is the product term.
- Buttons and icon buttons share variants, sizes, loading behavior, disabled behavior, and native button props through one base control.

## Routes

- Put a nested page under its parent layout when users expect the parent tabs, header, or navigation to remain.
- Keep the parent tab active for its nested pages.
- Load only the data owned by the nested page.
- Use a layout-free route group only for a deliberately standalone screen, such as authentication or a full-screen tool.

## Component checks

| Check           | Command                                  |
| --------------- | ---------------------------------------- |
| Lint file       | `pnpm exec oxlint path/to/file.ts --fix` |
| Typecheck web   | `pnpm --filter @peated/web typecheck`    |
| Build Storybook | `pnpm storybook:build`                   |
