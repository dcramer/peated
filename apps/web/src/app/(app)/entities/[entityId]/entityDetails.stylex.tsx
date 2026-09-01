import {
  FactList,
  TextLink,
  hasVisibleFacts,
  type FactListItem,
} from "@peated/web/components";
import { getEntityUrl, parseDomain } from "@peated/web/lib/urls";

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
    { label: "Established", value: entity.yearEstablished },
    {
      label: "Part of",
      value: entity.owner ? (
        <TextLink href={getEntityUrl(entity.owner)} size="inherit">
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
