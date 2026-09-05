import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { LoadingPlaceholder } from "./feedback.stylex";

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
            <span {...stylex.props(foundationStyles.metadata, styles.label)}>
              {label}
            </span>
            <span {...stylex.props(foundationStyles.metadata, styles.count)}>
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

/** Reserves distribution labels and bars while category counts stream. */
export function DistributionListLoading() {
  return (
    <div aria-busy="true" aria-label="Loading bottle categories" role="status">
      <ul {...stylex.props(styles.list)}>
        {([0, 1, 2, 3] as const).map((delay) => (
          <li aria-hidden="true" key={delay} {...stylex.props(styles.item)}>
            <div {...stylex.props(styles.copy)}>
              <LoadingPlaceholder delay={delay} preset="metadata" />
              <span {...stylex.props(styles.loadingCount)}>
                <LoadingPlaceholder delay={delay} preset="metadata" />
              </span>
            </div>
            <div {...stylex.props(styles.track)} />
          </li>
        ))}
      </ul>
    </div>
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
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  count: {
    flexShrink: 0,
    margin: 0,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
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
  loadingCount: { width: "44px", flexShrink: 0 },
});
