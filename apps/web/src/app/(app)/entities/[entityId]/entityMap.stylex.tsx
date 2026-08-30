import * as stylex from "@stylexjs/stylex";

import { Card } from "@peated/web/components/designSystem/components";
import { PageSection } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import {
  colors,
  effects,
  fonts,
  space,
} from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`;
}

export function EntityMap({ entity }: { entity: Entity }) {
  if (!entity.location) return null;

  const [longitude, latitude] = entity.location;
  const mapBounds = [
    longitude - 0.025,
    latitude - 0.015,
    longitude + 0.025,
    latitude + 0.015,
  ].join(",");
  const embedParams = new URLSearchParams({
    bbox: mapBounds,
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  const mapHref = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  const coordinateLabel = `${formatCoordinate(latitude, "N", "S")} ${formatCoordinate(longitude, "E", "W")}`;

  return (
    <PageSection heading="Where">
      <Card appearance="surface" padding="sm">
        {entity.address ? (
          <p {...stylex.props(styles.address)}>{entity.address}</p>
        ) : null}
        <iframe
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?${embedParams.toString()}`}
          title={`${entity.name} map`}
          {...stylex.props(styles.mapFrame)}
        />
        <div {...stylex.props(styles.mapFooter)}>
          <span {...stylex.props(styles.coordinates)}>{coordinateLabel}</span>
          <a
            href={mapHref}
            rel="noreferrer"
            target="_blank"
            {...stylex.props(styles.mapLink)}
          >
            Open in map →
          </a>
        </div>
      </Card>
    </PageSection>
  );
}

const styles = stylex.create({
  address: {
    margin: 0,
    marginBottom: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  mapFrame: {
    display: "block",
    width: "100%",
    height: "220px",
    borderWidth: 0,
    borderRadius: "2px",
    backgroundColor: colors.inset,
  },
  mapFooter: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x3,
    flexWrap: "wrap",
  },
  coordinates: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
  mapLink: {
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
