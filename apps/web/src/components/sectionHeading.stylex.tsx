import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { space } from "../styles/tokens.stylex";
import { CountChip } from "./chip.stylex";

export function SectionHeading({
  children,
  count,
  level = 2,
}: {
  children: ReactNode;
  count?: number;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <div {...stylex.props(styles.root)}>
      <Heading {...stylex.props(foundationStyles.sectionHeading)}>
        {children}
      </Heading>
      {count === undefined ? null : <CountChip count={count} />}
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "center",
    columnGap: "10px",
    rowGap: space.x2,
    flexWrap: "wrap",
  },
});
