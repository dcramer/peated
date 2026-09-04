"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import { ButtonLink, CursorPager, EmptyState } from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import { getTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

type TastingList = Outputs["tastings"]["list"];

export function EntityTastingListClient({
  entityId,
  entityName,
  initialTastingList,
}: {
  entityId: number;
  entityName: string;
  initialTastingList: TastingList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cursor = Number(searchParams.get("cursor") ?? "1") || 1;
  const { data: tastingList } = useSuspenseQuery({
    ...orpc.tastings.list.queryOptions({
      input: { cursor, entity: entityId, limit: 25 },
    }),
    initialData: initialTastingList,
  });

  return (
    <section
      aria-label={`Tastings of ${entityName}`}
      {...stylex.props(styles.content)}
    >
      {tastingList.results.length ? (
        <CommunityFeed
          ariaLabel={`${entityName} tastings`}
          items={getTastingFeedItems(tastingList.results)}
        />
      ) : (
        <EmptyState
          action={
            <ButtonLink
              href="/addBottle?intent=tasting"
              size="sm"
              variant="accent"
            >
              Find a bottle
            </ButtonLink>
          }
          heading="No tastings yet"
        >
          No one has logged a tasting connected to {entityName} yet.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel={`${entityName} tasting pages`}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          tastingList.rel.nextCursor,
        )}
        page={cursor}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          tastingList.rel.prevCursor,
        )}
      />
    </section>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
});
