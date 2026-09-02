# Web

## Components

- Read `../../DESIGN.md` before visual or shared-component changes.
- Never add decorative eyebrow/kicker labels above headings (for example,
  "Reference · 9 groups" or "Your account"). Use plain headings and put useful
  facts in the content. Do not add this pattern to components or stories.
- Search `src/components/` before adding components. Query `peated-storybook` MCP
  when running; use documented props and states.
- Keep stories beside components; page-sized, render-only components go in `pages/`.
- Document usage, states, and examples in Storybook; expose the same guidance
  through concise component JSDoc.
- Start with Overview. Add stories only for distinct behavior, async states,
  permissions, errors, or responsive layouts.
- Review routes in the app, not Storybook. Use the Catalog Detail Page story
  when building catalog detail routes.
- Keep queries, auth, mutations, server actions, and navigation outside reusable
  components: route-specific code beside routes, shared code in named feature folders.
- Share add/edit forms. Routes supply data, auth checks, mutations, and redirects.
- Keep StyleX with its markup. Use wrappers only when third-party markup cannot
  be styled safely otherwise. No Tailwind or catch-all folders like `product/`.
- Compose `foundationStyles` for standard typography instead of copying font
  values into rows. `BottleIdentityRow` owns bottle rows; `BottleVisual` owns
  bottle images; `CommunityFeed` owns activity on the homepage and `/activity`.
  Use `formatBottleDisplayName` or `toBottleListItem` for displayed bottle names.
  API responses used by these helpers must include the BottleGroup summary.
- Review changes to shared bottle layouts together in Bottle Identity Row's
  Row Layouts story, including missing images, long names, and loading states.
- Omit empty previews and inactive containers without a clear next action.
- Buttons and icon buttons share one base control for variants, sizes, loading,
  disabled state, and native props.
- No committed component snapshots or appearance tests. Use the accessibility
  panel and light/dark, desktop/mobile QA. Frameshift CI images are non-blocking.

## Product language

- “Bottle” means a catalog item; “bottling” means a production fact or edition.
- In copy and Storybook, use “brand or producer,” “rating,” and “Peated ID,” not
  “entity,” “measure,” or “canonical ID.”
- Say “rating” or show its name/range (`Very good · 85–89`), not “tasting band.”
  Use “review score” for an exact 0–100 score.
- Name components for their Peated concept, task, or standard UI control. Avoid
  `Product`, `Experience`, `Surface`, `Shell`, `Widget`, `Module`, `Structure`,
  or `Record` unless it is the product term.

## Routes

- Nest pages under their parent layout when tabs, headers, or navigation should
  remain. Keep the parent tab active.
- Load only the nested page's data.
- Use layout-free route groups only for standalone screens, such as authentication.

## Component checks

| Check           | Command                                  |
| --------------- | ---------------------------------------- |
| Lint file       | `pnpm exec oxlint path/to/file.ts --fix` |
| Typecheck web   | `pnpm --filter @peated/web typecheck`    |
| Build Storybook | `pnpm storybook:build`                   |
