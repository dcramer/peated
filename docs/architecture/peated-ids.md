# Peated IDs

Peated IDs are short, permanent references for public catalog objects. They are designed to be easy to read, type, copy, share, and search.

## Supported Objects

| Object | Format                | Example | Canonical URL                       |
| ------ | --------------------- | ------- | ----------------------------------- |
| Bottle | `B` plus four+ digits | `B0123` | `https://peated.com/bottles/123`    |
| Entity | `E` plus four+ digits | `E0123` | `https://peated.com/distillers/123` |

The number is the object's existing positive database ID. Numbers shorter than four digits use leading zeroes. The prefix identifies the type, so `B0123` and `E0123` are different Peated IDs.

Peated IDs are serialized in uppercase with at least four digits. Input and search are case-insensitive and accept omitted leading zeroes, so `b123` is normalized to `B0123`.

## Public Behavior

- Bottle URLs use `/bottles/{numeric ID}`.
- Entity URLs use the collection for their primary kind: `/brands`,
  `/distillers`, `/bottlers`, `/blenders`, or `/companies`.
- Root ID URLs such as `/B0123`, `/B123`, and `/E0123` redirect permanently to
  the canonical collection URL.
- Legacy `/entities/{numeric ID}` URLs redirect permanently to the Entity's
  primary-kind collection. Nested routes keep their suffix and query string.
- Bottle and entity API responses include `peatedId` alongside the existing numeric `id`.
- Global search recognizes an exact Peated ID and returns that object when its type is included in the search.
- Bottle and entity pages display the compact label `ID` and provide a way to
  copy the canonical URL.
- IDs for merged bottles and entities continue to resolve through the existing tombstones to the surviving object.

## Scope

Peated IDs are for objects people or integrations need to reference directly. They do not apply to BottleGroups, flights, tastings, prices, aliases, observations, join rows, or other internal records unless those objects later gain a clear external-reference requirement.

Peated IDs do not replace numeric database primary keys, foreign keys, or existing numeric mutation inputs. They are a stable public identity layered on top of the existing data model.
