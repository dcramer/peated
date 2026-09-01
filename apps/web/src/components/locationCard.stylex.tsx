import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../styles/tokens.stylex";
import { CardLink } from "./card.stylex";
import CountryMapIcon from "./countryMapIcon";

export type LocationCardProps = {
  href: string;
  name: string;
  slug: string;
  summary?: string | null;
  totalBottles: number;
  totalDistillers: number;
};

export function LocationCard({
  href,
  name,
  slug,
  summary,
  totalBottles,
  totalDistillers,
}: LocationCardProps) {
  const bottleNoun = totalBottles === 1 ? "bottle" : "bottles";
  const distillerNoun = totalDistillers === 1 ? "distiller" : "distillers";

  return (
    <CardLink href={href} padding="none" {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.map)}>
        <CountryMapIcon
          aria-hidden="true"
          slug={slug}
          {...stylex.props(styles.mapIcon)}
        />
      </div>
      <h2 {...stylex.props(styles.title)}>{name}</h2>
      {summary ? <p {...stylex.props(styles.summary)}>{summary}</p> : null}
      <p {...stylex.props(styles.counts)}>
        {totalBottles.toLocaleString("en-US")} {bottleNoun} ·{" "}
        {totalDistillers.toLocaleString("en-US")} {distillerNoun}
      </p>
    </CardLink>
  );
}

const styles = stylex.create({
  card: {
    padding: space.x4,
  },
  map: {
    display: "flex",
    height: "132px",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.x4,
    padding: space.x4,
    borderRadius: "2px",
    backgroundColor: colors.inset,
  },
  mapIcon: {
    display: "block",
    width: "100%",
    maxWidth: "180px",
    height: "100%",
    color: colors.ink,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  summary: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  counts: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.04em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
});
