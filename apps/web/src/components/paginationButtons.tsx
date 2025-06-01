"use client";

import type { PagingRel } from "@peated/server/types";
import Button from "./button";

export default function PaginationButtons({ rel }: { rel?: PagingRel | null }) {
  if (!rel) return null;

  return (
    <nav
      className="flex items-center justify-between py-3"
      aria-label="Pagination"
    >
      <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
        <Button
          to="."
          search={
            rel.prevCursor
              ? (prev) => ({ ...prev, cursor: rel.prevCursor })
              : undefined
          }
          disabled={!rel.prevCursor}
        >
          Previous
        </Button>
        <Button
          to="."
          search={
            rel.nextCursor
              ? (prev) => ({ ...prev, cursor: rel.nextCursor })
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
