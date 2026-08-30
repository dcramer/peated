import * as stylex from "@stylexjs/stylex";

import {
  AppLink,
  Card,
  FactList,
  hasVisibleFacts,
  type FactListItem,
} from "@peated/web/components/designSystem/components";
import { PageSection } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { parseDomain } from "@peated/web/lib/urls";
import { colors, effects } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function getEntityFacts(entity: Entity): [FactListItem, ...FactListItem[]] {
  const location = entity.country ? (
    <>
      {entity.region ? (
        <>
          <AppLink
            href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
            {...stylex.props(styles.factLink)}
          >
            {entity.region.name}
          </AppLink>
          <span>, </span>
        </>
      ) : null}
      <AppLink
        href={`/locations/${entity.country.slug}`}
        {...stylex.props(styles.factLink)}
      >
        {entity.country.name}
      </AppLink>
    </>
  ) : null;

  return [
    {
      label: "Website",
      value: entity.website ? (
        <a
          href={entity.website}
          rel="noreferrer"
          target="_blank"
          {...stylex.props(styles.factLink)}
        >
          {parseDomain(entity.website)}
        </a>
      ) : null,
    },
    { label: "Location", value: location },
    { label: "Address", value: entity.address },
    { label: "Also known as", value: entity.shortName },
  ];
}

export function hasEntityDetails(entity: Entity) {
  return hasVisibleFacts(getEntityFacts(entity));
}

export function EntityDetails({ entity }: { entity: Entity }) {
  const facts = getEntityFacts(entity);
  if (!hasVisibleFacts(facts)) return null;

  return (
    <PageSection heading="Details">
      <Card appearance="surface" padding="sm">
        <FactList facts={facts} />
      </Card>
    </PageSection>
  );
}

const styles = stylex.create({
  factLink: {
    color: colors.accentDeep,
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
