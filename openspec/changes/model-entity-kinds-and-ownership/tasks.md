## 1. Check Current Data

- [x] 1.1 List every code and documentation use of Entity `type`,
      `EntityType`, and `parentId`.
- [x] 1.2 Use the Entity API to sample every current type combination and known
      mixed-use businesses.
- [x] 1.3 Confirm that Brand, Distillery, Bottler, Blender, and Company cover the
      sample. Revise the approved list before schema work if they do not.

## 2. Add Kind And Owner

- [x] 2.1 Add the Entity kind enum and optional `kind` to the Drizzle schema.
- [x] 2.2 Rename the existing `parentId` self-reference to `ownerId`; do not add
      a second Entity self-reference or keep a compatibility alias.
- [x] 2.3 Add indexes for kind and owner lookup.
- [x] 2.4 Generate the preparation migration with `pnpm db:generate`; review it
      and do not edit migration SQL or metadata by hand.
- [x] 2.5 Add Entity create, update, serialization, and change-history support
      for optional kind and owner during the preparation deployment.
- [x] 2.6 Reject self ownership and owner loops in Entity updates.
- [x] 2.7 Update Entity merge to repoint safe owner links and reject conflicting
      owners.
- [x] 2.8 Add server tests for kind, owner chains, loops, authorization, and
      merge conflicts.

## 3. Backfill Existing Entities

- [x] 3.1 Page through the Entity API and collect every Entity whose kind is
      empty, with its current details and Bottle-use counts.
- [x] 3.2 Choose one kind for each Entity. Research unclear and mixed-use cases
      before changing them.
- [x] 3.3 Update kinds through the normal authenticated Entity API in bounded
      batches and re-fetch every changed Entity.
- [x] 3.4 Query the API again and verify that no Entity has a missing kind.
- [x] 3.5 Add current owners through the same API where one owner is known;
      leave unknown and joint ownership empty.
- [x] 3.6 Check for invalid owner links, owner loops, and unchanged Bottle-use
      counts.

## 4. Switch Server And Classifiers

- [x] 4.1 Replace public Entity `type` with required `kind` in schemas,
      serializers, API documentation, and generated clients.
- [x] 4.2 Add dedicated Brand, Distillery, Bottler, Blender, and Company browse
      endpoints. Keep the generic Entity API for cross-kind selection, create,
      update, and other shared operations. Each browse endpoint fixes its kind,
      and all list endpoints share implementation only below the public
      contract.
- [x] 4.3 Query Brand, Distillery, Bottler, Blender, and Company browse pages by
      kind through their dedicated endpoints.
- [x] 4.4 Use the generic Entity list for Bottle and other cross-kind
      selectors. Search all Entity kinds without a stored role filter or role
      ranking.
- [x] 4.5 Remove type-list updates and removal guards from Bottle and Entity
      create, edit, import, and merge code.
- [x] 4.6 Replace statistics, country, region, badge, repair, and audit queries
      that read Entity type with Bottle-link queries.
- [x] 4.7 Update CLI and local classifier catalog schemas to store kind and use
      Brand, Bottler, and Distiller only as Bottle field names.
- [x] 4.8 Update Bottle and Entity classifier instructions, tools, fixtures,
      tests, and eval scoring for kind.
- [x] 4.9 Add integration tests for first use in a Bottle field, one Entity in
      two fields, browse results, counts, and owner details.
- [x] 4.10 Check the three browse query plans and add an index only if a query
      needs it.

## 5. Update Entity Pages

- [x] 5.1 Replace the type multi-select with one required kind field and an
      optional current owner field.
- [x] 5.2 Show one kind and “Owned by” on the Entity header.
- [x] 5.3 Show directly owned Entities on owner pages.
- [x] 5.4 Keep Brand, Bottler, and Distiller Bottle counts in the catalog
      section instead of the header.
- [x] 5.5 Update all five kind browse pages to use their dedicated APIs. Keep
      Bottle-role use in the Entity catalog section and Bottle field searches.
- [x] 5.6 Update Add Bottle defaults so kind never blocks a Brand, Bottler, or
      Distiller selection.
- [ ] 5.7 Add focused component and browser tests for forms, headers, owners,
      browse pages, and Add Bottle.
- [ ] 5.8 Run desktop and mobile Entity-page QA with the local UI guide.

## 6. Finish The Migration

- [x] 6.1 Run the final data check and require zero missing kinds, zero owner
      loops, and matching Bottle-use counts.
- [x] 6.2 Make `kind` required and generate the final-switch migration with
      `pnpm db:generate`.
- [x] 6.3 Remove all application reads and writes for old Entity `type`; do not
      keep compatibility aliases.
- [x] 6.4 Update the whisky identity, Entity classifier, and Bottle classifier
      documentation with the final terms.
- [x] 6.5 Run focused server, CLI, classifier, and web tests; run server and web
      typechecks, file lint, formatting, and relevant classifier evals.
- [x] 6.6 Review the full change for duplicate logic, mixed terms, and code that
      keeps the old and new models alive.
- [ ] 6.7 Deploy the final switch after a verified backup and validate Entity
      kinds, owners, Bottle links, browse pages, and create/edit workflows.
- [ ] 6.8 After the switch is stable, remove the old type column and enum from
      the Drizzle schema, generate the cleanup migration, and run `pnpm test`.
