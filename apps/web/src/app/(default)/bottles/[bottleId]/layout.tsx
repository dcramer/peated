import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { getCanonicalRouteRedirectPath } from "@peated/web/lib/tombstoneRedirect";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";

export default async function Layout(props: {
  params: Promise<Record<string, any>>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const { client } = await getAnonymousServerClient();

  const bottleId = Number(params.bottleId);
  const bottle = await resolveOrNotFound(
    client.bottles.details({
      bottle: bottleId,
    }),
  );

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (bottle.id !== bottleId) {
    return redirect(
      await getCanonicalRouteRedirectPath({
        currentId: bottleId,
        canonicalId: bottle.id,
        collectionPath: "/bottles",
      }),
    );
  }

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
