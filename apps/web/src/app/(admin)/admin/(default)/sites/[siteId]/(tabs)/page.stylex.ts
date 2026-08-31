import * as stylex from "@stylexjs/stylex";

import { space } from "../../../../../../../styles/tokens.stylex";

export const styles = stylex.create({
  settings: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
  },
  dividedSetting: {
    minWidth: 0,
    marginTop: space.x6,
  },
});
