import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  AppLink,
  BottleVisual,
  RailList,
  RailListItem,
} from "@peated/web/components";
import { colors, effects, fonts, space } from "../../styles/tokens.stylex";

export type BottleRailItem = {
  end?: ReactNode;
  href: string;
  imageUrl?: string | null;
  metadata?: string;
  name: string;
};

/** Presents a compact bottle list in a page rail or its mobile stack. */
export function BottleRailSection({
  children,
  heading,
  intro,
  items = [],
  moreHref,
  moreLabel,
}: {
  children?: ReactNode;
  heading: string;
  intro?: string;
  items?: readonly BottleRailItem[];
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.heading)}>{heading}</h2>
      {intro ? <p {...stylex.props(styles.intro)}>{intro}</p> : null}
      {items.length ? (
        <RailList ariaLabel={heading}>
          {items.map((item) => (
            <RailListItem
              end={item.end}
              href={item.href}
              key={item.href}
              leading={<BottleVisual imageUrl={item.imageUrl} size="sm" />}
              metadata={item.metadata}
              title={item.name}
            />
          ))}
        </RailList>
      ) : null}
      {children}
      {moreHref && moreLabel ? (
        <AppLink href={moreHref} {...stylex.props(styles.moreLink)}>
          {moreLabel} →
        </AppLink>
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
  moreLink: {
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
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
