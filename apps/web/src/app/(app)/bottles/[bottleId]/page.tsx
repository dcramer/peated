import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";

import { BottleOverviewClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseReleaseFamilyRouteId(bottleId));
  return getBottleSeoMetadata(bottle, { canonical: true });
}

export default function BottlePage() {
  return <BottleOverviewClient />;
}
