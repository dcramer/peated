"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import Alert from "@peated/web/components/alert";
import Glyph from "@peated/web/components/assets/Glyph";
import BetaNotice from "@peated/web/components/betaNotice";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Spinner from "@peated/web/components/spinner";
import TastingList from "@peated/web/components/tastingList";
import classNames from "@peated/web/lib/classNames";
import { trpcClient } from "@peated/web/lib/trpc";
import Link from "next/link";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";
import BottleLink from "../components/bottleLink";

export function ActivityContent({
  tastingList,
  filter,
}: {
  // TODO: this is wrong, cant remember how to ref the 'output' here a better
  // solution in trpc
  tastingList: ReturnType<typeof trpcClient.tastingList.useQuery>;
  filter: string;
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = trpcClient.tastingList.useInfiniteQuery(
    { filter, limit: 10 },
    {
      staleTime: Infinity,
      initialData: { pages: [tastingList], pageParams: [null] },
      getNextPageParam: (lastPage) => lastPage.rel?.nextCursor,
    },
  );

  const onScroll = () => {
    if (!hasNextPage) return;
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchNextPage();
    }
  };

  useEventListener("scroll", onScroll);

  if (error) {
    return (
      <EmptyActivity>
        <Alert noMargin>
          Looks like we hit an error trying to load activity. Have a dram and
          try again later?
        </Alert>
      </EmptyActivity>
    );
  }

  if (!data) return null;

  return (
    <>
      {data.pages.length > 1 || data.pages[0].results.length ? (
        data.pages.map((group, i) => (
          <Fragment key={i}>
            <TastingList values={group.results} />
          </Fragment>
        ))
      ) : (
        <EmptyActivity href="/search?tasting">
          <Glyph className="h-16 w-16" />

          <div className="mt-4 font-semibold">What are you drinking?</div>
          <div className="mt-2 block">
            Get started by recording your first tasting notes.
          </div>
        </EmptyActivity>
      )}
      <div>{isFetching && !isFetchingNextPage ? <Spinner /> : null}</div>
    </>
  );
}

export function PriceChangesSkeleton() {
  return (
    <div className="mt-4 animate-pulse bg-slate-800" style={{ height: 200 }} />
  );
}

export function PriceChanges() {
  const { data } = trpcClient.priceChangeList.useQuery();

  if (!data) return null;

  return (
    <div className="mt-4">
      <BetaNotice>This is a work in progress.</BetaNotice>
      {data.results.length ? (
        <table className="my-2 min-w-full text-sm">
          <colgroup>
            <col className="min-w-full sm:w-5/6" />
            <col className="sm:w-1/6" />
          </colgroup>
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
                      <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
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
        </table>
      ) : (
        <p className="mt-4 text-center text-sm">No price history found.</p>
      )}
    </div>
  );
}

function PriceDelta({ price, previous }: { price: number; previous: number }) {
  const sign = price > previous ? "+" : "-";
  return (
    <span className="flex items-center">
      {sign}${(Math.abs(price - previous) / 100).toFixed(2)}
    </span>
  );
}
