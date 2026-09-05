import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { Card, CardLink } from "./card.stylex";
import CountryMapIcon from "./countryMapIcon";
import { LoadingPlaceholder } from "./feedback.stylex";

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
      <h2 {...stylex.props(foundationStyles.rowTitle, styles.title)}>{name}</h2>
      {summary ? (
        <p {...stylex.props(foundationStyles.metadata, styles.summary)}>
          {summary}
        </p>
      ) : null}
      <p {...stylex.props(foundationStyles.metadata, styles.counts)}>
        {totalBottles.toLocaleString("en-US")} {bottleNoun} ·{" "}
        {totalDistillers.toLocaleString("en-US")} {distillerNoun}
      </p>
    </CardLink>
  );
}

/** Reserves a country card's map and copy geometry while locations stream. */
export function LocationCardLoading({ delay = 0 }: { delay?: 0 | 1 | 2 | 3 }) {
  return (
    <Card padding="none" {...stylex.props(styles.card)}>
      <div aria-hidden="true" {...stylex.props(styles.map)} />
      <div {...stylex.props(styles.loadingTitle)}>
        <LoadingPlaceholder delay={delay} preset="heading" />
      </div>
      <div {...stylex.props(styles.loadingSummary)}>
        <LoadingPlaceholder delay={delay} preset="text" />
        <LoadingPlaceholder delay={delay} preset="metadata" />
      </div>
      <div {...stylex.props(styles.loadingCounts)}>
        <LoadingPlaceholder delay={delay} preset="metadata" />
      </div>
    </Card>
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
  },
  summary: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  counts: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  loadingTitle: { width: "72%" },
  loadingSummary: {
    display: "flex",
    minHeight: "39px",
    flexDirection: "column",
    gap: space.x2,
    marginTop: space.x2,
  },
  loadingCounts: { width: "76%", marginTop: space.x3 },
});
