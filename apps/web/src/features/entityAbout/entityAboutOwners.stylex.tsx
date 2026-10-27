import * as stylex from "@stylexjs/stylex";

import { FactList } from "../../components/factList.stylex";
import { RailSection } from "../../components/pages/pageLayout.stylex";
import { TextLink } from "../../components/textLink.stylex";
import { getEntityUrl } from "../../lib/urls";
import { space } from "../../styles/tokens.stylex";
import type { AboutOwner } from "./entityAbout";

/** Owners over time, from the About document's acquisitions. */
export function EntityAboutOwners({
  owners,
}: {
  owners: readonly AboutOwner[];
}) {
  if (!owners.length) return null;

  return (
    <div {...stylex.props(styles.owners)}>
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
    </div>
  );
}

const styles = stylex.create({
  owners: {
    paddingTop: space.x6,
  },
});
