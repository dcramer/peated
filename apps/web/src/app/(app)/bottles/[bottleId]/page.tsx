import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
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

export default async function BottlePage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const canonicalBottle = await getBottlePage(
    parseReleaseFamilyRouteId(bottleId),
  );
  const { client } = await getAnonymousServerClient();
  const secondaryData = await Promise.allSettled([
    client.externalReviews.list({
      bottle: canonicalBottle.id,
      limit: 3,
      sort: "recent",
    }),
    client.tastings.list({ bottle: canonicalBottle.id, limit: 3 }),
    client.bottles.recommendations({
      bottle: canonicalBottle.id,
      limit: 3,
    }),
  ]);
  const [reviews, tastings, recommendations] = secondaryData;

  return (
    <BottleOverviewClient
      initialRecommendations={
        recommendations.status === "fulfilled"
          ? recommendations.value
          : undefined
      }
      initialReviews={
        reviews.status === "fulfilled" ? reviews.value : undefined
      }
      initialTastings={
        tastings.status === "fulfilled" ? tastings.value : undefined
      }
    />
  );
}
