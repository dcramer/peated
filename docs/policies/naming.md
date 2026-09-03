# Naming

## Intent

Names should use Peated's domain terms and be clear where they are used.

## Policy

- Use the same noun for the same concept in code, storage, and docs.
- Do not introduce a second name for one concept unless a compatibility boundary
  requires it.
- Prefer product and domain names over framework or storage terms.
- Use the module, parent object, folder, and file to keep local names short.
- Name a module for the concern it owns, not the service or adapter it uses.
- Treat `Record`, `State`, `Data`, `Payload`, `Manager`, and `Handler` as warning
  signs. Use one only when that role is the real distinction.
- Define an overloaded term once in its owning documentation. Do not reuse it
  for a nearby concept.

## UI Components

Web component authors and reviewers own these conventions. Apply them to new
components and when changing an existing component's responsibility.

### Names and roles

Use a domain or task name followed by its UI role: `EntityIdentityRow`,
`BottleForm`, or `PasskeyLoginButton`. Standard controls and established concepts
can stand alone: `Button`, `Dialog`, or `FlavorWheel`. The roles below are shared
terms, not a required suffix for every component.

- Use PascalCase for components and `<ComponentName>Props` for their exported
  props. Use the established domain noun in code. Visible copy and Storybook
  titles use product language: `EntityPicker` appears as "Brand and Producer
  Picker." A title change does not require a code rename.
- Choose a name that describes what callers get. Add context such as `Home` or
  `Moderation` only when the component owns behavior or composition specific to
  that context. Reusing it elsewhere is a reason to review that name.
- Use a prop for size, density, or appearance variations of the same component.
  Use a separate component when it owns a different task or domain contract.
  Do not use `New`, `V2`, `Custom`, or `Enhanced` to distinguish replacements.
- Avoid `Product`, `Experience`, `Surface`, `Shell`, `Widget`, `Module`,
  `Structure`, or `Record` unless it names an actual product concept. Describe
  what a container holds or what its layout does.

| Role          | Owns                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `IdentityRow` | One item's identifying content and row layout, reusable in a list, table cell, search result, or selection. |
| `List`        | A collection of items, its order, and separators.                                                           |
| `Table`       | A collection with shared column headers and aligned cells.                                                  |
| `Card`        | A deliberately grouped container or preview. A horizontal row alone is not a card.                          |
| `Input`       | Editing one value, such as text, a number, or a review score.                                               |
| `Picker`      | Choosing from supplied options. Its contract states whether selection is single or multiple.                |
| `Field`       | A form label, control, and validation, or an adapter that supplies a control's data.                        |
| `Form`        | A related set of inputs and submission behavior.                                                            |
| `Layout`      | Arrangement of supplied content, without owning the page's data or workflow.                                |
| `Page`        | A complete page composition.                                                                                |

### Files and ownership

- Match the main component's name with a camelCase file stem:
  `EntityIdentityRow` lives in `entityIdentityRow.stylex.tsx`, with stories in
  `entityIdentityRow.stories.tsx`. Use `.stylex.tsx` for modules that define StyleX
  styles and `.tsx` otherwise. Keep styling technology out of component names.
- A module may export a closely related family, such as `Button`, `ButtonLink`,
  and `IconButton` from `button.stylex.tsx`. Name the file for the family and avoid
  adding one-file wrappers just to match every export.
- Put shared components in `apps/web/src/components/`. Use a named feature folder
  when related components need one. Put render-only page compositions and their
  dedicated parts in `components/pages/`; keep route-specific data and behavior
  beside the route. Framework-required names such as `page.tsx` stay unchanged.
- Keep stories and tests beside their owning module. Component JSDoc and stories
  explain what it owns and when to use it. Keep one public name per component in
  imports and the component index; keep internal helpers out of that index.
- Prefer a few domain-owned modules over folders for every suffix or visual
  primitive. Do not create parallel component families in catch-all folders.

### Props and shared types

- Use stored kind names in data props. Keep contextual labels such as "Distiller"
  separate from the stored kind `distillery`.
- Name a shared layout helper for what it renders, such as `TextIdentityRow`.
  Domain components own which facts appear.
- Put shared types with their domain owner. A location page must not depend on a
  homepage type to render an entity row. Name types for their contract, such as
  `EntityIdentity`, `EntityListItem`, or `EntityPickerOption`; keep domain data
  separate from rendering props such as `onClick` and `variant`.
- Keep one value for each fact. A picker option must not store both `name` and
  `entity.name`; adapters derive the control's label from its domain name.
- Update names when use expands. A style shared by bottle and entity results is
  an `identityResult`, not a `bottleResult`.

### Review and changes

Before adding a component, search for the domain and role in code and Storybook.
Extend an existing owner when it already serves the task. Review the exported
name, props, file, stories, types, styles, and imports together when changing its
role. Rename all affected uses and remove obsolete exports in the same change.
Correct mismatches in the area being changed; avoid unrelated rename sweeps.

Review enforces semantic names. Typechecks and lint catch broken references;
they do not prove that a name describes the right responsibility.

## Exceptions

- Keep compatibility names at external boundaries and old storage keys when a
  hard cutover is not safe.
- Generic names are acceptable inside a small module when the import remains
  clear.
