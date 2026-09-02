"use client";

import { Button } from "@peated/web/components";
import { WHEEL_CATEGORIES } from "@peated/web/features/tastingWheel/tastingWheelData";
import { useTastingWheel } from "@peated/web/features/tastingWheel/tastingWheelDetails.stylex";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";

import { colors, fonts, space } from "../../../../styles/tokens.stylex";

const MOBILE = "@media (max-width: 559px)";

const CENTER = 260;
const HUB_RADIUS = 88;
const CATEGORY_RADIUS = 158;
const NOTE_INNER_RADIUS = 162;
const NOTE_OUTER_RADIUS = 244;

function polarPoint(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [
    CENTER + radius * Math.cos(radians),
    CENTER + radius * Math.sin(radians),
  ] as const;
}

function ringSegment(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const [outerStartX, outerStartY] = polarPoint(outerRadius, startAngle);
  const [outerEndX, outerEndY] = polarPoint(outerRadius, endAngle);
  const [innerEndX, innerEndY] = polarPoint(innerRadius, endAngle);
  const [innerStartX, innerStartY] = polarPoint(innerRadius, startAngle);

  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY}`,
    "Z",
  ].join(" ");
}

function labelTransform(radius: number, angle: number) {
  const [x, y] = polarPoint(radius, angle);
  const rotation = angle > 180 ? angle + 90 : angle - 90;
  return `translate(${x} ${y}) rotate(${rotation})`;
}

export function TastingWheelGraphic() {
  const { select, selection } = useTastingWheel();
  const categorySpan = 360 / WHEEL_CATEGORIES.length;

  return (
    <figure {...stylex.props(styles.figure)}>
      <div {...stylex.props(styles.wheelFrame)}>
        <svg
          aria-labelledby="tasting-wheel-title tasting-wheel-description"
          role="group"
          viewBox="0 0 520 520"
          {...stylex.props(styles.wheel)}
        >
          <title id="tasting-wheel-title">Peated tasting wheel</title>
          <desc id="tasting-wheel-description">
            Explore a tasting category or a note to find related words and
            example bottles.
          </desc>
          {WHEEL_CATEGORIES.map((category, categoryIndex) => {
            const startAngle = categoryIndex * categorySpan;
            const endAngle = startAngle + categorySpan;
            const middleAngle = startAngle + categorySpan / 2;
            const noteSpan = categorySpan / category.wheelNotes.length;

            return (
              <Fragment key={category.key}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-label={`Explore ${category.name}`}
                  aria-pressed={
                    selection?.category === category.key && !selection.note
                  }
                  onClick={() => select({ category: category.key })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select({ category: category.key });
                    }
                  }}
                  {...stylex.props(styles.segmentLink)}
                >
                  <path
                    d={ringSegment(
                      HUB_RADIUS,
                      CATEGORY_RADIUS,
                      startAngle + 0.6,
                      endAngle - 0.6,
                    )}
                    {...stylex.props(
                      styles.segment,
                      SEGMENT_STYLES[categoryIndex],
                      selection?.category === category.key &&
                        !selection.note &&
                        styles.selectedSegment,
                    )}
                  />
                  <text
                    textAnchor="middle"
                    transform={labelTransform(123, middleAngle)}
                    {...stylex.props(styles.categoryLabel)}
                  >
                    {category.name}
                  </text>
                </g>
                {category.wheelNotes.map((note, noteIndex) => {
                  const noteStart = startAngle + noteIndex * noteSpan;
                  const noteEnd = noteStart + noteSpan;
                  const noteMiddle = noteStart + noteSpan / 2;

                  return (
                    <g
                      key={note}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="dialog"
                      aria-label={`Explore ${note} in ${category.name}`}
                      aria-pressed={
                        selection?.category === category.key &&
                        selection.note === note
                      }
                      onClick={() => select({ category: category.key, note })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          select({ category: category.key, note });
                        }
                      }}
                      {...stylex.props(styles.segmentLink)}
                    >
                      <path
                        d={ringSegment(
                          NOTE_INNER_RADIUS,
                          NOTE_OUTER_RADIUS,
                          noteStart + 0.5,
                          noteEnd - 0.5,
                        )}
                        {...stylex.props(
                          styles.outerSegment,
                          OUTER_SEGMENT_STYLES[categoryIndex],
                          selection?.category === category.key &&
                            selection.note === note &&
                            styles.selectedSegment,
                        )}
                      />
                      <text
                        textAnchor="middle"
                        transform={labelTransform(203, noteMiddle)}
                        {...stylex.props(styles.noteLabel)}
                      >
                        {note}
                      </text>
                    </g>
                  );
                })}
              </Fragment>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

export function TastingWheelFamilies() {
  const { select } = useTastingWheel();
  return (
    <div {...stylex.props(styles.familyGrid)}>
      {WHEEL_CATEGORIES.map((category) => (
        <article
          id={`tasting-note-${category.key}`}
          key={category.key}
          {...stylex.props(styles.family)}
        >
          <h3 {...stylex.props(styles.familyTitle)}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => select({ category: category.key })}
              {...stylex.props(styles.categoryButton)}
            >
              {category.name}
            </button>
          </h3>
          <p {...stylex.props(styles.familyDescription)}>
            {category.description}
          </p>
          <div {...stylex.props(styles.notes)}>
            {category.notes.map((note) => (
              <Button
                key={note}
                size="sm"
                variant="tonal"
                aria-haspopup="dialog"
                onClick={() => select({ category: category.key, note })}
              >
                {note}
              </Button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

const styles = stylex.create({
  figure: { margin: 0, maxWidth: "520px" },
  wheelFrame: {
    width: "100%",
    minWidth: 0,
  },
  wheel: {
    display: "block",
    width: "100%",
    height: "auto",
  },
  segmentLink: {
    cursor: "pointer",
    opacity: {
      default: 1,
      ":hover": 0.78,
      ":focus-visible": 0.78,
    },
    outline: {
      default: "none",
      ":focus-visible": `2px solid ${colors.accent}`,
    },
    outlineOffset: "2px",
    transitionProperty: "opacity",
    transitionDuration: {
      default: "200ms",
      "@media (prefers-reduced-motion: reduce)": "0ms",
    },
    ":active": { opacity: 0.6 },
  },
  categoryButton: {
    appearance: "none",
    border: 0,
    padding: 0,
    minHeight: "44px",
    backgroundColor: "transparent",
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    cursor: "pointer",
    outline: {
      default: "none",
      ":focus-visible": `2px solid ${colors.accent}`,
    },
    outlineOffset: "2px",
  },
  segment: {
    stroke: colors.ground,
    strokeWidth: 2,
  },
  selectedSegment: { fill: colors.accentTint, stroke: colors.accent },
  segmentSurface: { fill: colors.surface },
  segmentInset: { fill: colors.inset },
  segmentSunken: { fill: colors.sunken },
  segmentAccentTint: { fill: colors.accentTint },
  segmentAccent: { fill: colors.dataAccent },
  outerSegment: {
    stroke: colors.ground,
    strokeWidth: 1.5,
  },
  outerSurface: { fill: colors.surface },
  outerInset: { fill: colors.inset },
  outerSunken: { fill: colors.sunken },
  outerAccentTint: { fill: colors.accentTint },
  outerAccent: { fill: colors.dataAccent },
  categoryLabel: {
    fill: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    pointerEvents: "none",
  },
  noteLabel: {
    fill: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "10.5px",
    fontWeight: 600,
    pointerEvents: "none",
  },
  familyGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [MOBILE]: "minmax(0, 1fr)",
    },
    columnGap: space.x6,
    rowGap: space.x8,
  },
  family: {
    minWidth: 0,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    scrollMarginTop: space.x8,
  },
  familyTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  familyDescription: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  notes: {
    display: "flex",
    flexWrap: "wrap",
    gap: space.x2,
    marginTop: space.x3,
  },
});

const SEGMENT_STYLES = [
  styles.segmentSurface,
  styles.segmentInset,
  styles.segmentSunken,
  styles.segmentSurface,
  styles.segmentInset,
  styles.segmentSunken,
  styles.segmentAccentTint,
  styles.segmentAccent,
  styles.segmentSunken,
] as const;

const OUTER_SEGMENT_STYLES = [
  styles.outerSurface,
  styles.outerInset,
  styles.outerSunken,
  styles.outerSurface,
  styles.outerInset,
  styles.outerSunken,
  styles.outerAccentTint,
  styles.outerAccent,
  styles.outerSunken,
] as const;
