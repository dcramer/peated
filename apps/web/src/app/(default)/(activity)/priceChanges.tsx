"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import { type Currency } from "@peated/server/types";
import BetaNotice from "@peated/web/components/betaNotice";
import BottleLink from "@peated/web/components/bottleLink";
import Link from "@peated/web/components/link";
import Price from "@peated/web/components/price";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { trpc } from "@peated/web/lib/trpc/client";
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
  return (
    <div className="mb-8 animate-pulse bg-slate-800" style={{ height: 200 }} />
  );
}

export default function PriceChanges() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.prices.changeList.queryOptions({ input: { limit: 25 } }),
  );

  return (
    <div className="mb-8">
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
              if (!bottle) return null;
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
                      <div className="text-muted text-sm">
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
        <p className="text-muted mb-8 text-center text-sm">
          No price history found.
        </p>
      )}
    </div>
  );
}
