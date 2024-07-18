"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import { type Currency } from "@peated/server/types";
import BetaNotice from "@peated/web/components/betaNotice";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { trpc } from "@peated/web/lib/trpc/client";
import BottleLink from "./bottleLink";
import Price from "./price";

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
  return (
    <div className="mt-4 animate-pulse bg-slate-800" style={{ height: 200 }} />
  );
}

export default function PriceChanges() {
  const [data] = trpc.priceChangeList.useSuspenseQuery();

  return (
    <div className="mt-4">
      <BetaNotice>This is a work in progress.</BetaNotice>
      {data.results.length ? (
        <table className="my-2 min-w-full text-sm">
          <colgroup>
            <col className="min-w-full sm:w-5/6" />
            <col className="sm:w-1/6" />
          </colgroup>
          <tbody>
            {data.results.map((price) => {
              const { bottle } = price;
              return (
                <tr key={price.id} className="border-b border-slate-800">
                  <td className="max-w-0 py-2 pl-4 pr-3 text-sm sm:pl-3">
                    <div className="flex items-center space-x-1">
                      <BottleLink
                        bottle={bottle}
                        className="font-medium hover:underline"
                      >
                        {bottle.fullName}
                      </BottleLink>
                      {bottle.vintageYear && (
                        <>
                          {" "}
                          <span className="text-light">
                            ({bottle.vintageYear})
                          </span>
                        </>
                      )}
                      {bottle.isFavorite && (
                        <StarIcon className="h-4 w-4" aria-hidden="true" />
                      )}
                      {bottle.hasTasted && (
                        <CheckBadgeIcon
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    {!!bottle.category && (
                      <div className="text-light text-sm">
                        <Link
                          href={`/bottles/?category=${bottle.category}`}
                          className="hover:underline"
                        >
                          {formatCategoryName(bottle.category)}
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pl-3 pr-4 text-right sm:table-cell sm:pr-3">
                    <div className="text-light flex flex-col items-end text-xs">
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
        <p className="mt-4 text-center text-sm">No price history found.</p>
      )}
    </div>
  );
}
