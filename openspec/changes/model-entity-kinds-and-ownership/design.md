## Context

`entity.type` is a list containing `brand`, `distiller`, and `bottler`. Bottle
create and edit code adds a value when an Entity is used in that Bottle field.
The list therefore repeats facts already stored by Bottle links.

This causes confusing pages. Lagavulin can be both the Brand and Distiller for
a Bottle, but it is one Distillery. Diageo can own Lagavulin without appearing
in any Bottle field.

Entity already owns names, aliases, Peated IDs, search, merges, descriptions,
and statistics. Keeping one Entity table preserves that work.

## Goals / Non-Goals

**Goals:**

- Answer “What is this?” with one clear Entity kind.
- Keep Brand, Bottler, and Distiller as Bottle fields.
- Record one current owner when known.
- Preserve Entity IDs, aliases, Bottle links, and redirects.
- Give existing data a small, reviewable migration path.

**Non-Goals:**

- Model buildings, warehouses, or bottling lines.
- Store ownership history or ownership percentages.
- Model joint ownership in the first version.
- Record importers, distributors, or physical packers.
- Build a general Entity relationship system.
- Fill every unknown owner before release.

## Decisions

### Keep one Entity table

Entity remains the shared record for whisky identities and owning companies.
Splitting Brands, Distilleries, Bottlers, and Companies into separate tables
would duplicate names, search, merges, and Bottle links. It would also require
separate Lagavulin Brand and Lagavulin Distillery records.

### Give each Entity one kind

Add one `kind` with five values:

- `brand`: a consumer product name without its own Distillery identity;
- `distillery`: a public whisky identity centered on distilling;
- `bottler`: a business known for selecting and releasing whisky made by other
  distillers, including an independent bottler;
- `blender`: a business known for creating blends from sourced whisky;
- `company`: an owner or production business that does not fit the other four
  kinds.

Kind is the best short description for users. It does not try to list every
activity. For example, Signatory can have kind `bottler` and own Edradour.
Compass Box can have kind `blender` and appear as a Brand and Bottler on
Bottles. MGP can have kind `company` and appear as a Distiller on Bottles.

Do not add `other`. First inspect a representative set of real Entities through
the API, including mixed-use Entities. If the five values do not cover them,
revise the list before implementation.

### Do not store Bottle uses on Entity

An Entity is used as a Brand when `bottle.brandId` points to it. Bottler use
comes from `bottle.bottlerId`. Distiller use comes from the Bottle-to-Distiller
table.

Bottle forms search all Entities without a role filter or role-specific
ranking. A kind never blocks a valid Bottle link.

When Bottle creation includes a new Entity draft, an explicit kind from the
user or classifier wins. If the draft has no kind, the Bottle field supplies a
reasonable default: Brand uses `brand`, Bottler uses `bottler`, and Distiller
uses `distillery`. This creation default does not constrain later Bottle links.

### Make kinds top-level browse resources

Expose one collection API for each Entity kind:

- `/brands`;
- `/distilleries`;
- `/bottlers`;
- `/blenders`;
- `/companies`.

Each endpoint fixes and enforces its kind for list operations. Callers do not
pass a kind filter. The handlers share query and serialization helpers below
the public contract.

Keep the generic Entity API for cross-kind selection and shared mutations.
Bottle, owner, merge, badge, and other Entity fields can use `GET /entities`
when any kind is a valid choice. Each result includes its required kind. Entity
creation uses `POST /entities` with a required kind. Entity updates continue to
use `PATCH /entities/{entity}`. Kind browse pages do not use the generic list.

The five kinds are views of one Entity domain, not separate mutation owners.
Dedicated create and update routes would repeat one contract five times and
would not match generic Entity details, merges, aliases, or nested Bottle
creation.

These kind collections answer what an Entity is. Bottle fields answer how an
Entity is used. Bottle forms use the generic selector collection across all
Entity kinds. They do not filter or rank by a stored Entity role. This keeps a
Distillery such as Lagavulin selectable as a Bottle Brand without also
classifying Lagavulin as a Brand kind.

Every public global-search scope maps to exactly one kind. An all-kind global
search is explicit: it combines all five kind scopes. Entity-classifier
searches also require one kind. UI Entity selectors use the generic read-only
Entity collection. Bottle-classifier relationship resolution may search all
five kinds because kind does not constrain a Bottle relationship.

Shared detail and moderation operations keep the Entity domain noun when they
address one Entity rather than browse a kind. They must return one required
kind and must not expose the old type list.

