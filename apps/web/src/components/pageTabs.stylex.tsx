import * as stylex from "@stylexjs/stylex";
import Link from "next/link";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";

export type PageTabItem = {
  count?: number;
  href: string;
  label: string;
};

export type PageTabsProps = {
  ariaLabel: string;
  currentHref: string;
  items: readonly [PageTabItem, ...PageTabItem[]];
};

/** Shows peer destinations within one page or section. */
export function PageTabs({ ariaLabel, currentHref, items }: PageTabsProps) {
  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.tabs)}>
      {items.map((item) => {
        const current = item.href === currentHref;

        return (
          <Link
            aria-current={current ? "page" : undefined}
            href={item.href}
            key={item.href}
            prefetch={false}
            {...stylex.props(styles.tab, current && styles.currentTab)}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span {...stylex.props(styles.count)}>
                {item.count.toLocaleString("en-US")}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

const styles = stylex.create({
  tabs: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    overflowX: "auto",
    columnGap: space.x6,
    paddingRight: space.x1,
    paddingLeft: space.x1,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    scrollbarWidth: "none",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  tab: {
    display: "inline-flex",
    minHeight: "40px",
    flexShrink: 0,
    alignItems: "center",
    gap: space.x2,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.ink,
    },
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  currentTab: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    boxShadow: {
      default: `inset 0 -2px 0 ${colors.ink}`,
      ":focus-visible": `inset 0 -2px 0 ${colors.ink}`,
    },
  },
  count: {
    minWidth: "20px",
    borderRadius: controlMetrics.radiusSmall,
    paddingTop: "2px",
    paddingRight: "6px",
    paddingBottom: "2px",
    paddingLeft: "6px",
    backgroundColor: colors.surface,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "center",
  },
});
