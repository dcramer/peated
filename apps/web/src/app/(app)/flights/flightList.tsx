import type { Outputs } from "@peated/server/orpc/router";

import {
  CursorPager,
  ItemList,
  ItemRow,
  LoadingPlaceholder,
} from "@peated/web/components";
import { getCursorHref } from "@peated/web/lib/cursorHref";

type FlightListResult = Outputs["flights"]["list"];

const loadingRows = [
  { description: 2, metadata: 1, title: 0 },
  { description: 3, metadata: 2, title: 1 },
  { description: 0, metadata: 3, title: 2 },
  { description: 1, metadata: 0, title: 3 },
] as const;

export function FlightList({
  flightList,
  page,
  searchParams,
}: {
  flightList: FlightListResult;
  page: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <>
      <ItemList ariaLabel="Tasting flights">
        {flightList.results.map((flight) => (
          <ItemRow
            description={flight.description}
            href={`/flights/${flight.id}`}
            key={flight.id}
            metadata={flight.public ? "Public" : "Private"}
            title={flight.name}
          />
        ))}
      </ItemList>
      <CursorPager
        ariaLabel="Flight pages"
        nextHref={getCursorHref(
          "/flights",
          searchParams,
          flightList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          "/flights",
          searchParams,
          flightList.rel.prevCursor,
        )}
      />
    </>
  );
}

/** Reserves the text-only flight rows while a result page streams. */
export function FlightListLoading() {
  return (
    <div aria-busy="true" aria-label="Loading flights" role="status">
      <ItemList ariaLabel="Loading flights">
        {loadingRows.map((delay, index) => (
          <ItemRow
            description={
              <LoadingPlaceholder delay={delay.description} preset="text" />
            }
            key={index}
            metadata={
              <LoadingPlaceholder delay={delay.metadata} preset="metadata" />
            }
            title={<LoadingPlaceholder delay={delay.title} preset="text" />}
          />
        ))}
      </ItemList>
    </div>
  );
}
