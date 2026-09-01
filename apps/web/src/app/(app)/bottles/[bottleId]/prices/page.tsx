import type { Outputs } from "@peated/server/orpc/router";
import {
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "@peated/web/components";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

import { BottleSection } from "../bottleSection.stylex";

type PriceRow = Outputs["bottles"]["prices"]["list"]["results"][number];

const columns: DataTableColumn<PriceRow>[] = [
  {
    cell: (item) =>
      item.isValid
        ? `${item.site?.name} — ${item.name}`
        : `${item.site?.name} — ${item.name}`,
    header: "Seller",
    key: "seller",
  },
  {
    align: "right",
    cell: (item) => `${item.volume.toLocaleString("en-US")} ml`,
    header: "Size",
    key: "volume",
    priority: "secondary",
  },
  {
    align: "right",
    cell: (item) => <TimeSince date={item.updatedAt} />,
    header: "Updated",
    key: "updated",
    priority: "secondary",
  },
  {
    align: "right",
    cell: (item) => <Price currency={item.currency} value={item.price} />,
    header: "Price",
    key: "price",
  },
];

export default async function BottlePricesPage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const { client } = await getAnonymousServerClient();
  const priceList = await client.bottles.prices.list({ bottle: bottle.id });

  return (
    <BottleSection heading="Sellers">
      {priceList.results.length ? (
        <DataTable
          caption="Bottle sellers"
          columns={columns}
          getHref={(item) => (item.isValid ? item.url : undefined)}
          getKey={(item) => item.id}
          items={priceList.results}
        />
      ) : (
        <EmptyState heading="No sellers found">
          Peated does not have a current seller for this bottle.
        </EmptyState>
      )}
    </BottleSection>
  );
}
