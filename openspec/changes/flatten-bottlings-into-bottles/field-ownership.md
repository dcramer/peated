# Field Ownership

This matrix is authoritative for the direct-Bottle architecture. BottleGroup is
never a catalog-consumer target.

| Concern                                              | BottleGroup                      | Bottle                              | Observation / alias                | Unit or activity row            |
| ---------------------------------------------------- | -------------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------- |
| Relationship among related releases                  | Owns membership                  | Has one `groupId`                   | No                                 | No                              |
| Shared editing intent                                | Owns trusted shared patch        | Stores materialized result          | No                                 | No                              |
| Complete display identity                            | Shared source only               | Owns durable value                  | No                                 | No                              |
| Name and `fullName`                                  | Shared prefix intent             | Owns complete canonical values      | Alias preserves prior Bottle names | No                              |
| Brand, bottler, distillers, category, series, flavor | Shared edit source               | Owns durable renderable values      | May record evidence                | No                              |
| Effective stated age                                 | Shared default/edit source       | Owns effective value                | May record evidence                | No                              |
| Edition, years, ABV, flags, cask traits              | No                               | Owns                                | May record evidence                | No                              |
| Exact editorial content and images                   | No                               | Owns                                | May record source evidence         | Unit image remains unit-owned   |
| Catalog identity                                     | No                               | Owns through `bottleId`             | Points to Bottle when assigned     | Points to Bottle when assigned  |
| Activity and exact statistics                        | Member-derived aggregate only    | Owns direct activity/statistics     | No                                 | Owns event/unit fields          |
| Group aggregate statistics                           | Owns raw member-Bottle aggregate | Contributes through direct activity | No                                 | No                              |
| Legacy release redirect                              | No                               | Promotion destination               | No                                 | May retain `releaseId` evidence |

## Invariants

- Every active Bottle has exactly one `groupId`.
- Every active group has at least one active Bottle and a valid representative.
- Bottle is independently correct without BottleGroup hydration.
- Every resolvable catalog consumer stores one Bottle foreign key.
- BottleGroup ids are never accepted as tasting, review, collection, Flight,
  price, alias, observation, proposal, notification, badge, analytics, cache,
  queue, or activity identity.
- A nullable consumer Bottle reference means unresolved identity only where the
  domain explicitly supports it. It never means “the group.”
- Parent-only legacy rows remain on the retained parent Bottle.
- Release-specific legacy rows are repointed to the Bottle in the durable
  release-promotion mapping.
- A representative Bottle is presentation/route state, never a substitute for
  missing activity identity.
- Exact Bottle merge is the only operation that repoints consumer Bottle ids.
- This change does not operate automatic regrouping. A future grouping process
  may change `Bottle.groupId`, shared materialization, and affected group
  aggregates, but must not change consumer Bottle ids.

## Shared Materialization

A trusted shared edit locks the group, all active members, relevant aliases, and
audit rows. It:

1. applies the group-owned shared patch;
2. preserves member-owned exact fields;
3. materializes complete shared values on every member;
4. regenerates each member's complete `name` and `fullName`;
5. retains each previous canonical name as an alias for the same Bottle;
6. validates collisions and membership before commit;
7. rolls back the entire edit on any failure.

No ordinary create or user activity workflow can invoke group reuse or shared
group identity selection.

## Legacy Promotion Ownership

For every legacy parent:

- the parent keeps its Bottle id, complete parent-owned fields, aliases,
  activity, creator, and timestamps;
- the parent becomes the general/unversioned member of its migration group;
- each BottleRelease creates one new Bottle in the same group;
- the release owns its exact name, edition, years, ABV, flags, cask traits,
  non-null exact age, exact content, creator, and timestamps;
- missing exact presentation fields copy from the parent as durable Bottle data;
- common joins and shared fields materialize on every promoted Bottle;
- the durable mapping owns legacy release id to promoted Bottle id;
- parent-only consumer rows keep the parent Bottle id;
- release-specific consumer rows receive the promoted Bottle id and retain the
  old release id only as migration evidence until cleanup.

The migration never deletes or arbitrarily reassigns the parent Bottle.

## Consumer Ownership

### Tastings, reviews, collections, and Flights

- Input selects a Bottle.
- The canonical writer validates and stores that Bottle id atomically.
- Collection and Flight uniqueness is `(owner/container, bottleId)`.
- Reads hydrate the Bottle directly.
- Group pages may aggregate member activity but create no group activity.

### Prices, proposals, attempts, and decisions

- A match is either one Bottle or unresolved.
- Current and suggested proposal/attempt slots are independent nullable Bottle
  references.
- Approval applies one selected Bottle id to every affected row in one
  transaction.
- Group similarity may be classifier evidence but cannot become assignment.

### Aliases and observations

- An assigned alias points to one Bottle.
- A general expression alias may point to the retained general Bottle.
- Alias propagation reuses the same Bottle id for prices and reviews.
- Observations record one Bottle when resolved and remain nullable when not.
- No stable or generic alias points to BottleGroup as consumer identity.

### Queues, notifications, badges, and analytics

- Bottle work carries `bottleId`.
- Group aggregate work carries `groupId` only to identify the aggregate owner.
- Notifications render the referenced Bottle.
- Badges and user analytics use Bottle-owned fields.
- Group analytics derive their population from current Bottle membership.

## Compatibility Ownership

Retained BottleRelease routes:

- resolve the durable promotion mapping;
- translate input/output;
- delegate to canonical Bottle operations;
- emit bounded telemetry;
- never write BottleRelease or maintain target/release business logic.

Legacy nested URLs redirect to the promoted Bottle or Bottle-anchored related
release page. Permanent mappings survive BottleRelease cleanup.
