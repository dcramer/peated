import {
  ButtonLink,
  CursorPager,
  EmptyState,
  LoadingList,
} from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getBottleUrl } from "@peated/web/lib/urls";
import { Suspense } from "react";

import { BottleSection } from "../bottleSection.stylex";

export default async function BottleTastingsPage(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const id = parseCatalogRouteId(bottleId);
  const cursor = Number(searchParams.cursor ?? 1) || 1;

  return (
    <BottleSection ariaLabel="Bottle tastings">
      <Suspense
        key={`${id}:${cursor}`}
        fallback={<LoadingList label="Loading tastings" />}
      >
        <TastingResults id={id} cursor={cursor} searchParams={searchParams} />
      </Suspense>
    </BottleSection>
  );
}

async function TastingResults({
  id,
  cursor,
  searchParams,
}: {
  id: number;
  cursor: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [bottle, { client }] = await Promise.all([
    getBottlePage(id),
    getAnonymousServerClient(),
  ]);
  const tastingList = await client.tastings.list({
    bottle: id,
    cursor,
    limit: 25,
  });
  const pathname = `${getBottleUrl(bottle)}/tastings`;

  return (
    <>
      {tastingList.results.length ? (
        <CommunityFeed
          ariaLabel="Bottle tastings"
          items={getTastingFeedItems(tastingList.results)}
        />
      ) : (
        <EmptyState
          action={
            <ButtonLink
              href={getAddBottleHref({ bottleId: id, intent: "tasting" })}
              size="sm"
              variant="accent"
            >
              Log the first tasting
            </ButtonLink>
          }
          heading="No tastings yet"
        >
          No one has logged a tasting for this bottle.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Bottle tasting pages"
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
    </>
  );
}
