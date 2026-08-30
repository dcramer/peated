import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../styles/tokens.stylex";

type StoryWidth = "compact" | "default" | "page" | "wide";

export function StoryCanvas({
  align = "start",
  children,
  width = "default",
}: {
  align?: "end" | "start";
  children: ReactNode;
  width?: StoryWidth;
}) {
  return (
    <div
      {...stylex.props(
        styles.canvas,
        align === "end" && styles.alignEnd,
        width === "compact" && styles.compact,
        width === "wide" && styles.wide,
        width === "page" && styles.page,
      )}
    >
      {children}
    </div>
  );
}

export function StoryRow({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.row)}>{children}</div>;
}

export function StoryStack({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.stack)}>{children}</div>;
}

export function StorySurfaceContent({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.surfaceContent)}>{children}</div>;
}

const styles = stylex.create({
  canvas: {
    width: "100%",
    maxWidth: "560px",
  },
  alignEnd: {
    display: "flex",
    justifyContent: "flex-end",
  },
  compact: {
    maxWidth: "400px",
  },
  wide: {
    maxWidth: "880px",
  },
  page: {
    maxWidth: "1320px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    columnGap: space.x2,
    rowGap: space.x3,
    flexWrap: "wrap",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x4,
  },
  surfaceContent: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
    padding: space.x4,
  },
});
