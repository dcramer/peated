"use client";

import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Table from "@peated/web/components/table";
import type { RouterOutputs } from "@peated/web/lib/trpc/client";

export default function ReleaseTable({
  bottleId,
  releaseList,
}: {
  bottleId: number;
  releaseList: RouterOutputs["bottleReleaseList"];
}) {
  if (!releaseList.results.length) {
    return (
      <EmptyActivity>
        <div className="font-semibold">
          We're not aware of any named releases of this bottling.
        </div>
        <div className="mt-4">
          <Button href={`/bottles/${bottleId}/addRelease`} color="primary">
            Add Release
          </Button>
        </div>
      </EmptyActivity>
    );
  }
  return (
    <Table
      items={releaseList.results}
      rel={releaseList.rel}
      defaultSort="date"
      url={(item) => `/bottles/${bottleId}/releases/${item.id}`}
      columns={[
        { name: "name", sort: "name", sortDefaultOrder: "asc" },
        {
          name: "age",
          sort: "statedAge",
          value: (item) =>
            item.statedAge ? (
              <Link
                className="hover:underline"
                href={`/bottles/?age=${item.statedAge}`}
              >{`${item.statedAge} years`}</Link>
            ) : null,
          className: "sm:w-1/8",
          sortDefaultOrder: "desc",
        },
        {
          name: "vintageYear",
          sort: "vintageYear",
          title: "Vintage",
          className: "sm:w-1/8",
          sortDefaultOrder: "desc",
        },
        {
          name: "releaseYear",
          sort: "releaseYear",
          title: "Release",
          className: "sm:w-1/8",
          sortDefaultOrder: "desc",
        },
        {
          name: "tastings",
          value: (item) => item.totalTastings.toLocaleString(),
          className: "sm:w-1/8 hidden sm:table-cell",
          sortDefaultOrder: "desc",
        },
        {
          name: "rating",
          value: (item) => (item.avgRating ? item.avgRating.toFixed(2) : null),
          className: "sm:w-1/8 hidden sm:table-cell",
          sortDefaultOrder: "desc",
        },
      ]}
    />
  );
}
