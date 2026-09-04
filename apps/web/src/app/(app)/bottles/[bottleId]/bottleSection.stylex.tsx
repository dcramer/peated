import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { SectionHeading } from "@peated/web/components";
import { space } from "../../../../styles/tokens.stylex";

export function BottleSection({
  ariaLabel,
  children,
  heading,
}: {
  ariaLabel?: string;
  children: ReactNode;
  heading?: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} {...stylex.props(styles.section)}>
      {heading ? <SectionHeading>{heading}</SectionHeading> : null}
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
