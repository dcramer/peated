import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

import { BottleCatalogPageClient } from "./bottleCatalogPageClient";

export const metadata: Metadata = {
  title: "Whisky Bottles",
  description: "Browse whisky bottles in the Peated database.",
};

export default async function BottleListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryParams = normalizeBottleCatalogQueryParams(
    getApiQueryParams(await props.searchParams, {
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
