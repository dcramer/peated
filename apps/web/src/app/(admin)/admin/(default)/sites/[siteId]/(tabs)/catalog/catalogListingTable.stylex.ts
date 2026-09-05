import * as stylex from "@stylexjs/stylex";

import { colors, space } from "../../../../../../../../styles/tokens.stylex";

export const styles = stylex.create({
  mobileDetails: {
    display: { default: "none", "@media (max-width: 639px)": "grid" },
    gap: space.x2,
    margin: `${space.x2} 0 0`,
  },
  mobileDates: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: space.x3,
  },
  mobileLabel: {
    color: colors.inkMuted,
    fontSize: "0.75rem",
  },
  mobileValue: {
    margin: 0,
    color: colors.ink,
  },
});
