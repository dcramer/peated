import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { TextLink } from "../textLink.stylex";

/** Attribution for the adapted Scottish whisky region illustrations. */
export function RegionMapCredit() {
  return (
    <p {...stylex.props(foundationStyles.metadata, styles.credit)}>
      Maps adapted from{" "}
      <TextLink
        href="https://commons.wikimedia.org/wiki/File:Scotch_regions.svg"
        size="inherit"
      >
        Briangotts and Interiot
      </TextLink>
      {" · "}
      <TextLink
        href="https://creativecommons.org/licenses/by-sa/3.0/"
        size="inherit"
      >
        CC BY-SA 3.0
      </TextLink>
    </p>
  );
}

const styles = stylex.create({
  credit: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
});
