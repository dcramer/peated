import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { space } from "../../../styles/tokens.stylex";

export function BotCode({ children }: { children: ReactNode }) {
  return (
    <code {...stylex.props(foundationStyles.code, styles.code)}>
      {children}
    </code>
  );
}

export function BotSectionGrid({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.sectionGrid)}>{children}</div>;
}

const styles = stylex.create({
  code: {
    overflowWrap: "anywhere",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 759px)": "minmax(0, 1fr)",
    },
    columnGap: space.x12,
    rowGap: space.x8,
  },
});
