import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntitySeoMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";

import { EntityOverviewClient } from "./entityOverviewClient.stylex";
import { entityHasBottleCatalog } from "./entityPageData";

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
  const { client } = await getAnonymousServerClient();
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const bottleList = entityHasBottleCatalog(entity)
    ? await client.bottles
        .list({
          distilleryView: entity.kind === "distillery" ? "other" : undefined,
          entity: entity.id,
          limit: 4,
          sort: "-tastings",
        })
        .catch(() => undefined)
    : undefined;

  return (
    <EntityOverviewClient
      initialBottleList={bottleList}
      initialEntity={entity}
    />
  );
}
