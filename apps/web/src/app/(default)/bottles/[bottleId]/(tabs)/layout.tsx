import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";
import { type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";
import BottleFullHeader from "../bottleFullHeader";
import BottleTabs from "../bottleTabs";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = await props.params;

  const { bottleId } = params;

  const bottle = await getBottlePage(parseReleaseFamilyRouteId(bottleId));

  const description = summarize(bottle.description || "", 200);
  const images = bottle.imageUrl ? [bottle.imageUrl] : [];

  return {
    title: bottle.fullName,
    description,
    images,
    openGraph: {
      title: bottle.fullName,
      description: description,
      images,
    },
    twitter: {
      card: "summary",
      images,
    },
  };
}

export default async function Layout(props: {
  params: Promise<{ bottleId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const bottleId = parseReleaseFamilyRouteId(params.bottleId);
  const bottle = await getBottlePage(bottleId);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bottle.fullName,
    image: bottle.imageUrl ?? undefined,
    description: summarize(bottle.description || "", 200),
    brand: {
      "@type": "Brand",
      name: bottle.brand?.name,
    },
    aggregateRating: bottle.totalTastings
      ? {
          "@type": "AggregateRating",
          ratingValue: bottle.avgRating ?? 0,
          reviewCount: bottle.totalTastings,
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
      <BottleFullHeader bottle={bottle} />
      <BottleTabs bottle={bottle} />
      {children}
    </>
  );
}
