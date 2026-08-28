import {
  ButtonLink,
  CursorPager,
  EmptyState,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import { Avatar } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { parseReleaseFamilyRouteId } from "@peated/web/lib/releaseFamily";

import { BottleSection } from "../bottleSection.stylex";

export default async function BottleTastingsPage(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const id = parseReleaseFamilyRouteId(bottleId);
  const cursor = Number(searchParams.cursor ?? 1) || 1;
  const { client } = await getAnonymousServerClient();
  const tastingList = await client.tastings.list({
    bottle: id,
    cursor,
    limit: 25,
  });
  const pathname = `/bottles/${id}/tastings`;

  return (
    <BottleSection count={tastingList.results.length} heading="Tastings">
      {tastingList.results.length ? (
        <div>
          {tastingList.results.map((tasting) => {
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
                key={tasting.id}
                leading={
                  <Avatar
                    imageUrl={tasting.createdBy.pictureUrl}
                    initials={tasting.createdBy.username
                      .slice(0, 2)
                      .toLocaleUpperCase()}
                  />
                }
                members={[member]}
              />
            );
          })}
        </div>
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
          No one has recorded a tasting for this bottle.
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
    </BottleSection>
  );
}
