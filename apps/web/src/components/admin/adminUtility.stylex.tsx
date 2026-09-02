"use client";

import type { PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { CursorPager } from "..";
import { buildQueryString } from "../../lib/urls";
import { colors, effects, fonts, space } from "../../styles/tokens.stylex";

export function AdminPager({
  ariaLabel = "Pagination",
  cursorParam = "cursor",
  rel,
  searchParams,
}: {
  ariaLabel?: string;
  cursorParam?: string;
  rel?: PagingRel | null;
  searchParams?: URLSearchParams;
}) {
  const navigationParams = useSearchParams();
  const pathname = usePathname();
  const params = searchParams ?? navigationParams;
  if (!rel || (!rel.prevCursor && !rel.nextCursor)) return null;

  return (
    <CursorPager
      ariaLabel={ariaLabel}
      nextHref={
        rel.nextCursor
          ? `${pathname}?${buildQueryString(params, { [cursorParam]: rel.nextCursor })}`
          : undefined
      }
      previousHref={
        rel.prevCursor
          ? `${pathname}?${buildQueryString(params, { [cursorParam]: rel.prevCursor })}`
          : undefined
      }
    />
  );
}

function AdminDefinitionListRoot(props: ComponentPropsWithoutRef<"dl">) {
  const { className: _className, ...rest } = props;
  return <dl {...rest} {...stylex.props(styles.definitionList)} />;
}

export function AdminDefinitionTerm(props: ComponentPropsWithoutRef<"dt">) {
  const { className: _className, ...rest } = props;
  return <dt {...rest} {...stylex.props(styles.definitionTerm)} />;
}

export function AdminDefinitionDetails(props: ComponentPropsWithoutRef<"dd">) {
  const { className: _className, ...rest } = props;
  return <dd {...rest} {...stylex.props(styles.definitionDetails)} />;
}

export const AdminDefinitionList = Object.assign(AdminDefinitionListRoot, {
  Details: AdminDefinitionDetails,
  Term: AdminDefinitionTerm,
});

export function AdminEmptyActivity({
  children,
  href,
}: {
  children?: ReactNode;
  href?: string;
}) {
  return href ? (
    <Link href={href} {...stylex.props(styles.empty, styles.emptyLink)}>
      {children}
    </Link>
  ) : (
    <div {...stylex.props(styles.empty)}>{children}</div>
  );
}

export function AdminAlert({
  children,
  type = "error",
}: {
  children: ReactNode;
  noMargin?: boolean;
  type?: "default" | "error" | "success" | "warn";
}) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      {...stylex.props(styles.alert, alertToneStyles[type])}
    >
      {type === "error" ? (
        <AlertTriangle
          aria-hidden="true"
          size={18}
          {...stylex.props(styles.alertIcon)}
        />
      ) : null}
      <div>{children}</div>
    </div>
  );
}

export function AdminMarkdown({ content }: { content: string }) {
  return <div {...stylex.props(styles.markdown)}>{content}</div>;
}

const styles = stylex.create({
  definitionList: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)",
    margin: 0,
    "@media (max-width: 559px)": { gridTemplateColumns: "1fr" },
  },
  definitionTerm: {
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  definitionDetails: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
    margin: 0,
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    overflowWrap: "anywhere",
  },
  empty: {
    display: "flex",
    minHeight: "150px",
    alignItems: "center",
    justifyContent: "center",
    padding: space.x8,
    borderWidth: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    textAlign: "center",
  },
  emptyLink: {
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.accentDeep },
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  alert: {
    display: "flex",
    alignItems: "flex-start",
    gap: space.x3,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  alertIcon: { flexShrink: 0 },
  alertDefault: {
    borderColor: colors.hairline,
    backgroundColor: "transparent",
  },
  alertError: {
    borderColor: colors.criticalQuiet,
    backgroundColor: colors.accentTint,
  },
  alertSuccess: {
    borderColor: colors.sectionRule,
    backgroundColor: "transparent",
  },
  alertWarn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint,
  },
  markdown: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  },
});

const alertToneStyles = {
  default: styles.alertDefault,
  error: styles.alertError,
  success: styles.alertSuccess,
  warn: styles.alertWarn,
} as const;
