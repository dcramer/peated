import * as stylex from "@stylexjs/stylex";

import { DistributionList, FactList } from "@peated/web/components";
import type { BottleRailItem } from "@peated/web/components/pages/bottleRailSection.stylex";
import { BottleRailSection } from "@peated/web/components/pages/bottleRailSection.stylex";
import {
  PageColumns,
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, fonts } from "../../../styles/tokens.stylex";

import { LocationVisual } from "./locationPageFrame.stylex";

export function LocationOverview({
  categories,
  popularBottles,
  productionRules,
  totalBottles,
  totalDistillers,
  visual,
  visualHeading = "Map",
}: {
  categories: readonly { count: number; label: string }[];
  popularBottles: readonly BottleRailItem[];
  productionRules?: string | null;
  totalBottles: number;
  totalDistillers: number;
  visual: { kind: "country" | "state"; slug: string };
  visualHeading?: string;
}) {
  return (
    <PageColumns
      rail={
        <>
          <RailSection heading={visualHeading}>
            <LocationVisual visual={visual} />
          </RailSection>
          {productionRules ? (
            <RailSection heading="Production rules">
              <p {...stylex.props(styles.copy)}>{productionRules}</p>
            </RailSection>
          ) : null}
          {popularBottles.length ? (
            <BottleRailSection
              heading="Popular bottles"
              items={popularBottles}
            />
          ) : null}
        </>
      }
      railBehavior="stack"
    >
      <FactList
        facts={[
          { label: "Bottles", value: totalBottles.toLocaleString("en-US") },
          {
            label: "Distilleries",
            value: totalDistillers.toLocaleString("en-US"),
          },
        ]}
        layout="grid"
      />
      {categories.length ? (
        <PageSection heading="Bottles by category">
          <DistributionList items={categories} />
        </PageSection>
      ) : null}
    </PageColumns>
  );
}

const styles = stylex.create({
  copy: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
});
