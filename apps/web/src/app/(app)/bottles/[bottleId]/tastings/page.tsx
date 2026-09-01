import {
  ButtonLink,
  CursorPager,
  EmptyState,
  ItemList,
  ItemListItem,
} from "@peated/web/components";
import { TastingRecordEntry } from "@peated/web/components/tastingRecordEntry";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getBottleUrl } from "@peated/web/lib/urls";

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
    <BottleSection heading="Tastings">
      {tastingList.results.length ? (
        <ItemList ariaLabel="Bottle tasting records">
          {tastingList.results.map((tasting) => (
            <ItemListItem key={tasting.id}>
              <TastingRecordEntry tasting={tasting} />
            </ItemListItem>
          ))}
        </ItemList>
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
    </BottleSection>
  );
}
