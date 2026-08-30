import type { ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";

import { BottlePageFrameClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseReleaseFamilyRouteId(bottleId));
  const title = formatBottleDisplayName(bottle);
  const description = summarize(bottle.description || "", 200);
  const images = bottle.imageUrl ? [bottle.imageUrl] : [];

  return {
    title,
    description,
    images,
    openGraph: { title, description, images },
    twitter: { card: "summary" as const, images },
  };
}

export default async function BottleLayout(props: {
  children: ReactNode;
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const canonicalBottle = await getBottlePage(
    parseReleaseFamilyRouteId(bottleId),
  );
  const { client } = await getServerClient();
  const bottle = await client.bottles.details({ bottle: canonicalBottle.id });
  const title = formatBottleDisplayName(bottle);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <BottlePageFrameClient initialBottle={bottle}>
        {props.children}
      </BottlePageFrameClient>
    </>
  );
}
