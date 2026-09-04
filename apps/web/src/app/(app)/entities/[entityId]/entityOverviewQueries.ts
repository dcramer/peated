import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";

import { entityHasBottleCatalog, type Entity } from "./entityPageData";

/** Keeps server prefetches and client reads on the same query keys. */
export const entityOverviewQueries = {
  bottleCatalog: (orpc: ORPCQueryUtils, entity: Entity) => ({
    ...orpc.entities.catalog.queryOptions({
      input: { entity: entity.id },
    }),
    enabled: entityHasBottleCatalog(entity),
  }),
  events: (orpc: ORPCQueryUtils, entity: Entity) =>
    orpc.entities.events.list.queryOptions({
      input: { entity: entity.id },
    }),
  companyPortfolio: (orpc: ORPCQueryUtils, entity: Entity) => {
    const companyId = entity.kind === "company" ? entity.id : undefined;

    return {
      ...orpc.entities.portfolio.queryOptions({
        input: {
          company: companyId ?? entity.id,
          limit: 1,
        },
      }),
      enabled: Boolean(companyId),
    };
  },
  popularBottles: (orpc: ORPCQueryUtils, entity: Entity) => ({
    ...orpc.bottles.list.queryOptions({
      input: {
        distilleryView: entity.kind === "distillery" ? "other" : undefined,
        entity: entity.id,
        limit: 4,
        sort: "-tastings",
      },
    }),
    enabled: entityHasBottleCatalog(entity),
  }),
  releases: (orpc: ORPCQueryUtils, entity: Entity) => ({
    ...orpc.bottles.list.queryOptions({
      input: {
        distilleryView: entity.kind === "distillery" ? "releases" : undefined,
        entity: entity.id,
        limit: 4,
        sort: "-release",
      },
    }),
    enabled: entityHasBottleCatalog(entity),
  }),
  siblings: (orpc: ORPCQueryUtils, entity: Entity) => ({
    ...orpc.entities.list.queryOptions({
      input: {
        kinds:
          entity.kind === "company" ? undefined : ["distillery", "bottler"],
        limit: 5,
        owner: entity.ownerId ?? undefined,
        sort: "-bottles",
      },
    }),
    enabled: Boolean(entity.ownerId),
  }),
};
