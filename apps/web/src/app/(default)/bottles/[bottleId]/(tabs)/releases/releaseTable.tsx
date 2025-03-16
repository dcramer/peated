"use client";

import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Table from "@peated/web/components/table";
import type { RouterOutputs } from "@peated/web/lib/trpc/client";

export default function ReleaseTable({
  bottleId,
  editionList,
}: {
  bottleId: number;
  editionList: RouterOutputs["bottleEditionList"];
}) {
  if (!editionList.results.length) {
    return (
      <EmptyActivity>
        <div className="font-semibold">
          We're not aware of any named releases of this bottling.
        </div>
        <div className="mt-4">
          <Button href={`/addEdition?bottle=${bottleId}`} color="primary">
            Add Release
          </Button>
        </div>
      </EmptyActivity>
    );
  }
  return (
    <Table
      items={editionList.results}
      rel={editionList.rel}
      defaultSort="date"
      url={(item) => `/bottles/${bottleId}/editions/${item.id}`}
      columns={[
        { name: "name", sort: "name", sortDefaultOrder: "asc" },
        {
          name: "tastings",
          value: (item) => item.totalTastings.toLocaleString(),
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
        {
          name: "rating",
          value: (item) => (item.avgRating ? item.avgRating.toFixed(2) : null),
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
        {
          name: "age",
          value: (item) =>
            item.statedAge ? (
              <Link
                className="hover:underline"
                href={`/bottles/?age=${item.statedAge}`}
              >{`${item.statedAge} years`}</Link>
            ) : null,
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
      ]}
    />
  );
}
