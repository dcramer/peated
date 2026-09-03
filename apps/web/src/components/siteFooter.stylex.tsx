import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 959px)";

export type FooterLink = {
  href: string;
  label: string;
};

export type SiteFooterProps = {
  brand?: string;
  coverage?: ReactNode;
  groups: readonly {
    label: string;
    links: readonly FooterLink[];
  }[];
  legalLinks: readonly FooterLink[];
  provenance: ReactNode;
  responsibility?: ReactNode;
  statement: ReactNode;
};

/**
 * Groups footer destinations into columns. On small screens, native disclosures
 * keep every destination available while secondary copy and totals stay hidden.
 */
export function SiteFooter({
  brand = "Peated",
  coverage,
  groups,
  legalLinks,
  provenance,
  responsibility = "Drink responsibly.",
  statement,
}: SiteFooterProps) {
  return (
    <footer {...stylex.props(styles.footer)}>
      <div {...stylex.props(styles.footerMain)}>
        <div {...stylex.props(styles.footerIdentity)}>
          <div {...stylex.props(styles.footerBrand)}>{brand}</div>
          <p {...stylex.props(foundationStyles.metadata, styles.statement)}>
            {statement}
          </p>
        </div>
        <div {...stylex.props(styles.footerGroups)}>
          {groups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <p
                {...stylex.props(
                  foundationStyles.fieldLabel,
                  styles.groupLabel,
                )}
              >
                {group.label}
              </p>
              <FooterLinks links={group.links} />
            </nav>
          ))}
        </div>
      </div>
      <nav aria-label="Footer" {...stylex.props(styles.mobileNavigation)}>
        {groups.map((group) => (
          <details key={group.label} {...stylex.props(styles.disclosure)}>
            <summary
              {...stylex.props(foundationStyles.interactive, styles.summary)}
            >
              {group.label}
            </summary>
            <FooterLinks links={group.links} />
          </details>
        ))}
      </nav>
      {coverage ? (
        <p {...stylex.props(foundationStyles.metadata, styles.coverage)}>
          {coverage}
        </p>
      ) : null}
      <div
        {...stylex.props(
          styles.footerMeta,
          !!coverage && styles.metaWithCoverage,
        )}
      >
        <p {...stylex.props(foundationStyles.metadata, styles.provenance)}>
          {provenance}
        </p>
        <p {...stylex.props(foundationStyles.metadata, styles.responsibility)}>
          {responsibility}
        </p>
        {legalLinks.map((link) => (
          <FooterAnchor key={link.href} link={link} />
        ))}
      </div>
    </footer>
  );
}

function FooterLinks({ links }: { links: readonly FooterLink[] }) {
  return (
    <ul {...stylex.props(styles.footerLinks)}>
      {links.map((link) => (
        <li key={link.href}>
          <FooterAnchor link={link} />
        </li>
      ))}
    </ul>
  );
}

function FooterAnchor({ link }: { link: FooterLink }) {
  return (
    <AppLink
      href={link.href}
      {...stylex.props(foundationStyles.interactiveSmall, styles.footerLink)}
    >
      {link.label}
    </AppLink>
  );
}

const styles = stylex.create({
  footer: {
    width: "100%",
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  footerMain: {
    display: "grid",
    gridTemplateColumns: "minmax(200px, 260px) minmax(0, 1fr)",
    gap: space.x12,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x6,
    },
    [COMPACT]: {
      display: "none",
    },
  },
  footerIdentity: {
    maxWidth: "260px",
    [NARROW]: { maxWidth: "460px" },
  },
  footerBrand: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  statement: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  footerGroups: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr) minmax(0, 1fr)",
    gap: space.x8,
  },
  groupLabel: {
    margin: 0,
    marginBottom: space.x2,
    color: colors.ink,
  },
  footerLinks: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    [COMPACT]: {
      paddingBottom: space.x3,
    },
  },
  footerLink: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "32px",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accent,
      ":active": colors.accent,
      ":focus-visible": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textUnderlineOffset: "3px",
    outline: "none",
    [COMPACT]: {
      minHeight: "44px",
      minWidth: "44px",
      fontSize: "16px",
    },
  },
  mobileNavigation: {
    display: "none",
    [COMPACT]: { display: "block" },
  },
  disclosure: {
    borderBottomWidth: { default: "1px", ":last-child": 0 },
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  summary: {
    boxSizing: "border-box",
    minHeight: "44px",
    paddingTop: space.x3,
    paddingBottom: space.x3,
    cursor: "pointer",
    color: {
      default: colors.ink,
      ":hover": colors.accent,
      ":active": colors.accent,
      ":focus-visible": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textUnderlineOffset: "3px",
    outline: "none",
    fontSize: "16px",
  },
  footerMeta: {
    display: "flex",
    alignItems: "center",
    columnGap: space.x6,
    rowGap: space.x2,
    marginTop: space.x6,
    paddingTop: space.x4,
    paddingBottom: space.x4,
    flexWrap: "wrap",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    [COMPACT]: { marginTop: space.x4 },
  },
  metaWithCoverage: {
    marginTop: space.x3,
    [COMPACT]: { marginTop: space.x4 },
  },
  coverage: {
    margin: 0,
    marginTop: space.x6,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    [COMPACT]: { display: "none" },
  },
  provenance: {
    flex: 1,
    margin: 0,
    color: colors.inkMuted,
    [COMPACT]: { display: "none" },
  },
  responsibility: {
    margin: 0,
    color: colors.inkMuted,
    [COMPACT]: { flex: 1 },
  },
});
