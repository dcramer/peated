# Frontend Components

## Intent

Frontend components should make workflow, layout, and styling ownership obvious
at the component that renders the UI.

## Policy

- Prefer shared form components for add/edit variants of the same workflow.
  Route pages should mostly provide data, mutations, auth checks, and redirects.
- Keep Tailwind classes with the component or component-local helper that owns
  the markup.
- Extract small named components for repeated UI surfaces instead of creating
  broad feature stylesheets or semantic class APIs.
- Use existing Peated fields, buttons, form screens, selectors, and empty states
  before introducing a new UI pattern.
- Do not render empty previews or inactive shells unless the empty state gives
  the user a clear next action.
- Verify changed user-facing components at desktop and mobile widths when the
  change affects layout or form workflows.

## Exceptions

- Shared design-system packages may own their styling outside the call site.
- Third-party generated markup may need narrow wrapper selectors when utilities
  cannot safely reach the DOM.
