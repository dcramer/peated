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

const DESCRIPTION_MAX_LENGTH = 80;

function truncateDescription(description: string) {
  const normalized = description.trim().replace(/\s+/g, " ");

  if (normalized.length <= DESCRIPTION_MAX_LENGTH) {
    return { text: normalized, truncated: false };
  }

  const wordBoundary = normalized
    .slice(0, DESCRIPTION_MAX_LENGTH + 1)
    .lastIndexOf(" ");
  const cutoff = wordBoundary > 0 ? wordBoundary : DESCRIPTION_MAX_LENGTH;

  return {
    text: `${normalized.slice(0, cutoff).trimEnd()}…`,
    truncated: true,
  };
}

/** Links to a country or region with its location visual and bottle count. */
export function LocationPreviewCard({
  description: rawDescription,
  href,
  name,
  totalBottles,
  visual,
}: LocationPreviewCardProps) {
  const description = rawDescription
    ? truncateDescription(rawDescription)
    : null;

  return (
    <CardLink
      appearance="outlined"
      href={href}
      padding="none"
      {...stylex.props(styles.card, visual && styles.withVisual)}
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
        <span {...stylex.props(styles.description)}>{description.text}</span>
      ) : null}
      {description?.truncated ? (
        <span {...stylex.props(styles.more)}>
          Read more <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </CardLink>
  );
}

const styles = stylex.create({
  card: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    justifyContent: "flex-end",
    padding: "18px",
    color: colors.ink,
    textDecoration: "none",
  },
  withVisual: {
    minHeight: "188px",
  },
  visual: {
    display: "flex",
    width: "100%",
    minHeight: 0,
    flex: 1,
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
    display: "block",
    flexShrink: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  description: {
    display: "block",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    textWrap: "pretty",
  },
  more: {
    display: "block",
    marginTop: space.x2,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
});
