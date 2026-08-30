import {
  ButtonLink,
  CursorPager,
  EmptyState,
} from "@peated/web/components/designSystem/components";
import { TastingRecordEntry } from "@peated/web/components/tastingRecordEntry";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
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
          {tastingList.results.map((tasting) => (
            <TastingRecordEntry key={tasting.id} tasting={tasting} />
          ))}
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
