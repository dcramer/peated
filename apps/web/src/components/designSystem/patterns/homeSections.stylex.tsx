import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

export type PublicHomeIntroProps = {
  description: ReactNode;
  search: ReactNode;
  title: ReactNode;
};

/** Introduces the public database and gives browsing one primary entry point. */
export function PublicHomeIntro({
  description,
  search,
  title,
}: PublicHomeIntroProps) {
  return (
    <section {...stylex.props(styles.hero)}>
      <h1 {...stylex.props(styles.heroTitle)}>{title}</h1>
      <div {...stylex.props(styles.heroCopy)}>{description}</div>
      <div {...stylex.props(styles.heroSearch)}>{search}</div>
    </section>
  );
}

const styles = stylex.create({
  hero: {
    paddingTop: space.x6,
    paddingBottom: space.x12,
    [NARROW]: {
      paddingTop: space.x4,
      paddingBottom: space.x8,
    },
  },
  heroTitle: {
    maxWidth: "760px",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "clamp(40px, 5vw, 44px)",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
  },
  heroCopy: {
    maxWidth: "620px",
    marginTop: "18px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "17px",
    lineHeight: 1.55,
  },
  heroSearch: {
    maxWidth: "760px",
    marginTop: "22px",
  },
});
