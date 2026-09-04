import * as stylex from "@stylexjs/stylex";

import { type LocationMap, needsRegionMapCredit } from "../lib/locationMap";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { CardLink } from "./card.stylex";
import { LocationMapIcon } from "./locationMapIcon";
import { RegionMapCredit } from "./locationMapIcon/credit.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (min-width: 640px) and (max-width: 899px)";

export type LocationPreviewItem = {
  description?: string;
  href: string;
  name: string;
  totalBottles: number;
  visual: LocationMap | { kind: "count"; value: number } | null;
};

export type LocationPreviewCardProps = LocationPreviewItem & {
  showDescription?: boolean;
};

export type LocationPreviewGridProps = {
  locations: readonly LocationPreviewItem[];
  showDescriptions?: boolean;
};

export type RegionPreviewGridProps = {
  regions: readonly LocationPreviewItem[];
};

/** Equal-height location links with optional maps and three-line descriptions. */
export function LocationPreviewCard({
  description,
  href,
  name,
  showDescription = true,
  totalBottles,
  visual,
}: LocationPreviewCardProps) {
  return (
    <CardLink
      appearance="outlined"
      href={href}
      padding="none"
      {...stylex.props(
        styles.card,
        showDescription ? styles.cardWithDescription : styles.compactCard,
      )}
    >
      {visual ? (
        <span aria-hidden="true" {...stylex.props(styles.visual)}>
          {visual.kind === "count" ? (
            <span {...stylex.props(styles.countVisual)}>+{visual.value}</span>
          ) : (
            <LocationMapIcon
              visual={visual}
              {...stylex.props(styles.mapIcon)}
            />
          )}
        </span>
      ) : null}
      <strong
        title={name}
        {...stylex.props(foundationStyles.compactRowTitle, styles.name)}
      >
        {name}
      </strong>
      <span {...stylex.props(foundationStyles.metadata, styles.count)}>
        {totalBottles.toLocaleString("en-US")}{" "}
        {totalBottles === 1 ? "bottle" : "bottles"}
      </span>
      {showDescription && description ? (
        <span {...stylex.props(foundationStyles.metadata, styles.description)}>
          {description}
        </span>
      ) : null}
    </CardLink>
  );
}

/** Shows a group of location cards, with descriptions by default. */
export function LocationPreviewGrid({
  locations,
  showDescriptions = true,
}: LocationPreviewGridProps) {
  return (
    <div {...stylex.props(styles.grid)}>
      {locations.map((location) => (
        <LocationPreviewCard
          key={location.href}
          {...location}
          showDescription={showDescriptions}
        />
      ))}
    </div>
  );
}

/** Shows region cards and credits any map artwork used by the cards. */
export function RegionPreviewGrid({ regions }: RegionPreviewGridProps) {
  return (
    <>
      <div {...stylex.props(styles.regionGrid)}>
        <LocationPreviewGrid locations={regions} />
      </div>
      {regions.some(
        ({ visual }) =>
          visual?.kind !== "count" && needsRegionMapCredit(visual),
      ) ? (
        <RegionMapCredit />
      ) : null}
    </>
  );
}

const styles = stylex.create({
  card: {
    display: "grid",
    minWidth: 0,
    padding: "18px",
    color: colors.ink,
    textDecoration: "none",
  },
  cardWithDescription: {
    // Keep names aligned when one location is missing its description.
    gridTemplateRows: "minmax(0, 1fr) auto auto 64px",
    height: "240px",
  },
  compactCard: {
    gridTemplateRows: "minmax(0, 1fr) auto auto",
    height: "176px",
  },
  visual: {
    gridRow: 1,
    display: "flex",
    width: "100%",
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    color: colors.inkMuted,
  },
  mapIcon: {
    width: "100%",
    maxWidth: "132px",
    height: "76px",
  },
  countVisual: {
    fontFamily: fonts.display,
    fontSize: "42px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
  name: {
    gridRow: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  count: {
    gridRow: 3,
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  description: {
    gridRow: 4,
    display: "-webkit-box",
    alignSelf: "start",
    minWidth: 0,
    overflow: "hidden",
    overflowWrap: "anywhere",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
    marginTop: space.x2,
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  regionGrid: {
    marginTop: space.x2,
  },
});
