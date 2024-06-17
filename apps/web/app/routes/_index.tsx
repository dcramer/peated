import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import Alert from "@peated/web/components/alert";
import Glyph from "@peated/web/components/assets/Glyph";
import BetaNotice from "@peated/web/components/betaNotice";
import Button from "@peated/web/components/button";
import { ClientOnly } from "@peated/web/components/clientOnly";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import Spinner from "@peated/web/components/spinner";
import Tabs from "@peated/web/components/tabs";
import TastingList from "@peated/web/components/tastingList";
import useAuth from "@peated/web/hooks/useAuth";
import classNames from "@peated/web/lib/classNames";
import { trpc } from "@peated/web/lib/trpc";
import { type SerializeFrom } from "@remix-run/node";
import { Link, useLoaderData, useLocation } from "@remix-run/react";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";
import BottleLink from "../components/bottleLink";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

const defaultViewParam = "global";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils } }) => {
    const { searchParams } = new URL(request.url);
    const filter = mapFilterParam(searchParams.get("view"));

    const [tastingList, newBottleList] = await Promise.all([
      queryUtils.tastingList.ensureData({
        filter,
        limit: 10,
      }),
      queryUtils.bottleList.ensureData({
        limit: 10,
        sort: "-date",
      }),
    ]);

    return {
      tastingList,
      newBottleList,
    };
  },
);

export default function Activity() {
  const { user } = useAuth();
  const { tastingList, newBottleList } = useLoaderData<typeof loader>();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filterParam = mapFilterParam(qs.get("view"));

  return (
    <Layout>
      <div className="flex w-full">
        <div className="flex-1 overflow-hidden lg:w-8/12">
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
          </Tabs>
          <ActivityContent tastingList={tastingList} filter={filterParam} />
        </div>
        <div className="ml-4 hidden w-4/12 lg:block">
          {!user && (
            <div className="flex flex-col items-center rounded p-4 ring-1 ring-inset ring-slate-800">
              <p className="text-light mb-4 text-sm">
                Create a profile to record tastings, track your favorite
                bottles, and more.
              </p>
              <Button color="primary" to="/login" size="small">
                Sign Up or Login
              </Button>
            </div>
          )}
          <div>
            <Tabs fullWidth>
              <Tabs.Item active>Newest Bottles</Tabs.Item>
            </Tabs>
            <table className="my-2 min-w-full">
              {newBottleList.results.map((bottle) => {
                return (
                  <tr key={bottle.id} className="border-b border-slate-800">
                    <td className="max-w-0 py-2 pl-4 pr-4 text-sm sm:pl-3">
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
                            to={`/bottles/?category=${bottle.category}`}
                            className="hover:underline"
                          >
                            {formatCategoryName(bottle.category)}
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </table>

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
      </div>
    </Layout>
  );
}

const mapFilterParam = (value: string | null) => {
  if (value === "friends" || value === "local") return value;
  return defaultViewParam;
};

const ActivityContent = ({
  tastingList,
  filter,
}: {
  tastingList: SerializeFrom<typeof loader>["tastingList"];
  filter: string;
}) => {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = trpc.tastingList.useInfiniteQuery(
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

function PricesSkeleton() {
  return (
    <div className="mt-4 animate-pulse bg-slate-800" style={{ height: 200 }} />
  );
}

function PriceChanges() {
  const { data } = trpc.priceChangeList.useQuery();

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
                        to={`/bottles/?category=${bottle.category}`}
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
