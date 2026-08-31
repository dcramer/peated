import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { SectionHeading } from "@peated/web/components";
import { space } from "../../../../styles/tokens.stylex";

export function BottleSection({
  children,
  heading,
}: {
  children: ReactNode;
  heading: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <SectionHeading>{heading}</SectionHeading>
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
