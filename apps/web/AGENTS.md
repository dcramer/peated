# Web Agent Instructions

## Design system

- Read `../../DESIGN.md` before changing visual foundations or shared components.
- Search `src/components/designSystem/` before creating a reusable component or visual pattern.
- Query the `peated-storybook` MCP server when Storybook is running. Use documented component props and story states.
- Keep each component story beside its implementation. Put reusable render-only compositions under `patterns/`.
- Keep API queries, auth state, mutations, server actions, and navigation outside `designSystem/`. Put route-only behavior beside the route and shared behavior in a narrowly named feature folder.
- Do not add catch-all component folders such as `product/`.
- Use StyleX for web styling. Do not add Tailwind utilities or configuration.
- Do not add component snapshots or presentation tests. Use the accessibility panel and manual light, dark, desktop, and mobile review.

## Design-system checks

| Check           | Command                                  |
| --------------- | ---------------------------------------- |
| Lint file       | `pnpm exec oxlint path/to/file.ts --fix` |
| Typecheck web   | `pnpm --filter @peated/web typecheck`    |
| Build Storybook | `pnpm storybook:build`                   |
