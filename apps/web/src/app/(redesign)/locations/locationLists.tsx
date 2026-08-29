import type { Entity } from "@peated/server/types";

import {
  CursorPager,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "@peated/web/components/designSystem/components";

type LocationListItem = {
  name: string;
  slug: string;
  totalBottles: number;
  totalDistillers: number;
};

const locationColumns: DataTableColumn<LocationListItem>[] = [
  {
    cell: () => null,
    header: "Location",
    key: "name",
  },
  {
    align: "right",
    cell: (item) => item.totalBottles.toLocaleString("en-US"),
    header: "Bottles",
    key: "bottles",
    priority: "secondary",
  },
  {
    align: "right",
    cell: (item) => item.totalDistillers.toLocaleString("en-US"),
    header: "Distillers",
    key: "distillers",
    priority: "secondary",
  },
];

export function LocationTable({
  caption,
  getHref,
  items,
}: {
  caption: string;
  getHref: (item: LocationListItem) => string;
  items: readonly LocationListItem[];
}) {
  const columns: DataTableColumn<LocationListItem>[] = [
    { ...locationColumns[0], cell: (item) => item.name },
    ...locationColumns.slice(1),
  ];

  return (
    <DataTable
      caption={caption}
      columns={columns}
      getHref={getHref}
      getKey={(item) => item.slug}
      items={items}
    />
  );
}

const distillerColumns: DataTableColumn<Entity>[] = [
  {
    cell: (item) => item.name,
    header: "Distiller",
    key: "name",
  },
  {
    align: "right",
    cell: (item) => item.totalBottles.toLocaleString("en-US"),
    header: "Bottles",
    key: "bottles",
    priority: "secondary",
  },
  {
    align: "right",
    cell: (item) => item.totalTastings.toLocaleString("en-US"),
    header: "Tastings",
    key: "tastings",
    priority: "secondary",
  },
];

export function LocationDistillerList({
  items,
  name,
  nextHref,
  page,
  previousHref,
}: {
  items: readonly Entity[];
  name: string;
  nextHref?: string;
  page: number;
  previousHref?: string;
}) {
  return (
    <section aria-label={`${name} distillers`}>
      {items.length ? (
        <DataTable
          caption={`Distillers in ${name}`}
          columns={distillerColumns}
          getHref={(item) => `/entities/${item.id}`}
          getKey={(item) => item.id}
          items={items}
        />
      ) : (
        <EmptyState heading="No distillers yet">
          No distillers have been recorded for this location.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel={`${name} distiller pages`}
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}
