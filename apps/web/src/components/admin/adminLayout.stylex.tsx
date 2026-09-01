"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowLeft, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SkipLink } from "@peated/web/components/skipLink.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 759px)";
const WIDE = "@media (min-width: 760px)";

export type AdminNavigationItem = {
  href: string;
  label: string;
  match?: "exact" | "prefix";
};

export type AdminNavigationGroup = {
  items: readonly AdminNavigationItem[];
  label: string;
};

export type AdminLayoutProps = {
  children: ReactNode;
  currentHref?: string;
  groups: readonly AdminNavigationGroup[];
};

function isCurrentHref(currentHref: string, item: AdminNavigationItem) {
  return item.match === "exact"
    ? currentHref === item.href
    : currentHref === item.href || currentHref.startsWith(`${item.href}/`);
}

function AdminNavigation({
  currentHref,
  groups,
}: {
  currentHref: string;
  groups: readonly AdminNavigationGroup[];
}) {
  return (
    <nav aria-label="Admin navigation" {...stylex.props(styles.navigation)}>
      {groups.map((group) => (
        <section key={group.label} {...stylex.props(styles.navigationGroup)}>
          <h2 {...stylex.props(styles.groupLabel)}>{group.label}</h2>
          <ul {...stylex.props(styles.navigationList)}>
            {group.items.map((item) => {
              const current = isCurrentHref(currentHref, item);

              return (
                <li key={item.href}>
                  <Link
                    aria-current={current ? "page" : undefined}
                    href={item.href}
                    {...stylex.props(
                      styles.navigationLink,
                      current && styles.currentNavigationLink,
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/** Owns the common responsive layout for every administrator route. */
export function AdminLayout({
  children,
  currentHref,
  groups,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;

  return (
    <div {...stylex.props(foundationStyles.document, styles.layout)}>
      <SkipLink href="#admin-content">Skip to admin content</SkipLink>

      <header {...stylex.props(styles.mobileHeader)}>
        <Link href="/admin" {...stylex.props(styles.mobileBrand)}>
          <span {...stylex.props(styles.brandName)}>Peated</span>
          <span {...stylex.props(styles.brandContext)}>Admin</span>
        </Link>
        <details {...stylex.props(styles.mobileMenu)}>
          <summary {...stylex.props(styles.mobileMenuTrigger)}>
            <Menu aria-hidden="true" size={18} />
            Menu
          </summary>
          <div {...stylex.props(styles.mobileMenuPanel)}>
            <AdminNavigation currentHref={activeHref} groups={groups} />
            <Link href="/" {...stylex.props(styles.returnLink)}>
              <ArrowLeft aria-hidden="true" size={15} />
              Return to Peated
            </Link>
          </div>
        </details>
      </header>

      <aside {...stylex.props(styles.sidebar)}>
        <Link href="/admin" {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.brandName)}>Peated</span>
          <span {...stylex.props(styles.brandContext)}>Admin</span>
        </Link>
        <Link href="/" {...stylex.props(styles.returnLink)}>
          <ArrowLeft aria-hidden="true" size={15} />
          Return to Peated
        </Link>
        <AdminNavigation currentHref={activeHref} groups={groups} />
      </aside>

      <main id="admin-content" {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.contentInner)}>{children}</div>
      </main>
    </div>
  );
}

const styles = stylex.create({
  layout: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  mobileHeader: {
    position: "sticky",
    zIndex: zIndices.navigation,
    top: 0,
    display: "flex",
    minHeight: "56px",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    backgroundColor: colors.ground,
    [WIDE]: { display: "none" },
  },
  mobileBrand: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  mobileMenu: { position: "relative" },
  mobileMenuTrigger: {
    display: "inline-flex",
    minHeight: "34px",
    alignItems: "center",
    gap: space.x2,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 700,
    listStyle: "none",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  mobileMenuPanel: {
    position: "absolute",
    top: `calc(100% + ${space.x2})`,
    right: 0,
    boxSizing: "border-box",
    width: "min(320px, calc(100vw - 24px))",
    maxHeight: "calc(100dvh - 76px)",
    padding: space.x3,
    overflowY: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    boxShadow: effects.overlayShadow,
  },
  sidebar: {
    position: "fixed",
    zIndex: zIndices.navigation,
    top: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    boxSizing: "border-box",
    width: "236px",
    flexDirection: "column",
    gap: space.x6,
    paddingTop: space.x6,
    paddingRight: space.x4,
    paddingBottom: space.x6,
    paddingLeft: space.x4,
    overflowY: "auto",
    backgroundColor: colors.ground,
    [COMPACT]: { display: "none" },
  },
  brand: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  brandContext: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    lineHeight: 1,
    textTransform: "uppercase",
  },
  returnLink: {
    display: "inline-flex",
    minHeight: "34px",
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: colors.ground,
      ":hover": colors.inset,
      ":active": colors.inset,
    },
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
  },
  navigationGroup: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  groupLabel: {
    margin: 0,
    paddingRight: space.x2,
    paddingLeft: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.12em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  navigationList: {
    display: "flex",
    margin: 0,
    padding: 0,
    flexDirection: "column",
    gap: "2px",
    listStyle: "none",
  },
  navigationLink: {
    display: "flex",
    minHeight: "34px",
    alignItems: "center",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
      ":active": colors.inset,
    },
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  currentNavigationLink: {
    backgroundColor: colors.accentTint,
    color: colors.ink,
    fontWeight: 700,
  },
  content: {
    boxSizing: "border-box",
    minHeight: "100dvh",
    paddingLeft: "236px",
    [COMPACT]: { minHeight: "calc(100dvh - 56px)", paddingLeft: 0 },
  },
  contentInner: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1240px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingRight: space.x8,
    paddingBottom: space.x12,
    paddingLeft: space.x8,
    [COMPACT]: {
      paddingTop: space.x4,
      paddingRight: space.x3,
      paddingBottom: space.x8,
      paddingLeft: space.x3,
    },
  },
});
