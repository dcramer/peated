"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ButtonLink,
  CursorPager,
  EmptyState,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import { Avatar } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

type Tasting = Outputs["tastings"]["list"]["results"][number];
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
        <div {...stylex.props(styles.list)}>
          {tastingList.results.map((tasting) => (
            <EntityTastingEntry key={tasting.id} tasting={tasting} />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <ButtonLink
              href="/addBottle?intent=tasting"
              size="sm"
              variant="accent"
            >
              Log a tasting
            </ButtonLink>
          }
          heading="No tastings yet"
        >
          No one has recorded a tasting connected to {entityName} yet.
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

function EntityTastingEntry({ tasting }: { tasting: Tasting }) {
  const member: TastingEntryMember = {
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  };

  return (
    <TastingEntry
      author={tasting.createdBy.username}
      authorHref={`/users/${tasting.createdBy.username}`}
      date={<TimeSince date={tasting.createdAt} />}
      leading={
        <Avatar
          imageUrl={tasting.createdBy.pictureUrl}
          initials={tasting.createdBy.username.slice(0, 2).toLocaleUpperCase()}
        />
      }
      members={[member]}
    />
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
  list: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
  },
});
