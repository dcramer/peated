import { type PagingRel } from "@peated/server/src/types";
import { useLocation } from "@remix-run/react";
import { buildQueryString } from "../lib/urls";
import Button from "./button";

export default function PaginationButtons({ rel }: { rel?: PagingRel | null }) {
  if (!rel) return null;

  const location = useLocation();

  return (
    <nav
      className="flex items-center justify-between py-3"
      aria-label="Pagination"
    >
      <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
        <Button
          to={
            rel.prevCursor
              ? {
                  search: buildQueryString(location.search, {
                    cursor: rel.prevCursor,
                  }),
                }
              : undefined
          }
          disabled={!rel.prevCursor}
        >
          Previous
        </Button>
        <Button
          to={
            rel.nextCursor
              ? {
                  search: buildQueryString(location.search, {
                    cursor: rel.nextCursor,
                  }),
                }
              : undefined
          }
          disabled={!rel.nextCursor}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
