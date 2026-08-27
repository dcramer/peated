import type { StyleXStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../styles/tokens.stylex";

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
      <p {...stylex.props(foundationStyles.metadata, styles.swatchValues)}>
        {light} / {dark}
      </p>
    </article>
  );
}

export type FoundationSection = "color" | "shape" | "typography";

export default function DesignSystemFoundations({
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
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.categoryTitle)}>
          {title}
        </h1>
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
              use="Rows and panels"
              light="EBEEE7"
              dark="1B1E1A"
              colorStyle={styles.surface}
            />
            <TokenSwatch
              name="Inset"
              use="Fields and tracks"
              light="DCE0D6"
              dark="2B2F29"
              colorStyle={styles.inset}
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
              use="Sentiment and state"
              light="9A5B12"
              dark="D9922F"
              colorStyle={styles.accent}
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
          </div>
        </section>
      ) : null}

      {section === "typography" ? (
        <section {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.typeGrid)}>
            <article {...stylex.props(styles.typeSpecimen, styles.typeLead)}>
              <span
                {...stylex.props(
                  foundationStyles.microLabel,
                  styles.accentText,
                )}
              >
                Display · Space Grotesk
              </span>
              <p
                {...stylex.props(foundationStyles.pageTitle, styles.typeTitle)}
              >
                Lagavulin 16
              </p>
              <p {...stylex.props(foundationStyles.sectionHeading)}>
                Similar bottles
              </p>
              <p {...stylex.props(foundationStyles.rowTitle)}>
                Caol Ila 12-year-old
              </p>
            </article>

            <article {...stylex.props(styles.typeSpecimen)}>
              <span
                {...stylex.props(
                  foundationStyles.microLabel,
                  styles.accentText,
                )}
              >
                Reading · Karla
              </span>
              <p {...stylex.props(foundationStyles.body, styles.readingSample)}>
                Smoke arrives first, followed by lemon peel, brine, and a dry
                mineral finish. The texture stays light despite the long finish.
              </p>
              <p {...stylex.props(foundationStyles.interactive)}>
                Record a tasting
              </p>
            </article>

            <article
              {...stylex.props(styles.typeSpecimen, styles.dataSpecimen)}
            >
              <span
                {...stylex.props(
                  foundationStyles.microLabel,
                  styles.accentText,
                )}
              >
                Data · IBM Plex Mono
              </span>
              <dl {...stylex.props(styles.dataList)}>
                <div {...stylex.props(styles.dataRow)}>
                  <dt
                    {...stylex.props(foundationStyles.fieldLabel, styles.muted)}
                  >
                    Peated ID
                  </dt>
                  <dd {...stylex.props(foundationStyles.metadata)}>B00872</dd>
                </div>
                <div {...stylex.props(styles.dataRow)}>
                  <dt
                    {...stylex.props(foundationStyles.fieldLabel, styles.muted)}
                  >
                    ABV
                  </dt>
                  <dd {...stylex.props(foundationStyles.metadata)}>43.0%</dd>
                </div>
                <div {...stylex.props(styles.dataRow)}>
                  <dt
                    {...stylex.props(foundationStyles.fieldLabel, styles.muted)}
                  >
                    Tastings
                  </dt>
                  <dd {...stylex.props(foundationStyles.metadata)}>2,841</dd>
                </div>
              </dl>
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
  categoryTitle: {
    fontSize: { default: "40px", [COMPACT]: "32px" },
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
    padding: space.x2,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  swatchFrame: {
    height: "112px",
    marginBottom: space.x3,
    padding: space.x1,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  swatchColor: {
    width: "100%",
    height: "100%",
    borderRadius: controlMetrics.radiusSmall,
  },
  ground: { backgroundColor: colors.ground },
  surface: { backgroundColor: colors.surface },
  inset: { backgroundColor: colors.inset },
  ink: { backgroundColor: colors.ink },
  accent: { backgroundColor: colors.accent },
  swatchValues: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontSize: "10px",
  },
  tonalExample: {
    display: "grid",
    gridTemplateColumns: { default: "1fr 1fr 1fr", [COMPACT]: "1fr" },
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
  typeGrid: {
    display: "grid",
    gridTemplateColumns: { default: "1.35fr 1fr 1fr", [NARROW]: "1fr" },
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
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  typeLead: {
    backgroundColor: colors.inset,
  },
  typeTitle: {
    fontSize: { default: "44px", [COMPACT]: "36px" },
  },
  readingSample: {
    maxWidth: "36ch",
    fontSize: "17px",
  },
  dataSpecimen: {
    backgroundColor: colors.ground,
  },
  dataList: {
    display: "flex",
    flexDirection: "column",
    margin: 0,
  },
  dataRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: space.x4,
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
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
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  radiusPanel: {
    display: "flex",
    height: "100px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  chipExample: {
    width: "fit-content",
    paddingTop: "6px",
    paddingRight: space.x2,
    paddingBottom: "6px",
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
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
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
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
