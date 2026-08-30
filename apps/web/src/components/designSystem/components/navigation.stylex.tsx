import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";
import { AppLink } from "./appLink";

const PERSONAL_FOLDS = "@media (max-width: 959px)";
const NAV_SCROLLS = "@media (max-width: 759px)";

export type NavigationItem = {
  href: string;
  label: string;
};

export type NavigationTabsProps = {
  ariaLabel: string;
  currentHref: string;
  items: readonly [NavigationItem, ...NavigationItem[]];
  personalItems?: readonly NavigationItem[];
};

export function isCurrentNavigationHref(currentHref: string, href: string) {
  return currentHref === href || currentHref.startsWith(`${href}/`);
}

/** Shows the current location in a small set of peer destinations. */
export function NavigationTabs({
  ariaLabel,
  currentHref,
  items,
  personalItems = [],
}: NavigationTabsProps) {
  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.navigation)}>
      <div {...stylex.props(styles.group)}>
        {items.map((item) => (
          <NavigationLink
            current={isCurrentNavigationHref(currentHref, item.href)}
            item={item}
            key={item.href}
          />
        ))}
      </div>
      {personalItems.length > 0 ? (
        <div {...stylex.props(styles.personalGroup)}>
          <span aria-hidden="true" {...stylex.props(styles.groupLabel)}>
            You
          </span>
          {personalItems.map((item) => (
            <NavigationLink
              current={isCurrentNavigationHref(currentHref, item.href)}
              item={item}
              key={item.href}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function NavigationLink({
  current,
  item,
}: {
  current: boolean;
  item: NavigationItem;
}) {
  return (
    <AppLink
      aria-current={current ? "page" : undefined}
      href={item.href}
      {...stylex.props(styles.link, current && styles.currentLink)}
    >
      {item.label}
    </AppLink>
  );
}

const styles = stylex.create({
  navigation: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x6,
    rowGap: space.x2,
    flexWrap: "wrap",
    [NAV_SCROLLS]: {
      width: "max-content",
      justifyContent: "flex-start",
      flexWrap: "nowrap",
    },
  },
  group: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    [NAV_SCROLLS]: {
      flexWrap: "nowrap",
    },
  },
  personalGroup: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    marginLeft: "auto",
    [PERSONAL_FOLDS]: {
      display: "none",
    },
  },
  groupLabel: {
    display: "inline-flex",
    flexShrink: 0,
    minHeight: "34px",
    alignItems: "center",
    paddingTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  link: {
    display: "inline-flex",
    flexShrink: 0,
    minHeight: "34px",
    alignItems: "center",
    paddingTop: "2px",
    color: {
      default: colors.inkMuted,
      ":hover": colors.ink,
    },
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  currentLink: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
  },
});
