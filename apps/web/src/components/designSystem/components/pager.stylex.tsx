import * as stylex from "@stylexjs/stylex";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export type PagerProps = {
  ariaLabel?: string;
  currentPage: number;
  filterLabel?: string;
  getPageHref: (page: number) => string;
  rangeEnd: number;
  rangeStart: number;
  totalCount: number;
  totalPages: number;
};

type PageSlot = number | "ellipsis";

/** Navigates a known page range and states the records shown by the active filter. */
export function Pager({
  ariaLabel = "Pagination",
  currentPage,
  filterLabel,
  getPageHref,
  rangeEnd,
  rangeStart,
  totalCount,
  totalPages,
}: PagerProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(safeTotalPages, Math.max(1, currentPage));
  const slots = getPageSlots(safeCurrentPage, safeTotalPages);

  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.pager)}>
      <div {...stylex.props(styles.pages)}>
        {slots.map((slot, index) =>
          slot === "ellipsis" ? (
            <span
              aria-hidden="true"
              key={`ellipsis-${index}`}
              {...stylex.props(styles.ellipsis)}
            >
              …
            </span>
          ) : slot === safeCurrentPage ? (
            <span
              aria-current="page"
              key={slot}
              {...stylex.props(styles.page, styles.currentPage)}
            >
              {slot}
            </span>
          ) : (
            <a
              aria-label={`Page ${slot}`}
              href={getPageHref(slot)}
              key={slot}
              {...stylex.props(styles.page, styles.pageLink)}
            >
              {slot}
            </a>
          ),
        )}
      </div>
      <span {...stylex.props(styles.spacer)} />
      <span {...stylex.props(styles.range)}>
        showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{" "}
        {formatCount(totalCount)}
        {filterLabel ? ` · ${filterLabel}` : null}
      </span>
      <div {...stylex.props(styles.directionLinks)}>
        {safeCurrentPage > 1 ? (
          <a
            href={getPageHref(safeCurrentPage - 1)}
            rel="prev"
            {...stylex.props(styles.directionLink)}
          >
            ← Previous
          </a>
        ) : null}
        {safeCurrentPage < safeTotalPages ? (
          <a
            href={getPageHref(safeCurrentPage + 1)}
            rel="next"
            {...stylex.props(styles.directionLink)}
          >
            Next →
          </a>
        ) : null}
      </div>
    </nav>
  );
}

function getPageSlots(currentPage: number, totalPages: number): PageSlot[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

function formatCount(count: number) {
  return count.toLocaleString("en-US");
}

const styles = stylex.create({
  pager: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  pages: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  page: {
    boxSizing: "border-box",
    display: "inline-flex",
    minWidth: "34px",
    height: "34px",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: "10px",
    paddingLeft: "10px",
    borderRadius: controlMetrics.radiusSmall,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    textDecoration: "none",
  },
  pageLink: {
    outline: "none",
    backgroundColor: {
      default: colors.inset,
      ":hover": colors.surface,
    },
    color: colors.ink,
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  currentPage: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  ellipsis: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
  },
  spacer: {
    minWidth: "12px",
    flex: "1 1 12px",
  },
  range: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  },
  directionLinks: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  directionLink: {
    display: "inline-flex",
    height: "34px",
    alignItems: "center",
    paddingRight: "12px",
    paddingLeft: "12px",
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: colors.inset,
      ":hover": colors.surface,
    },
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    textDecoration: "none",
    whiteSpace: "nowrap",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
