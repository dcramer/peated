import { formatBottleLabel } from "@peated/server/lib/bottleDisplayName";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";
import type { Metadata } from "next";

import { BottleSellerList } from "./bottleSellerList.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const name = formatBottleLabel(bottle);
  return getCatalogSeoMetadata({
    title: `${name} prices`,
    description: `Compare listed prices for ${name} on Peated.`,
    url: `${getBottleUrl(bottle)}/prices`,
  });
}

export default async function BottlePricesPage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const id = parseCatalogRouteId(bottleId);
  // Web performance: read alongside the Bottle with the route ID. A merged
  // Bottle has another ID, and getBottlePage redirects before this renders.
  const [, priceList] = await Promise.all([
    getBottlePage(id),
    getAnonymousServerClient().then(({ client }) =>
      client.bottles.prices.list({ bottle: id }),
    ),
  ]);

  return priceList.results.length ? (
    <BottleSellerList sellers={priceList.results} />
  ) : (
    <EmptyState heading="No prices found">
      Peated does not have a price for this bottle.
    </EmptyState>
  );
}