The API uses dedicated kind resources when it means what an Entity is. Bottle
APIs continue to use the existing Brand, Bottler, and Distiller field names.
There is no stored or public Entity role model.

### Store one current owner

Add an optional `ownerId` on Entity that points to another Entity. This solves
the current need without a new relationship system. Following `ownerId` shows
an ownership chain.

Owner changes reject self-ownership and loops. Entity merge repoints owned
Entities to the surviving Entity. A merge fails if it would create a loop or if
the source and destination have conflicting owners that need moderator review.

Rename the existing optional `parentId` self-reference to `ownerId`. Code search
shows no runtime reader or writer for `parentId`; it appears only in the Entity
schema and generated migration history. Do not keep both names or add a second
self-reference.

One current owner cannot represent joint ownership. In this version, leave the
owner unknown instead of storing a false single owner. Add multiple ownership
only after a real catalog need justifies it.

### Keep Entity pages plain

The Entity header shows one label, such as “Distillery” or “Company.” It does
not show Brand, Bottler, and Distiller chips. The page can separately say:

```text
Owned by Diageo
Appears on 42 Bottles as the Distiller
```

An owner page lists the Entities whose `ownerId` points to it. This change does
not redefine the existing country, region, address, or established-year fields.

### Use two short deployments

The migration has a preparation deployment and a final switch. The temporary
overlap has one purpose: fill every kind before it becomes required.

Preparation adds optional `kind` and renames `parentId` to `ownerId`. Existing
code can continue to read `type` while the backfill runs. The normal Entity read
and update APIs expose the optional fields during this deployment.

The preparation and final application states must stay separate. Application
code that requires `kind` cannot serve the backfill because it cannot list or
serialize an Entity whose kind is empty. Run the reviewed backfill through the
preparation release, verify zero missing kinds, and only then deploy the final
application switch.

The backfill pages through Entities by API. For each Entity without a kind, it
uses the Entity details and Bottle-use counts to choose a kind. Unclear cases
are researched before they are changed. Each update goes through the normal
authenticated Entity update API and is fetched again after the write. The
existing Entity change history records the change. Known current owners can be
added through the same API, but ownership is optional and does not block the
kind migration.

Before the final switch, a check must report:

- zero Entities without a kind;
- zero invalid owner links or loops;
- the same Brand, Bottler, and Distiller Bottle counts before and after the new
  queries.

The final deployment makes kind required, changes all readers and writers to
the new fields, and stops updating `type`. After that deployment is stable, a
generated cleanup migration removes `type` and the old Entity type enum.

All migrations come from `pnpm db:generate`. Do not edit migration SQL or
metadata by hand.

## Risks / Trade-offs

- **One kind simplifies mixed businesses.** → Show ownership, Bottle use, and
  the description as separate facts.
- **Mixed businesses can make kind subjective.** → Check representative real
  Entities before the enum is fixed, research unclear cases, and do not make a
  write until one kind is defensible.
- **An API backfill can stop partway through.** → Use bounded pages, update one
  Entity at a time, re-fetch each write, and resume by querying for missing
  kinds.
- **One owner cannot represent joint ownership.** → Leave it unknown in this
  version rather than storing incorrect data.
- **Bottle-link queries can be slower than the current array filter.** → Check
  the three browse queries and add an index only if the query plan needs it.
- **Two deployments briefly keep both fields.** → Limit the first deployment
  to backfill work and remove all old reads in the second deployment.

## Migration Plan

1. Use the API to inspect representative Entities for every current type
   combination, including known mixed businesses. Confirm the five kinds before
   changing the schema.
2. Add optional `kind` and rename `parentId` to `ownerId` with a generated
   migration. Expose `kind` and `ownerId` through the normal Entity API.
3. Page through Entities with missing kinds. Research unclear cases, update
   them through the authenticated API, and re-fetch every write.
4. Query the API again and verify that no Entity has a missing kind.
5. Add current owners through the API where one owner is known. Ownership is
   optional and does not block the
   kind migration.
6. Run the final checks for kinds, owners, and Bottle-use counts.
7. Deploy the final switch: require kind, derive Bottle uses from Bottle links,
   and remove old type reads and writes.
8. After the switch is stable and backed up, generate removal of `type` and its
   enum.

Before the final switch, rollback removes optional `kind` and renames `ownerId`
back to `parentId`. After the final switch, rollback restores the database
backup and prior application version. The application does not maintain two
permanent code paths.

## Open Questions

- Does current catalog data require another kind beyond the five listed here?
