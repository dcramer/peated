"use client";

import { type PagingRel } from "@peated/server/types";
import { useSearchParams } from "next/navigation";
import { buildQueryString } from "../lib/urls";
import Button from "./button";

export default function PaginationButtons({ rel }: { rel?: PagingRel | null }) {
  const searchParams = useSearchParams();

  if (!rel) return null;

  return (
    <nav
      className="flex items-center justify-between py-3"
      aria-label="Pagination"
    >
      <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
        <Button
          href={
            rel.prevCursor
              ? {
                  search: buildQueryString(searchParams, {
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
          href={
            rel.nextCursor
              ? {
                  search: buildQueryString(searchParams, {
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
