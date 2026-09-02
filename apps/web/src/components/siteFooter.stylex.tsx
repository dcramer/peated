import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "./sectionHeading.stylex";

import { colors, effects, fonts, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";

const COMPACT = "@media (max-width: 639px)";

export type FooterLink = {
  href: string;
  label: string;
};

export type SiteFooterProps = {
  brand?: string;
  coverage?: ReactNode;
  links: readonly [FooterLink, ...FooterLink[]];
  provenance: ReactNode;
  referenceLinks: readonly FooterLink[];
  responsibility?: ReactNode;
  statement: ReactNode;
};

/** Closes reference pages with durable destinations and data provenance. */
export function SiteFooter({
  brand = "Peated",
  coverage,
  links,
  provenance,
  referenceLinks,
  responsibility = "Drink responsibly.",
  statement,
}: SiteFooterProps) {
  return (
    <footer {...stylex.props(styles.footer)}>
      <div {...stylex.props(styles.footerMain)}>
        <div {...stylex.props(styles.footerIdentity)}>
          <div {...stylex.props(styles.footerBrand)}>{brand}</div>
          <p {...stylex.props(styles.statement)}>{statement}</p>
        </div>
        <nav aria-label="Footer">
          <ul {...stylex.props(styles.footerLinks)}>
            {links.map((link) => (
              <li key={link.href}>
                <FooterAnchor link={link} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {referenceLinks.length ? (
        <div {...stylex.props(styles.referenceSection)}>
          <SectionHeading>Reference</SectionHeading>
          <p {...stylex.props(styles.referenceLinks)}>
            {referenceLinks.map((link) => (
              <FooterAnchor key={link.href} link={link} />
            ))}
          </p>
        </div>
      ) : null}
      <div {...stylex.props(styles.footerMeta)}>
        {coverage ? <p {...stylex.props(styles.coverage)}>{coverage}</p> : null}
        <p {...stylex.props(styles.provenance)}>{provenance}</p>
        <p {...stylex.props(styles.responsibility)}>{responsibility}</p>
      </div>
    </footer>
  );
}

function FooterAnchor({ link }: { link: FooterLink }) {
  return (
    <AppLink href={link.href} {...stylex.props(styles.footerLink)}>
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
    gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)",
    gap: space.x12,
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x8,
    },
  },
  footerIdentity: {
    maxWidth: "260px",
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
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.55,
  },
  footerLinks: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "flex-end",
    columnGap: space.x6,
    rowGap: space.x3,
    flexWrap: "wrap",
    margin: 0,
    padding: 0,
    listStyle: "none",
    [COMPACT]: {
      justifyContent: "flex-start",
    },
  },
  footerLink: {
    color: {
      default: colors.inkMuted,
      ":hover": colors.ink,
    },
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  referenceSection: {
    marginTop: space.x8,
  },
  referenceLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: space.x4,
    margin: 0,
    marginTop: space.x2,
  },
  footerMeta: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x4,
    marginTop: space.x8,
    paddingBottom: space.x4,
    flexWrap: "wrap",
  },
  coverage: {
    minWidth: "280px",
    flex: 1,
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  provenance: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  responsibility: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
});
