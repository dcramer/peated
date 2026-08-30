"use client";

import {
  Menu as HeadlessMenu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { Menu as MenuIcon, Search, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { IconButton } from "./button.stylex";
import {
  isCurrentNavigationHref,
  NavigationTabs,
  type NavigationItem,
} from "./navigation.stylex";

const PAGE_INSET_TIGHTENS = "@media (max-width: 1099px)";
const MOBILE = "@media (max-width: 559px)";

export type HeaderNavigationItem = NavigationItem & {
  count?: number;
};

export type HeaderAccountActionItem = {
  count?: number;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
};

export type HeaderAccountItem = HeaderNavigationItem | HeaderAccountActionItem;

export type ApplicationHeaderProps = {
  account?: ReactNode;
  accountItems?: readonly HeaderAccountItem[];
  accountLabel?: string;
  action: ReactNode;
  background?: "page" | "surface";
  brand?: string;
  brandHref?: string;
  currentHref: string;
  databaseItems: readonly [HeaderNavigationItem, ...HeaderNavigationItem[]];
  defaultSearchOpen?: boolean;
  navigationPlacement?: "inline" | "separate";
  personalItems: readonly HeaderNavigationItem[];
  search?: ReactNode;
};

/** Keeps search and database navigation reachable across all header widths. */
export function ApplicationHeader({
  account,
  accountItems,
  accountLabel = "Open account menu",
  action,
  background = "surface",
  brand = "Peated",
  brandHref = "/",
  currentHref,
  databaseItems,
  defaultSearchOpen = false,
  navigationPlacement = "separate",
  personalItems,
  search,
}: ApplicationHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(defaultSearchOpen);
  const searchRef = useRef<HTMLDivElement>(null);
  const hasSearch = search !== undefined && search !== null;

  useEffect(() => {
    if (searchOpen && hasSearch) {
      searchRef.current
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus();
    }
  }, [hasSearch, searchOpen]);

  function openSearch() {
    setDrawerOpen(false);
    setSearchOpen(true);
  }

  function toggleDrawer() {
    setSearchOpen(false);
    setDrawerOpen((open) => !open);
  }

  return (
    <header
      {...stylex.props(
        styles.header,
        background === "page" && styles.headerOnPage,
      )}
    >
      <div {...stylex.props(styles.headerInner)}>
        <div
          {...stylex.props(
            styles.primaryRow,
            searchOpen && styles.primaryRowSearchOpen,
            !hasSearch && styles.primaryRowWithoutSearch,
            navigationPlacement === "inline" && styles.primaryRowWithInlineNav,
          )}
        >
          <div
            {...stylex.props(
              styles.mobileMenu,
              searchOpen && styles.hiddenDuringSearch,
            )}
          >
            <IconButton
              aria-expanded={drawerOpen}
              icon={
                drawerOpen ? (
                  <X aria-hidden="true" size={18} />
                ) : (
                  <MenuIcon aria-hidden="true" size={18} />
                )
              }
              label={drawerOpen ? "Close navigation" : "Open navigation"}
              onClick={toggleDrawer}
              size="sm"
              variant="text"
            />
          </div>
          <AppLink
            href={brandHref}
            {...stylex.props(
              styles.brand,
              searchOpen && styles.hiddenDuringSearch,
            )}
          >
            {brand}
          </AppLink>
          {navigationPlacement === "inline" ? (
            <div {...stylex.props(styles.inlineNavigation)}>
              <NavigationTabs
                ariaLabel="Peated"
                currentHref={currentHref}
                items={databaseItems}
                personalItems={personalItems}
              />
            </div>
          ) : null}
          {hasSearch ? (
            <div
              ref={searchRef}
              {...stylex.props(
                styles.search,
                searchOpen && styles.mobileSearchVisible,
              )}
            >
              {search}
            </div>
          ) : null}
          <div {...stylex.props(styles.action)}>{action}</div>
          {hasSearch ? (
            <div
              {...stylex.props(
                styles.mobileSearchButton,
                searchOpen && styles.hiddenDuringSearch,
              )}
            >
              <IconButton
                icon={<Search aria-hidden="true" size={18} />}
                label="Open search"
                onClick={openSearch}
                size="sm"
                variant="text"
              />
            </div>
          ) : null}
          {account ? (
            <HeadlessMenu
              as="div"
              {...stylex.props(
                styles.account,
                searchOpen && styles.hiddenDuringSearch,
              )}
            >
              <MenuButton
                aria-label={accountLabel}
                {...stylex.props(styles.accountButton)}
              >
                {account}
              </MenuButton>
              <MenuItems portal={false} {...stylex.props(styles.accountMenu)}>
                {(accountItems ?? personalItems).map((item) => (
                  <MenuItem
                    as={Fragment}
                    disabled={"onSelect" in item && item.disabled}
                    key={"onSelect" in item ? item.label : item.href}
                  >
                    {({ close, focus }) => (
                      <AccountMenuItem
                        close={close}
                        currentHref={currentHref}
                        focused={focus}
                        item={item}
                      />
                    )}
                  </MenuItem>
                ))}
              </MenuItems>
            </HeadlessMenu>
          ) : null}
          {hasSearch ? (
            <button
              onClick={() => setSearchOpen(false)}
              type="button"
              {...stylex.props(
                styles.mobileSearchCancel,
                searchOpen && styles.mobileSearchCancelVisible,
              )}
            >
              Cancel
            </button>
          ) : null}
        </div>
        {navigationPlacement === "separate" ? (
          <div {...stylex.props(styles.navigationRow)}>
            <NavigationTabs
              ariaLabel="Peated"
              currentHref={currentHref}
              items={databaseItems}
              personalItems={personalItems}
            />
          </div>
        ) : null}
        {drawerOpen ? (
          <nav aria-label="Mobile navigation" {...stylex.props(styles.drawer)}>
            <HeaderDrawerGroup
              currentHref={currentHref}
              items={databaseItems}
              label="Database"
            />
            {personalItems.length ? (
              <HeaderDrawerGroup
                currentHref={currentHref}
                items={personalItems}
                label="You"
              />
            ) : null}
            <div {...stylex.props(styles.drawerAction)}>{action}</div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function AccountMenuItem({
  close,
  currentHref,
  focused,
  item,
}: {
  close: () => void;
  currentHref: string;
  focused: boolean;
  item: HeaderAccountItem;
}) {
  const content = (
    <>
      <span>{item.label}</span>
      {item.count !== undefined ? (
        <span {...stylex.props(styles.accountMenuCount)}>
          {item.count.toLocaleString("en-US")}
        </span>
      ) : null}
    </>
  );
  const current =
    "href" in item && isCurrentNavigationHref(currentHref, item.href);

  if ("onSelect" in item) {
    return (
      <button
        disabled={item.disabled}
        onClick={() => {
          close();
          item.onSelect();
        }}
        type="button"
        {...stylex.props(
          styles.accountMenuItem,
          styles.accountMenuAction,
          focused && styles.focusedAccountMenuItem,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <AppLink
      aria-current={current ? "page" : undefined}
      href={item.href}
      {...stylex.props(
        styles.accountMenuItem,
        current && styles.currentMenuLink,
        focused && styles.focusedAccountMenuItem,
      )}
    >
      {content}
    </AppLink>
  );
}

function HeaderDrawerGroup({
  currentHref,
  items,
  label,
}: {
  currentHref: string;
  items: readonly HeaderNavigationItem[];
  label: string;
}) {
  return (
    <section>
      <h2 {...stylex.props(styles.drawerHeading)}>{label}</h2>
      <ul {...stylex.props(styles.drawerList)}>
        {items.map((item) => (
          <li key={item.href} {...stylex.props(styles.drawerListItem)}>
            <AppLink
              aria-current={
                isCurrentNavigationHref(currentHref, item.href)
                  ? "page"
                  : undefined
              }
              href={item.href}
              {...stylex.props(
                styles.drawerLink,
                isCurrentNavigationHref(currentHref, item.href) &&
                  styles.currentMenuLink,
              )}
            >
              {item.label}
            </AppLink>
            {item.count !== undefined ? (
              <span {...stylex.props(styles.drawerCount)}>
                {item.count.toLocaleString("en-US")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const styles = stylex.create({
  header: {
    width: "100%",
    backgroundColor: colors.surface,
  },
  headerOnPage: {
    backgroundColor: colors.ground,
  },
  headerInner: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1320px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingRight: space.x8,
    paddingLeft: space.x8,
    [PAGE_INSET_TIGHTENS]: {
      paddingRight: space.x6,
      paddingLeft: space.x6,
    },
    [MOBILE]: {
      paddingRight: space.x3,
      paddingLeft: space.x3,
    },
  },
  primaryRow: {
    display: "grid",
    minHeight: "54px",
    gridTemplateColumns: "auto minmax(220px, 620px) 1fr auto",
    alignItems: "center",
    gap: space.x3,
    paddingTop: space.x2,
    paddingBottom: space.x2,
    [MOBILE]: {
      gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
      gap: space.x2,
    },
  },
  primaryRowSearchOpen: {
    [MOBILE]: {
      gridTemplateColumns: "minmax(0, 1fr) auto",
    },
  },
  primaryRowWithoutSearch: {
    gridTemplateColumns: "auto 1fr auto",
    [MOBILE]: {
      gridTemplateColumns: "auto minmax(0, 1fr) auto",
    },
  },
  primaryRowWithInlineNav: {
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
  },
  mobileMenu: {
    display: "none",
    [MOBILE]: {
      display: "inline-flex",
    },
  },
  brand: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  search: {
    width: "100%",
    minWidth: 0,
    maxWidth: "620px",
    [MOBILE]: {
      display: "none",
    },
  },
  mobileSearchVisible: {
    [MOBILE]: {
      display: "block",
    },
  },
  action: {
    display: "inline-flex",
    alignItems: "center",
    gap: space.x2,
    justifySelf: "end",
    [MOBILE]: {
      display: "none",
    },
  },
  account: {
    position: "relative",
    display: "inline-flex",
  },
  accountButton: {
    display: "inline-flex",
    width: "34px",
    height: "34px",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 0,
    borderRadius: "50%",
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  accountMenu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    zIndex: 40,
    width: "220px",
    paddingTop: space.x1,
    paddingBottom: space.x1,
    borderRadius: "3px",
    outline: "none",
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  accountMenuItem: {
    display: "flex",
    minHeight: "36px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    outline: "none",
  },
  accountMenuAction: {
    width: "100%",
    paddingTop: 0,
    paddingBottom: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    textAlign: "left",
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":disabled": 0.45,
    },
  },
  focusedAccountMenuItem: {
    backgroundColor: colors.surface,
  },
  currentMenuLink: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
  },
  accountMenuCount: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1,
  },
  mobileSearchButton: {
    display: "none",
    [MOBILE]: {
      display: "inline-flex",
    },
  },
  mobileSearchCancel: {
    display: "none",
    minHeight: "34px",
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  mobileSearchCancelVisible: {
    [MOBILE]: {
      display: "inline-flex",
      alignItems: "center",
    },
  },
  hiddenDuringSearch: {
    [MOBILE]: {
      display: "none",
    },
  },
  navigationRow: {
    overflowX: "auto",
    scrollbarWidth: "none",
    paddingTop: space.x1,
    paddingBottom: space.x2,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    [MOBILE]: {
      display: "none",
    },
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  inlineNavigation: {
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
    [MOBILE]: {
      display: "none",
    },
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  drawer: {
    display: "none",
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    [MOBILE]: {
      display: "flex",
      flexDirection: "column",
      rowGap: space.x4,
    },
  },
  drawerHeading: {
    margin: 0,
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  drawerList: {
    margin: 0,
    paddingTop: space.x1,
    paddingRight: space.x4,
    paddingBottom: space.x1,
    paddingLeft: space.x4,
    borderRadius: "3px",
    backgroundColor: colors.ground,
    listStyle: "none",
  },
  drawerListItem: {
    display: "flex",
    minHeight: "42px",
    alignItems: "center",
    gap: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  drawerLink: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  drawerCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  drawerAction: {
    display: "flex",
  },
});
