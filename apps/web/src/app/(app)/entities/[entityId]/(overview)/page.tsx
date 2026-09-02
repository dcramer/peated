import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getEntitySeoMetadata } from "@peated/web/lib/seoMetadata";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { EntityOverviewClient } from "../entityOverviewClient.stylex";
import { entityOverviewQueries } from "../entityOverviewQueries";
import {
  entityHasBottleCatalog,
  getEntityRelationshipOwnerIds,
} from "../entityPageData";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return getEntitySeoMetadata(entity, { canonical: true });
}

export default async function EntityPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const queryClient = getQueryClient();
  const { client } = await getPublicPageServerClient();
  const orpc = createTanstackQueryUtils(client);
  const { operatedOwnerId, siblingOwnerId } =
    getEntityRelationshipOwnerIds(entity);
  const prefetches = [
    queryClient.prefetchQuery(entityOverviewQueries.events(orpc, entity)),
  ];

  if (entityHasBottleCatalog(entity)) {
    prefetches.push(
      queryClient.prefetchQuery(
        entityOverviewQueries.bottleCatalog(orpc, entity),
      ),
      queryClient.prefetchQuery(
        entityOverviewQueries.popularBottles(orpc, entity),
      ),
      queryClient.prefetchQuery(entityOverviewQueries.releases(orpc, entity)),
    );
  }

  if (operatedOwnerId) {
    prefetches.push(
      queryClient.prefetchQuery(entityOverviewQueries.operated(orpc, entity)),
    );
  }

  if (siblingOwnerId) {
    prefetches.push(
      queryClient.prefetchQuery(entityOverviewQueries.siblings(orpc, entity)),
    );
  }

  await Promise.all(prefetches);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EntityOverviewClient />
    </HydrationBoundary>
  );
}
