import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";

export function SectionHeading({
  children,
  level = 2,
}: {
  children: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Heading {...stylex.props(foundationStyles.sectionHeading)}>
      {children}
    </Heading>
  );
}
