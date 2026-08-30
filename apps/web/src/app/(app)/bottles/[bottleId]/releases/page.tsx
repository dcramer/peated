import {
  BottleIdentityRow,
  CursorPager,
  EmptyState,
  ItemList,
  ItemListItem,
} from "@peated/web/components/designSystem/components";
import { getBottleExpressionName } from "@peated/web/lib/bottleLabel";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import {
  parseReleaseFamilyRouteId,
  requireReleaseFamilyAnchor,
  requireReleaseFamilyGroup,
} from "@peated/web/lib/releaseFamily";

import { BottleSection } from "../bottleSection.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const { group } = await getReleaseGroup(parseReleaseFamilyRouteId(bottleId));
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
  const anchorId = parseReleaseFamilyRouteId(bottleId);
  const cursor = Number(searchParams.cursor ?? 1) || 1;
  const { client, group } = await getReleaseGroup(anchorId);
  const bottleList = await resolveOrNotFound(
    client.bottleGroups.bottles({
      cursor,
      group: group.id,
      limit: 25,
      query: "",
      sort: "-tastings",
    }),
  );
  const pathname = `/bottles/${anchorId}/releases`;

  return (
    <BottleSection count={bottleList.results.length} heading="Releases">
      {bottleList.results.length ? (
        <ItemList ariaLabel="Bottle releases">
          {bottleList.results.map((bottle) => (
            <ItemListItem key={bottle.id}>
              <BottleIdentityRow
                brand={bottle.brand.name}
                brandHref={`/entities/${bottle.brand.id}`}
                end={
                  bottle.medianScore !== null && bottle.scoreCount >= 20
                    ? `${bottle.medianScore} / 100`
                    : undefined
                }
                href={`/bottles/${bottle.id}`}
                imageUrl={bottle.imageUrl}
                metadata={getBottleMetadata(bottle).split(" · ")}
                name={getBottleExpressionName(bottle)}
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
    </BottleSection>
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
  return { client, group };
}
