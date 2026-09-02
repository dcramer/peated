import { TAG_CATEGORIES } from "@peated/server/constants";
import type { TagCategory } from "@peated/server/types";
import { Chip } from "@peated/web/components";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../../../styles/tokens.stylex";

const MOBILE = "@media (max-width: 559px)";
const WHEEL_STACKED = "@media (max-width: 1219px)";
const WHEEL_COMPACT = "@media (max-width: 899px)";

type WheelCategoryDefinition = {
  description: string;
  name: string;
  notes: readonly string[];
  wheelNotes: readonly [string, string, string];
};

const CATEGORY_DEFINITIONS = {
  cereal: {
    name: "Cereal",
    description: "Malt, bread, dough, and porridge.",
    wheelNotes: ["malt", "biscuit", "porridge"],
    notes: [
      "malt",
      "biscuit",
      "porridge",
      "barley sugar",
      "sourdough",
      "popcorn",
    ],
  },
  fruit: {
    name: "Fruit",
    description: "Fresh, dried, cooked, tropical, and citrus fruit.",
    wheelNotes: ["apple", "citrus", "raisin"],
    notes: [
      "green apple",
      "pear",
      "apricot",
      "lemon zest",
      "dried fruit",
      "raisin",
    ],
  },
  floral: {
    name: "Floral",
    description: "Flowers, herbs, leaves, grass, and tea.",
    wheelNotes: ["heather", "mint", "grass"],
    notes: ["heather", "cut grass", "lavender", "mint", "jasmine", "green tea"],
  },
  smoke: {
    name: "Smoke",
    description: "Peat smoke, ash, medicine, wet stone, and sea air.",
    wheelNotes: ["smoke", "peat", "iodine"],
    notes: ["smoke", "iodine", "seaweed", "bonfire", "brine", "wet stone"],
  },
  earthy: {
    name: "Earthy",
    description: "Leather, tobacco, nuts, coffee, wax, soil, and savory food.",
    wheelNotes: ["leather", "coffee", "wax"],
    notes: ["leather", "tobacco", "mushroom", "coffee", "walnut", "wax"],
  },
  sulfur: {
    name: "Sulfur",
    description: "Struck matches, rubber, metal, onion, and fireworks.",
    wheelNotes: ["sulfur", "rubber", "copper"],
    notes: [
      "struck match",
      "rubber",
      "gunpowder",
      "copper",
      "onion",
      "firework",
    ],
  },
  sweet: {
    name: "Sweet",
    description: "Honey, vanilla, caramel, toffee, cream, and chocolate.",
    wheelNotes: ["honey", "vanilla", "caramel"],
    notes: ["honey", "vanilla", "caramel", "toffee", "cream", "chocolate"],
  },
  spice: {
    name: "Spice",
    description: "Pepper, cinnamon, clove, ginger, and licorice.",
    wheelNotes: ["clove", "cinnamon", "ginger"],
    notes: [
      "black pepper",
      "cinnamon",
      "clove",
      "ginger",
      "licorice",
      "nutmeg",
    ],
  },
  wood: {
    name: "Wood",
    description: "Oak, cedar, resin, sherry, wine, and toasted wood.",
    wheelNotes: ["oak", "sherry", "cedar"],
    notes: ["oak", "sherry", "cedar", "toasted oak", "sandalwood", "resin"],
  },
} as const satisfies Record<TagCategory, WheelCategoryDefinition>;

const WHEEL_CATEGORIES = TAG_CATEGORIES.map((key) => ({
  key,
  ...CATEGORY_DEFINITIONS[key],
}));

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
            9 groups of tasting words. Each group has 3 examples.
          </desc>
          {WHEEL_CATEGORIES.map((category, categoryIndex) => {
            const startAngle = categoryIndex * categorySpan;
            const endAngle = startAngle + categorySpan;
            const middleAngle = startAngle + categorySpan / 2;
            const noteSpan = categorySpan / category.wheelNotes.length;

            return (
              <a
                aria-label={`Go to the ${category.name} group`}
                href={`#tasting-note-${category.key}`}
                key={category.key}
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
                  )}
                />
                <text
                  textAnchor="middle"
                  transform={labelTransform(123, middleAngle)}
                  {...stylex.props(styles.categoryLabel)}
                >
                  {category.name}
                </text>
                {category.wheelNotes.map((note, noteIndex) => {
                  const noteStart = startAngle + noteIndex * noteSpan;
                  const noteEnd = noteStart + noteSpan;
                  const noteMiddle = noteStart + noteSpan / 2;

                  return (
                    <g key={note}>
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
              </a>
            );
          })}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS - 3}
            {...stylex.props(styles.hub)}
          />
          <text
            textAnchor="middle"
            x={CENTER}
            y={CENTER - 5}
            {...stylex.props(styles.hubTitle)}
          >
            9 groups
          </text>
          <text
            textAnchor="middle"
            x={CENTER}
            y={CENTER + 18}
            {...stylex.props(styles.hubLabel)}
          >
            Start here
          </text>
        </svg>
      </div>
      <figcaption {...stylex.props(styles.caption)}>
        <div>
          <div {...stylex.props(styles.captionEyebrow)}>How to use it</div>
          <div {...stylex.props(styles.captionTitle)}>
            <SectionHeading level={3}>Start with a group</SectionHeading>
          </div>
        </div>
        <p {...stylex.props(styles.captionText)}>
          Pick the group that is closest to what you notice. The lists below
          give you more specific words.
        </p>
        <p {...stylex.props(styles.captionText)}>
          A group helps you find related words. It does not claim one cause for
          a note.
        </p>
      </figcaption>
    </figure>
  );
}

export function TastingWheelFamilies() {
  return (
    <div {...stylex.props(styles.familyGrid)}>
      {WHEEL_CATEGORIES.map((category) => (
        <article
          id={`tasting-note-${category.key}`}
          key={category.key}
          {...stylex.props(styles.family)}
        >
          <SectionHeading level={3}>{category.name}</SectionHeading>
          <p {...stylex.props(styles.familyDescription)}>
            {category.description}
          </p>
          <div {...stylex.props(styles.notes)}>
            {category.notes.map((note) => (
              <Chip key={note}>{note}</Chip>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

const styles = stylex.create({
  figure: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 520px) minmax(220px, 1fr)",
    gap: space.x8,
    alignItems: "center",
    margin: 0,
    [WHEEL_STACKED]: {
      gridTemplateColumns: "minmax(0, 520px)",
    },
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
    outline: "none",
  },
  segment: {
    stroke: colors.ground,
    strokeWidth: 2,
  },
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
    display: { default: "block", [WHEEL_COMPACT]: "none" },
    fill: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "10.5px",
    fontWeight: 600,
    pointerEvents: "none",
  },
  hub: {
    fill: colors.ground,
    stroke: colors.hairline,
    strokeWidth: 1,
  },
  hubTitle: {
    fill: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    pointerEvents: "none",
  },
  hubLabel: {
    fill: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "11px",
    pointerEvents: "none",
  },
  caption: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
    paddingTop: space.x4,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    [WHEEL_STACKED]: {
      maxWidth: "620px",
      paddingRight: 0,
      paddingLeft: 0,
    },
  },
  captionEyebrow: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  captionTitle: { marginTop: space.x1 },
  captionText: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.6,
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
