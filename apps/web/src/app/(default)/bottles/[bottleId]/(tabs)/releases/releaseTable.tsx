"use client";

import { type Outputs } from "@peated/server/orpc/router";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import Table from "@peated/web/components/table";
import {
  formatBottlingName,
  getBottleBottlingPath,
  getNewBottleBottlingPath,
} from "@peated/web/lib/bottlings";
import ModActions from "./modActions";

export default function ReleaseTable({
  bottleId,
  releaseList,
}: {
  bottleId: number;
  releaseList: Outputs["bottleReleases"]["list"];
}) {
  if (!releaseList.results.length) {
    return (
      <EmptyActivity>
        <div className="font-semibold">
          We&apos;re not aware of any bottlings for this bottle yet.
        </div>
        <div className="mt-4">
          <Button href={getNewBottleBottlingPath(bottleId)} color="primary">
            Add Bottling
          </Button>
        </div>
      </EmptyActivity>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">
        Add an exact bottling when you care about a specific batch, vintage,
        pick, or single cask.
      </p>
      <ReleaseTableSection bottleId={bottleId} items={releaseList.results} />
      <PaginationButtons rel={releaseList.rel} />
    </div>
  );
}

function ReleaseTableSection({
  bottleId,
  items,
}: {
  bottleId: number;
  items: Outputs["bottleReleases"]["list"]["results"];
}) {
  return (
    <Table
      items={items}
      defaultSort="releaseYear"
      columns={[
        {
          name: "edition",
          title: "Bottling",
          sort: "edition",
          sortDefaultOrder: "asc",
          value: (item) => (
            <Link
              className="hover:underline"
              href={getBottleBottlingPath(bottleId, item.id)}
            >
              {formatBottlingName(item)}
            </Link>
          ),
        },
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
          title: "Bottled",
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
                  href={`/bottles/${bottleId}/addTasting?bottling=${item.id}`}
                  size="small"
                  title="Record a Tasting"
                >
                  <PeatedGlyph className="h-3 w-3" />
                </Button>
                <CollectionAction
                  bottleId={bottleId}
                  releaseId={item.id}
                  size="small"
                  title="Save Specific Bottling"
                />
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
