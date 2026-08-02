"use client";

import { type Currency } from "@peated/server/types";
import BottleIdentity, {
  type BottleIdentitySource,
} from "@peated/web/components/bottleIdentity";
import { BottleStatusIndicators } from "@peated/web/components/bottleStatusIcons";
import Price from "@peated/web/components/price";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

function PriceDelta({
  price,
  previous,
  currency,
}: {
  price: number;
  previous: number;
  currency: Currency;
}) {
  const sign = price > previous ? "+" : "-";
  return (
    <span className="flex items-center">
      {sign}
      <Price value={Math.abs(price - previous)} currency={currency} />
    </span>
  );
}

export function PriceChangesSkeleton() {
  return <div className="animate-pulse bg-slate-800" style={{ height: 200 }} />;
}

export function PriceChangeIdentity({
  bottle,
  hasTasted,
  isLibrary,
}: {
  bottle: BottleIdentitySource;
  hasTasted: boolean;
  isLibrary: boolean;
}) {
  return (
    <BottleIdentity
      bottle={bottle}
      mode="absolute"
      metadataVariant="summary"
      trailingContent={
        <BottleStatusIndicators hasTasted={hasTasted} isLibrary={isLibrary} />
      }
    />
  );
}

export default function PriceChanges() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.prices.changeList.queryOptions({ input: { limit: 25 } }),
  );

  return (
    <div>
      {data.results.length ? (
        <table className="my-2 min-w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Bottle</th>
              <th scope="col">Price change</th>
            </tr>
          </thead>
          <colgroup>
            <col className="min-w-full sm:w-5/6" />
            <col className="sm:w-1/6" />
          </colgroup>
          <tbody>
            {data.results.map((price) => {
              return (
                <tr
                  key={`${price.id}:${price.currency}`}
                  className="border-b border-slate-800"
                >
                  <td className="max-w-0 py-2 pl-4 pr-3 text-sm sm:pl-3">
                    <PriceChangeIdentity
                      bottle={price.bottle}
                      hasTasted={price.hasTasted}
                      isLibrary={price.isLibrary}
                    />
                  </td>
                  <td
                    aria-label="Price change"
                    className="py-2 pl-3 pr-4 text-right sm:table-cell sm:pr-3"
                  >
                    <div className="text-muted flex flex-col items-end text-xs">
                      <span>
                        <Price value={price.price} currency={price.currency} />
                      </span>
                      <span
                        className={classNames(
                          price.previousPrice > price.price
                            ? "text-green-500"
                            : "text-red-500",
                        )}
                      >
                        <PriceDelta
                          price={price.price}
                          previous={price.previousPrice}
                          currency={price.currency}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-muted px-3 text-sm">No price history found.</p>
      )}
    </div>
  );
}
