# Peated IDs

Peated IDs are short, permanent references for public catalog objects. They are designed to be easy to read, type, copy, share, and search.

## Supported Objects

| Object | Format                | Example | Canonical URL                                          |
| ------ | --------------------- | ------- | ------------------------------------------------------ |
| Bottle | `B` plus four+ digits | `B0123` | `https://peated.com/bottles/123-lagavulin-16-year-old` |
| Entity | `E` plus four+ digits | `E0123` | `https://peated.com/distillers/123-lagavulin`          |
| Series | `S` plus four+ digits | `S0123` | `https://peated.com/series/123-ardbeg-supernova`       |

The number is the object's existing positive database ID. Numbers shorter than four digits use leading zeroes. The prefix identifies the type, so `B0123`, `E0123`, and `S0123` are different Peated IDs.

Peated IDs are serialized in uppercase with at least four digits. Input and search are case-insensitive and accept omitted leading zeroes, so `b123` is normalized to `B0123`.

## Public Behavior

- Bottle URLs use `/bottles/{numeric ID}-{current display-name slug}`.
- Entity URLs use the collection for their primary kind: `/brands`,
  `/distillers`, `/bottlers`, or `/companies`, followed by the numeric ID and
  current name slug.
  Web callers pass the Entity directly to `getEntityUrl` in
  `apps/web/src/lib/urls.ts`. A Bottle's Brand, Bottler, or Distiller field does
  not determine that Entity's kind or URL.
- Series URLs use `/series/{numeric ID}-{current full-name slug}`. The full name
  includes the Brand.
- The numeric ID identifies the object. The web app creates the slug when it
  builds a URL. It does not store slugs. Numeric-only and old slug URLs redirect
  permanently to the current URL.
- Root ID URLs such as `/B0123`, `/B123`, `/E0123`, and `/S0123` redirect
  permanently to the canonical collection URL.
- Legacy `/entities/{numeric ID}` URLs redirect permanently to the Entity's
  primary-kind collection. Nested routes keep their suffix and query string.
- Bottle, Entity, and Series API responses include `peatedId` alongside the
  existing numeric `id`.
- Global search recognizes an exact Peated ID and returns that object when its type is included in the search.
- Bottle, Entity, and Series pages display the compact label `ID` and provide a way to
  copy the canonical URL.
- IDs for merged Bottles, Entities, and Series redirect to the remaining object.
- A populated Series must be merged instead of deleted. Deleting an empty
  Series preserves its ID as a tombstone without a destination.

## Scope

Peated IDs are for objects people or integrations need to reference directly. They do not apply to BottleGroups, flights, tastings, prices, aliases, observations, join rows, or other internal records unless those objects later gain a clear external-reference requirement.

Peated IDs do not replace numeric database primary keys, foreign keys, or existing numeric mutation inputs. They are a stable public identity layered on top of the existing data model.
