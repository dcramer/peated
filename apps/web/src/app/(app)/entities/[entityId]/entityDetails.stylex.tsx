import { toTitleCase } from "@peated/server/lib/strings";
import {
  FactList,
  hasVisibleFacts,
  type FactListItem,
} from "@peated/web/components/factList.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { getEntityUrl, parseDomain } from "@peated/web/lib/urls";

import type { Entity } from "./entityPageData";

function getEntityFacts(entity: Entity): [FactListItem, ...FactListItem[]] {
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

  return [
    { label: "Origin", value: location },
    {
      label: "Status",
      value: entity.status ? toTitleCase(entity.status) : null,
    },
    { label: "Established", value: entity.yearEstablished },
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
  ];
}

export function hasEntityDetails(entity: Entity) {
  return hasVisibleFacts(getEntityFacts(entity));
}

export function EntityDetails({ entity }: { entity: Entity }) {
  const facts = getEntityFacts(entity);
  if (!hasVisibleFacts(facts)) return null;

  return <FactList facts={facts} layout="grid" />;
}
