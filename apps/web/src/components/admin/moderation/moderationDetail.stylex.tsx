"use client";

import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, type ReactNode } from "react";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

export function ModerationDetailFrame({ children }: { children: ReactNode }) {
  return <main {...stylex.props(styles.frame)}>{children}</main>;
}

export function ModerationDetailContent({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.content)}>{children}</div>;
}

export function ModerationActionBar({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.actions)}>{children}</div>;
}

export function ModerationEmpty({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.empty)}>
      <strong {...stylex.props(styles.emptyTitle)}>{title}</strong>
      <p {...stylex.props(styles.emptyCopy)}>{children}</p>
      {action}
    </div>
  );
}

export function ScreenReaderAnnouncement({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div aria-live="polite" {...stylex.props(styles.srOnly)}>
      {children}
    </div>
  );
}

export function ModerationStack({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.stack)}>{children}</div>;
}

export function ModerationTaskHeader({
  blocked,
  category,
  meta,
  question,
  status,
  taskKey,
}: {
  blocked: boolean;
  category: ReactNode;
  meta: ReactNode;
  question: ReactNode;
  status: ReactNode;
  taskKey: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [taskKey]);
  return (
    <header {...stylex.props(styles.taskHeader)}>
      <div {...stylex.props(styles.taskMeta)}>
        {category} /{" "}
        <span {...stylex.props(blocked && styles.blocked)}>{status}</span>
      </div>
      <h1 ref={headingRef} tabIndex={-1} {...stylex.props(styles.taskTitle)}>
        {question}
      </h1>
      <p {...stylex.props(styles.taskCopy)}>{meta}</p>
    </header>
  );
}

export function ModerationMedia({
  children,
  imageUrl,
}: {
  children: ReactNode;
  imageUrl?: string | null;
}) {
  return (
    <div {...stylex.props(styles.media)}>
      {imageUrl ? (
        <img alt="" src={imageUrl} {...stylex.props(styles.image)} />
      ) : null}
      <div {...stylex.props(styles.mediaCopy)}>{children}</div>
    </div>
  );
}

export function ModerationActions({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.taskActions)}>{children}</div>;
}

export function ModerationLoading({ children }: { children: ReactNode }) {
  return (
    <div role="status" {...stylex.props(styles.loading)}>
      {children}
    </div>
  );
}

const styles = stylex.create({
  frame: { minWidth: 0, minHeight: "70dvh" },
  content: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "920px",
    marginRight: "auto",
    marginLeft: "auto",
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
    marginBottom: space.x4,
    flexWrap: "wrap",
  },
  empty: {
    display: "flex",
    minHeight: "65dvh",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: space.x3,
    padding: space.x8,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
  },
  emptyCopy: { maxWidth: "42ch", margin: 0, fontSize: "14px", lineHeight: 1.5 },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
  },
  stack: { display: "grid", gap: space.x6 },
  taskHeader: {
    paddingBottom: space.x6,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  taskMeta: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  blocked: { color: colors.accentDeep },
  taskTitle: {
    margin: 0,
    marginTop: space.x3,
    outline: "none",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    lineHeight: 1.15,
  },
  taskCopy: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
  media: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x4,
  },
  image: {
    width: "80px",
    height: "96px",
    flexShrink: 0,
    objectFit: "contain",
    backgroundColor: colors.inset,
  },
  mediaCopy: {
    minWidth: 0,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  taskActions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    flexWrap: "wrap",
  },
  loading: {
    padding: space.x8,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
  },
});
