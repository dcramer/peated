import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";

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
      <h1
        {...stylex.props(foundationStyles.pageTitleCompact, styles.heroTitle)}
      >
        {title}
      </h1>
      <div {...stylex.props(foundationStyles.prose, styles.heroCopy)}>
        {description}
      </div>
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
  },
  heroCopy: {
    maxWidth: "620px",
    marginTop: "18px",
    color: colors.inkMuted,
  },
  heroSearch: {
    maxWidth: "760px",
    marginTop: "22px",
  },
});
