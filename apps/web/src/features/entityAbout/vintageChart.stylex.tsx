"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import type { AboutSpan, VintageCount } from "./entityAbout";

const LABELED_PEAKS = 3;

export type VintageChartProps = {
  years: readonly VintageCount[];
  withoutVintage: number;
  /** A sourced period to shade behind the bars, such as heavily peated years. */
  highlight?: AboutSpan;
  /** Names the site used, shown under the axis and in each year's tooltip. */
  names?: readonly AboutSpan[];
};

function pluralBottles(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "bottle" : "bottles"}`;
}

// Keeps the tooltip inside the plot near either edge.
function getTooltipShift(share: number) {
  if (share < 0.2) return "translate(-12px, -100%)";
  if (share > 0.8) return "translate(calc(-100% + 12px), -100%)";
  return "translate(-50%, -100%)";
}

function getNameForYear(names: readonly AboutSpan[], year: number) {
  return names.find(
    (name) => year >= name.start && (name.end === null || year < name.end),
  )?.label;
}

/** Shows how many catalog Bottles were distilled in each year. */
export function VintageChart({
  years,
  withoutVintage,
  highlight,
  names = [],
}: VintageChartProps) {
  const [activeYear, setActiveYear] = useState<number | null>(null);
  if (!years.length) return null;

  const first = years[0]!.year;
  const last = years[years.length - 1]!.year;
  const span = last - first + 1;
  const max = Math.max(...years.map((entry) => entry.count));
  const peaks = new Set(
    [...years]
      .sort((a, b) => b.count - a.count)
      .slice(0, LABELED_PEAKS)
      .map((entry) => entry.year),
  );
  const currentName = names[names.length - 1]?.label;
  const position = (year: number) =>
    `${((Math.max(year, first) - first) / span) * 100}%`;
  const width = (start: number, end: number) =>
    `calc(${((Math.min(end, last + 1) - Math.max(start, first)) / span) * 100}% - 2px)`;
  const visibleNames = names.filter(
    (name) => name.start <= last && (name.end === null || name.end > first),
  );
  const active = years.find((entry) => entry.year === activeYear);
  const activeName = active ? getNameForYear(names, active.year) : undefined;

  return (
    <figure {...stylex.props(styles.figure)}>
      {highlight ? (
        <div {...stylex.props(foundationStyles.metadata, styles.legend)}>
          <span aria-hidden="true" {...stylex.props(styles.legendSwatch)} />
          {highlight.label}, {highlight.start}–{highlight.end}
        </div>
      ) : null}

      <div
        aria-hidden="true"
        onMouseLeave={() => setActiveYear(null)}
        {...stylex.props(styles.plot)}
      >
        {highlight ? (
          <span
            {...stylex.props(
              styles.band(
                position(highlight.start),
                width(highlight.start, (highlight.end ?? last) + 1),
              ),
            )}
          />
        ) : null}
        <div {...stylex.props(styles.columns(span))}>
          {years.map((entry) => (
            <div
              key={entry.year}
              onMouseEnter={() => setActiveYear(entry.year)}
              {...stylex.props(styles.column)}
            >
              {peaks.has(entry.year) && entry.count > 0 ? (
                <span {...stylex.props(foundationStyles.metadata, styles.peak)}>
                  {entry.count}
                </span>
              ) : null}
              {entry.count > 0 ? (
                <span
                  {...stylex.props(
                    styles.bar(entry.count / max),
                    entry.year === activeYear && styles.barActive,
                  )}
                />
              ) : null}
            </div>
          ))}
        </div>
        {active ? (
          <div
            {...stylex.props(
              foundationStyles.metadata,
              styles.tooltip(
                `${((active.year - first + 0.5) / span) * 100}%`,
                getTooltipShift((active.year - first + 0.5) / span),
              ),
            )}
          >
            <strong>{active.year}</strong> · {pluralBottles(active.count)}
            {activeName && activeName !== currentName ? (
              <> · distilled as {activeName}</>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        {...stylex.props(styles.columns(span), styles.axis)}
      >
        {years.map((entry) => (
          <span
            key={entry.year}
            {...stylex.props(
              foundationStyles.metadata,
              styles.axisLabel,
              entry.year === first && styles.axisLabelStart,
              entry.year === last && styles.axisLabelEnd,
            )}
          >
            {entry.year === first || entry.year === last || entry.year % 5 === 0
              ? entry.year
              : null}
          </span>
        ))}
      </div>

      {visibleNames.length > 1 ? (
        <div aria-hidden="true" {...stylex.props(styles.names)}>
          {visibleNames.map((name) => (
            <span
              key={name.label}
              {...stylex.props(
                foundationStyles.metadata,
                styles.name(
                  position(name.start),
                  width(name.start, name.end ?? last + 1),
                ),
              )}
            >
              {name.label}
            </span>
          ))}
        </div>
      ) : null}

      <table {...stylex.props(styles.visuallyHidden)}>
        <caption>Bottles by year distilled</caption>
        <thead>
          <tr>
            <th scope="col">Year distilled</th>
            <th scope="col">Bottles</th>
          </tr>
        </thead>
        <tbody>
          {years
            .filter((entry) => entry.count > 0)
            .map((entry) => (
              <tr key={entry.year}>
                <th scope="row">{entry.year}</th>
                <td>{entry.count}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {withoutVintage > 0 ? (
        <figcaption
          {...stylex.props(foundationStyles.metadata, styles.caption)}
        >
          {pluralBottles(withoutVintage)} without a vintage year aren't shown.
        </figcaption>
      ) : null}
    </figure>
  );
}

const styles = stylex.create({
  figure: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    margin: 0,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    color: colors.inkMuted,
  },
  legendSwatch: {
    width: "12px",
    height: "12px",
    borderRadius: "2px",
    backgroundColor: colors.categorySmoke,
    opacity: 0.35,
  },
  plot: {
    position: "relative",
    height: "168px",
    paddingTop: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  band: (left: string, width: string) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    left,
    width,
    backgroundColor: colors.categorySmoke,
    opacity: 0.16,
    borderRadius: "4px 4px 0 0",
  }),
  columns: (count: number) => ({
    position: "relative",
    display: "grid",
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    columnGap: "2px",
    height: "100%",
  }),
  column: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "center",
    minWidth: 0,
  },
  // Leaves room above the tallest bar for its count.
  bar: (share: number) => ({
    width: "100%",
    maxWidth: "28px",
    height: `calc((100% - 20px) * ${share})`,
    minHeight: "2px",
    borderRadius: "4px 4px 0 0",
    backgroundColor: colors.ratingFill,
  }),
  barActive: {
    backgroundColor: colors.accentDeep,
  },
  peak: {
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  tooltip: (left: string, transform: string) => ({
    position: "absolute",
    top: 0,
    left,
    transform,
    paddingBlock: space.x1,
    paddingInline: space.x2,
    borderRadius: "4px",
    backgroundColor: colors.ink,
    color: colors.ground,
    whiteSpace: "nowrap",
    pointerEvents: "none",
  }),
  axis: {
    height: "auto",
  },
  axisLabel: {
    color: colors.inkMuted,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    overflow: "visible",
  },
  axisLabelStart: {
    textAlign: "left",
  },
  // Right-to-left lets the last year overflow inward instead of off the plot.
  axisLabelEnd: {
    direction: "rtl",
    textAlign: "right",
  },
  names: {
    position: "relative",
    height: "24px",
  },
  name: (left: string, width: string) => ({
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
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  }),
  caption: {
    color: colors.inkMuted,
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
