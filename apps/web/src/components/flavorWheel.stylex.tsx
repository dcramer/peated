"use client";

import { TAG_CATEGORIES } from "@peated/server/constants";
import type {
  BottleFlavorProfile,
  FlavorProfile,
} from "@peated/server/schemas/flavorProfile";
import type { TagCategory } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { useState, type ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";

const CENTER_X = 168;
const CENTER_Y = 148;
const INNER_RADIUS = 60;
const OUTER_RADIUS = 108;

function point(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [
    Number((CENTER_X + radius * Math.cos(radians)).toFixed(4)),
    Number((CENTER_Y + radius * Math.sin(radians)).toFixed(4)),
  ];
}

function segment(radius: number, start: number, end: number) {
  const a = point(radius, start);
  const b = point(radius, end);
  const c = point(INNER_RADIUS, end);
  const d = point(INNER_RADIUS, start);
  return `M${a.join(",")} A${radius},${radius} 0 0 1 ${b.join(",")} L${c.join(",")} A${INNER_RADIUS},${INNER_RADIUS} 0 0 0 ${d.join(",")} Z`;
}

const label = (category: string) =>
  category.charAt(0).toUpperCase() + category.slice(1);

/**
 * Distribution of public tasting-note families across bottles or one bottle's tastings.
 * Each wedge has a fixed position and an independent 0–100% area scale.
 * Selection reveals its share and two leading notes in the center, without bars.
 * Activating a wedge calls onExplore to open that family's notes and bottles.
 * The parent supplies the heading and centered reference links through footer.
 * Any recognized notes render a chart; empty data shows a short message.
 */
export function FlavorWheel({
  profile,
  onExplore,
  footer,
}: {
  profile: FlavorProfile | BottleFlavorProfile;
  footer?: ReactNode;
  onExplore?: (category: TagCategory) => void;
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const isBottle = "notedTastings" in profile;
  const sampleCount = isBottle ? profile.notedTastings : profile.notedBottles;
  const sample = isBottle ? "tastings" : "bottles";
  const values = isBottle
    ? profile.categories.map((item) => ({
        category: item.category,
        count: item.tastingCount,
        notes: item.notes,
      }))
    : profile.categories.map((item) => ({
        category: item.category,
        count: item.bottleCount,
        notes: item.notes,
      }));
  const categories = TAG_CATEGORIES.map(
    (category) =>
      values.find((item) => item.category === category) ?? {
        category,
        count: 0,
        notes: [],
      },
  );
  const mostCommon = categories.reduce((best, item) =>
    item.count > best.count ? item : best,
  );
  const selected =
    categories.find((item) => item.category === selection) ?? mostCommon;
  const percentage = (count: number) =>
    sampleCount ? Math.round((count / sampleCount) * 100) : 0;
  function explore(category: TagCategory) {
    setSelection(category);
    onExplore?.(category);
  }

  return (
    <div {...stylex.props(styles.root)}>
      {sampleCount === 0 ? (
        <p {...stylex.props(styles.message)}>No public tasting notes yet.</p>
      ) : (
        <>
          <div {...stylex.props(styles.chart)}>
            <svg
              viewBox="0 0 336 292"
              role="group"
              aria-label="Flavor families"
              {...stylex.props(styles.wheel)}
            >
              {categories.map((item, index) => {
                const span = 360 / categories.length;
                const start = index * span + 2;
                const end = (index + 1) * span - 2;
                const [x, y] = point(128, (start + end) / 2);
                // FlavorWheel uses area, rather than radius, to show commonality.
                const radius = Math.sqrt(
                  INNER_RADIUS ** 2 +
                    ((OUTER_RADIUS ** 2 - INNER_RADIUS ** 2) * item.count) /
                      sampleCount,
                );
                const isSelected = selected.category === item.category;
                const isFocused = focused === item.category;
                return (
                  <g
                    key={item.category}
                    role="button"
                    tabIndex={0}
                    aria-label={`${label(item.category)}, ${percentage(item.count)}% of ${sample} with notes${item.notes.length ? `; ${item.notes.map((note) => note.name).join(", ")}` : "; no notes recorded"}`}
                    aria-pressed={isSelected}
                    aria-haspopup={onExplore ? "dialog" : undefined}
                    onClick={() => explore(item.category)}
                    onFocus={() => setFocused(item.category)}
                    onBlur={() => setFocused(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        explore(item.category);
                      }
                    }}
                    {...stylex.props(styles.segment)}
                  >
                    <path
                      d={segment(OUTER_RADIUS, start, end)}
                      {...stylex.props(styles.track)}
                    />
                    {item.count > 0 ? (
                      <path
                        d={segment(radius, start, end)}
                        {...stylex.props(styles.fill)}
                      />
                    ) : null}
                    <path
                      d={segment(OUTER_RADIUS, start, end)}
                      {...stylex.props(
                        styles.selection,
                        isSelected && styles.selected,
                        isFocused && styles.focused,
                      )}
                    />
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      {...stylex.props(
                        styles.label,
                        isSelected && styles.selectedLabel,
                      )}
                    >
                      {label(item.category)}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div aria-hidden="true" {...stylex.props(styles.center)}>
              <strong {...stylex.props(styles.centerTitle)}>
                {label(selected.category)}
              </strong>
              <span {...stylex.props(styles.centerValue)}>
                {percentage(selected.count)}%
              </span>
              <div {...stylex.props(styles.centerNotes)}>
                {selected.notes.length ? (
                  selected.notes.map((note) => (
                    <span
                      key={note.name}
                      title={note.name}
                      {...stylex.props(styles.centerNote)}
                    >
                      {note.name}
                    </span>
                  ))
                ) : (
                  <span>No notes recorded</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {footer ? <div {...stylex.props(styles.footer)}>{footer}</div> : null}
    </div>
  );
}

const styles = stylex.create({
  root: { width: "100%", maxWidth: "336px", marginInline: "auto", minWidth: 0 },
  chart: { position: "relative" },
  footer: { textAlign: "center" },
  wheel: {
    display: "block",
    width: "100%",
    height: "auto",
    overflow: "visible",
  },
  segment: { cursor: "pointer", outline: "none" },
  track: {
    fill: {
      default: colors.inset,
      ":hover": colors.sunken,
      ":active": colors.surface,
    },
  },
  fill: {
    fill: {
      default: colors.accent,
      ":hover": colors.accentDeep,
      ":active": colors.ink,
    },
  },
  selection: {
    fill: "none",
    stroke: "transparent",
    strokeWidth: 2,
    pointerEvents: "none",
  },
  selected: { stroke: colors.ink },
  focused: { stroke: colors.ink, strokeWidth: 3, strokeDasharray: "3 2" },
  label: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    fill: colors.inkMuted,
    pointerEvents: "none",
  },
  selectedLabel: { fill: colors.ink, fontWeight: 700 },
  center: {
    position: "absolute",
    top: "50.685%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "31%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    pointerEvents: "none",
  },
  centerTitle: {
    fontFamily: fonts.display,
    fontSize: "18px",
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
    color: colors.ink,
  },
  centerValue: {
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
    color: colors.ink,
    marginTop: space.x1,
  },
  centerNotes: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.3,
    color: colors.inkMuted,
    marginTop: space.x2,
    maxWidth: "100%",
  },
  centerNote: {
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  message: {
    margin: 0,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.inkMuted,
  },
});
