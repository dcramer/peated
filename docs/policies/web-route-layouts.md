# Web Route Layouts

## Intent

Nested web pages should keep the navigation, context, and visual hierarchy of
their parent workflow.

## Policy

- Put nested detail routes under the parent App Router layout when users expect
  parent navigation, tabs, headers, or sidebars to remain present.
- Keep parent tabs active for nested routes that belong to that tab.
- Prefer scoped data for nested detail pages. For example, a bottling page
  should show release-scoped reviews and tastings instead of only parent bottle
  activity.
- Verify changed user-facing routes at desktop and mobile widths before
  finalizing layout work.
- Use layout-free route groups only for intentionally standalone screens.

## Exceptions

- Marketing pages, auth flows, full-screen tools, and embedded views may bypass
  the parent app shell when the standalone layout is deliberate.
- Temporary debug or admin-only pages may use simpler layouts when they are not
  part of a repeated user workflow.
