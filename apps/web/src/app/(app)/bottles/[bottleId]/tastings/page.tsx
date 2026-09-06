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
import { getReviewAndTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getBottleUrl } from "@peated/web/lib/urls";
import { Suspense } from "react";
import { z } from "zod";

import { BottleSection } from "../bottleSection.stylex";

const PageSearchParams = z
  .object({ cursor: z.string().optional() })
  .passthrough()
  .catch({});

export default async function BottleTastingsPage(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const id = parseCatalogRouteId(bottleId);
  const { cursor } = PageSearchParams.parse(searchParams);

  return (
    <BottleSection ariaLabel="Bottle reviews and tastings">
      <Suspense
        key={`${id}:${cursor ?? "first"}`}
        fallback={<TastingResultsLoading />}
      >
        <TastingResults id={id} cursor={cursor} searchParams={searchParams} />
      </Suspense>
    </BottleSection>
  );
}

function TastingResultsLoading() {
  return <LoadingList label="Loading reviews and tastings" />;
}

async function TastingResults({
  id,
  cursor,
  searchParams,
}: {
  id: number;
  cursor?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [bottle, { client }] = await Promise.all([
    getBottlePage(id),
    getPublicPageServerClient(),
  ]);
  const activity = await client.activity.reviewsAndTastings({
    bottle: id,
    cursor,
    limit: 25,
  });
  const pathname = `${getBottleUrl(bottle)}/tastings`;

  return (
    <>
      {activity.results.length ? (
        <CommunityFeed
          ariaLabel="Bottle reviews and tastings"
          items={getReviewAndTastingFeedItems(activity.results)}
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
          heading="No reviews or tastings yet"
        >
          No one has published a review or logged a tasting for this bottle.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Bottle review and tasting pages"
        nextHref={getCursorHref(
          pathname,
          searchParams,
          activity.rel.nextCursor,
        )}
      />
    </>
  );
}
