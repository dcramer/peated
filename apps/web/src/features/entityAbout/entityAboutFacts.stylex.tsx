import { FactList } from "../../components/factList.stylex";
import { RailSection } from "../../components/pages/pageLayout.stylex";
import { TextLink } from "../../components/textLink.stylex";
import { getEntityUrl } from "../../lib/urls";
import type { EntityAbout } from "./entityAbout";

function OwnerLink({ entityId, name }: { entityId?: number; name: string }) {
  if (!entityId) return name;
  return (
    <TextLink href={getEntityUrl({ id: entityId, kind: null, name })}>
      {name}
    </TextLink>
  );
}

/** The sidebar summary of an About article: key facts and every owner. */
export function EntityAboutFacts({ about }: { about: EntityAbout }) {
  return (
    <>
      <RailSection heading="At a glance">
        <FactList
          facts={about.facts.map((fact) => ({
            label: fact.label,
            value: <OwnerLink entityId={fact.entityId} name={fact.value} />,
          }))}
        />
      </RailSection>
      <RailSection heading="Owners">
        <FactList
          facts={[...about.owners].reverse().map((owner) => ({
            label:
              owner.end === null
                ? `${owner.start}–today`
                : `${owner.start}–${owner.end}`,
            value: <OwnerLink entityId={owner.entityId} name={owner.label} />,
          }))}
        />
      </RailSection>
    </>
  );
}
