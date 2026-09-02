import * as stylex from "@stylexjs/stylex";

import type { LocationMap } from "../lib/locationMap";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { CardLink } from "./card.stylex";
import { LocationMapIcon } from "./locationMapIcon";

export type LocationPreviewCardProps = {
  description?: string;
  href: string;
  name: string;
  totalBottles: number;
  visual: LocationMap | { kind: "count"; value: number } | null;
};

/** Equal-height location links with optional maps and three-line descriptions. */
export function LocationPreviewCard({
  description,
  href,
  name,
  totalBottles,
  visual,
}: LocationPreviewCardProps) {
  return (
    <CardLink
      appearance="outlined"
      href={href}
      padding="none"
      {...stylex.props(styles.card)}
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
      <strong title={name} {...stylex.props(styles.name)}>
        {name}
      </strong>
      <span {...stylex.props(styles.count)}>
        {totalBottles.toLocaleString("en-US")}{" "}
        {totalBottles === 1 ? "bottle" : "bottles"}
      </span>
      {description ? (
        <span {...stylex.props(styles.description)}>{description}</span>
      ) : null}
    </CardLink>
  );
}

const styles = stylex.create({
  card: {
    display: "grid",
    // Keep names aligned even when a map or description is missing.
    gridTemplateRows: "minmax(0, 1fr) auto auto 64px",
    height: "240px",
    minWidth: 0,
    padding: "18px",
    color: colors.ink,
    textDecoration: "none",
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
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  count: {
    gridRow: 3,
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
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
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    textWrap: "pretty",
  },
});
