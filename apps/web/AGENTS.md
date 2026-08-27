# Web Agent Instructions

## Design system

- Read `../../DESIGN.md` before changing visual foundations or shared components.
- Search `src/components/designSystem/` before creating a component or visual pattern.
- Query the `peated-storybook` MCP server when Storybook is running. Use documented component props and story states.
- Keep each component story beside its implementation. Put real compositions under `patterns/`.
- Use StyleX for new design-system elements. Do not add Tailwind classes to elements owned by a StyleX component.
- Do not add component snapshots or presentation tests. Use the accessibility panel and manual light, dark, desktop, and mobile review.

## Design-system checks

| Check           | Command                                  |
| --------------- | ---------------------------------------- |
| Lint file       | `pnpm exec oxlint path/to/file.ts --fix` |
| Typecheck web   | `pnpm --filter @peated/web typecheck`    |
| Build Storybook | `pnpm storybook:build`                   |
