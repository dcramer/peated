import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, fonts, space } from "../../../styles/tokens.stylex";

export type ErrorPageProps = {
  actions?: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  status: ReactNode;
  support?: ReactNode;
  title: ReactNode;
};

export function ErrorPageLayout({ children }: { children: ReactNode }) {
  return (
    <main
      {...stylex.props(foundationStyles.document, shellStyles.shell)}
      data-page-state-shell
    >
      <div {...stylex.props(shellStyles.content)}>{children}</div>
    </main>
  );
}

/**
 * Presents a page-level state after the owning route has decided that its
 * normal page content cannot render.
 */
export function ErrorPage({
  actions,
  children,
  detail,
  status,
  support,
  title,
}: ErrorPageProps) {
  return (
    <section {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.status)}>{status}</div>
      <h1 {...stylex.props(styles.title)}>{title}</h1>
      <div {...stylex.props(styles.description)}>{children}</div>
      {actions ? <ErrorPageActions>{actions}</ErrorPageActions> : null}
      {detail ? <div {...stylex.props(styles.detail)}>{detail}</div> : null}
      {support}
    </section>
  );
}

export function ErrorPageActions({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.actions)}>{children}</div>;
}

export type ErrorReferenceProps = {
  action?: ReactNode;
  description?: ReactNode;
  label: ReactNode;
  technicalDetail?: {
    context?: ReactNode;
    defaultOpen?: boolean;
    stack: string;
  };
  value: ReactNode;
};

/**
 * Shows a route or incident reference. Its caller owns the redaction boundary
 * for any technical detail that can appear in production.
 */
export function ErrorReference({
  action,
  description,
  label,
  technicalDetail,
  value,
}: ErrorReferenceProps) {
  return (
    <div {...stylex.props(styles.reference)}>
      <div {...stylex.props(styles.referenceRow)}>
        <span {...stylex.props(styles.referenceLabel)}>{label}</span>
        <span {...stylex.props(styles.referenceValue)}>{value}</span>
        {action ? (
          <span {...stylex.props(styles.referenceAction)}>{action}</span>
        ) : null}
      </div>
      {description ? (
        <div {...stylex.props(styles.referenceDescription)}>{description}</div>
      ) : null}
      {technicalDetail ? (
        <details
          open={technicalDetail.defaultOpen}
          {...stylex.props(styles.technicalDetail)}
        >
          <summary {...stylex.props(styles.technicalSummary)}>
            Technical detail
          </summary>
          <div {...stylex.props(styles.technicalBody)}>
            {technicalDetail.context ? (
              <div {...stylex.props(styles.technicalContext)}>
                {technicalDetail.context}
              </div>
            ) : null}
            <pre {...stylex.props(styles.stackTrace)}>
              {technicalDetail.stack}
            </pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function ErrorSupport({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.support)}>
      <div {...stylex.props(styles.supportCopy)}>{children}</div>
      <div {...stylex.props(styles.supportAction)}>{action}</div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "760px",
    color: colors.ink,
  },
  status: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "0.1em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  title: {
    marginTop: space.x1,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontFamily: fonts.display,
    fontSize: "clamp(28px, 6vw, 34px)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    textWrap: "pretty",
  },
  description: {
    maxWidth: "560px",
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.6,
    textWrap: "pretty",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x4,
    flexWrap: "wrap",
  },
  detail: {
    marginTop: "40px",
  },
  reference: {
    paddingTop: "14px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  referenceRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    columnGap: space.x3,
    rowGap: space.x2,
    flexWrap: "wrap",
  },
  referenceLabel: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  referenceValue: {
    minWidth: 0,
    flexGrow: 1,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  referenceAction: {
    flexShrink: 0,
  },
  referenceDescription: {
    maxWidth: "62ch",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  technicalDetail: {
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.data,
  },
  technicalSummary: {
    width: "fit-content",
    color: colors.accent,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.45,
    cursor: "pointer",
  },
  technicalBody: {
    marginTop: space.x2,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderRadius: "3px",
    backgroundColor: colors.surface,
  },
  technicalContext: {
    color: colors.inkMuted,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  stackTrace: {
    maxHeight: "280px",
    marginTop: space.x2,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    overflowX: "auto",
    overflowY: "auto",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  support: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    columnGap: space.x3,
    rowGap: space.x2,
    marginTop: space.x6,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    flexWrap: "wrap",
  },
  supportCopy: {
    minWidth: "200px",
    flexGrow: 1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.55,
    textWrap: "pretty",
  },
  supportAction: {
    flexShrink: 0,
  },
});

const shellStyles = stylex.create({
  shell: {
    boxSizing: "border-box",
    display: "grid",
    minHeight: "100dvh",
    alignItems: "center",
    paddingTop: "clamp(48px, 10vh, 112px)",
    paddingRight: "clamp(20px, 6vw, 72px)",
    paddingBottom: "clamp(48px, 10vh, 112px)",
    paddingLeft: "clamp(20px, 6vw, 72px)",
    backgroundColor: colors.ground,
  },
  content: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1120px",
    marginRight: "auto",
    marginLeft: "auto",
  },
});
