import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { SectionHeading } from "@peated/web/components/designSystem/components";
import { space } from "../../../../styles/tokens.stylex";

export function BottleSection({
  children,
  count,
  heading,
}: {
  children: ReactNode;
  count?: number;
  heading: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <SectionHeading count={count}>{heading}</SectionHeading>
      {children}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x3,
  },
});
