import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, effects, fonts, space } from "../../styles/tokens.stylex";
import { AppLink } from "../appLink";

export type RailListSectionAction =
  | {
      href: string;
      label: string;
    }
  | {
      ariaControls: string;
      expanded: boolean;
      label: string;
      onClick: () => void;
    };

/** Presents a compact linked collection in a page rail. */
export function RailListSection({
  action,
  children,
  heading,
  intro,
}: {
  action?: RailListSectionAction;
  children: ReactNode;
  heading: string;
  intro?: string;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.heading)}>{heading}</h2>
      {intro ? <p {...stylex.props(styles.intro)}>{intro}</p> : null}
      {children}
      {action ? (
        "href" in action ? (
          <AppLink href={action.href} {...stylex.props(styles.more)}>
            {action.label} <span aria-hidden="true">→</span>
          </AppLink>
        ) : (
          <button
            aria-controls={action.ariaControls}
            aria-expanded={action.expanded}
            onClick={action.onClick}
            type="button"
            {...stylex.props(styles.more, styles.moreButton)}
          >
            {action.label}
          </button>
        )
      ) : null}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
  },
  heading: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  intro: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
  more: {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    marginTop: "6px",
    paddingTop: space.x3,
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: 0,
    borderRadius: 0,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
    textAlign: "left",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  moreButton: {
    appearance: "none",
    borderWidth: 0,
    cursor: "pointer",
  },
});
