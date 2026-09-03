import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, space } from "../../styles/tokens.stylex";

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
      <div {...stylex.props(foundationStyles.metadata, styles.status)}>
        {status}
      </div>
      <h1 {...stylex.props(foundationStyles.pageTitleCompact, styles.title)}>
        {title}
      </h1>
      <div {...stylex.props(foundationStyles.body, styles.description)}>
        {children}
      </div>
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
        <span
          {...stylex.props(foundationStyles.metadata, styles.referenceLabel)}
        >
          {label}
        </span>
        <span {...stylex.props(foundationStyles.code, styles.referenceValue)}>
          {value}
        </span>
        {action ? (
          <span {...stylex.props(styles.referenceAction)}>{action}</span>
        ) : null}
      </div>
      {description ? (
        <div
          {...stylex.props(
            foundationStyles.metadata,
            styles.referenceDescription,
          )}
        >
          {description}
        </div>
      ) : null}
      {technicalDetail ? (
        <details
          open={technicalDetail.defaultOpen}
          {...stylex.props(foundationStyles.code, styles.technicalDetail)}
        >
          <summary
            {...stylex.props(
              foundationStyles.metadata,
              styles.technicalSummary,
            )}
          >
            Technical detail
          </summary>
          <div {...stylex.props(styles.technicalBody)}>
            {technicalDetail.context ? (
              <div
                {...stylex.props(
                  foundationStyles.code,
                  styles.technicalContext,
                )}
              >
                {technicalDetail.context}
              </div>
            ) : null}
            <pre {...stylex.props(foundationStyles.code, styles.stackTrace)}>
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
      <div {...stylex.props(foundationStyles.metadata, styles.supportCopy)}>
        {children}
      </div>
      <div {...stylex.props(styles.supportAction)}>{action}</div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "760px",
    marginRight: "auto",
    marginLeft: "auto",
    color: colors.ink,
  },
  status: {
    color: colors.inkMuted,
  },
  title: {
    marginTop: space.x1,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    textWrap: "pretty",
  },
  description: {
    maxWidth: "560px",
    marginTop: space.x3,
    color: colors.inkMuted,
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
  },
  referenceValue: {
    minWidth: 0,
    flexGrow: 1,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },
  referenceAction: {
    flexShrink: 0,
  },
  referenceDescription: {
    maxWidth: "62ch",
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  technicalDetail: {
    marginTop: space.x3,
    color: colors.ink,
  },
  technicalSummary: {
    width: "fit-content",
    color: colors.accent,
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  technicalBody: {
    marginTop: space.x2,
    paddingTop: space.x3,
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: "transparent",
  },
  technicalContext: {
    color: colors.inkMuted,
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
