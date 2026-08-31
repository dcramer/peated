import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../styles/tokens.stylex";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/** Holds the minimal Peated frame while the root route boundary is loading. */
export function GlobalLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Peated"
      role="status"
      {...stylex.props(styles.root)}
    >
      <div aria-hidden="true" {...stylex.props(styles.mark)}>
        <div {...stylex.props(styles.wordmarkClip)}>
          <div {...stylex.props(styles.wordmark)}>Peated</div>
        </div>
        <div {...stylex.props(styles.rule)} />
      </div>
    </main>
  );
}

const revealWordmark = stylex.keyframes({
  from: { clipPath: "inset(0 100% 0 0)" },
  "55%": { clipPath: "inset(0 0 0 0)" },
  to: { clipPath: "inset(0 0 0 0)" },
});

const drawRule = stylex.keyframes({
  from: { transform: "scaleX(0)" },
  "60%": { transform: "scaleX(1)" },
  to: { transform: "scaleX(1)" },
});

const styles = stylex.create({
  root: {
    boxSizing: "border-box",
    display: "grid",
    width: "100%",
    minHeight: "100dvh",
    margin: 0,
    placeItems: "center",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  mark: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    rowGap: space.x3,
  },
  wordmarkClip: {
    overflow: "hidden",
  },
  wordmark: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "44px",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1,
    animationDuration: "2.6s",
    animationIterationCount: "infinite",
    animationName: { default: revealWordmark, [REDUCED_MOTION]: "none" },
    animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  },
  rule: {
    width: "152px",
    height: "2px",
    backgroundColor: colors.accent,
    transformOrigin: "left",
    animationDuration: "2.6s",
    animationIterationCount: "infinite",
    animationName: { default: drawRule, [REDUCED_MOTION]: "none" },
    animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  },
});
