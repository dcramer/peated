import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";

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

/** Shows peer destinations within one record or member page. */
export function PageTabs({ ariaLabel, currentHref, items }: PageTabsProps) {
  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.tabs)}>
      {items.map((item) => {
        const current = item.href === currentHref;

        return (
          <a
            aria-current={current ? "page" : undefined}
            href={item.href}
            key={item.href}
            {...stylex.props(styles.tab, current && styles.currentTab)}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span {...stylex.props(styles.count)}>
                {item.count.toLocaleString("en-US")}
              </span>
            ) : null}
          </a>
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
    borderBottomColor: colors.hairline,
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
    fontSize: "14px",
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
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: `inset 0 -2px 0 ${colors.accent}`,
  },
  count: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
  },
});
