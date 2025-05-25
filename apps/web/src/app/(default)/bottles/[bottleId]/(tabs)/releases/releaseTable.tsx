"use client";

import { type Outputs } from "@peated/server/orpc/router";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Table from "@peated/web/components/table";
import ModActions from "./modActions";

export default function ReleaseTable({
  bottleId,
  releaseList,
}: {
  bottleId: number;
  releaseList: Outputs["bottles"]["releases"]["list"];
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
      defaultSort="releaseYear"
      // url={(item) => `/bottles/${bottleId}/releases/${item.id}`}
      columns={[
        { name: "edition", sort: "edition", sortDefaultOrder: "asc" },
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
          name: "abv",
          sort: "abv",
          title: "ABV",
          className: "sm:w-1/8",
        },
        {
          name: "actions",
          title: "",
          align: "right",
          value: (item) => {
            return (
              <div className="flex flex-row justify-end gap-2">
                <Button
                  href={`/bottles/${bottleId}/addTasting?release=${item.id}`}
                  size="small"
                  title="Record a Tasting"
                >
                  <PeatedGlyph className="h-3 w-3" />
                </Button>
                <ModActions release={item} />
              </div>
            );
          },
          className: "sm:w-1/8 hidden sm:table-cell flex",
        },
      ]}
    />
  );
}
