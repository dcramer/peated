import { FactList } from "../../components/factList.stylex";
import { RailSection } from "../../components/pages/pageLayout.stylex";
import { TextLink } from "../../components/textLink.stylex";
import { getEntityUrl } from "../../lib/urls";
import {
  ABOUT_MIN_KEY_FACTS,
  type AboutKeyFact,
  type AboutOwner,
} from "./entityAbout";

/** The About sidebar: key facts and owners over time. */
export function EntityAboutFacts({
  keyFacts,
  owners,
}: {
  keyFacts: readonly AboutKeyFact[];
  owners: readonly AboutOwner[];
}) {
  return (
    <>
      {keyFacts.length >= ABOUT_MIN_KEY_FACTS ? (
        <RailSection heading="Key facts">
          <FactList
            facts={keyFacts.map((fact) => ({
              label: fact.label,
              value: fact.value,
            }))}
          />
        </RailSection>
      ) : null}
      {owners.length ? (
        <RailSection heading="Owners">
          <FactList
            facts={owners.map((owner) => ({
              label:
                owner.end === null
                  ? `${owner.start}–today`
                  : `${owner.start}–${owner.end}`,
              value: owner.entity ? (
                <TextLink href={getEntityUrl(owner.entity)}>
                  {owner.entity.name}
                </TextLink>
              ) : (
                owner.label
              ),
            }))}
          />
        </RailSection>
      ) : null}
    </>
  );
}
