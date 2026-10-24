"use client";

import * as stylex from "@stylexjs/stylex";
import { useState, type ReactNode } from "react";

import { AppLink } from "../../components/appLink";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import {
  getAxisYears,
  getLabeledYears,
  type AboutSpan,
  type VintageCount,
} from "./entityAbout";

export type VintageChartProps = {
  years: readonly VintageCount[];
  withoutYear: number;
  /** Sourced eras to shade behind the bars, such as heavily peated years. */
  eras?: readonly AboutSpan[];
  /** A Bottle list URL; each year links to it filtered to that vintage. */
  bottleListHref?: string;
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

/** One year's column; a link to that year's Bottles when it has any. */
function ChartColumn({
  children,
  href,
  onMouseEnter,
}: {
  children: ReactNode;
  href?: string;
  onMouseEnter: () => void;
}) {
  return href ? (
    <AppLink
      href={href}
      onMouseEnter={onMouseEnter}
      tabIndex={-1}
      {...stylex.props(styles.column, styles.columnLink)}
    >
      {children}
    </AppLink>
  ) : (
    <div onMouseEnter={onMouseEnter} {...stylex.props(styles.column)}>
      {children}
    </div>
  );
}

/** Shows how many catalog Bottles were distilled in each year. */
export function VintageChart({
  years,
  withoutYear,
  eras = [],
  bottleListHref,
  names = [],
}: VintageChartProps) {
  const [activeYear, setActiveYear] = useState<number | null>(null);
  if (!years.length) return null;

  const first = years[0]!.year;
  const last = years[years.length - 1]!.year;
  const span = last - first + 1;
  const max = Math.max(...years.map((entry) => entry.count));
  const peaks = getLabeledYears(years);
  const axisYears = getAxisYears(first, last);
  const currentName = names[names.length - 1]?.label;
  const position = (year: number) =>
    `${((Math.max(year, first) - first) / span) * 100}%`;
  const width = (start: number, end: number) =>
    `calc(${((Math.min(end, last + 1) - Math.max(start, first)) / span) * 100}% - 2px)`;
  const visibleNames = names.filter(
    (name) => name.start <= last && (name.end === null || name.end > first),
  );
  const hrefForYear = bottleListHref
    ? (year: number) =>
        `${bottleListHref}${bottleListHref.includes("?") ? "&" : "?"}vintageYear=${year}`
    : undefined;
  const visibleEras = eras.filter(
    (era) => era.start <= last && (era.end === null || era.end >= first),
  );
  const active = years.find((entry) => entry.year === activeYear);
  const activeName = active ? getNameForYear(names, active.year) : undefined;

  return (
    <figure {...stylex.props(styles.figure)}>
      {visibleEras.length ? (
        <div {...stylex.props(foundationStyles.metadata, styles.legend)}>
          <span aria-hidden="true" {...stylex.props(styles.legendSwatch)} />
          {visibleEras
            .map((era) => `${era.label}, ${era.start}–${era.end ?? "today"}`)
            .join("; ")}
        </div>
      ) : null}

      <div
        aria-hidden="true"
        onMouseLeave={() => setActiveYear(null)}
        {...stylex.props(styles.plot)}
      >
        {visibleEras.map((era) => (
          <span
            key={`${era.label}-${era.start}`}
            {...stylex.props(
              styles.band(
                position(era.start),
                width(era.start, (era.end ?? last) + 1),
              ),
            )}
          />
        ))}
        <div {...stylex.props(styles.columns(span))}>
          {years.map((entry) => (
            <ChartColumn
              href={entry.count > 0 ? hrefForYear?.(entry.year) : undefined}
              key={entry.year}
              onMouseEnter={() => setActiveYear(entry.year)}
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
            </ChartColumn>
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
            {axisYears.has(entry.year) ? entry.year : null}
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
                <th scope="row">
                  {hrefForYear ? (
                    <a href={hrefForYear(entry.year)}>{entry.year}</a>
                  ) : (
                    entry.year
                  )}
                </th>
                <td>{entry.count}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {withoutYear > 0 ? (
        <figcaption
          {...stylex.props(foundationStyles.metadata, styles.caption)}
        >
          {pluralBottles(withoutYear)} without a year aren't shown.
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
  columnLink: {
    cursor: "pointer",
    textDecoration: "none",
  },
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
