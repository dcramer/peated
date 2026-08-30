import type { PagingRel, StorePrice } from "@peated/server/types";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";

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
            <span>
              <AdminTextLink href={price.url}>{price.name}</AdminTextLink>
              {price.bottle ? (
                <>
                  {" · "}
                  <AdminTextLink href={`/bottles/${price.bottle.id}`}>
                    {price.bottle.fullName}
                  </AdminTextLink>
                </>
              ) : (
                " · No bottle"
              )}
            </span>
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
