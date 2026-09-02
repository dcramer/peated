"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  zIndices,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { IconButton, type ButtonVariant } from "./button.stylex";
import { menuSurfaceStyles } from "./menuSurface.stylex";

const MENU_ANCHORS = {
  page: {
    gap: `calc(${controlMetrics.controlHeightLarge} * -1)`,
    padding: 8,
    to: "bottom end",
  },
  row: {
    gap: `calc(${controlMetrics.controlHeightSmall} * -1)`,
    padding: 8,
    to: "bottom end",
  },
} as const;

type RowMenuItemBase = {
  disabled?: boolean;
  label: string;
};

export type RowMenuItem = RowMenuItemBase &
  ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void });

export type RowMenuGroup = {
  items: readonly RowMenuItem[];
  label?: string;
};

export type RowMenuProps = {
  groups: readonly (RowMenuGroup | readonly RowMenuItem[])[];
  label: string;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  variant?: "page" | "row";
};

/** Shows an item's actions in a menu. */
export function RowMenu({
  groups,
  label,
  triggerLabel = `Actions for ${label}`,
  triggerVariant = "tonal",
  variant = "row",
}: RowMenuProps) {
  const normalizedGroups = groups.map(normalizeGroup);

  return (
    <Menu>
      {({ open }) => (
        <div {...stylex.props(styles.root, open && styles.openRoot)}>
          <span {...stylex.props(styles.triggerLayer)}>
            <MenuButton
              as={IconButton}
              icon={<MenuDots />}
              label={triggerLabel}
              mergeWithSurface={open}
              size={variant === "page" ? "lg" : "sm"}
              variant={triggerVariant}
            />
          </span>
          <MenuItems
            anchor={MENU_ANCHORS[variant]}
            aria-label={`${label} actions`}
            {...stylex.props(styles.menu, menuSurfaceStyles.surface)}
          >
            <div
              title={label}
              {...stylex.props(
                styles.header,
                variant === "page" && styles.pageHeader,
              )}
            >
              {label}
              <span aria-hidden="true" {...stylex.props(styles.menuTrigger)}>
                <IconButton
                  aria-hidden="true"
                  icon={<MenuDots />}
                  label=""
                  mergeWithSurface
                  size={variant === "page" ? "lg" : "sm"}
                  tabIndex={-1}
                  variant={triggerVariant}
                />
              </span>
            </div>
            <div {...stylex.props(styles.separator)} />
            {normalizedGroups.map((group, groupIndex) => (
              <div key={groupIndex} {...stylex.props(styles.group)}>
                {groupIndex > 0 ? (
                  <div {...stylex.props(styles.separator)} />
                ) : null}
                {group.label ? (
                  <div {...stylex.props(styles.groupLabel)}>{group.label}</div>
                ) : null}
                {group.items.map((item, itemIndex) => (
                  <MenuItem
                    as={Fragment}
                    disabled={item.disabled}
                    key={`${item.label}-${itemIndex}`}
                  >
                    {({ disabled, focus }) =>
                      item.href ? (
                        <AppLink
                          href={item.href}
                          {...stylex.props(
                            styles.item,
                            focus && styles.focusedItem,
                            disabled && styles.disabledItem,
                          )}
                        >
                          {item.label}
                        </AppLink>
                      ) : (
                        <button
                          onClick={item.onSelect}
                          type="button"
                          {...stylex.props(
                            styles.item,
                            focus && styles.focusedItem,
                            disabled && styles.disabledItem,
                          )}
                        >
                          {item.label}
                        </button>
                      )
                    }
                  </MenuItem>
                ))}
              </div>
            ))}
          </MenuItems>
        </div>
      )}
    </Menu>
  );
}

function MenuDots() {
  return (
    <span aria-hidden="true" {...stylex.props(styles.dots)}>
      <span {...stylex.props(styles.dot)} />
      <span {...stylex.props(styles.dot)} />
      <span {...stylex.props(styles.dot)} />
    </span>
  );
}

function normalizeGroup(
  group: RowMenuGroup | readonly RowMenuItem[],
): RowMenuGroup {
  return "items" in group ? group : { items: group };
}

const styles = stylex.create({
  root: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    isolation: "isolate",
  },
  openRoot: {
    zIndex: zIndices.menuControl,
  },
  triggerLayer: {
    position: "relative",
    zIndex: zIndices.localControl,
    display: "inline-flex",
  },
  dots: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    alignItems: "center",
  },
  dot: {
    width: "3px",
    height: "3px",
    borderRadius: "50%",
    backgroundColor: "currentColor",
  },
  menu: {
    zIndex: zIndices.menu,
    width: "216px",
    outline: "none",
  },
  menuTrigger: {
    position: "absolute",
    top: 0,
    right: 0,
    display: "inline-flex",
    pointerEvents: "none",
  },
  header: {
    boxSizing: "border-box",
    height: "34px",
    overflow: "hidden",
    paddingTop: "10px",
    paddingRight: "48px",
    paddingLeft: "14px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  pageHeader: {
    height: controlMetrics.controlHeightLarge,
    paddingTop: "17px",
  },
  group: {
    paddingTop: "4px",
    paddingBottom: "4px",
  },
  groupLabel: {
    paddingTop: "8px",
    paddingRight: "14px",
    paddingBottom: "4px",
    paddingLeft: "14px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  separator: {
    height: "1px",
    marginRight: "14px",
    marginLeft: "14px",
    backgroundColor: colors.hairline,
  },
  item: {
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    paddingTop: "9px",
    paddingRight: "14px",
    paddingBottom: "9px",
    paddingLeft: "14px",
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.25,
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  focusedItem: {
    backgroundColor: colors.surface,
    boxShadow: effects.focusRing,
  },
  disabledItem: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
});
