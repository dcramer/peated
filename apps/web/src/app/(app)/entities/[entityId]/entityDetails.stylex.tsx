import * as stylex from "@stylexjs/stylex";

import {
  TextLink,
  hasVisibleFacts,
  type FactListItem,
} from "@peated/web/components";
import { parseDomain } from "@peated/web/lib/urls";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function getEntityFacts(entity: Entity): [FactListItem, ...FactListItem[]] {
  const location = entity.country ? (
    <>
      {entity.region ? (
        <>
          <TextLink
            href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
            size="inherit"
          >
            {entity.region.name}
          </TextLink>
          <span>, </span>
        </>
      ) : null}
      <TextLink href={`/locations/${entity.country.slug}`} size="inherit">
        {entity.country.name}
      </TextLink>
    </>
  ) : null;

  return [
    { label: "Region", value: location },
    {
      label: "Owned by",
      value: entity.owner ? (
        <TextLink href={`/entities/${entity.owner.id}`} size="inherit">
          {entity.owner.name}
        </TextLink>
      ) : null,
    },
    {
      label: "Website",
      value: entity.website ? (
        <TextLink
          href={entity.website}
          rel="noreferrer"
          size="inherit"
          target="_blank"
        >
          {parseDomain(entity.website)}
        </TextLink>
      ) : null,
    },
    { label: "Also known as", value: entity.shortName },
  ];
}

export function hasEntityDetails(entity: Entity) {
  return hasVisibleFacts(getEntityFacts(entity));
}

export function EntityDetails({ entity }: { entity: Entity }) {
  const facts = getEntityFacts(entity);
  if (!hasVisibleFacts(facts)) return null;

  const visibleFacts = facts.filter(
    (fact) =>
      fact.value !== null &&
      fact.value !== undefined &&
      fact.value !== "" &&
      fact.value !== false &&
      fact.value !== true,
  );

  return (
    <dl {...stylex.props(styles.factGrid)}>
      {visibleFacts.map((fact) => (
        <div key={fact.label} {...stylex.props(styles.fact)}>
          <dt {...stylex.props(styles.factLabel)}>{fact.label}</dt>
          <dd {...stylex.props(styles.factValue)}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const styles = stylex.create({
  factGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(auto-fit, minmax(160px, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x4,
    margin: 0,
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  fact: {
    minWidth: 0,
  },
  factLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.04em",
    lineHeight: 1.3,
  },
  factValue: {
    minWidth: 0,
    margin: 0,
    marginTop: space.x1,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
});
