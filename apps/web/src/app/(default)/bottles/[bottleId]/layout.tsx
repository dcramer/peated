import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
import { type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";

export default async function Layout(props: {
  params: Promise<Record<string, any>>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const bottleId = Number(params.bottleId);
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
          reviewCount: bottle.totalTastings ?? 0,
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
      {children}
    </>
  );
}
