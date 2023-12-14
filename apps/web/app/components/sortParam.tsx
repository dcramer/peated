import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import { buildQueryString } from "@peated/web/lib/urls";
import { Link } from "@remix-run/react";
import { useLocation } from "react-router-dom";

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
  const location = useLocation();
  const invertSort = `-${name}`;
  return (
    <Link
      to={{
        pathname: location.pathname,
        search: buildQueryString(location.search, {
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
