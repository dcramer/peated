import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveCountryOrNotFound } from "@peated/web/lib/orpc/notFound.server";

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
  const entityListPromise =
    kind === "distillery"
      ? client.distilleries.list(queryParams)
      : kind === "brand"
        ? client.brands.list(queryParams)
        : kind === "bottler"
          ? client.bottlers.list(queryParams)
          : client.companies.list(queryParams);
  const entityList = queryParams.country
    ? await resolveCountryOrNotFound(entityListPromise, "query")
    : await entityListPromise;

  return <EntityCatalogPageClient initialEntityList={entityList} kind={kind} />;
}
