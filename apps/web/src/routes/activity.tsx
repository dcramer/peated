import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ReactComponent as Glyph } from "../assets/glyph.svg";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import TastingList from "../components/tastingList";
import api from "../lib/api";
import type { Paginated, Tasting } from "../types";

import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";
import Spinner from "../components/spinner";
import useAuth from "../hooks/useAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const defaultViewParam = "global";

const mapFilterParam = (value: string | null) => {
  if (value === "friends" || value === "local") return value;
  return defaultViewParam;
};

const ActivityContent = ({ filter }: { filter: string }) => {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery(
      ["tastings", { filter }],
      ({ pageParam = 0 }): Promise<Paginated<Tasting>> =>
        api.get("/tastings", {
          query: {
            page: pageParam,
            filter,
          },
        }),
      {
        getNextPageParam: (lastPage, pages) => lastPage.rel.nextPage,
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
      {data.pages.length ? (
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

export default function Activity() {
  const { user } = useAuth();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filterParam = mapFilterParam(qs.get("view"));
  const isOnline = useOnlineStatus();

  return (
    <Layout>
      {isOnline ? (
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
            <ActivityContent filter={filterParam} />
          </QueryBoundary>
        </>
      ) : (
        <EmptyActivity>
          You'll need to connect to the internet see activity.
        </EmptyActivity>
      )}
    </Layout>
  );
}
