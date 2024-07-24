"use client";

import type { Entity, EntityType, PagingRel } from "@peated/server/types";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import type { ComponentProps } from "react";
import { toTitleCase } from "../../../server/src/lib/strings";
import { getEntityTypeSearchUrl } from "../lib/urls";
import type { Column } from "./table";
import Table from "./table";

export default function EntityTable({
  entityList,
  rel,
  withLocations = false,
  withTastings = false,
  type,
  ...props
}: Omit<ComponentProps<typeof Table>, "items" | "rel" | "columns"> & {
  entityList: Entity[];
  withTastings?: boolean;
  withLocations?: boolean;
  rel?: PagingRel;
  type: EntityType;
}) {
  const link = getEntityTypeSearchUrl(type);

  return (
    <Table<Entity>
      items={entityList}
      rel={rel}
      columns={[
        {
          name: "name",
          title: type ? toTitleCase(type) : "Entity",
          sort: "name",
          sortDefaultOrder: "asc",
          className: classNames(
            "min-w-full",
            withTastings && withLocations ? "sm:w-1/2" : "",
            withTastings && !withLocations ? "sm:w-4/5" : "",
            !withTastings && withLocations ? "sm:w-3/5" : "",
            !withTastings && !withLocations ? "sm:w-4/5" : "",
          ),
          value: (item) => {
            return (
              <Link
                href={`/entities/${item.id}`}
                className="font-medium hover:underline"
              >
                {item.name}
              </Link>
            );
          },
        },
        {
          name: "bottles",
          value: (item) => item.totalBottles.toLocaleString(),
          className: "sm:w-1/10",
          sortDefaultOrder: "desc",
        },
        ...(withTastings
          ? ([
              {
                name: "tastings",
                value: (item) => item.totalTastings.toLocaleString(),
                className: "sm:w-1/10",
                sortDefaultOrder: "desc",
              },
            ] as Column<Entity>[])
          : []),
        ...(withLocations
          ? ([
              {
                name: "location",
                value: (item) => (
                  <>
                    {!!item.country && (
                      <div>
                        <Link
                          href={`/locations/${item.country.slug}`}
                          className="hover:underline"
                        >
                          {item.country.name}
                        </Link>
                      </div>
                    )}
                    {item.region && item.country && (
                      <div>
                        <Link
                          href={`/locations/${item.country.slug}/regions/${item.region.slug}`}
                          className="text-muted hover:underline"
                        >
                          {item.region.name}
                        </Link>
                      </div>
                    )}
                  </>
                ),
                className: "sm:w-3/10",
                sortDefaultOrder: "desc",
              },
            ] as Column<Entity>[])
          : []),
      ]}
      {...props}
    />
  );
}
