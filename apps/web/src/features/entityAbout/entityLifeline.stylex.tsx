import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import type { AboutSpan } from "./entityAbout";

const NARROW = "@media (max-width: 559px)";
// Segments narrower than this share of the axis keep their label in the
// tooltip and the accessible list only.
const MIN_LABEL_SHARE = 0.12;

export type EntityLifelineLane = {
  label: string;
  spans: readonly AboutSpan[];
  /** Spans with this label draw as quiet, empty periods. */
  quietLabel?: string;
  /** Neutral lanes label periods, such as names, without implying activity. */
  tone?: "accent" | "neutral";
};

export type EntityLifelineProps = {
  lanes: readonly EntityLifelineLane[];
  currentYear: number;
};

function getAxisTicks(first: number, last: number) {
  const ticks: number[] = [];
  for (let year = Math.ceil((first + 1) / 50) * 50; year < last; year += 50) {
    // Interior ticks keep clear of the end labels on narrow screens.
    const total = last - first;
    if ((year - first) / total >= 0.14 && (last - year) / total >= 0.14) {
      ticks.push(year);
    }
  }
  return [first, ...ticks, last];
}

function formatSpanYears(span: AboutSpan) {
  return span.end === null
    ? `${span.start}–today`
    : `${span.start}–${span.end}`;
}

/**
 * Shows one site's life on a single year axis: when it ran, when it sat
 * silent, and what it was called. Each lane is a set of dated spans.
 */
export function EntityLifeline({ lanes, currentYear }: EntityLifelineProps) {
  const first = Math.min(
    ...lanes.flatMap((lane) => lane.spans.map((s) => s.start)),
  );
  const total = currentYear - first;
  const ticks = getAxisTicks(first, currentYear);
  const position = (year: number) => `${((year - first) / total) * 100}%`;

  return (
    <div {...stylex.props(styles.root)}>
      {lanes.map((lane) => (
        <div key={lane.label} {...stylex.props(styles.lane)}>
          <span
            {...stylex.props(foundationStyles.fieldLabel, styles.laneLabel)}
          >
            {lane.label}
          </span>
          <ol aria-label={lane.label} {...stylex.props(styles.track)}>
            {lane.spans.map((span) => {
              const end = span.end ?? currentYear;
              const share = (end - span.start) / total;
              const quiet = span.label === lane.quietLabel;
              const years = formatSpanYears(span);
              return (
                <li
                  key={`${span.label}-${span.start}`}
                  title={`${span.label}, ${years}`}
                  {...stylex.props(
                    styles.segment(
                      position(span.start),
                      `calc(${share * 100}% - 2px)`,
                    ),
                    lane.tone === "neutral"
                      ? styles.neutral
                      : quiet
                        ? styles.quiet
                        : styles.active,
                  )}
                >
                  <span
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.segmentLabel,
                      share < MIN_LABEL_SHARE && styles.visuallyHidden,
                    )}
                  >
                    {span.label}
                    <span {...stylex.props(styles.visuallyHidden)}>
                      , {years}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <div aria-hidden="true" {...stylex.props(styles.axisRow)}>
        <span />
        <div {...stylex.props(styles.axis)}>
          {ticks.map((year, index) => (
            <span
              key={year}
              {...stylex.props(
                foundationStyles.metadata,
                styles.tick(position(year)),
                index === 0 && styles.tickStart,
                index === ticks.length - 1 && styles.tickEnd,
              )}
            >
              {index === ticks.length - 1 ? "Today" : year}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  lane: {
    display: "grid",
    gridTemplateColumns: {
      default: "64px minmax(0, 1fr)",
      [NARROW]: "minmax(0, 1fr)",
    },
    alignItems: "center",
    columnGap: space.x3,
    rowGap: space.x1,
  },
  laneLabel: {
    color: colors.inkMuted,
  },
  track: {
    position: "relative",
    height: "28px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  segment: (left: string, width: string) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    left,
    width,
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    boxSizing: "border-box",
    paddingInline: space.x2,
    borderRadius: "4px",
  }),
  active: {
    backgroundColor: colors.dataAccent,
    color: colors.ink,
  },
  quiet: {
    backgroundColor: colors.inset,
    color: colors.inkMuted,
  },
  neutral: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.fieldRule,
    color: colors.ink,
  },
  segmentLabel: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  axisRow: {
    display: "grid",
    gridTemplateColumns: {
      default: "64px minmax(0, 1fr)",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x3,
  },
  axis: {
    position: "relative",
    height: "18px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  tick: (left: string) => ({
    position: "absolute",
    top: space.x1,
    left,
    transform: "translateX(-50%)",
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  }),
  tickStart: {
    transform: "none",
  },
  tickEnd: {
    transform: "translateX(-100%)",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});
