import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { redirect } from "next/navigation";

import { EntitySeriesListClient } from "./entitySeriesListClient.stylex";
import { getEntitySeriesInput } from "./entitySeriesParams";

export default async function EntitySeriesPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const searchParams = await props.searchParams;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  if (entity.kind !== "distillery") redirect(getEntityUrl(entity));

  const { client } = await getPublicPageServerClient();
  const seriesList = await client.bottleSeries.list(
    getEntitySeriesInput(entity.id, searchParams),
  );

  return (
    <EntitySeriesListClient
      distilleryId={entity.id}
      distilleryName={entity.name}
      initialSeriesList={seriesList}
    />
  );
}
