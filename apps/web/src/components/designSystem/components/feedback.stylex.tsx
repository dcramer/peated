import * as stylex from "@stylexjs/stylex";
import type { HTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
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
  tone?: FlashMessageTone;
};

/** Presents short-lived application feedback without owning its lifetime. */
export function FlashMessage({
  children,
  role,
  tone = "success",
  ...props
}: FlashMessageProps) {
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
      {children}
    </div>
  );
}

type PlaceholderPreset =
  | "heading"
  | "metadata"
  | "score"
  | "text"
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
          <h2 {...stylex.props(foundationStyles.sectionHeading)}>{heading}</h2>
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
};

/** Keeps a recoverable failure inside the section that owns it. */
export function SectionError({
  children,
  detail,
  heading,
  onRetry,
  retryLabel = "Retry",
}: SectionErrorProps) {
  return (
    <section role="alert" {...stylex.props(styles.statePanel)}>
      <div {...stylex.props(styles.stateCopy)}>
        <div {...stylex.props(styles.stateHeadingRow)}>
          <h2 {...stylex.props(foundationStyles.sectionHeading)}>{heading}</h2>
          {detail ? (
            <span {...stylex.props(styles.errorDetail)}>{detail}</span>
          ) : null}
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

type LoadingRowCount = 1 | 2 | 3 | 4;

export type LoadingListProps = {
  label?: string;
  rows?: LoadingRowCount;
};

/** Reserves the final row geometry while a list is loading. */
export function LoadingList({
  label = "Loading records",
  rows = 3,
}: LoadingListProps) {
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
          {...stylex.props(styles.loadingRow)}
        >
          <LoadingPlaceholder
            delay={getPlaceholderDelay(index)}
            preset="thumbnail"
          />
          <span {...stylex.props(styles.loadingCopy)}>
            <LoadingPlaceholder
              delay={getPlaceholderDelay(index + 1)}
              preset="text"
            />
            <LoadingPlaceholder
              delay={getPlaceholderDelay(index + 2)}
              preset="metadata"
            />
          </span>
          <LoadingPlaceholder
            delay={getPlaceholderDelay(index + 3)}
            preset="score"
          />
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
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    backgroundColor: colors.surface,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
  },
  flashSuccess: {
    borderLeftColor: colors.accent,
  },
  flashError: {
    borderLeftColor: colors.accentDeep,
    backgroundColor: colors.accentTint,
  },
  flashInfo: {
    borderLeftColor: colors.inkMuted,
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
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  stateCopy: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x3,
    padding: space.x6,
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
    paddingRight: space.x6,
    paddingBottom: space.x6,
    paddingLeft: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  errorDetail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  loadingList: {
    boxSizing: "border-box",
    width: "100%",
    paddingTop: space.x1,
    paddingRight: space.x4,
    paddingBottom: space.x1,
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingRow: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "32px minmax(0, 1fr) 46px",
    alignItems: "center",
    columnGap: space.x3,
    paddingTop: "10px",
    paddingBottom: "10px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
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
    backgroundColor: colors.inset,
    animationName: { default: pulse, [REDUCED_MOTION]: "none" },
    animationDuration: "1.4s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  heading: {
    width: "168px",
    height: "22px",
  },
  text: {
    width: "62%",
    height: "15px",
  },
  metadata: {
    width: "40%",
    height: "11px",
  },
  thumbnail: {
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

const presets = {
  heading: styles.heading,
  metadata: styles.metadata,
  score: styles.score,
  text: styles.text,
  thumbnail: styles.thumbnail,
} satisfies Record<PlaceholderPreset, stylex.StyleXStyles>;

const delays = {
  0: styles.delay0,
  1: styles.delay1,
  2: styles.delay2,
  3: styles.delay3,
  4: styles.delay4,
} satisfies Record<PlaceholderDelay, stylex.StyleXStyles>;
