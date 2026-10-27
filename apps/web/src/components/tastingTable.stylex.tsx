"use client";

import * as stylex from "@stylexjs/stylex";

import {
  breakpointStyles,
  foundationStyles,
} from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import {
  BottleIdentityRow,
  BottleIdentityRowLoading,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { LoadingText } from "./feedback.stylex";
import { TastingRating, type RatingBand } from "./scoring.stylex";
import { Table, type TableColumn } from "./table.stylex";
import { Timestamp } from "./timestamp";

export type TastingTableItem = Pick<
  BottleIdentityRowProps,
  "imageFit" | "imageUrl" | "name"
> & {
  abv: string | null;
  /** The tasting page; the whole row links here. */
  href: string;
  id: string;
  /** The member's note as one line of plain text. */
  note?: string;
  ratingBand: RatingBand | null;
  /** When the member had the dram. */
  tastedAt: string;
};

// The finished table and its loading view share these headers and widths.
const columnLayout = {
  date: { header: "Date", key: "date", priority: "secondary", width: "date" },
  bottle: { header: "Bottle", key: "bottle" },
  abv: {
    align: "right",
    header: "ABV",
    key: "abv",
    priority: "secondary",
    width: "figure",
  },
  rating: { align: "right", header: "Rating", key: "rating", width: "rating" },
} as const satisfies Record<string, Omit<TableColumn<unknown>, "cell">>;

export type TastingTableProps = {
  caption: string;
  items: readonly TastingTableItem[];
};

/**
 * Dense table of one member's tastings. Each row links to its tasting and shows
 * the date, a compact bottle identity, ABV, and rating on its first line, with
 * the note cut to one line beneath the bottle. Narrow screens drop the date and
 * ABV columns and show the date before the note. Map API tastings with
 * getTastingTableItems. Routes own queries, empty states, and paging.
 */
export function TastingTable({ caption, items }: TastingTableProps) {
  const columns: TableColumn<TastingTableItem>[] = [
    {
      cell: (item) => (
        <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
          <Timestamp date={item.tastedAt} format="date" />
        </span>
      ),
      ...columnLayout.date,
    },
    {
      cell: (item) => (
        <BottleIdentityRow
          align="start"
          details={<TastingTableDetails item={item} />}
          href={item.href}
          imageFit={item.imageFit}
          imageUrl={item.imageUrl}
          layout="cell"
          linkArea="parent"
          linkLabel={`View tasting of ${item.name}`}
          name={item.name}
          variant="compact"
        />
      ),
      ...columnLayout.bottle,
    },
    {
      cell: (item) =>
        item.abv ? (
          <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
            {item.abv}
          </span>
        ) : null,
      ...columnLayout.abv,
    },
    {
      cell: (item) =>
        item.ratingBand ? (
          <span {...stylex.props(styles.firstLine, styles.rating)}>
            <TastingRating band={item.ratingBand} labelOnly size="sm" />
          </span>
        ) : null,
      ...columnLayout.rating,
    },
  ];

  return (
    <Table
      caption={caption}
      columns={columns}
      density="compact"
      getKey={(item) => item.id}
      items={items}
      linked
    />
  );
}

/** Reserves the tasting table's columns and two-line rows while it loads. */
export function TastingTableLoading({
  label = "Loading tastings",
  rows = 8,
}: {
  label?: string;
  rows?: number;
}) {
  const columns: TableColumn<number>[] = [
    {
      cell: () => (
        <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
          <LoadingText width="84px" />
        </span>
      ),
      ...columnLayout.date,
    },
    {
      cell: () => (
        <BottleIdentityRowLoading
          align="start"
          details={
            <p {...stylex.props(foundationStyles.metadata, styles.details)}>
              <LoadingText width="24em" />
            </p>
          }
          layout="cell"
          variant="compact"
        />
      ),
      ...columnLayout.bottle,
    },
    {
      cell: () => (
        <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
          <LoadingText width="3ch" />
        </span>
      ),
      ...columnLayout.abv,
    },
    {
      cell: () => (
        <span
          {...stylex.props(
            foundationStyles.interactiveSmall,
            styles.firstLine,
            styles.rating,
          )}
        >
          <LoadingText width="72px" />
        </span>
      ),
      ...columnLayout.rating,
    },
  ];

  return (
    <div aria-busy="true" aria-label={label} role="status">
      <div aria-hidden="true">
        <Table
          caption={label}
          columns={columns}
          density="compact"
          getKey={(index) => index}
          items={Array.from({ length: rows }, (_, index) => index)}
        />
      </div>
    </div>
  );
}

function TastingTableDetails({ item }: { item: TastingTableItem }) {
  return (
    <p {...stylex.props(foundationStyles.metadata, styles.details)}>
      {/* Table hides the Date column at the same shared breakpoint. */}
      <span {...stylex.props(breakpointStyles.narrowOnly, styles.narrowDate)}>
        <Timestamp date={item.tastedAt} format="date" />
        {item.note ? <span aria-hidden="true"> · </span> : null}
      </span>
      {item.note}
    </p>
  );
}

const styles = stylex.create({
  // Matches BottleIdentityRow's compact top padding (space.x1) so the date,
  // ABV, and rating share the bottle name's line.
  firstLine: {
    display: "block",
    paddingTop: space.x1,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  // A flex box keeps the body line height from pushing the rating below the name.
  rating: {
    display: "flex",
    justifyContent: "flex-end",
  },
  details: {
    marginTop: 0,
    marginBottom: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  narrowDate: {
    fontVariantNumeric: "tabular-nums",
  },
});
