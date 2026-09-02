"use client";

import { TAG_CATEGORIES } from "@peated/server/constants";
import type { FlavorProfile } from "@peated/server/schemas/flavorProfile";
import type { TagCategory } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";

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
const formatCount = (count: number) => count.toLocaleString("en-US");

/**
 * Sidebar distribution of public tasting-note families across bottles.
 * Each wedge has a fixed position and an independent 0–100% area scale.
 * Selection reveals its share and two leading notes in the center, without bars.
 * Optional onExplore opens the selected family in the caller’s tasting guide.
 * The parent supplies the heading, reference links through footer,
 * and any contribution action for empty data.
 */
export function FlavorWheel({
  profile,
  onExplore,
  footer,
}: {
  profile: FlavorProfile;
  footer?: ReactNode;
  onExplore?: (category: TagCategory) => void;
}) {
  const descriptionId = useId();
  const [selection, setSelection] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const categories = TAG_CATEGORIES.map(
    (category) =>
      profile.categories.find((item) => item.category === category) ?? {
        category,
        bottleCount: 0,
        notes: [],
      },
  );
  const mostCommon = categories.reduce((best, item) =>
    item.bottleCount > best.bottleCount ? item : best,
  );
  const selected =
    categories.find((item) => item.category === selection) ?? mostCommon;
  const percentage = (count: number) =>
    profile.notedBottles ? Math.round((count / profile.notedBottles) * 100) : 0;
  const sparse = profile.notedBottles > 0 && profile.notedBottles < 5;

  return (
    <div {...stylex.props(styles.root)}>
      {profile.notedBottles === 0 ? (
        <p {...stylex.props(styles.message)}>
          No public tasting notes yet. Add tasting notes to a bottle to help
          describe its flavor.
        </p>
      ) : sparse ? (
        <div {...stylex.props(styles.early)}>
          <p {...stylex.props(styles.message)}>
            A few early notes from {formatCount(profile.notedBottles)}{" "}
            {profile.notedBottles === 1 ? "bottle" : "bottles"}. More bottles
            need notes before showing a distribution.
          </p>
          <p {...stylex.props(styles.earlyNotes)}>
            {categories
              .flatMap((item) => item.notes)
              .sort(
                (a, b) =>
                  b.bottleCount - a.bottleCount || a.name.localeCompare(b.name),
              )
              .slice(0, 4)
              .map((note) => note.name)
              .join(" · ")}
          </p>
        </div>
      ) : (
        <>
          <div {...stylex.props(styles.context)}>
            <span>Bottles with these notes</span>
            <span>{formatCount(profile.notedBottles)} bottles</span>
          </div>
          <div {...stylex.props(styles.chart)}>
            <svg
              viewBox="0 0 336 292"
              role="group"
              aria-label="Flavor families"
              aria-describedby={descriptionId}
              {...stylex.props(styles.wheel)}
            >
              {categories.map((item, index) => {
                const span = 360 / categories.length;
                const start = index * span + 2;
                const end = (index + 1) * span - 2;
                const [x, y] = point(128, (start + end) / 2);
                // Area, rather than radius, is proportional to bottle occurrence.
                const radius = Math.sqrt(
                  INNER_RADIUS ** 2 +
                    ((OUTER_RADIUS ** 2 - INNER_RADIUS ** 2) *
                      item.bottleCount) /
                      profile.notedBottles,
                );
                const isSelected = selected.category === item.category;
                const isFocused = focused === item.category;
                return (
                  <g
                    key={item.category}
                    role="button"
                    tabIndex={0}
                    aria-label={`${label(item.category)}, ${percentage(item.bottleCount)}% of bottles${item.notes.length ? `; ${item.notes.map((note) => note.name).join(", ")}` : "; no notes recorded"}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelection(item.category)}
                    onFocus={() => setFocused(item.category)}
                    onBlur={() => setFocused(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelection(item.category);
                      }
                    }}
                    {...stylex.props(styles.segment)}
                  >
                    <path
                      d={segment(OUTER_RADIUS, start, end)}
                      {...stylex.props(styles.track)}
                    />
                    {item.bottleCount > 0 ? (
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
                {percentage(selected.bottleCount)}%
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
          <p id={descriptionId} {...stylex.props(styles.hint)}>
            Select a family to explore its notes.
          </p>
          {onExplore ? (
            <Button
              variant="text"
              size="sm"
              fullWidth
              aria-haspopup="dialog"
              onClick={() => onExplore(selected.category)}
            >
              Explore {label(selected.category).toLowerCase()} notes
            </Button>
          ) : null}
        </>
      )}
      <details {...stylex.props(styles.coverage)}>
        <summary {...stylex.props(styles.coverageSummary)}>
          <span>
            Notes cover {formatCount(profile.notedBottles)} of{" "}
            {formatCount(profile.totalBottles)} bottles
          </span>
          <Info size={14} aria-hidden="true" />
        </summary>
        <p {...stylex.props(styles.explanation)}>
          Each family shows the share of bottles with a matching public tasting
          note, among bottles with recognized notes. Each bottle counts once per
          family. Private tastings and suggested notes are excluded.
        </p>
        <p {...stylex.props(styles.explanation)}>
          Families can overlap. Missing notes do not mean a flavor is absent,
          and more frequently tasted bottles have more chances to collect notes.
          This shows occurrence, not intensity.
        </p>
      </details>
      {footer}
    </div>
  );
}

const styles = stylex.create({
  root: { width: "100%", maxWidth: "336px", marginInline: "auto", minWidth: 0 },
  context: {
    display: "flex",
    justifyContent: "space-between",
    gap: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    fontVariantNumeric: "tabular-nums",
  },
  chart: { position: "relative" },
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
  hint: {
    margin: 0,
    textAlign: "center",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  coverage: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  coverageSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x2,
    minHeight: "44px",
    cursor: "pointer",
    listStyle: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
    },
    outline: {
      default: "none",
      ":focus-visible": `2px solid ${colors.accent}`,
    },
    outlineOffset: "-2px",
  },
  explanation: { margin: 0, paddingBottom: space.x2 },
  message: {
    margin: 0,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.inkMuted,
  },
  early: { display: "grid", gap: space.x3 },
  earlyNotes: {
    margin: 0,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    color: colors.ink,
  },
});
