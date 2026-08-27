import type { Product, WithContext } from "schema-dts";

import { BottlePageController } from "@peated/web/components/designSystem/product/bottlePageController.stylex";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";

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
  const { client } = await getServerClient();
  const bottle = await client.bottles.details({ bottle: canonicalBottle.id });
  const bottleIdentity = getBottlePlainTextIdentity(bottle);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bottleIdentity,
    image: bottle.imageUrl ?? undefined,
    description: summarize(bottle.description || "", 200),
    brand: { "@type": "Brand", name: bottle.brand.name },
    aggregateRating:
      bottle.totalScores > 0 && bottle.avgScore !== null
        ? {
            "@type": "AggregateRating",
            ratingValue: bottle.avgScore,
            bestRating: 100,
            worstRating: 0,
            reviewCount: bottle.totalScores,
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
      <BottlePageController initialBottle={bottle} />
    </>
  );
}
