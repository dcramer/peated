import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { redirect } from "next/navigation";

import { entityHasBottleCatalog } from "../entityPageData";
import { EntityTastingListClient } from "./entityTastingListClient.stylex";

export default async function EntityTastingsPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  if (!entityHasBottleCatalog(entity)) redirect(getEntityUrl(entity));

  const { client } = await getAnonymousServerClient();
  const queryParams = getApiQueryParams(await props.searchParams, {
    numericFields: ["cursor"],
    overrides: { entity: entity.id, limit: 25 },
  });
  const tastingList = await client.tastings.list(queryParams);

  return (
    <EntityTastingListClient
      entityId={entity.id}
      entityName={entity.name}
      initialTastingList={tastingList}
    />
  );
}
