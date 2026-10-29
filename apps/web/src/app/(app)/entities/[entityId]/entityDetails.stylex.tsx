import { toTitleCase } from "@peated/server/lib/strings";
import {
  FactList,
  hasVisibleFacts,
  type FactListItem,
} from "@peated/web/components/factList.stylex";
import { RailSection } from "@peated/web/components/pages/pageLayout.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import type { AboutKeyFact } from "@peated/web/features/entityAbout/entityAbout";
import { getEntityUrl, parseDomain } from "@peated/web/lib/urls";
import * as stylex from "@stylexjs/stylex";
import { space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

/** A sourced fact from the About document, without its sources. */
export type EntityAboutFact = Pick<AboutKeyFact, "key" | "label" | "value">;

function getEntityFacts(
  entity: Entity,
  aboutFacts: readonly EntityAboutFact[],
): [FactListItem, ...FactListItem[]] {
  const location = entity.country ? (
    <>
      {entity.region ? (
        <>
          <TextLink
            href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
          >
            {entity.region.name}
          </TextLink>
          <span>, </span>
        </>
      ) : null}
      <TextLink href={`/locations/${entity.country.slug}`}>
        {entity.country.name}
      </TextLink>
    </>
  ) : null;

  // A sourced founding year replaces the stored one, so the page shows one.
  const founded = aboutFacts.find((fact) => fact.key === "founded");

  return [
    { label: "Origin", value: location },
    {
      label: "Status",
      value: entity.status ? toTitleCase(entity.status) : null,
    },
    { label: "Founded", value: founded?.value ?? entity.yearEstablished },
    {
      label: "Part of",
      value: entity.owner ? (
        <TextLink href={getEntityUrl(entity.owner)}>
          {entity.owner.name}
        </TextLink>
      ) : null,
    },
    {
      label: "Website",
      value: entity.website ? (
        <TextLink href={entity.website} rel="noreferrer" target="_blank">
          {parseDomain(entity.website)}
        </TextLink>
      ) : null,
    },
    { label: "Short name", value: entity.shortName },
    ...aboutFacts
      .filter((fact) => fact !== founded)
      .map((fact) => ({ label: fact.label, value: fact.value })),
  ];
}

/** The Entity's stored facts and its About page's sourced facts, as one list. */
export function EntityDetails({
  entity,
  aboutFacts = [],
}: {
  entity: Entity;
  aboutFacts?: readonly EntityAboutFact[];
}) {
  const facts = getEntityFacts(entity, aboutFacts);
  if (!hasVisibleFacts(facts)) return null;

  return (
    <div {...stylex.props(styles.facts)}>
      <RailSection heading="Facts">
        <FactList facts={facts} />
      </RailSection>
    </div>
  );
}

const styles = stylex.create({
  facts: {
    paddingTop: space.x6,
  },
});
