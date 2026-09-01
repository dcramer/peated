import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import {
  EntityCatalogPageClient,
  type EntityCatalogKind,
} from "./entityCatalogPageClient";

export async function EntityCatalogPage({
  kind,
  searchParams,
}: {
  kind: EntityCatalogKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryParams = getApiQueryParams(await searchParams, {
    numericFields: ["cursor", "limit"],
  });
  const { client } = await getPublicPageServerClient();
  const entityList =
    kind === "distillery"
      ? await client.distilleries.list(queryParams)
      : kind === "brand"
        ? await client.brands.list(queryParams)
        : kind === "bottler"
          ? await client.bottlers.list(queryParams)
          : await client.companies.list(queryParams);

  return <EntityCatalogPageClient initialEntityList={entityList} kind={kind} />;
}
