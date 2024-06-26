"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import BetaNotice from "@peated/web/components/betaNotice";
import classNames from "@peated/web/lib/classNames";
import { trpc } from "@peated/web/lib/trpc";
import Link from "next/link";
import BottleLink from "./bottleLink";

function PriceDelta({ price, previous }: { price: number; previous: number }) {
  const sign = price > previous ? "+" : "-";
  return (
    <span className="flex items-center">
      {sign}${(Math.abs(price - previous) / 100).toFixed(2)}
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
                      <span>${(price.price / 100).toFixed(2)}</span>
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
