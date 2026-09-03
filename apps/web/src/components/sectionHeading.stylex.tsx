import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors } from "../styles/tokens.stylex";

/** Section headings sit above 18px row titles at 20px; level changes semantics only. */
export function SectionHeading({
  children,
  id,
  level = 2,
}: {
  children: ReactNode;
  id?: string;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Heading
      id={id}
      {...stylex.props(foundationStyles.sectionHeading, styles.heading)}
    >
      {children}
    </Heading>
  );
}

const styles = stylex.create({
  heading: { color: colors.ink },
});
