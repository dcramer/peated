import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, controlMetrics, fonts, space } from "../styles/tokens.stylex";

export function SkipLink({
  children,
  href,
}: {
  children: ReactNode;
  href: `#${string}`;
}) {
  return (
    <a href={href} {...stylex.props(styles.link)}>
      {children}
    </a>
  );
}

const styles = stylex.create({
  link: {
    position: "fixed",
    zIndex: 100,
    top: space.x2,
    left: space.x2,
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radius,
    backgroundColor: { default: colors.ink, ":hover": colors.accentDeep },
    color: colors.ground,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecoration: "none",
    transform: {
      default: "translateY(-160%)",
      ":focus": "translateY(0)",
    },
  },
});
