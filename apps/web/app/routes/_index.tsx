import { Link, useLoaderData, useLocation } from "@remix-run/react";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";

import {
  json,
  type LoaderFunctionArgs,
  type SerializeFrom,
} from "@remix-run/node";
import Alert from "~/components/alert";
import Glyph from "~/components/assets/Glyph";
import BetaNotice from "~/components/betaNotice";
import Button from "~/components/button";
import { ClientOnly } from "~/components/clientOnly";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Spinner from "~/components/spinner";
import Tabs from "~/components/tabs";
import TastingList from "~/components/tastingList";
import useAuth from "~/hooks/useAuth";
import classNames from "~/lib/classNames";
import { trpc } from "~/lib/trpc";

const defaultViewParam = "global";

export async function loader({
  context: { trpc },
  request,
}: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const filter = mapFilterParam(searchParams.get("view"));

  return json({
    tastingList: await trpc.tastingList.query({
      filter,
      limit: 10,
    }),
  });
}

export default function Activity() {
  const { user } = useAuth();
  const { tastingList } = useLoaderData<typeof loader>();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filterParam = mapFilterParam(qs.get("view"));

  return (
    <Layout>
      <div className="flex w-full">
        <div className="flex-1 overflow-hidden">
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
        <div className="ml-4 hidden w-3/12 lg:block">
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
        <ul className="space-y-2 text-sm">
          {data.results.map((price) => {
            return (
              <li key={price.id} className="flex space-x-2">
                <Link
                  to={`/bottles/${price.bottle.id}`}
                  className="flex-auto truncate hover:underline"
                >
                  {price.bottle.fullName}
                </Link>
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
