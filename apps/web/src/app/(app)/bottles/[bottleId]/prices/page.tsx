import { EmptyState } from "@peated/web/components";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

import { BottleSellerList } from "./bottleSellerList.stylex";

export default async function BottlePricesPage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const { client } = await getAnonymousServerClient();
  const priceList = await client.bottles.prices.list({ bottle: bottle.id });

  return priceList.results.length ? (
    <BottleSellerList sellers={priceList.results} />
  ) : (
    <EmptyState heading="No prices found">
      Peated does not have a price for this bottle.
    </EmptyState>
  );
}
