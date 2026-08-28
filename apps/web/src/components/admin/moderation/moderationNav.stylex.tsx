"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";

const destinations = [
  { href: "/admin/moderation/inbox", label: "Inbox" },
  { href: "/admin/moderation/history", label: "History" },
  { href: "/admin/moderation/automation", label: "Automation" },
];

export default function ModerationNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Moderation" {...stylex.props(styles.nav)}>
      <div {...stylex.props(styles.links)}>
        {destinations.map((destination) => {
          const active = pathname.startsWith(destination.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              href={destination.href}
              key={destination.href}
              {...stylex.props(styles.link, active && styles.active)}
            >
              {destination.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const styles = stylex.create({
  nav: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  links: {
    display: "flex",
    gap: space.x1,
    padding: space.x3,
    overflowX: "auto",
  },
  link: {
    display: "inline-flex",
    minHeight: "40px",
    flexShrink: 0,
    alignItems: "center",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderRadius: "4px",
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.ink },
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  active: { backgroundColor: colors.accent, color: colors.ground },
});
