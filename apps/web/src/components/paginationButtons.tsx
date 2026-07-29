"use client";

import { type PagingRel } from "@peated/server/types";
import { useSearchParams } from "next/navigation";
import { buildQueryString } from "../lib/urls";
import Button from "./button";

export default function PaginationButtons({
  rel,
  cursorParam = "cursor",
  ariaLabel = "Pagination",
}: {
  rel?: PagingRel | null;
  cursorParam?: string;
  ariaLabel?: string;
}) {
  const searchParams = useSearchParams();

  if (!rel || (!rel.prevCursor && !rel.nextCursor)) return null;

  return (
    <nav
      className="flex items-center justify-between py-3"
      aria-label={ariaLabel}
    >
      <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
        <Button
          href={
            rel.prevCursor
              ? {
                  search: buildQueryString(searchParams, {
                    [cursorParam]: rel.prevCursor,
                  }),
                }
              : undefined
          }
          disabled={!rel.prevCursor}
        >
          Previous
        </Button>
        <Button
          href={
            rel.nextCursor
              ? {
                  search: buildQueryString(searchParams, {
                    [cursorParam]: rel.nextCursor,
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
