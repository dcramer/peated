import * as stylex from "@stylexjs/stylex";
import type { HTMLAttributes, ReactNode } from "react";
import { SectionHeading } from "./sectionHeading.stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  bottleThumbnailMetrics,
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";
import { Button } from "./button.stylex";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

export type FloatingPanelProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style"
> & {
  children: ReactNode;
};

export function FloatingPanel({ children, ...props }: FloatingPanelProps) {
  return (
    <div {...props} {...stylex.props(styles.overlay)}>
      {children}
    </div>
  );
}

export type FlashMessageTone = "error" | "info" | "success";

export type FlashMessageProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style"
> & {
  children: ReactNode;
  status?: string;
  tone?: FlashMessageTone;
};

const flashStatuses = {
  error: "Not saved",
  info: "Note",
  success: "Saved",
} satisfies Record<FlashMessageTone, string>;

/** Presents short-lived application feedback without owning its lifetime. */
export function FlashMessage({
  children,
  role,
  status,
  tone = "success",
  ...props
}: FlashMessageProps) {
  const statusWord = status === undefined ? flashStatuses[tone] : status;
  return (
    <div
      {...props}
      role={role ?? (tone === "error" ? "alert" : "status")}
      {...stylex.props(
        foundationStyles.body,
        styles.flashMessage,
        flashMessageTones[tone],
      )}
    >
      {statusWord ? (
        <span
          {...stylex.props(
            foundationStyles.interactiveSmall,
            styles.flashStatus,
          )}
        >
          {statusWord}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export type NoticeTone = "critical" | "notice" | "warning";
export type NoticeProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style"
> & {
  action?: ReactNode;
  children: ReactNode;
  heading?: ReactNode;
  status?: string;
  tone?: NoticeTone;
};

const noticeStatuses = {
  critical: "Problem",
  notice: "Note",
  warning: "Heads up",
} satisfies Record<NoticeTone, string>;

/** Shows a persistent caveat or warning beside the content it qualifies. */
export function Notice({
  action,
  children,
  heading,
  role,
  status,
  tone = "notice",
  ...props
}: NoticeProps) {
  const statusWord = status === undefined ? noticeStatuses[tone] : status;
  return (
    <div
      {...props}
      role={role ?? (tone === "critical" ? "alert" : "status")}
      {...stylex.props(styles.notice, noticeTones[tone])}
    >
      {statusWord ? (
        <span
          {...stylex.props(
            foundationStyles.interactiveSmall,
            styles.noticeStatus,
            noticeStatusTones[tone],
          )}
        >
          {statusWord}
        </span>
      ) : null}
      {heading ? (
        <strong
          {...stylex.props(foundationStyles.rowTitle, styles.noticeHeading)}
        >
          {heading}
        </strong>
      ) : null}
      <div {...stylex.props(foundationStyles.body, styles.noticeBody)}>
        {children}
      </div>
      {action ? (
        <div {...stylex.props(styles.noticeAction)}>{action}</div>
      ) : null}
    </div>
  );
}

type PlaceholderPreset =
  | "heading"
  | "metadata"
  | "pageMetadata"
  | "pageTitle"
  | "recordTitle"
  | "score"
  | "text"
  | "smallThumbnail"
  | "thumbnail";

type PlaceholderDelay = 0 | 1 | 2 | 3 | 4;
const placeholderDelays: readonly PlaceholderDelay[] = [0, 1, 2, 3, 4];

function getPlaceholderDelay(index: number): PlaceholderDelay {
  return placeholderDelays[index % placeholderDelays.length] ?? 0;
}

export function LoadingPlaceholder({
  delay = 0,
  preset = "text",
}: {
  delay?: PlaceholderDelay;
  preset?: PlaceholderPreset;
}) {
  return (
    <span
      aria-hidden="true"
      data-preset={preset}
      {...stylex.props(styles.placeholder, presets[preset], delays[delay])}
    />
  );
}

export type EmptyStateProps = {
  action?: ReactNode;
  children: ReactNode;
  heading: ReactNode;
  status?: ReactNode;
  supplementary?: ReactNode;
};

/** Explains an empty result and keeps the next useful action in the section. */
export function EmptyState({
  action,
  children,
  heading,
  status,
  supplementary,
}: EmptyStateProps) {
  return (
    <section {...stylex.props(styles.statePanel)}>
      <div {...stylex.props(styles.stateCopy)}>
        <div {...stylex.props(styles.stateHeadingRow)}>
          <SectionHeading>{heading}</SectionHeading>
          {status}
        </div>
        <div {...stylex.props(foundationStyles.body, styles.stateDescription)}>
          {children}
        </div>
        {action ? (
          <div {...stylex.props(styles.stateActions)}>{action}</div>
        ) : null}
      </div>
      {supplementary ? (
        <div {...stylex.props(styles.supplementary)}>{supplementary}</div>
      ) : null}
    </section>
  );
}

export type SectionErrorProps = {
  children: ReactNode;
  detail?: string;
  heading: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  status?: string;
};

/** Keeps a recoverable failure inside the section that owns it. */
export function SectionError({
  children,
  detail,
  heading,
  onRetry,
  retryLabel = "Retry",
  status = "Unavailable",
}: SectionErrorProps) {
  return (
    <section
      role="alert"
      {...stylex.props(styles.statePanel, styles.criticalState)}
    >
      <div {...stylex.props(styles.stateCopy, styles.criticalStateCopy)}>
        <div {...stylex.props(styles.errorHeading)}>
          <div
            {...stylex.props(
              foundationStyles.interactiveSmall,
              styles.stateStatus,
            )}
          >
            <span>{status}</span>
            {detail ? (
              <span
                {...stylex.props(foundationStyles.metadata, styles.errorDetail)}
              >
                {detail}
              </span>
            ) : null}
          </div>
          <SectionHeading>{heading}</SectionHeading>
        </div>
        <div {...stylex.props(foundationStyles.body, styles.stateDescription)}>
          {children}
        </div>
        {onRetry ? (
          <div {...stylex.props(styles.stateActions)}>
            <Button onClick={onRetry} size="sm" variant="tonal">
              {retryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type LoadingRowCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LoadingListProps = {
  label?: string;
  rows?: LoadingRowCount;
  variant?: "bottleAction" | "sidebar" | "standard" | "text";
};

/** Reserves common list-row shapes while records load. */
export function LoadingList({
  label = "Loading records",
  rows = 3,
  variant = "standard",
}: LoadingListProps) {
  const sidebar = variant === "sidebar";
  const text = variant === "text";
  const bottleAction = variant === "bottleAction";
  return (
    <div
      aria-busy="true"
      aria-label={label}
      role="status"
      {...stylex.props(styles.loadingList)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          aria-hidden="true"
          key={index}
          {...stylex.props(
            styles.loadingRow,
            sidebar && styles.loadingSidebarRow,
            text && styles.loadingTextRow,
          )}
        >
          {!text ? (
            <LoadingPlaceholder
              delay={getPlaceholderDelay(index)}
              preset={sidebar ? "smallThumbnail" : "thumbnail"}
            />
          ) : null}
          <span {...stylex.props(styles.loadingCopy)}>
            <LoadingPlaceholder
              delay={getPlaceholderDelay(index + 1)}
              preset={sidebar ? "text" : "metadata"}
            />
            <LoadingPlaceholder
              delay={getPlaceholderDelay(index + 1)}
              preset={sidebar ? "metadata" : "text"}
            />
            {!sidebar && !text ? (
              <LoadingPlaceholder
                delay={getPlaceholderDelay(index + 2)}
                preset="metadata"
              />
            ) : null}
          </span>
          {!sidebar && !text ? (
            bottleAction ? (
              <span {...stylex.props(styles.loadingAction)} />
            ) : (
              <LoadingPlaceholder
                delay={getPlaceholderDelay(index + 3)}
                preset="score"
              />
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 0.5 },
  "50%": { opacity: 1 },
});

const styles = stylex.create({
  flashMessage: {
    boxSizing: "border-box",
    pointerEvents: "auto",
    width: "min(100%, 480px)",
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
  },
  flashSuccess: {
    borderColor: colors.sectionRule,
  },
  flashError: {
    borderColor: colors.criticalQuiet,
  },
  flashInfo: {
    borderColor: colors.sectionRule,
  },
  flashStatus: {
    display: "block",
    marginBottom: "2px",
    color: colors.inkMuted,
    fontWeight: 700,
  },
  notice: {
    boxSizing: "border-box",
    width: "100%",
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    backgroundColor: "transparent",
    color: colors.ink,
  },
  noticeWarning: { borderColor: colors.accentTint },
  noticeCritical: { borderColor: colors.criticalQuiet },
  noticeStatus: {
    display: "block",
    marginBottom: "2px",
    color: colors.inkMuted,
    fontWeight: 700,
  },
  noticeStatusWarning: { color: colors.accentDeep },
  noticeStatusCritical: { color: colors.critical },
  noticeHeading: {
    display: "block",
    marginBottom: "3px",
  },
  noticeBody: {
    maxWidth: "62ch",
    color: colors.inkMuted,
  },
  noticeAction: {
    display: "flex",
    gap: space.x2,
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  overlay: {
    boxSizing: "border-box",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
  },
  statePanel: {
    boxSizing: "border-box",
    width: "100%",
    overflow: "hidden",
    borderRadius: 0,
    backgroundColor: "transparent",
    color: colors.ink,
  },
  criticalState: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.criticalQuiet,
    borderRadius: controlMetrics.radius,
  },
  criticalStateCopy: {
    paddingTop: space.x4,
    paddingRight: space.x6,
    paddingBottom: space.x6,
    paddingLeft: space.x6,
  },
  stateCopy: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x3,
    paddingTop: space.x6,
    paddingRight: 0,
    paddingBottom: space.x6,
    paddingLeft: 0,
  },
  stateHeadingRow: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x3,
    rowGap: space.x2,
    flexWrap: "wrap",
  },
  stateDescription: {
    maxWidth: "62ch",
    color: colors.inkMuted,
  },
  stateActions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  supplementary: {
    paddingTop: space.x4,
    paddingRight: 0,
    paddingBottom: space.x6,
    paddingLeft: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  errorDetail: {
    color: colors.inkMuted,
  },
  errorHeading: { width: "100%" },
  stateStatus: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
    marginBottom: space.x1,
    color: colors.critical,
    fontWeight: 700,
  },
  loadingList: {
    boxSizing: "border-box",
    width: "100%",
    padding: 0,
    backgroundColor: "transparent",
  },
  loadingRow: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "auto minmax(0, 1fr) 46px",
    alignItems: "center",
    columnGap: space.x3,
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  loadingSidebarRow: {
    gridTemplateColumns: "auto minmax(0, 1fr)",
    paddingTop: space.x2,
    paddingBottom: space.x2,
  },
  loadingTextRow: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  loadingAction: {
    width: "112px",
    height: controlMetrics.controlHeightSmall,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  placeholder: {
    display: "block",
    maxWidth: "100%",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.surface,
    animationName: { default: pulse, [REDUCED_MOTION]: "none" },
    animationDuration: "1.4s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  heading: {
    width: "168px",
    height: "26px",
  },
  text: {
    width: "62%",
    height: "18px",
  },
  metadata: {
    width: "40%",
    height: "13px",
  },
  pageMetadata: {
    width: "180px",
    height: "13px",
  },
  pageTitle: {
    width: "min(520px, calc(100vw - 40px))",
    height: "clamp(38px, 5vw, 64px)",
  },
  recordTitle: {
    width: "min(680px, calc(100vw - 40px))",
    height: "clamp(76px, 9.5vw, 137px)",
  },
  thumbnail: {
    width: bottleThumbnailMetrics.width,
    height: bottleThumbnailMetrics.height,
  },
  smallThumbnail: {
    width: "32px",
    height: "46px",
  },
  score: {
    width: "46px",
    height: "20px",
  },
  delay0: { animationDelay: "0ms" },
  delay1: { animationDelay: "50ms" },
  delay2: { animationDelay: "150ms" },
  delay3: { animationDelay: "250ms" },
  delay4: { animationDelay: "350ms" },
});
const flashMessageTones = {
  error: styles.flashError,
  info: styles.flashInfo,
  success: styles.flashSuccess,
} satisfies Record<FlashMessageTone, stylex.StyleXStyles>;
const noticeTones = {
  critical: styles.noticeCritical,
  notice: null,
  warning: styles.noticeWarning,
} satisfies Record<NoticeTone, stylex.StyleXStyles | null>;
const noticeStatusTones = {
  critical: styles.noticeStatusCritical,
  notice: null,
  warning: styles.noticeStatusWarning,
} satisfies Record<NoticeTone, stylex.StyleXStyles | null>;
const presets = {
  heading: styles.heading,
  metadata: styles.metadata,
  pageMetadata: styles.pageMetadata,
  pageTitle: styles.pageTitle,
  recordTitle: styles.recordTitle,
  score: styles.score,
  text: styles.text,
  thumbnail: styles.thumbnail,
  smallThumbnail: styles.smallThumbnail,
} satisfies Record<PlaceholderPreset, stylex.StyleXStyles>;
const delays = {
  0: styles.delay0,
  1: styles.delay1,
  2: styles.delay2,
  3: styles.delay3,
  4: styles.delay4,
} satisfies Record<PlaceholderDelay, stylex.StyleXStyles>;
