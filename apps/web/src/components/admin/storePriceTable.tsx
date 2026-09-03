import type { PagingRel, StorePrice } from "@peated/server/types";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { BottleIdentityRow } from "../bottleIdentityRow.stylex";

import { AdminTextLink } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

export default function StorePriceTable({
  priceList,
  rel,
}: {
  priceList: StorePrice[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        {
          name: "listing",
          value: (price) => (
            <div>
              <AdminTextLink href={price.url}>{price.name}</AdminTextLink>
              {price.bottle ? (
                <BottleIdentityRow
                  {...toBottleListItem(price.bottle)}
                  layout="cell"
                />
              ) : (
                <div>No bottle</div>
              )}
            </div>
          ),
        },
        {
          align: "right",
          name: "price",
          value: (price) => (
            <Price value={price.price} currency={price.currency} />
          ),
        },
        {
          align: "right",
          name: "last seen",
          value: (price) => <TimeSince date={price.updatedAt} />,
        },
      ]}
      items={priceList}
      rel={rel}
    />
  );
}
