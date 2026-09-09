import type { Entity } from "@peated/server/types";

import {
  DataTable,
  type DataTableColumn,
} from "@peated/web/components/dataTable.stylex";
import {
  EmptyState,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { CursorPager } from "@peated/web/components/lists.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

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

const loadingRows = [
  { delay: 0, key: 0 },
  { delay: 1, key: 1 },
  { delay: 2, key: 2 },
  { delay: 3, key: 3 },
  { delay: 0, key: 4 },
] as const;
export function LocationTableLoading({
  kind,
}: {
  kind: "distilleries" | "locations" | "regions";
}) {
  const label = `Loading ${kind}`;
  const columns: DataTableColumn<(typeof loadingRows)[number]>[] = [
    {
      cell: ({ delay }) => <LoadingPlaceholder delay={delay} preset="text" />,
      header: kind === "distilleries" ? "Distiller" : "Location",
      key: "name",
    },
    {
      align: "right",
      cell: ({ delay }) => (
        <LoadingPlaceholder delay={delay} preset="metadata" />
      ),
      header: "Bottles",
      key: "bottles",
      priority: "secondary",
    },
    {
      align: "right",
      cell: ({ delay }) => (
        <LoadingPlaceholder delay={delay} preset="metadata" />
      ),
      header: kind === "distilleries" ? "Reviews" : "Distillers",
      key: "third",
      priority: "secondary",
    },
  ];

  return (
    <div aria-busy="true" aria-label={label} role="status">
      <DataTable
        caption={label}
        columns={columns}
        getKey={({ key }) => key}
        items={loadingRows}
      />
    </div>
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
    cell: (item) => item.publicReviewAndTastingCount.toLocaleString("en-US"),
    header: "Reviews",
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
          getHref={(item) => getEntityUrl(item)}
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
