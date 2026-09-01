import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";

import { BottleOverviewClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  return getBottleSeoMetadata(bottle, { canonical: true });
}

export default function BottlePage() {
  return <BottleOverviewClient />;
}
