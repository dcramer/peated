import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { BottleCatalogPageClient } from "./bottleCatalogPageClient";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky bottles",
      description: "Browse whisky bottles in the Peated database.",
      url: "/bottles",
    },
    await props.searchParams,
  );
}

export default async function BottleListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryParams = normalizeBottleCatalogQueryParams(
    getApiQueryParams(await props.searchParams, {
      defaults: { sort: "-release" },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
      numericFields: [
        "age",
        "brand",
        "bottler",
        "cursor",
        "distiller",
        "entity",
        "limit",
        "minScore",
        "series",
      ],
      overrides: { limit: 50 },
    }),
  );
  const { client } = await getPublicPageServerClient();
  const bottleList = await client.bottles.list(queryParams);

  return <BottleCatalogPageClient initialBottleList={bottleList} />;
}
