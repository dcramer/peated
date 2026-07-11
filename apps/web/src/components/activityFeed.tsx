"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Glyph from "@peated/web/assets/glyph.svg";
import ActivityList, {
  filterFavoriteActivity,
} from "@peated/web/components/activityList";
import Alert from "@peated/web/components/alert";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Spinner from "@peated/web/components/spinner";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { useEventListener } from "usehooks-ts";

export default function ActivityFeed({
  activityList,
  filter = "global",
}: {
  activityList: Outputs["activity"]["list"];
  filter: "global" | "friends" | "local";
}) {
  const orpc = useORPC();
  const {
    data: { pages },
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery({
    queryKey: orpc.activity.list.key({
      input: {
        filter,
        limit: 10,
      },
    }),
    queryFn: async ({ pageParam }) => {
      const page = await orpc.activity.list.call({
        filter,
        limit: 10,
        cursor: pageParam,
      });
      return {
        ...page,
        results: filterFavoriteActivity(page.results),
      };
    },
    initialPageParam: undefined as number | undefined,
    staleTime: Infinity,
    initialData: () => {
      return {
        pages: [
          {
            ...activityList,
            results: filterFavoriteActivity(activityList.results),
          },
        ],
        pageParams: [undefined],
      };
    },
    getNextPageParam: (lastPage) => lastPage.rel?.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.rel?.prevCursor,
  });

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

  const visibleActivityCount = pages.reduce(
    (count, page) => count + page.results.length,
    0,
  );

  useEffect(() => {
    if (visibleActivityCount < 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, visibleActivityCount]);

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

  return (
    <>
      {visibleActivityCount ? (
        pages.map((group, i) =>
          group.results.length ? (
            <Fragment key={i}>
              <ActivityList values={group.results} />
            </Fragment>
          ) : null,
        )
      ) : hasNextPage || isFetchingNextPage ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <EmptyActivity href="/addBottle?intent=tasting">
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
