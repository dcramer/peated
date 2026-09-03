"use client";

import { foundationStyles } from "@peated/web/styles/foundations.stylex";

import { Button } from "@peated/web/components";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import { textLinkStyles } from "@peated/web/components/textLinkStyles.stylex";
import { WHEEL_CATEGORIES } from "@peated/web/features/tastingWheel/tastingWheelData";
import { useTastingWheel } from "@peated/web/features/tastingWheel/tastingWheelDetails.stylex";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";

import { colors, fonts, space } from "../../../../styles/tokens.stylex";

const MOBILE = "@media (max-width: 559px)";
const TABLET = "@media (max-width: 899px)";

const CENTER = 260;
const HUB_RADIUS = 88;
const CATEGORY_RADIUS = 158;
const NOTE_INNER_RADIUS = 162;
const NOTE_OUTER_RADIUS = 244;

function polarPoint(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  // Keep SVG attributes identical across server and browser math implementations.
  return [
    Number((CENTER + radius * Math.cos(radians)).toFixed(4)),
    Number((CENTER + radius * Math.sin(radians)).toFixed(4)),
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

export function TastingWheelIntroduction() {
  return (
    <section
      aria-labelledby="tasting-wheel-introduction"
      {...stylex.props(styles.introduction)}
    >
      <div {...stylex.props(styles.directions)}>
        <SectionHeading id="tasting-wheel-introduction">
          Start with what you notice
        </SectionHeading>
        <p {...stylex.props(foundationStyles.prose, styles.directionText)}>
          Does it remind you of fruit? Follow that part of the wheel outward.
          Maybe it&apos;s a crisp apple, a little citrus, or a handful of
          raisins. A couple of words is plenty. Leave out anything you
          don&apos;t taste.
        </p>
        <p {...stylex.props(foundationStyles.prose, styles.directionText)}>
          Pick a note to find out more and see bottles with that flavor.
        </p>
      </div>
      <TastingWheelGraphic />
    </section>
  );
}

function TastingWheelGraphic() {
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
            Explore a flavor category or a note to find related words and
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

export function TastingWheelCategories() {
  const { select } = useTastingWheel();
  return (
    <div {...stylex.props(styles.categoryGrid)}>
      {WHEEL_CATEGORIES.map((category) => (
        <article
          id={`tasting-note-${category.key}`}
          key={category.key}
          {...stylex.props(styles.category)}
        >
          <SectionHeading level={3}>{category.name}</SectionHeading>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`See examples of ${category.name.toLowerCase()} notes`}
            onClick={() => select({ category: category.key })}
            {...stylex.props(
              textLinkStyles.link,
              foundationStyles.interactiveSmall,
              styles.examplesAction,
            )}
          >
            See examples
          </button>
          <p
            {...stylex.props(
              foundationStyles.metadata,
              styles.categoryDescription,
            )}
          >
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
  introduction: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: space.x6,
  },
  directions: { display: "grid", gap: space.x3, maxWidth: "74ch" },
  directionText: {
    margin: 0,
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  figure: {
    margin: 0,
    width: "100%",
    maxWidth: "520px",
    justifySelf: "center",
  },
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
  examplesAction: {
    appearance: "none",
    marginTop: space.x2,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
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
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [TABLET]: "repeat(2, minmax(0, 1fr))",
      [MOBILE]: "minmax(0, 1fr)",
    },
    columnGap: space.x6,
    rowGap: space.x8,
  },
  category: {
    minWidth: 0,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    scrollMarginTop: space.x8,
  },
  categoryDescription: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
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
