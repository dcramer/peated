"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import { Link } from "@tanstack/react-router";

export default function SortParam({
  name,
  label,
  sort,
  defaultOrder = "asc",
}: {
  name: string;
  label?: string;
  sort?: string | null;
  defaultOrder?: "asc" | "desc";
}) {
  const invertSort = `-${name}`;

  return (
    <Link
      to="."
      search={(prev) => ({
        ...prev,
        sort:
          sort === name
            ? invertSort
            : sort === invertSort
              ? name
              : defaultOrder === "asc"
                ? name
                : invertSort,
      })}
      className="inline-flex items-center gap-x hover:underline"
    >
      {label ?? toTitleCase(name)}
      {sort === name && <ArrowDownIcon className="h-4 w-4" />}
      {sort === invertSort && <ArrowUpIcon className="h-4 w-4" />}
    </Link>
  );
}
