import { Button } from "./button.stylex";
import { Field, TextInput } from "./field.stylex";
import { ItemList, ItemRow } from "./itemList.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { TextLink } from "./textLink.stylex";

import type { StyleXStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 899px)";

type TokenSwatchProps = {
  name: string;
  light: string;
  dark: string;
  use: string;
  colorStyle: StyleXStyles;
};

function TokenSwatch({ name, light, dark, use, colorStyle }: TokenSwatchProps) {
  return (
    <article {...stylex.props(styles.swatchCard)}>
      <div {...stylex.props(styles.swatchFrame)}>
        <div {...stylex.props(styles.swatchColor, colorStyle)} />
      </div>
      <h3 {...stylex.props(foundationStyles.rowTitle)}>{name}</h3>
      <p {...stylex.props(foundationStyles.body, styles.muted)}>{use}</p>
      <p {...stylex.props(foundationStyles.code, styles.swatchValues)}>
        {light} / {dark}
      </p>
    </article>
  );
}

export type FoundationSection = "color" | "shape" | "typography";

export default function Foundations({
  section,
}: {
  section: FoundationSection;
}) {
  const title =
    section === "color"
      ? "Color"
      : section === "typography"
        ? "Typography"
        : "Shape and spacing";

  return (
    <main {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.hero)}>
        <h1 {...stylex.props(foundationStyles.pageTitleCompact)}>{title}</h1>
      </header>

      {section === "color" ? (
        <section {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.swatchGrid)}>
            <TokenSwatch
              name="Ground"
              use="Page field"
              light="F7F8F5"
              dark="101210"
              colorStyle={styles.ground}
            />
            <TokenSwatch
              name="Surface"
              use="Hover wash and rare panels"
              light="EBEEE7"
              dark="1B1E1A"
              colorStyle={styles.surface}
            />
            <TokenSwatch
              name="Inset"
              use="Pressed state and tracks"
              light="DCE0D6"
              dark="2B2F29"
              colorStyle={styles.inset}
            />
            <TokenSwatch
              name="Sunken"
              use="Pressed state inside a panel"
              light="CBD0C2"
              dark="3A3F37"
              colorStyle={styles.sunken}
            />
            <TokenSwatch
              name="Ink"
              use="Text and commitment"
              light="161914"
              dark="E8EAE3"
              colorStyle={styles.ink}
            />
            <TokenSwatch
              name="Accent"
              use="Ratings, links, and one main action"
              light="9A5B12"
              dark="D9922F"
              colorStyle={styles.accent}
            />
            <TokenSwatch
              name="Critical"
              use="Invalid fields and critical messages"
              light="A3231A"
              dark="F0776B"
              colorStyle={styles.critical}
            />
          </div>

          <div {...stylex.props(styles.tonalExample)}>
            <div {...stylex.props(styles.toneGround)}>
              <span
                {...stylex.props(foundationStyles.microLabel, styles.muted)}
              >
                Ground
              </span>
            </div>
            <div {...stylex.props(styles.toneSurface)}>
              <span
                {...stylex.props(foundationStyles.microLabel, styles.muted)}
              >
                Surface
              </span>
            </div>
            <div {...stylex.props(styles.toneInset)}>
              <span
                {...stylex.props(foundationStyles.microLabel, styles.muted)}
              >
                Inset
              </span>
            </div>
            <div {...stylex.props(styles.toneSunken)}>
              <span
                {...stylex.props(foundationStyles.microLabel, styles.muted)}
              >
                Sunken
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {section === "typography" ? (
        <section {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.typeGrid)}>
            <article {...stylex.props(styles.typeSpecimen)}>
              <p {...stylex.props(foundationStyles.pageTitleCompact)}>Whisky</p>
              <SectionHeading>Distilleries</SectionHeading>
              <ItemList ariaLabel="Standard row titles">
                <ItemRow
                  href="#lagavulin"
                  title="Lagavulin"
                  metadata="Islay · Scotland"
                />
              </ItemList>
              <ItemList ariaLabel="Compact row titles">
                <ItemRow
                  href="#bruichladdich"
                  title="Bruichladdich"
                  metadata="Islay · Scotland"
                  size="sm"
                />
              </ItemList>
              <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
                Space Grotesk: page titles, section headings, and names.
                Sections use 24px; rows use 18px or 16px in compact lists.
              </p>
            </article>
            <article {...stylex.props(styles.typeSpecimen)}>
              <SectionHeading>Reading</SectionHeading>
              <p {...stylex.props(foundationStyles.prose)}>
                Smoke arrives first, followed by lemon peel, brine, and a dry
                mineral finish. The texture stays light despite the long finish.
              </p>
              <p {...stylex.props(foundationStyles.body)}>
                Browse bottles, read tasting notes, and add what you know.
              </p>
              <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
                Islay · Single malt · 16 years · 43% ABV
              </p>
              <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
                Karla: 16px for longer reading, 15px for body copy, and 13px for
                dates, counts, hints, and other supporting text.
              </p>
              <code {...stylex.props(foundationStyles.code)}>
                GET /v1/bottles
              </code>
            </article>
            <article {...stylex.props(styles.typeSpecimen)}>
              <SectionHeading>Fields and actions</SectionHeading>
              <Field
                htmlFor="typography-name"
                label="Bottle name"
                hint="Use the name on the label."
                required
              >
                <TextInput id="typography-name" defaultValue="Uigeadail" />
              </Field>
              <Button>Save bottle</Button>
              <TextLink href="#bottles">View all bottles</TextLink>
              <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
                Labels use 13px Karla with emphasis. Inputs stay at 16px on
                every screen. Actions use 15px, or 13px in compact controls.
                Monospace is reserved for code and technical identifiers.
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {section === "shape" ? (
        <section {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.foundationGrid)}>
            <article {...stylex.props(styles.foundationSpecimen)}>
              <div {...stylex.props(styles.radiusPanel)}>
                <span {...stylex.props(foundationStyles.metadata)}>3px</span>
              </div>
              <p {...stylex.props(foundationStyles.body, styles.muted)}>
                Controls and panels
              </p>
            </article>
            <article {...stylex.props(styles.foundationSpecimen)}>
              <div {...stylex.props(styles.chipExample)}>
                <span {...stylex.props(foundationStyles.metadata)}>
                  2px chip
                </span>
              </div>
              <p {...stylex.props(foundationStyles.body, styles.muted)}>
                Tags and data devices
              </p>
            </article>
            <article {...stylex.props(styles.foundationSpecimen)}>
              <div {...stylex.props(styles.overlayExample)}>
                <span {...stylex.props(foundationStyles.metadata)}>
                  Overlay
                </span>
              </div>
              <p {...stylex.props(foundationStyles.body, styles.muted)}>
                The only elevated surface
              </p>
            </article>
          </div>

          <div {...stylex.props(styles.spacingScale)}>
            {[4, 8, 12, 16, 24, 32, 48].map((value) => (
              <div key={value} {...stylex.props(styles.spacingItem)}>
                <span
                  {...stylex.props(
                    foundationStyles.metadata,
                    styles.spacingLabel,
                  )}
                >
                  {value}
                </span>
                <span
                  {...stylex.props(
                    styles.spacingBar,
                    styles.spacingBarWidth(value),
                  )}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    width: "100%",
  },
  hero: {
    width: "100%",
    maxWidth: "1180px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingBottom: space.x8,
  },
  accentText: {
    color: colors.accentDeep,
  },
  muted: {
    color: colors.inkMuted,
  },
  section: {
    width: "100%",
    maxWidth: "1180px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingBottom: space.x8,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  swatchGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(5, minmax(0, 1fr))",
      [NARROW]: "repeat(3, minmax(0, 1fr))",
      [COMPACT]: "repeat(2, minmax(0, 1fr))",
    },
    columnGap: space.x2,
    rowGap: space.x2,
  },
  swatchCard: {
    minWidth: 0,
    paddingTop: space.x2,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
  },
  swatchFrame: {
    height: "112px",
    marginBottom: space.x3,
    padding: 0,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: "transparent",
  },
  swatchColor: {
    width: "100%",
    height: "100%",
    borderRadius: controlMetrics.radiusSmall,
  },
  ground: { backgroundColor: colors.ground },
  surface: { backgroundColor: colors.surface },
  inset: { backgroundColor: colors.inset },
  sunken: { backgroundColor: colors.sunken },
  ink: { backgroundColor: colors.ink },
  accent: { backgroundColor: colors.accent },
  critical: { backgroundColor: colors.critical },
  swatchValues: {
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  tonalExample: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(4, minmax(0, 1fr))",
      [COMPACT]: "1fr 1fr",
    },
    marginTop: space.x4,
    padding: space.x3,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
  },
  toneGround: {
    minHeight: "88px",
    padding: space.x3,
    backgroundColor: colors.ground,
  },
  toneSurface: {
    minHeight: "88px",
    padding: space.x3,
    backgroundColor: colors.surface,
  },
  toneInset: {
    minHeight: "88px",
    padding: space.x3,
    backgroundColor: colors.inset,
  },
  toneSunken: {
    minHeight: "88px",
    padding: space.x3,
    backgroundColor: colors.sunken,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [NARROW]: "1fr",
    },
    columnGap: space.x2,
    rowGap: space.x2,
  },
  typeSpecimen: {
    minWidth: 0,
    minHeight: "280px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    rowGap: space.x6,
    padding: { default: space.x6, [COMPACT]: space.x4 },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    backgroundColor: "transparent",
  },
  foundationGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [COMPACT]: "1fr",
    },
    columnGap: space.x2,
    rowGap: space.x2,
  },
  foundationSpecimen: {
    display: "flex",
    minHeight: "180px",
    flexDirection: "column",
    justifyContent: "space-between",
    rowGap: space.x4,
    padding: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    backgroundColor: "transparent",
  },
  radiusPanel: {
    display: "flex",
    height: "100px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: "transparent",
    boxShadow: `inset 0 0 0 1px ${colors.sectionRule}`,
  },
  chipExample: {
    width: "fit-content",
    paddingTop: "6px",
    paddingRight: space.x2,
    paddingBottom: "6px",
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: "transparent",
    color: colors.accentDeep,
    boxShadow: `inset 0 0 0 1px ${colors.accent}`,
  },
  overlayExample: {
    display: "flex",
    height: "100px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  spacingScale: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(7, minmax(0, 1fr))",
      [NARROW]: "repeat(4, minmax(0, 1fr))",
      [COMPACT]: "repeat(2, minmax(0, 1fr))",
    },
    columnGap: space.x3,
    rowGap: space.x4,
    marginTop: space.x6,
    paddingTop: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    backgroundColor: "transparent",
  },
  spacingItem: {
    minWidth: 0,
  },
  spacingLabel: {
    display: "block",
    marginBottom: space.x2,
    color: colors.inkMuted,
  },
  spacingBar: {
    display: "block",
    height: space.x2,
    maxWidth: "100%",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.accent,
  },
  spacingBarWidth: (value: number) => ({ width: `${value}px` }),
});
