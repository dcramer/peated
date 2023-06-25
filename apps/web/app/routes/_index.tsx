import { useLocation } from "@remix-run/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Glyph from "~/components/assets/Glyph";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import TastingList from "~/components/tastingList";
import type { ApiClient } from "~/lib/api";
import type { Tasting } from "~/types";

import type { Paginated } from "@peated/shared/types";
import type { V2_MetaFunction } from "@remix-run/node";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";
import FloatingButton from "~/components/floatingButton";
import Spinner from "~/components/spinner";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";

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
        getNextPageParam: (lastPage) => lastPage.rel.nextPage,
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
      <>
        <Tabs fullWidth>
          {user && (
            <Tabs.Item to="?view=friends" active={filterParam == "friends"}>
              Friends
            </Tabs.Item>
          )}
          <Tabs.Item to="./" active={filterParam === "global"}>
            Global
          </Tabs.Item>
          {/* <Tabs.Item to="?view=local" active={filterQ === "local"}>
          Local
        </Tabs.Item> */}
          <Tabs.Item to="/updates" controlled>
            Updates
          </Tabs.Item>
        </Tabs>
        <QueryBoundary>
          <div className="hidden sm:block">
            <FloatingButton to="/search?tasting" />
          </div>
          <ActivityContent filter={filterParam} />
        </QueryBoundary>
      </>
    </Layout>
  );
}
