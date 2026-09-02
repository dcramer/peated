import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../styles/tokens.stylex";

export type DistributionListItem = {
  count: number;
  label: string;
};

/** Shows labeled counts as bars. Use a different component for interactive rows. */
export function DistributionList({
  items,
}: {
  items: readonly DistributionListItem[];
}) {
  const visibleItems = items.filter(({ count }) => count > 0);
  const largestCount = Math.max(...visibleItems.map(({ count }) => count), 0);

  if (!visibleItems.length) return null;

  return (
    <ul {...stylex.props(styles.list)}>
      {visibleItems.map(({ count, label }) => (
        <li key={label} {...stylex.props(styles.item)}>
          <div {...stylex.props(styles.copy)}>
            <span {...stylex.props(styles.label)}>{label}</span>
            <span {...stylex.props(styles.count)}>
              {count.toLocaleString()}
            </span>
          </div>
          <div aria-hidden="true" {...stylex.props(styles.track)}>
            <span
              style={{ width: `${(count / largestCount) * 100}%` }}
              {...stylex.props(styles.fill)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  item: {
    minWidth: 0,
  },
  copy: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
  },
  label: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  count: {
    flexShrink: 0,
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  track: {
    height: "5px",
    marginTop: space.x1,
    overflow: "hidden",
    backgroundColor: colors.inset,
  },
  fill: {
    display: "block",
    height: "100%",
    backgroundColor: colors.dataAccent,
  },
});
