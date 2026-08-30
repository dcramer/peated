import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
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
  const queryParams = getApiQueryParams(await props.searchParams, {
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
  });
  const { client } = await getPublicPageServerClient();
  const bottleList = await client.bottles.list(queryParams);

  return <BottleCatalogPageClient initialBottleList={bottleList} />;
}
