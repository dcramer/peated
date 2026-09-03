"use client";

import * as stylex from "@stylexjs/stylex";
import { useLinkStatus } from "next/link";

/** Place inside a Next Link with a positioned parent; Next owns its pending state. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <LinkPendingIndicator pending={pending} />;
}

/** Shows navigation progress without changing the link's label, size, or native behavior. */
export function LinkPendingIndicator({ pending }: { pending: boolean }) {
  return (
    <>
      <span role="status" {...stylex.props(styles.status)}>
        {pending ? "Loading…" : null}
      </span>
      {pending ? (
        <span aria-hidden="true" {...stylex.props(styles.track)}>
          <span {...stylex.props(styles.progress)} />
        </span>
      ) : null}
    </>
  );
}

const sweep = stylex.keyframes({
  "0%": { transform: "translateX(-100%)" },
  "100%": { transform: "translateX(300%)" },
});

const styles = stylex.create({
  status: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  track: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "2px",
    overflow: "hidden",
    pointerEvents: "none",
  },
  progress: {
    display: "block",
    width: "33%",
    height: "2px",
    backgroundColor: "currentColor",
    animationName: {
      default: sweep,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    animationDuration: "1.15s",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationIterationCount: "infinite",
  },
});
