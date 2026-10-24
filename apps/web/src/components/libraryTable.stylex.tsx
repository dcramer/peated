"use client";

import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../styles/tokens.stylex";
import {
  BottleIdentityRow,
  BottleIdentityRowLoading,
} from "./bottleIdentityRow.stylex";
import { CatalogTable, type CatalogTableColumn } from "./catalogTable.stylex";
import { LoadingText } from "./feedback.stylex";
import type { LibraryItem } from "./libraryList.stylex";
import { RowMenu } from "./rowMenu.stylex";

// The finished table and its loading view share these headers and widths.
const columnLayout = {
  bottle: { header: "Bottle", key: "bottle" },
  status: { header: "Status", key: "status", width: "figure" },
  abv: {
    align: "right",
    header: "ABV",
    key: "abv",
    priority: "secondary",
    width: "figure",
  },
  actions: {
    header: <ActionsHeader />,
    interactive: true,
    key: "actions",
    width: "menu",
  },
} as const satisfies Record<string, Omit<CatalogTableColumn<unknown>, "cell">>;

export type LibraryTableProps = {
  caption: string;
  items: readonly LibraryItem[];
};

/**
 * Dense table of one member's Library, the compact alternative to
 * LibraryList. Each row links to its Bottle and shows a compact bottle
 * identity with its category, producers, and release facts on one line, the status, the
 * ABV, and, for the owner, a row menu. Narrow screens drop the ABV column.
 * Map API entries with getLibraryItem. Routes own queries, empty states, and
 * paging.
 */
export function LibraryTable({ caption, items }: LibraryTableProps) {
  const columns: CatalogTableColumn<LibraryItem>[] = [
    {
      cell: (item) => (
        <BottleIdentityRow
          align="start"
          details={
            <p {...stylex.props(foundationStyles.metadata, styles.details)}>
              {item.facts}
            </p>
          }
          href={item.href}
          imageFit={item.imageFit}
          imageUrl={item.imageUrl}
          layout="cell"
          linkArea="parent"
          name={item.name}
          variant="compact"
        />
      ),
      ...columnLayout.bottle,
    },
    {
      cell: (item) =>
        item.status ? (
          <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
            {item.status}
          </span>
        ) : null,
      ...columnLayout.status,
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
  ];
  if (items.some((item) => item.actions?.length)) {
    columns.push({
      cell: (item) =>
        item.actions?.length ? (
          <span {...stylex.props(styles.menu)}>
            <RowMenu
              groups={item.actions}
              label={item.name}
              triggerVariant="quiet"
            />
          </span>
        ) : null,
      ...columnLayout.actions,
    });
  }

  return (
    <CatalogTable
      caption={caption}
      columns={columns}
      density="compact"
      getKey={(item) => item.id}
      items={items}
      linked
    />
  );
}

/** Reserves the Library table's columns and two-line rows while it loads. */
export function LibraryTableLoading({
  actions = false,
  label = "Loading library bottles",
  rows = 8,
}: {
  /** Reserve the row menu column, which only the owner sees. */
  actions?: boolean;
  label?: string;
  rows?: number;
}) {
  const columns: CatalogTableColumn<number>[] = [
    {
      cell: () => (
        <BottleIdentityRowLoading
          align="start"
          details={
            <p {...stylex.props(foundationStyles.metadata, styles.details)}>
              <LoadingText width="16em" />
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
          <LoadingText width="5ch" />
        </span>
      ),
      ...columnLayout.status,
    },
    {
      cell: () => (
        <span {...stylex.props(foundationStyles.metadata, styles.firstLine)}>
          <LoadingText width="3ch" />
        </span>
      ),
      ...columnLayout.abv,
    },
    ...(actions
      ? [
          {
            cell: () => (
              <span {...stylex.props(styles.menu)}>
                <span {...stylex.props(styles.loadingMenu)} />
              </span>
            ),
            ...columnLayout.actions,
          },
        ]
      : []),
  ];

  return (
    <div aria-busy="true" aria-label={label} role="status">
      <div aria-hidden="true">
        <CatalogTable
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

function ActionsHeader() {
  return <span {...stylex.props(styles.visuallyHidden)}>Actions</span>;
}

const styles = stylex.create({
  // Matches BottleIdentityRow's compact top padding (space.x1) so the status
  // and ABV share the bottle name's line.
  firstLine: {
    display: "block",
    paddingTop: space.x1,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  details: {
    marginTop: 0,
    marginBottom: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menu: {
    display: "flex",
    justifyContent: "flex-end",
  },
  loadingMenu: {
    display: "block",
    width: controlMetrics.controlHeightSmall,
    height: controlMetrics.controlHeightSmall,
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});
