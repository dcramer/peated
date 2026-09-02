import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../../styles/tokens.stylex";
import { TextLink } from "../textLink.stylex";
import { textLinkStyles } from "../textLinkStyles.stylex";

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
      {action ? (
        "href" in action ? (
          <TextLink href={action.href}>{action.label}</TextLink>
        ) : (
          <button
            aria-controls={action.ariaControls}
            aria-expanded={action.expanded}
            onClick={action.onClick}
            type="button"
            {...stylex.props(
              textLinkStyles.link,
              textLinkStyles.small,
              styles.actionButton,
            )}
          >
            {action.label}
          </button>
        )
      ) : null}
      {children}
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
  actionButton: {
    appearance: "none",
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
});
