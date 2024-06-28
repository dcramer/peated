"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import Link from "@peated/web/components/link";
import { buildQueryString } from "@peated/web/lib/urls";
import { usePathname, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  return (
    <Link
      href={{
        pathname: pathname,
        search: buildQueryString(searchParams, {
          sort:
            sort === name
              ? invertSort
              : sort === invertSort
                ? name
                : defaultOrder === "asc"
                  ? name
                  : invertSort,
        }),
      }}
      className="gap-x inline-flex items-center hover:underline"
    >
      {label ?? toTitleCase(name)}
      {sort === name && <ArrowDownIcon className="h-4 w-4" />}
      {sort === invertSort && <ArrowUpIcon className="h-4 w-4" />}
    </Link>
  );
}
