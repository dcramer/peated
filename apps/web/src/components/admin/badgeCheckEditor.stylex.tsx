import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AdminSection } from "./adminContent.stylex";

export function BadgeCheckEditor({
  actions,
  children,
  error,
}: {
  actions: ReactNode;
  children: ReactNode;
  error?: ReactNode;
}) {
  return (
    <AdminSection title="Checks">
      {error}
      <div {...stylex.props(styles.actions)}>
        <span {...stylex.props(styles.actionsLabel)}>Add check</span>
        {actions}
      </div>
      <ol {...stylex.props(styles.list)}>{children}</ol>
    </AdminSection>
  );
}

export function BadgeCheckItem({
  children,
  index,
  removeAction,
  title,
}: {
  children: ReactNode;
  index: number;
  removeAction: ReactNode;
  title: ReactNode;
}) {
  return (
    <li {...stylex.props(styles.item)}>
      {index ? <div {...stylex.props(styles.connector)}>And</div> : null}
      <article {...stylex.props(styles.card)}>
        <header {...stylex.props(styles.cardHeader)}>
          <span {...stylex.props(styles.number)}>#{index + 1}</span>
          <div {...stylex.props(styles.title)}>
            <SectionHeading level={3}>{title}</SectionHeading>
          </div>
          {removeAction}
        </header>
        <div {...stylex.props(styles.cardBody)}>{children}</div>
      </article>
    </li>
  );
}

const styles = stylex.create({
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
    paddingBottom: space.x4,
  },
  actionsLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  list: {
    display: "grid",
    gap: space.x4,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  item: { display: "grid", gap: space.x4 },
  connector: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    "::before": {
      content: "''",
      height: "1px",
      flexGrow: 1,
      backgroundColor: colors.hairline,
    },
    "::after": {
      content: "''",
      height: "1px",
      flexGrow: 1,
      backgroundColor: colors.hairline,
    },
  },
  card: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    padding: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: colors.inset,
  },
  number: { color: colors.inkMuted, fontFamily: fonts.data, fontSize: "10px" },
  title: { flexGrow: 1 },
  cardBody: { padding: space.x4 },
});
