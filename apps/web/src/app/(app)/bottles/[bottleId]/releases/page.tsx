import {
  BottleIdentityRow,
  CursorPager,
  EmptyState,
  ItemList,
  ItemListItem,
  LoadingList,
} from "@peated/web/components";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import {
  requireReleaseFamilyAnchor,
  requireReleaseFamilyGroup,
} from "@peated/web/lib/releaseFamily";
import { getBottleUrl } from "@peated/web/lib/urls";
import { Suspense } from "react";

import { BottleSection } from "../bottleSection.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const { group } = await getReleaseGroup(parseCatalogRouteId(bottleId));
  return {
    title: `${group.fullName} releases`,
    description: `Explore releases of ${group.fullName}.`,
  };
}

export default async function BottleReleasesPage(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const anchorId = parseCatalogRouteId(bottleId);
  const cursor = Number(searchParams.cursor ?? 1) || 1;

  return (
    <BottleSection heading="Releases">
      <Suspense
        key={`${anchorId}:${cursor}`}
        fallback={<LoadingList label="Loading releases" />}
      >
        <ReleaseResults
          anchorId={anchorId}
          cursor={cursor}
          searchParams={searchParams}
        />
      </Suspense>
    </BottleSection>
  );
}

async function ReleaseResults({
  anchorId,
  cursor,
  searchParams,
}: {
  anchorId: number;
  cursor: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { anchorBottle, client, group } = await getReleaseGroup(anchorId);
  const bottleList = await resolveOrNotFound(
    client.bottleGroups.bottles({
      cursor,
      group: group.id,
      limit: 25,
      query: "",
      sort: "-tastings",
    }),
  );
  const pathname = `${getBottleUrl(anchorBottle)}/releases`;

  return (
    <>
      {bottleList.results.length ? (
        <ItemList ariaLabel="Bottle releases">
          {bottleList.results.map((bottle) => (
            <ItemListItem key={bottle.id}>
              <BottleIdentityRow
                {...toBottleListItem(bottle)}
                end={
                  bottle.medianScore !== null && bottle.scoreCount >= 20
                    ? `${bottle.medianScore} / 100`
                    : undefined
                }
              />
            </ItemListItem>
          ))}
        </ItemList>
      ) : (
        <EmptyState heading="No releases found">
          This release family has no visible bottles.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Release pages"
        nextHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.nextCursor,
        )}
        page={cursor}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.prevCursor,
        )}
      />
    </>
  );
}

async function getReleaseGroup(anchorId: number) {
  const [anchorBottle, { client }] = await Promise.all([
    getBottlePage(anchorId),
    getAnonymousServerClient(),
  ]);
  const summary = requireReleaseFamilyGroup(anchorBottle);
  const group = await resolveOrNotFound(
    client.bottleGroups.details({ group: summary.id }),
  );
  requireReleaseFamilyAnchor(group);
  return { anchorBottle, client, group };
}
