import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

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
  const { client } = await getAnonymousServerClient();
  const entityListPromise =
    kind === "distillery"
      ? client.distilleries.list(queryParams)
      : kind === "brand"
        ? client.brands.list(queryParams)
        : kind === "bottler"
          ? client.bottlers.list(queryParams)
          : client.companies.list(queryParams);
  const [entityList, countryList] = await Promise.all([
    entityListPromise,
    client.countries.list({ onlyMajor: true, sort: "-bottles" }),
  ]);

  return (
    <EntityCatalogPageClient
      initialCountryList={countryList}
      initialEntityList={entityList}
      kind={kind}
    />
  );
}
