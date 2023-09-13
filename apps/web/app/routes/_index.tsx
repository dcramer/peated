import type { V2_MetaFunction } from "@remix-run/node";
import { Link, useLocation } from "@remix-run/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";

import type { Paginated } from "@peated/shared/types";

import Glyph from "~/components/assets/Glyph";
import { ClientOnly } from "~/components/clientOnly";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Spinner from "~/components/spinner";
import Tabs from "~/components/tabs";
import TastingList from "~/components/tastingList";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import type { ApiClient } from "~/lib/api";
import classNames from "~/lib/classNames";
import type { StorePrice, Tasting } from "~/types";

const defaultViewParam = "global";

const mapFilterParam = (value: string | null) => {
  if (value === "friends" || value === "local") return value;
  return defaultViewParam;
};

const getTastings = async ({
  api,
  filterParam,
  pageParam = 0,
}: {
  api: ApiClient;
  filterParam?: string;
  pageParam?: number;
}): Promise<Paginated<Tasting>> => {
  return await api.get("/tastings", {
    query: {
      page: pageParam || 1,
      filter: filterParam,
    },
  });
};

const ActivityContent = ({ filter }: { filter: string }) => {
  const api = useApi();

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery(
      ["tastings", { filter }],
      ({ pageParam }) => getTastings({ pageParam, api }),
      {
        getNextPageParam: (lastPage) => lastPage.rel?.nextPage,
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
        <EmptyActivity to="/search?tasting">
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
};

// export async function loader({ context, request }: LoaderArgs) {
//   const url = new URL(request.url);
//   const filterParam = mapFilterParam(url.searchParams.get("view"));
//   const queryClient = new QueryClient();

//   await queryClient.prefetchInfiniteQuery(
//     ["tastings", { filter: filterParam }],
//     async () =>
//       await getTastings({ filterParam: filterParam, api: context.api }),
//   );

//   return json({ dehydratedState: dehydrate(queryClient) });
// }

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Activity",
    },
  ];
};

export default function Activity() {
  const { user } = useAuth();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filterParam = mapFilterParam(qs.get("view"));

  return (
    <Layout>
      <div className="flex">
        <div className="flex-1">
          <Tabs fullWidth border>
            {user && (
              <Tabs.Item
                as={Link}
                to="?view=friends"
                active={filterParam == "friends"}
              >
                Friends
              </Tabs.Item>
            )}
            <Tabs.Item as={Link} to="./" active={filterParam === "global"}>
              Global
            </Tabs.Item>
            {/* <Tabs.Item to="?view=local" active={filterQ === "local"}>
          Local
        </Tabs.Item> */}
            <Tabs.Item as={Link} to="/updates" controlled>
              Updates
            </Tabs.Item>
          </Tabs>
          <ClientOnly>
            {() => (
              <QueryBoundary>
                <ActivityContent filter={filterParam} />
              </QueryBoundary>
            )}
          </ClientOnly>
        </div>
        <div className="ml-4 hidden w-[200px] sm:block">
          <Tabs fullWidth>
            <Tabs.Item active>Market Prices</Tabs.Item>
          </Tabs>
          <ClientOnly fallback={<PricesSkeleton />}>
            {() => (
              <QueryBoundary loading={<PricesSkeleton />}>
                <PriceChanges />
              </QueryBoundary>
            )}
          </ClientOnly>
        </div>
      </div>
    </Layout>
  );
}

function PricesSkeleton() {
  return (
    <div className="mt-4 animate-pulse bg-slate-800" style={{ height: 200 }} />
  );
}

function PriceChanges() {
  const api = useApi();
  const { data } = useQuery(
    ["price-changes"],
    (): Promise<Paginated<StorePrice>> => api.get(`/priceChanges`),
  );

  if (!data) return null;

  return (
    <div>
      {data.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {data.results.map((price) => {
            return (
              <li key={price.id}>
                <Link
                  to={`/bottles/${price.bottle?.id}`}
                  className="hover:underline"
                >
                  {price.bottle?.fullName}
                </Link>
                <div className="text-light flex flex-col">
                  <a href={price.url} className="flex hover:underline">
                    <span className="flex-1">{price.store?.name}</span>
                    <span>${(price.price / 100).toFixed(2)}</span>
                  </a>
                  <div className="flex text-xs">
                    <span className="flex-1">{price.volume}mL</span>
                    {price.previous && (
                      <span
                        className={classNames(
                          "flex self-end text-xs",
                          price.previous.price > price.price
                            ? "text-green-500"
                            : "text-red-500",
                        )}
                      >
                        <PriceDelta
                          price={price.price}
                          previous={price.previous.price}
                        />
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
