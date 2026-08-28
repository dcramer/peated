import type { Product, WithContext } from "schema-dts";

import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
import {
  getAnonymousServerClient,
  getServerClient,
} from "@peated/web/lib/orpc/client.server";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";

import { BottlePageClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseReleaseFamilyRouteId(bottleId));
  const bottleIdentity = getBottlePlainTextIdentity(bottle);
  const description = summarize(bottle.description || "", 200);
  const images = bottle.imageUrl ? [bottle.imageUrl] : [];

  return {
    title: bottleIdentity,
    description,
    images,
    openGraph: { title: bottleIdentity, description, images },
    twitter: { card: "summary", images },
  };
}

export default async function BottlePage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const canonicalBottle = await getBottlePage(
    parseReleaseFamilyRouteId(bottleId),
  );
  const [{ client }, { client: anonymousClient }] = await Promise.all([
    getServerClient(),
    getAnonymousServerClient(),
  ]);
  const [bottle, secondaryData] = await Promise.all([
    client.bottles.details({ bottle: canonicalBottle.id }),
    Promise.allSettled([
      anonymousClient.externalReviews.list({
        bottle: canonicalBottle.id,
        limit: 3,
        sort: "recent",
      }),
      anonymousClient.tastings.list({ bottle: canonicalBottle.id, limit: 3 }),
      anonymousClient.bottles.recommendations({
        bottle: canonicalBottle.id,
        limit: 3,
      }),
    ]),
  ]);
  const [reviews, tastings, recommendations] = secondaryData;
  const bottleIdentity = getBottlePlainTextIdentity(bottle);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bottleIdentity,
    image: bottle.imageUrl ?? undefined,
    description: summarize(bottle.description || "", 200),
    brand: { "@type": "Brand", name: bottle.brand.name },
    aggregateRating:
      bottle.scoreCount > 0 && bottle.medianScore !== null
        ? {
            "@type": "AggregateRating",
            ratingValue: bottle.medianScore,
            bestRating: 100,
            worstRating: 0,
            reviewCount: bottle.scoreCount,
          }
        : undefined,
    offers: bottle.lastPrice
      ? {
          "@type": "AggregateOffer",
          offerCount: 1,
          lowPrice: bottle.lastPrice.price / 100,
          highPrice: bottle.lastPrice.price / 100,
          priceCurrency: bottle.lastPrice.currency,
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BottlePageClient
        initialBottle={bottle}
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
    </>
  );
}
