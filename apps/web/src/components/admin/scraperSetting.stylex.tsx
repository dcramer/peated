import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";

export default function ScraperSetting({
  action,
  children,
  description,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.stack)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.copy)}>
          <SectionHeading level={3}>{title}</SectionHeading>
          <p {...stylex.props(foundationStyles.body, styles.description)}>
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
  },
  header: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.x4,
  },
  copy: { minWidth: 0 },
  description: {
    marginTop: space.x2,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.inkMuted,
  },
});
