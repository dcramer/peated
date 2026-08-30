# Web Agent Instructions

## Components

- Read `../../DESIGN.md` before changing visual foundations or shared components.
- Search `src/components/` before creating a reusable component.
- Query the `peated-storybook` MCP server when Storybook is running. Use documented component props and story states.
- Keep each component story beside its implementation. Put page-sized, render-only components under `pages/`.
- Keep API queries, auth state, mutations, server actions, and navigation out of reusable components. Put route-only behavior beside the route and shared behavior in a narrowly named feature folder.
- Do not add catch-all component folders such as `product/`.
- Use StyleX for web styling. Do not add Tailwind utilities or configuration.
- Do not add component snapshots or presentation tests. Use the accessibility panel and manual light, dark, desktop, and mobile review.

## Component checks

| Check           | Command                                  |
| --------------- | ---------------------------------------- |
| Lint file       | `pnpm exec oxlint path/to/file.ts --fix` |
| Typecheck web   | `pnpm --filter @peated/web typecheck`    |
| Build Storybook | `pnpm storybook:build`                   |
