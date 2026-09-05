import * as stylex from "@stylexjs/stylex";

import { LoadingList, LoadingPlaceholder } from "@peated/web/components";
import { colors, controlMetrics, space } from "../../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

export function LocationBottleListLoading() {
  return (
    <div>
      <div aria-hidden="true" {...stylex.props(styles.toolbar)}>
        <LoadingPlaceholder preset="heading" />
        <span {...stylex.props(styles.sort)} />
      </div>
      <LoadingList label="Loading bottles" rows={5} />
    </div>
  );
}

const styles = stylex.create({
  toolbar: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
    paddingBottom: space.x3,
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  sort: {
    width: "132px",
    height: controlMetrics.controlHeightSmall,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
});
