"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Glyph from "@peated/web/assets/glyph.svg";
import Alert from "@peated/web/components/alert";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Spinner from "@peated/web/components/spinner";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { useEventListener } from "usehooks-ts";

export default function ActivityFeed({
  tastingList,
  filter = "global",
}: {
  tastingList: Outputs["tastings"]["list"];
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
  } = useSuspenseInfiniteQuery(
    orpc.tastings.list.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        filter,
        limit: 10,
        cursor: pageParam,
      }),
      initialPageParam: undefined,
      staleTime: Infinity,
      initialData: () => {
        return {
          pages: [tastingList],
          pageParams: [undefined],
        };
      },
      getNextPageParam: (lastPage) => lastPage.rel?.nextCursor,
      getPreviousPageParam: (firstPage) => firstPage.rel?.prevCursor,
    }),
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

  return (
    <>
      {pages.length > 1 || pages[0].results.length ? (
        pages.map((group, i) => (
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
